// src/app/api/cron/fingercheck-sync/route.ts
//
// Fingercheck has no webhooks, so we poll. This runs on a schedule, pulls the
// current state of everyone mid-onboarding, and advances their card.
//
// Guarded by CRON_SECRET (Vercel sends it as a Bearer token on cron requests).
// Admins can also trigger it manually from the app with their session token.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getEmployee, toSnapshot, fingercheckConfigured, type OnboardingSnapshot } from '@/lib/fingercheck'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Row = {
  id: string
  candidate_id: string
  fingercheck_employee_number: string | null
  stage: string
  documents_ok: boolean
  synced_to_sheet_at: string | null
  fc_cost_center_1: string | null
  fc_supervisor_number: string | null
}

/**
 * Derive the board stage from what Fingercheck reports.
 *
 * `fc_division_status` is the reliable signal — a readable string, not an opaque
 * integer: 'OnBoarding' while they are still in the flow, 'A' once active.
 * `fc_onboarding_status` runs 0 → 1000; the intermediate values are not yet
 * mapped, so anything above 0 and below 1000 simply counts as "in progress".
 */
export function deriveStage(row: Row, snap: OnboardingSnapshot | null): string {
  if (row.synced_to_sheet_at) return 'in_employee_db'
  if (!row.fingercheck_employee_number || !snap) return 'offer_signed'

  const div = (snap.divisionEmployeeStatus || '').trim().toLowerCase()
  const ob = snap.onBoardingStatus ?? 0
  const finishedInFingercheck = div === 'a' || div === 'active' || ob >= 1000

  if (!finishedInFingercheck) {
    // Still inside Fingercheck's own onboarding.
    return ob > 0 ? 'signing_up' : 'invited'
  }

  // Fingercheck side is done. The remaining gates are ours.
  // BSM records carry no E-Verify transactions, so documents are HR-marked.
  if (!row.documents_ok) return 'documents'

  const costCenter = snap.costCenter1 ?? row.fc_cost_center_1
  const supervisor = snap.supervisorEmployeeNumber ?? row.fc_supervisor_number
  if (!costCenter || !supervisor) return 'configuration'

  return 'active'   // fully configured, ready to push to the employee sheet
}

// Two callers are allowed: Vercel cron (Bearer CRON_SECRET) and a signed-in
// admin hitting Refresh on the onboarding board (Bearer <session access token>).
async function authorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)

  const secret = process.env.CRON_SECRET
  if (secret && token === secret) return true

  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return false
    const { data: me } = await supabase.from('app_users').select('role, departments, active').eq('id', user.id).single()
    if (!me?.active) return false
    return me.role === 'admin' || (me.departments || []).includes('recruiting')
  } catch {
    return false
  }
}

