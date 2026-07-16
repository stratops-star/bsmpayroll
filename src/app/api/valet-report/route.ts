import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP = 'https://bsmfacilitysolutions.app'
const NAVY = rgb(0.118, 0.106, 0.090)
const GOLD = rgb(0.863, 0.722, 0.471)

type Ev = {
  id: string; action: 'park' | 'retrieve'; event_at: string; note: string | null
  vehicle_id: string | null; session_id: string | null; employee_id: string | null
  valet_customers: { full_name: string; email: string | null; valet_units: { unit_number: string } | null } | null
  valet_vehicles: { license_plate: string } | null
}
const EV_SELECT =
  'id, action, event_at, note, vehicle_id, session_id, employee_id, valet_customers(full_name, email, valet_units(unit_number)), valet_vehicles(license_plate)'

async function requireValet(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return false
  const svc = createServerClient()
  const { data: me } = await svc.from('app_users').select('role, active').eq('id', user.id).single()
  return !!me && me.active === true && ['valet', 'valet_manager', 'admin'].includes(me.role)
}

async function pair(svc: any, ev: Ev): Promise<{ park: Ev | null; retrieve: Ev | null }> {
  if (ev.action === 'retrieve') {
    let park: Ev | null = null
    if (ev.session_id) {
      const { data } = await svc.from('valet_events').select(EV_SELECT).eq('session_id', ev.session_id).eq('action', 'park').limit(1)
      park = (data && data[0]) || null
    }
    if (!park && ev.vehicle_id) {
      const { data } = await svc.from('valet_events').select(EV_SELECT).eq('vehicle_id', ev.vehicle_id).eq('action', 'park').lte('event_at', ev.event_at).order('event_at', { ascending: false }).limit(1)
      park = (data && data[0]) || null
    }
    return { park, retrieve: ev }
  }
  let retrieve: Ev | null = null
  if (ev.session_id) {
    const { data } = await svc.from('valet_events').select(EV_SELECT).eq('session_id', ev.session_id).eq('action', 'retrieve').limit(1)
    retrieve = (data && data[0]) || null
  }
  return { park: ev, retrieve }
}

async function photoPaths(svc: any, eventId: string) {
  const { data } = await svc.from('valet_photos').select('slot, sequence, storage_path').eq('event_id', eventId).order('sequence')
  return (data || []).map((p: any) => p.storage_path as string)
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
}

async function buildPDF(svc: any, park: Ev | null, retrieve: Ev | null, empMap: Record<string, string>) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const W = 595, H = 842, M = 40
  let page = doc.addPage([W, H]); let y = H - M
  const base = (park || retrieve) as Ev
  const plate = base.valet_vehicles?.license_plate || '—'
  const name = base.valet_customers?.full_name || '—'
  const unit = base.valet_customers?.valet_units?.unit_number || '—'
  const email = base.valet_customers?.email || '—'

  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY })
  try {
    const lb = new Uint8Array(await (await fetch(`${APP}/bsm-logo.png`)).arrayBuffer())
    const logo = await doc.embedPng(lb)
    const lh = 30, lw = lh * (logo.width / logo.height)
    page.drawImage(logo, { x: M, y: H - 56, width: lw, height: lh })
  } catch { /* logo optional */ }
  page.drawText('VEHICLE REPORT', { x: M, y: H - 94, size: 10, font: bold, color: rgb(0.55, 0.5, 0.42) })
  y = H - 112

  const line = (l: string, v: string) => { page.drawText(l, { x: M, y, size: 10, font: bold, color: NAVY }); page.drawText(v, { x: M + 90, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) }); y -= 16 }
  line('Plate', plate); line('Tenant', name); line('Unit', unit); line('Email', email); y -= 6

  const draw = async (title: string, ev: Ev | null) => {
    if (y < 200) { page = doc.addPage([W, H]); y = H - M }
    page.drawText(title, { x: M, y, size: 12, font: bold, color: NAVY }); y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: GOLD }); y -= 14
    if (!ev) { page.drawText('No record.', { x: M, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) }); y -= 20; return }
    page.drawText(`${fmt(ev.event_at)}   ·   Attendant: ${empMap[ev.employee_id || ''] || '—'}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14
    if (ev.note) { page.drawText(`Note: ${ev.note.slice(0, 90)}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14 }
    const paths = await photoPaths(svc, ev.id)
    const cw = (W - M * 2 - 10) / 2, ch = cw * 0.75
    let col = 0
    for (const path of paths) {
      try {
        const { data: blob } = await svc.storage.from('valet-photos').download(path)
        if (!blob) continue
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const img = await doc.embedJpg(bytes)
        if (col === 0 && y - ch < M) { page = doc.addPage([W, H]); y = H - M }
        const x = M + col * (cw + 10)
        page.drawImage(img, { x, y: y - ch, width: cw, height: ch })
        if (col === 1) { y -= ch + 10; col = 0 } else col = 1
      } catch { /* skip */ }
    }
    if (col === 1) y -= ch + 10
    y -= 10
  }
  await draw('PARK — intake condition', park)
  await draw('RETRIEVE — return condition', retrieve)

  if (y < 130) { page = doc.addPage([W, H]) }
  const fy = 96
  page.drawLine({ start: { x: M, y: fy + 16 }, end: { x: W - M, y: fy + 16 }, thickness: 0.8, color: rgb(0.85, 0.8, 0.72) })
  page.drawText('Thank you for trusting BSM Facility Solutions with your vehicle.', { x: M, y: fy, size: 9, font: bold, color: rgb(0.2, 0.18, 0.15) })
  const disc = 'This report documents your vehicle\u2019s condition at drop-off and pick-up. BSM Facility Solutions is not responsible for any damage reported more than 8 hours after the vehicle is returned to you.'
  let dy = fy - 14, ln = ''
  for (const w of disc.split(' ')) {
    const test = ln ? ln + ' ' + w : w
    if (font.widthOfTextAtSize(test, 8) > W - 2 * M) { page.drawText(ln, { x: M, y: dy, size: 8, font, color: rgb(0.42, 0.39, 0.34) }); dy -= 11; ln = w }
    else ln = test
  }
  if (ln) page.drawText(ln, { x: M, y: dy, size: 8, font, color: rgb(0.42, 0.39, 0.34) })

  return doc.save()
}

