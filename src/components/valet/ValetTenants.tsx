'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

type Unit = { unit_number: string }
type Veh = { id: string; license_plate: string }
type Tenant = {
  id: string; full_name: string; phone: string | null; email: string | null
  active: boolean; unit_id: string | null
  valet_units: Unit | null
  valet_vehicles: Veh[]
}

// ---- tiny CSV parser (handles quotes, commas, CRLF) ----
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

const HEADER_MAP: Record<string, string> = {
  unit: 'unit', apt: 'unit', apartment: 'unit', unit_number: 'unit',
  full_name: 'full_name', name: 'full_name', tenant: 'full_name', resident: 'full_name',
  phone: 'phone', mobile: 'phone', cell: 'phone',
  email: 'email', 'e-mail': 'email',
  license_plate: 'plate', plate: 'plate', tag: 'plate',
  make: 'make', model: 'model', color: 'color', colour: 'color',
}

type ParsedRow = { unit: string; full_name: string; phone: string; email: string; plate: string; make: string; model: string; color: string }

export default function ValetTenants() {
  const [supabase] = useState(() => createClient())
  const [locationId, setLocationId] = useState<string | null>(null)
  const [meId, setMeId] = useState<string>('')
  const [rows, setRows] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [toast, setToast] = useState('')
  const [mode, setMode] = useState<'list' | 'add' | 'import'>('list')
  const [edit, setEdit] = useState<Tenant | null>(null)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setMeId(user.id)
    const { data: loc } = await supabase.from('valet_locations').select('id').eq('active', true).order('created_at').limit(1).maybeSingle()
    setLocationId(loc?.id || null)
    const { data } = await supabase
      .from('valet_customers')
      .select('id, full_name, phone, email, active, unit_id, valet_units(unit_number), valet_vehicles(id, license_plate)')
      .order('full_name')
    setRows((data as Tenant[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // find-or-create a unit, return its id
  const unitCache = useRef<Record<string, string>>({})
  async function resolveUnit(unitNumber: string): Promise<string | null> {
    const key = unitNumber.trim()
    if (!key || !locationId) return null
    if (unitCache.current[key]) return unitCache.current[key]
    const { data: ex } = await supabase.from('valet_units').select('id').eq('location_id', locationId).eq('unit_number', key).maybeSingle()
    if (ex?.id) { unitCache.current[key] = ex.id; return ex.id }
    const { data: nu } = await supabase.from('valet_units').insert({ location_id: locationId, unit_number: key }).select('id').single()
    if (nu?.id) { unitCache.current[key] = nu.id; return nu.id }
    return null
  }

  const ql = q.trim().toLowerCase()
  const filtered = rows.filter(r => {
    if (!ql) return true
    const plates = (r.valet_vehicles || []).map(v => v.license_plate).join(' ').toLowerCase()
    return r.full_name.toLowerCase().includes(ql) || plates.includes(ql) || (r.valet_units?.unit_number || '').toLowerCase().includes(ql)
  })

  return (
    <div>
      {toast && <div style={toastStyle}>{toast}</div>}

      {mode === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, unit or plate…" style={{ ...inp, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setMode('add')} style={{ ...primaryBtn, padding: '10px 12px' }}>+ Add tenant</button>
            <button onClick={() => setMode('import')} style={{ ...primaryBtn, background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, padding: '10px 12px' }}>⬆ Import roster</button>
          </div>

          <div style={card}>
            {loading ? <Empty>Loading…</Empty> : filtered.length === 0 ? <Empty>No tenants yet. Add one or import a roster.</Empty> :
              filtered.map(tn => (
                <button key={tn.id} onClick={() => setEdit(tn)} style={rowBtn}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: NAVY, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {tn.full_name}
                      {tn.valet_units?.unit_number && <span style={{ fontSize: 12, color: '#64748B' }}>· {tn.valet_units.unit_number}</span>}
                      {!tn.active && <span style={badge}>inactive</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(tn.valet_vehicles || []).map(v => v.license_plate).join(', ') || 'no plate'}{tn.phone ? ' · ' + tn.phone : ''}
                    </div>
                  </div>
                  <span style={{ color: GOLD, flexShrink: 0 }}>›</span>
                </button>
              ))}
          </div>
          <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12 }}>{rows.length} tenants</p>
        </>
      )}

      {mode === 'add' && <AddTenant onCancel={() => setMode('list')} onSaved={() => { setMode('list'); load() }}
        supabase={supabase} locationId={locationId} meId={meId} resolveUnit={resolveUnit} flash={flash} />}

      {mode === 'import' && <ImportRoster onCancel={() => setMode('list')} onDone={() => { setMode('list'); load() }}
        supabase={supabase} locationId={locationId} meId={meId} resolveUnit={resolveUnit} flash={flash} />}

      {edit && <EditTenant tenant={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }}
        supabase={supabase} meId={meId} resolveUnit={resolveUnit} flash={flash} />}
    </div>
  )
}

