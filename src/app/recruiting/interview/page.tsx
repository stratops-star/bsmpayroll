'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Candidate = {
  id: string; created_at: string; interview_at: string | null; full_name: string; phone: string | null; email: string | null
  preferred_lang: string; positions: string[] | null; borough: string | null; city: string | null; state: string | null
  pay_min: number | null; pay_max: number | null; expected_pay: string | null; transportation: string | null; availability: string | null
  english_level: string | null; experience: string | null; strengths: string | null; profile_tier: string | null
  gender: string | null; age: number | null; nationality: string | null; ethnicity: string | null
  time_in_usa: string | null; has_tax_id: boolean | null; has_ss: boolean | null; has_bank_account: boolean | null
  photo_path: string | null; video_path: string | null; resume_path: string | null
}

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function Tabs() {
  const items = [['New Queue', '/recruiting'], ['Interview', '/recruiting/interview'], ['Candidate Pool', '/recruiting/pool'], ['Rejected', '/recruiting/rejected']]
  return <div className="flex gap-1 mt-3 flex-wrap">{items.map(([l, h]) => <a key={h} href={h} className={`text-sm px-3 py-1.5 rounded-lg ${l === 'Interview' ? 'bg-white/15 text-white font-medium' : 'text-white/55 hover:text-white'}`}>{l}</a>)}</div>
}

