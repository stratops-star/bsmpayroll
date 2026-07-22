'use client'

// src/app/recruiting/admin/fingercheck/page.tsx
// Admin-only diagnostic screen: look up a Fingercheck employee and see the
// onboarding status fields, so we can map what the status integers mean.
// Uses your signed-in session, so no tokens to copy by hand.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Progress = {
  employeeNumber: string
  name: string
  onBoardingStatus: number | null
  newHireStatus: number | null
  divisionEmployeeStatus: string | null
  hireDate: string | null
  modifiedOn: string | null
  everify: { status: number | null; currentState: string | null; completedOn: string | null; closureDescription: string | null } | null
  position: string | null
  location: string | null
  costCenter1: string | null
  supervisorEmployeeNumber: string | null
}

export default function FingercheckProbePage() {
  const [supabase] = useState(() => createClient())
  const [emp, setEmp] = useState('')
  const [raw, setRaw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ progress: Progress; raw?: any; checkedAt: string } | null>(null)
  const [log, setLog] = useState<{ at: string; emp: string; ob: number | null; nh: number | null; st: string | null; ev: string | null }[]>([])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bsm:area', { detail: 'Fingercheck' }))
    return () => window.dispatchEvent(new CustomEvent('bsm:area', { detail: null }))
  }, [])

  async function run() {
    if (!emp.trim()) return
    setBusy(true); setErr(''); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setErr('Not signed in.'); setBusy(false); return }
      const res = await fetch(`/api/fingercheck-probe?employee=${encodeURIComponent(emp.trim())}${raw ? '&raw=1' : ''}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json()
      if (!res.ok) { setErr(j?.error || `HTTP ${res.status}`); setBusy(false); return }
      setResult(j)
      setLog(l => [{
        at: new Date().toLocaleTimeString(),
        emp: j.progress.employeeNumber,
        ob: j.progress.onBoardingStatus,
        nh: j.progress.newHireStatus,
        st: j.progress.divisionEmployeeStatus,
        ev: j.progress.everify?.currentState ?? null,
      }, ...l].slice(0, 20))
    } catch (e: any) {
      setErr(e?.message || 'Request failed')
    } finally { setBusy(false) }
  }

  const box = 'border border-[color-mix(in_srgb,var(--gold)_26%,transparent)] rounded-xl bg-[var(--surface)]'
  const lbl = 'text-[11px] uppercase tracking-wide text-[var(--muted)] font-bold'

  return (
    <div className="min-h-screen bsm-app">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="mb-1 text-[10px] font-bold tracking-[.22em] uppercase text-[var(--gold)]">Diagnostic</div>
        <h1 className="text-xl font-semibold text-[var(--text-strong)]">Fingercheck probe</h1>
        <p className="text-xs text-[var(--muted)] mt-1 mb-5">
          Look up an employee and record what the status fields say. Run this at each visible step of a real hire&rsquo;s onboarding so the status codes can be mapped to board stages.
        </p>

        <div className={`${box} p-4 mb-5`}>
          <label className={lbl}>Employee number</label>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <input value={emp} onChange={e => setEmp(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="e.g. 4412"
              className="flex-1 min-w-[160px] bg-[var(--surface-2)] border border-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[var(--text)] placeholder:text-[var(--faint)] rounded-lg px-3 py-2 text-sm" />
            <button onClick={run} disabled={busy || !emp.trim()}
              className="bg-[var(--gold)] text-[var(--on-gold)] font-semibold text-sm px-5 rounded-lg disabled:opacity-40">
              {busy ? 'Checking…' : 'Check'}
            </button>
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={raw} onChange={e => setRaw(e.target.checked)} className="w-4 h-4 accent-[var(--gold)]" />
            <span className="text-xs text-[var(--muted)]">Include the full raw employee object</span>
          </label>
        </div>

        {err && (
          <div className="mb-5 text-sm text-[var(--danger)] bg-[var(--raise)] border border-[color-mix(in_srgb,var(--gold)_20%,transparent)] rounded-lg px-3 py-2.5">
            {err}
          </div>
        )}

        {result && (
          <div className={`${box} p-4 mb-5`}>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div>
                <div className="text-base font-semibold text-[var(--text-strong)]">{result.progress.name || '—'}</div>
                <div className="text-xs text-[var(--muted)]">Employee #{result.progress.employeeNumber}</div>
              </div>
              <div className="text-[11px] text-[var(--faint)]">checked {new Date(result.checkedAt).toLocaleTimeString()}</div>
            </div>

            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              <Stat k="OnBoardingStatus" v={result.progress.onBoardingStatus} highlight />
              <Stat k="NewHireStatus" v={result.progress.newHireStatus} highlight />
              <Stat k="Division status" v={result.progress.divisionEmployeeStatus} />
              <Stat k="Hire date" v={result.progress.hireDate ? new Date(result.progress.hireDate).toLocaleDateString() : null} />
            </div>

            <div className="mt-4 pt-3 border-t border-[color-mix(in_srgb,var(--gold)_20%,transparent)]">
              <div className={lbl}>E-Verify / documents</div>
              {result.progress.everify ? (
                <div className="grid gap-2.5 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                  <Stat k="Current state" v={result.progress.everify.currentState} highlight />
                  <Stat k="Status" v={result.progress.everify.status} />
                  <Stat k="Completed" v={result.progress.everify.completedOn ? new Date(result.progress.everify.completedOn).toLocaleDateString() : null} />
                  <Stat k="Closure" v={result.progress.everify.closureDescription} />
                </div>
              ) : <p className="text-xs text-[var(--faint)] mt-1.5">No E-Verify transaction on this employee.</p>}
            </div>

            <div className="mt-4 pt-3 border-t border-[color-mix(in_srgb,var(--gold)_20%,transparent)]">
              <div className={lbl}>Assignment</div>
              <div className="grid gap-2.5 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                <Stat k="Position" v={result.progress.position} />
                <Stat k="Location" v={result.progress.location} />
                <Stat k="Cost center 1" v={result.progress.costCenter1} />
                <Stat k="Supervisor #" v={result.progress.supervisorEmployeeNumber} />
              </div>
            </div>

            {result.raw && (
              <details className="mt-4">
                <summary className="text-xs text-[var(--gold)] cursor-pointer">Raw employee object</summary>
                <pre className="mt-2 text-[11px] leading-relaxed text-[var(--muted)] bg-[var(--raise)] rounded-lg p-3 overflow-auto max-h-80">{JSON.stringify(result.raw, null, 2)}</pre>
              </details>
            )}
          </div>
        )}

        {log.length > 0 && (
          <div className={`${box} p-4`}>
            <div className={lbl}>Session log — watch these change between steps</div>
            <div className="mt-2.5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--on-gold)] bg-[var(--gold)]">
                    <th className="px-2.5 py-1.5 rounded-l-md">Time</th><th className="px-2.5 py-1.5">Emp</th>
                    <th className="px-2.5 py-1.5">OnBoarding</th><th className="px-2.5 py-1.5">NewHire</th>
                    <th className="px-2.5 py-1.5">Division</th><th className="px-2.5 py-1.5 rounded-r-md">E-Verify</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((r, i) => (
                    <tr key={i} className="border-b border-[color-mix(in_srgb,var(--gold)_18%,transparent)] last:border-0">
                      <td className="px-2.5 py-1.5 text-[var(--faint)]">{r.at}</td>
                      <td className="px-2.5 py-1.5 text-[var(--muted)]">{r.emp}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-[var(--gold)]">{r.ob ?? '—'}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-[var(--gold)]">{r.nh ?? '—'}</td>
                      <td className="px-2.5 py-1.5 text-[var(--text)]">{r.st ?? '—'}</td>
                      <td className="px-2.5 py-1.5 text-[var(--text)]">{r.ev ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[var(--faint)] mt-2.5">Log is in-memory only and clears on refresh — copy anything you want to keep.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ k, v, highlight = false }: { k: string; v: string | number | null; highlight?: boolean }) {
  return (
    <div className="bg-[var(--raise)] rounded-lg px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--faint)] font-bold">{k}</div>
      <div className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-[var(--gold)]' : 'text-[var(--text)]'}`}>
        {v === null || v === undefined || v === '' ? '—' : String(v)}
      </div>
    </div>
  )
}
