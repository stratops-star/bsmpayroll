import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TZ = 'America/New_York'
const etDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
const etTime = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })

function e164(phone: string) { const d = (phone || '').replace(/\D/g, ''); if (d.length === 10) return '+1' + d; if (d.length === 11 && d[0] === '1') return '+' + d; return d ? '+' + d : '' }

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; if (!key) return false
  try { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'BSM Recruiting <careers@bsmfacilitysolutions.com>', to: [to], subject, html }) }); return r.ok } catch { return false }
}
async function sendSMS(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM
  const e = e164(to); if (!sid || !tok || !from || !e) return false
  try { const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: e, From: from, Body: body }) }); return r.ok } catch { return false }
}

async function run() {
  const supabase = createServerClient()
  const now = new Date()
  const todayStr = etDate(now)
  const tomStr = etDate(new Date(now.getTime() + 864e5))

  // window: now to +3 days (covers today + tomorrow in ET regardless of UTC offset)
  const fromIso = new Date(now.getTime() - 12 * 3600e3).toISOString()
  const toIso = new Date(now.getTime() + 3 * 864e5).toISOString()
  const { data: cands } = await supabase.from('candidates')
    .select('full_name, positions, interview_at, interviewer_id')
    .eq('status', 'interview').not('interview_at', 'is', null).not('interviewer_id', 'is', null)
    .gte('interview_at', fromIso).lte('interview_at', toIso)

  // keep only interviews whose ET date is today or tomorrow
  const relevant = (cands || []).filter(c => { const ds = etDate(new Date(c.interview_at!)); return ds === todayStr || ds === tomStr })
  if (relevant.length === 0) return { interviewers: 0, sent: 0 }

  // group by interviewer
  const byInterviewer: Record<string, any[]> = {}
  for (const c of relevant) { (byInterviewer[c.interviewer_id!] = byInterviewer[c.interviewer_id!] || []).push(c) }

  const ids = Object.keys(byInterviewer)
  const { data: usersData } = await supabase.from('app_users').select('id, full_name, email, phone').in('id', ids)
  const users = Object.fromEntries((usersData || []).map((u: any) => [u.id, u]))

  let sent = 0
  for (const id of ids) {
    const u = users[id]; if (!u) continue
    const list = byInterviewer[id].sort((a, b) => new Date(a.interview_at).getTime() - new Date(b.interview_at).getTime())
    const line = (c: any) => { const ds = etDate(new Date(c.interview_at)); const day = ds === todayStr ? 'Today' : 'Tomorrow'; return `${day} ${etTime(new Date(c.interview_at))} — ${c.full_name}${c.positions?.[0] ? ` (${c.positions[0]})` : ''}` }
    const lines = list.map(line)
    const name = u.full_name || 'there'
    const html = `<p>Hi ${name},</p><p>Your upcoming interviews:</p><ul>${lines.map((l: string) => `<li>${l}</li>`).join('')}</ul><p>— BSM Recruiting</p>`
    const sms = `BSM interviews:\n${lines.join('\n')}`
    const [e, s] = await Promise.all([u.email ? sendEmail(u.email, 'Your interview agenda — BSM', html) : Promise.resolve(false), u.phone ? sendSMS(u.phone, sms) : Promise.resolve(false)])
    if (e || s) sent++
  }
  return { interviewers: ids.length, sent }
}

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // no secret set — allow (set CRON_SECRET to lock this down)
  const auth = req.headers.get('authorization') || ''
  const key = req.nextUrl.searchParams.get('key') || ''
  return auth === `Bearer ${secret}` || key === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const result = await run()
  return NextResponse.json({ ok: true, ...result })
}
export async function POST(req: NextRequest) { return GET(req) }
