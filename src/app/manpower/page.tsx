'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useRecruitingLang } from '@/components/recruiting-i18n'

const NAVY = '#0D1B35', GOLD = '#D4A843'
const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706']
const ini = (n: string) => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...(s || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]

type Req = { id: string; seq: number; position: string | null; gender_pref: string | null; transportation: string | null; site: string | null; status: string }
type Item = { id: string; request_id: string; count_needed: number }
type Assign = { id: string; request_id: string; candidate_id: string; status: string }
type Cand = any

export default function ManagerBoard() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { t, lang, setLang } = useRecruitingLang()
  const [state, setState] = useState<'loading' | 'pending' | 'ready'>('loading')
  const [me, setMe] = useState<any>(null)
  const [reqs, setReqs] = useState<Req[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [assigns, setAssigns] = useState<Assign[]>([])
  const [cands, setCands] = useState<Record<string, Cand>>({})
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState<{ c: Cand; a: Assign } | null>(null)
  const [when, setWhen] = useState(''); const [mode, setMode] = useState<'call' | 'in_person'>('call'); const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: u } = await supabase.from('app_users').select('*').eq('id', user.id).single()
    setMe(u)
    if (!u || !u.approved || !['manager', 'admin', 'recruiter'].includes(u.role)) { setState('pending'); return }
    const { data: r } = await supabase.from('man_power_requests').select('id,seq,position,gender_pref,transportation,site,status').eq('created_by', user.id).order('seq', { ascending: false })
    const rids = (r ?? []).map(x => x.id)
    let it: Item[] = [], a: Assign[] = []
    if (rids.length) {
      const [{ data: itd }, { data: ad }] = await Promise.all([
        supabase.from('man_power_request_items').select('id,request_id,count_needed').in('request_id', rids),
        supabase.from('man_power_assignments').select('id,request_id,candidate_id,status').in('request_id', rids).in('status', ['assigned', 'selected']),
      ])
      it = itd ?? []; a = ad ?? []
    }
    const cmap: Record<string, Cand> = {}, ph: Record<string, string> = {}
    const cids = [...new Set(a.map(x => x.candidate_id))]
    if (cids.length) {
      const { data: cs } = await supabase.from('candidates').select('*').in('id', cids)
      for (const c of cs ?? []) { cmap[c.id] = c; if (c.photo_path) { const { data } = await supabase.storage.from('candidate-photos').createSignedUrl(c.photo_path, 3600); if (data?.signedUrl) ph[c.id] = data.signedUrl } }
    }
    setReqs(r ?? []); setItems(it); setAssigns(a); setCands(cmap); setPhotos(ph); setState('ready')
  }
  useEffect(() => { load() }, [])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2600) }

  const neededFor = (rid: string) => items.filter(i => i.request_id === rid).reduce((s, i) => s + (i.count_needed || 0), 0) || 1
  const selectedFor = (rid: string) => assigns.filter(a => a.request_id === rid && a.status === 'selected').length
  const reqMap = useMemo(() => Object.fromEntries(reqs.map(r => [r.id, r])), [reqs])
  const reqLabel = (r: Req) => { const g = r.gender_pref === 'female' ? 'Female' : r.gender_pref === 'male' ? 'Male' : 'Any'; const tr = r.transportation ? r.transportation.charAt(0).toUpperCase() + r.transportation.slice(1) : '—'; return `#${r.seq} · ${g} · ${tr} · ${r.position || '—'}` }
  const visible = assigns.filter(a => filter === 'all' || a.request_id === filter)

  function openCand(a: Assign) { const c = cands[a.candidate_id]; if (!c) return; setSel({ c, a }); setWhen(c.final_interview_at ? new Date(c.final_interview_at).toISOString().slice(0, 16) : ''); setMode(c.final_interview_mode || 'call'); setNote(c.final_interview_note || '') }

  async function scheduleFinal() {
    if (!sel || !when) { flash(t('pick_datetime')); return }
    setBusy(true)
    const iso = new Date(when).toISOString()
    await supabase.from('candidates').update({ final_interview_at: iso, final_interview_mode: mode, final_interview_note: note || null, final_interviewer_id: me.id }).eq('id', sel.c.id)
    try { await fetch('/api/final-interview-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: sel.c.id }) }) } catch {}
    setCands(m => ({ ...m, [sel.c.id]: { ...sel.c, final_interview_at: iso, final_interview_mode: mode, final_interview_note: note } }))
    setBusy(false); flash(t('final_scheduled'))
  }
  async function selectCand() {
    if (!sel) return
    const rid = sel.a.request_id
    if (selectedFor(rid) >= neededFor(rid)) { flash(t('slots_full')); return }
    setBusy(true)
    await supabase.from('man_power_assignments').update({ status: 'selected' }).eq('id', sel.a.id)
    await supabase.from('candidates').update({ onboarding_status: 'offer_pending' }).eq('id', sel.c.id)
    const nowSelected = selectedFor(rid) + 1
    if (nowSelected >= neededFor(rid)) {
      await supabase.from('man_power_requests').update({ status: 'filled' }).eq('id', rid)
      const others = assigns.filter(a => a.request_id === rid && a.status === 'assigned' && a.id !== sel.a.id)
      for (const o of others) { await supabase.from('man_power_assignments').update({ status: 'removed' }).eq('id', o.id); await supabase.from('candidates').update({ man_power_request_id: null }).eq('id', o.candidate_id) }
    }
    setBusy(false); setSel(null); flash(t('selected_ok')); load()
  }
  async function declineCand() {
    if (!sel) return
    setBusy(true)
    await supabase.from('man_power_assignments').update({ status: 'removed' }).eq('id', sel.a.id)
    await supabase.from('candidates').update({ man_power_request_id: null }).eq('id', sel.c.id)
    setBusy(false); setSel(null); flash(t('declined_ok')); load()
  }

  if (state === 'loading') return <div className="min-h-screen grid place-items-center bg-[#F5F6FA]"><p className="text-gray-400">{t('loading')}</p></div>
  if (state === 'pending') return <div className="min-h-screen grid place-items-center bg-[#F5F6FA] p-6"><div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl border-t-4" style={{ borderColor: GOLD }}><div className="text-4xl mb-3">⏳</div><h1 className="text-lg font-bold" style={{ color: NAVY }}>Access pending approval</h1><p className="text-sm text-gray-500 mt-2">Signed in as {me?.email}. An administrator must approve your access.</p></div></div>

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div style={{ background: NAVY }} className="text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg grid place-items-center font-bold text-sm" style={{ background: GOLD, color: NAVY }}>B</span>
          <div><div className="font-semibold">{t('mgr_title')}</div><div className="text-[11px] text-white/50">{me?.full_name || me?.email}</div></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">{(['en', 'es'] as const).map(l => <button key={l} onClick={() => setLang(l)} className={`text-xs px-2 py-1 rounded-md font-medium ${lang === l ? 'bg-[#D4A843] text-[#0D1B35]' : 'text-white/60'}`}>{l.toUpperCase()}</button>)}</div>
          <a href="/manpower/new" className="text-sm bg-[#D4A843] text-[#0D1B35] font-semibold rounded-lg px-3 py-1.5">{t('new_request_btn')}</a>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-xs text-white/50 hover:text-white">{t('sign_out')}</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5">
        <p className="text-xs text-gray-500 mb-4">{t('mgr_sub')}</p>
        {reqs.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">{t('mgr_no_requests')}</div> : (<>
          <div className="flex gap-2 flex-wrap mb-5">
            <button onClick={() => setFilter('all')} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filter === 'all' ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-600 border-gray-200'}`}>{t('all_requests')}</button>
            {reqs.map(r => <button key={r.id} onClick={() => setFilter(r.id)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${filter === r.id ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-600 border-gray-200'}`}>{reqLabel(r)} <span className={`text-[10px] rounded-full px-1.5 ${filter === r.id ? 'bg-white/20' : 'bg-gray-100'}`}>{selectedFor(r.id)}/{neededFor(r.id)}</span></button>)}
          </div>

          {visible.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">{t('no_mgr_candidates')}</div> : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
              {visible.map(a => { const c = cands[a.candidate_id]; if (!c) return null; const r = reqMap[a.request_id]; return (
                <button key={a.id} onClick={() => openCand(a)} className="text-left bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="h-40 bg-[#F5F6FA] grid place-items-center overflow-hidden">{photos[c.id] ? <img src={photos[c.id]} alt="" className="w-full h-full object-cover" /> : <span className="w-16 h-16 rounded-full grid place-items-center text-white text-xl font-semibold" style={{ background: hue(c.full_name) }}>{ini(c.full_name)}</span>}</div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5"><div className="font-semibold text-[#0D1B35] truncate">{c.full_name}</div>{a.status === 'selected' && <span className="text-[9px] font-bold bg-[#D4A843]/20 text-[#8A6D1E] rounded-full px-1.5 py-0.5">{t('offer_pending_badge')}</span>}</div>
                    <div className="text-xs text-gray-500 truncate">{(c.positions || [])[0] || '—'} · {c.borough || '—'}</div>
                    {c.final_interview_at && <div className="text-[11px] text-blue-600 mt-1">📅 {new Date(c.final_interview_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>}
                    <div className="text-[10px] text-gray-400 mt-1">#{r?.seq}</div>
                  </div>
                </button>
              ) })}
            </div>
          )}
        </>)}
      </div>

      {sel && (<>
        <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={() => setSel(null)} />
        <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[96vw] bg-white z-30 shadow-2xl flex flex-col">
          <div className="p-5 border-b border-gray-100 relative">
            <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
            <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold overflow-hidden" style={{ background: hue(sel.c.full_name) }}>{photos[sel.c.id] ? <img src={photos[sel.c.id]} alt="" className="w-full h-full object-cover" /> : ini(sel.c.full_name)}</span>
              <div><h2 className="text-lg font-semibold text-[#0D1B35]">{sel.c.full_name}</h2><div className="text-xs text-gray-500">{(sel.c.positions || []).join(', ')}</div></div></div>
          </div>
          <div className="overflow-auto flex-1">
            <div className="p-5 border-b border-gray-100 grid grid-cols-2 gap-y-2 text-[13px]">
              <F k={t('l_phone')} v={sel.c.phone} /><F k={t('l_email')} v={sel.c.email} />
              <F k={t('l_expected_pay')} v={sel.c.expected_pay} /><F k={t('l_availability')} v={sel.c.availability} />
              <F k={t('l_transportation')} v={sel.c.transportation} /><F k={t('l_english')} v={sel.c.english_level} />
              <F k={t('l_lives_in')} v={[sel.c.borough, sel.c.city].filter(Boolean).join(', ')} /><F k={t('l_age')} v={sel.c.age} />
            </div>
            {sel.c.experience && <div className="p-5 border-b border-gray-100"><div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-1.5">{t('s_experience')}</div><p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{sel.c.experience}</p></div>}

            <div className="p-5 border-b border-gray-100">
              <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">{t('schedule_final')}</div>
              <div className="flex gap-2 mb-2">{(['call', 'in_person'] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${mode === m ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{m === 'call' ? t('mode_call') : t('mode_inperson')}</button>)}</div>
              <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2" />
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('final_details_ph')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2" />
              <button disabled={busy} onClick={scheduleFinal} className="w-full bg-[#0D1B35] text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">📨 {t('send_invite')}</button>
              {sel.c.final_interview_at && <div className="text-xs text-blue-700 mt-2">📅 {new Date(sel.c.final_interview_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {sel.c.final_interview_mode === 'in_person' ? t('mode_inperson') : t('mode_call')}</div>}
            </div>

            <div className="p-5 flex gap-2 sticky bottom-0 bg-white border-t border-gray-100">
              <button disabled={busy} onClick={selectCand} className="flex-1 bg-[#D4A843] text-[#0D1B35] font-semibold py-2.5 rounded-lg disabled:opacity-50">✓ {t('select_cand')}</button>
              <button disabled={busy} onClick={declineCand} className="bg-white border border-red-200 text-red-600 font-semibold px-4 rounded-lg disabled:opacity-50">{t('decline_cand')}</button>
            </div>
          </div>
        </aside>
      </>)}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}

function F({ k, v }: { k: string; v: any }) { return <div><div className="text-[11px] text-gray-400">{k}</div><div className="text-gray-800 font-medium">{v || '—'}</div></div> }
