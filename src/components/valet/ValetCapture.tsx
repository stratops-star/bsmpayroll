'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  SLOTS, stampFrame, enqueue, listQueue, drainQueue, serverWrite, uuid,
  type QueuedEvent,
} from '@/lib/valet-capture-lib'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import ValetTutorial, { ATTENDANT_STEPS } from '@/components/valet/ValetTutorial'
import ValetInstall from '@/components/valet/ValetInstall'
import ModuleSwitcher from '@/components/valet/ModuleSwitcher'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'

// ---- tiny bilingual dictionary (self-contained; valet island) ----
type Lang = 'en' | 'es'
const T: Record<string, { en: string; es: string }> = {
  park: { en: 'Park a car', es: 'Estacionar' },
  retrieve: { en: 'Retrieve a car', es: 'Entregar' },
  parkedNow: { en: 'Currently parked', es: 'Estacionados ahora' },
  recent: { en: 'Recent activity', es: 'Actividad reciente' },
  noParked: { en: 'No cars parked right now.', es: 'No hay autos estacionados.' },
  noRecent: { en: 'No activity yet.', es: 'Sin actividad todavía.' },
  search: { en: 'Search name, plate, apt, car…', es: 'Buscar nombre, placa, apto, auto…' },
  addNew: { en: '+ Add new customer', es: '+ Nuevo cliente' },
  name: { en: 'Full name', es: 'Nombre completo' },
  phone: { en: 'Phone', es: 'Teléfono' },
  email: { en: 'Email', es: 'Correo' },
  unit: { en: 'Apartment / unit', es: 'Apartamento' },
  plate: { en: 'License plate', es: 'Placa' },
  tenant: { en: 'Tenant', es: 'Residente' },
  guest: { en: 'Guest', es: 'Invitado' },
  guestName: { en: 'Guest name', es: 'Nombre del invitado' },
  visiting: { en: 'Visiting (host resident)', es: 'Visita a (residente)' },
  searchHost: { en: 'Search host tenant…', es: 'Buscar residente…' },
  addGuest: { en: '+ Add guest', es: '+ Agregar invitado' },
  sticker: { en: 'Sticker', es: 'Calcomanía' },
  noMatch: { en: 'No match — add them as a guest below.', es: 'Sin coincidencias — agrégalo como invitado abajo.' },
  startTyping: { en: 'Start typing a name or plate…', es: 'Escribe un nombre o placa…' },
  searchParked: { en: 'Search parked cars…', es: 'Buscar autos estacionados…' },
  optional: { en: 'optional', es: 'opcional' },
  makeModel: { en: 'Make / model / color (optional)', es: 'Marca / modelo / color (opcional)' },
  continue: { en: 'Continue', es: 'Continuar' },
  cancel: { en: 'Cancel', es: 'Cancelar' },
  back: { en: 'Back', es: 'Atrás' },
  photo: { en: 'Photo', es: 'Foto' },
  of: { en: 'of', es: 'de' },
  capture: { en: 'Capture', es: 'Capturar' },
  retake: { en: 'Retake', es: 'Repetir' },
  usePhoto: { en: 'Use photo', es: 'Usar foto' },
  review: { en: 'Review & save', es: 'Revisar y guardar' },
  note: { en: 'Condition / damage note (optional)', es: 'Nota de condición / daño (opcional)' },
  save: { en: 'Save', es: 'Guardar' },
  saving: { en: 'Saving…', es: 'Guardando…' },
  savedOnline: { en: 'Saved ✓', es: 'Guardado ✓' },
  savedOffline: { en: 'Saved offline — will sync ✓', es: 'Guardado sin conexión — se sincronizará ✓' },
  pending: { en: 'waiting to sync', es: 'esperando sincronizar' },
  syncNow: { en: 'Sync now', es: 'Sincronizar' },
  camDenied: { en: 'Camera access is required. Enable it in your browser settings.', es: 'Se requiere acceso a la cámara.' },
  needPlate: { en: 'Name and plate are required.', es: 'Nombre y placa son obligatorios.' },
  signOut: { en: 'Sign out', es: 'Salir' },
  pickCar: { en: 'Which car?', es: '¿Cuál auto?' },
  parkedSince: { en: 'parked', es: 'estacionado' },
  reportTitle: { en: 'Vehicle report', es: 'Reporte del vehículo' },
  downloadPdf: { en: 'Download PDF', es: 'Descargar PDF' },
  close: { en: 'Close', es: 'Cerrar' },
  noRec: { en: 'No record.', es: 'Sin registro.' },
}

