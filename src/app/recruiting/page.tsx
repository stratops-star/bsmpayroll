'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ShareCareers from '@/components/ShareCareers'
import RecruitingTabs from '@/components/RecruitingTabs'
import { useRecruitingChrome } from '@/components/RecruitingChrome'
import { useRecruitingLang } from '@/components/recruiting-i18n'
import { TR, t2 } from '@/lib/recruiting-data'

type Candidate = {
  id: string; created_at: string; full_name: string; phone: string | null; email: string | null
  preferred_lang: string; positions: string[] | null; state: string | null; city: string | null; borough: string | null
  work_areas: string[] | null; pay_min: number | null; pay_max: number | null; expected_pay: string | null
  transportation: string | null; availability: string | null; english_level: string | null
  referral_source: string | null; experience: string | null; strengths: string | null; security_licensed: boolean | null
  license_path: string | null; resume_path: string | null; profile_tier: string | null; intake_channel: string | null
}

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const ago = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; const d = Math.floor(h / 24); return d === 1 ? 'yesterday' : `${d}d ago` }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const MANUAL_POS = ['Garbage Porter', 'Cleaning Porter', 'Morning Garbage Porter', 'Janitorial', 'Concierge', 'Superintendent', 'Security', 'Handyman', 'Maintenance', 'Valet Parking', 'Parking Attendant', 'Nanny', 'Lease Coordinator', 'Area Supervisor', 'Operations Supervisor', 'Operations Manager', 'Sr. Operations Manager']
const BOROUGHS = ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island']
const TRANSPORT = ['Bicycle', 'Scooter', 'Train', 'Bus', 'Car']