// POST { event_id } — email the tenant a copy after park or retrieve
export async function POST(req: NextRequest) {
  if (!(await requireValet(req))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const { event_id } = await req.json().catch(() => ({}))
  if (!event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

  const svc = createServerClient()
  const { data: ev } = await svc.from('valet_events').select(EV_SELECT).eq('id', event_id).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const tenantEmail = (ev as Ev).valet_customers?.email || ''
  if (!tenantEmail) return NextResponse.json({ ok: true, emailed: false, reason: 'no tenant email' })

  const { park, retrieve } = await pair(svc, ev as Ev)

  const empIds = Array.from(new Set([park?.employee_id, retrieve?.employee_id].filter(Boolean))) as string[]
  const empMap: Record<string, string> = {}
  if (empIds.length) {
    const { data: us } = await svc.from('app_users').select('id, full_name').in('id', empIds)
    ;(us || []).forEach((u: any) => { empMap[u.id] = u.full_name || '' })
  }

  let pdfB64 = ''
  try {
    const bytes = await buildPDF(svc, park, retrieve, empMap)
    pdfB64 = Buffer.from(bytes).toString('base64')
  } catch (e: any) {
    return NextResponse.json({ error: 'PDF build failed: ' + (e?.message || 'error') }, { status: 500 })
  }

  const base = (retrieve || park) as Ev
  const plate = base.valet_vehicles?.license_plate || ''
  const name = base.valet_customers?.full_name || 'there'
  const unit = base.valet_customers?.valet_units?.unit_number || ''
  const isReturn = (ev as Ev).action === 'retrieve'
  const parkedAt = park ? fmt(park.event_at) : ''
  const returnedAt = retrieve ? fmt(retrieve.event_at) : ''
  const disclaimer = 'BSM Facility Solutions is not responsible for any damage reported more than 8 hours after the vehicle is returned to you.'

  let emailed = false
  const key = process.env.RESEND_API_KEY
  if (key) {
    const GOLD = '#DCB878', CHAR = '#1E1B17', INK = '#3F3A32', MUTE = '#8C8375'
    const row = (label: string, value: string) => value
      ? `<tr>
           <td style="padding:9px 0;border-bottom:1px solid #F0EDE7;color:${MUTE};font-size:13px;white-space:nowrap">${label}</td>
           <td style="padding:9px 0 9px 18px;border-bottom:1px solid #F0EDE7;color:${CHAR};font-size:14px;font-weight:600;text-align:right">${value}</td>
         </tr>` : ''

    const headline = isReturn ? 'Your vehicle has been returned' : 'Your vehicle is parked'
    const lede = isReturn
      ? `Your vehicle has been returned to you. The attached report documents its condition at both drop-off and pick-up, with time-stamped photos from every angle.`
      : `Your vehicle has been received and parked by our valet team. The attached report documents its condition at drop-off, with time-stamped photos from every angle.`

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F3EF;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${headline} — ${plate}. Your BSM Valet report is attached.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 14px rgba(30,27,23,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">

        <!-- header -->
        <tr><td style="background:${CHAR};padding:26px 28px;text-align:center">
          <img src="${APP}/bsm-logo.png" alt="BSM Facility Solutions" width="150" style="height:auto;display:block;margin:0 auto 4px" />
          <div style="color:${GOLD};font-size:11px;letter-spacing:2.5px;font-weight:700;margin-top:8px">VALET SERVICE</div>
        </td></tr>
        <tr><td style="height:3px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- body -->
        <tr><td style="padding:30px 28px 8px">
          <h1 style="margin:0 0 4px;color:${CHAR};font-size:21px;font-weight:700;letter-spacing:-.2px">${headline}</h1>
          <div style="width:34px;height:2px;background:${GOLD};margin:12px 0 18px"></div>
          <p style="margin:0 0 6px;color:${INK};font-size:15px">Hi ${name},</p>
          <p style="margin:0;color:${INK};font-size:15px;line-height:1.6">${lede}</p>
        </td></tr>

        <!-- details -->
        <tr><td style="padding:22px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F0EDE7">
            ${row('License plate', plate)}
            ${row('Resident', name)}
            ${row('Unit', unit)}
            ${row('Parked', parkedAt ? parkedAt + ' ET' : '')}
            ${row('Returned', returnedAt ? returnedAt + ' ET' : '')}
          </table>
        </td></tr>

        <!-- attachment cue -->
        <tr><td style="padding:20px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F2;border:1px solid #EFE6D3;border-radius:10px">
            <tr><td style="padding:14px 16px;color:${INK};font-size:13.5px;line-height:1.5">
              <strong style="color:${CHAR}">Your report is attached</strong> as a PDF — including every photo taken by your attendant.
            </td></tr>
          </table>
        </td></tr>

        ${returnedAt ? `
        <!-- disclaimer -->
        <tr><td style="padding:16px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-left:3px solid ${GOLD};border-radius:0 8px 8px 0">
            <tr><td style="padding:10px 0 10px 14px;color:${MUTE};font-size:12.5px;line-height:1.6">
              Your vehicle was returned on <strong style="color:${CHAR}">${returnedAt} ET</strong>. ${disclaimer}
            </td></tr>
          </table>
        </td></tr>` : ''}

        <!-- signoff -->
        <tr><td style="padding:26px 28px 30px">
          <p style="margin:0 0 4px;color:${INK};font-size:15px;line-height:1.6">Thank you for trusting BSM Facility Solutions with your vehicle.</p>
          <p style="margin:14px 0 0;color:${CHAR};font-size:14px;font-weight:700">The BSM Valet Team</p>
        </td></tr>

        <!-- footer -->
        <tr><td style="background:${CHAR};padding:18px 28px;text-align:center">
          <div style="color:${GOLD};font-size:12px;font-weight:700;letter-spacing:.4px">BSM Facility Solutions</div>
          <div style="color:#7C7266;font-size:11px;margin-top:5px;line-height:1.5">This report was generated automatically at the time of service.<br/>Please do not reply to this message.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`

    const text = [
      `${headline} — ${plate}`, '',
      `Hi ${name},`, '', lede, '',
      plate ? `License plate: ${plate}` : '',
      unit ? `Unit: ${unit}` : '',
      parkedAt ? `Parked: ${parkedAt} ET` : '',
      returnedAt ? `Returned: ${returnedAt} ET` : '', '',
      returnedAt ? disclaimer : '', '',
      'Thank you for trusting BSM Facility Solutions with your vehicle.',
      '— The BSM Valet Team',
    ].filter(Boolean).join('\n')

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BSM Valet <valet.fg@bsmfacilitysolutions.app>',
          to: [tenantEmail],
          subject: isReturn ? `Your vehicle has been returned — ${plate}` : `Your vehicle is parked — ${plate}`,
          html,
          text,
          attachments: [{ filename: `BSM-valet-${plate || 'report'}.pdf`, content: pdfB64 }],
        }),
      })
      emailed = r.ok
    } catch { emailed = false }
  }

  await svc.from('valet_events').update({ reported_at: new Date().toISOString() }).eq('id', event_id)
  return NextResponse.json({ ok: true, emailed })
}
