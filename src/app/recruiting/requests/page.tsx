'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import RecruitingTabs from '@/components/RecruitingTabs'
import ShareManpower from '@/components/ShareManpower'
import { useRecruitingChrome } from '@/components/RecruitingChrome'
import { useRecruitingLang } from '@/components/recruiting-i18n'

type Req = {
  id: string; seq: number; created_at: string; created_by: string | null; supervisor_name: string | null
  department: string | null; urgency: string | null; position: string | null; building_type: string | null
  gender_pref: string | null; employment: string | null; reason: string | null; site: string | null
  location: string | null; compensation: number | null; start_date: string | null; status: string
  expectation_details: string | null; notes: string | null; transportation: string | null; asana_url: string | null
}
type Item = { id: string; request_id: string; position_name: string | null; count_needed: number }
type Assign = { id: string; request_id: string; candidate_id: string; status: string }
type Cand = { id: string; full_name: string; positions: string[] | null; borough: string | null; photo_path: string | null }

const DEPT_ORDER = ['janitorial', 'concierge', 'security', 'maintenance', 'superintendent', 'parking_attendant', 'other']
const DEPT_LABEL: Record<string, string> = { janitorial: 'Janitorial', concierge: 'Concierge', security: 'Security', maintenance: 'Maintenance', superintendent: 'Superintendent', parking_attendant: 'Parking Attendant', other: 'Other' }
const URG_CLS: Record<string, string> = { immediate: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700', standard: 'bg-gray-100 text-gray-600' }
const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...(s || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export default function RequestsPage() {
  const [supabase] = useState(() => createClient())
  const [reqs, setReqs] = useState<Req[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [assigns, setAssigns] = useState<Assign[]>([])
  const [cands, setCands] = useState<Record<string, Cand>>({})
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [sel, setSel] = useState<Req | null>(null)
  const [toast, setToast] = useState('')
  const { setActions } = useRecruitingChrome()
  const { t } = useRecruitingLang()

  useEffect(() => { setActions(<ShareManpower />); return () => setActions(null) }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role,departments').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter' || (me?.departments || []).includes('recruiting')) }
    const [{ data: r }, { data: it }, { data: a }] = await Promise.all([
      supabase.from('man_power_requests').select('*').order('seq', { ascending: false }),
      supabase.from('man_power_request_items').select('*'),
      supabase.from('man_power_assignments').select('id,request_id,candidate_id,status').in('status', ['assigned', 'selected']),
    ])
    setReqs(r ?? []); setItems(it ?? []); setAssigns(a ?? [])
    const ids = [...new Set((a ?? []).map(x => x.candidate_id))]
    if (ids.length) {
      const { data: cs } = await supabase.from('candidates').select('id,full_name,positions,borough,photo_path').in('id', ids)
      const map: Record<string, Cand> = {}; const ph: Record<string, string> = {}
      for (const c of cs ?? []) { map[c.id] = c as Cand; if (c.photo_path) { const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(c.photo_path, 3600); if (data?.signedUrl) ph[c.id] = data.signedUrl } }
      setCands(map); setPhotos(ph)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2500) }

  const grouped = useMemo(() => {
    const g: Record<string, Req[]> = {}
    for (const r of reqs) { const d = DEPT_LABEL[r.department || ''] ? (r.department || 'other') : 'other'; (g[d] = g[d] || []).push(r) }
    return g
  }, [reqs])
  const itemsFor = (rid: string) => items.filter(i => i.request_id === rid)
  const assignsFor = (rid: string) => assigns.filter(a => a.request_id === rid)
  const neededFor = (rid: string) => itemsFor(rid).reduce((s, i) => s + (i.count_needed || 0), 0)

  async function setStatus(r: Req, status: string) {
    const { error } = await supabase.from('man_power_requests').update({ status }).eq('id', r.id)
    if (error) { flash(t('error') + ': ' + error.message); return }
    setReqs(rs => rs.map(x => x.id === r.id ? { ...x, status } : x)); setSel(s => s && s.id === r.id ? { ...s, status } : s); flash(t('saved'))
  }
  async function unassign(a: Assign) {
    await supabase.from('man_power_assignments').update({ status: 'removed' }).eq('id', a.id)
    await supabase.from('candidates').update({ man_power_request_id: null }).eq('id', a.candidate_id)
    setAssigns(xs => xs.filter(x => x.id !== a.id)); flash(t('remove'))
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="mb-4"><h1 className="text-xl font-semibold text-[#0D1B35]">{t('tab_requests')}</h1><p className="text-xs text-gray-500">{t('requests_sub')}</p></div>
        <RecruitingTabs />
        {loading ? <p className="text-gray-400 text-sm">{t('loading')}</p>
          : reqs.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">{t('no_requests_yet')}</div>
          : DEPT_ORDER.filter(d => grouped[d]?.length).map(d => (
            <div key={d} className="mb-6">
              <div className="flex items-center gap-2 mb-2.5"><h2 className="text-sm font-bold text-[#0D1B35] uppercase tracking-wide">{DEPT_LABEL[d]}</h2><span className="text-xs text-gray-400">{grouped[d].length}</span></div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
                {grouped[d].map(r => {
                  const need = neededFor(r.id); const filled = assignsFor(r.id).length
                  return (
                    <button key={r.id} onClick={() => setSel(r)} className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#0D1B35]">#{r.seq}</span>
                        <div className="flex items-center gap-1.5">
                          {r.urgency && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${URG_CLS[r.urgency] || 'bg-gray-100 text-gray-600'}`}>{t('urgency_' + r.urgency) !== 'urgency_' + r.urgency ? t('urgency_' + r.urgency) : r.urgency}</span>}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{r.status === 'open' ? t('status_open') : t('status_filled')}</span>
                        </div>
                      </div>
                      <div className="font-semibold text-[#0D1B35]">{r.position || '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.supervisor_name || '—'}</div>
                      <div className="text-xs text-gray-400 mt-1">{[r.site, r.location].filter(Boolean).join(' · ') || '—'}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#D4A843]" style={{ width: `${need ? Math.min(100, (filled / need) * 100) : 0}%` }} /></div>
                        <span className="text-[11px] text-gray-500 font-medium">{filled}/{need || 1} {t('needed')}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {sel && (
        <>
          <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[96vw] bg-white z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
              <div className="text-xs font-bold text-[#0D1B35]">#{sel.seq} · {DEPT_LABEL[sel.department || 'other']}</div>
              <h2 className="text-lg font-semibold text-[#0D1B35] mt-0.5">{sel.position}</h2>
              <div className="text-xs text-gray-500">{sel.supervisor_name}</div>
              {sel.asana_url && <a href={sel.asana_url} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-600 font-medium mt-1.5">↗ {t('view_in_asana')}</a>}
            </div>
            <div className="overflow-auto flex-1">
              <div className="p-5 border-b border-gray-100 grid grid-cols-2 gap-y-2 text-[13px]">
                <D k={t('urgency')} v={sel.urgency} /><D k={t('employment_l')} v={sel.employment} />
                <D k={t('building_type_l')} v={sel.building_type} /><D k="Gender" v={sel.gender_pref} />
                <D k={t('reason_l')} v={sel.reason?.replace(/_/g, ' ')} /><D k={t('l_transportation')} v={sel.transportation} />
                <D k={t('site_l')} v={sel.site} /><D k={t('start_date_l')} v={fmtDate(sel.start_date)} />
                <D k={t('compensation')} v={sel.compensation != null ? `$${sel.compensation}/hr` : '—'} /><D k="Location" v={sel.location} />
              </div>
              {sel.expectation_details && <div className="p-5 border-b border-gray-100"><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-1.5">{t('expectations_l')}</div><p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{sel.expectation_details}</p></div>}

              <div className="p-5 border-b border-gray-100">
                <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">{t('assigned_candidates')} · {assignsFor(sel.id).length}/{neededFor(sel.id) || 1}</div>
                {assignsFor(sel.id).length === 0 ? <p className="text-xs text-gray-400">{t('no_assigned')}</p> : (
                  <div className="space-y-2">{assignsFor(sel.id).map(a => { const c = cands[a.candidate_id]; if (!c) return null; return (
                    <div key={a.id} className="flex items-center gap-3 bg-[#F5F6FA] rounded-lg p-2">
                      <span className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold overflow-hidden" style={{ background: hue(c.full_name) }}>{photos[c.id] ? <img src={photos[c.id]} alt="" className="w-full h-full object-cover" /> : ini(c.full_name)}</span>
                      <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-[#0D1B35] truncate">{c.full_name}</div><div className="text-xs text-gray-500">{(c.positions || [])[0] || '—'}{a.status === 'selected' ? ` · ${t('selected_badge')}` : ''}</div></div>
                      {canAct && <button onClick={() => unassign(a)} className="text-xs text-red-500 font-medium">{t('remove')}</button>}
                    </div>
                  ) })}</div>
                )}
                <p className="text-[11px] text-gray-400 mt-3">{t('assign_from_pool')} → {t('tab_pool')}</p>
              </div>

              {canAct && <div className="p-5 flex gap-2">
                {sel.status === 'open'
                  ? <button onClick={() => setStatus(sel, 'filled')} className="flex-1 bg-[#0D1B35] text-white font-semibold py-2.5 rounded-lg">✓ {t('close_request')}</button>
                  : <button onClick={() => setStatus(sel, 'open')} className="flex-1 bg-white border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-lg">↩ {t('reopen_request')}</button>}
              </div>}
            </div>
          </aside>
        </>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}

function D({ k, v }: { k: string; v: string | null | undefined }) { return <div><div className="text-[11px] text-gray-400">{k}</div><div className="text-gray-800 font-medium capitalize">{v || '—'}</div></div> }
