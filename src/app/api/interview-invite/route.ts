import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function e164(phone: string) {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d[0] === '1') return '+' + d
  return d ? '+' + d : ''
}

export async function POST(req: NextRequest) {
  const { id, when, kind } = await req.json().catch(() => ({}))
  if (!id || !when) return NextResponse.json({ error: 'Missing id or when' }, { status: 400 })
  const typeEs = kind === 'inperson' ? 'presencial' : 'virtual'
  const typeEn = kind === 'inperson' ? 'in-person' : 'virtual'

  const supabase = createServerClient()
  const { data: c } = await supabase.from('candidates').select('full_name, phone, email, preferred_lang').eq('id', id).single()
  if (!c) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const es = c.preferred_lang === 'es'
  const smsBody = es
    ? `Hola ${c.full_name}, tu entrevista ${typeEs} con BSM Facility Solutions está programada para ${when}. Responde con cualquier pregunta.`
    : `Hi ${c.full_name}, your ${typeEn} interview with BSM Facility Solutions is scheduled for ${when}. Reply here with any questions.`

  let sms = false, email = false

  // Twilio SMS
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM
  const to = e164(c.phone || '')
  if (sid && tok && from && to) {
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: from, Body: smsBody }),
      })
      sms = r.ok
    } catch {}
  }

  // Resend email
  const key = process.env.RESEND_API_KEY
  if (key && c.email) {
    const subject = es ? 'Tu entrevista — BSM Facility Solutions' : 'Your interview — BSM Facility Solutions'
    const html = es
      ? `<p>Hola ${c.full_name},</p><p>Tu entrevista ${typeEs} con <strong>BSM Facility Solutions</strong> está programada para <strong>${when}</strong>.</p><p>Si necesitas reprogramar, responde a este correo.</p><p>— Equipo de Reclutamiento de BSM</p>`
      : `<p>Hi ${c.full_name},</p><p>Your ${typeEn} interview with <strong>BSM Facility Solutions</strong> is scheduled for <strong>${when}</strong>.</p><p>If you need to reschedule, just reply to this email.</p><p>— BSM Recruiting Team</p>`
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'BSM Careers <careers@bsmfacilitysolutions.com>', to: [c.email], subject, html }),
      })
      email = r.ok
    } catch {}
  }

  return NextResponse.json({ ok: true, sms, email })
}
