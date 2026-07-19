'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import RecruitingTabs from '@/components/RecruitingTabs'
import { useRecruitingLang, SourceBadge } from '@/components/recruiting-i18n'
import { SearchSelect, YearsMonths } from '@/components/SearchSelect'
import { NATIONALITIES, ETHNICITIES } from '@/lib/recruiting-data'

type Candidate = {
  id: string; created_at: string; interview_at: string | null; interviewer_id: string | null; full_name: string; phone: string | null; email: string | null
  preferred_lang: string; positions: string[] | null; borough: string | null; city: string | null; state: string | null
  pay_min: number | null; pay_max: number | null; expected_pay: string | null; transportation: string | null; availability: string | null
  english_level: string | null; experience: string | null; strengths: string | null; profile_tier: string | null
  gender: string | null; age: number | null; nationality: string | null; ethnicity: string | null
  time_in_usa: string | null; has_tax_id: boolean | null; has_ss: boolean | null; has_bank_account: boolean | null
  photo_path: string | null; video_path: string | null; resume_path: string | null
}
type AppUser = { id: string; full_name: string | null; email: string; phone: string | null; role: string }

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })

function bucketOf(iso: string | null): string {
  if (!iso) return 'unscheduled'
  const d = new Date(iso), now = new Date()
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((day.getTime() - today.getTime()) / 864e5)
  if (diff < 0) return 'past'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 7) return 'week'
  return 'later'
}
const GROUPS: [string, string][] = [['past', 'g_past'], ['today', 'g_today'], ['tomorrow', 'g_tomorrow'], ['week', 'g_week'], ['later', 'g_later'], ['unscheduled', 'g_unscheduled']]


