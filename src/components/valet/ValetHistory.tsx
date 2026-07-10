'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

type Ev = {
  id: string; action: 'park' | 'retrieve'; event_at: string; note: string | null
  vehicle_id: string | null; customer_id: string | null; employee_id: string | null
  valet_customers: { full_name: string; valet_units: { unit_number: string } | null } | null
  valet_vehicles: { license_plate: string } | null
}
type Photo = { slot: string; sequence: number; storage_path: string }

const NAVY_RGB = rgb(0.05, 0.10, 0.21)
const GOLD_RGB = rgb(0.83, 0.66, 0.26)

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

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const start = new Date(from + 'T00:00:00').toISOString()
    const end = new Date(to + 'T23:59:59').toISOString()
    const { data } = await supabase
      .from('valet_events')
      .select('id, action, event_at, note, vehicle_id, customer_id, employee_id, valet_customers(full_name, valet_units(unit_number)), valet_vehicles(license_plate)')
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
    if (!e.vehicle_id) return e.action === 'park' ? { park: e, retrieve: null } : { park: null, retrieve: e }
    const sameVeh = events.filter(x => x.vehicle_id === e.vehicle_id)
    if (e.action === 'retrieve') {
      const park = sameVeh.filter(x => x.action === 'park' && new Date(x.event_at) <= new Date(e.event_at))
        .sort((a, b) => +new Date(b.event_at) - +new Date(a.event_at))[0] || null
      return { park, retrieve: e }
    }
    const retrieve = sameVeh.filter(x => x.action === 'retrieve' && new Date(x.event_at) >= new Date(e.event_at))
      .sort((a, b) => +new Date(a.event_at) - +new Date(b.event_at))[0] || null
    return { park: e, retrieve }
  }

  async function photosFor(eventId: string): Promise<{ path: string; url: string; slot: string }[]> {
    const { data } = await supabase.from('valet_photos').select('slot, sequence, storage_path').eq('event_id', eventId).order('sequence')
    const rows = (data as Photo[]) || []
    const out: { path: string; url: string; slot: string }[] = []
    for (const p of rows) {
      const { data: s } = await supabase.storage.from('valet-photos').createSignedUrl(p.storage_path, 600)
      if (s?.signedUrl) out.push({ path: p.storage_path, url: s.signedUrl, slot: p.slot })
    }
    return out
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

      page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: NAVY_RGB })
      page.drawText('BSM Valet — Vehicle Report', { x: M, y: H - 44, size: 18, font: bold, color: rgb(1, 1, 1) })
      page.drawText('Facility Solutions', { x: M, y: H - 60, size: 9, font, color: GOLD_RGB })
      y = H - 96

      const line = (label: string, val: string) => {
        page.drawText(label, { x: M, y, size: 10, font: bold, color: NAVY_RGB })
        page.drawText(val, { x: M + 90, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) })
        y -= 16
      }
      line('Plate', plate); line('Tenant', name); line('Unit', unit)
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

  function dl(bytes: Uint8Array, name: string) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
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
                  <span style={{ fontSize: 13, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.valet_customers?.full_name || '—'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{fmt(e.event_at)} · {emp[e.employee_id || ''] || '—'}</div>
              </div>
              <span style={{ color: GOLD, flexShrink: 0 }}>›</span>
            </button>
          ))}
      </div>
      <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>{filtered.length} of {events.length} records</p>

      {sel && <Detail e={sel} emp={emp} stayFor={stayFor} photosFor={photosFor} fmt={fmt}
        onClose={() => setSel(null)} onPDF={() => downloadStayPDF(sel)} busy={busy} />}
    </div>
  )
}

function Detail({ e, emp, stayFor, photosFor, fmt, onClose, onPDF, busy }: any) {
  const { park, retrieve } = stayFor(e)
  const [parkPics, setParkPics] = useState<any[]>([])
  const [retPics, setRetPics] = useState<any[]>([])

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
        <Photos title="PARK — intake" ev={park} pics={parkPics} />
        <Photos title="RETRIEVE — return" ev={retrieve} pics={retPics} />
        <button onClick={onPDF} disabled={busy} style={{ ...primaryBtn, marginTop: 16 }}>⬇ Download report PDF</button>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px 12px', color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>{children}</div>
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '11px 12px', fontSize: 15, outline: 'none', background: '#fff' }
const primaryBtn: React.CSSProperties = { width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const tinyBtn: React.CSSProperties = { background: '#E4E9F2', color: NAVY, border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const rowBtn: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', borderBottom: '1px solid #F1F3F8', padding: '11px 8px', cursor: 'pointer', textAlign: 'left' }
const toastStyle: React.CSSProperties = { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 14, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(13,27,53,.45)', display: 'grid', placeItems: 'end center', zIndex: 55 }
const sheet: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: 560, borderRadius: '16px 16px 0 0', padding: 18, maxHeight: '90vh', overflow: 'auto' }
