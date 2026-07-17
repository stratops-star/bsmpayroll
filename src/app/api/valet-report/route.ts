import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { sendReportFor } from '@/lib/valet-report-send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TRIES = 5
const BATCH = 8              // keep the run inside the function time limit
const WINDOW_DAYS = 7

// Vercel Cron calls this on a schedule with `Authorization: Bearer $CRON_SECRET`.
// Runs server-side — no attendant needs to open the app.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const svc = createServerClient()
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: due, error } = await svc
    .from('valet_events')
    .select('id')
    .is('reported_at', null)
    .neq('voided', true)
    .eq('email_retryable', true)
    .lt('email_attempts', MAX_TRIES)
    .gte('event_at', cutoff)
    .order('event_at', { ascending: false })
    .limit(BATCH)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = (due as { id: string }[]) || []
  let emailed = 0
  const failures: { id: string; reason: string | null }[] = []

  for (const row of list) {
    try {
      const r = await sendReportFor(svc, row.id)
      if (r.emailed) emailed++
      else failures.push({ id: row.id, reason: r.reason })
    } catch (e: any) {
      failures.push({ id: row.id, reason: e?.message || 'error' })
    }
  }

  return NextResponse.json({ ok: true, considered: list.length, emailed, failures })
}
