'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ShareCareers from '@/components/ShareCareers'
import { useRecruitingChrome } from '@/components/RecruitingChrome'
import RecruitingTabs from '@/components/RecruitingTabs'
import { useRecruitingLang, SourceBadge } from '@/components/recruiting-i18n'
import { SearchSelect, YearsMonths } from '@/components/SearchSelect'
import { NATIONALITIES, ETHNICITIES } from '@/lib/recruiting-data'

type Candidate = {
  id: string; created_at: string; full_name: string; phone: string | null; email: string | null
  preferred_lang: string; positions: string[] | null; state: string | null; city: string | null; borough: string | null
  work_areas: string[] | null; pay_min: number | null; pay_max: number | null; expected_pay: string | null
  transportation: string | null; availability: string | null; english_level: string | null
  referral_source: string | null; experience: string | null; strengths: string | null; security_licensed: boolean | null
  license_path: string | null; resume_path: string | null; photo_path: string | null; video_path: string | null
  profile_tier: string | null; stage: string; asana_url: string | null; intake_channel: string | null; man_power_request_id: string | null
  gender: string | null; age: number | null; nationality: string | null; ethnicity: string | null
  time_in_usa: string | null; has_tax_id: boolean | null; has_ss: boolean | null; has_bank_account: boolean | null
}

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const STAGES = ['available', '2nd_interview', 'offer', 'hired']
const stageLabel: Record<string, string> = { available: 'Available', '2nd_interview': '2nd Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' }
const BOROUGHS = ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island']
const TRANSPORT = ['Bicycle', 'Scooter', 'Train', 'Bus', 'Car']
const ALL_POSITIONS = ['Garbage Porter', 'Cleaning Porter', 'Morning Garbage Porter', 'Janitorial', 'Concierge', 'Superintendent', 'Security (Licensed)', 'Security (Unlicensed)', 'Handyman', 'Maintenance', 'Valet Parking', 'Parking Attendant', 'Nanny', 'Lease Coordinator', 'Area Supervisor', 'Operations Supervisor', 'Operations Manager', 'Sr. Operations Manager']
const POS_EDIT = ['Garbage Porter', 'Cleaning Porter', 'Morning Garbage Porter', 'Porter', 'Janitorial', 'Concierge', 'Superintendent', 'Security', 'Handyman', 'Maintenance', 'Valet Parking', 'Parking Attendant', 'Nanny', 'Lease Coordinator', 'Area Supervisor', 'Operations Supervisor', 'Operations Manager', 'Sr. Operations Manager']

const daysIn = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const funnelColor = (d: number) => d > 21 ? 'bg-red-50 text-red-600' : d > 7 ? 'bg-amber-50 text-amber-700' : 'bg-[var(--raise)] text-[var(--muted)]'
const yn = (b: boolean | null) => b === true ? 'Yes' : b === false ? 'No' : '—'
// Grid/panel render a small transformed thumbnail (fast); the lightbox loads the original.
const THUMB = { width: 400, height: 400, resize: 'cover' as const, quality: 72 }

