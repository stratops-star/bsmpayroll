import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function e164(phone: string) { const d = (phone || '').replace(/\D/g, ''); if (d.length === 10) return '+1' + d; if (d.length === 11 && d[0] === '1') return '+' + d; return d ? '+' + d : '' }

async function sms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM
  const e = e164(to); if (!sid || !tok || !from || !e) return false
  try { const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: e, From: from, Body: body }) }); return r.ok } catch { return false }
}
async function email(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; if (!key || !to) return false
  try { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'BSM Facility Solutions <careers@bsmfacilitysolutions.com>', to: [to], subject, html }) }); return r.ok } catch { return false }
}

export async function POST(req: NextRequest) {
  const { candidate_id } = await req.json().catch(() => ({}))
  if (!candidate_id) return NextResponse.json({ error: 'Missing candidate_id' }, { status: 400 })
  const supabase = createServerClient()
  const { data: c } = await supabase.from('candidates').select('full_name, phone, email, preferred_lang, final_interview_at, final_interview_mode, final_interview_note').eq('id', candidate_id).single()
  if (!c) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const es = c.preferred_lang === 'es'
  const when = c.final_interview_at ? new Date(c.final_interview_at).toLocaleString(es ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : ''
  const modeTxt = c.final_interview_mode === 'in_person' ? (es ? 'en persona' : 'in person') : (es ? 'por llamada' : 'by phone call')
  const note = c.final_interview_note ? `\n${es ? 'Detalles' : 'Details'}: ${c.final_interview_note}` : ''

  const smsBody = es
    ? `Hola ${c.full_name}, tu entrevista final con BSM (${modeTxt}) está programada para ${when}.${note}`
    : `Hi ${c.full_name}, your final interview with BSM (${modeTxt}) is scheduled for ${when}.${note}`
  const html = es
    ? `<p>Hola ${c.full_name},</p><p>Tu <strong>entrevista final</strong> con BSM Facility Solutions (${modeTxt}) está programada para <strong>${when}</strong>.</p>${c.final_interview_note ? `<p>Detalles: ${c.final_interview_note}</p>` : ''}<p>— Equipo de BSM</p>`
    : `<p>Hi ${c.full_name},</p><p>Your <strong>final interview</strong> with BSM Facility Solutions (${modeTxt}) is scheduled for <strong>${when}</strong>.</p>${c.final_interview_note ? `<p>Details: ${c.final_interview_note}</p>` : ''}<p>— BSM Team</p>`

  const [s, e] = await Promise.all([c.phone ? sms(c.phone, smsBody) : Promise.resolve(false), c.email ? email(c.email, es ? 'Tu entrevista final — BSM' : 'Your final interview — BSM', html) : Promise.resolve(false)])
  return NextResponse.json({ ok: true, sms: s, email: e })
}