export default function InterviewPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [sel, setSel] = useState<Candidate | null>(null)
  const [when, setWhen] = useState('')
  const [media, setMedia] = useState<{ photo?: string; video?: string }>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter') }
    const { data } = await supabase.from('candidates').select('*').eq('status', 'interview').order('interview_at', { ascending: true, nullsFirst: true })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2800) }
  async function signed(bucket: string, path: string | null) { if (!path) return undefined; const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600); return data?.signedUrl }

  async function open(c: Candidate) {
    setSel(c); setWhen(c.interview_at ? new Date(c.interview_at).toISOString().slice(0, 16) : '')
    setMedia({ photo: await signed('candidate-photos', c.photo_path), video: await signed('candidate-videos', c.video_path) })
  }
  async function save(patch: Partial<Candidate>) {
    if (!sel) return
    const { error } = await supabase.from('candidates').update(patch).eq('id', sel.id)
    if (error) { flash('Error: ' + error.message); return }
    const u = { ...sel, ...patch }; setSel(u); setRows(rs => rs.map(r => r.id === sel.id ? u : r)); flash('Saved')
  }
  async function scheduleAndNotify() {
    if (!sel || !when) { flash('Pick a date and time first'); return }
    setBusy(true)
    const iso = new Date(when).toISOString()
    await save({ interview_at: iso } as any)
    try {
      const r = await fetch('/api/interview-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, when: fmtWhen(iso) }) })
      const j = await r.json()
      const bits = [j.sms ? 'text sent' : 'text skipped', j.email ? 'email sent' : 'email skipped']
      flash('Scheduled — ' + bits.join(', '))
    } catch { flash('Scheduled (message not sent)') }
    setBusy(false)
  }
  async function uploadMedia(kind: 'photo' | 'video', file: File | null) {
    if (!sel || !file) return
    setBusy(true)
    const bucket = kind === 'photo' ? 'candidate-photos' : 'candidate-videos'
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${sel.id}-${kind}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) { flash('Upload failed: ' + error.message); setBusy(false); return }
    await save({ [kind === 'photo' ? 'photo_path' : 'video_path']: path } as any)
    setMedia(m => ({ ...m, [kind]: undefined }))
    const url = await signed(bucket, path); setMedia(m => ({ ...m, [kind]: url }))
    setBusy(false)
  }
  async function moveToPool() {
    if (!sel) return; setBusy(true)
    const { error } = await supabase.from('candidates').update({ status: 'in_pool', in_pool: true, stage: 'available' }).eq('id', sel.id)
    setBusy(false); if (error) { flash('Error: ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash('Moved to Candidate Pool')
  }
  async function reject() {
    if (!sel) return; setBusy(true)
    const { error } = await supabase.from('candidates').update({ status: 'rejected', stage: 'rejected' }).eq('id', sel.id)
    setBusy(false); if (error) { flash('Error: ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash('Moved to Rejected')
  }

  const yn = (b: boolean | null) => b === true ? 'Yes' : b === false ? 'No' : ''
  const YNField = ({ label, val, onSet }: { label: string; val: boolean | null; onSet: (b: boolean | null) => void }) => (
    <div><div className="text-xs text-gray-600 mb-1">{label}</div><div className="flex gap-1.5">
      {[['Yes', true], ['No', false]].map(([l, v]) => <button key={l as string} onClick={() => onSet(v as boolean)} className={`text-xs font-semibold px-3 py-1 rounded-full border ${val === v ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{l}</button>)}
    </div></div>
  )

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="bg-[#0D1B35] text-white px-6 py-4 border-b-[3px] border-[#D4A843]">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <a href="/hub" className="text-white/50 text-sm">← Hub</a>
          <div><div className="text-lg font-semibold">Interview</div><div className="text-xs text-white/50">Schedule, interview, capture details</div></div>
        </div>
        <div className="max-w-5xl mx-auto"><Tabs /></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? <p className="text-gray-400 text-sm">Loading…</p>
          : rows.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">No candidates in interview stage. Send someone here from the New Queue.</div>
          : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {rows.map(c => (
                <button key={c.id} onClick={() => open(c)} className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: hue(c.email || c.full_name) }}>{ini(c.full_name)}</span>
                    <div><div className="font-semibold text-[#0D1B35]">{c.full_name}</div><div className="text-xs text-gray-500">{(c.positions || [])[0] || '—'}</div></div>
                  </div>
                  <div className={`text-xs font-medium px-2.5 py-1 rounded-lg inline-block ${c.interview_at ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{c.interview_at ? `📅 ${fmtWhen(c.interview_at)}` : '⏳ Not scheduled'}</div>
                </button>
              ))}
            </div>
          )}
      </div>

      {sel && (
        <>
          <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[96vw] bg-white z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
              <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold overflow-hidden" style={{ background: hue(sel.email || sel.full_name) }}>{media.photo ? <img src={media.photo} alt="" className="w-full h-full object-cover" /> : ini(sel.full_name)}</span>
                <div><h2 className="text-lg font-semibold text-[#0D1B35]">{sel.full_name}</h2><div className="text-xs text-gray-500">{(sel.positions || []).join(', ')}</div></div></div>
            </div>
            <div className="overflow-auto flex-1">
              {canAct && (
                <div className="p-5 border-b border-gray-100">
                  <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2">Schedule interview</div>
                  <div className="flex gap-2">
                    <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <button disabled={busy} onClick={scheduleAndNotify} className="bg-[#0D1B35] text-white text-sm font-semibold px-4 rounded-lg disabled:opacity-50">Save & notify</button>
                  </div>
                  {sel.interview_at && <div className="text-xs text-blue-700 mt-2">📅 Scheduled for {fmtWhen(sel.interview_at)}</div>}
                  <div className="text-[11px] text-gray-400 mt-1">Sends a text + email to the candidate (if messaging is configured).</div>
                </div>
              )}

              {/* Internal details */}
              <div className="p-5 border-b border-gray-100 bg-amber-50/40">
                <div className="text-[11px] uppercase tracking-wide text-[#92400E] font-bold mb-2.5">Internal details</div>
                {canAct ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-gray-600">Gender<select defaultValue={sel.gender || ''} onBlur={e => e.target.value !== (sel.gender || '') && save({ gender: e.target.value || null } as any)} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"><option value=""></option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
                      <label className="text-xs text-gray-600">Age<input type="number" defaultValue={sel.age ?? ''} onBlur={e => Number(e.target.value) !== (sel.age ?? NaN) && save({ age: e.target.value ? Number(e.target.value) : null } as any)} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs text-gray-600">Nationality<input defaultValue={sel.nationality || ''} onBlur={e => e.target.value !== (sel.nationality || '') && save({ nationality: e.target.value || null } as any)} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs text-gray-600">Ethnicity<input defaultValue={sel.ethnicity || ''} onBlur={e => e.target.value !== (sel.ethnicity || '') && save({ ethnicity: e.target.value || null } as any)} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs text-gray-600 col-span-2">Time in USA<input defaultValue={sel.time_in_usa || ''} onBlur={e => e.target.value !== (sel.time_in_usa || '') && save({ time_in_usa: e.target.value || null } as any)} className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <YNField label="Tax ID" val={sel.has_tax_id} onSet={b => save({ has_tax_id: b } as any)} />
                      <YNField label="SS" val={sel.has_ss} onSet={b => save({ has_ss: b } as any)} />
                      <YNField label="Bank Acct" val={sel.has_bank_account} onSet={b => save({ has_bank_account: b } as any)} />
                    </div>
                  </div>
                ) : <div className="text-xs text-gray-600 space-y-1">
                  <div>Gender: {sel.gender || '—'} · Age: {sel.age ?? '—'} · {sel.nationality || '—'} / {sel.ethnicity || '—'}</div>
                  <div>Time in USA: {sel.time_in_usa || '—'} · Tax ID: {yn(sel.has_tax_id) || '—'} · SS: {yn(sel.has_ss) || '—'} · Bank: {yn(sel.has_bank_account) || '—'}</div>
                </div>}
              </div>

              {/* Media */}
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

              {/* read-only context */}
              <Sec title="Job fit"><Rw k="Expected pay" v={sel.expected_pay || (sel.pay_min != null ? `$${sel.pay_min}–${sel.pay_max}/hr` : '—')} /><Rw k="Availability" v={sel.availability} /><Rw k="Transportation" v={sel.transportation} /><Rw k="English" v={sel.english_level} /><Rw k="Lives in" v={[sel.borough, sel.city].filter(Boolean).join(', ')} /></Sec>
              {sel.experience && <Sec title="Experience"><p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{sel.experience}</p></Sec>}

              {canAct && (
                <div className="p-5 flex gap-2 sticky bottom-0 bg-white border-t border-gray-100">
                  <button disabled={busy} onClick={moveToPool} className="flex-1 bg-[#D4A843] text-[#0D1B35] font-semibold py-2.5 rounded-lg disabled:opacity-50">✓ Move to Pool</button>
                  <button disabled={busy} onClick={reject} className="bg-white border border-red-200 text-red-600 font-semibold px-4 rounded-lg disabled:opacity-50">Reject</button>
                </div>
              )}
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