const FILTERS = [
  { key: 'tier', label: 'Tier', opts: [['all', 'All tiers'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
  { key: 'stage', label: 'Stage', opts: [['all', 'All stages'], ...STAGES.map(s => [s, stageLabel[s]])] },
  { key: 'gender', label: 'Gender', opts: [['all', 'Any gender'], ['female', 'Female'], ['male', 'Male'], ['other', 'Other']] },
  { key: 'age', label: 'Age', opts: [['all', 'Any age'], ['u30', 'Under 30'], ['30-45', '30–45'], ['45p', '45+']] },
  { key: 'trans', label: 'Transportation', opts: [['all', 'Any transport'], ...TRANSPORT.map(t => [t, t])] },
  { key: 'lives', label: 'Lives in', opts: [['all', 'Any borough'], ...BOROUGHS.map(b => [b, b])] },
  { key: 'open', label: 'Open to work', opts: [['all', 'Any borough'], ...BOROUGHS.map(b => [b, b])] },
  { key: 'pos', label: 'Position', opts: [['all', 'All positions'], ...ALL_POSITIONS.map(p => [p, p])] },
  { key: 'resume', label: 'Résumé', opts: [['all', 'Any'], ['yes', 'Has résumé'], ['no', 'No résumé']] },
  { key: 'video', label: 'Video', opts: [['all', 'Any'], ['yes', 'Has video'], ['no', 'No video']] },
  { key: 'profile', label: 'Profile', opts: [['all', 'All'], ['missing', 'Missing info'], ['complete', 'Complete']] },
] as const

const REQUIRED: [keyof Candidate, string][] = [['phone', 'Phone'], ['email', 'Email'], ['positions', 'Position'], ['expected_pay', 'Pay'], ['transportation', 'Transportation'], ['english_level', 'English'], ['borough', 'Borough']]
function missingFields(c: Candidate): string[] {
  return REQUIRED.filter(([k]) => { const v = (c as any)[k]; return Array.isArray(v) ? v.length === 0 : v == null || v === '' }).map(([, label]) => label)
}

export default function PoolBoard({ standalone = false, canAssign: canAssignProp = true }: { standalone?: boolean; canAssign?: boolean }) {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [canAssign, setCanAssign] = useState(false)
  const [gate, setGate] = useState<'ok' | 'pending' | 'denied'>('ok')
  const [meName, setMeName] = useState('')
  const [sel, setSel] = useState<Candidate | null>(null)
  const [media, setMedia] = useState<{ photo?: string; video?: string; resume?: string }>({})
  const [reqs, setReqs] = useState<{ id: string; seq: number; supervisor_name: string | null; department: string | null; site: string | null; status: string; gender_pref: string | null; transportation: string | null; position: string | null }[]>([])
  const [assignReq, setAssignReq] = useState('')
  const reqMap = useMemo(() => Object.fromEntries(reqs.map(r => [r.id, r])), [reqs])
  const reqLabel = (r: any) => { if (!r) return ''; const g = r.gender_pref === 'female' ? 'Female' : r.gender_pref === 'male' ? 'Male' : 'Any'; const tr = r.transportation ? r.transportation.charAt(0).toUpperCase() + r.transportation.slice(1) : '—'; const mgr = (r.supervisor_name || '').split(' — ')[0] || '—'; return `#${r.seq} · ${g} · ${tr} · ${r.position || '—'} · ${mgr}` }
  const [editPos, setEditPos] = useState(false)
  const [toast, setToast] = useState('')
  const [q, setQ] = useState('')
  const [F, setF] = useState<Record<string, string>>({ tier: 'all', stage: 'all', gender: 'all', age: 'all', trans: 'all', lives: 'all', open: 'all', pos: 'all', resume: 'all', video: 'all', profile: 'all' })
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState<'list' | 'photos'>('list')
  const [sort, setSort] = useState<'recent' | 'longest'>('recent')
  const [lightbox, setLightbox] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let role = ''
    if (user) { const { data: me } = await supabase.from('app_users').select('role, full_name, email, approved, active').eq('id', user.id).single(); role = me?.role || ''; setMeName(me?.full_name || me?.email || ''); if (standalone && (!me || !me.approved || !me.active || !['pool', 'recruiter', 'admin'].includes(role))) { setGate('pending'); setLoading(false); return } }
    else if (standalone) { setGate('denied'); setLoading(false); return }
    setCanAct(role === 'admin' || role === 'recruiter' || role === 'pool')
    setCanAssign(canAssignProp && (role === 'admin' || role === 'recruiter'))
    const { data } = await supabase.from('candidates').select('*').eq('status', 'in_pool').order('created_at', { ascending: false })
    const list = data ?? []; setRows(list); setLoading(false)
    const map: Record<string, string> = {}
    await Promise.all(list.filter((c: Candidate) => c.photo_path).map(async (c: Candidate) => { const { data: s } = await supabase.storage.from('candidate-photos').createSignedUrl(c.photo_path!, 600, { transform: THUMB }); if (s?.signedUrl) map[c.id] = s.signedUrl }))
    setPhotos(map)
    if (canAssignProp) { const { data: rq } = await supabase.from('man_power_requests').select('id,seq,supervisor_name,department,site,status,gender_pref,transportation,position').order('seq', { ascending: false }); setReqs(rq ?? []) }
  }
  useEffect(() => { load() }, [])
  const { setActions } = useRecruitingChrome()
  const { t, lang, setLang } = useRecruitingLang()
  useEffect(() => { if (!standalone) { setActions(<ShareCareers />); return () => setActions(null) } }, [])
  useEffect(() => { if (!lightbox) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [lightbox])

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200) }
  const setF1 = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const clearAll = () => { setF({ tier: 'all', stage: 'all', gender: 'all', age: 'all', trans: 'all', lives: 'all', open: 'all', pos: 'all', resume: 'all', video: 'all', profile: 'all' }); setQ('') }
  const activeCount = Object.values(F).filter(v => v !== 'all').length
  const payText = (c: Candidate) => c.expected_pay || (c.pay_min != null && c.pay_max != null ? `$${c.pay_min}–${c.pay_max}/hr` : '—')
  const ageOk = (a: number | null) => F.age === 'all' || (a != null && ((F.age === 'u30' && a < 30) || (F.age === '30-45' && a >= 30 && a <= 45) || (F.age === '45p' && a > 45)))
  function posOk(c: Candidate) { if (F.pos === 'all') return true; const p = c.positions || []; if (F.pos === 'Security (Licensed)') return p.includes('Security') && c.security_licensed === true; if (F.pos === 'Security (Unlicensed)') return p.includes('Security') && c.security_licensed === false; return p.includes(F.pos) }

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    const out = rows.filter(c => (F.tier === 'all' || c.profile_tier === F.tier) && (F.stage === 'all' || c.stage === F.stage) && (F.gender === 'all' || c.gender === F.gender) && ageOk(c.age) && (F.trans === 'all' || (c.transportation || '').toLowerCase().includes(F.trans.toLowerCase())) && (F.lives === 'all' || c.borough === F.lives) && (F.open === 'all' || (c.work_areas || []).includes(F.open)) && posOk(c) && (F.resume === 'all' || (F.resume === 'yes' ? !!c.resume_path : !c.resume_path)) && (F.video === 'all' || (F.video === 'yes' ? !!c.video_path : !c.video_path)) && (F.profile === 'all' || (F.profile === 'missing' ? missingFields(c).length > 0 : missingFields(c).length === 0)) && (c.full_name.toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.positions || []).join(' ').toLowerCase().includes(s)))
    return out.sort((a, b) => sort === 'recent' ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [rows, q, F, sort])

  async function openFile(bucket: string, path: string | null) { if (!path) return; const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  // Lightbox: sign the ORIGINAL (no transform) on demand and show it full-size.
  async function openPhoto(path: string | null | undefined) { if (!path) return; const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(path, 600); if (data?.signedUrl) setLightbox(data.signedUrl) }
  // If Supabase image transforms aren't enabled, the thumbnail URL 404s — fall back to the untransformed original so photos still show.
  async function photoFallback(id: string, path: string | null | undefined) { if (!path) return; const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(path, 600); if (data?.signedUrl) setPhotos(p => (p[id] === data.signedUrl ? p : { ...p, [id]: data.signedUrl })) }
  async function save(patch: Partial<Candidate>) { if (!sel) return; const { error } = await supabase.from('candidates').update(patch).eq('id', sel.id); if (error) { flash(t('error') + ': ' + error.message); return }; const u = { ...sel, ...patch }; setSel(u); setRows(rs => rs.map(r => r.id === sel.id ? u : r)); flash(t('saved')) }

  async function assignToRequest() {
    if (!sel || !assignReq) return
    const { count } = await supabase.from('man_power_assignments').select('id', { count: 'exact', head: true }).eq('request_id', assignReq).in('status', ['assigned', 'selected'])
    if ((count ?? 0) >= 8) { flash(t('cap_reached')); return }
    const { error } = await supabase.from('man_power_assignments').insert({ request_id: assignReq, candidate_id: sel.id, status: 'assigned' })
    if (error) { flash(t('error') + ': ' + error.message); return }
    await supabase.from('candidates').update({ man_power_request_id: assignReq }).eq('id', sel.id)
    const u = { ...sel, man_power_request_id: assignReq }; setSel(u); setRows(rs => rs.map(r => r.id === sel.id ? u : r)); setAssignReq(''); flash(t('assigned_toast'))
  }
  async function unassignRequest() {
    if (!sel || !sel.man_power_request_id) return
    await supabase.from('man_power_assignments').update({ status: 'removed' }).eq('candidate_id', sel.id).eq('status', 'assigned')
    await supabase.from('candidates').update({ man_power_request_id: null }).eq('id', sel.id)
    const u = { ...sel, man_power_request_id: null }; setSel(u); setRows(rs => rs.map(r => r.id === sel.id ? u : r)); flash(t('remove'))
  }

  async function notInterested() {
    if (!sel) return
    const { error } = await supabase.from('candidates').update({ status: 'rejected', stage: 'rejected', rejected_reason: 'No longer interested' }).eq('id', sel.id)
    if (error) { flash(t('error') + ': ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash(t('moved_rejected'))
  }

  async function signed(bucket: string, path: string | null) { if (!path) return undefined; const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600); return data?.signedUrl }
  async function openCand(c: Candidate) {
    setSel(c); setEditPos(false)
    setMedia({ photo: photos[c.id], video: await signed('candidate-videos', c.video_path), resume: await signed('candidate-resumes', c.resume_path) })
  }
  async function uploadMedia(kind: 'photo' | 'video' | 'resume', file: File | null) {
    if (!sel || !file) return
    const bucket = kind === 'photo' ? 'candidate-photos' : kind === 'video' ? 'candidate-videos' : 'candidate-resumes'
    const col = kind === 'photo' ? 'photo_path' : kind === 'video' ? 'video_path' : 'resume_path'
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${sel.id}-${kind}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) { flash((lang==='es'?'Error al subir: ':'Upload failed: ') + error.message); return }
    await save({ [col]: path } as any)
    const url = await signed(bucket, path)
    setMedia(m => ({ ...m, [kind]: url }))
    if (kind === 'photo' && url) setPhotos(p => ({ ...p, [sel.id]: url }))
  }
  function togglePos(p: string) {
    if (!sel) return
    const cur = sel.positions || []
    save({ positions: cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p] } as any)
  }

  const tierPill = (t: string | null) => { const c = t === 'high' ? 'bg-[#F3E4BE] text-[#8A6D1E]' : t === 'medium' ? 'bg-blue-100 text-blue-800' : t === 'low' ? 'bg-[var(--raise)] text-[var(--muted)]' : 'bg-red-50 text-red-600'; return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${c}`}>{t || '—'}</span> }
  const chipLabel = (v: string) => ({ u30: 'Under 30', '30-45': '30–45', '45p': '45+' } as Record<string, string>)[v] || stageLabel[v] || (v[0].toUpperCase() + v.slice(1))
  const FLABEL: Record<string, string> = { tier: t('tier'), stage: t('stage'), gender: t('f_gender'), age: t('f_age'), trans: t('f_transport'), lives: t('f_lives'), open: t('f_open'), pos: t('f_position'), resume: t('f_resume'), video: t('f_video'), profile: t('f_profile') }

  if (standalone && gate !== 'ok') return <div className="min-h-screen grid place-items-center bg-[var(--raise)] p-6"><div className="bg-[var(--surface)] rounded-2xl p-8 max-w-md text-center shadow-xl border-t-4 border-[var(--gold)]"><div className="mb-3 grid place-items-center text-[var(--gold)]">{gate === 'pending' ? <Ico d="clock" size={38} sw={1.4} /> : <Ico d="lock" size={38} sw={1.4} />}</div><h1 className="text-lg font-bold text-[var(--text)]">{gate === 'pending' ? 'Access pending approval' : 'Sign in required'}</h1><p className="text-sm text-[var(--muted)] mt-2">{gate === 'pending' ? 'An administrator needs to grant you pool access.' : 'Please sign in to continue.'}</p></div></div>

  return (
    <div className="min-h-screen bsm-app">
      {standalone && (
        <div className="bg-[var(--gold)] text-[var(--on-gold)] px-6 py-3 border-b-[3px] border-[var(--gold)]">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg grid place-items-center font-bold text-sm bg-[var(--gold)] text-[var(--on-gold)]">B</span>
            <div className="flex-1"><div className="text-sm font-semibold">{t('tab_pool')}</div><div className="text-[11px] text-white/50">{meName}</div></div>
            <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-xs bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] border border-white/15 rounded-lg px-2.5 py-1.5 font-medium">{lang === 'es' ? 'EN' : 'ES'}</button>
            <button onClick={async () => { await supabase.auth.signOut(); location.href = '/login' }} className="text-xs text-white/50 hover:text-white">{t('sign_out')}</button>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="mb-4"><h1 className="text-xl font-semibold text-[var(--text-strong)]">{t('tab_pool')}</h1><p className="text-xs text-[var(--muted)]">{t('pool_sub')}</p></div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('search_ph')} className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm w-72 max-w-full" />
          <button onClick={() => setPanelOpen(o => !o)} className="flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--text)]"><span className="inline-flex items-center gap-1.5"><Ico d="filter" size={15} /> {t('filters')}</span> {activeCount > 0 && <span className="bg-[var(--gold)] text-[var(--on-gold)] text-[11px] font-bold rounded-full px-1.5">{activeCount}</span>}</button>
          <select value={sort} onChange={e => setSort(e.target.value as any)} className="border border-[var(--border)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm text-[var(--muted)]"><option value="recent">{t('sort_recent')}</option><option value="longest">{t('sort_longest')}</option></select>
          {(() => { const n = rows.filter(c => missingFields(c).length > 0).length; return <button onClick={() => setF1('profile', F.profile === 'missing' ? 'all' : 'missing')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold border ${F.profile === 'missing' ? 'bg-amber-500 text-white border-amber-500' : 'bg-[var(--surface)] text-amber-700 border-amber-200'}`}><span className="inline-flex items-center gap-1.5"><Ico d="warn" size={14} /> {t('missing_info')}</span>{n > 0 && <span className={`text-[11px] font-bold rounded-full px-1.5 ${F.profile === 'missing' ? 'bg-[color-mix(in_srgb,var(--gold)_25%,transparent)]' : 'bg-amber-100'}`}>{n}</span>}</button> })()}
          <div className="ml-auto flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5">{(['list', 'photos'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${view === v ? 'bg-[var(--gold)] text-[var(--on-gold)]' : 'text-[var(--muted)]'}`}><span className="inline-flex items-center gap-1.5">{v === 'list' ? <Ico d="list" size={13} /> : <Ico d="grid" size={13} />}{v === 'list' ? t('list') : t('photos')}</span></button>)}</div>
        </div>

        {activeCount > 0 && <div className="flex flex-wrap gap-2 mb-3 items-center">{Object.entries(F).filter(([, v]) => v !== 'all').map(([k, v]) => <span key={k} className="bg-[var(--gold)] text-[var(--on-gold)] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">{FLABEL[k] || FILTERS.find(f => f.key === k)?.label}: {chipLabel(v)}<button onClick={() => setF1(k, 'all')} className="opacity-70"><Ico d="x" size={13} sw={2.2} /></button></span>)}<button onClick={clearAll} className="text-xs text-[var(--muted)] underline">{t('clear_filters')}</button></div>}

        {panelOpen && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
              {FILTERS.map(f => <div key={f.key}><label className="block text-[11px] uppercase tracking-wide text-[var(--muted)] font-bold mb-1">{FLABEL[f.key] || f.label}</label><select value={F[f.key]} onChange={e => setF1(f.key, e.target.value)} className="w-full border border-[var(--border)] rounded-lg px-2.5 py-2 text-sm bg-[var(--surface)]">{f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>)}
            </div>
            <div className="flex justify-end mt-3"><button onClick={clearAll} className="text-xs text-[var(--muted)] underline">{t('clear_filters')}</button></div>
          </div>
        )}

        {!standalone && <RecruitingTabs />}


        {loading ? <p className="text-[var(--faint)] text-sm">Loading…</p>
          : filtered.length === 0 ? <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center text-[var(--muted)]">{lang === 'es' ? 'Ningún candidato coincide con estos filtros.' : 'No candidates match these filters.'}</div>
          : view === 'photos' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
              {filtered.map(c => { const d = daysIn(c.created_at); return (
                <div key={c.id} role="button" tabIndex={0} onClick={() => openCand(c)} className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className="h-36 grid place-items-center text-white text-3xl font-semibold relative" style={{ background: hue(c.email || c.full_name) }}>{photos[c.id] ? <img src={photos[c.id]} alt="" loading="lazy" decoding="async" onError={() => photoFallback(c.id, c.photo_path)} className="w-full h-full object-cover" /> : ini(c.full_name)}{photos[c.id] && <button onClick={e => { e.stopPropagation(); openPhoto(c.photo_path) }} title={lang === 'es' ? 'Ver foto' : 'View photo'} className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/45 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>}<span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${funnelColor(d)}`}>{d}d</span></div>
                  <div className="p-3"><div className="font-semibold text-sm text-[var(--text)]">{c.full_name}</div><div className="text-xs text-[var(--muted)] mt-0.5">{(c.positions || [])[0] || '—'} · {c.age ?? '—'} · {c.gender ? c.gender[0].toUpperCase() + c.gender.slice(1) : '—'}</div><div className="flex gap-1.5 mt-2">{tierPill(c.profile_tier)}<span className="text-[11px] bg-[var(--raise)] text-[var(--text)] px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span></div></div>
                </div>) })}
            </div>
          ) : (
            <>
            {/* mobile: stacked cards */}
            <div className="sm:hidden grid gap-2.5">
              {filtered.map(c => { const d = daysIn(c.created_at); return (
                <div key={c.id} onClick={() => openCand(c)} role="button" tabIndex={0}
                  className="bg-[var(--surface)] border border-[var(--border)] border-l-[3px] border-l-[var(--gold)] rounded-xl p-3.5 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-semibold overflow-hidden flex-shrink-0" style={{ background: hue(c.email || c.full_name) }}>
                      {photos[c.id] ? <img src={photos[c.id]} alt="" loading="lazy" decoding="async" onError={() => photoFallback(c.id, c.photo_path)} className="w-full h-full object-cover" /> : ini(c.full_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--text)] flex items-center gap-2 flex-wrap">{c.full_name}<SourceBadge channel={c.intake_channel} /></div>
                      <div className="text-xs text-[var(--muted)]">{[c.borough, c.city].filter(Boolean).join(', ') || '—'}</div>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${funnelColor(d)}`}>{d}d</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-[var(--border)]">
                    {tierPill(c.profile_tier)}
                    <span className="text-[11px] bg-[var(--raise)] text-[var(--text)] px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span>
                    <span className="text-[11px] text-[var(--muted)]">{(c.positions || [])[0] || '—'}</span>
                    <span className="text-[11px] text-[var(--faint)] ml-auto">{fmtDate(c.created_at)}</span>
                  </div>
                  {missingFields(c).length > 0 && <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><Ico d="warn" size={11} /> {t('missing_label')}: {missingFields(c).join(', ')}</div>}
                </div>) })}
            </div>
            {/* desktop: table */}
            <div className="hidden sm:block bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-[var(--on-gold)] bg-[var(--gold)] border-b border-[var(--border)]"><th className="px-4 py-3">{t('th_candidate')}</th><th className="px-4 py-3">{t('th_position')}</th><th className="px-4 py-3">{t('th_age_sex')}</th><th className="px-4 py-3">{t('th_tier')}</th><th className="px-4 py-3">{t('th_stage')}</th><th className="px-4 py-3">{t('th_added')}</th><th className="px-4 py-3">{t('th_in_funnel')}</th></tr></thead>
                <tbody>{filtered.map(c => { const d = daysIn(c.created_at); return (
                  <tr key={c.id} onClick={() => openCand(c)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--raise)] cursor-pointer">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold overflow-hidden" style={{ background: hue(c.email || c.full_name) }}>{photos[c.id] ? <img src={photos[c.id]} alt="" loading="lazy" decoding="async" onError={() => photoFallback(c.id, c.photo_path)} className="w-full h-full object-cover" /> : ini(c.full_name)}</span><div><div className="font-semibold text-[var(--text)] flex items-center gap-2">{c.full_name}<SourceBadge channel={c.intake_channel} />{c.man_power_request_id && reqMap[c.man_power_request_id] && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[#8A6D1E] border border-[color-mix(in_srgb,var(--gold)_40%,transparent)]">#{reqMap[c.man_power_request_id].seq}</span>}</div><div className="text-xs text-[var(--muted)]">{[c.borough, c.city].filter(Boolean).join(', ')}</div>{missingFields(c).length > 0 && <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><Ico d="warn" size={11} /> {t('missing_label')}: {missingFields(c).join(', ')}</div>}</div></div></td>
                    <td className="px-4 py-3 text-[var(--muted)]">{(c.positions || [])[0] || '—'}{(c.positions || []).length > 1 ? ` +${(c.positions || []).length - 1}` : ''}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{c.age ?? '—'} · {c.gender ? c.gender[0].toUpperCase() : '—'}</td>
                    <td className="px-4 py-3">{tierPill(c.profile_tier)}</td>
                    <td className="px-4 py-3"><span className="text-[11px] bg-[var(--raise)] text-[var(--text)] px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span></td>
                    <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${funnelColor(d)}`}>{d}d</span></td>
                  </tr>) })}
                </tbody></table>
            </div>
            </>
          )}
      </div>

      {sel && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-[var(--surface)] z-[70] shadow-2xl flex flex-col">
            <div className="p-5 border-b border-[var(--border)] relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-[var(--raise)] text-[var(--muted)]"><Ico d="x" size={13} sw={2.2} /></button>
              <div className="flex items-center gap-3"><span onClick={() => sel.photo_path && openPhoto(sel.photo_path)} className={`w-12 h-12 rounded-xl grid place-items-center text-white font-semibold overflow-hidden ${sel.photo_path ? 'cursor-zoom-in' : ''}`} style={{ background: hue(sel.email || sel.full_name) }}>{photos[sel.id] ? <img src={photos[sel.id]} alt="" onError={() => photoFallback(sel.id, sel.photo_path)} className="w-full h-full object-cover" /> : ini(sel.full_name)}</span>
                <div><h2 className="text-lg font-semibold text-[var(--text-strong)]">{sel.full_name}</h2><div className="flex items-center gap-2 mt-0.5">{tierPill(sel.profile_tier)}<span className="text-[11px] bg-[var(--raise)] text-[var(--text)] px-2 py-0.5 rounded-full">{stageLabel[sel.stage]}</span><SourceBadge channel={sel.intake_channel} />{sel.man_power_request_id && reqMap[sel.man_power_request_id] && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[#8A6D1E] border border-[color-mix(in_srgb,var(--gold)_40%,transparent)]">#{reqMap[sel.man_power_request_id].seq}</span>}</div></div></div>
              <div className="text-xs text-[var(--muted)] mt-2">{t('th_added')} {fmtDate(sel.created_at)} · <b className="text-[var(--text)]">{daysIn(sel.created_at)} {lang==='es'?'días':'days'}</b> {t('th_in_funnel').toLowerCase()}</div>
              {sel.asana_url && <a href={sel.asana_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-1.5"><Ico d="ext" size={12} /> {t('view_in_asana')}</a>}
            </div>
            <div className="overflow-auto flex-1">
              {canAssign && (
                <div className="p-5 border-b border-[var(--border)] bg-[var(--raise)]">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2">{t('assign_to_request')}</div>
                  {sel.man_power_request_id && reqMap[sel.man_power_request_id] ? (
                    <div className="flex items-center justify-between gap-2 bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] border border-[color-mix(in_srgb,var(--gold)_40%,transparent)] rounded-lg px-3 py-2">
                      <div className="text-xs text-[var(--text)] font-medium">{reqLabel(reqMap[sel.man_power_request_id])}</div>
                      <button onClick={unassignRequest} className="text-xs text-red-500 font-medium flex-shrink-0">{t('remove')}</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select value={assignReq} onChange={e => setAssignReq(e.target.value)} className="flex-1 border border-[var(--border)] rounded-lg px-2.5 py-2 text-sm bg-[var(--surface)]">
                        <option value="">{t('pick_request')}</option>
                        {reqs.filter(r => r.status === 'open').map(r => <option key={r.id} value={r.id}>{reqLabel(r)}</option>)}
                      </select>
                      <button disabled={!assignReq} onClick={assignToRequest} className="bg-[var(--gold)] text-[var(--on-gold)] text-sm font-semibold px-4 rounded-lg disabled:opacity-40">{t('assign')}</button>
                    </div>
                  )}
                </div>
              )}
              {canAct && (
                <div className="p-5 border-b border-[var(--border)] space-y-3">
                  <div><div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-1.5">{t('tier')}</div><div className="flex gap-2">{['high', 'medium', 'low'].map(t => <button key={t} onClick={() => save({ profile_tier: t })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${sel.profile_tier === t ? 'bg-[var(--gold)] border-[var(--gold)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{t}</button>)}</div></div>
                  <div><div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-1.5">{t('stage')}</div><div className="flex flex-wrap gap-2">{STAGES.map(s => <button key={s} onClick={() => save({ stage: s })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${sel.stage === s ? 'bg-[var(--gold)] border-[var(--gold)] text-[var(--on-gold)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{stageLabel[s]}</button>)}<button onClick={notInterested} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 text-red-600 bg-[var(--surface)]"><span className="inline-flex items-center gap-1.5"><Ico d="ban" size={13} /> {t('no_longer_interested')}</span></button></div></div>
                </div>
              )}
              {/* internal details — editable */}
              <div className="p-5 border-b border-[var(--border)] bg-amber-50/40">
                <div className="text-[11px] uppercase tracking-wide text-[#92400E] font-bold mb-2.5">{t('s_internal')}</div>
                {canAct ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-[var(--muted)]">{t('l_gender')}{!sel.gender && <Miss text={t('missing')} />}<select defaultValue={sel.gender || ''} onBlur={e => e.target.value !== (sel.gender || '') && save({ gender: e.target.value || null } as any)} className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${!sel.gender ? 'border-red-200 bg-red-50/40' : 'border-[var(--border)]'}`}><option value=""></option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
                      <label className="text-xs text-[var(--muted)]">{t('l_age')}{sel.age == null && <Miss text={t('missing')} />}<input type="number" defaultValue={sel.age ?? ''} onBlur={e => Number(e.target.value) !== (sel.age ?? NaN) && save({ age: e.target.value ? Number(e.target.value) : null } as any)} className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${sel.age == null ? 'border-red-200 bg-red-50/40' : 'border-[var(--border)]'}`} /></label>
                      <div className="text-xs text-[var(--muted)]">{t('l_nationality')}{!sel.nationality && <Miss text={t('missing')} />}<div className="mt-1"><SearchSelect value={sel.nationality} onChange={v => save({ nationality: v || null } as any)} options={NATIONALITIES} placeholder={t('ph_nationality')} /></div></div>
                      <div className="text-xs text-[var(--muted)]">{t('l_ethnicity')}{!sel.ethnicity && <Miss text={t('missing')} />}<div className="mt-1"><SearchSelect value={sel.ethnicity} onChange={v => save({ ethnicity: v || null } as any)} options={ETHNICITIES} placeholder={t('ph_ethnicity')} /></div></div>
                      <div className="text-xs text-[var(--muted)] col-span-2">{t('l_time_usa')}{!sel.time_in_usa && <Miss text={t('missing')} />}<div className="mt-1"><YearsMonths value={sel.time_in_usa} onSave={v => save({ time_in_usa: v || null } as any)} yearsLabel={t('years')} monthsLabel={t('months')} /></div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {([[t('l_taxid'), 'has_tax_id'], [t('l_ss'), 'has_ss'], [t('l_bank'), 'has_bank_account']] as [string, keyof Candidate][]).map(([label, key]) => (
                        <div key={key}><div className="text-xs text-[var(--muted)] mb-1">{label}{sel[key] == null && <Miss text={t('missing')} />}</div><div className="flex gap-1.5">
                          {[[t('tax_yes'), true], [t('tax_no'), false]].map(([l, v]) => <button key={l as string} onClick={() => save({ [key]: v } as any)} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${sel[key] === v ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{l}</button>)}
                        </div></div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[var(--muted)] space-y-1">
                    <div>{t('l_gender')}: {sel.gender || '—'} · {t('l_age')}: {sel.age ?? '—'}</div>
                    <div>{t('l_nationality')}: {sel.nationality || '—'} · {t('l_ethnicity')}: {sel.ethnicity || '—'}</div>
                    <div>{t('l_time_usa')}: {sel.time_in_usa || '—'}</div>
                    <div>{t('l_taxid')}: {yn(sel.has_tax_id)} · {t('l_ss')}: {yn(sel.has_ss)} · {t('l_bank')}: {yn(sel.has_bank_account)}</div>
                  </div>
                )}
              </div>
              <Sec title={t('s_applied_for')}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex flex-wrap gap-1.5">{(sel.positions || []).length ? (sel.positions || []).map(p => <span key={p} className="text-xs bg-[var(--raise)] text-[var(--gold)] font-medium px-2.5 py-1 rounded-full">{p}</span>) : <span className="text-xs text-[var(--faint)]">{t('none')}</span>}</div>
                  {canAct && <button onClick={() => setEditPos(v => !v)} className="text-xs text-blue-600 font-medium flex-shrink-0 ml-2">{editPos ? t('done') : t('edit')}</button>}
                </div>
                {editPos && canAct && (
                  <div className="mt-2 bg-[var(--raise)] rounded-lg p-2.5">
                    <div className="text-[11px] text-[var(--muted)] mb-1.5">{lang === 'es' ? 'Actual — toca para quitar:' : 'Current — tap to remove:'}</div>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {(sel.positions || []).length ? (sel.positions || []).map(p => <button key={p} onClick={() => togglePos(p)} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--gold)] text-[var(--on-gold)] flex items-center gap-1">{p} <span className="opacity-70"><Ico d="x" size={9} sw={2.8} /></span></button>) : <span className="text-[11px] text-[var(--faint)]">{t('none')}</span>}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mb-1.5">{lang === 'es' ? 'Agregar un puesto:' : 'Add a position:'}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {POS_EDIT.filter(p => !(sel.positions || []).includes(p)).map(p => <button key={p} onClick={() => togglePos(p)} className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]">+ {p}</button>)}
                    </div>
                  </div>
                )}
                {sel.positions?.includes('Security') && <div className="mt-2 text-xs">{t('sec_license')}: <b>{sel.security_licensed === true ? t('licensed') : sel.security_licensed === false ? t('unlicensed') : '—'}</b>{sel.license_path && <button onClick={() => openFile('candidate-licenses', sel.license_path)} className="ml-2 text-blue-600 font-medium">{t('view_license')}</button>}</div>}
              </Sec>
              {canAct ? (<>
                <Sec title={t('s_contact')}>
                  <EField label={t('l_phone')} value={sel.phone} onSave={v => save({ phone: v || null } as any)} flag ml={t('missing')} />
                  <EField label={t('l_email')} value={sel.email} onSave={v => save({ email: v || null } as any)} flag ml={t('missing')} />
                </Sec>
                <Sec title={t('s_job_fit')}>
                  <EField label={t('l_expected_pay')} value={sel.expected_pay} onSave={v => save({ expected_pay: v || null } as any)} flag ml={t('missing')} />
                  <ESelect label={t('l_availability')} value={sel.availability} opts={['', 'Weekdays', 'Weekends & Holidays', 'All']} onSave={v => save({ availability: v || null } as any)} flag ml={t('missing')} />
                  <EField label={t('l_transportation')} value={sel.transportation} onSave={v => save({ transportation: v || null } as any)} flag ml={t('missing')} />
                  <ESelect label={t('l_english')} value={sel.english_level} opts={['', 'Basic', 'Intermediate', 'Fluent']} onSave={v => save({ english_level: v || null } as any)} flag ml={t('missing')} />
                </Sec>
                <Sec title={t('s_location')}>
                  <ESelect label={t('l_lives_in')} value={sel.borough} opts={['', ...BOROUGHS]} onSave={v => save({ borough: v || null, state: v ? 'NY' : sel.state } as any)} flag ml={t('missing')} />
                  <div className="py-1"><div className="text-[11px] text-[var(--muted)] mb-1">{t('l_open_to')}</div><div className="flex flex-wrap gap-1.5">{BOROUGHS.map(b => { const on = (sel.work_areas || []).includes(b); return <button key={b} onClick={() => { const cur = sel.work_areas || []; save({ work_areas: cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b] } as any) }} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${on ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'}`}>{b}</button> })}</div></div>
                </Sec>
              </>) : (<>
                <Sec title={t('s_contact')}><Rw k={t('l_phone')} v={sel.phone} /><Rw k={t('l_email')} v={sel.email} /></Sec>
                <Sec title={t('s_job_fit')}><Rw k={t('l_expected_pay')} v={payText(sel)} /><Rw k={t('l_availability')} v={sel.availability} /><Rw k={t('l_transportation')} v={sel.transportation} /><Rw k={t('l_english')} v={sel.english_level} /></Sec>
                <Sec title={t('s_location')}><Rw k={t('l_lives_in')} v={[sel.borough, sel.city, sel.state].filter(Boolean).join(', ')} /><Rw k={t('l_open_to')} v={(sel.work_areas || []).join(', ')} /></Sec>
              </>)}
              {sel.experience && <Sec title={t('s_experience')}><p className="text-xs text-[var(--muted)] leading-relaxed bg-[var(--raise)] rounded-lg p-3 whitespace-pre-line">{sel.experience}</p></Sec>}
              {sel.strengths && <Sec title={t('l_strengths')}><p className="text-xs text-[var(--muted)] leading-relaxed">{sel.strengths}</p></Sec>}
              {canAct && (
                <div className="p-5 border-b border-[var(--border)]">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2.5">{t('l_photo_video')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      {media.photo ? <img src={media.photo} alt="" loading="lazy" onClick={() => openPhoto(sel.photo_path)} onError={async () => { if (!sel.photo_path) return; const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(sel.photo_path, 600); if (data?.signedUrl) setMedia(m => ({ ...m, photo: data.signedUrl })) }} className="w-full h-32 object-cover rounded-lg mb-1.5 cursor-zoom-in" title={lang === 'es' ? 'Ver a tamaño completo' : 'View full size'} /> : <div className="w-full h-32 bg-[var(--raise)] rounded-lg grid place-items-center text-[var(--faint)] text-xs mb-1.5">{t('no_photo')}</div>}
                      <label className="text-xs text-[var(--text)] font-medium cursor-pointer">{media.photo ? t('replace_photo') : t('add_photo')}<input type="file" accept="image/*" className="hidden" onChange={e => uploadMedia('photo', e.target.files?.[0] || null)} /></label>
                    </div>
                    <div>
                      {media.video ? <video src={media.video} controls className="w-full h-32 object-cover rounded-lg mb-1.5 bg-black" /> : <div className="w-full h-32 bg-[var(--raise)] rounded-lg grid place-items-center text-[var(--faint)] text-xs mb-1.5">{t('no_video')}</div>}
                      <label className="text-xs text-[var(--text)] font-medium cursor-pointer">{media.video ? t('replace_video') : t('add_video')}<input type="file" accept="video/*" className="hidden" onChange={e => uploadMedia('video', e.target.files?.[0] || null)} /></label>
                    </div>
                  </div>
                </div>
              )}
              <Sec title={t('l_resume_source')}>
                <Rw k={t('l_heard_via')} v={sel.referral_source} />
                <div className="flex items-center gap-3 mt-1.5">
                  {media.resume ? <a href={media.resume} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[var(--raise)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)]"><span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PDF</span> {t('view_resume')}</a> : <span className="text-xs text-[var(--faint)]">{t('no_resume')}</span>}
                  {canAct && <label className="text-xs text-blue-600 font-medium cursor-pointer">{media.resume ? t('replace') : t('upload_resume')}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => uploadMedia('resume', e.target.files?.[0] || null)} /></label>}
                </div>
              </Sec>
            </div>
          </aside>
        </>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-[80]"><span className="text-[var(--gold)]"><Ico d="check" size={13} sw={2.4} /></span> {toast}</div>}
      {lightbox && (
        <div className="fixed inset-0 z-[90] bg-black/90 grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} title={lang === 'es' ? 'Cerrar' : 'Close'} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <a href={lightbox} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="absolute bottom-4 right-4 text-white/80 text-xs bg-white/10 rounded-lg px-3 py-2 hover:bg-white/20"><span className="inline-flex items-center gap-1.5">{lang === 'es' ? 'Abrir original' : 'Open original'} <Ico d="ext" size={12} /></span></a>
        </div>
      )}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) { return <div className="p-5 border-b border-[var(--border)]"><div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2.5">{title}</div>{children}</div> }
function Rw({ k, v }: { k: string; v: string | null | undefined }) { return <div className="flex justify-between gap-3 py-1 text-[13px]"><span className="text-[var(--muted)]">{k}</span><span className="text-[var(--text)] font-medium text-right">{v || '—'}</span></div> }
function Miss({ text = 'missing' }: { text?: string }) { return <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 ml-1.5 align-middle">{text}</span> }
function EField({ label, value, onSave, flag, ml }: { label: string; value: string | null | undefined; onSave: (v: string) => void; flag?: boolean; ml?: string }) {
  const empty = value == null || value === ''
  return <div className="py-1"><div className="text-[11px] text-[var(--muted)] mb-0.5">{label}{flag && empty && <Miss text={ml} />}</div><input defaultValue={value || ''} onBlur={e => e.target.value !== (value || '') && onSave(e.target.value)} className={`w-full border rounded-lg px-2.5 py-1.5 text-sm ${flag && empty ? 'border-red-200 bg-red-50/40' : 'border-[var(--border)]'}`} /></div>
}
function ESelect({ label, value, opts, onSave, flag, ml }: { label: string; value: string | null | undefined; opts: string[]; onSave: (v: string) => void; flag?: boolean; ml?: string }) {
  const valid = opts.filter(Boolean)
  const empty = value == null || value === '' || !valid.includes(value)
  return <div className="py-1"><div className="text-[11px] text-[var(--muted)] mb-0.5">{label}{flag && empty && <Miss text={ml} />}</div><select defaultValue={valid.includes(value || '') ? (value || '') : ''} onChange={e => onSave(e.target.value)} className={`w-full border rounded-lg px-2.5 py-1.5 text-sm ${flag && empty ? 'border-red-200 bg-red-50/40' : 'border-[var(--border)]'} bg-[var(--surface)]`}>{opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}</select></div>
}

// ── drawn icons (no emojis) ──
function Ico({ d, size = 14, sw = 1.8, cls = '' }: { d: string; size?: number; sw?: number; cls?: string }) {
  const P: Record<string, JSX.Element> = {
    x: <path d="M6 6l12 12M18 6L6 18" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    list: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
    warn: <><path d="M12 4.5L2.8 20h18.4z" /><path d="M12 10v4.2M12 17.2v.2" /></>,
    ban: <><circle cx="12" cy="12" r="8.5" /><path d="M6 18L18 6" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></>,
    lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></>,
    ext: <><path d="M14 4h6v6" /><path d="M20 4l-8.5 8.5" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
    video: <><rect x="3" y="6.5" width="12.5" height="11" rx="2" /><path d="M15.5 11l5-2.8v7.6l-5-2.8z" /></>,
    skip: <><path d="M5 6l8 6-8 6z" /><path d="M17 6v12" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden="true">{P[d]}</svg>
}
