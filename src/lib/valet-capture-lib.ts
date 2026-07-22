// ============================================================
// Valet capture library
//  - SLOTS: the guided photo angles (4 corners + plate)
//  - stampFrame: burns BSM logo + timestamp into a camera frame
//  - IndexedDB offline queue (enqueue / list / remove)
//  - serverWrite: the single write path used both live and on sync
// ============================================================

export type SlotKey = 'front' | 'front_right' | 'right' | 'rear_right' | 'rear' | 'rear_left' | 'left' | 'front_left'

export const SLOTS: {
  key: SlotKey; label: string; label_es: string; hint: string; hint_es: string
}[] = [
  { key: 'front',       label: 'Front',            label_es: 'Frente',                hint: 'Stand square in front of the car — include the plate.', hint_es: 'Parese frente al auto e incluya la placa.' },
  { key: 'front_right', label: 'Front-Right corner', label_es: 'Esquina delantera der.', hint: 'Move to the front-right corner.', hint_es: 'Muevase a la esquina delantera derecha.' },
  { key: 'right',       label: 'Right side',       label_es: 'Lado derecho',          hint: 'Passenger side — capture the full side.', hint_es: 'Lado del pasajero, capture todo el costado.' },
  { key: 'rear_right',  label: 'Rear-Right corner', label_es: 'Esquina trasera der.',  hint: 'Move to the rear-right corner.', hint_es: 'Muevase a la esquina trasera derecha.' },
  { key: 'rear',        label: 'Rear',             label_es: 'Parte trasera',         hint: 'Stand square behind the car — include the plate.', hint_es: 'Parese detras del auto e incluya la placa.' },
  { key: 'rear_left',   label: 'Rear-Left corner', label_es: 'Esquina trasera izq.',  hint: 'Move to the rear-left corner.', hint_es: 'Muevase a la esquina trasera izquierda.' },
  { key: 'left',        label: 'Left side',        label_es: 'Lado izquierdo',        hint: 'Driver side — capture the full side.', hint_es: 'Lado del conductor, capture todo el costado.' },
  { key: 'front_left',  label: 'Front-Left corner', label_es: 'Esquina delantera izq.', hint: 'Move to the front-left corner.', hint_es: 'Muevase a la esquina delantera izquierda.' },
]

// ---------- Logo + timestamp stamp ----------
let logoPromise: Promise<HTMLImageElement | null> | null = null
function loadLogo(): Promise<HTMLImageElement | null> {
  if (logoPromise) return logoPromise
  logoPromise = new Promise(res => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = '/bsm-mark.png'
  })
  return logoPromise
}

// Long edge of the saved photo. 1600px still resolves panel-level scratches and
// dents; going lower starts costing evidence value.
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.8
// Small copy for the on-screen review strip. Displaying the full-size photos
// there makes Safari decode ~8MB of bitmap per shot and the app crawls by
// photo 7. This is display-only and is never uploaded.
const THUMB_EDGE = 240
const THUMB_QUALITY = 0.6

