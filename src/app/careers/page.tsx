'use client'

import { useState } from 'react'

type Lang = 'en' | 'es'
type Job = { n: string; en: string; es: string; expReq?: boolean }
type Cat = { name: string; es: string; icon: string; jobs: Job[]; ladder?: boolean }

const EXP_EN = 'Prior experience required.'
const EXP_ES = 'Se requiere experiencia previa.'

// ── Categories → jobs. EDIT FREELY. ──
const CATS: Cat[] = [
  {
    name: 'Cleaning & Porter', es: 'Limpieza y Portería', icon: '🧹', jobs: [
      { n: 'Garbage Porter', en: 'Collects and hauls trash and recycling to the curb. 6 PM–12 AM. Must have a car.', es: 'Recoge y lleva basura y reciclaje a la acera. 6 PM–12 AM. Debe tener auto.' },
      { n: 'Cleaning Porter', en: 'Cleans lobbies, hallways, common areas, and restrooms.', es: 'Limpia vestíbulos, pasillos, áreas comunes y baños.' },
      { n: 'Morning Garbage Porter', en: 'Early shift; brings cans back and cleans the perimeter as needed. 8 AM–5 PM. Must have a car.', es: 'Turno de la mañana; regresa los botes y limpia el perímetro si es necesario. 8 AM–5 PM. Debe tener auto.' },
      { n: 'Janitorial', en: 'General cleaning of offices, common areas, restrooms, and floors.', es: 'Limpieza general de oficinas, áreas comunes, baños y pisos.' },
    ],
  },
  {
    name: 'Front of House', es: 'Recepción', icon: '🛎️', jobs: [
      { n: 'Concierge', en: 'Greets residents and guests, handles packages and front-desk requests.', es: 'Recibe a residentes e invitados, maneja paquetes y solicitudes de recepción.', expReq: true },
      { n: 'Valet Parking', en: 'Parks and retrieves vehicles for residents and guests.', es: 'Estaciona y entrega vehículos a residentes e invitados.' },
      { n: 'Parking Attendant', en: 'Manages parking areas, entry/exit, and vehicle flow.', es: 'Gestiona áreas de estacionamiento, entrada/salida y flujo de vehículos.' },
    ],
  },
  {
    name: 'Building & Maintenance', es: 'Edificio y Mantenimiento', icon: '🔧', jobs: [
      { n: 'Superintendent', en: 'Oversees building operations, minor repairs, vendors, and tenant issues.', es: 'Supervisa operaciones del edificio, reparaciones menores, proveedores e inquilinos.', expReq: true },
      { n: 'Handyman', en: 'General repairs: drywall, painting, basic plumbing and electrical.', es: 'Reparaciones generales: paneles de yeso, pintura, plomería y electricidad básicas.' },
      { n: 'Maintenance', en: 'Preventive and repair work on building systems and equipment.', es: 'Trabajo preventivo y de reparación en sistemas y equipos del edificio.' },
    ],
  },
  {
    name: 'Security', es: 'Seguridad', icon: '🛡️', jobs: [
      { n: 'Security', en: 'Monitors access, patrols the property, and reports incidents.', es: 'Controla el acceso, patrulla la propiedad y reporta incidentes.', expReq: true },
    ],
  },
  {
    name: 'Management', es: 'Gerencia', icon: '📈', ladder: true, jobs: [
      { n: 'Area Supervisor', en: 'Entry management role — the start of the path.', es: 'Puesto inicial de gestión — el comienzo del camino.' },
      { n: 'Operations Supervisor', en: 'Second step (after Area Supervisor). Oversees sites and staff.', es: 'Segundo paso (después de Supervisor de Área). Supervisa sitios y personal.' },
      { n: 'Operations Manager', en: 'Third step. Manages operations across multiple sites.', es: 'Tercer paso. Gestiona operaciones en varios sitios.' },
      { n: 'Sr. Operations Manager', en: 'Manages a group of Operations Managers.', es: 'Gestiona un grupo de Gerentes de Operaciones.' },
    ],
  },
  {
    name: 'Other', es: 'Otros', icon: '✨', jobs: [
      { n: 'Nanny', en: 'Provides in-home childcare, supervision, and daily routines.', es: 'Brinda cuidado infantil en el hogar, supervisión y rutinas diarias.' },
      { n: 'Lease Coordinator', en: 'Manages leasing paperwork, applications, and move-in coordination.', es: 'Gestiona documentos de arrendamiento, solicitudes y coordinación de mudanzas.' },
    ],
  },
]

