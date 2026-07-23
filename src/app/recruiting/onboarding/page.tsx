'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import RecruitingTabs from '@/components/RecruitingTabs'

type Row = {
  id: string
  candidate_id: string
  fingercheck_employee_number: string | null
  stage: string
  stage_entered_at: string
  fc_onboarding_status: number | null
  fc_new_hire_status: number | null
  fc_division_status: string | null
  fc_hire_date: string | null
  fc_position: string | null
  fc_cost_center_1: string | null
  fc_location: string | null
  fc_supervisor_number: string | null
  fc_last_synced_at: string | null
  fc_last_error: string | null
  documents_ok: boolean
  documents_marked_at: string | null
  synced_to_sheet_at: string | null
  notes: string | null
  source: string | null
  fc_first_name: string | null
  fc_last_name: string | null
  candidate: { full_name: string; email: string | null; phone: string | null; positions: string[] | null } | null
}

// A card may come from the app (candidate signed an offer) or straight from
// Fingercheck (imported by employee number), so the name has two possible homes.
const nameOf = (r: Row) =>
  r.candidate?.full_name || [r.fc_first_name, r.fc_last_name].filter(Boolean).join(' ') || `#${r.fingercheck_employee_number || '—'}`

// Board order. `auto` = the Fingercheck sync advances this on its own.
const STAGES: { key: string; label: string; auto: boolean }[] = [
  { key: 'offer_signed',   label: 'Offer signed',   auto: false },
  { key: 'invited',        label: 'Invited',        auto: true  },
  { key: 'signing_up',     label: 'Signing up',     auto: true  },
  { key: 'documents',      label: 'Documents',      auto: false },
  { key: 'configuration',  label: 'Configuration',  auto: false },
  { key: 'active',         label: 'Ready',          auto: true  },
  { key: 'in_employee_db', label: 'In employee DB', auto: false },
]

// Days in a stage before a card is treated as stuck and surfaced for chasing.
const STUCK_AFTER: Record<string, number> = {
  offer_signed: 2, invited: 4, signing_up: 5, documents: 3,
  configuration: 2, active: 2, in_employee_db: 9999,
}

