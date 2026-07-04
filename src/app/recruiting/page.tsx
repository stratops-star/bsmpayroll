'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Candidate = {
  id: string
  created_at: string
  full_name: string
  phone: string | null
  email: string | null
  preferred_lang: string
  positions: string[] | null
  sub_type: string | null
  state: string | null
  city: string | null
  borough: string | null
  work_areas: string[] | null
  pay_min: number | null
  pay_max: number | null
  expected_pay: string | null
  transportation: string | null
  availability: string | null
  english_level: string | null
  referral_source: string | null
  experience: string | null
  security_licensed: boolean | null
  license_path: string | null
  resume_path: string | null
  profile_tier: string | null
}

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); return d === 1 ? 'yesterday' : `${d}d ago`
}

function Tabs({ active }: { active: string }) {
  const items = [['New Queue', '/recruiting'], ['Candidate Pool', '/recruiting/pool'], ['Rejected', '/recruiting/rejected']]
  return (
    <div className="flex gap-1 mt-3">
      {items.map(([label, href]) => (
        <a key={href} href={href}
          className={`text-sm px-3 py-1.5 rounded-lg ${label === active ? 'bg-white/15 text-white font-medium' : 'text-white/55 hover:text-white'}`}>{label}</a>
      ))}
    </div>
  )
}

