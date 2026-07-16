import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { renderOfferPdf } from '@/lib/offer-pdf'

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

  // ── Notify: candidate copy + recruiter + manager ──
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'BSM Facility Solutions <careers@bsmfacilitysolutions.app>'
  if (key) {
    const b64 = pdf.toString('base64')
    const { data: cand } = await supabase.from('candidates').select('full_name, email').eq('id', offer.candidate_id).single()

    // recipients: recruiter who created it + manager who owns the request
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

    const send = (to: string[], subject: string, html: string, attach = false) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html, ...(attach ? { attachments: [{ filename: 'BSM-Signed-Offer.pdf', content: b64 }] } : {}) }),
      }).catch(() => null)

    // copy to candidate
    if (cand?.email) {
      const es = L === 'es'
      await send([cand.email],
        es ? 'Su oferta firmada — BSM Facility Solutions' : 'Your signed offer — BSM Facility Solutions',
        es ? `<div style="font-family:system-ui,sans-serif;max-width:560px"><p>Hola ${cand.full_name},</p><p>Gracias por firmar su oferta condicional de empleo. Adjuntamos su copia firmada.</p><p>Nuestro equipo se comunicará con usted con los siguientes pasos para su incorporación.</p><p style="color:#6B7280;font-size:13px">— Equipo de BSM Facility Solutions</p></div>`
           : `<div style="font-family:system-ui,sans-serif;max-width:560px"><p>Hi ${cand.full_name},</p><p>Thank you for signing your conditional offer of employment. Your signed copy is attached.</p><p>Our team will be in touch with your onboarding next steps.</p><p style="color:#6B7280;font-size:13px">— The BSM Facility Solutions Team</p></div>`,
        true)
    }

    // notify staff
    if (staff.length) {
      await send(staff, `✅ Offer signed — ${cand?.full_name || 'Candidate'} (${offer.position})`,
        `<div style="font-family:system-ui,sans-serif;max-width:560px">
           <p><strong>${cand?.full_name}</strong> has signed their conditional offer letter.</p>
           <table style="font-size:14px;border-collapse:collapse">
             <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Position</td><td><strong>${offer.position || '—'}</strong></td></tr>
             <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Rate</td><td>${offer.hourly_rate != null ? '$' + offer.hourly_rate + '/hr' : '—'}</td></tr>
             <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Start date</td><td>${offer.start_date || '—'}</td></tr>
             <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Signed</td><td>${now.toLocaleString('en-US')}</td></tr>
           </table>
           <p style="margin-top:14px;background:#ECFDF5;border:1px solid #A7F3D0;padding:10px 12px;border-radius:8px;font-size:14px">
             <strong>Ready for Fingercheck.</strong> This candidate can now begin onboarding.</p>
           <p style="font-size:13px"><a href="${signedLink?.signedUrl || ''}">View the signed PDF</a></p>
         </div>`, true)
    }
  }

  return NextResponse.json({ ok: true, url: signedLink?.signedUrl ?? null })
}
