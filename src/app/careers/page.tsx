'use client'

import { useState } from 'react'
import { ThemeToggle } from '@/components/theme'

type Lang = 'en' | 'es'
type Job = { n: string; en: string; es: string; expReq?: boolean }
type Cat = { name: string; es: string; icon: string; jobs: Job[]; ladder?: boolean }

const EXP_EN = 'Prior experience required.'
const EXP_ES = 'Se requiere experiencia previa.'

// ── Drawn brand icons (no emojis) ──
const ICONS: Record<string, JSX.Element> = {
  cleaning: <><path d="M9 3l1.5 7M15 3l-1.5 7" /><path d="M7.5 10h9l-.9 4.5a2 2 0 0 1-2 1.6h-3.2a2 2 0 0 1-2-1.6z" /><path d="M9.5 16.5V21M12 16.5V21M14.5 16.5V21" /></>,
  front: <><path d="M4.5 15.5a7.5 7.5 0 0 1 15 0z" /><path d="M3 18.5h18" /><path d="M12 5.5V8" /><circle cx="12" cy="4.2" r="1.2" /></>,
  building: <><path d="M14.7 6.3a3.6 3.6 0 0 0 4.6 4.6l-8.4 8.4a2.2 2.2 0 0 1-3.1-3.1z" /><path d="M14.7 6.3l-2.2-2.2a2 2 0 0 0-2.8 0L8.4 5.4a2 2 0 0 0 0 2.8l2.2 2.2" /></>,
  security: <><path d="M12 3l7.5 3v5.4c0 4.6-3.1 7.9-7.5 9.6-4.4-1.7-7.5-5-7.5-9.6V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  management: <><path d="M4 19h16" /><path d="M6 19v-5.5M11 19V9M16 19v-8" /><path d="M5 9.5L10 5l3.5 3L20 3.5" /><path d="M20 7V3.5h-3.5" /></>,
  other: <><path d="M12 3.5l1.9 4.9 4.9 1.9-4.9 1.9L12 17.1l-1.9-4.9L5.2 10.3l4.9-1.9z" /><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
}
const CatIcon = ({ k, size = 22 }: { k: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--gold)]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[k]}</svg>
)

