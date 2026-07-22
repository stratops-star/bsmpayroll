'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'

type Ev = {
  id: string; action: 'park' | 'retrieve'; event_at: string; note: string | null; reported_at?: string | null; email_error?: string | null; email_attempts?: number | null; email_retryable?: boolean | null
  vehicle_id: string | null; session_id?: string | null; customer_id: string | null; employee_id: string | null
  valet_customers: { full_name: string; customer_type?: string; email?: string | null; valet_units: { unit_number: string } | null } | null
  valet_vehicles: { license_plate: string } | null
}
type Photo = { slot: string; sequence: number; storage_path: string }

const NAVY_RGB = rgb(0.118, 0.106, 0.090)
const GOLD_RGB = rgb(0.863, 0.722, 0.471)

export default function ValetHistory() {
  const [supabase] = useState(() => createClient())
  const [events, setEvents] = useState<Ev[]>([])
  const [emp, setEmp] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [act, setAct] = useState<'all' | 'park' | 'retrieve'>('all')
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [sel, setSel] = useState<Ev | null>(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [meId, setMeId] = useState('')
  const [locId, setLocId] = useState<string | null>(null)
  const [openStays, setOpenStays] = useState<{ vehicle_id: string; customer_id: string | null; since: string }[]>([])
  const [tenants, setTenants] = useState<{ id: string; full_name: string; unit: string }[]>([])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), m.length > 60 ? 9000 : 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setMeId(user.id)
    const { data: loc } = await supabase.from('valet_locations').select('id').eq('active', true).order('created_at').limit(1).maybeSingle()
    setLocId(loc?.id || null)
    const start = new Date(from + 'T00:00:00').toISOString()
    const end = new Date(to + 'T23:59:59').toISOString()
    const { data } = await supabase
      .from('valet_events')
      .select('id, action, event_at, note, reported_at, email_error, email_attempts, email_retryable, vehicle_id, session_id, customer_id, employee_id, valet_customers(full_name, customer_type, email, valet_units(unit_number)), valet_vehicles(license_plate)')
      .neq('voided', true)
      .gte('event_at', start).lte('event_at', end)
      .order('event_at', { ascending: false }).limit(1000)
    const evs = (data as Ev[]) || []
    setEvents(evs)
    const ids = Array.from(new Set(evs.map(e => e.employee_id).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: us } = await supabase.from('app_users').select('id, full_name').in('id', ids)
      const m: Record<string, string> = {}
      ;(us || []).forEach((u: any) => { m[u.id] = u.full_name || '' })
      setEmp(m)
    }
    // Tenants on the roster (guests excluded) — for the coverage KPI
    const { data: tens } = await supabase
      .from('valet_customers')
      .select('id, full_name, customer_type, valet_units(unit_number)')
      .eq('active', true).order('full_name')
    setTenants(((tens as any[]) || [])
      .filter(c => c.customer_type !== 'guest')
      .map(c => ({ id: c.id, full_name: c.full_name, unit: c.valet_units?.unit_number || '' })))

    // Currently parked is all-time, not range-bound: newest event per vehicle must
    // be a park. The database does this in one indexed pass and returns ~30 rows.
    const { data: rpcOpen, error: rpcErr } = await supabase.rpc('valet_open_stays')
    if (!rpcErr && rpcOpen) {
      setOpenStays(((rpcOpen as any[]) || []).map(r => ({
        vehicle_id: r.vehicle_id, customer_id: r.customer_id, since: r.since,
      })))
    } else {
      // Fallback if the SQL function hasn't been installed yet — slower, same result.
      const { data: allEvs } = await supabase
        .from('valet_events')
        .select('action, event_at, vehicle_id, customer_id')
        .neq('voided', true)
        .order('event_at', { ascending: false }).limit(3000)
      const seen = new Set<string>()
      const open: { vehicle_id: string; customer_id: string | null; since: string }[] = []
      for (const e of ((allEvs as any[]) || [])) {
        if (!e.vehicle_id || seen.has(e.vehicle_id)) continue
        seen.add(e.vehicle_id)
        if (e.action === 'park') open.push({ vehicle_id: e.vehicle_id, customer_id: e.customer_id, since: e.event_at })
      }
      setOpenStays(open)
    }

    setLoading(false)
  }, [supabase, from, to])

  useEffect(() => { load() }, [load])

  const ql = q.trim().toLowerCase()
  const filtered = events.filter(e => {
    if (act !== 'all' && e.action !== act) return false
    if (!ql) return true
    const plate = e.valet_vehicles?.license_plate || ''
    const name = e.valet_customers?.full_name || ''
    const unit = e.valet_customers?.valet_units?.unit_number || ''
    return `${plate} ${name} ${unit}`.toLowerCase().includes(ql)
  })

  // pair a park with its retrieve (same vehicle) to build the full "stay"
  function stayFor(e: Ev): { park: Ev | null; retrieve: Ev | null } {
    if (e.action === 'retrieve') {
      let park = (e.session_id ? events.find(x => x.session_id === e.session_id && x.action === 'park') : null) || null
      if (!park && e.vehicle_id) {
        park = events.filter(x => x.vehicle_id === e.vehicle_id && x.action === 'park' && new Date(x.event_at) <= new Date(e.event_at))
          .sort((a, b) => +new Date(b.event_at) - +new Date(a.event_at))[0] || null
      }
      return { park, retrieve: e }
    }
    let retrieve = (e.session_id ? events.find(x => x.session_id === e.session_id && x.action === 'retrieve') : null) || null
    if (!retrieve && e.vehicle_id) {
      retrieve = events.filter(x => x.vehicle_id === e.vehicle_id && x.action === 'retrieve' && new Date(x.event_at) >= new Date(e.event_at))
        .sort((a, b) => +new Date(a.event_at) - +new Date(b.event_at))[0] || null
    }
    return { park: e, retrieve }
  }

  async function photosFor(eventId: string): Promise<{ path: string; url: string; slot: string }[]> {
    const { data } = await supabase.from('valet_photos').select('slot, sequence, storage_path').eq('event_id', eventId).order('sequence')
    const rows = (data as Photo[]) || []
    if (rows.length === 0) return []
    // One batched request instead of one round trip per photo.
    const { data: signed } = await supabase.storage.from('valet-photos').createSignedUrls(rows.map(r => r.storage_path), 600)
    const byPath = new Map<string, string>()
    for (const s of ((signed || []) as any[])) if (s?.signedUrl) byPath.set(s.path, s.signedUrl)
    return rows
      .map(r => ({ path: r.storage_path, url: byPath.get(r.storage_path) || '', slot: r.slot }))
      .filter(r => r.url)
  }

  function fmt(iso: string) { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }

  // ---- per-car report PDF (with photos) ----
  async function downloadStayPDF(e: Ev) {
    setBusy(true)
    try {
      const { park, retrieve } = stayFor(e)
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const bold = await doc.embedFont(StandardFonts.HelveticaBold)
      const W = 595, H = 842, M = 40
      let page = doc.addPage([W, H])
      let y = H - M

      const plate = e.valet_vehicles?.license_plate || '—'
      const name = e.valet_customers?.full_name || '—'
      const unit = e.valet_customers?.valet_units?.unit_number || '—'
      const email = e.valet_customers?.email || '—'

      page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY_RGB })
      try {
        const lb = new Uint8Array(await (await fetch('/bsm-logo.png')).arrayBuffer())
        const logo = await doc.embedPng(lb)
        const lh = 30, lw = lh * (logo.width / logo.height)
        page.drawImage(logo, { x: M, y: H - 56, width: lw, height: lh })
      } catch { /* logo optional */ }
      page.drawText('VEHICLE REPORT', { x: M, y: H - 94, size: 10, font: bold, color: rgb(0.55, 0.5, 0.42) })
      y = H - 112

      const line = (label: string, val: string) => {
        page.drawText(label, { x: M, y, size: 10, font: bold, color: NAVY_RGB })
        page.drawText(val, { x: M + 90, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) })
        y -= 16
      }
      line('Plate', plate); line('Tenant', name); line('Unit', unit); line('Email', email)
      y -= 6

      const drawPhotos = async (title: string, ev: Ev | null) => {
        if (y < 160) { page = doc.addPage([W, H]); y = H - M }
        page.drawText(title, { x: M, y, size: 12, font: bold, color: NAVY_RGB }); y -= 6
        page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: GOLD_RGB }); y -= 14
        if (!ev) { page.drawText('No record.', { x: M, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) }); y -= 20; return }
        page.drawText(`${fmt(ev.event_at)}   ·   Attendant: ${emp[ev.employee_id || ''] || '—'}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14
        if (ev.note) { page.drawText(`Note: ${ev.note.slice(0, 90)}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14 }
        const pics = await photosFor(ev.id)
        const cw = (W - M * 2 - 10) / 2, ch = cw * 0.75
        let col = 0
        for (const p of pics) {
          try {
            const bytes = new Uint8Array(await (await fetch(p.url)).arrayBuffer())
            const img = await doc.embedJpg(bytes)
            if (col === 0 && y - ch < M) { page = doc.addPage([W, H]); y = H - M }
            const x = M + col * (cw + 10)
            page.drawImage(img, { x, y: y - ch, width: cw, height: ch })
            if (col === 1) { y -= ch + 10; col = 0 } else col = 1
          } catch { /* skip bad image */ }
        }
        if (col === 1) y -= ch + 10
        y -= 10
      }

      await drawPhotos('PARK — intake condition', park)
      await drawPhotos('RETRIEVE — return condition', retrieve)

      if (y < 130) { page = doc.addPage([W, H]) }
      const fy = 96
      page.drawLine({ start: { x: M, y: fy + 16 }, end: { x: W - M, y: fy + 16 }, thickness: 0.8, color: rgb(0.85, 0.8, 0.72) })
      page.drawText('Thank you for trusting BSM Facility Solutions with your vehicle.', { x: M, y: fy, size: 9, font: bold, color: rgb(0.2, 0.18, 0.15) })
      const disc = 'This report documents your vehicle\u2019s condition at drop-off and pick-up. BSM Facility Solutions is not responsible for any damage reported more than 8 hours after the vehicle is returned to you.'
      let dy = fy - 14, lineBuf = ''
      for (const w of disc.split(' ')) {
        const test = lineBuf ? lineBuf + ' ' + w : w
        if (font.widthOfTextAtSize(test, 8) > W - 2 * M) { page.drawText(lineBuf, { x: M, y: dy, size: 8, font, color: rgb(0.42, 0.39, 0.34) }); dy -= 11; lineBuf = w }
        else lineBuf = test
      }
      if (lineBuf) page.drawText(lineBuf, { x: M, y: dy, size: 8, font, color: rgb(0.42, 0.39, 0.34) })

      const bytes = await doc.save()
      dl(bytes, `BSM-valet-${plate}-${new Date(e.event_at).toISOString().slice(0, 10)}.pdf`)
    } catch (err: any) { flash('PDF failed: ' + (err?.message || 'error')) }
    setBusy(false)
  }

  // ---- critical-data list PDF (no photos) ----
  async function exportListPDF() {
    setBusy(true)
    try {
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const bold = await doc.embedFont(StandardFonts.HelveticaBold)
      const W = 842, H = 595, M = 32 // landscape
      let page = doc.addPage([W, H]); let y = H - M
      page.drawText('BSM Valet — Activity Report', { x: M, y, size: 16, font: bold, color: NAVY_RGB }); y -= 6
      page.drawText(`${from} to ${to}   ·   ${filtered.length} records`, { x: M, y: y - 8, size: 9, font, color: rgb(0.4, 0.4, 0.4) }); y -= 26
      const cols = [
        { t: 'Date/Time', x: M, w: 120 }, { t: 'Action', x: M + 120, w: 60 }, { t: 'Plate', x: M + 180, w: 80 },
        { t: 'Unit', x: M + 260, w: 55 }, { t: 'Tenant', x: M + 315, w: 130 }, { t: 'Attendant', x: M + 445, w: 120 },
        { t: 'Note', x: M + 565, w: W - M - (M + 565) },
      ]
      const header = () => {
        cols.forEach(c => page.drawText(c.t, { x: c.x, y, size: 9, font: bold, color: NAVY_RGB }))
        y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: GOLD_RGB }); y -= 12
      }
      header()
      for (const e of filtered) {
        if (y < M + 20) { page = doc.addPage([W, H]); y = H - M; header() }
        const row = [
          fmt(e.event_at), e.action, e.valet_vehicles?.license_plate || '—',
          e.valet_customers?.valet_units?.unit_number || '—', e.valet_customers?.full_name || '—',
          emp[e.employee_id || ''] || '—', (e.note || '').slice(0, 40),
        ]
        row.forEach((val, i) => page.drawText(String(val), { x: cols[i].x, y, size: 8, font, color: rgb(0.15, 0.15, 0.15) }))
        y -= 14
      }
      const bytes = await doc.save()
      dl(bytes, `BSM-valet-activity-${from}_${to}.pdf`)
    } catch (err: any) { flash('Export failed: ' + (err?.message || 'error')) }
    setBusy(false)
  }

  async function sendReport(e: Ev) {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/valet-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ event_id: e.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (d?.emailed) flash('Report emailed to the tenant ✓')
      else flash(d?.reason || d?.error || 'The report email did not send.')
    } catch (err: any) {
      flash('Could not reach the server: ' + (err?.message || 'error'))
    }
    setBusy(false)
    setSel(null)
    load()
  }

  function dl(bytes: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  async function voidCapture(e: Ev) {
    setBusy(true)
    const { error } = await supabase.from('valet_events').update({ voided: true }).eq('id', e.id)
    setBusy(false)
    if (error) { flash(error.message); return }
    flash('Capture voided'); setSel(null); load()
  }

  async function forceClose(e: Ev) {
    // insert a retrieve event (no photos) so the car leaves "currently parked"
    setBusy(true)
    const { error } = await supabase.from('valet_events').insert({
      action: 'retrieve', employee_id: meId, location_id: locId,
      customer_id: e.customer_id, vehicle_id: e.vehicle_id,
      note: 'Force-closed by manager (no photos)',
      ...(e.session_id ? { session_id: e.session_id } : {}),
    })
    setBusy(false)
    if (error) { flash(error.message); return }
    flash('Marked retrieved'); setSel(null); load()
  }

  return (
    <div>
      {toast && <div style={toastStyle}>{toast}</div>}
      {busy && <div style={toastStyle}>Working…</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: 'auto', flex: 1, minWidth: 130 }} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: 'auto', flex: 1, minWidth: 130 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search plate, tenant, unit…" style={{ ...inp, flex: 1 }} />
        <select value={act} onChange={e => setAct(e.target.value as any)} style={{ ...inp, width: 'auto' }}>
          <option value="all">All</option><option value="park">Park</option><option value="retrieve">Retrieve</option>
        </select>
      </div>
      <button onClick={exportListPDF} disabled={busy || filtered.length === 0} style={{ ...primaryBtn, background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, marginBottom: 12 }}>
        ⬇ Export PDF ({filtered.length})
      </button>

      <Kpis events={events} openStays={openStays} tenants={tenants} from={from} to={to} />

      <div style={card}>
        {loading ? <Empty>Loading…</Empty> : filtered.length === 0 ? <Empty>No activity in this range.</Empty> :
          filtered.map(e => (
            <button key={e.id} onClick={() => setSel(e)} style={rowBtn}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: e.action === 'park' ? NAVY : '#B7791F', background: e.action === 'park' ? '#E4E9F2' : '#FEF3C7', padding: '2px 7px', borderRadius: 6 }}>
                    {e.action}
                  </span>
                  <b style={{ color: NAVY }}>{e.valet_vehicles?.license_plate || '—'}</b>
                  {e.valet_customers?.customer_type === 'guest' && <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', padding: '1px 6px', borderRadius: 6 }}>GUEST</span>}
                  <span style={{ fontSize: 13, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.valet_customers?.full_name || '—'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span>{fmt(e.event_at)} · {emp[e.employee_id || ''] || '—'}</span>
                  <EmailBadge e={e} />
                </div>
                {(() => {
                  const st = emailState(e)
                  return st.key === 'sent' ? null : (
                    <div style={{ fontSize: 11, color: st.key === 'failed' ? '#B7791F' : '#A0AEC0', marginTop: 3, lineHeight: 1.4 }}>{st.reason}</div>
                  )
                })()}
              </div>
              <span style={{ color: GOLD, flexShrink: 0 }}>›</span>
            </button>
          ))}
      </div>
      <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>{filtered.length} of {events.length} records</p>

      {sel && <Detail e={sel} emp={emp} stayFor={stayFor} photosFor={photosFor} fmt={fmt}
        onClose={() => setSel(null)} onPDF={() => downloadStayPDF(sel)} onSend={() => sendReport(sel)}
        onVoid={() => voidCapture(sel)} onForceClose={() => forceClose(sel)} busy={busy} />}
    </div>
  )
}