const MAX_POSITIONS = 3
const MGMT = CATS.find(c => c.ladder)!.jobs.map(j => j.n) // low → high

const BOROUGHS = ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island']
const TRANSPORT = [
  { v: 'Bicycle', en: 'Bicycle', es: 'Bicicleta' }, { v: 'Scooter', en: 'Scooter', es: 'Scooter' },
  { v: 'Train', en: 'Train', es: 'Tren' }, { v: 'Bus', en: 'Bus', es: 'Autobús' }, { v: 'Car', en: 'Car', es: 'Auto' },
]
const AVAIL = [
  { v: 'Weekdays', en: 'Weekdays', es: 'Días de semana' },
  { v: 'Weekends & Holidays', en: 'Weekends & Holidays', es: 'Fines de semana y feriados' },
  { v: 'All', en: 'All', es: 'Todos' },
]
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const S: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Join the BSM team', subtitle: 'Tell us about yourself and a recruiter will reach out.',
    name: 'Full name', phone: 'Phone', email: 'Email',
    position: 'Positions you\u2019re applying for', positionHint: 'Choose up to 3', allCats: '\u2190 All categories', jobsIn: 'jobs',
    licensed: 'Are you a licensed security guard?', yesLic: 'Licensed', noLic: 'Unlicensed', licenseUpload: 'Upload your license / certificate',
    state: 'State', city: 'City', borough: 'Borough', chooseState: 'Select\u2026', chooseBorough: 'Select borough\u2026',
    workAreas: 'Open to work in (boroughs)', payLow: 'Lowest pay ($/hr)', payHigh: 'Highest pay ($/hr)',
    transport: 'How will you get to work?', avail: 'Availability',
    english: 'English level', basic: 'Basic', intermediate: 'Intermediate', fluent: 'Fluent',
    source: 'How did you hear about us?', experience: 'Briefly, your work experience', resume: 'Résumé (optional)',
    submit: 'Submit application', submitting: 'Submitting\u2026',
    reqCore: 'Please fill in name, phone, email, and at least one position.',
    reqPay: 'Please enter your expected pay range.', payOrder: 'Lowest pay can\u2019t be higher than highest.',
    okTitle: 'Thank you!', okBody: 'We received your application. A recruiter will contact you soon.',
    another: 'Submit another', errorMsg: 'Something went wrong. Please try again.',
  },
  es: {
    title: '\u00danete al equipo de BSM', subtitle: 'Cu\u00e9ntanos sobre ti y un reclutador se comunicar\u00e1 contigo.',
    name: 'Nombre completo', phone: 'Tel\u00e9fono', email: 'Correo electr\u00f3nico',
    position: 'Puestos a los que aplicas', positionHint: 'Elige hasta 3', allCats: '\u2190 Todas las categor\u00edas', jobsIn: 'puestos',
    licensed: '\u00bfEres guardia de seguridad con licencia?', yesLic: 'Con licencia', noLic: 'Sin licencia', licenseUpload: 'Sube tu licencia / certificado',
    state: 'Estado', city: 'Ciudad', borough: 'Condado', chooseState: 'Seleccionar\u2026', chooseBorough: 'Seleccionar condado\u2026',
    workAreas: 'Dispuesto a trabajar en (condados)', payLow: 'Pago m\u00ednimo ($/hr)', payHigh: 'Pago m\u00e1ximo ($/hr)',
    transport: '\u00bfC\u00f3mo llegar\u00e1s al trabajo?', avail: 'Disponibilidad',
    english: 'Nivel de ingl\u00e9s', basic: 'B\u00e1sico', intermediate: 'Intermedio', fluent: 'Fluido',
    source: '\u00bfC\u00f3mo supiste de nosotros?', experience: 'Brevemente, tu experiencia laboral', resume: 'Curr\u00edculum (opcional)',
    submit: 'Enviar solicitud', submitting: 'Enviando\u2026',
    reqCore: 'Completa nombre, tel\u00e9fono, correo y al menos un puesto.',
    reqPay: 'Ingresa tu rango de pago esperado.', payOrder: 'El pago m\u00ednimo no puede ser mayor que el m\u00e1ximo.',
    okTitle: '\u00a1Gracias!', okBody: 'Recibimos tu solicitud. Un reclutador te contactar\u00e1 pronto.',
    another: 'Enviar otra', errorMsg: 'Algo sali\u00f3 mal. Int\u00e9ntalo de nuevo.',
  },
}

