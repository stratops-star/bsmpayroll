import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const fmtDate = (s: string | null, lang: string) => {
  if (!s) return '—'
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
const fill = (t: string | null, vars: Record<string, string>) =>
  (t || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)

export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServerClient()
  const { data: offer } = await supabase.from('offers').select('*').eq('id', id).single()
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

  const [{ data: cand }, { data: st }, { data: tmpl }] = await Promise.all([
    supabase.from('candidates').select('id, full_name, email, preferred_lang').eq('id', offer.candidate_id).single(),
    supabase.from('offer_settings').select('*').eq('id', 1).single(),
    offer.template_id
      ? supabase.from('offer_templates').select('*').eq('id', offer.template_id).single()
      : Promise.resolve({ data: null } as any),
  ])
  if (!cand) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  if (!cand.email) return NextResponse.json({ error: 'Candidate has no email' }, { status: 400 })
  if (!st) return NextResponse.json({ error: 'Offer settings not configured' }, { status: 400 })

  const L = offer.lang === 'es' ? 'es' : 'en'
  const g = (k: string) => (st as any)[`${k}_${L}`] as string | null
  const vars = {
    position: offer.position || '',
    name: cand.full_name || '',
    sign_by: fmtDate(offer.sign_by, L),
    questions_phone: st.questions_phone || '',
  }

  // FROZEN snapshot — later edits to settings never change this letter.
  const snapshot = {
    lang: L,
    generated_at: new Date().toISOString(),
    company: { address: st.company_address, phone: st.company_phone, email: st.company_email, web: st.company_web },
    signer: { name: st.signer_name, title: st.signer_title, phone: st.signer_phone, signature_path: st.signer_signature_path },
    letter_date: fmtDate(offer.letter_date, L),
    candidate_name: cand.full_name,
    subject: fill(g('subject'), vars),
    intro: fill(g('intro'), vars),
    contingency: fill(g('contingency'), vars),
    details_lead: fill(g('details_lead'), vars),
    details: {
      position: offer.position,
      start_date: fmtDate(offer.start_date, L),
      schedule: offer.schedule || '—',
      location: offer.location || '—',
      hourly_rate: offer.hourly_rate != null ? `$${Number(offer.hourly_rate).toFixed(2)}` : '—',
    },
    pay_schedule: g('pay_schedule'),
    pay_detail: g('pay_detail'),
    benefits: ((st as any)[`benefits_${L}`] as string[]) || [],
    duties_intro: tmpl ? (tmpl as any)[`duties_intro_${L}`] : null,
    duties: tmpl ? ((tmpl as any)[`duties_${L}`] as string[]) || [] : [],
    overtime: g('overtime'),
    jd_note: g('jd_note'),
    at_will: g('at_will'),
    next_steps: fill(g('next_steps'), vars),
    closing: fill(g('closing'), vars),
    acknowledgment: fill(g('acknowledgment'), vars),
    labels: L === 'es'
      ? { subject: 'ASUNTO', details: 'DETALLES DEL PUESTO', position: 'PUESTO', start: 'FECHA DE INICIO', schedule: 'HORARIO', location: 'UBICACIÓN', comp: 'COMPENSACIÓN', rate: 'TARIFA POR HORA', pay: 'FRECUENCIA DE PAGO', benefits: 'BENEFICIOS', duties: 'FUNCIONES Y RESPONSABILIDADES', hours: 'HORAS DE TRABAJO Y TIEMPO EXTRA', atwill: 'EMPLEO A VOLUNTAD', next: 'PRÓXIMOS PASOS', ack: 'RECONOCIMIENTO Y ACEPTACIÓN', sincerely: 'Atentamente', sig: 'FIRMA', printed: 'NOMBRE EN LETRA DE MOLDE', date: 'FECHA' }
      : { subject: 'SUBJECT', details: 'POSITION DETAILS', position: 'POSITION', start: 'START DATE', schedule: 'SCHEDULE', location: 'LOCATION', comp: 'COMPENSATION', rate: 'HOURLY RATE', pay: 'PAYMENT SCHEDULE', benefits: 'BENEFITS', duties: 'DUTIES AND RESPONSIBILITIES', hours: 'WORK HOURS AND OVERTIME', atwill: 'AT-WILL EMPLOYMENT', next: 'NEXT STEPS', ack: 'ACKNOWLEDGMENT AND ACCEPTANCE', sincerely: 'Sincerely', sig: 'SIGNATURE', printed: 'PRINTED NAME', date: 'DATE' },
  }

  await supabase.from('offers').update({ snapshot, status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)

  // ── Email the signing link ──
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://bsmfacilitysolutions.app'
  const link = `${origin}/offer/${offer.token}`
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'BSM Facility Solutions <careers@bsmfacilitysolutions.app>'
  let email = false

  if (key) {
    const es = L === 'es'
    const subject = es ? 'Su oferta de empleo — BSM Facility Solutions' : 'Your offer of employment — BSM Facility Solutions'
    const html = es
      ? `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#222"><p>Hola ${cand.full_name},</p>
         <p>Nos complace extenderle una <strong>oferta condicional de empleo</strong> para el puesto de <strong>${offer.position}</strong> con BSM Facility Solutions.</p>
         <p>Revise y firme su carta de oferta aquí:</p>
         <p><a href="${link}" style="background:#D4A843;color:#0D1B35;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Ver y firmar mi oferta</a></p>
         <p style="color:#6B7280;font-size:13px">Por favor firme antes del <strong>${fmtDate(offer.sign_by, L)}</strong>. Si tiene preguntas, llame al ${st.questions_phone || ''}.</p>
         <p style="color:#6B7280;font-size:13px">— Equipo de Reclutamiento de BSM</p></div>`
      : `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#222"><p>Hi ${cand.full_name},</p>
         <p>We're pleased to extend a <strong>conditional offer of employment</strong> for the <strong>${offer.position}</strong> position with BSM Facility Solutions.</p>
         <p>Review and sign your offer letter here:</p>
         <p><a href="${link}" style="background:#D4A843;color:#0D1B35;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">View &amp; sign my offer</a></p>
         <p style="color:#6B7280;font-size:13px">Please sign by <strong>${fmtDate(offer.sign_by, L)}</strong>. If you have questions, call ${st.questions_phone || ''}.</p>
         <p style="color:#6B7280;font-size:13px">— BSM Recruiting Team</p></div>`
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [cand.email], subject, html }),
      })
      email = r.ok
    } catch { email = false }
  }

  return NextResponse.json({ ok: true, email, link })
}