const MAX_TRIES = 5

export function emailState(e: any): { key: 'sent' | 'none' | 'queued' | 'retrying' | 'stuck'; label: string; fg: string; bg: string; reason: string } {
  if (e?.reported_at) return { key: 'sent', label: 'EMAILED ✓', fg: '#166534', bg: '#DCFCE7', reason: '' }
  if (!e?.valet_customers?.email) {
    return { key: 'none', label: 'NO EMAIL', fg: '#64748B', bg: '#F1F5F9', reason: 'No email on file for this customer — nothing to send. Add an email on the Tenants tab.' }
  }
  const tries = e?.email_attempts || 0
  const retryable = e?.email_retryable !== false
  if (!retryable) {
    return { key: 'stuck', label: 'NEEDS FIX', fg: '#B91C1C', bg: '#FEE2E2', reason: `${e?.email_error || 'The report email did not send.'} This will not retry on its own — fix the cause, then press Send report.` }
  }
  if (tries >= MAX_TRIES) {
    return { key: 'stuck', label: 'GAVE UP', fg: '#B91C1C', bg: '#FEE2E2', reason: `${e?.email_error || 'The report email did not send.'} Tried ${tries} times and stopped — press Send report to try again.` }
  }
  if (tries === 0) {
    return { key: 'queued', label: 'QUEUED', fg: '#B7791F', bg: '#FEF3C7', reason: 'Not sent yet — the app will email this automatically the next time an attendant opens it.' }
  }
  return { key: 'retrying', label: 'RETRYING', fg: '#B7791F', bg: '#FEF3C7', reason: `${e?.email_error || 'Did not send.'} Will retry automatically (${tries} of ${MAX_TRIES} tries used).` }
}