async function run() {
  const supabase = createServerClient()
  const started = Date.now()

  // 1. Open a card for any candidate who has signed an offer but has no row yet.
  const { data: fresh } = await supabase
    .from('candidates')
    .select('id')
    .eq('onboarding_status', 'offer_signed')
  if (fresh?.length) {
    const { data: existing } = await supabase
      .from('onboarding')
      .select('candidate_id')
      .in('candidate_id', fresh.map((c: any) => c.id))
    const have = new Set((existing || []).map((r: any) => r.candidate_id))
    const missing = fresh.filter((c: any) => !have.has(c.id))
    if (missing.length) {
      await supabase.from('onboarding').insert(missing.map((c: any) => ({ candidate_id: c.id, stage: 'offer_signed' })))
    }
  }

  // 2. Poll everyone who has a Fingercheck record and isn't finished.
  const { data: rows, error } = await supabase
    .from('onboarding')
    .select('id, candidate_id, fingercheck_employee_number, stage, documents_ok, synced_to_sheet_at, fc_cost_center_1, fc_supervisor_number')
    .neq('stage', 'in_employee_db')
    .not('fingercheck_employee_number', 'is', null)

  if (error) return { ok: false, error: error.message }

  const results: { employee: string; stage: string; changed: boolean; error?: string }[] = []

  for (const row of (rows || []) as Row[]) {
    const empNo = row.fingercheck_employee_number!
    const res = await getEmployee(empNo)

    if (!res.ok) {
      await supabase.from('onboarding')
        .update({ fc_last_error: res.error, fc_last_synced_at: new Date().toISOString() })
        .eq('id', row.id)
      results.push({ employee: empNo, stage: row.stage, changed: false, error: res.error })
      continue
    }

    const snap = toSnapshot(res.data)
    const stage = deriveStage(row, snap)

    await supabase.from('onboarding').update({
      stage,
      fc_onboarding_status: snap.onBoardingStatus,
      fc_new_hire_status: snap.newHireStatus,
      fc_division_status: snap.divisionEmployeeStatus,
      fc_hire_date: snap.hireDate ? snap.hireDate.slice(0, 10) : null,
      fc_position: snap.position,
      fc_cost_center_1: snap.costCenter1,
      fc_location: snap.location,
      fc_supervisor_number: snap.supervisorEmployeeNumber,
      fc_modified_on: snap.modifiedOn,
      fc_first_name: snap.name ? snap.name.split(' ')[0] : null,
      fc_last_name: snap.name ? snap.name.split(' ').slice(1).join(' ') || null : null,
      fc_last_synced_at: new Date().toISOString(),
      fc_last_error: null,
    }).eq('id', row.id)

    results.push({ employee: empNo, stage, changed: stage !== row.stage })
  }

  return {
    ok: true,
    checked: results.length,
    advanced: results.filter(r => r.changed).length,
    failed: results.filter(r => r.error).length,
    ms: Date.now() - started,
    results,
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!fingercheckConfigured()) return NextResponse.json({ error: 'Fingercheck env vars missing' }, { status: 500 })
  const out = await run()
  return NextResponse.json(out, { status: out.ok ? 200 : 500 })
}

// Vercel cron issues GET.
// POST does double duty for the board:
//   {}                          → run a sync now (Refresh button)
//   { employeeNumber: "100727" } → open a card for someone already in Fingercheck
export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!fingercheckConfigured()) return NextResponse.json({ error: 'Fingercheck env vars missing' }, { status: 500 })

  let body: any = {}
  try { body = await req.json() } catch { /* empty body = plain sync */ }

  const empNo = (body?.employeeNumber || '').toString().trim()
  if (!empNo) {
    const out = await run()
    return NextResponse.json(out, { status: out.ok ? 200 : 500 })
  }

  const supabase = createServerClient()

  const { data: dupe } = await supabase
    .from('onboarding').select('id').eq('fingercheck_employee_number', empNo).maybeSingle()
  if (dupe) return NextResponse.json({ error: `Employee #${empNo} is already on the board.` }, { status: 409 })

  const res = await getEmployee(empNo)
  if (!res.ok) return NextResponse.json({ error: `Fingercheck: ${res.error}` }, { status: 502 })

  const snap = toSnapshot(res.data)
  const seed = {
    id: '', candidate_id: '', fingercheck_employee_number: empNo, stage: 'invited',
    documents_ok: false, synced_to_sheet_at: null,
    fc_cost_center_1: snap.costCenter1, fc_supervisor_number: snap.supervisorEmployeeNumber,
  } as unknown as Row
  const stage = deriveStage(seed, snap)

  const { data: inserted, error } = await supabase.from('onboarding').insert({
    candidate_id: null,
    source: 'fingercheck',
    fingercheck_employee_number: empNo,
    stage,
    fc_first_name: snap.name ? snap.name.split(' ')[0] : null,
    fc_last_name: snap.name ? snap.name.split(' ').slice(1).join(' ') || null : null,
    fc_onboarding_status: snap.onBoardingStatus,
    fc_new_hire_status: snap.newHireStatus,
    fc_division_status: snap.divisionEmployeeStatus,
    fc_hire_date: snap.hireDate ? snap.hireDate.slice(0, 10) : null,
    fc_position: snap.position,
    fc_cost_center_1: snap.costCenter1,
    fc_location: snap.location,
    fc_supervisor_number: snap.supervisorEmployeeNumber,
    fc_modified_on: snap.modifiedOn,
    fc_last_synced_at: new Date().toISOString(),
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: inserted?.id, name: snap.name, stage })
}
