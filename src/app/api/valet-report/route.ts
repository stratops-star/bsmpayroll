import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BSM_REPORT_TO = 'strat.ops@bsmfacilitysolutions.com'
const APP = 'https://bsmfacilitysolutions.app'

const NAVY = rgb(0.118, 0.106, 0.090)
const GOLD = rgb(0.863, 0.722, 0.471)

function e164(phone: string) {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d[0] === '1') return '+' + d
  return d ? '+' + d : ''
}

type Ev = {
  id: string; action: 'park' | 'retrieve'; event_at: string; note: string | null
  vehicle_id: string | null; employee_id: string | null
  valet_customers: { full_name: string; email: string | null; phone: string | null; valet_units: { unit_number: string } | null } | null
  valet_vehicles: { license_plate: string } | null
}

const EV_SELECT =
  'id, action, event_at, note, vehicle_id, employee_id, valet_customers(full_name, email, phone, valet_units(unit_number)), valet_vehicles(license_plate)'

// pair a given event with its opposite (same vehicle)
async function pair(svc: any, ev: Ev): Promise<{ park: Ev | null; retrieve: Ev | null }> {
  if (!ev.vehicle_id) return ev.action === 'park' ? { park: ev, retrieve: null } : { park: null, retrieve: ev }
  if (ev.action === 'retrieve') {
    const { data } = await svc.from('valet_events').select(EV_SELECT)
      .eq('vehicle_id', ev.vehicle_id).eq('action', 'park').lte('event_at', ev.event_at)
      .order('event_at', { ascending: false }).limit(1)
    return { park: (data && data[0]) || null, retrieve: ev }
  }
  const { data } = await svc.from('valet_events').select(EV_SELECT)
    .eq('vehicle_id', ev.vehicle_id).eq('action', 'retrieve').gte('event_at', ev.event_at)
    .order('event_at', { ascending: true }).limit(1)
  return { park: ev, retrieve: (data && data[0]) || null }
}

async function photoPaths(svc: any, eventId: string): Promise<{ slot: string; path: string }[]> {
  const { data } = await svc.from('valet_photos').select('slot, sequence, storage_path').eq('event_id', eventId).order('sequence')
  return (data || []).map((p: any) => ({ slot: p.slot, path: p.storage_path }))
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
}

// -------- GET: view data for the public report page (by event id) --------
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const svc = createServerClient()
  const { data: ev } = await svc.from('valet_events').select(EV_SELECT).eq('id', id).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { park, retrieve } = await pair(svc, ev as Ev)

  async function section(e: Ev | null) {
    if (!e) return null
    const paths = await photoPaths(svc, e.id)
    const photos: string[] = []
    for (const p of paths) {
      const { data: s } = await svc.storage.from('valet-photos').createSignedUrl(p.path, 3600)
      if (s?.signedUrl) photos.push(s.signedUrl)
    }
    return { at: e.event_at, note: e.note, photos }
  }

  const base = (park || retrieve) as Ev
  return NextResponse.json({
    plate: base.valet_vehicles?.license_plate || '—',
    name: base.valet_customers?.full_name || '—',
    unit: base.valet_customers?.valet_units?.unit_number || '—',
    park: await section(park),
    retrieve: await section(retrieve),
  })
}

// -------- POST: build the PDF and send to BSM + customer --------
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

  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: NAVY })
  page.drawText('BSM Valet — Vehicle Report', { x: M, y: H - 44, size: 18, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Facility Solutions', { x: M, y: H - 60, size: 9, font, color: GOLD })
  y = H - 96
  const line = (l: string, v: string) => { page.drawText(l, { x: M, y, size: 10, font: bold, color: NAVY }); page.drawText(v, { x: M + 90, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) }); y -= 16 }
  line('Plate', plate); line('Tenant', name); line('Unit', unit); y -= 6

  const draw = async (title: string, ev: Ev | null) => {
    if (y < 160) { page = doc.addPage([W, H]); y = H - M }
    page.drawText(title, { x: M, y, size: 12, font: bold, color: NAVY }); y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: GOLD }); y -= 14
    if (!ev) { page.drawText('No record.', { x: M, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) }); y -= 20; return }
    page.drawText(`${fmt(ev.event_at)}   ·   Attendant: ${empMap[ev.employee_id || ''] || '—'}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14
    if (ev.note) { page.drawText(`Note: ${ev.note.slice(0, 90)}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14 }
    const paths = await photoPaths(svc, ev.id)
    const cw = (W - M * 2 - 10) / 2, ch = cw * 0.75
    let col = 0
    for (const p of paths) {
      try {
        const { data: blob } = await svc.storage.from('valet-photos').download(p.path)
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
  return doc.save()
}

export async function POST(req: NextRequest) {
  if (!(await requireValet(req))) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const { event_id } = await req.json().catch(() => ({}))
  if (!event_id) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

  const svc = createServerClient()
  const { data: ev } = await svc.from('valet_events').select(EV_SELECT).eq('id', event_id).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  const { park, retrieve } = await pair(svc, ev as Ev)
  const link = retrieve ? `${APP}/valet/report/${retrieve.id}` : `${APP}/valet/report/${event_id}`

  // attendant names
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
  const plate = base.valet_customers ? (base.valet_vehicles?.license_plate || '') : ''
  const custName = base.valet_customers?.full_name || 'Resident'
  const custEmail = base.valet_customers?.email || ''
  const custPhone = base.valet_customers?.phone || ''
  const fileName = `BSM-valet-${plate || 'report'}.pdf`

  // email (Resend) with PDF attachment
  let emailed = false
  const key = process.env.RESEND_API_KEY
  if (key) {
    const to = [BSM_REPORT_TO, custEmail].filter(Boolean)
    const html =
      `<p>Hi ${custName},</p>` +
      `<p>Attached is your BSM Valet vehicle report for plate <strong>${plate}</strong>, ` +
      `documenting the condition at park and retrieve.</p>` +
      `<p>You can also view it here: <a href="${link}">${link}</a></p><p>— BSM Facility Solutions</p>`
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BSM Valet <careers@bsmfacilitysolutions.com>',
          to, subject: `BSM Valet report — ${plate}`, html,
          attachments: [{ filename: fileName, content: pdfB64 }],
        }),
      })
      emailed = r.ok
    } catch { emailed = false }
  }

  // sms (Twilio) link to the report page
  let texted = false
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM
  const toNum = e164(custPhone)
  if (sid && tok && from && toNum) {
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: toNum, From: from, Body: `Your BSM Valet report for ${plate}: ${link}` }),
      })
      texted = r.ok
    } catch { texted = false }
  }

  // mark reported on the retrieve event (or the event we were given)
  const markId = retrieve?.id || event_id
  await svc.from('valet_events').update({ reported_at: new Date().toISOString() }).eq('id', markId)
  return NextResponse.json({ ok: true, emailed, texted, link })
}
