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

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
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
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!fingercheckConfigured()) return NextResponse.json({ error: 'Fingercheck env vars missing' }, { status: 500 })
  const out = await run()
  return NextResponse.json(out, { status: out.ok ? 200 : 500 })
}

// Vercel cron issues GET; POST is here so the app can trigger a manual refresh.
export async function POST(req: NextRequest) {
  return GET(req)
}
