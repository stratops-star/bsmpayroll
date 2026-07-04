'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Candidate = {
  id: string; created_at: string; full_name: string; phone: string | null; email: string | null
  preferred_lang: string; positions: string[] | null; state: string | null; city: string | null; borough: string | null
  work_areas: string[] | null; pay_min: number | null; pay_max: number | null; expected_pay: string | null
  transportation: string | null; availability: string | null; english_level: string | null
  referral_source: string | null; experience: string | null; security_licensed: boolean | null
  license_path: string | null; resume_path: string | null; photo_path: string | null
  profile_tier: string | null; stage: string
  gender: string | null; age: number | null; nationality: string | null; ethnicity: string | null
}

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const STAGES = ['available', '2nd_interview', 'offer', 'hired']
const stageLabel: Record<string, string> = { available: 'Available', '2nd_interview': '2nd Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' }

function Tabs() {
  const items = [['New Queue', '/recruiting'], ['Candidate Pool', '/recruiting/pool'], ['Rejected', '/recruiting/rejected']]
  return (
    <div className="max-w-6xl mx-auto flex gap-1 mt-3">
      {items.map(([l, h]) => (
        <a key={h} href={h} className={`text-sm px-3 py-1.5 rounded-lg ${l === 'Candidate Pool' ? 'bg-white/15 text-white font-medium' : 'text-white/55 hover:text-white'}`}>{l}</a>
      ))}
    </div>
  )
}