export default function NewQueuePage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sel, setSel] = useState<Candidate | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const { setActions } = useRecruitingChrome()
  const { t, lang } = useRecruitingLang()
  const rowsRef = useRef<Candidate[]>([]); rowsRef.current = rows

  // filters
  const [q, setQ] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [F, setF] = useState<Record<string, string>>({ pos: 'all', lives: 'all', trans: 'all', lang: 'all', channel: 'all', date: 'all' })
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter'); setIsAdmin(me?.role === 'admin') }
    const { data } = await supabase.from('candidates').select('*').eq('status', 'applied').order('created_at', { ascending: false })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('queue-inserts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'candidates' }, (p: any) => {
      const c = p.new as Candidate; if (c.status !== 'applied' || rowsRef.current.some(r => r.id === c.id)) return
      setRows(rs => [c, ...rs]); setNewCount(n => n + 1)
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    setActions(
      <>
        {isAdmin && <a href="/recruiting/import" className="text-sm bg-white/10 hover:bg-white/20 text-white border border-white/15 font-medium rounded-lg px-3 py-1.5 whitespace-nowrap">⭳ {t('import')}</a>}
        {canAct && <button onClick={() => setShowAdd(true)} className="text-sm bg-[#D4A843] text-[#0D1B35] font-semibold rounded-lg px-3 py-1.5 whitespace-nowrap">+ {t('add_candidate')}</button>}
        <ShareCareers />
      </>
    )
    return () => setActions(null)
  }, [isAdmin, canAct, lang])

  function open(c: Candidate) { setSel(c); setTier(c.profile_tier); setReason('') }
  function close() { setSel(null) }
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2400) }
  async function openFile(bucket: string, path: string | null) { if (!path) return; const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  const setF1 = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const clearAll = () => { setF({ pos: 'all', lives: 'all', trans: 'all', lang: 'all', channel: 'all', date: 'all' }); setFrom(''); setTo(''); setQ('') }

  async function toInterview() { if (!sel) return; setBusy(true); const { error } = await supabase.from('candidates').update({ status: 'interview', stage: 'initial_interview', profile_tier: tier }).eq('id', sel.id); setBusy(false); if (error) { flash(t('error') + ': ' + error.message); return }; setRows(rs => rs.filter(r => r.id !== sel.id)); close(); flash(t('moved_interview')) }
  async function reject() { if (!sel) return; setBusy(true); const { error } = await supabase.from('candidates').update({ status: 'rejected', stage: 'rejected', rejected_reason: reason || null }).eq('id', sel.id); setBusy(false); if (error) { flash(t('error') + ': ' + error.message); return }; setRows(rs => rs.filter(r => r.id !== sel.id)); close(); flash(t('moved_rejected')) }

  const positions = useMemo(() => [...new Set(rows.flatMap(r => r.positions || []))].sort(), [rows])
  const channels = useMemo(() => [...new Set(rows.map(r => r.intake_channel).filter(Boolean))] as string[], [rows])
  const payText = (c: Candidate) => c.expected_pay || (c.pay_min != null && c.pay_max != null ? `$${c.pay_min}–${c.pay_max}/hr` : '—')

  function dateOk(iso: string) {
    const t = new Date(iso).getTime()
    if (F.date === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return t >= d.getTime() }
    if (F.date === '7d') return t >= Date.now() - 7 * 864e5
    if (F.date === '30d') return t >= Date.now() - 30 * 864e5
    if (from && t < new Date(from).getTime()) return false
    if (to && t > new Date(to).getTime() + 864e5) return false
    return true
  }
  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return rows.filter(c =>
      (F.pos === 'all' || (c.positions || []).includes(F.pos)) &&
      (F.lives === 'all' || c.borough === F.lives) &&
      (F.trans === 'all' || (c.transportation || '').toLowerCase().includes(F.trans.toLowerCase())) &&
      (F.lang === 'all' || c.preferred_lang === F.lang) &&
      (F.channel === 'all' || c.intake_channel === F.channel) &&
      dateOk(c.created_at) &&
      (c.full_name.toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.positions || []).join(' ').toLowerCase().includes(s))
    )
  }, [rows, q, F, from, to])

  const activeCount = Object.values(F).filter(v => v !== 'all').length + (from || to ? 1 : 0)
  const chan = (c: string) => ({ public_form: 'Public form', manual: 'Manual', asana_import: 'Asana', shared_link: 'Shared link', referral: 'Referral' } as Record<string, string>)[c] || c

  const Field = ({ k, label, opts }: { k: string; label: string; opts: [string, string][] }) => (
    <div><label className="block text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1">{label}</label>
      <select value={F[k]} onChange={e => setF1(k, e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white">{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  )

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="max-w-5xl mx-auto px-6 py-5">
        <div className="mb-4"><h1 className="text-xl font-semibold text-[#0D1B35]">{t('tab_queue')}</h1><p className="text-xs text-gray-500">{t('queue_sub')}</p></div>

        {/* filter bar */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('search_ph')} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 max-w-full" />
          <button onClick={() => setPanelOpen(o => !o)} className="flex items-center gap-2 border border-gray-200 bg-white rounded-lg px-3.5 py-2 text-sm font-semibold text-[#0D1B35]">⛃ {t('filters')} {activeCount > 0 && <span className="bg-[#D4A843] text-[#0D1B35] text-[11px] font-bold rounded-full px-1.5">{activeCount}</span>}</button>
          {(activeCount > 0 || q) && <button onClick={clearAll} className="text-xs text-gray-500 underline">{t('clear_filters')}</button>}
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />{t('live')}</span>
        </div>

        {panelOpen && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
              <Field k="pos" label={t('f_position')} opts={[['all', t('f_any_position')], ...positions.map(p => [p, p] as [string, string])]} />
              <Field k="lives" label={t('f_lives')} opts={[['all', t('f_any_borough')], ...BOROUGHS.map(b => [b, b] as [string, string])]} />
              <Field k="trans" label={t('f_transport')} opts={[['all', t('f_any_transport')], ...TRANSPORT.map(t => [t, t] as [string, string])]} />
              <Field k="lang" label={t('f_language')} opts={[['all', t('f_any_language')], ['en', t('f_english')], ['es', t('f_spanish')]]} />
              <Field k="channel" label={t('f_source')} opts={[['all', t('f_any_source')], ...channels.map(c => [c, chan(c)] as [string, string])]} />
              <Field k="date" label={t('f_date')} opts={[['all', t('f_any_time')], ['today', t('f_today')], ['7d', t('f_7d')], ['30d', t('f_30d')]]} />
              <div><label className="block text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1">{t('f_from')}</label><input type="date" value={from} onChange={e => { setFrom(e.target.value); setF1('date', 'all') }} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" /></div>
              <div><label className="block text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1">{t('f_to')}</label><input type="date" value={to} onChange={e => { setTo(e.target.value); setF1('date', 'all') }} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" /></div>
            </div>
            <div className="flex justify-end mt-3"><button onClick={clearAll} className="text-xs text-gray-500 underline">{t('clear_filters')}</button></div>
          </div>
        )}

        <RecruitingTabs newCount={newCount} />

        {loading ? <p className="text-gray-400 text-sm">{t('loading')}</p>
          : rows.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">{t('no_new_apps')}</div>
          : (<>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-semibold text-[#0D1B35]">{filtered.length}{filtered.length !== rows.length ? ` of ${rows.length}` : ''} application{rows.length > 1 ? 's' : ''}</span>
              {newCount > 0 && <span className="text-xs text-[#8A6D1E] bg-[#F3E4BE] px-2 py-0.5 rounded-full">{newCount} arrived just now</span>}
            </div>
            {filtered.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">No applications match these filters.</div>
              : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
                {filtered.map(c => (
                  <button key={c.id} onClick={() => open(c)} className="text-left bg-white border border-gray-200 border-l-[3px] border-l-[#D4A843] rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: hue(c.email || c.full_name) }}>{ini(c.full_name)}</span>
                      <div><div className="font-semibold text-[#0D1B35]">{c.full_name}</div><div className="text-xs text-gray-500">{[c.borough, c.city, c.state].filter(Boolean).join(', ') || '—'}</div></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">{(c.positions || []).slice(0, 3).map(p => <span key={p} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p}</span>)}</div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-100 pt-2.5"><span>{c.preferred_lang === 'es' ? '🇪🇸' : '🇺🇸'} · {payText(c)} · {fmtDate(c.created_at)}</span><span>{ago(c.created_at)}</span></div>
                  </button>
                ))}
              </div>}
          </>)}
      </div>

      {sel && (
        <>
          <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={close} />
          <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-white z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 relative">
              <button onClick={close} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
              <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold" style={{ background: hue(sel.email || sel.full_name) }}>{ini(sel.full_name)}</span>
                <div><h2 className="text-lg font-semibold text-[#0D1B35]">{sel.full_name}</h2><div className="text-xs text-gray-500">{ago(sel.created_at)} · {sel.preferred_lang === 'es' ? 'Español' : 'English'}</div></div></div>
            </div>
            <div className="overflow-auto flex-1">
              {canAct ? (
                <Sec title={t('initial_review')}>
                  <div className="text-xs text-gray-500 mb-1.5">{t('profile_tier')}</div>
                  <div className="flex gap-2 mb-3">{['high', 'medium', 'low'].map(tk => <button key={tk} onClick={() => setTier(tk)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${tier === tk ? 'bg-[#D4A843] border-[#D4A843] text-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{tk}</button>)}</div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={toInterview} className="flex-1 bg-[#0D1B35] text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">📅 {t('send_interview')}</button>
                    <button disabled={busy} onClick={reject} className="flex-1 bg-white border border-red-200 text-red-600 text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">✕ {t('reject')}</button>
                  </div>
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('reject_reason_ph')} className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                </Sec>
              ) : <Sec title={t('view_only')}><p className="text-xs text-gray-500">{t('view_only_msg')}</p></Sec>}
              <Sec title={t('s_applied_for')}>
                <div className="flex flex-wrap gap-1.5">{(sel.positions || []).map(p => <span key={p} className="text-xs bg-[#0D1B35]/5 text-[#0D1B35] font-medium px-2.5 py-1 rounded-full">{p}</span>)}</div>
                {sel.positions?.includes('Security') && <div className="mt-2 text-xs">{t('sec_license')}: <b>{sel.security_licensed === true ? t('licensed') : sel.security_licensed === false ? t('unlicensed') : '—'}</b>{sel.license_path && <button onClick={() => openFile('candidate-licenses', sel.license_path)} className="ml-2 text-blue-600 font-medium">{t('view_license')}</button>}</div>}
              </Sec>
              <Sec title={t('s_contact')}><Rw k={t('l_phone')} v={sel.phone} /><Rw k={t('l_email')} v={sel.email} /><Rw k={t('f_source')} v={sel.intake_channel ? chan(sel.intake_channel) : null} /></Sec>
              <Sec title={t('s_job_fit')}><Rw k={t('l_expected_pay')} v={payText(sel)} /><Rw k={t('l_availability')} v={sel.availability} /><Rw k={t('l_transportation')} v={sel.transportation} /><Rw k={t('l_english')} v={sel.english_level} /></Sec>
              <Sec title={t('s_location')}><Rw k={t('l_lives_in')} v={[sel.borough, sel.city, sel.state].filter(Boolean).join(', ')} /><Rw k={t('l_open_to')} v={(sel.work_areas || []).join(', ')} /></Sec>
              {sel.experience && <Sec title={t('s_experience')}><p className="text-xs text-gray-600 leading-relaxed bg-[#F5F6FA] rounded-lg p-3 whitespace-pre-line">{sel.experience}</p></Sec>}
              {sel.strengths && <Sec title="Strengths"><p className="text-xs text-gray-600 leading-relaxed">{sel.strengths}</p></Sec>}
              <Sec title={t('s_source_files')}><Rw k={t('l_heard_via')} v={sel.referral_source} />{sel.resume_path ? <button onClick={() => openFile('candidate-resumes', sel.resume_path)} className="mt-1 inline-flex items-center gap-2 bg-[#F5F6FA] border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-[#0D1B35]"><span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PDF</span> {t('view_resume')}</button> : <div className="text-xs text-gray-400 mt-1">{t('no_resume')}</div>}</Sec>
            </div>
          </aside>
        </>
      )}

      {showAdd && <AddCandidate supabase={supabase} onClose={() => setShowAdd(false)} onAdded={(c) => { setRows(rs => [c, ...rs]); setShowAdd(false); flash(t('add_candidate')) }} />}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}

function AddCandidate({ supabase, onClose, onAdded }: { supabase: any; onClose: () => void; onAdded: (c: Candidate) => void }) {
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const [f, setF] = useState({ full_name: '', phone: '', email: '', borough: '', pay_min: '', pay_max: '', english_level: '', availability: '', experience: '' })
  const [positions, setPositions] = useState<string[]>([]); const [trans, setTrans] = useState<string[]>([]); const [lic, setLic] = useState<'' | 'yes' | 'no'>('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const toggle = (arr: string[], s: any, v: string) => s(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'
  const pill = (on: boolean) => `text-xs font-medium px-3 py-1.5 rounded-full border ${on ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200'}`
  const L = (x: any) => t2(x, lang)
  const star = <span className="text-red-500">*</span>
  async function submit() {
    setErr('')
    const missing = !f.full_name || !f.phone || !f.email || positions.length === 0 || !f.borough || !f.english_level || !f.pay_min || !f.pay_max || trans.length === 0 || !f.availability || (positions.includes('Security') && !lic)
    if (missing) { setErr(L(TR.fillRequired)); return }
    if (!/^\S+@\S+\.\S+$/.test(f.email)) { setErr(lang === 'es' ? 'Correo electrónico inválido.' : 'Please enter a valid email.'); return }
    setBusy(true); const payMin = Number(f.pay_min), payMax = Number(f.pay_max)
    const { data, error } = await supabase.from('candidates').insert({ intake_channel: 'manual', status: 'applied', stage: 'applied', in_pool: false, full_name: f.full_name, phone: f.phone, email: f.email, preferred_lang: lang, positions, state: 'NY', borough: f.borough, pay_min: payMin, pay_max: payMax, expected_pay: `$${payMin}–${payMax}/hr`, transportation: trans.join(', '), availability: f.availability, english_level: f.english_level, experience: f.experience || null, security_licensed: positions.includes('Security') ? (lic === 'yes' ? true : lic === 'no' ? false : null) : null }).select().single()
    setBusy(false); if (error) { setErr(error.message); return }; onAdded(data as Candidate)
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#0D1B35]">{L(TR.addCandidate)}</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">{(['en', 'es'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={`text-xs font-semibold px-2 py-1 rounded-md ${lang === l ? 'bg-[#0D1B35] text-white' : 'text-gray-500'}`}>{l.toUpperCase()}</button>)}</div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
          </div>
        </div>
        <div className="space-y-3">
          <input className={input} placeholder={`${L(TR.fullName)} *`} value={f.full_name} onChange={e => set('full_name', e.target.value)} />
          <div className="grid grid-cols-2 gap-3"><input className={input} placeholder={`${L(TR.phone)} *`} value={f.phone} onChange={e => set('phone', e.target.value)} /><input className={input} placeholder={`${L(TR.email)} *`} value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div><div className="text-xs font-semibold text-gray-500 mb-1.5">{L(TR.positions)} {star}</div><div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-1">{MANUAL_POS.map(p => <button key={p} type="button" onClick={() => toggle(positions, setPositions, p)} className={pill(positions.includes(p))}>{p}</button>)}</div></div>
          {positions.includes('Security') && <div><div className="text-xs font-semibold text-gray-500 mb-1.5">Security license {star}</div><div className="flex gap-2"><button type="button" onClick={() => setLic('yes')} className={pill(lic === 'yes')}>Licensed</button><button type="button" onClick={() => setLic('no')} className={pill(lic === 'no')}>Unlicensed</button></div></div>}
          <div className="grid grid-cols-2 gap-3"><select className={input} value={f.borough} onChange={e => set('borough', e.target.value)}><option value="">{L(TR.selectBorough)} *</option>{BOROUGHS.map(b => <option key={b} value={b}>{b}</option>)}</select><select className={input} value={f.english_level} onChange={e => set('english_level', e.target.value)}><option value="">{L(TR.selectEnglish)} *</option><option>Basic</option><option>Intermediate</option><option>Fluent</option></select></div>
          <div className="grid grid-cols-2 gap-3"><input type="number" className={input} placeholder={`${L(TR.payMin)} *`} value={f.pay_min} onChange={e => set('pay_min', e.target.value)} /><input type="number" className={input} placeholder={`${L(TR.payMax)} *`} value={f.pay_max} onChange={e => set('pay_max', e.target.value)} /></div>
          <div><div className="text-xs font-semibold text-gray-500 mb-1.5">{L(TR.transportation)} {star}</div><div className="flex flex-wrap gap-1.5">{TRANSPORT.map(t => <button key={t} type="button" onClick={() => toggle(trans, setTrans, t)} className={pill(trans.includes(t))}>{t}</button>)}</div></div>
          <select className={input} value={f.availability} onChange={e => set('availability', e.target.value)}><option value="">{L(TR.selectAvailability)} *</option><option>Weekdays</option><option>Weekends & Holidays</option><option>All</option></select>
          <textarea rows={2} className={input} placeholder={L(TR.notes)} value={f.experience} onChange={e => set('experience', e.target.value)} />
          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <button disabled={busy} onClick={submit} className="w-full bg-[#D4A843] text-[#0D1B35] font-semibold py-2.5 rounded-lg disabled:opacity-50">{busy ? '…' : L(TR.addToQueue)}</button>
        </div>
      </div>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) { return <div className="p-5 border-b border-gray-100"><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">{title}</div>{children}</div> }
function Rw({ k, v }: { k: string; v: string | null | undefined }) { return <div className="flex justify-between gap-3 py-1 text-[13px]"><span className="text-gray-500">{k}</span><span className="text-gray-800 font-medium text-right">{v || '—'}</span></div> }