export default function InterviewStage({ kind }: { kind: 'virtual' | 'inperson' }) {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sel, setSel] = useState<Candidate | null>(null)
  const [when, setWhen] = useState('')
  const [media, setMedia] = useState<{ photo?: string; video?: string }>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])
  const { t, lang } = useRecruitingLang()

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter'); setIsAdmin(me?.role === 'admin') }
    let query = supabase.from('candidates').select('*').eq('status', 'interview')
    query = kind === 'inperson' ? query.eq('stage', '2nd_interview') : query.neq('stage', '2nd_interview')
    const [{ data: cands }, { data: us }] = await Promise.all([
      query.order('interview_at', { ascending: true, nullsFirst: false }),
      supabase.from('app_users').select('id, full_name, email, phone, role').eq('active', true).in('role', ['admin', 'recruiter', 'manager']),
    ])
    setRows(cands ?? []); setUsers(us ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [kind])

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2800) }
  async function signed(bucket: string, path: string | null) { if (!path) return undefined; const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600); return data?.signedUrl }
  async function open(c: Candidate) { setSel(c); setWhen(c.interview_at ? new Date(c.interview_at).toISOString().slice(0, 16) : ''); setMedia({ photo: await signed('candidate-photos', c.photo_path), video: await signed('candidate-videos', c.video_path) }) }
  async function save(patch: Partial<Candidate>) { if (!sel) return; const { error } = await supabase.from('candidates').update(patch).eq('id', sel.id); if (error) { flash(t('error') + ': ' + error.message); return }; const u = { ...sel, ...patch }; setSel(u); setRows(rs => rs.map(r => r.id === sel.id ? u : r)); flash(t('saved')) }

  async function scheduleAndNotify() {
    if (!sel || !when) { flash(t('pick_datetime')); return }
    setBusy(true); const iso = new Date(when).toISOString(); await save({ interview_at: iso } as any)
    try { const r = await fetch('/api/interview-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, when: fmtWhen(iso), kind }) }); const j = await r.json(); flash(t('scheduled') + ' — ' + [j.sms ? t('text_sent') : t('text_skip'), j.email ? t('email_sent') : t('email_skip')].join(', ')) } catch { flash(t('scheduled_no_msg')) }
    setBusy(false)
  }
  async function setInterviewerPhone(uid: string, phone: string) {
    const { error } = await supabase.from('app_users').update({ phone: phone || null }).eq('id', uid)
    if (error) { flash(t('phone_save_err') + ': ' + error.message); return }
    setUsers(us => us.map(u => u.id === uid ? { ...u, phone: phone || null } : u)); flash(t('phone_saved'))
  }
  async function uploadMedia(kind: 'photo' | 'video', file: File | null) {
    if (!sel || !file) return; setBusy(true)
    const bucket = kind === 'photo' ? 'candidate-photos' : 'candidate-videos'; const ext = file.name.split('.').pop() || 'bin'; const path = `${sel.id}-${kind}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
    if (error) { flash(t('upload_failed') + ': ' + error.message); setBusy(false); return }
    await save({ [kind === 'photo' ? 'photo_path' : 'video_path']: path } as any); const url = await signed(bucket, path); setMedia(m => ({ ...m, [kind]: url })); setBusy(false)
  }
  async function moveToPool() { if (!sel) return; setBusy(true); const { error } = await supabase.from('candidates').update({ status: 'in_pool', in_pool: true, stage: 'available' }).eq('id', sel.id); setBusy(false); if (error) { flash(t('error') + ': ' + error.message); return }; setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash(t('moved_pool')) }
  async function moveToInPerson() { if (!sel) return; setBusy(true); const { error } = await supabase.from('candidates').update({ stage: '2nd_interview', interview_at: null, interviewer_id: null }).eq('id', sel.id); setBusy(false); if (error) { flash(t('error') + ': ' + error.message); return }; setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash(t('move_to_inperson')) }
  async function reject() { if (!sel) return; setBusy(true); const { error } = await supabase.from('candidates').update({ status: 'rejected', stage: 'rejected' }).eq('id', sel.id); setBusy(false); if (error) { flash(t('error') + ': ' + error.message); return }; setRows(rs => rs.filter(r => r.id !== sel.id)); setSel(null); flash(t('moved_rejected')) }

  const grouped = useMemo(() => { const g: Record<string, Candidate[]> = {}; for (const c of rows) { const b = bucketOf(c.interview_at); (g[b] = g[b] || []).push(c) } return g }, [rows])
  const yn = (b: boolean | null) => b === true ? 'Yes' : b === false ? 'No' : ''
  const interviewerName = (id: string | null) => id ? (userMap[id]?.full_name || userMap[id]?.email || 'Assigned') : null

  return (
    <div className="min-h-screen bsm-app">
      <div className="max-w-5xl mx-auto px-6 py-5">
        <div className="mb-4"><h1 className="text-xl font-semibold text-[var(--text-strong)]">{kind === 'inperson' ? t('tab_inperson') : t('tab_virtual')} · {t('tab_interview')}</h1><p className="text-xs text-[var(--muted)]">{kind === 'inperson' ? t('inperson_sub') : t('virtual_sub')}</p></div>
        <RecruitingTabs />
        {loading ? <p className="text-[var(--faint)] text-sm">{t('loading')}</p>
          : rows.length === 0 ? <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center text-[var(--muted)]">{kind === 'inperson' ? t('no_inperson') : t('no_virtual')}</div>
          : GROUPS.filter(([k]) => grouped[k]?.length).map(([k, label]) => (
            <div key={k} className="mb-6">
              <div className="flex items-center gap-2 mb-2.5"><h2 className="text-sm font-bold text-[var(--text)]">{t(label)}</h2><span className="text-xs text-[var(--faint)]">{grouped[k].length}</span></div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
                {grouped[k].map(c => (
                  <button key={c.id} onClick={() => open(c)} className="text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: hue(c.email || c.full_name) }}>{ini(c.full_name)}</span>
                      <div><div className="font-semibold text-[var(--text)] flex items-center gap-2">{c.full_name}<SourceBadge channel={(c as any).intake_channel} /></div><div className="text-xs text-[var(--muted)]">{(c.positions || [])[0] || '—'}</div></div>
                    </div>
                    <div className={`text-xs font-medium px-2.5 py-1 rounded-lg inline-block ${c.interview_at ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{c.interview_at ? `📅 ${k === 'today' || k === 'tomorrow' ? fmtTime(c.interview_at) : fmtWhen(c.interview_at)}` : `⏳ ${t('not_scheduled')}`}</div>
                    <div className="text-[11px] text-[var(--muted)] mt-1.5">{interviewerName(c.interviewer_id) ? <>👤 {interviewerName(c.interviewer_id)}</> : <span className="text-amber-600">{t('no_interviewer')}</span>}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      {sel && (
        <>
          <div className="fixed inset-0 bg-black/60 z-20" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[96vw] bg-[var(--surface)] z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-[var(--border)] relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-[var(--raise)] text-[var(--muted)]">✕</button>
              <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold overflow-hidden" style={{ background: hue(sel.email || sel.full_name) }}>{media.photo ? <img src={media.photo} alt="" className="w-full h-full object-cover" /> : ini(sel.full_name)}</span>
                <div><h2 className="text-lg font-semibold text-[var(--text-strong)]">{sel.full_name}</h2><div className="text-xs text-[var(--muted)] flex items-center gap-2">{(sel.positions || []).join(', ')}<SourceBadge channel={(sel as any).intake_channel} /></div></div></div>
            </div>
            <div className="overflow-auto flex-1">
              {canAct && (
                <div className="p-5 border-b border-[var(--border)] space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2">{t('schedule_interview')}</div>
                    <div className="flex gap-2">
                      <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
                      <button disabled={busy} onClick={scheduleAndNotify} className="bg-[var(--gold)] text-[var(--on-gold)] text-sm font-semibold px-4 rounded-lg disabled:opacity-50">{t('save_notify')}</button>
                    </div>
                    {sel.interview_at && <div className="text-xs text-blue-700 mt-2">📅 {fmtWhen(sel.interview_at)}</div>}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-1.5">{t('interviewer')}</div>
                    <select value={sel.interviewer_id || ''} onChange={e => save({ interviewer_id: e.target.value || null } as any)} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)]">
                      <option value="">{t('unassigned')}</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                    </select>
                    {sel.interviewer_id && isAdmin && !userMap[sel.interviewer_id]?.phone && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <div className="text-[11px] text-amber-800 mb-1">{t('add_phone_hint')}</div>
                        <input placeholder={t('phone_num_ph')} onBlur={e => e.target.value && setInterviewerPhone(sel.interviewer_id!, e.target.value)} className="w-full border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm" />
                      </div>
                    )}
                    {sel.interviewer_id && userMap[sel.interviewer_id]?.phone && <div className="text-[11px] text-[var(--faint)] mt-1">{t('agenda_to')} {userMap[sel.interviewer_id]?.email} · {userMap[sel.interviewer_id]?.phone}</div>}
                  </div>
                </div>
              )}

              <div className="p-5 border-b border-[var(--border)] bg-amber-50/40">
                <div className="text-[11px] uppercase tracking-wide text-[#92400E] font-bold mb-2.5">{t('s_internal')}</div>
                {canAct ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-[var(--muted)]">{t('l_gender')}<select defaultValue={sel.gender || ''} onBlur={e => e.target.value !== (sel.gender || '') && save({ gender: e.target.value || null } as any)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"><option value=""></option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
                      <label className="text-xs text-[var(--muted)]">{t('l_age')}<input type="number" defaultValue={sel.age ?? ''} onBlur={e => Number(e.target.value) !== (sel.age ?? NaN) && save({ age: e.target.value ? Number(e.target.value) : null } as any)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm" /></label>
                      <div className="text-xs text-[var(--muted)]">{t('l_nationality')}<div className="mt-1"><SearchSelect value={sel.nationality} onChange={v => save({ nationality: v || null } as any)} options={NATIONALITIES} placeholder={t('ph_nationality')} /></div></div>
                      <div className="text-xs text-[var(--muted)]">{t('l_ethnicity')}<div className="mt-1"><SearchSelect value={sel.ethnicity} onChange={v => save({ ethnicity: v || null } as any)} options={ETHNICITIES} placeholder={t('ph_ethnicity')} /></div></div>
                      <div className="text-xs text-[var(--muted)] col-span-2">{t('l_time_usa')}<div className="mt-1"><YearsMonths value={sel.time_in_usa} onSave={v => save({ time_in_usa: v || null } as any)} yearsLabel={t('years')} monthsLabel={t('months')} /></div></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {([[t('l_taxid'), 'has_tax_id'], [t('l_ss'), 'has_ss'], [t('l_bank'), 'has_bank_account']] as [string, keyof Candidate][]).map(([label, key]) => (
                        <div key={key}><div className="text-xs text-[var(--muted)] mb-1">{label}</div><div className="flex gap-1.5">{[[t('tax_yes'), true], [t('tax_no'), false]].map(([l, v]) => <button key={l as string} onClick={() => save({ [key]: v } as any)} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${sel[key] === v ? 'bg-[var(--gold)] text-[var(--on-gold)] border-[var(--gold)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{l}</button>)}</div></div>
                      ))}
                    </div>
                  </div>
                ) : <div className="text-xs text-[var(--muted)] space-y-1"><div>{t('l_gender')}: {sel.gender || '—'} · {t('l_age')}: {sel.age ?? '—'} · {sel.nationality || '—'} / {sel.ethnicity || '—'}</div><div>{t('l_time_usa')}: {sel.time_in_usa || '—'} · {t('l_taxid')}: {yn(sel.has_tax_id) || '—'} · {t('l_ss')}: {yn(sel.has_ss) || '—'} · {t('l_bank')}: {yn(sel.has_bank_account) || '—'}</div></div>}
              </div>

              {canAct && (
                <div className="p-5 border-b border-[var(--border)]">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2.5">{t('l_photo_video')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>{media.photo ? <img src={media.photo} alt="" className="w-full h-32 object-cover rounded-lg mb-1.5" /> : <div className="w-full h-32 bg-[var(--raise)] rounded-lg grid place-items-center text-[var(--faint)] text-xs mb-1.5">{t('no_photo')}</div>}<label className="text-xs text-[var(--text)] font-medium cursor-pointer">{media.photo ? t('replace_photo') : t('add_photo')}<input type="file" accept="image/*" className="hidden" onChange={e => uploadMedia('photo', e.target.files?.[0] || null)} /></label></div>
                    <div>{media.video ? <video src={media.video} controls className="w-full h-32 object-cover rounded-lg mb-1.5 bg-black" /> : <div className="w-full h-32 bg-[var(--raise)] rounded-lg grid place-items-center text-[var(--faint)] text-xs mb-1.5">{t('no_video')}</div>}<label className="text-xs text-[var(--text)] font-medium cursor-pointer">{media.video ? t('replace_video') : t('add_video')}<input type="file" accept="video/*" className="hidden" onChange={e => uploadMedia('video', e.target.files?.[0] || null)} /></label></div>
                  </div>
                </div>
              )}

              <Sec title={t('s_job_fit')}><Rw k={t('l_expected_pay')} v={sel.expected_pay || (sel.pay_min != null ? `$${sel.pay_min}–${sel.pay_max}/hr` : '—')} /><Rw k={t('l_availability')} v={sel.availability} /><Rw k={t('l_transportation')} v={sel.transportation} /><Rw k={t('l_english')} v={sel.english_level} /><Rw k={t('l_lives_in')} v={[sel.borough, sel.city].filter(Boolean).join(', ')} /></Sec>
              {sel.experience && <Sec title={t('s_experience')}><p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-line">{sel.experience}</p></Sec>}

              {canAct && <div className="p-5 flex gap-2 sticky bottom-0 bg-[var(--surface)] border-t border-[var(--border)]">{kind === 'virtual' ? <button disabled={busy} onClick={moveToInPerson} className="flex-1 bg-[var(--gold)] text-[var(--on-gold)] font-semibold py-2.5 rounded-lg disabled:opacity-50">→ {t('move_to_inperson')}</button> : <button disabled={busy} onClick={moveToPool} className="flex-1 bg-[var(--gold)] text-[var(--on-gold)] font-semibold py-2.5 rounded-lg disabled:opacity-50">✓ {t('move_to_pool')}</button>}<button disabled={busy} onClick={reject} className="bg-[var(--surface)] border border-red-200 text-red-600 font-semibold px-4 rounded-lg disabled:opacity-50">{t('reject')}</button></div>}
            </div>
          </aside>
        </>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[var(--gold)]">✓</span> {toast}</div>}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) { return <div className="p-5 border-b border-[var(--border)]"><div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2.5">{title}</div>{children}</div> }
function Rw({ k, v }: { k: string; v: string | null | undefined }) { return <div className="flex justify-between gap-3 py-1 text-[13px]"><span className="text-[var(--muted)]">{k}</span><span className="text-[var(--text)] font-medium text-right">{v || '—'}</span></div> }