export default function PoolPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [sel, setSel] = useState<Candidate | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const [q, setQ] = useState('')
  const [fTier, setFTier] = useState('all')
  const [fPos, setFPos] = useState('all')
  const [fStage, setFStage] = useState('all')
  const [fGender, setFGender] = useState('all')
  const [fAge, setFAge] = useState('all')
  const [view, setView] = useState<'list' | 'photos'>('list')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single()
      setCanAct(me?.role === 'admin' || me?.role === 'recruiter')
    }
    const { data } = await supabase.from('candidates').select('*').eq('status', 'in_pool').order('created_at', { ascending: false })
    const list = data ?? []
    setRows(list); setLoading(false)
    // signed URLs for any photos
    const withPhoto = list.filter((c: Candidate) => c.photo_path)
    const map: Record<string, string> = {}
    await Promise.all(withPhoto.map(async (c: Candidate) => {
      const { data: s } = await supabase.storage.from('candidate-photos').createSignedUrl(c.photo_path!, 600)
      if (s?.signedUrl) map[c.id] = s.signedUrl
    }))
    setPhotos(map)
  }
  useEffect(() => { load() }, [])

  const positions = useMemo(() => [...new Set(rows.flatMap(r => r.positions || []))].sort(), [rows])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200) }
  const payText = (c: Candidate) => c.expected_pay || (c.pay_min != null && c.pay_max != null ? `$${c.pay_min}–${c.pay_max}/hr` : '—')
  const ageOk = (a: number | null) => fAge === 'all' || (a != null && ((fAge === 'u30' && a < 30) || (fAge === '30-45' && a >= 30 && a <= 45) || (fAge === '45p' && a > 45)))

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return rows.filter(c =>
      (fTier === 'all' || c.profile_tier === fTier) &&
      (fPos === 'all' || (c.positions || []).includes(fPos)) &&
      (fStage === 'all' || c.stage === fStage) &&
      (fGender === 'all' || c.gender === fGender) &&
      ageOk(c.age) &&
      (c.full_name.toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.positions || []).join(' ').toLowerCase().includes(s))
    )
  }, [rows, q, fTier, fPos, fStage, fGender, fAge])

  async function openFile(bucket: string, path: string | null) {
    if (!path) return
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank'); else flash('Could not open file')
  }

  async function save(patch: Partial<Candidate>) {
    if (!sel) return
    setBusy(true)
    const { error } = await supabase.from('candidates').update(patch).eq('id', sel.id)
    setBusy(false)
    if (error) { flash('Error: ' + error.message); return }
    const updated = { ...sel, ...patch }
    setSel(updated); setRows(rs => rs.map(r => r.id === sel.id ? updated : r)); flash('Saved')
  }

  const Chip = ({ on, onClick, children }: any) => (
    <button onClick={onClick} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${on ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200'}`}>{children}</button>
  )
  const tierPill = (t: string | null) => {
    const c = t === 'high' ? 'bg-[#F3E4BE] text-[#8A6D1E]' : t === 'medium' ? 'bg-blue-100 text-blue-800' : t === 'low' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'
    return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${c}`}>{t || '—'}</span>
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="bg-[#0D1B35] text-white px-6 py-4 border-b-[3px] border-[#D4A843]">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <a href="/hub" className="text-white/50 text-sm">← Hub</a>
          <div><div className="text-lg font-semibold">Candidate Pool</div><div className="text-xs text-white/50">Passed the initial interview · rated</div></div>
        </div>
        <Tabs />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5">
        {/* search + view toggle */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, position…"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 max-w-full" />
          <div className="ml-auto flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {(['list', 'photos'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`text-xs font-semibold px-3 py-1.5 rounded-md capitalize ${view === v ? 'bg-[#0D1B35] text-white' : 'text-gray-500'}`}>{v === 'list' ? '▤ List' : '▦ Photos'}</button>
            ))}
          </div>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 font-semibold mr-1">Tier</span>
          {['all', 'high', 'medium', 'low'].map(t => <Chip key={t} on={fTier === t} onClick={() => setFTier(t)}>{t === 'all' ? 'All' : t}</Chip>)}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <span className="text-xs text-gray-400 font-semibold mr-1">Stage</span>
          <Chip on={fStage === 'all'} onClick={() => setFStage('all')}>All</Chip>
          {STAGES.map(s => <Chip key={s} on={fStage === s} onClick={() => setFStage(s)}>{stageLabel[s]}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-400 font-semibold mr-1">Gender</span>
          {[['all', 'All'], ['female', 'Female'], ['male', 'Male'], ['other', 'Other']].map(([v, l]) => <Chip key={v} on={fGender === v} onClick={() => setFGender(v)}>{l}</Chip>)}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <span className="text-xs text-gray-400 font-semibold mr-1">Age</span>
          {[['all', 'All'], ['u30', 'Under 30'], ['30-45', '30–45'], ['45p', '45+']].map(([v, l]) => <Chip key={v} on={fAge === v} onClick={() => setFAge(v)}>{l}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-gray-400 font-semibold mr-1">Position</span>
          <Chip on={fPos === 'all'} onClick={() => setFPos('all')}>All</Chip>
          {positions.map(p => <Chip key={p} on={fPos === p} onClick={() => setFPos(p)}>{p}</Chip>)}
        </div>

        {loading ? <p className="text-gray-400 text-sm">Loading…</p>
          : filtered.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">No candidates match these filters.</div>
          : view === 'photos' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
              {filtered.map(c => (
                <button key={c.id} onClick={() => setSel(c)} className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="h-36 grid place-items-center text-white text-3xl font-semibold" style={{ background: hue(c.email || c.full_name) }}>
                    {photos[c.id] ? <img src={photos[c.id]} alt="" className="w-full h-full object-cover" /> : ini(c.full_name)}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-sm text-[#0D1B35]">{c.full_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{(c.positions || [])[0] || '—'} · {c.age ?? '—'} · {c.gender ? c.gender[0].toUpperCase() + c.gender.slice(1) : '—'}</div>
                    <div className="flex gap-1.5 mt-2">{tierPill(c.profile_tier)}<span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span></div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Age / Sex</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Stage</th>
                </tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} onClick={() => setSel(c)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3"><div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold overflow-hidden" style={{ background: hue(c.email || c.full_name) }}>{photos[c.id] ? <img src={photos[c.id]} alt="" className="w-full h-full object-cover" /> : ini(c.full_name)}</span>
                        <div><div className="font-semibold text-[#0D1B35]">{c.full_name}</div><div className="text-xs text-gray-500">{[c.borough, c.city].filter(Boolean).join(', ')}</div></div>
                      </div></td>
                      <td className="px-4 py-3 text-gray-600">{(c.positions || [])[0] || '—'}{(c.positions || []).length > 1 ? ` +${(c.positions || []).length - 1}` : ''}</td>
                      <td className="px-4 py-3 text-gray-500">{c.age ?? '—'} · {c.gender ? c.gender[0].toUpperCase() : '—'}</td>
                      <td className="px-4 py-3">{tierPill(c.profile_tier)}</td>
                      <td className="px-4 py-3"><span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stageLabel[c.stage]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* drawer */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-white z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold overflow-hidden" style={{ background: hue(sel.email || sel.full_name) }}>{photos[sel.id] ? <img src={photos[sel.id]} alt="" className="w-full h-full object-cover" /> : ini(sel.full_name)}</span>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D1B35]">{sel.full_name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">{tierPill(sel.profile_tier)}<span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stageLabel[sel.stage]}</span></div>
                </div>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {canAct && (
                <div className="p-5 border-b border-gray-100 space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-1.5">Tier</div>
                    <div className="flex gap-2">{['high', 'medium', 'low'].map(t => <button key={t} onClick={() => save({ profile_tier: t })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${sel.profile_tier === t ? 'bg-[#D4A843] border-[#D4A843] text-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{t}</button>)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-1.5">Stage</div>
                    <div className="flex flex-wrap gap-2">{STAGES.map(s => <button key={s} onClick={() => save({ stage: s })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${sel.stage === s ? 'bg-[#0D1B35] border-[#0D1B35] text-white' : 'border-gray-200 text-gray-500'}`}>{stageLabel[s]}</button>)}</div>
                  </div>
                </div>
              )}

              {/* Demographics — editable at interview */}
              <div className="p-5 border-b border-gray-100 bg-amber-50/40">
                <div className="text-[11px] uppercase tracking-wide text-[#92400E] font-bold mb-2.5">Interview details · internal</div>
                {canAct ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">Gender
                      <select defaultValue={sel.gender || ''} onBlur={e => e.target.value !== (sel.gender || '') && save({ gender: e.target.value || null })} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                        <option value=""></option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                      </select></label>
                    <label className="text-xs text-gray-600">Age
                      <input type="number" defaultValue={sel.age ?? ''} onBlur={e => Number(e.target.value) !== (sel.age ?? NaN) && save({ age: e.target.value ? Number(e.target.value) : null })} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                    <label className="text-xs text-gray-600">Nationality
                      <input defaultValue={sel.nationality || ''} onBlur={e => e.target.value !== (sel.nationality || '') && save({ nationality: e.target.value || null })} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                    <label className="text-xs text-gray-600">Ethnicity
                      <input defaultValue={sel.ethnicity || ''} onBlur={e => e.target.value !== (sel.ethnicity || '') && save({ ethnicity: e.target.value || null })} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Gender: {sel.gender || '—'} · Age: {sel.age ?? '—'}</div>
                    <div>Nationality: {sel.nationality || '—'} · Ethnicity: {sel.ethnicity || '—'}</div>
                  </div>
                )}
              </div>

              <Sec title="Applied for">
                <div className="flex flex-wrap gap-1.5">{(sel.positions || []).map(p => <span key={p} className="text-xs bg-[#0D1B35]/5 text-[#0D1B35] font-medium px-2.5 py-1 rounded-full">{p}</span>)}</div>
                {sel.positions?.includes('Security') && <div className="mt-2 text-xs">Security license: <b>{sel.security_licensed === true ? 'Licensed' : sel.security_licensed === false ? 'Unlicensed' : '—'}</b>{sel.license_path && <button onClick={() => openFile('candidate-licenses', sel.license_path)} className="ml-2 text-blue-600 font-medium">View license</button>}</div>}
              </Sec>
              <Sec title="Contact"><Rw k="Phone" v={sel.phone} /><Rw k="Email" v={sel.email} /></Sec>
              <Sec title="Job fit"><Rw k="Expected pay" v={payText(sel)} /><Rw k="Availability" v={sel.availability} /><Rw k="Transportation" v={sel.transportation} /><Rw k="English" v={sel.english_level} /></Sec>
              <Sec title="Location"><Rw k="Lives in" v={[sel.borough, sel.city, sel.state].filter(Boolean).join(', ')} /><Rw k="Open to work in" v={(sel.work_areas || []).join(', ')} /></Sec>
              {sel.experience && <Sec title="Experience"><p className="text-xs text-gray-600 leading-relaxed bg-[#F5F6FA] rounded-lg p-3">{sel.experience}</p></Sec>}
              <Sec title="Files"><Rw k="Heard via" v={sel.referral_source} />{sel.resume_path ? <button onClick={() => openFile('candidate-resumes', sel.resume_path)} className="mt-1 inline-flex items-center gap-2 bg-[#F5F6FA] border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-[#0D1B35]"><span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PDF</span> View résumé</button> : <div className="text-xs text-gray-400 mt-1">No résumé</div>}</Sec>
            </div>
          </aside>
        </>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="p-5 border-b border-gray-100"><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">{title}</div>{children}</div>
}
function Rw({ k, v }: { k: string; v: string | null | undefined }) {
  return <div className="flex justify-between gap-3 py-1 text-[13px]"><span className="text-gray-500">{k}</span><span className="text-gray-800 font-medium text-right">{v || '—'}</span></div>
}
