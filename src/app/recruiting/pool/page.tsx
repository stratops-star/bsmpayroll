'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ShareCareers from '@/components/ShareCareers'
import RecruitingTabs from '@/components/RecruitingTabs'
import { SearchSelect, YearsMonths } from '@/components/SearchSelect'
import { NATIONALITIES, ETHNICITIES } from '@/lib/recruiting-data'

type Candidate = {
  id: string; created_at: string; full_name: string; phone: string | null; email: string | null
  preferred_lang: string; positions: string[] | null; state: string | null; city: string | null; borough: string | null
  work_areas: string[] | null; pay_min: number | null; pay_max: number | null; expected_pay: string | null
  transportation: string | null; availability: string | null; english_level: string | null
  referral_source: string | null; experience: string | null; strengths: string | null; security_licensed: boolean | null
  license_path: string | null; resume_path: string | null; photo_path: string | null; video_path: string | null
  profile_tier: string | null; stage: string; asana_url: string | null
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
const funnelColor = (d: number) => d > 21 ? 'bg-red-50 text-red-600' : d > 7 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
const yn = (b: boolean | null) => b === true ? 'Yes' : b === false ? 'No' : '—'

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

export default function PoolPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [sel, setSel] = useState<Candidate | null>(null)
  const [media, setMedia] = useState<{ photo?: string; video?: string; resume?: string }>({})
  const [editPos, setEditPos] = useState(false)
  const [toast, setToast] = useState('')
  const [q, setQ] = useState('')
  const [F, setF] = useState<Record<string, string>>({ tier: 'all', stage: 'all', gender: 'all', age: 'all', trans: 'all', lives: 'all', open: 'all', pos: 'all', resume: 'all', video: 'all', profile: 'all' })
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState<'list' | 'photos'>('list')
  const [sort, setSort] = useState<'recent' | 'longest'>('recent')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter') }
    const { data } = await supabase.from('candidates').select('*').eq('status', 'in_pool').order('created_at', { ascending: false })
    const list = data ?? []; setRows(list); setLoading(false)
    const map: Record<string, string> = {}
    await Promise.all(list.filter((c: Candidate) => c.photo_path).map(async (c: Candidate) => { const { data: s } = await supabase.storage.from('candidate-photos').createSignedUrl(c.photo_path!, 600); if (s?.signedUrl) map[c.id] = s.signedUrl }))
    setPhotos(map)
  }
  useEffect(() => { load() }, [])

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
  async function save(patch: Partial<Candidate>) { if (!sel) return; const { error } = await supabase.from('candidates').update(patch).eq('id', sel.id); if (error) { flash('Error: ' + error.message); return }; const u = { ...sel, ...patch }; setSel(u); setRows(rs => rs.map(r => r.id === sel.id ? u : r)); flash('Saved') }

  async function notInterested() {
    if (!sel) return
    const { error } = await supabase.from('candidates').update({ status: 'rejected', stage: 'rejected', rejected_reason: 'No longer interested' }).eq('id', sel.id)
    if (error) { flash('Error: ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash('Moved to Rejected — no longer interested')
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
    if (error) { flash('Upload failed: ' + error.message); return }
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

  const tierPill = (t: string | null) => { const c = t === 'high' ? 'bg-[#F3E4BE] text-[#8A6D1E]' : t === 'medium' ? 'bg-blue-100 text-blue-800' : t === 'low' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'; return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${c}`}>{t || '—'}</span> }
  const chipLabel = (v: string) => ({ u30: 'Under 30', '30-45': '30–45', '45p': '45+' } as Record<string, string>)[v] || stageLabel[v] || (v[0].toUpperCase() + v.slice(1))

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div><h1 className="text-xl font-semibold text-[#0D1B35]">Candidate Pool</h1><p className="text-xs text-gray-500">Interviewed · rated · ready to place</p></div>
          <ShareCareers />
        </div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, position…" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 max-w-full" />
          <button onClick={() => setPanelOpen(o => !o)} className="flex items-center gap-2 border border-gray-200 bg-white rounded-lg px-3.5 py-2 text-sm font-semibold text-[#0D1B35]">⛃ Filters {activeCount > 0 && <span className="bg-[#D4A843] text-[#0D1B35] text-[11px] font-bold rounded-full px-1.5">{activeCount}</span>}</button>
          <select value={sort} onChange={e => setSort(e.target.value as any)} className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm text-gray-600"><option value="recent">Sort: Recently added</option><option value="longest">Sort: Longest in funnel</option></select>
          {(() => { const n = rows.filter(c => missingFields(c).length > 0).length; return <button onClick={() => setF1('profile', F.profile === 'missing' ? 'all' : 'missing')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold border ${F.profile === 'missing' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200'}`}>⚠ Missing info{n > 0 && <span className={`text-[11px] font-bold rounded-full px-1.5 ${F.profile === 'missing' ? 'bg-white/25' : 'bg-amber-100'}`}>{n}</span>}</button> })()}
          <div className="ml-auto flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">{(['list', 'photos'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${view === v ? 'bg-[#0D1B35] text-white' : 'text-gray-500'}`}>{v === 'list' ? '▤ List' : '▦ Photos'}</button>)}</div>
        </div>

        {activeCount > 0 && <div className="flex flex-wrap gap-2 mb-3 items-center">{Object.entries(F).filter(([, v]) => v !== 'all').map(([k, v]) => <span key={k} className="bg-[#0D1B35] text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">{FILTERS.find(f => f.key === k)?.label}: {chipLabel(v)}<button onClick={() => setF1(k, 'all')} className="opacity-70">✕</button></span>)}<button onClick={clearAll} className="text-xs text-gray-500 underline">Clear all</button></div>}

        {panelOpen && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
              {FILTERS.map(f => <div key={f.key}><label className="block text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1">{f.label}</label><select value={F[f.key]} onChange={e => setF1(f.key, e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white">{f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>)}
            </div>
            <div className="flex justify-end mt-3"><button onClick={clearAll} className="text-xs text-gray-500 underline">Clear all filters</button></div>
          </div>
        )}

        <RecruitingTabs />

        {loading ? <p className="text-gray-400 text-sm">Loading…</p>
          : filtered.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">No candidates match these filters.</div>
          : view === 'photos' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
              {filtered.map(c => { const d = daysIn(c.created_at); return (
                <button key={c.id} onClick={() => openCand(c)} className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="h-36 grid place-items-center text-white text-3xl font-semibold relative" style={{ background: hue(c.email || c.full_name) }}>{photos[c.id] ? <img src={photos[c.id]} alt="" className="w-full h-full object-cover" /> : ini(c.full_name)}<span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${funnelColor(d)}`}>{d}d</span></div>
                  <div className="p-3"><div className="font-semibold text-sm text-[#0D1B35]">{c.full_name}</div><div className="text-xs text-gray-500 mt-0.5">{(c.positions || [])[0] || '—'} · {c.age ?? '—'} · {c.gender ? c.gender[0].toUpperCase() + c.gender.slice(1) : '—'}</div><div className="flex gap-1.5 mt-2">{tierPill(c.profile_tier)}<span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span></div></div>
                </button>) })}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200"><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Age / Sex</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Added</th><th className="px-4 py-3">In funnel</th></tr></thead>
                <tbody>{filtered.map(c => { const d = daysIn(c.created_at); return (
                  <tr key={c.id} onClick={() => openCand(c)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold overflow-hidden" style={{ background: hue(c.email || c.full_name) }}>{photos[c.id] ? <img src={photos[c.id]} alt="" className="w-full h-full object-cover" /> : ini(c.full_name)}</span><div><div className="font-semibold text-[#0D1B35]">{c.full_name}</div><div className="text-xs text-gray-500">{[c.borough, c.city].filter(Boolean).join(', ')}</div>{missingFields(c).length > 0 && <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">⚠ Missing: {missingFields(c).join(', ')}</div>}</div></div></td>
                    <td className="px-4 py-3 text-gray-600">{(c.positions || [])[0] || '—'}{(c.positions || []).length > 1 ? ` +${(c.positions || []).length - 1}` : ''}</td>
                    <td className="px-4 py-3 text-gray-500">{c.age ?? '—'} · {c.gender ? c.gender[0].toUpperCase() : '—'}</td>
                    <td className="px-4 py-3">{tierPill(c.profile_tier)}</td>
                    <td className="px-4 py-3"><span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${funnelColor(d)}`}>{d}d</span></td>
                  </tr>) })}
                </tbody></table>
            </div>
          )}
      </div>

      {sel && (
        <>
          <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-white z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
              <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold overflow-hidden" style={{ background: hue(sel.email || sel.full_name) }}>{photos[sel.id] ? <img src={photos[sel.id]} alt="" className="w-full h-full object-cover" /> : ini(sel.full_name)}</span>
                <div><h2 className="text-lg font-semibold text-[#0D1B35]">{sel.full_name}</h2><div className="flex items-center gap-2 mt-0.5">{tierPill(sel.profile_tier)}<span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stageLabel[sel.stage]}</span></div></div></div>
              <div className="text-xs text-gray-500 mt-2">Added {fmtDate(sel.created_at)} · <b className="text-[#0D1B35]">{daysIn(sel.created_at)} days</b> in funnel</div>
              {sel.asana_url && <a href={sel.asana_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-1.5">↗ View original in Asana</a>}
            </div>
            <div className="overflow-auto flex-1">
              {canAct && (
                <div className="p-5 border-b border-gray-100 space-y-3">
                  <div><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-1.5">Tier</div><div className="flex gap-2">{['high', 'medium', 'low'].map(t => <button key={t} onClick={() => save({ profile_tier: t })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${sel.profile_tier === t ? 'bg-[#D4A843] border-[#D4A843] text-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{t}</button>)}</div></div>
                  <div><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-1.5">Stage</div><div className="flex flex-wrap gap-2">{STAGES.map(s => <button key={s} onClick={() => save({ stage: s })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${sel.stage === s ? 'bg-[#0D1B35] border-[#0D1B35] text-white' : 'border-gray-200 text-gray-500'}`}>{stageLabel[s]}</button>)}<button onClick={notInterested} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 text-red-600 bg-white">🚫 No longer interested</button></div></div>
                </div>
              )}
              {/* internal details — editable */}
              <div className="p-5 border-b border-gray-100 bg-amber-50/40">
                <div className="text-[11px] uppercase tracking-wide text-[#92400E] font-bold mb-2.5">Internal details</div>
                {canAct ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-gray-600">Gender{!sel.gender && <Miss />}<select defaultValue={sel.gender || ''} onBlur={e => e.target.value !== (sel.gender || '') && save({ gender: e.target.value || null } as any)} className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${!sel.gender ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`}><option value=""></option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
                      <label className="text-xs text-gray-600">Age{sel.age == null && <Miss />}<input type="number" defaultValue={sel.age ?? ''} onBlur={e => Number(e.target.value) !== (sel.age ?? NaN) && save({ age: e.target.value ? Number(e.target.value) : null } as any)} className={`w-full mt-1 border rounded-lg px-2 py-1.5 text-sm ${sel.age == null ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`} /></label>
                      <div className="text-xs text-gray-600">Nationality{!sel.nationality && <Miss />}<div className="mt-1"><SearchSelect value={sel.nationality} onChange={v => save({ nationality: v || null } as any)} options={NATIONALITIES} placeholder="Nationality…" /></div></div>
                      <div className="text-xs text-gray-600">Ethnicity{!sel.ethnicity && <Miss />}<div className="mt-1"><SearchSelect value={sel.ethnicity} onChange={v => save({ ethnicity: v || null } as any)} options={ETHNICITIES} placeholder="Ethnicity…" /></div></div>
                      <div className="text-xs text-gray-600 col-span-2">Time in USA{!sel.time_in_usa && <Miss />}<div className="mt-1"><YearsMonths value={sel.time_in_usa} onSave={v => save({ time_in_usa: v || null } as any)} /></div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {([['Tax ID', 'has_tax_id'], ['SS', 'has_ss'], ['Bank Acct', 'has_bank_account']] as [string, keyof Candidate][]).map(([label, key]) => (
                        <div key={key}><div className="text-xs text-gray-600 mb-1">{label}{sel[key] == null && <Miss />}</div><div className="flex gap-1.5">
                          {[['Yes', true], ['No', false]].map(([l, v]) => <button key={l as string} onClick={() => save({ [key]: v } as any)} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${sel[key] === v ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{l}</button>)}
                        </div></div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Gender: {sel.gender || '—'} · Age: {sel.age ?? '—'}</div>
                    <div>Nationality: {sel.nationality || '—'} · Ethnicity: {sel.ethnicity || '—'}</div>
                    <div>Time in USA: {sel.time_in_usa || '—'}</div>
                    <div>Tax ID: {yn(sel.has_tax_id)} · SS: {yn(sel.has_ss)} · Bank: {yn(sel.has_bank_account)}</div>
                  </div>
                )}
              </div>
              <Sec title="Applied for">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex flex-wrap gap-1.5">{(sel.positions || []).length ? (sel.positions || []).map(p => <span key={p} className="text-xs bg-[#0D1B35]/5 text-[#0D1B35] font-medium px-2.5 py-1 rounded-full">{p}</span>) : <span className="text-xs text-gray-400">None</span>}</div>
                  {canAct && <button onClick={() => setEditPos(v => !v)} className="text-xs text-blue-600 font-medium flex-shrink-0 ml-2">{editPos ? 'Done' : 'Edit'}</button>}
                </div>
                {editPos && canAct && (
                  <div className="mt-2 bg-[#F5F6FA] rounded-lg p-2.5">
                    <div className="text-[11px] text-gray-500 mb-1.5">Current — tap ✕ to remove:</div>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {(sel.positions || []).length ? (sel.positions || []).map(p => <button key={p} onClick={() => togglePos(p)} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#0D1B35] text-white flex items-center gap-1">{p} <span className="opacity-70">✕</span></button>) : <span className="text-[11px] text-gray-400">None</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 mb-1.5">Add a position:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {POS_EDIT.filter(p => !(sel.positions || []).includes(p)).map(p => <button key={p} onClick={() => togglePos(p)} className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white text-gray-600 border-gray-200">+ {p}</button>)}
                    </div>
                  </div>
                )}
                {sel.positions?.includes('Security') && <div className="mt-2 text-xs">Security license: <b>{sel.security_licensed === true ? 'Licensed' : sel.security_licensed === false ? 'Unlicensed' : '—'}</b>{sel.license_path && <button onClick={() => openFile('candidate-licenses', sel.license_path)} className="ml-2 text-blue-600 font-medium">View license</button>}</div>}
              </Sec>
              {canAct ? (<>
                <Sec title="Contact">
                  <EField label="Phone" value={sel.phone} onSave={v => save({ phone: v || null } as any)} flag />
                  <EField label="Email" value={sel.email} onSave={v => save({ email: v || null } as any)} flag />
                </Sec>
                <Sec title="Job fit">
                  <EField label="Expected pay" value={sel.expected_pay} onSave={v => save({ expected_pay: v || null } as any)} flag />
                  <ESelect label="Availability" value={sel.availability} opts={['', 'Weekdays', 'Weekends & Holidays', 'All']} onSave={v => save({ availability: v || null } as any)} flag />
                  <EField label="Transportation" value={sel.transportation} onSave={v => save({ transportation: v || null } as any)} flag />
                  <ESelect label="English level" value={sel.english_level} opts={['', 'Basic', 'Intermediate', 'Fluent']} onSave={v => save({ english_level: v || null } as any)} flag />
                </Sec>
                <Sec title="Location">
                  <ESelect label="Lives in (borough)" value={sel.borough} opts={['', ...BOROUGHS]} onSave={v => save({ borough: v || null, state: v ? 'NY' : sel.state } as any)} flag />
                  <div className="py-1"><div className="text-[11px] text-gray-500 mb-1">Open to work in</div><div className="flex flex-wrap gap-1.5">{BOROUGHS.map(b => { const on = (sel.work_areas || []).includes(b); return <button key={b} onClick={() => { const cur = sel.work_areas || []; save({ work_areas: cur.includes(b) ? cur.filter(x => x !== b) : [...cur, b] } as any) }} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${on ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200'}`}>{b}</button> })}</div></div>
                </Sec>
              </>) : (<>
                <Sec title="Contact"><Rw k="Phone" v={sel.phone} /><Rw k="Email" v={sel.email} /></Sec>
                <Sec title="Job fit"><Rw k="Expected pay" v={payText(sel)} /><Rw k="Availability" v={sel.availability} /><Rw k="Transportation" v={sel.transportation} /><Rw k="English" v={sel.english_level} /></Sec>
                <Sec title="Location"><Rw k="Lives in" v={[sel.borough, sel.city, sel.state].filter(Boolean).join(', ')} /><Rw k="Open to work in" v={(sel.work_areas || []).join(', ')} /></Sec>
              </>)}
              {sel.experience && <Sec title="Experience"><p className="text-xs text-gray-600 leading-relaxed bg-[#F5F6FA] rounded-lg p-3 whitespace-pre-line">{sel.experience}</p></Sec>}
              {sel.strengths && <Sec title="Strengths"><p className="text-xs text-gray-600 leading-relaxed">{sel.strengths}</p></Sec>}
              {canAct && (
                <div className="p-5 border-b border-gray-100">
                  <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">Photo & video</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      {media.photo ? <img src={media.photo} alt="" className="w-full h-32 object-cover rounded-lg mb-1.5" /> : <div className="w-full h-32 bg-[#F5F6FA] rounded-lg grid place-items-center text-gray-400 text-xs mb-1.5">No photo</div>}
                      <label className="text-xs text-[#0D1B35] font-medium cursor-pointer">{media.photo ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/*" className="hidden" onChange={e => uploadMedia('photo', e.target.files?.[0] || null)} /></label>
                    </div>
                    <div>
                      {media.video ? <video src={media.video} controls className="w-full h-32 object-cover rounded-lg mb-1.5 bg-black" /> : <div className="w-full h-32 bg-[#F5F6FA] rounded-lg grid place-items-center text-gray-400 text-xs mb-1.5">No video</div>}
                      <label className="text-xs text-[#0D1B35] font-medium cursor-pointer">{media.video ? 'Replace video' : 'Add video'}<input type="file" accept="video/*" className="hidden" onChange={e => uploadMedia('video', e.target.files?.[0] || null)} /></label>
                    </div>
                  </div>
                </div>
              )}
              <Sec title="Résumé & source">
                <Rw k="Heard via" v={sel.referral_source} />
                <div className="flex items-center gap-3 mt-1.5">
                  {media.resume ? <a href={media.resume} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#F5F6FA] border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-[#0D1B35]"><span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PDF</span> View résumé</a> : <span className="text-xs text-gray-400">No résumé</span>}
                  {canAct && <label className="text-xs text-blue-600 font-medium cursor-pointer">{media.resume ? 'Replace' : 'Upload résumé'}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => uploadMedia('resume', e.target.files?.[0] || null)} /></label>}
                </div>
              </Sec>
            </div>
          </aside>
        </>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) { return <div className="p-5 border-b border-gray-100"><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">{title}</div>{children}</div> }
function Rw({ k, v }: { k: string; v: string | null | undefined }) { return <div className="flex justify-between gap-3 py-1 text-[13px]"><span className="text-gray-500">{k}</span><span className="text-gray-800 font-medium text-right">{v || '—'}</span></div> }
function Miss() { return <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 ml-1.5 align-middle">missing</span> }
function EField({ label, value, onSave, flag }: { label: string; value: string | null | undefined; onSave: (v: string) => void; flag?: boolean }) {
  const empty = value == null || value === ''
  return <div className="py-1"><div className="text-[11px] text-gray-500 mb-0.5">{label}{flag && empty && <Miss />}</div><input defaultValue={value || ''} onBlur={e => e.target.value !== (value || '') && onSave(e.target.value)} className={`w-full border rounded-lg px-2.5 py-1.5 text-sm ${flag && empty ? 'border-red-200 bg-red-50/40' : 'border-gray-200'}`} /></div>
}
function ESelect({ label, value, opts, onSave, flag }: { label: string; value: string | null | undefined; opts: string[]; onSave: (v: string) => void; flag?: boolean }) {
  const empty = value == null || value === ''
  return <div className="py-1"><div className="text-[11px] text-gray-500 mb-0.5">{label}{flag && empty && <Miss />}</div><select defaultValue={value || ''} onChange={e => onSave(e.target.value)} className={`w-full border rounded-lg px-2.5 py-1.5 text-sm ${flag && empty ? 'border-red-200 bg-red-50/40' : 'border-gray-200'} bg-white`}>{opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}</select></div>
}