// ── Categories → jobs. EDIT FREELY. ──
const CATS: Cat[] = [
  {
    name: 'Cleaning & Porter', es: 'Limpieza y Portería', icon: 'cleaning', jobs: [
      { n: 'Garbage Porter', en: 'Collects and hauls trash and recycling to the curb. 6 PM–12 AM. Must have a car.', es: 'Recoge y lleva basura y reciclaje a la acera. 6 PM–12 AM. Debe tener auto.' },
      { n: 'Cleaning Porter', en: 'Cleans lobbies, hallways, common areas, and restrooms.', es: 'Limpia vestíbulos, pasillos, áreas comunes y baños.' },
      { n: 'Morning Garbage Porter', en: 'Early shift; brings cans back and cleans the perimeter as needed. 8 AM–5 PM. Must have a car.', es: 'Turno de la mañana; regresa los botes y limpia el perímetro si es necesario. 8 AM–5 PM. Debe tener auto.' },
      { n: 'Janitorial', en: 'General cleaning of offices, common areas, restrooms, and floors.', es: 'Limpieza general de oficinas, áreas comunes, baños y pisos.' },
    ],
  },
  {
    name: 'Front of House', es: 'Recepción', icon: 'front', jobs: [
      { n: 'Concierge', en: 'Greets residents and guests, handles packages and front-desk requests.', es: 'Recibe a residentes e invitados, maneja paquetes y solicitudes de recepción.', expReq: true },
      { n: 'Valet Parking', en: 'Parks and retrieves vehicles for residents and guests.', es: 'Estaciona y entrega vehículos a residentes e invitados.' },
      { n: 'Parking Attendant', en: 'Manages parking areas, entry/exit, and vehicle flow.', es: 'Gestiona áreas de estacionamiento, entrada/salida y flujo de vehículos.' },
    ],
  },
  {
    name: 'Building & Maintenance', es: 'Edificio y Mantenimiento', icon: 'building', jobs: [
      { n: 'Superintendent', en: 'Oversees building operations, minor repairs, vendors, and tenant issues.', es: 'Supervisa operaciones del edificio, reparaciones menores, proveedores e inquilinos.', expReq: true },
      { n: 'Handyman', en: 'General repairs: drywall, painting, basic plumbing and electrical.', es: 'Reparaciones generales: paneles de yeso, pintura, plomería y electricidad básicas.' },
      { n: 'Maintenance', en: 'Preventive and repair work on building systems and equipment.', es: 'Trabajo preventivo y de reparación en sistemas y equipos del edificio.' },
    ],
  },
  {
    name: 'Security', es: 'Seguridad', icon: 'security', jobs: [
      { n: 'Security', en: 'Monitors access, patrols the property, and reports incidents.', es: 'Controla el acceso, patrulla la propiedad y reporta incidentes.', expReq: true },
    ],
  },
  {
    name: 'Management', es: 'Gerencia', icon: 'management', ladder: true, jobs: [
      { n: 'Area Supervisor', en: 'Entry management role — the start of the path.', es: 'Puesto inicial de gestión — el comienzo del camino.' },
      { n: 'Operations Supervisor', en: 'Second step (after Area Supervisor). Oversees sites and staff.', es: 'Segundo paso (después de Supervisor de Área). Supervisa sitios y personal.' },
      { n: 'Operations Manager', en: 'Third step. Manages operations across multiple sites.', es: 'Tercer paso. Gestiona operaciones en varios sitios.' },
      { n: 'Sr. Operations Manager', en: 'Manages a group of Operations Managers.', es: 'Gestiona un grupo de Gerentes de Operaciones.' },
    ],
  },
  {
    name: 'Other', es: 'Otros', icon: 'other', jobs: [
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
    eyebrow: 'Careers',
    name: 'Full name', phone: 'Phone', email: 'Email',
    position: 'Positions you\u2019re applying for', positionHint: 'Choose up to 3', allCats: '\u2190 All categories', jobsIn: 'jobs', selected: 'selected',
    licensed: 'Are you a licensed security guard?', yesLic: 'Licensed', noLic: 'Unlicensed', licenseUpload: 'Upload your license / certificate',
    state: 'State', city: 'City', borough: 'Borough', chooseState: 'Select\u2026', chooseBorough: 'Select borough\u2026',
    workAreas: 'Open to work in (boroughs)', payLow: 'Lowest pay ($/hr)', payHigh: 'Highest pay ($/hr)',
    transport: 'How will you get to work?', avail: 'Availability',
    english: 'English level', basic: 'Basic', intermediate: 'Intermediate', fluent: 'Fluent',
    source: 'How did you hear about us?', experience: 'Briefly, your work experience', resume: 'Résumé (optional)',
    submit: 'Submit application', submitting: 'Submitting\u2026',
    smsTitle: 'Text message updates',
    smsLabel: 'I agree to receive text messages from BSM Facility Solutions about my application, interview scheduling, and hiring status.',
    smsFine: 'Optional \u2014 you can apply without this. Message and data rates may apply. Message frequency varies. Reply STOP to opt out or HELP for help.',
    smsPrivacy: 'Privacy Policy', smsTerms: 'SMS Terms',
    reqCore: 'Please fill in name, phone, email, and at least one position.',
    reqPay: 'Please enter your expected pay range.', payOrder: 'Lowest pay can\u2019t be higher than highest.',
    okTitle: 'Thank you!', okBody: 'We received your application. A recruiter will contact you soon.',
    another: 'Submit another', errorMsg: 'Something went wrong. Please try again.',
    optional: 'optional', footer: 'Equal opportunity employer',
  },
  es: {
    title: '\u00danete al equipo de BSM', subtitle: 'Cu\u00e9ntanos sobre ti y un reclutador se comunicar\u00e1 contigo.',
    eyebrow: 'Empleos',
    name: 'Nombre completo', phone: 'Tel\u00e9fono', email: 'Correo electr\u00f3nico',
    position: 'Puestos a los que aplicas', positionHint: 'Elige hasta 3', allCats: '\u2190 Todas las categor\u00edas', jobsIn: 'puestos', selected: 'seleccionado(s)',
    licensed: '\u00bfEres guardia de seguridad con licencia?', yesLic: 'Con licencia', noLic: 'Sin licencia', licenseUpload: 'Sube tu licencia / certificado',
    state: 'Estado', city: 'Ciudad', borough: 'Condado', chooseState: 'Seleccionar\u2026', chooseBorough: 'Seleccionar condado\u2026',
    workAreas: 'Dispuesto a trabajar en (condados)', payLow: 'Pago m\u00ednimo ($/hr)', payHigh: 'Pago m\u00e1ximo ($/hr)',
    transport: '\u00bfC\u00f3mo llegar\u00e1s al trabajo?', avail: 'Disponibilidad',
    english: 'Nivel de ingl\u00e9s', basic: 'B\u00e1sico', intermediate: 'Intermedio', fluent: 'Fluido',
    source: '\u00bfC\u00f3mo supiste de nosotros?', experience: 'Brevemente, tu experiencia laboral', resume: 'Curr\u00edculum (opcional)',
    submit: 'Enviar solicitud', submitting: 'Enviando\u2026',
    smsTitle: 'Avisos por mensaje de texto',
    smsLabel: 'Acepto recibir mensajes de texto de BSM Facility Solutions sobre mi solicitud, la programaci\u00f3n de entrevistas y el estado de contrataci\u00f3n.',
    smsFine: 'Opcional \u2014 puedes aplicar sin esto. Pueden aplicarse tarifas de mensajes y datos. La frecuencia de mensajes var\u00eda. Responde STOP para cancelar o HELP para ayuda.',
    smsPrivacy: 'Pol\u00edtica de Privacidad', smsTerms: 'T\u00e9rminos SMS',
    reqCore: 'Completa nombre, tel\u00e9fono, correo y al menos un puesto.',
    reqPay: 'Ingresa tu rango de pago esperado.', payOrder: 'El pago m\u00ednimo no puede ser mayor que el m\u00e1ximo.',
    okTitle: '\u00a1Gracias!', okBody: 'Recibimos tu solicitud. Un reclutador te contactar\u00e1 pronto.',
    another: 'Enviar otra', errorMsg: 'Algo sali\u00f3 mal. Int\u00e9ntalo de nuevo.',
    optional: 'opcional', footer: 'Empleador con igualdad de oportunidades',
  },
}

const Mark = () => (
  <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" className="text-[var(--gold)]" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 28V13l7-4v19M11 28V9l9-5v24M20 28V12l8 4v12M4 28h26" />
    <path d="M7 16v2M7 21v2M14 13v2M14 18v2M14 23v2M23 18v2M23 23v2" strokeWidth="1.3" />
  </svg>
)

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
  const [smsConsent, setSmsConsent] = useState(false)   // optional, unchecked by default

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
      fd.append('sms_consent', smsConsent ? 'true' : 'false')
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
      <div className="min-h-screen bsm-app flex items-center justify-center px-4">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--gold)]/20 shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full border border-[var(--gold)] grid place-items-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--gold)]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-strong)] mb-2">{tt.okTitle}</h1>
          <p className="text-[var(--muted)] text-sm mb-6">{tt.okBody}</p>
          <button onClick={() => location.reload()} className="text-sm text-[var(--gold)] font-medium border border-[var(--gold)]/40 rounded-lg px-4 py-2 hover:bg-[var(--surface-2)]">{tt.another}</button>
        </div>
      </div>
    )
  }

  const input = 'w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-strong)] placeholder:text-[var(--faint)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)]'
  const label = 'block text-sm font-medium text-[var(--text)] mb-1'
  const pill = (on: boolean) => `text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${on ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'bg-transparent text-[var(--muted)] border-[var(--border)] hover:border-[var(--gold)]/50'}`
  const catCount = (c: Cat) => c.jobs.filter(j => has(j.n)).length

  return (
    <div className="min-h-screen bsm-app py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <div className="font-semibold text-[var(--text-strong)] leading-tight">BSM Facility Solutions</div>
              <div className="text-[10px] font-bold tracking-[.22em] uppercase text-[var(--gold)]">{tt.eyebrow}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5">
              {(['en', 'es'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${lang === l ? 'bg-[var(--gold)] text-[var(--on-gold)]' : 'text-[var(--muted)]'}`}>{l === 'en' ? 'EN' : 'ES'}</button>
              ))}
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--gold)]/18 shadow-2xl p-6">
          <h1 className="text-xl font-semibold text-[var(--text-strong)]">{tt.title}</h1>
          <div className="w-11 h-0.5 bg-[var(--gold)] mt-2.5 mb-3" />
          <p className="text-sm text-[var(--muted)] mb-5">{tt.subtitle}</p>

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
                <span className="text-xs text-[var(--faint)]">{positions.length}/{MAX_POSITIONS} · {tt.positionHint}</span>
              </div>

              {/* selected chips */}
              {positions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {positions.map(p => (
                    <span key={p} className="bg-[var(--gold)] text-[var(--on-gold)] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      {p}
                      <button type="button" onClick={() => toggleJob(p)} className="opacity-70 hover:opacity-100" aria-label="Remove">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
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
                        className={`rounded-xl border p-4 text-center transition-colors ${cc ? 'border-[var(--gold)] bg-[var(--gold)]/[.07]' : 'border-[var(--border)] hover:border-[var(--gold)]/60'}`}>
                        <div className="grid place-items-center mb-1.5">
                          <span className="w-10 h-10 rounded-full border border-[var(--gold)]/60 grid place-items-center"><CatIcon k={c.icon} /></span>
                        </div>
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{lang === 'es' ? c.es : c.name}</div>
                        <div className={`text-xs mt-0.5 ${cc ? 'text-[var(--gold)]' : 'text-[var(--faint)]'}`}>{cc ? `${cc} ${tt.selected}` : `${c.jobs.length} ${tt.jobsIn}`}</div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div>
                  <button type="button" onClick={() => setActiveCat(null)} className="text-sm text-[var(--muted)] hover:text-[var(--text-strong)] mb-3 flex items-center gap-1">{tt.allCats}</button>
                  <div className="text-sm font-semibold text-[var(--text-strong)] mb-2 flex items-center gap-2"><CatIcon k={CATS[activeCat].icon} size={18} /> {lang === 'es' ? CATS[activeCat].es : CATS[activeCat].name}</div>
                  <div className="space-y-2">
                    {CATS[activeCat].jobs.map(j => {
                      const on = has(j.n)
                      const locked = jobLocked(j)
                      return (
                        <button key={j.n} type="button" disabled={locked} onClick={() => toggleJob(j.n)}
                          className={`w-full text-left rounded-xl border p-3 transition-colors ${on ? 'border-[var(--gold)] bg-[var(--gold)]/[.07]' : locked ? 'border-[var(--border)] opacity-40 cursor-not-allowed' : 'border-[var(--border)] hover:border-[var(--gold)]/60'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded border flex-shrink-0 grid place-items-center ${on ? 'bg-[var(--gold)] border-[var(--gold)]' : 'border-[var(--border)]'}`}>
                              {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--on-gold)]" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                            </span>
                            <span className="font-medium text-sm text-[var(--text-strong)]">{j.n}</span>
                          </div>
                          <p className="text-xs text-[var(--muted)] mt-1 ml-6">
                            {lang === 'es' ? j.es : j.en}
                            {j.expReq && <span className="block text-[var(--gold)] font-medium mt-0.5">{lang === 'es' ? EXP_ES : EXP_EN}</span>}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Security license (appears once Security is selected, wherever you are) */}
              {has('Security') && (
                <div className="mt-3 border border-[var(--border)] rounded-xl p-3 bg-[var(--surface-2)]">
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--text)] mb-1.5"><CatIcon k="security" size={15} /> {tt.licensed}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSecurityLicensed('yes')} className={pill(securityLicensed === 'yes')}>{tt.yesLic}</button>
                    <button type="button" onClick={() => { setSecurityLicensed('no'); setLicense(null) }} className={pill(securityLicensed === 'no')}>{tt.noLic}</button>
                  </div>
                  {securityLicensed === 'yes' && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">{tt.licenseUpload}</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setLicense(e.target.files?.[0] || null)}
                        className="text-sm text-[var(--muted)] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--surface-2)] file:text-[var(--text)] file:text-sm" />
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
            <div><label className={label}>{tt.source} <span className="text-[var(--faint)] font-normal">({tt.optional})</span></label><input className={input} value={f.referral_source} onChange={e => set('referral_source', e.target.value)} /></div>
            <div><label className={label}>{tt.experience} <span className="text-[var(--faint)] font-normal">({tt.optional})</span></label><textarea rows={3} className={input} value={f.experience} onChange={e => set('experience', e.target.value)} /></div>
            <div>
              <label className={label}>{tt.resume}</label>
              <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setResume(e.target.files?.[0] || null)}
                className="text-sm text-[var(--muted)] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--surface-2)] file:text-[var(--text)] file:text-sm" />
            </div>

            {/* ── SMS consent (optional, unchecked by default) ── */}
            <div className="border border-[var(--border)] rounded-xl p-3.5 bg-[var(--surface-2)]">
              <div className="text-[10px] font-bold tracking-[.18em] uppercase text-[var(--gold)] mb-2">{tt.smsTitle}</div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--gold)]" />
                <span className="text-xs text-[var(--text)] leading-relaxed">{tt.smsLabel}</span>
              </label>
              <p className="text-[11px] text-[var(--faint)] leading-relaxed mt-2 ml-[26px]">
                {tt.smsFine}{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-[var(--gold)] underline">{tt.smsPrivacy}</a>
                {' · '}
                <a href="/sms-terms" target="_blank" rel="noreferrer" className="text-[var(--gold)] underline">{tt.smsTerms}</a>
              </p>
            </div>

            <input type="text" tabIndex={-1} autoComplete="off" value="" onChange={() => {}} className="hidden" aria-hidden="true" />

            {err && <p className="text-sm text-[var(--danger)] bg-[var(--raise)] border border-[var(--border)] px-3 py-2 rounded-lg">{err}</p>}
            <button onClick={submit} disabled={busy} className="w-full bg-[var(--gold)] text-[var(--on-gold)] font-semibold py-3 rounded-lg hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-50">
              {busy ? tt.submitting : tt.submit}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-[var(--faint)] mt-4">BSM Facility Solutions · {tt.footer}</p>
      </div>
    </div>
  )
}