type Vehicle = { id: string; license_plate: string; window_sticker?: string | null; make?: string | null; model?: string | null; color?: string | null }
type Customer = { id: string; full_name: string; phone: string | null; email: string | null; valet_units?: { unit_number: string } | null; valet_vehicles: Vehicle[] }
type EventRow = {
  id: string; action: 'park' | 'retrieve'; event_at: string; note: string | null
  vehicle_id: string | null; session_id?: string | null; customer_id?: string | null
  valet_customers: { full_name: string; email?: string | null } | null
  valet_vehicles: { license_plate: string } | null
}
type Chosen = {
  customerId: string | null; vehicleId: string | null
  sessionId?: string | null
  displayName: string; plate: string
  newCustomer: QueuedEvent['newCustomer']; newVehicle: QueuedEvent['newVehicle']
}
type Step = 'home' | 'pick' | 'capture' | 'review'
type Shot = { slot: string; sequence: number; blob: Blob; capturedAt: string; url: string }

export default function ValetCapture() {
  const [supabase] = useState(() => createClient())
  const [lang, setLang] = useState<Lang>('en')
  const t = (k: string) => (T[k] ? T[k][lang] : k)

  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [toast, setToast] = useState('')

  const [step, setStep] = useState<Step>('home')
  const [action, setAction] = useState<'park' | 'retrieve'>('park')
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<EventRow | null>(null)
  const [tutorial, setTutorial] = useState(false)

  useEffect(() => {
    try { if (!localStorage.getItem('bsm_valet_tut_attendant_v1')) setTutorial(true) } catch { /* ignore */ }
  }, [])
  function closeTutorial() { setTutorial(false); try { localStorage.setItem('bsm_valet_tut_attendant_v1', '1') } catch { /* ignore */ } }

  async function forceCloseEvent(park: EventRow) {
    if (!me) return
    const { error } = await supabase.from('valet_events').insert({
      action: 'retrieve', employee_id: me.id, location_id: locationId,
      customer_id: park.customer_id, vehicle_id: park.vehicle_id,
      note: 'Force-closed by attendant (no photos)',
      ...(park.session_id ? { session_id: park.session_id } : {}),
    })
    if (error) { flash(error.message); return }
    flash('Marked retrieved'); setReport(null); await refresh()
  }

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const refresh = useCallback(async () => {
    const { data: cust } = await supabase
      .from('valet_customers')
      .select('id, full_name, phone, email, valet_units(unit_number), valet_vehicles(id, license_plate, window_sticker, make, model, color)')
      .eq('active', true).order('full_name')
    setCustomers((cust as Customer[]) || [])

    const { data: evs } = await supabase
      .from('valet_events')
      .select('id, action, event_at, note, vehicle_id, session_id, customer_id, valet_customers(full_name, email), valet_vehicles(license_plate)')
      .order('event_at', { ascending: false }).limit(60)
    setEvents((evs as EventRow[]) || [])

    setPendingCount((await listQueue()).length)
  }, [supabase])

  const sync = useCallback(async () => {
    const n = await drainQueue(supabase)
    if (n > 0) { flash(`${n} synced ✓`); await refresh() }
    setPendingCount((await listQueue()).length)
  }, [supabase, refresh])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('app_users').select('full_name, email, role').eq('id', user.id).single()
      setMe({ id: user.id, name: u?.full_name || u?.email || user.email || '' })
      setIsManager(u?.role === 'valet_manager' || u?.role === 'admin')
      const { data: loc } = await supabase.from('valet_locations').select('id').eq('active', true).order('created_at').limit(1).maybeSingle()
      setLocationId(loc?.id || null)
      await refresh()
      await sync()
    })()
    const onOnline = () => sync()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [supabase, refresh, sync])

  // ---- currently parked (latest event per vehicle is a park) ----
  const parked: { vehicle_id: string; name: string; plate: string; since: string; session_id: string | null; customer_id: string | null }[] = []
  const seen = new Set<string>()
  for (const e of events) {
    if (!e.vehicle_id || seen.has(e.vehicle_id)) continue
    seen.add(e.vehicle_id)
    if (e.action === 'park') {
      parked.push({
        vehicle_id: e.vehicle_id,
        name: e.valet_customers?.full_name || '—',
        plate: e.valet_vehicles?.license_plate || '—',
        since: e.event_at,
        session_id: e.session_id || null,
        customer_id: e.customer_id || null,
      })
    }
  }

  function startFlow(a: 'park' | 'retrieve') {
    setAction(a); setChosen(null); setShots([]); setNote(''); setStep('pick')
  }

  function chooseExisting(c: Customer, v: Vehicle) {
    setChosen({ customerId: c.id, vehicleId: v.id, displayName: c.full_name, plate: v.license_plate, newCustomer: null, newVehicle: null })
    setStep('capture')
  }

  function chooseParked(p: any) {
    setChosen({ customerId: p.customer_id || null, vehicleId: p.vehicle_id, sessionId: p.session_id || null, displayName: p.name, plate: p.plate, newCustomer: null, newVehicle: null })
    setStep('capture')
  }

  async function onSave() {
    if (!me || shots.length < SLOTS.length) return
    setSaving(true)
    const ev: QueuedEvent = {
      clientRef: uuid(),
      action,
      employeeId: me.id,
      locationId,
      note,
      customerId: chosen?.customerId || null,
      vehicleId: chosen?.vehicleId || null,
      sessionId: chosen?.sessionId || null,
      newCustomer: chosen?.newCustomer || null,
      newVehicle: chosen?.newVehicle || null,
      photos: shots.map(s => ({ slot: s.slot, sequence: s.sequence, blob: s.blob, capturedAt: s.capturedAt })),
      createdAt: new Date().toISOString(),
    }
    let online = false
    if (navigator.onLine) {
      try {
        await serverWrite(ev, supabase)
        online = true
        // email the tenant a copy — after park and after retrieve
        try {
          const { data: row } = await supabase.from('valet_events').select('id').eq('client_ref', ev.clientRef).maybeSingle()
          if (row?.id) {
            const { data: { session } } = await supabase.auth.getSession()
            fetch('/api/valet-report', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
              body: JSON.stringify({ event_id: row.id }),
            }).catch(() => {})
          }
        } catch { /* email is best-effort */ }
      } catch { online = false }
    }
    if (!online) { await enqueue(ev) }
    shots.forEach(s => URL.revokeObjectURL(s.url))
    setSaving(false)
    setStep('home'); setChosen(null); setShots([]); setNote('')
    flash(online ? t('savedOnline') : t('savedOffline'))
    await refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F3F8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: NAVY, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 5 }}>
        <ModuleSwitcher title="BSM Valet" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ValetInstall variant="icon" />
          <button onClick={() => setTutorial(true)} style={miniBtn} aria-label="Help">?</button>
          {isManager && <a href="/valet/manager" style={{ ...miniBtn, textDecoration: 'none', display: 'inline-block' }}>Manager</a>}
          <button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} style={miniBtn}>{lang === 'en' ? 'ES' : 'EN'}</button>
          <button onClick={async () => { await supabase.auth.signOut(); location.href = '/valet/login' }} style={miniBtn}>{t('signOut')}</button>
        </div>
      </header>

      {pendingCount > 0 && (
        <div style={{ background: '#FEF3C7', color: '#92400E', fontSize: 13, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{pendingCount} {t('pending')}</span>
          <button onClick={sync} style={{ ...miniBtn, background: '#92400E', color: '#fff', border: 'none' }}>{t('syncNow')}</button>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 14, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>{toast}</div>}

      <main style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
        {step === 'home' && (
          <Home t={t} parked={parked} events={events} lang={lang}
            onPark={() => startFlow('park')} onRetrieve={() => startFlow('retrieve')}
            onReport={(e: EventRow) => setReport(e)}
            onPickParked={p => { startFlow('retrieve'); chooseParked(p) }} />
        )}
        {step === 'pick' && (
          <Pick t={t} action={action} customers={customers} parked={parked} lang={lang}
            onExisting={chooseExisting} onParked={chooseParked}
            onNew={(nc, nv) => { setChosen({ customerId: null, vehicleId: null, displayName: nc.full_name, plate: nv.license_plate, newCustomer: nc, newVehicle: nv }); setStep('capture') }}
            onCancel={() => setStep('home')} />
        )}
        {step === 'capture' && chosen && (
          <Capture t={t} lang={lang} chosen={chosen} shots={shots} setShots={setShots}
            onDone={() => setStep('review')} onCancel={() => { shots.forEach(s => URL.revokeObjectURL(s.url)); setShots([]); setStep('home') }} />
        )}
        {step === 'review' && chosen && (
          <Review t={t} action={action} chosen={chosen} shots={shots} note={note} setNote={setNote}
            saving={saving} onSave={onSave} onBack={() => setStep('capture')} />
        )}
      </main>

      {report && <ReportSheet e={report} events={events} supabase={supabase} t={t} lang={lang} me={me} locationId={locationId} onForceClose={forceCloseEvent} onClose={() => setReport(null)} />}
      {tutorial && <ValetTutorial steps={ATTENDANT_STEPS} onClose={closeTutorial} />}
    </div>
  )
}

// ---------------- Home ----------------
function Home({ t, parked, events, lang, onPark, onRetrieve, onPickParked, onReport }: any) {
  const [hq, setHq] = useState('')
  const [openP, setOpenP] = useState(true)
  const [openR, setOpenR] = useState(false)
  const hql = hq.trim().toLowerCase()
  const fParked = (parked as any[]).filter(p => !hql || `${p.plate} ${p.name}`.toLowerCase().includes(hql))
  const fRecent = (events as EventRow[]).filter(e => !hql || `${e.valet_vehicles?.license_plate || ''} ${e.valet_customers?.full_name || ''}`.toLowerCase().includes(hql))

  return (
    <div>
      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <BigActionButton onClick={onPark} variant="park" label={t('park')} />
        <BigActionButton onClick={onRetrieve} variant="retrieve" label={t('retrieve')} />
      </div>

      <input value={hq} onChange={e => setHq(e.target.value)} placeholder={t('searchParked')} style={{ ...inp, marginBottom: 12 }} />

      <Accordion title={`${t('parkedNow')} (${fParked.length})`} open={openP || !!hql} onToggle={() => setOpenP(o => !o)}>
        {fParked.length === 0 ? <Empty>{t('noParked')}</Empty> :
          fParked.map(p => (
            <button key={p.vehicle_id} onClick={() => onPickParked(p)} style={rowBtn}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={parkedBadge}>{lang === 'es' ? 'ESTACIONADO' : 'PARKED'}</span>
                <span><b style={{ color: NAVY }}>{p.plate}</b> · {p.name}</span>
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{t('parkedSince')} {timeAgo(p.since, lang)} ›</div>
            </button>
          ))}
      </Accordion>

      <Accordion title={`${t('recent')} (${fRecent.length})`} open={openR || !!hql} onToggle={() => setOpenR(o => !o)}>
        {fRecent.length === 0 ? <Empty>{t('noRecent')}</Empty> :
          fRecent.slice(0, 20).map((e: EventRow) => (
            <button key={e.id} onClick={() => onReport(e)} style={{ ...rowStatic, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #F1F3F8', cursor: 'pointer', textAlign: 'left' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: e.action === 'park' ? NAVY : '#B7791F', background: e.action === 'park' ? '#E4E9F2' : '#FEF3C7', padding: '2px 7px', borderRadius: 6, marginRight: 8 }}>
                  {e.action === 'park' ? t('park') : t('retrieve')}
                </span>
                <b style={{ color: NAVY }}>{e.valet_vehicles?.license_plate || '—'}</b> · {e.valet_customers?.full_name || '—'}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{timeAgo(e.event_at, lang)} ›</div>
            </button>
          ))}
      </Accordion>
    </div>
  )
}

function Accordion({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 4px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#94A3B8' }}>{title}</span>
        <span style={{ color: '#94A3B8', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      {open && <div style={card}>{children}</div>}
    </div>
  )
}

// ---------------- Pick customer / car ----------------
function Pick({ t, action, customers, parked, onExisting, onParked, onNew, onCancel, lang }: any) {
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [hostQ, setHostQ] = useState('')
  const [host, setHost] = useState<Customer | null>(null)
  const [f, setF] = useState({ full_name: '', phone: '', email: '', license_plate: '', make: '', model: '', color: '' })
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))

  const ql = q.trim().toLowerCase()
  const matches: { c: Customer; v: Vehicle }[] = []
  if (ql) {
    for (const c of customers as Customer[]) {
      for (const v of (c.valet_vehicles || [])) {
        const hay = `${c.full_name} ${c.valet_units?.unit_number || ''} ${v.license_plate || ''} ${v.make || ''} ${v.model || ''} ${v.color || ''} ${v.window_sticker || ''}`.toLowerCase()
        if (hay.includes(ql)) matches.push({ c, v })
      }
    }
  }

  // Attendants add GUESTS only (tenants come from the manager / roster import)
  if (adding) {
    const hostMatches = (customers as Customer[]).filter(c =>
      !hostQ.trim() || c.full_name.toLowerCase().includes(hostQ.trim().toLowerCase()))
    return (
      <div>
        <TopBar title={t('addGuest')} onBack={() => { setAdding(false); setHost(null) }} back={t('back')} />
        <div style={card}>
          <Field label={t('guestName')} value={f.full_name} onChange={(v: string) => set('full_name', v)} />
          <Field label={t('plate')} value={f.license_plate} onChange={(v: string) => set('license_plate', v.toUpperCase())} />
          <Field label={`${t('email')} (${t('optional')})`} value={f.email} onChange={(v: string) => set('email', v)} type="email" />
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{t('visiting')}</label>
            {host ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ color: NAVY, fontWeight: 600 }}>{host.full_name}</span>
                <button onClick={() => setHost(null)} style={{ background: 'transparent', border: 'none', color: GOLD, fontWeight: 600, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <>
                <input value={hostQ} onChange={e => setHostQ(e.target.value)} placeholder={t('searchHost')} style={inp} />
                <div style={{ ...card, marginTop: 6, maxHeight: 180, overflow: 'auto' }}>
                  {hostMatches.slice(0, 30).map(c => (
                    <button key={c.id} onClick={() => setHost(c)} style={rowBtn}>
                      <span style={{ color: NAVY }}>{c.full_name}</span><span style={{ color: GOLD }}>›</span>
                    </button>
                  ))}
                  {hostMatches.length === 0 && <Empty>—</Empty>}
                </div>
              </>
            )}
          </div>
          <Field label={t('makeModel')} value={[f.make, f.model, f.color].filter(Boolean).join(' ')} onChange={(v: string) => { const [mk = '', md = '', cl = ''] = v.split(' '); setF(s => ({ ...s, make: mk, model: md, color: cl })) }} />
          <button
            onClick={() => {
              if (!f.full_name.trim() || !f.license_plate.trim() || !host) return
              onNew(
                { full_name: f.full_name.trim(), phone: '', email: f.email.trim(), unit_number: '', customer_type: 'guest', host_customer_id: host.id },
                { license_plate: f.license_plate.trim(), make: f.make.trim(), model: f.model.trim(), color: f.color.trim() },
              )
            }}
            style={{ ...primaryBtn, opacity: (!host || !f.full_name.trim() || !f.license_plate.trim()) ? 0.6 : 1 }}>{t('continue')}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title={action === 'retrieve' ? t('pickCar') : t('park')} onBack={onCancel} back={t('cancel')} />

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={action === 'retrieve' ? t('searchParked') : t('search')} autoFocus style={{ ...inp, marginBottom: 10 }} />

      {action === 'retrieve' ? (
        <div style={card}>
          {(() => {
            const list = (parked as any[]).filter(p => !ql || `${p.plate} ${p.name}`.toLowerCase().includes(ql))
            if (parked.length === 0) return <Empty>{t('noParked')}</Empty>
            if (list.length === 0) return <Empty>{t('noMatch')}</Empty>
            return list.map((p: any) => (
              <button key={p.vehicle_id} onClick={() => onParked(p)} style={rowBtn}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={parkedBadge}>{lang === 'es' ? 'ESTACIONADO' : 'PARKED'}</span>
                  <span><b style={{ color: NAVY }}>{p.plate}</b> · {p.name}</span>
                </div>
                <span style={{ color: GOLD }}>›</span>
              </button>
            ))
          })()}
        </div>
      ) : ql ? (
        <div style={card}>
          {matches.slice(0, 40).map(({ c, v }) => (
            <button key={c.id + v.id} onClick={() => onExisting(c, v)} style={rowBtn}>
              <div style={{ minWidth: 0 }}>
                <div><b style={{ color: NAVY }}>{v.license_plate}</b> · {c.full_name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {[c.valet_units?.unit_number ? `Apt ${c.valet_units.unit_number}` : '', [v.color, v.make, v.model].filter(Boolean).join(' '), v.window_sticker ? `${t('sticker')} ${v.window_sticker}` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ color: GOLD, flexShrink: 0 }}>›</span>
            </button>
          ))}
          {matches.length === 0 && <Empty>{t('noMatch')}</Empty>}
        </div>
      ) : (
        <div style={{ padding: '18px 12px', color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>{t('startTyping')}</div>
      )}
      {action !== 'retrieve' && (
        <button onClick={() => setAdding(true)} style={{ ...primaryBtn, background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, marginTop: 12 }}>{t('addGuest')}</button>
      )}
    </div>
  )
}

// ---------------- Capture ----------------
function Capture({ t, lang, chosen, shots, setShots, onDone, onCancel }: any) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const shootingRef = useRef(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [hint, setHint] = useState('')
  const idx = shots.length
  const slot = SLOTS[idx]

  useEffect(() => {
    let cancelled = false
    const preload = new Image(); preload.src = '/bsm-mark.png' // warm logo cache → first stamp is instant
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(tk => tk.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play().catch(() => {})
          const poll = setInterval(() => {
            if (cancelled) { clearInterval(poll); return }
            if (v.readyState >= 2 && v.videoWidth > 0) { setReady(true); clearInterval(poll) }
          }, 120)
          setTimeout(() => clearInterval(poll), 10000)
        }
      } catch { setErr(t('camDenied')) }
    })()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(tk => tk.stop()); streamRef.current = null }
  }, [t])

  // A black/blank frame has near-zero brightness and almost no variance.
  function frameLooksLive(v: HTMLVideoElement): boolean {
    if (v.readyState < 2 || !v.videoWidth) return false
    try {
      const c = document.createElement('canvas'); c.width = 40; c.height = 40
      const ctx = c.getContext('2d'); if (!ctx) return true
      ctx.drawImage(v, 0, 0, 40, 40)
      const d = ctx.getImageData(0, 0, 40, 40).data
      let sum = 0, sumSq = 0; const n = 40 * 40
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; sumSq += l * l }
      const mean = sum / n, variance = sumSq / n - mean * mean
      return !(mean < 8 && variance < 6)
    } catch { return true }
  }

  async function shoot() {
    const v = videoRef.current
    if (!v || shootingRef.current || !slot || !!err) return
    if (!ready || !frameLooksLive(v)) {
      setHint(lang === 'es' ? 'Espere — la cámara aún está enfocando…' : 'Hold on — the camera is still focusing…')
      return
    }
    shootingRef.current = true
    setBusy(true); setHint('')
    try {
      const { blob, capturedAt } = await stampFrame(v)
      const url = URL.createObjectURL(blob)
      setShots((prev: Shot[]) => [...prev, { slot: slot.key, sequence: idx, blob, capturedAt, url }])
    } catch {
      setHint(lang === 'es' ? 'No se pudo capturar, intente de nuevo.' : 'Capture failed — try again.')
    } finally {
      setBusy(false); shootingRef.current = false
    }
  }

  function retake() {
    setShots((prev: Shot[]) => {
      const last = prev[prev.length - 1]
      if (last) URL.revokeObjectURL(last.url)
      return prev.slice(0, -1)
    })
  }

  const done = idx >= SLOTS.length

  return (
    <div>
      <TopBar title={`${chosen.plate} · ${chosen.displayName}`} onBack={onCancel} back={t('cancel')} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {SLOTS.map((s, i) => (
          <div key={s.key} style={{ flex: 1, height: 6, borderRadius: 3, background: i < idx ? GOLD : '#D7DCE6' }} />
        ))}
      </div>

      {!done ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>
              {t('photo')} {idx + 1} {t('of')} {SLOTS.length} — {lang === 'es' ? slot.label_es : slot.label}
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>{lang === 'es' ? slot.hint_es : slot.hint}</div>
          </div>

          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '3 / 4' }}>
            {err
              ? <div style={{ color: '#fff', display: 'grid', placeItems: 'center', height: '100%', padding: 20, textAlign: 'center', fontSize: 14 }}>{err}</div>
              : <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            {!err && !ready && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.55)', color: '#fff' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 34, height: 34, margin: '0 auto 10px', border: '3px solid rgba(255,255,255,.3)', borderTopColor: GOLD, borderRadius: '50%', animation: 'valspin 0.8s linear infinite' }} />
                  <div style={{ fontSize: 13 }}>{lang === 'es' ? 'Iniciando cámara…' : 'Starting camera…'}</div>
                </div>
              </div>
            )}
            {!err && <CornerMiniMap slotKey={slot.key} />}
          </div>
          <style>{`@keyframes valspin { to { transform: rotate(360deg) } }`}</style>

          <button onClick={shoot} disabled={busy || !!err || !ready}
            style={{ ...primaryBtn, background: (busy || !ready || err) ? '#E3D9C4' : GOLD, color: NAVY, marginTop: 12, fontSize: 17, opacity: (busy || !ready || err) ? 0.7 : 1 }}>
            📸 {err ? t('capture') : !ready ? (lang === 'es' ? 'Iniciando…' : 'Starting…') : busy ? '…' : t('capture')}
          </button>
          {hint && <div style={{ textAlign: 'center', color: '#B7791F', fontSize: 13, marginTop: 8, fontWeight: 600 }}>{hint}</div>}
          {idx > 0 && <button onClick={retake} style={{ ...primaryBtn, background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1', marginTop: 8 }}>‹ {lang === 'es' ? 'Atrás — rehacer la última' : 'Back — redo last photo'}</button>}
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 14 }}>
            {shots.map((s: Shot) => <img key={s.sequence} src={s.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />)}
          </div>
          <button onClick={retake} style={{ ...primaryBtn, background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1', marginBottom: 8 }}>{t('retake')}</button>
          <button onClick={onDone} style={primaryBtn}>{t('review')}</button>
        </div>
      )}
    </div>
  )
}

// ---------------- Review ----------------
function CornerMiniMap({ slotKey }: { slotKey: string }) {
  const pts: Record<string, { x: number; y: number }> = {
    front: { x: 80, y: 26 }, front_right: { x: 122, y: 34 }, right: { x: 128, y: 150 }, rear_right: { x: 122, y: 266 },
    rear: { x: 80, y: 274 }, rear_left: { x: 38, y: 266 }, left: { x: 32, y: 150 }, front_left: { x: 38, y: 34 },
  }
  const c = pts[slotKey]
  const all = Object.entries(pts)
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, width: 76, background: 'rgba(15,12,9,.55)', borderRadius: 12, padding: 6, border: '1px solid rgba(220,184,120,.4)' }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, color: GOLD, textAlign: 'center', marginBottom: 2 }}>FRONT</div>
      <svg viewBox="0 0 160 300" style={{ width: '100%', display: 'block' }}>
        <rect x="34" y="20" width="92" height="260" rx="34" fill="rgba(30,27,23,.35)" stroke={GOLD} strokeWidth="4" />
        <path d="M48 74 q32-14 64 0 l-6 40 h-52 z" fill="none" stroke={GOLD} strokeWidth="2.5" opacity="0.5" />
        <path d="M48 226 q32 14 64 0 l-6-40 h-52 z" fill="none" stroke={GOLD} strokeWidth="2.5" opacity="0.5" />
        <rect x="52" y="120" width="56" height="60" rx="6" fill="none" stroke={GOLD} strokeWidth="2.5" opacity="0.5" />
        {all.map(([k, pt]) => <circle key={k} cx={pt.x} cy={pt.y} r="8" fill={GOLD} opacity={k === slotKey ? 1 : 0.28} />)}
        {c && (
          <circle cx={c.x} cy={c.y} fill="none" stroke={GOLD} strokeWidth="4">
            <animate attributeName="r" values="12;26;12" dur="1.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.1;1" dur="1.3s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  )
}

function Review({ t, action, chosen, shots, note, setNote, saving, onSave, onBack }: any) {
  return (
    <div>
      <TopBar title={t('review')} onBack={onBack} back={t('back')} />
      <div style={card}>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 2 }}>{action === 'park' ? t('park') : t('retrieve')}</div>
        <div style={{ fontWeight: 700, color: NAVY, fontSize: 17, marginBottom: 12 }}>{chosen.plate} · {chosen.displayName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
          {shots.map((s: Shot) => <img key={s.sequence} src={s.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />)}
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('note')}</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ ...inp, marginTop: 6, resize: 'vertical' }} />
        <button onClick={onSave} disabled={saving} style={{ ...primaryBtn, marginTop: 14, opacity: saving ? 0.6 : 1 }}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}

