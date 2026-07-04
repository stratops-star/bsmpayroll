'use client'

import { useState } from 'react'

const POSITIONS = [
  'Porter', 'Concierge', 'Superintendent', 'Security', 'Nanny', 'Lease Coordinator',
  'Handyman', 'Operations Manager', 'Valet Parking', 'Janitorial', 'Maintenance', 'Parking Attendant',
]

type Lang = 'en' | 'es'

const S: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Join the BSM team',
    subtitle: 'Tell us about yourself and a recruiter will reach out.',
    name: 'Full name', phone: 'Phone', email: 'Email',
    position: 'Position you\u2019re applying for', choose: 'Choose a position\u2026',
    location: 'Where do you live? (borough / area)',
    pay: 'Expected pay (e.g. $18\u201322/hr)',
    english: 'English level', basic: 'Basic', intermediate: 'Intermediate', fluent: 'Fluent',
    source: 'How did you hear about us?',
    experience: 'Briefly, your work experience',
    resume: 'Résumé (optional)',
    submit: 'Submit application', submitting: 'Submitting\u2026',
    required: 'Please fill in name, phone, email, and position.',
    okTitle: 'Thank you!', okBody: 'We received your application. A recruiter will contact you soon.',
    another: 'Submit another', errorMsg: 'Something went wrong. Please try again.',
  },
  es: {
    title: '\u00danete al equipo de BSM',
    subtitle: 'Cu\u00e9ntanos sobre ti y un reclutador se comunicar\u00e1 contigo.',
    name: 'Nombre completo', phone: 'Tel\u00e9fono', email: 'Correo electr\u00f3nico',
    position: 'Puesto al que aplicas', choose: 'Elige un puesto\u2026',
    location: '\u00bfD\u00f3nde vives? (condado / \u00e1rea)',
    pay: 'Pago esperado (ej. $18\u201322/hr)',
    english: 'Nivel de ingl\u00e9s', basic: 'B\u00e1sico', intermediate: 'Intermedio', fluent: 'Fluido',
    source: '\u00bfC\u00f3mo supiste de nosotros?',
    experience: 'Brevemente, tu experiencia laboral',
    resume: 'Curr\u00edculum (opcional)',
    submit: 'Enviar solicitud', submitting: 'Enviando\u2026',
    required: 'Por favor completa nombre, tel\u00e9fono, correo y puesto.',
    okTitle: '\u00a1Gracias!', okBody: 'Recibimos tu solicitud. Un reclutador te contactar\u00e1 pronto.',
    another: 'Enviar otra', errorMsg: 'Algo sali\u00f3 mal. Int\u00e9ntalo de nuevo.',
  },
}

export default function CareersPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', position: '', location: '',
    expected_pay: '', english_level: '', referral_source: '', experience: '',
  })
  const [resume, setResume] = useState<File | null>(null)
  const tt = S[lang]

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    setErr('')
    if (!form.full_name || !form.phone || !form.email || !form.position) { setErr(tt.required); return }
    setBusy(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('preferred_lang', lang)
      fd.append('company', '') // honeypot (must stay empty)
      if (resume) fd.append('resume', resume)
      const res = await fetch('/api/apply', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setErr(tt.errorMsg)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 text-2xl grid place-items-center mx-auto mb-4">✓</div>
          <h1 className="text-xl font-semibold text-[#0D1B35] mb-2">{tt.okTitle}</h1>
          <p className="text-gray-500 text-sm mb-6">{tt.okBody}</p>
          <button onClick={() => { setDone(false); setForm({ full_name: '', phone: '', email: '', position: '', location: '', expected_pay: '', english_level: '', referral_source: '', experience: '' }); setResume(null) }}
            className="text-sm text-[#0D1B35] font-medium border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
            {tt.another}
          </button>
        </div>
      </div>
    )
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]'
  const label = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="min-h-screen bg-[#F5F6FA] py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D1B35] grid place-items-center text-[#D4A843] font-bold text-lg">B</div>
            <div>
              <div className="font-semibold text-[#0D1B35] leading-tight">BSM Facility Solutions</div>
              <div className="text-xs text-gray-400">Careers</div>
            </div>
          </div>
          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
            {(['en', 'es'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md ${lang === l ? 'bg-[#0D1B35] text-white' : 'text-gray-500'}`}>
                {l === 'en' ? 'EN' : 'ES'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-semibold text-[#0D1B35]">{tt.title}</h1>
          <p className="text-sm text-gray-500 mt-1 mb-5">{tt.subtitle}</p>

          <div className="space-y-4">
            <div><label className={label}>{tt.name} *</label><input className={input} value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>{tt.phone} *</label><input className={input} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div><label className={label}>{tt.email} *</label><input type="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>{tt.position} *</label>
              <select className={input} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">{tt.choose}</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>{tt.location}</label><input className={input} value={form.location} onChange={e => set('location', e.target.value)} /></div>
              <div><label className={label}>{tt.pay}</label><input className={input} value={form.expected_pay} onChange={e => set('expected_pay', e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>{tt.english}</label>
              <select className={input} value={form.english_level} onChange={e => set('english_level', e.target.value)}>
                <option value=""></option>
                <option value="Basic">{tt.basic}</option>
                <option value="Intermediate">{tt.intermediate}</option>
                <option value="Fluent">{tt.fluent}</option>
              </select>
            </div>
            <div><label className={label}>{tt.source}</label><input className={input} value={form.referral_source} onChange={e => set('referral_source', e.target.value)} /></div>
            <div><label className={label}>{tt.experience}</label><textarea rows={3} className={input} value={form.experience} onChange={e => set('experience', e.target.value)} /></div>
            <div>
              <label className={label}>{tt.resume}</label>
              <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setResume(e.target.files?.[0] || null)}
                className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-200 file:bg-gray-50 file:text-gray-700 file:text-sm" />
            </div>

            {/* honeypot — hidden from users, catches bots */}
            <input type="text" name="company" tabIndex={-1} autoComplete="off"
              value="" onChange={() => {}} className="hidden" aria-hidden="true" />

            {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}

            <button onClick={submit} disabled={busy}
              className="w-full bg-[#D4A843] text-[#0D1B35] font-semibold py-3 rounded-lg hover:bg-[#C49A38] transition-colors disabled:opacity-50">
              {busy ? tt.submitting : tt.submit}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">BSM Facility Solutions · Equal opportunity employer</p>
      </div>
    </div>
  )
}