export default function CareersPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const tt = S[lang]

  const [f, setF] = useState({
    full_name: '', phone: '', email: '', state: '', city: '', borough: '',
    pay_min: '', pay_max: '', english_level: '', referral_source: '', experience: '',
  })
  const [positions, setPositions] = useState<string[]>([])
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [securityLicensed, setSecurityLicensed] = useState<'' | 'yes' | 'no'>('')
  const [license, setLicense] = useState<File | null>(null)
  const [workAreas, setWorkAreas] = useState<string[]>([])
  const [transport, setTransport] = useState<string[]>([])
  const [availability, setAvailability] = useState('')
  const [resume, setResume] = useState<File | null>(null)

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const toggle = (arr: string[], setArr: (a: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  const has = (n: string) => positions.includes(n)
  const capped = positions.length >= MAX_POSITIONS

  // management ladder ceiling = lowest selected rung; anything above locks
  const mgmtCeiling = (() => {
    const idxs = positions.filter(p => MGMT.includes(p)).map(p => MGMT.indexOf(p))
    return idxs.length ? Math.min(...idxs) : Infinity
  })()
  function jobLocked(job: Job) {
    if (has(job.n)) return false
    if (capped) return true
    if (MGMT.includes(job.n) && MGMT.indexOf(job.n) > mgmtCeiling) return true
    return false
  }

  function toggleJob(name: string) {
    setPositions(prev => {
      if (prev.includes(name)) {
        if (name === 'Security') { setSecurityLicensed(''); setLicense(null) }
        return prev.filter(x => x !== name)
      }
      if (prev.length >= MAX_POSITIONS) return prev
      if (MGMT.includes(name) && MGMT.indexOf(name) > mgmtCeiling) return prev
      return [...prev, name]
    })
  }

  async function submit() {
    setErr('')
    const emailOk = /^\S+@\S+\.\S+$/.test(f.email)
    const boroughNeeded = f.state === 'NY'
    if (!f.full_name || !f.phone || !f.email || positions.length === 0 || !f.state || !f.city || (boroughNeeded && !f.borough) || workAreas.length === 0 || !f.english_level || transport.length === 0 || !availability || !f.pay_min || !f.pay_max || (has('Security') && !securityLicensed)) {
      setErr(lang === 'es' ? 'Complete todos los campos obligatorios.' : 'Please complete all required fields.'); return
    }
    if (!emailOk) { setErr(lang === 'es' ? 'Ingrese un correo electrónico válido.' : 'Please enter a valid email.'); return }
    if (Number(f.pay_min) > Number(f.pay_max)) { setErr(tt.payOrder); return }
    setBusy(true)
    try {
      const fd = new FormData()
      Object.entries(f).forEach(([k, v]) => fd.append(k, v))
      fd.append('preferred_lang', lang)
      positions.forEach(p => fd.append('positions', p))
      fd.append('availability', availability)
      workAreas.forEach(w => fd.append('work_areas', w))
      transport.forEach(t => fd.append('transportation', t))
      if (has('Security')) fd.append('security_licensed', securityLicensed === 'yes' ? 'true' : securityLicensed === 'no' ? 'false' : '')
      if (license) fd.append('license', license)
      fd.append('company', '')
      if (resume) fd.append('resume', resume)
      const res = await fetch('/api/apply', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch { setErr(tt.errorMsg) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 text-2xl grid place-items-center mx-auto mb-4">✓</div>
          <h1 className="text-xl font-semibold text-[#0D1B35] mb-2">{tt.okTitle}</h1>
          <p className="text-gray-500 text-sm mb-6">{tt.okBody}</p>
          <button onClick={() => location.reload()} className="text-sm text-[#0D1B35] font-medium border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">{tt.another}</button>
        </div>
      </div>
    )
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]'
  const label = 'block text-sm font-medium text-gray-700 mb-1'
  const pill = (on: boolean) => `text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${on ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`
  const catCount = (c: Cat) => c.jobs.filter(j => has(j.n)).length

  return (
    <div className="min-h-screen bg-[#F5F6FA] py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D1B35] grid place-items-center text-[#D4A843] font-bold text-lg">B</div>
            <div><div className="font-semibold text-[#0D1B35] leading-tight">BSM Facility Solutions</div><div className="text-xs text-gray-400">Careers</div></div>
          </div>
          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
            {(['en', 'es'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${lang === l ? 'bg-[#0D1B35] text-white' : 'text-gray-500'}`}>{l === 'en' ? 'EN' : 'ES'}</button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-semibold text-[#0D1B35]">{tt.title}</h1>
          <p className="text-sm text-gray-500 mt-1 mb-5">{tt.subtitle}</p>

          <div className="space-y-5">
            <div><label className={label}>{tt.name} *</label><input className={input} value={f.full_name} onChange={e => set('full_name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>{tt.phone} *</label><input className={input} value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div><label className={label}>{tt.email} *</label><input type="email" className={input} value={f.email} onChange={e => set('email', e.target.value)} /></div>
            </div>

            {/* ── Positions: two-step category picker ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={label + ' mb-0'}>{tt.position} *</label>
                <span className="text-xs text-gray-400">{positions.length}/{MAX_POSITIONS} · {tt.positionHint}</span>
              </div>

              {/* selected chips */}
              {positions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {positions.map(p => (
                    <span key={p} className="bg-[#0D1B35] text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      {p}<button type="button" onClick={() => toggleJob(p)} className="opacity-70">✕</button>
                    </span>
                  ))}
                </div>
              )}

              {activeCat === null ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {CATS.map((c, i) => {
                    const cc = catCount(c)
                    return (
                      <button key={c.name} type="button" onClick={() => setActiveCat(i)}
                        className="rounded-xl border border-gray-200 hover:border-[#D4A843] p-4 text-center transition-colors">
                        <div className="text-2xl">{c.icon}</div>
                        <div className="text-sm font-semibold text-[#0D1B35] mt-1.5">{lang === 'es' ? c.es : c.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: cc ? '#8A6D1E' : '#9CA3AF' }}>{cc ? `${cc} selected` : `${c.jobs.length} ${tt.jobsIn}`}</div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div>
                  <button type="button" onClick={() => setActiveCat(null)} className="text-sm text-gray-500 mb-3 flex items-center gap-1">{tt.allCats}</button>
                  <div className="text-sm font-semibold text-[#0D1B35] mb-2">{CATS[activeCat].icon} {lang === 'es' ? CATS[activeCat].es : CATS[activeCat].name}</div>
                  <div className="space-y-2">
                    {CATS[activeCat].jobs.map(j => {
                      const on = has(j.n)
                      const locked = jobLocked(j)
                      return (
                        <button key={j.n} type="button" disabled={locked} onClick={() => toggleJob(j.n)}
                          className={`w-full text-left rounded-xl border p-3 transition-colors ${on ? 'border-[#D4A843] bg-[#D4A843]/5' : locked ? 'border-gray-100 opacity-40 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded border flex-shrink-0 grid place-items-center ${on ? 'bg-[#D4A843] border-[#D4A843]' : 'border-gray-300'}`}>{on && <span className="text-white text-[10px] leading-none">✓</span>}</span>
                            <span className="font-medium text-sm text-[#0D1B35]">{j.n}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">
                            {lang === 'es' ? j.es : j.en}
                            {j.expReq && <span className="block text-[#B45309] font-medium mt-0.5">{lang === 'es' ? EXP_ES : EXP_EN}</span>}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Security license (appears once Security is selected, wherever you are) */}
              {has('Security') && (
                <div className="mt-3 border border-gray-200 rounded-xl p-3 bg-gray-50/60">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">🛡️ {tt.licensed}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSecurityLicensed('yes')} className={pill(securityLicensed === 'yes')}>{tt.yesLic}</button>
                    <button type="button" onClick={() => { setSecurityLicensed('no'); setLicense(null) }} className={pill(securityLicensed === 'no')}>{tt.noLic}</button>
                  </div>
                  {securityLicensed === 'yes' && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{tt.licenseUpload}</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setLicense(e.target.files?.[0] || null)}
                        className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-200 file:bg-white file:text-gray-700 file:text-sm" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{tt.state} *</label>
                <select className={input} value={f.state} onChange={e => { set('state', e.target.value); if (e.target.value !== 'NY') set('borough', '') }}>
                  <option value="">{tt.chooseState}</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={label}>{tt.city} *</label><input className={input} value={f.city} onChange={e => set('city', e.target.value)} /></div>
            </div>
            {f.state === 'NY' && (
              <div>
                <label className={label}>{tt.borough} *</label>
                <select className={input} value={f.borough} onChange={e => set('borough', e.target.value)}>
                  <option value="">{tt.chooseBorough}</option>
                  {BOROUGHS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={label}>{tt.workAreas} *</label>
              <div className="flex flex-wrap gap-2">
                {BOROUGHS.map(b => <button key={b} type="button" onClick={() => toggle(workAreas, setWorkAreas, b)} className={pill(workAreas.includes(b))}>{b}</button>)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>{tt.payLow} *</label><input type="number" min="0" step="0.5" className={input} value={f.pay_min} onChange={e => set('pay_min', e.target.value)} placeholder="18" /></div>
              <div><label className={label}>{tt.payHigh} *</label><input type="number" min="0" step="0.5" className={input} value={f.pay_max} onChange={e => set('pay_max', e.target.value)} placeholder="22" /></div>
            </div>

            <div>
              <label className={label}>{tt.transport} *</label>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT.map(t => <button key={t.v} type="button" onClick={() => toggle(transport, setTransport, t.v)} className={pill(transport.includes(t.v))}>{lang === 'es' ? t.es : t.en}</button>)}
              </div>
            </div>

            <div>
              <label className={label}>{tt.avail} *</label>
              <div className="flex flex-wrap gap-2">
                {AVAIL.map(a => <button key={a.v} type="button" onClick={() => setAvailability(a.v)} className={pill(availability === a.v)}>{lang === 'es' ? a.es : a.en}</button>)}
              </div>
            </div>

            <div>
              <label className={label}>{tt.english} *</label>
              <select className={input} value={f.english_level} onChange={e => set('english_level', e.target.value)}>
                <option value=""></option>
                <option value="Basic">{tt.basic}</option>
                <option value="Intermediate">{tt.intermediate}</option>
                <option value="Fluent">{tt.fluent}</option>
              </select>
            </div>
            <div><label className={label}>{tt.source} <span className="text-gray-400 font-normal">({lang==='es'?'opcional':'optional'})</span></label><input className={input} value={f.referral_source} onChange={e => set('referral_source', e.target.value)} /></div>
            <div><label className={label}>{tt.experience} <span className="text-gray-400 font-normal">({lang==='es'?'opcional':'optional'})</span></label><textarea rows={3} className={input} value={f.experience} onChange={e => set('experience', e.target.value)} /></div>
            <div>
              <label className={label}>{tt.resume}</label>
              <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setResume(e.target.files?.[0] || null)}
                className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-200 file:bg-gray-50 file:text-gray-700 file:text-sm" />
            </div>

            <input type="text" tabIndex={-1} autoComplete="off" value="" onChange={() => {}} className="hidden" aria-hidden="true" />

            {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
            <button onClick={submit} disabled={busy} className="w-full bg-[#D4A843] text-[#0D1B35] font-semibold py-3 rounded-lg hover:bg-[#C49A38] transition-colors disabled:opacity-50">
              {busy ? tt.submitting : tt.submit}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">BSM Facility Solutions · Equal opportunity employer</p>
      </div>
    </div>
  )
}