// ---------------- Report sheet (tap a car → see its stamped photos) ----------------
function ReportSheet({ e, events, supabase, t, lang, me, locationId, onForceClose, onClose }: any) {
  const [park, setPark] = useState<EventRow | null>(null)
  const [ret, setRet] = useState<EventRow | null>(null)
  const [parkPics, setParkPics] = useState<string[]>([])
  const [retPics, setRetPics] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function loadPics(id: string): Promise<string[]> {
    const { data } = await supabase.from('valet_photos').select('storage_path, sequence').eq('event_id', id).order('sequence')
    const urls: string[] = []
    for (const p of (data || [])) {
      const { data: s } = await supabase.storage.from('valet-photos').createSignedUrl(p.storage_path, 600)
      if (s?.signedUrl) urls.push(s.signedUrl)
    }
    return urls
  }

  useEffect(() => {
    (async () => {
      let p: EventRow | null = null, r: EventRow | null = null
      const all = events as EventRow[]
      if (e.action === 'retrieve') {
        r = e
        p = (e.session_id ? all.find(x => x.session_id === e.session_id && x.action === 'park') : null) || null
        if (!p) p = all.filter(x => x.vehicle_id && x.vehicle_id === e.vehicle_id && x.action === 'park' && new Date(x.event_at) <= new Date(e.event_at)).sort((a, b) => +new Date(b.event_at) - +new Date(a.event_at))[0] || null
      } else {
        p = e
        r = (e.session_id ? all.find(x => x.session_id === e.session_id && x.action === 'retrieve') : null) || null
        if (!r) r = all.filter(x => x.vehicle_id && x.vehicle_id === e.vehicle_id && x.action === 'retrieve' && new Date(x.event_at) >= new Date(e.event_at)).sort((a, b) => +new Date(a.event_at) - +new Date(b.event_at))[0] || null
      }
      setPark(p); setRet(r)
      setParkPics(p ? await loadPics(p.id) : [])
      setRetPics(r ? await loadPics(r.id) : [])
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const plate = e.valet_vehicles?.license_plate || '—'
  const name = e.valet_customers?.full_name || '—'
  const email = e.valet_customers?.email || '—'
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  async function download() {
    setBusy(true)
    try {
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const bold = await doc.embedFont(StandardFonts.HelveticaBold)
      const W = 595, H = 842, M = 40; let page = doc.addPage([W, H]); let y = H - M
      page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: rgb(0.118, 0.106, 0.090) })
      try {
        const lb = new Uint8Array(await (await fetch('/bsm-logo.png')).arrayBuffer())
        const logo = await doc.embedPng(lb)
        const lh = 30, lw = lh * (logo.width / logo.height)
        page.drawImage(logo, { x: M, y: H - 56, width: lw, height: lh })
      } catch { /* logo optional */ }
      page.drawText('VEHICLE REPORT', { x: M, y: H - 94, size: 10, font: bold, color: rgb(0.55, 0.5, 0.42) })
      y = H - 112
      page.drawText(`Plate: ${plate}`, { x: M, y, size: 11, font: bold, color: rgb(0.118, 0.106, 0.090) }); y -= 16
      page.drawText(`Name: ${name}`, { x: M, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) }); y -= 16
      page.drawText(`Email: ${email}`, { x: M, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) }); y -= 20
      const sec = async (title: string, ev: EventRow | null, urls: string[]) => {
        if (y < 160) { page = doc.addPage([W, H]); y = H - M }
        page.drawText(title, { x: M, y, size: 12, font: bold, color: rgb(0.118, 0.106, 0.090) }); y -= 8
        page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: rgb(0.863, 0.722, 0.471) }); y -= 14
        if (!ev) { page.drawText('No record.', { x: M, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) }); y -= 20; return }
        page.drawText(new Date(ev.event_at).toLocaleString(), { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14
        if (ev.note) { page.drawText(`Note: ${ev.note.slice(0, 90)}`, { x: M, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) }); y -= 14 }
        const cw = (W - M * 2 - 10) / 2, ch = cw * 0.75; let col = 0
        for (const u of urls) {
          try {
            const bytes = new Uint8Array(await (await fetch(u)).arrayBuffer())
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
      await sec('PARK — intake', park, parkPics)
      await sec('RETRIEVE — return', ret, retPics)

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

      const bytes = await doc.save()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `BSM-valet-${plate}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch { /* ignore */ }
    setBusy(false)
  }

  const Block = ({ title, ev, pics }: any) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{title}</div>
      {ev ? <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>{fmt(ev.event_at)}{ev.note ? ' · ' + ev.note : ''}</div>
        : <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>{t('noRec')}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
        {pics.map((u: string, i: number) => <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />)}
      </div>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,53,.45)', display: 'grid', placeItems: 'end center', zIndex: 55 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 560, borderRadius: '16px 16px 0 0', padding: 18, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ color: NAVY, fontSize: 17 }}>{plate} · {name}</b>
          <button onClick={onClose} style={{ background: '#E4E9F2', color: NAVY, border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('close')}</button>
        </div>
        <Block title={t('park')} ev={park} pics={parkPics} />
        <Block title={t('retrieve')} ev={ret} pics={retPics} />
        <button onClick={download} disabled={busy} style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>⬇ {t('downloadPdf')}</button>
        {park && !ret && onForceClose && (
          <button onClick={() => { if (confirm(lang === 'es' ? '¿Marcar como retirado sin fotos?' : 'Mark this car as retrieved without photos?')) onForceClose(park) }}
            style={{ ...primaryBtn, background: '#fff', color: '#B7791F', border: '1.5px solid #E7CFA0', marginTop: 8 }}>
            {lang === 'es' ? 'Forzar cierre (marcar retirado)' : 'Force-close (mark retrieved)'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------- small UI bits ----------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#94A3B8', margin: '0 4px 8px' }}>{title}</div>
      <div style={card}>{children}</div>
    </div>
  )
}
function TopBar({ title, onBack, back }: { title: string; onBack: () => void; back: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button onClick={onBack} style={miniBtnDark}>‹ {back}</button>
      <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>{title}</div>
    </div>
  )
}
function Field({ label, value, onChange, type = 'text' }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} />
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '14px 12px', color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>{children}</div>
}
function timeAgo(iso: string, lang: Lang) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d > 0) return lang === 'es' ? `hace ${d}d` : `${d}d ago`
  if (h > 0) return lang === 'es' ? `hace ${h}h` : `${h}h ago`
  if (m > 0) return lang === 'es' ? `hace ${m}m` : `${m}m ago`
  return lang === 'es' ? 'ahora' : 'now'
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '11px 12px', fontSize: 16, outline: 'none' }
const primaryBtn: React.CSSProperties = { width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const miniBtn: React.CSSProperties = { background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const miniBtnDark: React.CSSProperties = { background: '#E4E9F2', color: NAVY, border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const rowBtn: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', borderBottom: '1px solid #F1F3F8', padding: '12px 8px', fontSize: 14, cursor: 'pointer', textAlign: 'left', color: '#334155' }
const rowStatic: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F3F8', padding: '11px 8px', fontSize: 14, color: '#334155' }
const parkedBadge: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: '#8A6D2F', background: '#F5EAD3', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }
function BigActionButton({ onClick, variant, label }: { onClick: () => void; variant: 'park' | 'retrieve'; label: string }) {
  const park = variant === 'park'
  const bg = park ? NAVY : GOLD
  const fg = park ? GOLD : NAVY
  const txt = park ? '#fff' : NAVY
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', background: bg, border: `1.5px solid ${park ? GOLD : NAVY}`, borderRadius: 16, padding: '16px 18px', cursor: 'pointer', width: '100%', minHeight: 84 }}>
      <div style={{ width: 58, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        {park ? <ParkIcon color={fg} /> : <RetrieveIcon color={fg} />}
      </div>
      <div style={{ width: 1.5, alignSelf: 'stretch', background: fg, opacity: 0.45, margin: '2px 16px' }} />
      <div style={{ color: txt, fontSize: 21, fontWeight: 800, letterSpacing: 0.2 }}>{label}</div>
    </button>
  )
}
function ParkIcon({ color }: { color: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 22 H12 V33" /><path d="M44 22 H52 V33" />
      <rect x="25" y="7" width="14" height="15" rx="2.5" />
      <path d="M30 11 v7 M30 11 h3.2 a2.2 2.2 0 0 1 0 4.2 H30" />
      <path d="M18 45 l2.2-8 a4 4 0 0 1 3.8-2.9 h16 a4 4 0 0 1 3.8 2.9 l2.2 8" />
      <rect x="16" y="45" width="32" height="10" rx="3" />
      <circle cx="23" cy="55" r="1.8" /><circle cx="41" cy="55" r="1.8" />
    </svg>
  )
}
function RetrieveIcon({ color }: { color: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 25 H12 V36" /><path d="M44 25 H52 V36" />
      <circle cx="32" cy="14" r="6.5" /><path d="M32 20.5 v6 M32 24 h3.2" />
      <path d="M18 47 l2.2-8 a4 4 0 0 1 3.8-2.9 h16 a4 4 0 0 1 3.8 2.9 l2.2 8" />
      <rect x="16" y="47" width="32" height="10" rx="3" />
      <circle cx="23" cy="57" r="1.8" /><circle cx="41" cy="57" r="1.8" />
    </svg>
  )
}
function segBtn(active: boolean): React.CSSProperties {
  return { flex: 1, padding: '10px', borderRadius: 10, border: active ? `1.5px solid ${NAVY}` : '1.5px solid #CBD5E1', background: active ? NAVY : '#fff', color: active ? '#fff' : '#64748B', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
}
