import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { sendReportFor } from '@/lib/valet-report-send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function requireValet(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return false
  const svc = createServerClient()
  const { data: me } = await svc.from('app_users').select('role, active, departments').eq('id', user.id).single()
  if (!me || me.active === false) return false
  const depts: string[] = Array.isArray((me as any).departments) ? (me as any).departments : []
  return ['valet', 'valet_manager', 'admin'].includes(me.role) || depts.includes('valet')
}

// POST { event_id } — build the report and email the tenant a copy
export async function POST(req: NextRequest) {
  if (!(await requireValet(req))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const { event_id } = await req.json().catch(() => ({}))
  if (!event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

  const svc = createServerClient()
  const r = await sendReportFor(svc, event_id)
  return NextResponse.json({ ok: true, emailed: r.emailed, reason: r.reason, retryable: r.retryable, attempts: r.attempts })
}
