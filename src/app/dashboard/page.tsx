'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { PorterEntry, Tier } from '@/lib/types'
import { getCurrentPeriod, getPreviousPeriod, fmtISO } from '@/lib/payPeriod'

type InnerTab = 'approved' | 'pending' | 'waiting' | 'closed' | 'exported'
const TIERS: Tier[] = ['T1', 'T2', 'T3']
const TIER_LABELS: Record<Tier, string> = { T1: 'Tier 1', T2: 'Tier 2', T3: 'Tier 3' }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const currentPeriod = getCurrentPeriod()
  const prevPeriod = getPreviousPeriod()

  const [userEmail, setUserEmail] = useState('')
  const [periodStart, setPeriodStart] = useState(fmtISO(currentPeriod.start))
  const [periodEnd, setPeriodEnd] = useState(fmtISO(currentPeriod.end))
  const [allEntries, setAllEntries] = useState<Record<Tier, PorterEntry[]>>({ T1: [], T2: [], T3: [] })
  const [activeTier, setActiveTier] = useState<Tier>('T1')
  const [activeTab, setActiveTab] = useState<InnerTab>('approved')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [closeTarget, setCloseTarget] = useState<PorterEntry | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUserEmail(data.user.email || '')
    })
  }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function loadEntries() {
    setLoading(true)
    setStatusMsg('Loading sheets…')
    try {
      const token = await getToken()
      const res = await fetch(`/api/sheets?start=${periodStart}&end=${periodEnd}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const mapped: Record<Tier, PorterEntry[]> = { T1: [], T2: [], T3: [] }
      for (const tier of TIERS) {
        mapped[tier] = (data[tier] || []).map((e: PorterEntry) => ({
          ...e,
          approvalStatus: e.status?.toUpperCase() === 'CLOSED' ? 'closed' : e.isLastMinute ? 'waiting' : 'pending',
        }))
      }
      setAllEntries(mapped)
      const total = TIERS.reduce((s, t) => s + mapped[t].length, 0)
      setStatusMsg(`Loaded ${total} entries`)
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  function updateEntry(id: string, tier: Tier, patch: Partial<PorterEntry>) {
    setAllEntries(prev => ({ ...prev, [tier]: prev[tier].map(e => e.id === id ? { ...e, ...patch } : e) }))
  }

  async function handleApprove(entry: PorterEntry) {
    updateEntry(entry.id, entry.tier, { approvalStatus: 'approved' })
    const token = await getToken()
    if (entry.asanaId) {
      await fetch('/api/asana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ asanaId: entry.asanaId, periodStart, periodEnd }),
      })
    }
  }

  function handleUnapprove(entry: PorterEntry) {
    updateEntry(entry.id, entry.tier, { approvalStatus: entry.isLastMinute ? 'waiting' : 'pending' })
  }

  async function handleCloseConfirm() {
    if (!closeTarget) return
    updateEntry(closeTarget.id, closeTarget.tier, { approvalStatus: 'closed', closedReason: closeReason })
    setCloseTarget(null); setCloseReason('')
    const token = await getToken()
    await fetch('/api/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entry: closeTarget, reason: closeReason, periodStart, periodEnd, userEmail }),
    })
  }

  function handleReopen(entry: PorterEntry) {
    updateEntry(entry.id, entry.tier, { approvalStatus: 'pending', closedReason: undefined })
  }

  async function handleExport() {
    setExporting(true)
    const token = await getToken()
    const allApproved = TIERS.flatMap(t => allEntries[t]).filter(e => e.approvalStatus === 'approved')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entries: allApproved, periodStart, periodEnd, userEmail }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `fingercheck_${periodStart}_${periodEnd}.csv`
      a.click()
      for (const tier of TIERS) {
        setAllEntries(prev => ({
          ...prev,
          [tier]: prev[tier].map(e => e.approvalStatus === 'approved' ? { ...e, approvalStatus: 'exported' as const } : e)
        }))
      }
      setStatusMsg('Exported — Asana tasks updated')
    } catch (e: any) { setStatusMsg(`Error: ${e.message}`) }
    setExporting(false); setShowExport(false)
  }

  function tabEntries(tier: Tier, tab: InnerTab): PorterEntry[] {
    const e = allEntries[tier]
    if (tab === 'approved') return e.filter(x => x.approvalStatus === 'approved')
    if (tab === 'pending')  return e.filter(x => ['open','pending'].includes(x.approvalStatus) && !x.isLastMinute)
    if (tab === 'waiting')  return e.filter(x => x.approvalStatus === 'waiting' || (x.isLastMinute && !['approved','closed','exported'].includes(x.approvalStatus)))
    if (tab === 'closed')   return e.filter(x => x.approvalStatus === 'closed')
    if (tab === 'exported') return e.filter(x => x.approvalStatus === 'exported')
    return []
  }

  const allApproved = TIERS.flatMap(t => allEntries[t]).filter(e => e.approvalStatus === 'approved')
  const payday = new Date(periodEnd); payday.setDate(payday.getDate() + 3)
  const paydayStr = payday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const hasEntries = TIERS.some(t => allEntries[t].length > 0)

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* Nav */}
      <header className="bg-[#0D1B35] h-[50px] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F5C072] flex items-center justify-center font-bold text-[#0D1B35] text-sm">B</div>
          <div className="w-px h-5 bg-white/15" />
          <span className="text-white/50 text-sm">Payroll dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/history')} className="text-white/55 text-xs hover:text-white">Export history</button>
          <button onClick={() => router.push('/dashboard/help')} className="text-white/55 text-xs hover:text-white">Help</button>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-white/40 text-xs">{userEmail}</span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-white/40 text-xs hover:text-white">Sign out</button>
        </div>
      </header>

      {/* Tier bar */}
      <div className="bg-white border-b border-gray-200 px-5 flex">
        {TIERS.map(tier => {
          const count = allEntries[tier].length
          const isActive = activeTier === tier
          return (
            <button key={tier} onClick={() => setActiveTier(tier)}
              className={`px-5 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap
                ${isActive ? 'border-[#0D1B35] text-[#0D1B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TIER_LABELS[tier]}
              {count > 0 && <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      <main className="px-5 py-4 max-w-7xl mx-auto">
        {/* Period controls */}
        <div className="card p-4 mb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">Pay period</p>
              <div className="flex items-center gap-2">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B35]/20" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B35]/20" />
              </div>
            </div>
            <button onClick={() => { setPeriodStart(fmtISO(currentPeriod.start)); setPeriodEnd(fmtISO(currentPeriod.end)) }} className="btn-outline text-xs py-1.5">Current</button>
            <button onClick={() => { setPeriodStart(fmtISO(prevPeriod.start)); setPeriodEnd(fmtISO(prevPeriod.end)) }} className="btn-outline text-xs py-1.5">Previous</button>
            <button onClick={loadEntries} disabled={loading} className="btn-navy">
              {loading
                ? <><span className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full" /> Loading…</>
                : '↻ Load all tiers'}
            </button>
            <div className="ml-auto">
              <button onClick={() => setShowExport(true)} disabled={!allApproved.length} className="btn-gold">
                ↓ Export approved ({allApproved.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Payday: <strong className="text-gray-600">{paydayStr}</strong> · Wed–Tue · Export posts "entered" to Asana</p>
          {statusMsg && <p className="text-xs text-[#0D1B35] font-medium mt-1">{statusMsg}</p>}
        </div>

        {/* Mini dashboards */}
        {hasEntries && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {TIERS.map(tier => {
              const e = allEntries[tier]
              const ap = e.filter(x => x.approvalStatus === 'approved').length
              const pe = e.filter(x => ['open','pending'].includes(x.approvalStatus) && !x.isLastMinute).length
              const ur = e.filter(x => x.approvalStatus === 'waiting' || (x.isLastMinute && !['approved','closed','exported'].includes(x.approvalStatus))).length
              const hrs = e.filter(x => x.approvalStatus === 'approved').reduce((s, x) => s + x.hours, 0)
              return (
                <button key={tier} onClick={() => setActiveTier(tier)}
                  className={`card p-4 text-left hover:border-[#0D1B35] transition-colors ${activeTier === tier ? 'border-[#0D1B35] border-[1.5px]' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800">{TIER_LABELS[tier]}</span>
                    <span className="text-xs text-gray-400">→ View</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-lg font-semibold text-emerald-700">{ap}</div><div className="text-xs text-gray-500">Approved</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-lg font-semibold text-amber-700">{pe}</div><div className="text-xs text-gray-500">Pending</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-lg font-semibold text-red-700">{ur}</div><div className="text-xs text-gray-500">Urgent ⚡</div></div>
                    <div className="bg-gray-50 rounded-lg p-2"><div className="text-lg font-semibold text-[#0D1B35]">{hrs.toFixed(1)}</div><div className="text-xs text-gray-500">Appr. hrs</div></div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Table card */}
        <div className="card overflow-hidden">
          {/* Inner tabs */}
          <div className="flex border-b border-gray-200 px-1 items-center overflow-x-auto">
            {(['approved','pending','waiting','closed','exported'] as InnerTab[]).map(tab => {
              const count = tabEntries(activeTier, tab).length
              const labels: Record<InnerTab, string> = { approved:'Approved', pending:'Pending', waiting:'Waiting ⚡', closed:'Closed', exported:'Exported' }
              const colors: Record<InnerTab, string> = { approved:'bg-emerald-50 text-emerald-700', pending:'bg-amber-50 text-amber-700', waiting:'bg-red-50 text-red-700', closed:'bg-gray-100 text-gray-600', exported:'bg-blue-50 text-blue-700' }
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap
                    ${activeTab === tab ? 'border-[#0D1B35] text-[#0D1B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {labels[tab]}
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${colors[tab]}`}>{count}</span>
                </button>
              )
            })}
            <span className="ml-auto pr-3 text-xs text-gray-400">{TIER_LABELS[activeTier]}</span>
          </div>

          {/* Banners */}
          {activeTab === 'approved' && tabEntries(activeTier, 'approved').length > 0 && (
            <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <p className="text-xs text-emerald-700"><strong>{tabEntries(activeTier,'approved').length} entries</strong> approved in {TIER_LABELS[activeTier]}</p>
              <button onClick={() => setShowExport(true)} className="btn-gold text-xs py-1">↓ Export all ({allApproved.length})</button>
            </div>
          )}
          {activeTab === 'waiting' && tabEntries(activeTier, 'waiting').length > 0 && (
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-2">
              <span className="text-red-500 mt-0.5 flex-shrink-0">⚡</span>
              <p className="text-xs text-red-700">Last-minute submissions — review before payday <strong>{paydayStr}</strong></p>
            </div>
          )}
          {activeTab === 'closed' && (
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <p className="text-xs text-gray-500">Closed entries are excluded from export but kept permanently. Use ↩ Reopen to restore.</p>
            </div>
          )}

          {/* Table */}
          {tabEntries(activeTier, activeTab).length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No entries in this category</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-14">Emp #</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-32">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20">Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-2.5 w-12">Hrs</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-12">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-36">Property</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-24">Manager</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-14">Asana</th>
                    {activeTab === 'closed' && <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-32">Reason</th>}
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tabEntries(activeTier, activeTab).map(entry => {
                    const isApproved = entry.approvalStatus === 'approved'
                    const isClosed = entry.approvalStatus === 'closed'
                    const isExported = entry.approvalStatus === 'exported'
                    const payCode = entry.hoursType?.toUpperCase() === 'OT' ? 'OT' : 'RG'
                    const coverDate = entry.coverDay ? new Date(entry.coverDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                    const propShort = (entry.propertyAddress || entry.property || '').split(',')[0]
                    return (
                      <tr key={entry.id}
                        className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors
                          ${isApproved ? 'bg-emerald-50/30' : ''}
                          ${isClosed ? 'bg-gray-50/60 opacity-75' : ''}
                          ${entry.isLastMinute && !isApproved && !isClosed ? 'bg-red-50/20' : ''}`}>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{entry.employeeNumber}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 truncate" title={entry.porterName}>{entry.porterName || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{coverDate}{entry.isLastMinute && !isClosed && <span className="ml-1 text-red-500">⚡</span>}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{entry.hours}</td>
                        <td className="px-3 py-2.5"><span className={`badge ${payCode === 'OT' ? 'badge-ot' : 'badge-rg'}`}>{payCode}</span></td>
                        <td className="px-3 py-2.5 text-gray-600 truncate text-xs" title={entry.propertyAddress}>{propShort || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 truncate text-xs">{entry.manager || '—'}</td>
                        <td className="px-3 py-2.5">
                          {entry.asanaLink ? <a href={entry.asanaLink} target="_blank" rel="noopener noreferrer" className="text-[#0D1B35] text-xs hover:underline opacity-70">↗ Task</a> : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {activeTab === 'closed' && <td className="px-3 py-2.5 text-xs text-gray-500 truncate">{entry.closedReason || '—'}</td>}
                        <td className="px-3 py-2.5">
                          {isExported ? <span className="badge badge-exported">Exported</span>
                            : isClosed ? <button onClick={() => handleReopen(entry)} className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">↩ Reopen</button>
                            : isApproved ? <div className="flex gap-1.5">
                                <button onClick={() => handleUnapprove(entry)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">✕</button>
                                <button onClick={() => setCloseTarget(entry)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">Close</button>
                              </div>
                            : <div className="flex gap-1.5">
                                <button onClick={() => handleApprove(entry)} className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50">✓ Approve</button>
                                <button onClick={() => setCloseTarget(entry)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">Close</button>
                              </div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-400">{tabEntries(activeTier, activeTab).length} entries</span>
            <span className="text-xs text-gray-400">Payday {paydayStr}</span>
          </div>
        </div>
      </main>

      {/* Close modal */}
      {closeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Close entry</h3>
            <p className="text-sm text-gray-500 mb-4">Excluded from export but kept permanently for records.</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="font-medium text-gray-800">{closeTarget.porterName || closeTarget.employeeNumber}</div>
              <div className="text-gray-500 mt-0.5">{closeTarget.propertyAddress} · {closeTarget.hours} hrs · {closeTarget.coverDay}</div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
              <input type="text" value={closeReason} onChange={e => setCloseReason(e.target.value)}
                placeholder="e.g. Duplicate entry, Under investigation…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B35]/20" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCloseTarget(null); setCloseReason('') }} className="btn-outline">Cancel</button>
              <button onClick={handleCloseConfirm} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900">Close entry</button>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Export to Fingercheck</h3>
                <p className="text-sm text-gray-500 mt-0.5">Period {periodStart} → {periodEnd}</p>
              </div>
              <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              {TIERS.map(tier => {
                const rows = allEntries[tier].filter(e => e.approvalStatus === 'approved')
                const hrs = rows.reduce((s, e) => s + e.hours, 0)
                return (
                  <div key={tier} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-600">{TIER_LABELS[tier]}</span>
                    <span className="text-sm">{rows.length} entries · {hrs.toFixed(1)} hrs</span>
                  </div>
                )
              })}
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-300">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-semibold">{allApproved.length} entries · {allApproved.reduce((s,e) => s+e.hours, 0).toFixed(1)} hrs</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5">ℹ️ Exported entries move to Exported tab. Snapshot saved to history. Asana tasks get "entered" comment.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className="btn-outline" disabled={exporting}>Cancel</button>
              <button onClick={handleExport} disabled={exporting || !allApproved.length} className="btn-gold">
                {exporting ? 'Exporting…' : `↓ Download CSV (${allApproved.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