export async function stampFrame(video: HTMLVideoElement): Promise<{ blob: Blob; thumb: Blob; capturedAt: string }> {
  const vw = video.videoWidth || 1280
  const vh = video.videoHeight || 720

  // Downscale to the long edge — never upscale a smaller sensor frame.
  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh))
  const w = Math.round(vw * scale)
  const h = Math.round(vh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // High-quality resampling matters only when we're actually shrinking the
  // frame. At 1:1 it's wasted work, so skip it.
  if (scale < 1) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }
  ctx.drawImage(video, 0, 0, w, h)

  // The stamp is drawn AFTER the downscale, at final resolution, so the
  // timestamp and logo stay razor sharp rather than being resampled.
  const now = new Date()
  const stamp = now.toLocaleString()
  const bar = Math.max(40, Math.round(h * 0.065))

  ctx.fillStyle = 'rgba(30,27,23,0.66)'
  ctx.fillRect(0, h - bar, w, bar)

  const fs = Math.round(bar * 0.4)
  ctx.font = `600 ${fs}px system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(stamp, 16, h - bar / 2)

  const logo = await loadLogo()
  const pad = Math.round(bar * 0.2)
  if (logo && logo.width) {
    const lh = bar - pad * 2
    const lw = Math.round(lh * (logo.width / logo.height))
    ctx.drawImage(logo, w - lw - pad, h - bar + pad, lw, lh)
  } else {
    ctx.font = `800 ${fs}px system-ui, sans-serif`
    ctx.fillStyle = '#DCB878'
    ctx.textAlign = 'right'
    ctx.fillText('BSM', w - 16, h - bar / 2)
    ctx.textAlign = 'left'
  }

  const blob: Blob = await new Promise(res =>
    canvas.toBlob(b => res(b as Blob), 'image/jpeg', JPEG_QUALITY)
  )

  // Thumbnail for the review strip — tiny, so this costs only a few ms.
  const tScale = Math.min(1, THUMB_EDGE / Math.max(w, h))
  const tc = document.createElement('canvas')
  tc.width = Math.round(w * tScale)
  tc.height = Math.round(h * tScale)
  const tctx = tc.getContext('2d')!
  tctx.imageSmoothingEnabled = true
  tctx.imageSmoothingQuality = 'medium'
  tctx.drawImage(canvas, 0, 0, tc.width, tc.height)
  const thumb: Blob = await new Promise(res =>
    tc.toBlob(b => res((b || blob) as Blob), 'image/jpeg', THUMB_QUALITY)
  )

  return { blob, thumb, capturedAt: now.toISOString() }
}

// ---------- Offline queue (IndexedDB) ----------
const DB_NAME = 'bsm-valet'
const STORE = 'queue'

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) {
        r.result.createObjectStore(STORE, { keyPath: 'clientRef' })
      }
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

export type QueuedPhoto = { slot: string; sequence: number; blob: Blob; capturedAt: string }

export type QueuedEvent = {
  clientRef: string
  action: 'park' | 'retrieve'
  employeeId: string
  locationId: string | null
  note: string
  customerId: string | null
  vehicleId: string | null
  sessionId?: string | null
  newCustomer: { full_name: string; phone: string; email: string; unit_number: string; customer_type?: 'tenant' | 'guest'; host_customer_id?: string | null } | null
  newVehicle: { license_plate: string; make: string; model: string; color: string } | null
  photos: QueuedPhoto[]
  createdAt: string
}

export async function enqueue(ev: QueuedEvent): Promise<void> {
  const db = await openDB()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(ev)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

export async function listQueue(): Promise<QueuedEvent[]> {
  const db = await openDB()
  const out = await new Promise<QueuedEvent[]>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => res(req.result as QueuedEvent[])
    req.onerror = () => rej(req.error)
  })
  db.close()
  return out
}

export async function removeQueued(clientRef: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(clientRef)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}

// ---------- Shared server write (live + sync) ----------
// Idempotent on client_ref so a re-synced event never double-writes.
export async function serverWrite(ev: QueuedEvent, supabase: any): Promise<string | null> {
  // 1. Resolve customer
  let customerId = ev.customerId
  if (!customerId && ev.newCustomer) {
    const nc = ev.newCustomer
    const ctype = nc.customer_type === 'guest' ? 'guest' : 'tenant'
    let unitId: string | null = null
    let hostId: string | null = null

    if (ctype === 'guest' && nc.host_customer_id) {
      // guest inherits the host's unit
      hostId = nc.host_customer_id
      const { data: host } = await supabase.from('valet_customers').select('unit_id').eq('id', hostId).maybeSingle()
      unitId = host?.unit_id || null
    } else if (nc.unit_number && ev.locationId) {
      const { data: existingUnit } = await supabase
        .from('valet_units').select('id')
        .eq('location_id', ev.locationId).eq('unit_number', nc.unit_number).maybeSingle()
      if (existingUnit?.id) {
        unitId = existingUnit.id
      } else {
        const { data: nu } = await supabase
          .from('valet_units')
          .insert({ location_id: ev.locationId, unit_number: nc.unit_number })
          .select('id').single()
        unitId = nu?.id || null
      }
    }
    const { data: created, error: ce } = await supabase.from('valet_customers').insert({
      location_id: ev.locationId,
      unit_id: unitId,
      full_name: nc.full_name,
      phone: nc.phone || null,
      email: nc.email || null,
      customer_type: ctype,
      host_customer_id: hostId,
      created_by: ev.employeeId,
    }).select('id').single()
    if (ce) throw ce
    customerId = created.id
  }

  // 2. Resolve vehicle
  let vehicleId = ev.vehicleId
  if (!vehicleId && ev.newVehicle && customerId) {
    const { data: nv, error: ve } = await supabase.from('valet_vehicles').insert({
      customer_id: customerId,
      license_plate: ev.newVehicle.license_plate,
      make: ev.newVehicle.make || null,
      model: ev.newVehicle.model || null,
      color: ev.newVehicle.color || null,
      created_by: ev.employeeId,
    }).select('id').single()
    if (ve) throw ve
    vehicleId = nv.id
  }

  // 3. Event (idempotent on client_ref)
  let eventId: string
  const { data: ins, error: ee } = await supabase.from('valet_events').insert({
    client_ref: ev.clientRef,
    action: ev.action,
    employee_id: ev.employeeId,
    location_id: ev.locationId,
    customer_id: customerId,
    vehicle_id: vehicleId,
    note: ev.note || null,
    event_at: ev.createdAt,
    ...(ev.sessionId ? { session_id: ev.sessionId } : {}),
  }).select('id').single()

  if (ee) {
    const { data: existing } = await supabase
      .from('valet_events').select('id').eq('client_ref', ev.clientRef).maybeSingle()
    if (!existing?.id) throw ee
    eventId = existing.id
  } else {
    eventId = ins.id
  }

  // 4. Photos — skip if this event already has them (re-sync safety)
  const { data: already } = await supabase
    .from('valet_photos').select('id').eq('event_id', eventId).limit(1)
  if (already && already.length > 0) return eventId

  for (const p of ev.photos) {
    const path = `${ev.locationId || 'loc'}/${eventId}/${p.sequence}_${p.slot}.jpg`
    const { error: ue } = await supabase.storage
      .from('valet-photos').upload(path, p.blob, { upsert: true, contentType: 'image/jpeg' })
    if (ue) throw ue
    const { error: pe } = await supabase.from('valet_photos').insert({
      event_id: eventId,
      slot: p.slot,
      sequence: p.sequence,
      storage_path: path,
      captured_at: p.capturedAt,
    })
    if (pe) throw pe
  }
  return eventId
}

// Drain everything queued. Returns the created event ids (for post-sync emailing).
export async function drainQueue(supabase: any): Promise<string[]> {
  const items = await listQueue()
  const ids: string[] = []
  for (const it of items) {
    try {
      const id = await serverWrite(it, supabase)
      await removeQueued(it.clientRef)
      if (id) ids.push(id)
    } catch {
      // leave it in the queue; try again next time
    }
  }
  return ids
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
