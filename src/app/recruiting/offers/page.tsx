'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import RecruitingTabs from '@/components/RecruitingTabs'

const NAVY = '#0D1B35', GOLD = '#D4A843'
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white'
const lbl = 'block text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1'

type Cand = { id: string; full_name: string; email: string | null; phone: string | null; preferred_lang: string | null; positions: string[] | null; man_power_request_id: string | null; onboarding_status: string | null }
type Req = { id: string; seq: number; position: string | null; start_date: string | null; work_days: string | null; work_hours: string | null; building: string | null; site: string | null; location: string | null; compensation: number | null; supervisor_name: string | null }
type Tmpl = { id: string; position_name: string; duties_en: string[]; duties_es: string[]; active: boolean }
type Offer = {
  id: string; created_at: string; candidate_id: string; request_id: string | null; template_id: string | null
  token: string; lang: string; status: string; letter_date: string | null; position: string | null
  start_date: string | null; schedule: string | null; location: string | null; hourly_rate: number | null
  sign_by: string | null; sent_at: string | null; signed_at: string | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Awaiting signature', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  signed: { label: 'Signed', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-400' },
}
const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...(s || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fmt = (s: string | null) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function OffersPage() {
  const [supabase] = useState(() => createClient())
  const [offers, setOffers] = useState<Offer[]>([])
  const [cands, setCands] = useState<Record<string, Cand>>({})
  const [pending, setPending] = useState<Cand[]>([])
  const [reqs, setReqs] = useState<Record<string, Req>>({})
  const [tmpls, setTmpls] = useState<Tmpl[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<any>(null)   // builder state

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 3000) }

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role, departments').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter' || (me?.departments || []).includes('recruiting')) }

    const [{ data: os }, { data: pc }, { data: rq }, { data: tp }] = await Promise.all([
      supabase.from('offers').select('*').order('created_at', { ascending: false }),
      supabase.from('candidates').select('id, full_name, email, phone, preferred_lang, positions, man_power_request_id, onboarding_status').eq('onboarding_status', 'offer_pending'),
      supabase.from('man_power_requests').select('id, seq, position, start_date, work_days, work_hours, building, site, location, compensation, supervisor_name'),
      supabase.from('offer_templates').select('id, position_name, duties_en, duties_es, active').eq('active', true).order('sort'),
    ])
    const offerList = os ?? []
    setOffers(offerList)
    setReqs(Object.fromEntries((rq ?? []).map((r: any) => [r.id, r])))
    setTmpls((tp ?? []).map((t: any) => ({ ...t, duties_en: t.duties_en || [], duties_es: t.duties_es || [] })))

    // candidates referenced by offers + those pending an offer
    const ids = [...new Set([...offerList.map(o => o.candidate_id), ...(pc ?? []).map((c: any) => c.id)])]
    if (ids.length) {
      const { data: cs } = await supabase.from('candidates').select('id, full_name, email, phone, preferred_lang, positions, man_power_request_id, onboarding_status').in('id', ids)
      setCands(Object.fromEntries((cs ?? []).map((c: any) => [c.id, c])))
    }
    // pending = offer_pending with no live offer yet
    const live = new Set(offerList.filter(o => o.status !== 'withdrawn').map(o => o.candidate_id))
    setPending((pc ?? []).filter((c: any) => !live.has(c.id)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const g: Record<string, Offer[]> = { sent: [], signed: [], draft: [], withdrawn: [] }
    for (const o of offers) (g[o.status] = g[o.status] || []).push(o)
    return g
  }, [offers])

  // ── builder ──────────────────────────────────────────────────────────
  function openBuilder(c: Cand, existing?: Offer) {
    const r = c.man_power_request_id ? reqs[c.man_power_request_id] : null
    const tmpl = tmpls.find(t => t.position_name === (r?.position || (c.positions || [])[0])) || tmpls[0]
    const schedule = r ? [r.work_days, r.work_hours].filter(Boolean).join(' · ') : ''
    const loc = r ? [r.building, r.location, r.site].filter(Boolean).join(', ') : ''
    const inSeven = new Date(); inSeven.setDate(inSeven.getDate() + 7)
    setDraft(existing ? { ...existing, _cand: c, _isNew: false } : {
      _cand: c, _isNew: true,
      candidate_id: c.id, request_id: r?.id ?? null, template_id: tmpl?.id ?? null,
      lang: c.preferred_lang === 'es' ? 'es' : 'en',
      letter_date: iso(new Date()),
      position: r?.position || (c.positions || [])[0] || '',
      start_date: r?.start_date || '',
      schedule, location: loc,
      hourly_rate: r?.compensation ?? '',
      sign_by: iso(inSeven),
    })
  }
  const setD = (k: string, v: any) => setDraft((p: any) => ({ ...p, [k]: v }))

  async function saveDraft(send: boolean) {
    if (!draft) return
    if (!draft.position || !draft.start_date || !draft.hourly_rate) { flash('Position, start date and hourly rate are required'); return }
    if (send && !draft._cand.email) { flash('This candidate has no email address'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const row: any = {
      candidate_id: draft.candidate_id, request_id: draft.request_id, template_id: draft.template_id,
      lang: draft.lang, letter_date: draft.letter_date, position: draft.position,
      start_date: draft.start_date, schedule: draft.schedule || null, location: draft.location || null,
      hourly_rate: Number(draft.hourly_rate), sign_by: draft.sign_by || null,
    }
    let offerId = draft.id
    if (draft._isNew) {
      row.created_by = user?.id ?? null
      const { data, error } = await supabase.from('offers').insert(row).select('id').single()
      if (error) { setBusy(false); flash('Error: ' + error.message); return }
      offerId = data.id
    } else {
      const { error } = await supabase.from('offers').update(row).eq('id', offerId)
      if (error) { setBusy(false); flash('Error: ' + error.message); return }
    }

    if (send) {
      const r = await fetch('/api/offer-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: offerId }) })
      const j = await r.json().catch(() => ({}))
      setBusy(false)
      if (!r.ok) { flash('Could not send: ' + (j.error || 'unknown')); return }
      flash(j.email ? 'Offer sent to ' + draft._cand.email : 'Offer marked sent (email not configured)')
    } else { setBusy(false); flash('Draft saved') }
    setDraft(null); load()
  }

  async function withdraw(o: Offer) {
    if (!confirm('Withdraw this offer? The signing link will stop working.')) return
    await supabase.from('offers').update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() }).eq('id', o.id)
    flash('Offer withdrawn'); load()
  }
  async function copyLink(o: Offer) {
    const url = `${window.location.origin}/offer/${o.token}`
    try { await navigator.clipboard.writeText(url); flash('Signing link copied') } catch { flash(url) }
  }

  const tmplFor = (id: string | null) => tmpls.find(t => t.id === id)

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h1 className="text-xl font-semibold text-[#0D1B35]">Offers</h1><p className="text-xs text-gray-500">Conditional offer letters · build, send, track signatures</p></div>
          <a href="/recruiting/offers/settings" className="text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 font-semibold text-[#0D1B35] whitespace-nowrap">⚙ Settings</a>
        </div>
        <RecruitingTabs />

        {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (<>
          {/* Awaiting an offer */}
          <Section title="Ready for an offer" count={pending.length}>
            {pending.length === 0 ? <Empty>No selected candidates waiting on an offer. Managers send them here by selecting a candidate on a manpower request.</Empty> : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
                {pending.map(c => {
                  const r = c.man_power_request_id ? reqs[c.man_power_request_id] : null
                  return (
                    <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: hue(c.full_name) }}>{ini(c.full_name)}</span>
                        <div className="min-w-0"><div className="font-semibold text-[#0D1B35] truncate">{c.full_name}</div><div className="text-xs text-gray-500 truncate">{r ? `#${r.seq} · ${r.position}` : (c.positions || [])[0] || '—'}</div></div>
                      </div>
                      {canAct && <button onClick={() => openBuilder(c)} className="w-full text-sm font-semibold py-2 rounded-lg" style={{ background: GOLD, color: NAVY }}>Create offer letter</button>}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {(['sent', 'signed', 'draft', 'withdrawn'] as const).filter(k => grouped[k]?.length).map(k => (
            <Section key={k} title={STATUS_META[k].label} count={grouped[k].length}>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">Lang</th><th className="px-4 py-3">{k === 'signed' ? 'Signed' : 'Sent'}</th><th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>{grouped[k].map(o => { const c = cands[o.candidate_id]; return (
                    <tr key={o.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full grid place-items-center text-white text-[10px] font-semibold" style={{ background: hue(c?.full_name || '') }}>{ini(c?.full_name || '?')}</span><span className="font-semibold text-[#0D1B35]">{c?.full_name || '—'}</span></div></td>
                      <td className="px-4 py-3 text-gray-600">{o.position || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{o.hourly_rate != null ? `$${o.hourly_rate}/hr` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(o.start_date)}</td>
                      <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{(o.lang || 'en').toUpperCase()}</span></td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt((o.signed_at || o.sent_at || '').slice(0, 10) || null)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canAct && o.status === 'draft' && <button onClick={() => c && openBuilder(c, o)} className="text-xs font-semibold text-[#0D1B35] mr-3">Edit</button>}
                        {o.status === 'sent' && <><button onClick={() => copyLink(o)} className="text-xs font-semibold text-blue-600 mr-3">Copy link</button><button onClick={() => withdraw(o)} className="text-xs text-red-500 mr-3">Withdraw</button></>}
                        {o.status === 'signed' && <a href={`/offer/${o.token}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600">View</a>}
                      </td>
                    </tr>
                  ) })}</tbody>
                </table>
              </div>
            </Section>
          ))}
        </>)}
      </div>

      {/* Builder */}
      {draft && (<>
        <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={() => setDraft(null)} />
        <aside className="fixed top-0 right-0 h-screen w-[480px] max-w-[96vw] bg-white z-30 shadow-2xl flex flex-col">
          <div className="p-5 border-b border-gray-100 relative">
            <button onClick={() => setDraft(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
            <div className="text-xs font-bold text-[#0D1B35]">Offer letter</div>
            <h2 className="text-lg font-semibold text-[#0D1B35]">{draft._cand.full_name}</h2>
            <div className="text-xs text-gray-500">{draft._cand.email || <span className="text-red-500">No email on file</span>}</div>
          </div>

          <div className="overflow-auto flex-1 p-5 space-y-4">
            <div className="bg-[#F5F6FA] rounded-lg p-3 text-[11px] text-gray-500">Pre-filled from the candidate and their manpower request. Edit anything for this letter — the shared wording lives in <a href="/recruiting/offers/settings" className="text-blue-600 font-medium">Settings</a>.</div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Language</label><select className={inp} value={draft.lang} onChange={e => setD('lang', e.target.value)}><option value="en">English</option><option value="es">Español</option></select></div>
              <div><label className={lbl}>Letter date</label><input type="date" className={inp} value={draft.letter_date || ''} onChange={e => setD('letter_date', e.target.value)} /></div>
            </div>

            <div>
              <label className={lbl}>Position template</label>
              <select className={inp} value={draft.template_id || ''} onChange={e => { const t = tmplFor(e.target.value); setD('template_id', e.target.value); if (t) setD('position', t.position_name) }}>
                <option value="">— none —</option>
                {tmpls.map(t => <option key={t.id} value={t.id}>{t.position_name}</option>)}
              </select>
              {(() => { const t = tmplFor(draft.template_id); const duties = draft.lang === 'es' ? t?.duties_es : t?.duties_en
                return !t ? null : duties && duties.length ? <p className="text-[11px] text-emerald-600 mt-1">✓ {duties.length} duties will be included</p>
                  : <p className="text-[11px] text-amber-600 mt-1">⚠ No duties set for this template in {draft.lang === 'es' ? 'Spanish' : 'English'} — add them in Settings.</p> })()}
            </div>

            <div><label className={lbl}>Position (as printed)</label><input className={inp} value={draft.position || ''} onChange={e => setD('position', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Start date</label><input type="date" className={inp} value={draft.start_date || ''} onChange={e => setD('start_date', e.target.value)} /></div>
              <div><label className={lbl}>Hourly rate ($)</label><input type="number" step="0.01" className={inp} value={draft.hourly_rate ?? ''} onChange={e => setD('hourly_rate', e.target.value)} /></div>
            </div>
            <div><label className={lbl}>Schedule</label><input className={inp} placeholder="e.g. Mon–Fri, 20 hrs/week" value={draft.schedule || ''} onChange={e => setD('schedule', e.target.value)} /></div>
            <div><label className={lbl}>Location</label><input className={inp} value={draft.location || ''} onChange={e => setD('location', e.target.value)} /></div>
            <div><label className={lbl}>Sign by</label><input type="date" className={inp} value={draft.sign_by || ''} onChange={e => setD('sign_by', e.target.value)} /></div>
          </div>

          <div className="p-5 border-t border-gray-100 flex gap-2">
            <button disabled={busy} onClick={() => saveDraft(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-lg disabled:opacity-50">Save draft</button>
            <button disabled={busy} onClick={() => saveDraft(true)} className="flex-1 font-semibold py-2.5 rounded-lg disabled:opacity-50" style={{ background: GOLD, color: NAVY }}>{busy ? 'Sending…' : '✉ Send to candidate'}</button>
          </div>
        </aside>
      </>)}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <div className="mb-6"><div className="flex items-center gap-2 mb-2.5"><h2 className="text-sm font-bold text-[#0D1B35]">{title}</h2><span className="text-xs text-gray-400">{count}</span></div>{children}</div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500 text-sm">{children}</div>
}