// ---------------- Add tenant ----------------
function AddTenant({ onCancel, onSaved, supabase, locationId, meId, resolveUnit, flash }: any) {
  const [f, setF] = useState({ full_name: '', unit: '', phone: '', email: '', plate: '', make: '', model: '', color: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }))

  async function save() {
    if (!f.full_name.trim()) { flash('Name is required.'); return }
    setBusy(true)
    const unitId = f.unit.trim() ? await resolveUnit(f.unit) : null
    const { data: c, error } = await supabase.from('valet_customers').insert({
      location_id: locationId, unit_id: unitId, full_name: f.full_name.trim(),
      phone: f.phone.trim() || null, email: f.email.trim() || null, created_by: meId,
    }).select('id').single()
    if (error) { setBusy(false); flash(error.message); return }
    if (f.plate.trim()) {
      await supabase.from('valet_vehicles').insert({
        customer_id: c.id, license_plate: f.plate.trim().toUpperCase(),
        make: f.make.trim() || null, model: f.model.trim() || null, color: f.color.trim() || null, created_by: meId,
      })
    }
    setBusy(false); flash('Tenant added ✓'); onSaved()
  }

  return (
    <div>
      <TopBar title="Add tenant" onBack={onCancel} />
      <div style={{ ...card, padding: 16 }}>
        <F label="Full name" v={f.full_name} on={(v: string) => set('full_name', v)} />
        <F label="Apartment / unit" v={f.unit} on={(v: string) => set('unit', v)} />
        <F label="License plate" v={f.plate} on={(v: string) => set('plate', v.toUpperCase())} />
        <F label="Phone" v={f.phone} on={(v: string) => set('phone', v)} type="tel" />
        <F label="Email" v={f.email} on={(v: string) => set('email', v)} type="email" />
        <F label="Make / model / color (optional)" v={[f.make, f.model, f.color].filter(Boolean).join(' ')} on={(v: string) => { const [mk = '', md = '', cl = ''] = v.split(' '); setF((s: any) => ({ ...s, make: mk, model: md, color: cl })) }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={save} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save tenant'}</button>
          <button onClick={onCancel} style={{ ...primaryBtn, background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Edit tenant ----------------
function EditTenant({ tenant, onClose, onSaved, supabase, meId, resolveUnit, flash }: any) {
  const [f, setF] = useState({
    full_name: tenant.full_name || '', unit: tenant.valet_units?.unit_number || '',
    phone: tenant.phone || '', email: tenant.email || '', newPlate: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }))

  async function save() {
    setBusy(true)
    const unitId = f.unit.trim() ? await resolveUnit(f.unit) : null
    const { error } = await supabase.from('valet_customers').update({
      full_name: f.full_name.trim(), unit_id: unitId,
      phone: f.phone.trim() || null, email: f.email.trim() || null,
    }).eq('id', tenant.id)
    if (error) { setBusy(false); flash(error.message); return }
    if (f.newPlate.trim()) {
      await supabase.from('valet_vehicles').insert({ customer_id: tenant.id, license_plate: f.newPlate.trim().toUpperCase(), created_by: meId })
    }
    setBusy(false); flash('Saved ✓'); onSaved()
  }
  async function toggleActive() {
    await supabase.from('valet_customers').update({ active: !tenant.active }).eq('id', tenant.id)
    flash(tenant.active ? 'Deactivated' : 'Reactivated'); onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ color: NAVY, fontSize: 16 }}>Edit tenant</b>
          <button onClick={onClose} style={tinyBtn}>Close</button>
        </div>
        <F label="Full name" v={f.full_name} on={(v: string) => set('full_name', v)} />
        <F label="Apartment / unit" v={f.unit} on={(v: string) => set('unit', v)} />
        <F label="Phone" v={f.phone} on={(v: string) => set('phone', v)} type="tel" />
        <F label="Email" v={f.email} on={(v: string) => set('email', v)} type="email" />
        <div style={{ fontSize: 12, color: '#64748B', margin: '2px 0 8px' }}>
          Plates: {(tenant.valet_vehicles || []).map((v: Veh) => v.license_plate).join(', ') || '—'}
        </div>
        <F label="Add a plate" v={f.newPlate} on={(v: string) => set('newPlate', v.toUpperCase())} />
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={save} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
          <button onClick={toggleActive} style={{ ...primaryBtn, background: '#fff', color: tenant.active ? '#B91C1C' : '#166534', border: '1.5px solid #CBD5E1' }}>{tenant.active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Import roster ----------------
function ImportRoster({ onCancel, onDone, supabase, locationId, meId, resolveUnit, flash }: any) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  function onFile(file: File) {
    setErr('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const grid = parseCSV(String(reader.result || ''))
        if (grid.length < 2) { setErr('File looks empty.'); return }
        const headers = grid[0].map(h => (HEADER_MAP[h.trim().toLowerCase()] || ''))
        if (!headers.includes('full_name')) { setErr('Could not find a name column. Use the template headers.'); return }
        const out: ParsedRow[] = []
        for (let i = 1; i < grid.length; i++) {
          const r = grid[i]
          const rec: any = { unit: '', full_name: '', phone: '', email: '', plate: '', make: '', model: '', color: '' }
          headers.forEach((key, idx) => { if (key) rec[key] = (r[idx] || '').trim() })
          if (rec.full_name) out.push(rec)
        }
        if (!out.length) { setErr('No rows with a name found.'); return }
        setParsed(out)
      } catch { setErr('Could not read the file.') }
    }
    reader.readAsText(file)
  }

  async function runImport() {
    if (!parsed) return
    setBusy(true)
    let tenants = 0, vehicles = 0
    for (let i = 0; i < parsed.length; i++) {
      setProgress(`Importing ${i + 1} / ${parsed.length}…`)
      const row = parsed[i]
      const unitId = row.unit ? await resolveUnit(row.unit) : null
      const { data: c, error } = await supabase.from('valet_customers').insert({
        location_id: locationId, unit_id: unitId, full_name: row.full_name,
        phone: row.phone || null, email: row.email || null, created_by: meId,
      }).select('id').single()
      if (error || !c) continue
      tenants++
      if (row.plate) {
        const { error: ve } = await supabase.from('valet_vehicles').insert({
          customer_id: c.id, license_plate: row.plate.toUpperCase(),
          make: row.make || null, model: row.model || null, color: row.color || null, created_by: meId,
        })
        if (!ve) vehicles++
      }
    }
    setBusy(false)
    flash(`Imported ${tenants} tenants · ${vehicles} vehicles ✓`)
    onDone()
  }

  function downloadTemplate() {
    const csv = 'unit,full_name,phone,email,license_plate,make,model,color\n7B,Jane Doe,5551234567,jane@email.com,ABC1234,Toyota,Camry,Silver\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'bsm-valet-roster-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <TopBar title="Import roster" onBack={onCancel} />
      <div style={{ ...card, padding: 16 }}>
        {!parsed ? (
          <>
            <p style={{ fontSize: 14, color: '#475569', marginTop: 0 }}>
              Upload a <b>.csv</b> with columns: <code style={code}>unit, full_name, phone, email, license_plate, make, model, color</code>.
              Only <b>full_name</b> is required. In Excel or Google Sheets choose <b>File → Save as / Download → CSV</b>.
            </p>
            <button onClick={downloadTemplate} style={{ ...primaryBtn, background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, marginBottom: 10 }}>⬇ Download template</button>
            <label style={{ ...primaryBtn, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
              Choose CSV file
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const fl = e.target.files?.[0]; if (fl) onFile(fl) }} />
            </label>
            {err && <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 10 }}>{err}</p>}
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: NAVY, fontWeight: 600, marginTop: 0 }}>{parsed.length} tenants ready to import</p>
            <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12 }}>
              {parsed.slice(0, 50).map((r, i) => (
                <div key={i} style={{ fontSize: 13, padding: '7px 10px', borderBottom: '1px solid #F1F3F8', color: '#334155' }}>
                  <b style={{ color: NAVY }}>{r.full_name}</b>{r.unit ? ` · ${r.unit}` : ''}{r.plate ? ` · ${r.plate.toUpperCase()}` : ''}
                </div>
              ))}
              {parsed.length > 50 && <div style={{ fontSize: 12, color: '#94A3B8', padding: '7px 10px' }}>+ {parsed.length - 50} more…</div>}
            </div>
            {busy && <p style={{ fontSize: 13, color: '#B7791F', fontWeight: 600 }}>{progress}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={runImport} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Importing…' : `Import ${parsed.length}`}</button>
              <button onClick={() => setParsed(null)} disabled={busy} style={{ ...primaryBtn, background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------- small bits ----------------
function F({ label, v, on, type = 'text' }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={v} onChange={e => on(e.target.value)} style={inp} />
    </div>
  )
}
function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button onClick={onBack} style={tinyBtn}>‹ Back</button>
      <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>{title}</div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px 12px', color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>{children}</div>
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '11px 12px', fontSize: 16, outline: 'none' }
const primaryBtn: React.CSSProperties = { width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const tinyBtn: React.CSSProperties = { background: '#E4E9F2', color: NAVY, border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const rowBtn: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', borderBottom: '1px solid #F1F3F8', padding: '12px 8px', fontSize: 14, cursor: 'pointer', textAlign: 'left' }
const badge: React.CSSProperties = { fontSize: 11, color: '#B91C1C', background: '#FEF2F2', padding: '1px 6px', borderRadius: 6 }
const code: React.CSSProperties = { fontSize: 12, background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }
const toastStyle: React.CSSProperties = { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 14, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.3)', maxWidth: '92%', textAlign: 'center' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(13,27,53,.45)', display: 'grid', placeItems: 'end center', zIndex: 55 }
const sheet: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: 560, borderRadius: '16px 16px 0 0', padding: 18, maxHeight: '88vh', overflow: 'auto' }
