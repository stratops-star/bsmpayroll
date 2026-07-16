import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { renderOfferPdf } from '@/lib/offer-pdf'
import { sendBsmEmail, APP } from '@/lib/bsm-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { token, signature, typed, printed_name } = await req.json().catch(() => ({}))
  if (!token || !printed_name) return NextResponse.json({ error: 'Missing token or name' }, { status: 400 })
  if (!signature && !typed) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const supabase = createServerClient()
  const { data: offer } = await supabase.from('offers').select('*').eq('token', token).maybeSingle()
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  if (offer.status === 'signed') return NextResponse.json({ error: 'This offer has already been signed' }, { status: 409 })
  if (offer.status === 'withdrawn') return NextResponse.json({ error: 'This offer has been withdrawn' }, { status: 410 })
  if (!offer.snapshot) return NextResponse.json({ error: 'Offer is not ready to sign' }, { status: 400 })

  const L = offer.lang === 'es' ? 'es' : 'en'
  const now = new Date()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const signedDate = now.toLocaleDateString(L === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const snap = {
    ...offer.snapshot,
    meta_line: L === 'es'
      ? `Firmado electrónicamente por ${printed_name} el ${now.toLocaleString('es-US')} · IP ${ip} · Ref ${offer.id}`
      : `Electronically signed by ${printed_name} on ${now.toLocaleString('en-US')} · IP ${ip} · Ref ${offer.id}`,
  }

  // ── Generate the signed PDF ──
  let pdf: Buffer
  try {
    pdf = await renderOfferPdf(snap, { dataUrl: signature || null, typed: typed || null, name: printed_name, date: signedDate })
  } catch (e: any) {
    console.error('PDF render failed:', e?.message)
    return NextResponse.json({ error: 'Could not generate the signed document' }, { status: 500 })
  }

  const path = `${offer.id}/signed-offer.pdf`
  const up = await supabase.storage.from('offers').upload(path, pdf, { contentType: 'application/pdf', upsert: true })
  if (up.error) return NextResponse.json({ error: 'Could not store the signed document' }, { status: 500 })

  await supabase.from('offers').update({
    status: 'signed', signed_at: now.toISOString(), signed_ip: ip,
    signed_name: printed_name, signature_data: signature || null, signed_pdf_path: path,
  }).eq('id', offer.id)

  // Candidate is now cleared for onboarding
  await supabase.from('candidates').update({ onboarding_status: 'offer_signed' }).eq('id', offer.candidate_id)

  const { data: signedLink } = await supabase.storage.from('offers').createSignedUrl(path, 60 * 60 * 24 * 7)

  // ── Notify: candidate copy + recruiter + manager (BSM house style) ──
  const b64 = pdf.toString('base64')
  const attach = [{ filename: 'BSM-Signed-Offer.pdf', content: b64 }]
  const FROM = 'BSM Facility Solutions <careers@bsmfacilitysolutions.app>'
  const { data: cand } = await supabase.from('candidates').select('full_name, email').eq('id', offer.candidate_id).single()
  const es = L === 'es'
  const rate = offer.hourly_rate != null ? `$${Number(offer.hourly_rate).toFixed(2)}/hr` : null
  const startFmt = offer.start_date ? new Date(offer.start_date + 'T00:00:00').toLocaleDateString(es ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  // 1. Candidate's signed copy
  if (cand?.email) {
    await sendBsmEmail({
      to: [cand.email], from: FROM, attachments: attach,
      subject: es ? `Su oferta firmada — ${offer.position}` : `Your signed offer — ${offer.position}`,
      email: {
        preheader: es ? 'Su carta de oferta firmada está adjunta. Bienvenido a BSM.' : 'Your signed offer letter is attached. Welcome to BSM.',
        eyebrow: 'CAREERS',
        headline: es ? '¡Bienvenido a BSM!' : 'Welcome to BSM!',
        greeting: es ? 'Hola' : 'Hi',
        name: cand.full_name,
        lede: es
          ? `Gracias por firmar su oferta condicional de empleo para el puesto de <strong>${offer.position}</strong>. Su copia firmada está adjunta a este correo — guárdela para sus registros.`
          : `Thank you for signing your conditional offer of employment for the <strong>${offer.position}</strong> position. Your signed copy is attached to this email — please keep it for your records.`,
        rows: [
          [es ? 'Puesto' : 'Position', offer.position],
          [es ? 'Tarifa por hora' : 'Hourly rate', rate],
          [es ? 'Fecha de inicio' : 'Start date', startFmt],
          [es ? 'Firmada' : 'Signed', now.toLocaleString(es ? 'es-US' : 'en-US')],
        ],
        calloutHtml: es
          ? '<strong>¿Qué sigue?</strong> Nuestro equipo se comunicará con usted en breve con los siguientes pasos para completar su incorporación y documentación.'
          : "<strong>What happens next?</strong> Our team will be in touch shortly with your next steps to complete onboarding and your paperwork.",
        thanks: es ? 'Nos alegra mucho tenerlo en el equipo.' : "We're glad to have you on the team.",
        signoff: es ? 'El Equipo de BSM Facility Solutions' : 'The BSM Facility Solutions Team',
        footerNote: es ? 'Conserve este correo y el PDF adjunto para sus registros.' : 'Please keep this email and the attached PDF for your records.',
      },
    })
  }

  // 2. Staff notification — recruiter who built it + manager who owns the request
  const ids: string[] = []
  if (offer.created_by) ids.push(offer.created_by)
  if (offer.request_id) {
    const { data: r } = await supabase.from('man_power_requests').select('created_by').eq('id', offer.request_id).single()
    if (r?.created_by) ids.push(r.created_by)
  }
  const staff: string[] = []
  if (ids.length) {
    const { data: us } = await supabase.from('app_users').select('email').in('id', [...new Set(ids)])
    for (const u of us ?? []) if (u.email) staff.push(u.email)
  }

  if (staff.length) {
    await sendBsmEmail({
      to: staff, from: FROM, attachments: attach,
      subject: `Offer signed — ${cand?.full_name || 'Candidate'} (${offer.position})`,
      email: {
        preheader: `${cand?.full_name} signed their offer. Ready for Fingercheck onboarding.`,
        eyebrow: 'CAREERS',
        headline: 'Offer signed',
        lede: `<strong>${cand?.full_name}</strong> has signed their conditional offer letter. The signed PDF is attached.`,
        ctaLabel: 'View signed PDF',
        ctaUrl: signedLink?.signedUrl || `${APP}/recruiting/offers`,
        rows: [
          ['Candidate', cand?.full_name],
          ['Position', offer.position],
          ['Hourly rate', rate],
          ['Start date', offer.start_date],
          ['Signed', now.toLocaleString('en-US')],
          ['Signed by', printed_name],
        ],
        calloutHtml: '<strong>Ready for Fingercheck.</strong> This candidate has cleared the offer stage and can now begin onboarding.',
        signoff: 'BSM Workforce Platform',
        footerNote: 'Automated notification from the BSM recruiting platform.',
      },
    })
  }

  return NextResponse.json({ ok: true, url: signedLink?.signedUrl ?? null })
}