function EmailBadge({ e }: { e: any }) {
  const s = emailState(e)
  return (
    <span title={s.key === 'sent' ? 'Report emailed to the tenant' : s.key === 'none' ? 'No email on file for this customer' : 'The report email did not send'}
      style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, color: s.fg, background: s.bg, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}


// ---------------- KPIs ----------------
function Kpis({ events, openStays, tenants, from, to }: any) {
  const [showMissing, setShowMissing] = useState(false)

  const parks = (events as Ev[]).filter(e => e.action === 'park').length
  const rets = (events as Ev[]).filter(e => e.action === 'retrieve').length

  // Tenants who cycled a car (parked at least once) in this range
  const cycled = new Set<string>()
  for (const e of events as Ev[]) {
    if (e.action === 'park' && e.customer_id && (e.valet_customers as any)?.customer_type !== 'guest') cycled.add(e.customer_id)
  }
  const total = (tenants as any[]).length
  const done = (tenants as any[]).filter(t => cycled.has(t.id)).length
  const missing = (tenants as any[]).filter(t => !cycled.has(t.id))
  const pct = total ? Math.round((done / total) * 100) : 0
  const allIn = total > 0 && done === total

  const sameDay = from === to
  const rangeLabel = sameDay ? 'today' : 'in range'

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <Kpi label="Currently parked" value={openStays.length} accent />
        <Kpi label={`Parked ${rangeLabel}`} value={parks} />
        <Kpi label={`Retrieved ${rangeLabel}`} value={rets} />
        <Kpi label="Open stays" value={openStays.length} hint={openStays.length > 0 ? 'awaiting pickup' : 'all returned'} />
      </div>

      {/* tenant cycling coverage */}
      <div style={{ ...card, marginTop: 10, padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: '#94A3B8', textTransform: 'uppercase' }}>Tenants who cycled a car</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: allIn ? '#166534' : NAVY }}>
            {done} of {total} <span style={{ color: '#94A3B8', fontWeight: 600 }}>({pct}%)</span>
          </div>
        </div>
        <div style={{ height: 8, background: '#F1F3F8', borderRadius: 5, overflow: 'hidden', marginTop: 9 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: allIn ? '#22C55E' : GOLD, transition: 'width .3s' }} />
        </div>
        {allIn ? (
          <div style={{ fontSize: 12, color: '#166534', marginTop: 8, fontWeight: 600 }}>✓ Every tenant on the roster has cycled a car in this range.</div>
        ) : (
          <>
            <button onClick={() => setShowMissing(v => !v)}
              style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: 12, fontWeight: 600, padding: '9px 0 0', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              {showMissing ? 'Hide' : `Show the ${missing.length} not yet seen`}
              <span style={{ display: 'inline-block', transform: showMissing ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s', color: GOLD }}>›</span>
            </button>
            {showMissing && (
              <div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto', borderTop: '1px solid #F1F3F8' }}>
                {missing.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 2px', borderBottom: '1px solid #F7F8FB', fontSize: 13, color: '#334155' }}>
                    <span>{t.full_name}</span>
                    <span style={{ color: '#94A3B8', fontSize: 12 }}>{t.unit ? `Apt ${t.unit}` : '—'}</span>
                  </div>
                ))}
                {missing.length === 0 && <Empty>—</Empty>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? NAVY : '#fff', border: accent ? `1px solid ${GOLD}` : '1px solid #E5E0D8', borderRadius: 12, padding: '12px 13px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? GOLD : NAVY, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: accent ? '#B7AC97' : '#94A3B8', marginTop: 4 }}>{label}</div>
      {hint && <div style={{ fontSize: 10.5, color: accent ? '#8C8375' : '#B6BECC', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function Detail({ e, emp, stayFor, photosFor, fmt, onClose, onPDF, onSend, onVoid, onForceClose, busy }: any) {
  const { park, retrieve } = stayFor(e)
  const [parkPics, setParkPics] = useState<any[]>([])
  const [retPics, setRetPics] = useState<any[]>([])
  const stillParked = !!park && !retrieve

  useEffect(() => {
    (async () => {
      setParkPics(park ? await photosFor(park.id) : [])
      setRetPics(retrieve ? await photosFor(retrieve.id) : [])
    })()
  }, [e]) // eslint-disable-line react-hooks/exhaustive-deps

  const plate = e.valet_vehicles?.license_plate || '—'
  const name = e.valet_customers?.full_name || '—'
  const unit = e.valet_customers?.valet_units?.unit_number || '—'

  const Photos = ({ title, ev, pics }: any) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{title}</div>
      {ev ? <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>{fmt(ev.event_at)} · {emp[ev.employee_id || ''] || '—'}{ev.note ? ' · ' + ev.note : ''}</div>
        : <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>No record.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
        {pics.map((p: any, i: number) => <img key={i} src={p.url} alt={p.slot} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />)}
      </div>
    </div>
  )

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={ev => ev.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ color: NAVY, fontSize: 17 }}>{plate}</b>
          <button onClick={onClose} style={tinyBtn}>Close</button>
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{name} · Unit {unit}</div>
        {(() => {
          const st = emailState(e)
          const addr = e.valet_customers?.email
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, color: st.fg, background: st.bg, padding: '3px 7px', borderRadius: 5 }}>{st.label}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {st.key === 'sent' ? `Report sent to ${addr}${e.reported_at ? ' · ' + fmt(e.reported_at) : ''}` : st.reason}
              </span>
            </div>
          )
        })()}
        <Photos title="PARK — intake" ev={park} pics={parkPics} />
        <Photos title="RETRIEVE — return" ev={retrieve} pics={retPics} />
        <button onClick={onPDF} disabled={busy} style={{ ...primaryBtn, marginTop: 16 }}>⬇ Download report PDF</button>
        {e.valet_customers?.email && (
          <button onClick={onSend} disabled={busy}
            style={{ ...primaryBtn, background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, marginTop: 8 }}>
            {busy ? 'Sending…' : emailState(e).key === 'sent' ? 'Send the report again' : 'Send report to tenant — see why it failed'}
          </button>
        )}
        {stillParked && (
          <button onClick={() => { if (confirm('Mark this car as retrieved without photos?')) onForceClose() }} disabled={busy}
            style={{ ...primaryBtn, background: '#fff', color: '#B7791F', border: '1.5px solid #E7CfA0', marginTop: 8 }}>
            Force-close (mark retrieved)
          </button>
        )}
        <button onClick={() => { if (confirm('Void this capture? It will be removed from history.')) onVoid() }} disabled={busy}
          style={{ ...primaryBtn, background: '#fff', color: '#B91C1C', border: '1.5px solid #F0C4C4', marginTop: 8 }}>
          Void this capture
        </button>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px 12px', color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>{children}</div>
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8 }
const inp: React.CSSProperties = { background: '#fff', color: '#1E1B17', WebkitTextFillColor: '#1E1B17', width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '11px 12px', fontSize: 15, outline: 'none' }
const primaryBtn: React.CSSProperties = { width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const tinyBtn: React.CSSProperties = { background: '#E4E9F2', color: NAVY, border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const rowBtn: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', borderBottom: '1px solid #F1F3F8', padding: '11px 8px', cursor: 'pointer', textAlign: 'left' }
const toastStyle: React.CSSProperties = { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', padding: '12px 18px', borderRadius: 14, fontSize: 13.5, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.3)', maxWidth: 'min(92vw, 460px)', lineHeight: 1.45, textAlign: 'center' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(13,27,53,.45)', display: 'grid', placeItems: 'end center', zIndex: 55 }
const sheet: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: 560, borderRadius: '16px 16px 0 0', padding: 18, maxHeight: '90vh', overflow: 'auto' }