export default function NewQueuePage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [sel, setSel] = useState<Candidate | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single()
      setCanAct(me?.role === 'admin' || me?.role === 'recruiter')
    }
    const { data } = await supabase.from('candidates').select('*').eq('status', 'applied').order('created_at', { ascending: false })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function open(c: Candidate) { setSel(c); setTier(c.profile_tier); setReason('') }
  function close() { setSel(null) }
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200) }

  async function openFile(bucket: string, path: string | null) {
    if (!path) return
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else flash('Could not open file')
  }

  async function pass() {
    if (!sel) return
    if (!tier) { flash('Set a profile tier first'); return }
    setBusy(true)
    const { error } = await supabase.from('candidates')
      .update({ status: 'in_pool', in_pool: true, stage: 'available', profile_tier: tier }).eq('id', sel.id)
    setBusy(false)
    if (error) { flash('Error: ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== sel.id)); close(); flash('Passed to Candidate Pool')
  }
  async function reject() {
    if (!sel) return
    setBusy(true)
    const { error } = await supabase.from('candidates')
      .update({ status: 'rejected', stage: 'rejected', rejected_reason: reason || null }).eq('id', sel.id)
    setBusy(false)
    if (error) { flash('Error: ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== sel.id)); close(); flash('Moved to Rejected')
  }

  const payText = (c: Candidate) => c.expected_pay || (c.pay_min != null && c.pay_max != null ? `$${c.pay_min}–${c.pay_max}/hr` : '—')

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* header */}
      <div className="bg-[#0D1B35] text-white px-6 py-4 border-b-[3px] border-[#D4A843]">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/hub" className="text-white/50 text-sm">← Hub</a>
            <div>
              <div className="text-lg font-semibold">New Queue</div>
              <div className="text-xs text-white/50">Applications waiting for first review</div>
            </div>
          </div>
          <Tabs active="New Queue" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">
            No new applications right now.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Live
              </span>
              <span className="font-semibold text-[#0D1B35]">{rows.length} new application{rows.length > 1 ? 's' : ''}</span>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {rows.map(c => (
                <button key={c.id} onClick={() => open(c)}
                  className="text-left bg-white border border-gray-200 border-l-[3px] border-l-[#D4A843] rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: hue(c.email || c.full_name) }}>{ini(c.full_name)}</span>
                    <div>
                      <div className="font-semibold text-[#0D1B35]">{c.full_name}</div>
                      <div className="text-xs text-gray-500">{[c.borough, c.city, c.state].filter(Boolean).join(', ') || '—'}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(c.positions || []).slice(0, 3).map(p => <span key={p} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p}</span>)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-100 pt-2.5">
                    <span>{c.preferred_lang === 'es' ? '🇪🇸 Español' : '🇺🇸 English'} · {payText(c)}</span>
                    <span>{ago(c.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* drawer */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-[#0D1B35]/40 z-20" onClick={close} />
          <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-white z-30 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 relative">
              <button onClick={close} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-gray-100 text-gray-500">✕</button>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl grid place-items-center text-white font-semibold" style={{ background: hue(sel.email || sel.full_name) }}>{ini(sel.full_name)}</span>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D1B35]">{sel.full_name}</h2>
                  <div className="text-xs text-gray-500">{ago(sel.created_at)} · {sel.preferred_lang === 'es' ? 'Español' : 'English'}</div>
                </div>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {/* Actions */}
              {canAct && (
                <Section title="Initial review">
                  <div className="text-xs text-gray-500 mb-1.5">Profile tier</div>
                  <div className="flex gap-2 mb-3">
                    {['high', 'medium', 'low'].map(t => (
                      <button key={t} onClick={() => setTier(t)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${tier === t ? 'bg-[#D4A843] border-[#D4A843] text-[#0D1B35]' : 'border-gray-200 text-gray-500'}`}>{t}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={pass} className="flex-1 bg-[#0D1B35] text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">✓ Pass to pool</button>
                    <button disabled={busy} onClick={reject} className="flex-1 bg-white border border-red-200 text-red-600 text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">✕ Reject</button>
                  </div>
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection (optional)"
                    className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                </Section>
              )}
              {!canAct && <Section title="View only"><p className="text-xs text-gray-500">You have read-only access to applications.</p></Section>}

              <Section title="Applied for">
                <div className="flex flex-wrap gap-1.5">
                  {(sel.positions || []).map(p => <span key={p} className="text-xs bg-[#0D1B35]/5 text-[#0D1B35] font-medium px-2.5 py-1 rounded-full">{p}</span>)}
                </div>
                {sel.positions?.includes('Security') && (
                  <div className="mt-2 text-xs">
                    Security license: <b>{sel.security_licensed === true ? 'Licensed' : sel.security_licensed === false ? 'Unlicensed' : '—'}</b>
                    {sel.license_path && <button onClick={() => openFile('candidate-licenses', sel.license_path)} className="ml-2 text-blue-600 font-medium">View license</button>}
                  </div>
                )}
              </Section>

              <Section title="Contact">
                <Row k="Phone" v={sel.phone} />
                <Row k="Email" v={sel.email} />
              </Section>

              <Section title="Job fit">
                <Row k="Expected pay" v={payText(sel)} />
                <Row k="Availability" v={sel.availability} />
                <Row k="Transportation" v={sel.transportation} />
                <Row k="English level" v={sel.english_level} />
              </Section>

              <Section title="Location">
                <Row k="Lives in" v={[sel.borough, sel.city, sel.state].filter(Boolean).join(', ')} />
                <Row k="Open to work in" v={(sel.work_areas || []).join(', ')} />
              </Section>

              {sel.experience && <Section title="Experience"><p className="text-xs text-gray-600 leading-relaxed bg-[#F5F6FA] rounded-lg p-3">{sel.experience}</p></Section>}

              <Section title="Source & files">
                <Row k="Heard via" v={sel.referral_source} />
                {sel.resume_path
                  ? <button onClick={() => openFile('candidate-resumes', sel.resume_path)} className="mt-1 inline-flex items-center gap-2 bg-[#F5F6FA] border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-[#0D1B35]"><span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PDF</span> View résumé</button>
                  : <div className="text-xs text-gray-400 mt-1">No résumé uploaded</div>}
              </Section>
            </div>
          </aside>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40">
          <span className="text-[#D4A843]">✓</span> {toast}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 border-b border-gray-100">
      <div className="text-[11px] uppercase tracking-wide text-[#0D1B35] font-bold mb-2.5">{title}</div>
      {children}
    </div>
  )
}
function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[13px]">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-800 font-medium text-right">{v || '—'}</span>
    </div>
  )
}