const ini = (n: string) => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const daysIn = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
const ago = (iso: string | null) => {
  if (!iso) return 'never'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const I = {
  bolt: <path d="M13 3L5.5 13.5H11l-1 7.5L18.5 10H13z" />,
  hand: <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4.5a5.5 5.5 0 0 1-5.5 5.5H11a5 5 0 0 1-5-5v-4a1.5 1.5 0 0 1 3 0" />,
  warn: <><path d="M12 4.5L2.8 20h18.4z" /><path d="M12 10v4.2M12 17.2v.2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v4.5h-4.5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
}
const Ico = ({ d, size = 13, sw = 1.7 }: { d: keyof typeof I; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">{I[d]}</svg>
)

export default function OnboardingPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Row | null>(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [empInput, setEmpInput] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addNum, setAddNum] = useState('')

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bsm:area', { detail: 'Onboarding' }))
    return () => window.dispatchEvent(new CustomEvent('bsm:area', { detail: null }))
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('onboarding')
      .select('*, candidate:candidates(full_name, email, phone, positions)')
      .order('stage_entered_at', { ascending: true })
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2600) }

  async function patch(id: string, p: Partial<Row>) {
    const { error } = await supabase.from('onboarding').update(p as any).eq('id', id)
    if (error) { flash('Error: ' + error.message); return false }
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...p } as Row : r)))
    setSel(s => (s && s.id === id ? { ...s, ...p } as Row : s))
    return true
  }

  async function refresh() {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/cron/fingercheck-sync', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const j = await res.json()
      if (!res.ok) { flash(j?.error || 'Sync failed'); return }
      flash(`Checked ${j.checked ?? 0} · advanced ${j.advanced ?? 0}`)
      await load()
    } catch (e: any) {
      flash(e?.message || 'Sync failed')
    } finally { setBusy(false) }
  }

  async function addFromFingercheck() {
    const n = addNum.trim()
    if (!n) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/cron/fingercheck-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ employeeNumber: n }),
      })
      const j = await res.json()
      if (!res.ok) { flash(j?.error || 'Could not add'); return }
      flash(`Added ${j.name || '#' + n}`)
      setAddNum(''); setAddOpen(false)
      await load()
    } catch (e: any) {
      flash(e?.message || 'Could not add')
    } finally { setBusy(false) }
  }

  // A card wants a human when it's stuck, has a sync error, or sits on a manual gate.
  function status(r: Row): 'ok' | 'hr' | 'stuck' {
    const d = daysIn(r.stage_entered_at)
    if (r.fc_last_error) return 'stuck'
    if (d > (STUCK_AFTER[r.stage] ?? 99)) return 'stuck'
    if (r.stage === 'offer_signed' && !r.fingercheck_employee_number) return 'hr'
    if (r.stage === 'documents' && !r.documents_ok) return 'hr'
    if (r.stage === 'configuration') return 'hr'
    if (r.stage === 'active') return 'hr'   // waiting to be filed into the sheet
    return 'ok'
  }

  const byStage = useMemo(() => {
    const m: Record<string, Row[]> = {}
    STAGES.forEach(s => { m[s.key] = [] })
    rows.forEach(r => { (m[r.stage] ||= []).push(r) })
    return m
  }, [rows])

  const attention = rows.filter(r => status(r) !== 'ok').length
  const lastSync = rows.reduce<string | null>((a, r) => (
    r.fc_last_synced_at && (!a || r.fc_last_synced_at > a) ? r.fc_last_synced_at : a
  ), null)

  const cardEdge = (s: 'ok' | 'hr' | 'stuck') =>
    s === 'stuck' ? 'var(--danger)' : s === 'hr' ? '#E0A44A' : 'var(--gold)'

  return (
    <div className="min-h-screen bsm-app">
      <div className="max-w-[1400px] mx-auto px-5 py-5">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-strong)]">Onboarding</h1>
            <p className="text-xs text-[var(--muted)]">Signed offer through Fingercheck into the employee sheet</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {attention > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-lg px-3 py-2"
                style={{ color: '#E0A44A', border: '1px solid color-mix(in srgb, #E0A44A 45%, transparent)', background: 'color-mix(in srgb, #E0A44A 10%, transparent)' }}>
                <Ico d="warn" size={14} /> {attention} need{attention === 1 ? 's' : ''} attention
              </span>
            )}
            <button onClick={() => setAddOpen(o => !o)}
              className="text-xs font-semibold bg-[var(--gold)] text-[var(--on-gold)] rounded-lg px-3 py-2">
              Add from Fingercheck
            </button>
            <button onClick={refresh} disabled={busy}
              className="inline-flex items-center gap-2 text-xs text-[var(--muted)] border border-[var(--border)] bg-[var(--surface)] rounded-lg px-3 py-2 disabled:opacity-50">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok)' }} />
              Synced {ago(lastSync)}
              <span className={busy ? 'animate-spin' : ''}><Ico d="refresh" size={13} /></span>
            </button>
          </div>
        </div>

        <RecruitingTabs />

        {addOpen && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2">Add someone already in Fingercheck</div>
            <div className="flex gap-2 flex-wrap">
              <input value={addNum} onChange={e => setAddNum(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFromFingercheck()}
                placeholder="Employee number, e.g. 100727"
                className="flex-1 min-w-[200px] border border-[var(--border)] bg-[var(--surface-2)] rounded-lg px-3 py-2 text-sm" />
              <button onClick={addFromFingercheck} disabled={busy || !addNum.trim()}
                className="bg-[var(--gold)] text-[var(--on-gold)] text-sm font-semibold px-5 rounded-lg disabled:opacity-40">
                {busy ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => setAddOpen(false)} className="text-sm text-[var(--muted)] px-3">Cancel</button>
            </div>
            <p className="text-[11px] text-[var(--faint)] mt-2 leading-relaxed">
              For people onboarding in Fingercheck who never went through the offer flow here. Their stage is read straight from Fingercheck.
            </p>
          </div>
        )}

        {loading ? <p className="text-[var(--faint)] text-sm">Loading…</p> : rows.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center text-[var(--muted)]">
            <div className="mb-1">Nobody is on the board yet.</div>
            <div className="text-[12.5px] text-[var(--faint)]">Cards open automatically when a candidate signs their offer letter — or use <b className="text-[var(--gold)]">Add from Fingercheck</b> for someone already onboarding there.</div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-[var(--raise)] [&::-webkit-scrollbar-thumb]:rounded-full">
            {STAGES.map(s => {
              const list = byStage[s.key] || []
              return (
                <div key={s.key} className="flex-shrink-0 w-[232px] flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1 pb-0.5">
                    <span className="text-[11px] font-bold tracking-[.13em] uppercase text-[var(--text-strong)]">{s.label}</span>
                    <span className="text-[10.5px] font-bold bg-[var(--raise)] text-[var(--muted)] rounded-full px-1.5">{list.length}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-bold tracking-[.09em] uppercase"
                      style={{ color: s.auto ? 'var(--gold)' : 'var(--muted)', opacity: .8 }}>
                      {s.auto ? <><Ico d="bolt" size={11} />auto</> : <><Ico d="hand" size={11} />HR</>}
                    </span>
                  </div>
                  <div className="rounded-[13px] border border-[var(--border)] p-2 flex flex-col gap-2 min-h-[110px]" style={{ background: 'rgba(255,255,255,.015)' }}>
                    {list.map(r => {
                      const st = status(r)
                      const d = daysIn(r.stage_entered_at)
                      return (
                        <button key={r.id} onClick={() => { setSel(r); setEmpInput(r.fingercheck_employee_number || '') }}
                          className="text-left bg-[var(--surface)] border border-[var(--border)] rounded-[11px] p-2.5 hover:shadow-lg transition-shadow"
                          style={{ borderLeft: `2px solid ${cardEdge(st)}` }}>
                          <div className="flex items-center gap-2.5">
                            <span className="w-[30px] h-[30px] rounded-full border grid place-items-center text-[10.5px] font-bold flex-shrink-0"
                              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                              {ini(nameOf(r))}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-[var(--text)] leading-tight truncate">{nameOf(r)}</div>
                              <div className="text-[11px] text-[var(--muted)] truncate">{r.fc_position || (r.candidate?.positions || [])[0] || '—'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--border)] text-[10.5px]">
                            {st === 'stuck' && <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-full" style={{ color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 50%, transparent)' }}><Ico d="warn" size={9} />STUCK</span>}
                            {st === 'hr' && <span className="font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#E0A44A', border: '1px solid color-mix(in srgb, #E0A44A 50%, transparent)' }}>NEEDS HR</span>}
                            {r.fingercheck_employee_number && <span className="text-[var(--faint)]">#{r.fingercheck_employee_number}</span>}
                            <span className="ml-auto text-[var(--faint)]">{d}d</span>
                          </div>
                        </button>
                      )
                    })}
                    {list.length === 0 && <div className="text-[11px] text-[var(--faint)] text-center py-4">—</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── detail drawer ── */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setSel(null)} />
          <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-[var(--surface)] z-[70] shadow-2xl flex flex-col">
            <div className="p-5 border-b border-[var(--border)] relative">
              <button onClick={() => setSel(null)} className="absolute top-4 right-5 w-8 h-8 rounded-lg bg-[var(--raise)] text-[var(--muted)] grid place-items-center"><Ico d="x" size={13} sw={2.2} /></button>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl border grid place-items-center font-semibold" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>{ini(nameOf(sel))}</span>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-strong)]">{nameOf(sel)}</h2>
                  <div className="text-xs text-[var(--muted)]">{sel.fc_position || (sel.candidate?.positions || [])[0] || '—'} · {daysIn(sel.stage_entered_at)}d in stage</div>
                </div>
              </div>
              {sel.fc_last_error && (
                <div className="mt-3 text-[11.5px] rounded-lg px-3 py-2" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid color-mix(in srgb, var(--danger) 45%, transparent)' }}>
                  Last sync failed: {sel.fc_last_error}
                </div>
              )}
            </div>

            <div className="overflow-auto flex-1">
              {/* Fingercheck link */}
              <Sec title="Fingercheck record">
                <label className="text-[11px] text-[var(--muted)]">Employee number</label>
                <div className="flex gap-2 mt-1">
                  <input value={empInput} onChange={e => setEmpInput(e.target.value)} placeholder="e.g. 100727"
                    className="flex-1 border border-[var(--border)] bg-[var(--surface-2)] rounded-lg px-3 py-2 text-sm" />
                  <button
                    onClick={async () => {
                      const v = empInput.trim()
                      if (await patch(sel.id, { fingercheck_employee_number: v || null } as any)) flash(v ? 'Linked' : 'Cleared')
                    }}
                    className="bg-[var(--gold)] text-[var(--on-gold)] text-sm font-semibold px-4 rounded-lg">Save</button>
                </div>
                <p className="text-[11px] text-[var(--faint)] mt-2 leading-relaxed">
                  Create the employee in Fingercheck, then paste their number here. The sync uses it to track progress automatically.
                </p>
                {sel.fingercheck_employee_number && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Stat k="Division status" v={sel.fc_division_status} strong />
                    <Stat k="OnBoardingStatus" v={sel.fc_onboarding_status} strong />
                    <Stat k="Hire date" v={sel.fc_hire_date} />
                    <Stat k="Last synced" v={ago(sel.fc_last_synced_at)} />
                  </div>
                )}
              </Sec>

              {/* Documents — HR marked, no E-Verify data available */}
              <Sec title="Documents">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={sel.documents_ok} className="mt-0.5 w-4 h-4 accent-[var(--gold)]"
                    onChange={async e => {
                      const ok = e.target.checked
                      await patch(sel.id, { documents_ok: ok, documents_marked_at: ok ? new Date().toISOString() : null } as any)
                    }} />
                  <span className="text-[12.5px] text-[var(--text)] leading-relaxed">
                    Documents received and verified
                    <span className="block text-[11px] text-[var(--faint)] mt-0.5">
                      Fingercheck does not report document status for BSM, so this is marked by hand.
                    </span>
                  </span>
                </label>
              </Sec>

              {/* Configuration — read from Fingercheck */}
              <Sec title="Configuration">
                <div className="grid grid-cols-2 gap-2">
                  <Stat k="Cost center (tier)" v={sel.fc_cost_center_1} strong />
                  <Stat k="Supervisor #" v={sel.fc_supervisor_number} strong />
                  <Stat k="Location" v={sel.fc_location} />
                  <Stat k="Position" v={sel.fc_position} />
                </div>
                <p className="text-[11px] text-[var(--faint)] mt-2 leading-relaxed">
                  Set these in Fingercheck. The card moves on once a tier and supervisor are present.
                </p>
              </Sec>

              {/* Employee sheet */}
              <Sec title="Employee sheet">
                {sel.synced_to_sheet_at ? (
                  <div className="text-[12.5px] inline-flex items-center gap-2" style={{ color: 'var(--ok)' }}>
                    <Ico d="check" size={13} sw={2.4} /> Filed {ago(sel.synced_to_sheet_at)}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={async () => { if (await patch(sel.id, { synced_to_sheet_at: new Date().toISOString(), stage: 'in_employee_db' } as any)) flash('Marked as filed') }}
                      className="w-full bg-[var(--gold)] text-[var(--on-gold)] text-sm font-semibold py-2.5 rounded-lg">
                      Mark as added to the sheet
                    </button>
                    <p className="text-[11px] text-[var(--faint)] mt-2">Manual for now — automatic push to the Google Sheet comes next.</p>
                  </>
                )}
              </Sec>

              <Sec title="Notes">
                <textarea rows={3} defaultValue={sel.notes || ''} placeholder="Anything worth remembering about this hire…"
                  onBlur={e => { if (e.target.value !== (sel.notes || '')) patch(sel.id, { notes: e.target.value || null } as any) }}
                  className="w-full border border-[var(--border)] bg-[var(--surface-2)] rounded-lg px-3 py-2 text-sm" />
              </Sec>

              <Sec title="Contact">
                <Rw k="Email" v={sel.candidate?.email} />
                <Rw k="Phone" v={sel.candidate?.phone} />
              </Sec>
            </div>
          </aside>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-[90] inline-flex items-center gap-2">
          <span className="text-[var(--gold)]"><Ico d="check" size={13} sw={2.4} /></span> {toast}
        </div>
      )}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 border-b border-[var(--border)]">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text)] font-bold mb-2.5">{title}</div>
      {children}
    </div>
  )
}
function Stat({ k, v, strong }: { k: string; v: string | number | null | undefined; strong?: boolean }) {
  return (
    <div className="bg-[var(--raise)] rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--faint)] font-bold">{k}</div>
      <div className={`mt-0.5 text-[13px] font-semibold ${strong ? 'text-[var(--gold)]' : 'text-[var(--text)]'}`}>
        {v === null || v === undefined || v === '' ? '—' : String(v)}
      </div>
    </div>
  )
}
function Rw({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[13px]">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="text-[var(--text)] font-medium text-right">{v || '—'}</span>
    </div>
  )
}
