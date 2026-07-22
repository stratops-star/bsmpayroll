// src/app/api/fingercheck-probe/route.ts
// DIAGNOSTIC ONLY — used to learn what Fingercheck's status integers mean.
// Call it as a real hire moves through onboarding and watch the numbers change:
//   /api/fingercheck-probe?employee=4412
//   /api/fingercheck-probe?employee=4412&raw=1   (full unfiltered Employee object)
//
// Admin-gated: you must be signed in as an app admin. Delete this route once the
// status codes are mapped and the real onboarding sync is in place.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getEmployee, toSnapshot, fingercheckConfigured } from '@/lib/fingercheck'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // ── gate: signed-in admin only ──
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Missing bearer token. Call this from the app, or paste your access token.' }, { status: 401 })

  const supabase = createServerClient()
  const { data: { user }, error: uErr } = await supabase.auth.getUser(token)
  if (uErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  const { data: me } = await supabase.from('app_users').select('role, active').eq('id', user.id).single()
  if (!me?.active || me.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  if (!fingercheckConfigured()) {
    return NextResponse.json({ error: 'Set FINGERCHECK_API_KEY and FINGERCHECK_CLIENT_SECRET in Vercel' }, { status: 500 })
  }

  const employeeNumber = req.nextUrl.searchParams.get('employee')
  if (!employeeNumber) return NextResponse.json({ error: 'Pass ?employee=<employeeNumber>' }, { status: 400 })

  const res = await getEmployee(employeeNumber)
  if (!res.ok) return NextResponse.json({ error: res.error, status: res.status }, { status: 502 })

  const wantRaw = req.nextUrl.searchParams.get('raw') === '1'
  const snap = toSnapshot(res.data)

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    // the fields that should drive the onboarding board
    progress: snap,
    // what we still need to learn — record these at each stage
    note: 'Record onBoardingStatus / newHireStatus / divisionEmployeeStatus / everify.currentState at each visible step in Fingercheck, so the integers can be mapped to board stages.',
    ...(wantRaw ? { raw: res.data } : {}),
  })
}
