'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { PorterEntry, Tier } from '@/lib/types'
import { getCurrentPeriod, getPreviousPeriod, fmtISO } from '@/lib/payPeriod'

type InnerTab = 'approved' | 'pending' | 'waiting' | 'closed' | 'exported'
type SortDir = 'asc' | 'desc' | null
type EntryTypeFilter = 'all' | 'cover' | 'extra_hours' | 'billable'

const TIERS: Tier[] = ['T1', 'T2', 'T3']
const TIER_LABELS: Record<Tier, string> = { T1: 'Tier 1', T2: 'Tier 2', T3: 'Tier 3' }

interface SortState { col: string; dir: SortDir }

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
  const [activeTab, setActiveTab] = useState<InnerTab>('pending')
  const [loading, setLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [closeTarget, setCloseTarget] = useState<PorterEntry | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ col: 'name', dir: 'asc' })
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>('all')
  const [search, setSearch] = useState('')
  const [exportCount, setExportCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      await loadEntries()
      await loadExportCount()
    })
  }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function loadExportCount() {
    try {
      const token = await getToken()
      const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setExportCount((data.exports || []).length)
    } catch {}
  }

  async function loadEntries() {
    setLoading(true)
    setStatusMsg('Loading…')
    try {
      const token = await getToken()
      const [sheetsRes, ratesRes] = await Promise.all([
        fetch(`/api/sheets?start=${periodStart}&end=${periodEnd}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/rates?start=${periodStart}&end=${periodEnd}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])
      const data = await sheetsRes.json()
      const ratesData = await ratesRes.json()
      if (data.error) throw new Error(data.error)

      const savedRates = ratesData.rates || {}
      const mapped: Record<Tier, PorterEntry[]> = { T1: [], T2: [], T3: [] }
      for (const tier of TIERS) {
        mapped[tier] = (data[tier] || []).map((e: PorterEntry) => ({
          ...e,
          rate: savedRates[e.id] || e.rate || '',
          approvalStatus: e.status?.toUpperCase() === 'CLOSED' ? 'closed'
            : e.isLastMinute ? 'waiting' : 'pending',
        }))
      }
      setAllEntries(mapped)
      const total = TIERS.reduce((s, t) => s + mapped[t].length, 0)
      const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      setLastRefreshed(now)
      setStatusMsg(`${total} entries loaded`)
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  function updateEntry(id: string, tier: Tier, patch: Partial<PorterEntry>) {
    setAllEntries(prev => ({
      ...prev,
      [tier]: prev[tier].map(e => e.id === id ? { ...e, ...patch } : e)
    }))
  }

  async function handleRateChange(entry: PorterEntry, rate: string) {
    updateEntry(entry.id, entry.tier, { rate })
    const token = await getToken()
    await fetch('/api/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sourceId: entry.id, tier: entry.tier, rate, periodStart, periodEnd }),
    })
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
    updateEntry(entry.id, entry.tier, {
      approvalStatus: entry.isLastMinute ? 'waiting' : 'pending'
    })
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
          [tier]: prev[tier].map(e =>
            e.approvalStatus === 'approved' ? { ...e, approvalStatus: 'exported' as const } : e
          )
        }))
      }
      setExportCount(c => c + 1)
      setStatusMsg('Exported — Asana tasks completed')
    } catch (e: any) { setStatusMsg(`Error: ${e.message}`) }
    setExporting(false); setShowExport(false)
  }

  function handleSort(col: string) {
    setSort(prev => ({
      col,
      dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc'
    }))
  }

  function sortIcon(col: string) {
    if (sort.col !== col) return ' ↕'
    return sort.dir === 'asc' ? ' ↑' : ' ↓'
  }

  function tabEntries(tier: Tier, tab: InnerTab): PorterEntry[] {
    let entries = allEntries[tier]
    if (tab === 'approved') entries = entries.filter(x => x.approvalStatus === 'approved')
    else if (tab === 'pending') entries = entries.filter(x => ['open','pending'].includes(x.approvalStatus) && !x.isLastMinute)
    else if (tab === 'waiting') entries = entries.filter(x => x.approvalStatus === 'waiting' || (x.isLastMinute && !['approved','closed','exported'].includes(x.approvalStatus)))
    else if (tab === 'closed') entries = entries.filter(x => x.approvalStatus === 'closed')
    else if (tab === 'exported') entries = entries.filter(x => x.approvalStatus === 'exported')

    // Type filter
    if (typeFilter !== 'all') entries = entries.filter(x => x.entryType === typeFilter)

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      entries = entries.filter(x =>
        x.porterName?.toLowerCase().includes(q) ||
        x.employeeNumber?.toLowerCase().includes(q) ||
        x.propertyAddress?.toLowerCase().includes(q)
      )
    }

    // Sort
    return [...entries].sort((a, b) => {
      let av = '', bv = ''
      if (sort.col === 'name') { av = a.porterName || ''; bv = b.porterName || '' }
      else if (sort.col === 'emp') { av = a.employeeNumber || ''; bv = b.employeeNumber || '' }
      else if (sort.col === 'date') { av = a.coverDay || ''; bv = b.coverDay || '' }
      else if (sort.col === 'hrs') { return sort.dir === 'asc' ? a.hours - b.hours : b.hours - a.hours }
      else if (sort.col === 'property') { av = a.propertyAddress || ''; bv = b.propertyAddress || '' }
      else if (sort.col === 'manager') { av = a.manager || ''; bv = b.manager || '' }
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }

  const allApproved = TIERS.flatMap(t => allEntries[t]).filter(e => e.approvalStatus === 'approved')
  const payday = new Date(periodEnd); payday.setDate(payday.getDate() + 3)
  const paydayStr = payday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const hasEntries = TIERS.some(t => allEntries[t].length > 0)
  const visibleEntries = tabEntries(activeTier, activeTab)

  return (
    <div className="min-h-screen bg-[#F5F6FA]">

      {/* Nav */}
      <header className="bg-[#0D1B35] h-[48px] px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#D4A843] flex items-center justify-center font-bold text-[#0D1B35] text-xs">B</div>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-white/50 text-xs">Payroll dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Icon-only refresh with tooltip */}
          <div className="relative group">
            <button
              onClick={loadEntries}
              disabled={loading}
              className="w-7 h-7 rounded-md border border-white/10 bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <svg className={loading ? 'animate-spin' : ''} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            </button>
            {lastRefreshed && (
              <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Last refreshed: {lastRefreshed}
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/dashboard/history')}
            className="text-white/55 text-xs hover:text-white transition-colors flex items-center gap-1.5"
          >
            Export history
            {exportCount > 0 && (
              <span className="bg-[#D4A843] text-[#0D1B35] text-xs font-semibold px-1.5 py-0.5 rounded">
                {exportCount}
              </span>
            )}
          </button>

          <button onClick={() => router.push('/dashboard/help')} className="text-white/55 text-xs hover:text-white transition-colors">Help</button>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-white/35 text-xs truncate max-w-[120px]">{userEmail}</span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-white/35 text-xs hover:text-white transition-colors">Sign out</button>
        </div>
      </header>

      {/* Tier tabs */}
      <div className="bg-white border-b border-gray-200 px-5 flex">
        {TIERS.map(tier => {
          const count = allEntries[tier].length
          const isActive = activeTier === tier
          return (
            <button key={tier} onClick={() => setActiveTier(tier)}
              className={`px-5 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap
                ${isActive ? 'border-[#D4A843] text-[#0D1B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TIER_LABELS[tier]}
              {count > 0 && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isActive ? 'bg-[#D4A843]/20 text-[#8B6A1A]' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <main className="px-5 py-4 max-w-7xl mx-auto">

        {/* Period card */}
        <div className="card p-4 mb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">Pay period</p>
              <div className="flex items-center gap-2">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]" />
              </div>
            </div>
            <button onClick={() => { setPeriodStart(fmtISO(currentPeriod.start)); setPeriodEnd(fmtISO(currentPeriod.end)) }} className="btn-outline text-xs py-1.5">Current</button>
            <button onClick={() => { setPeriodStart(fmtISO(prevPeriod.start)); setPeriodEnd(fmtISO(prevPeriod.end)) }} className="btn-outline text-xs py-1.5">Previous</button>
            <button onClick={loadEntries} disabled={loading}
              className="bg-[#0D1B35] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#152444] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
              {loading
                ? <><span className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full" />Loading…</>
                : '↻ Load'}
            </button>
            <div className="ml-auto">
              <button onClick={() => setShowExport(true)} disabled={!allApproved.length}
                className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
                ↓ Export approved ({allApproved.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Payday: <strong className="text-gray-600">{paydayStr}</strong>
            {statusMsg && <span className="ml-3 text-[#0D1B35] font-medium">{statusMsg}</span>}
          </p>
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
                  className={`card p-4 text-left hover:border-[#D4A843]/50 transition-colors ${activeTier === tier ? 'border-[#D4A843] border-[1.5px]' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800">{TIER_LABELS[tier]}</span>
                    <span className="text-xs text-gray-400">→ View</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-emerald-700">{ap}</div><div className="text-xs text-gray-500">Approved</div></div>
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-amber-700">{pe}</div><div className="text-xs text-gray-500">Pending</div></div>
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-red-700">{ur}</div><div className="text-xs text-gray-500">Urgent ⚡</div></div>
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-[#0D1B35]">{hrs.toFixed(1)}</div><div className="text-xs text-gray-500">Appr. hrs</div></div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Main table */}
        <div className="card overflow-hidden">

          {/* Toolbar: type filter + search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
            <div className="flex gap-1.5">
              {([['all','All'],['cover','Cover'],['extra_hours','Extra Hrs'],['billable','Billable']] as [EntryTypeFilter, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setTypeFilter(val)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors
                    ${typeFilter === val ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or emp #"
                className="border-none bg-transparent text-xs focus:outline-none w-full text-gray-700 placeholder-gray-400" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{visibleEntries.length} entries · click header to sort</span>
          </div>

          {/* Inner tabs */}
          <div className="flex border-b border-gray-200 px-1 items-center overflow-x-auto">
            {(['approved','pending','waiting','closed','exported'] as InnerTab[]).map(tab => {
              const count = tabEntries(activeTier, tab).length
              const labels: Record<InnerTab,string> = { approved:'Approved', pending:'Pending', waiting:'Waiting ⚡', closed:'Closed', exported:'Exported' }
              const colors: Record<InnerTab,string> = { approved:'bg-emerald-50 text-emerald-700', pending:'bg-amber-50 text-amber-700', waiting:'bg-red-50 text-red-700', closed:'bg-gray-100 text-gray-600', exported:'bg-blue-50 text-blue-700' }
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap
                    ${activeTab === tab ? 'border-[#D4A843] text-[#0D1B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {labels[tab]}
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colors[tab]}`}>{count}</span>
                </button>
              )
            })}
            <span className="ml-auto pr-3 text-xs text-gray-400">{TIER_LABELS[activeTier]}</span>
          </div>

          {/* Table */}
          {visibleEntries.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No entries match your filter</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8 px-2 py-2.5"></th>
                    <th onClick={() => handleSort('emp')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-14 cursor-pointer hover:text-gray-700">Emp #{sortIcon('emp')}</th>
                    <th onClick={() => handleSort('name')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-32 cursor-pointer hover:text-gray-700">Name{sortIcon('name')}</th>
                    <th onClick={() => handleSort('date')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20 cursor-pointer hover:text-gray-700">Date{sortIcon('date')}</th>
                    <th onClick={() => handleSort('hrs')} className="text-right text-xs font-medium text-gray-500 px-3 py-2.5 w-12 cursor-pointer hover:text-gray-700">Hrs{sortIcon('hrs')}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20">Type</th>
                    <th onClick={() => handleSort('property')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-32 cursor-pointer hover:text-gray-700">Property{sortIcon('property')}</th>
                    <th onClick={() => handleSort('manager')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-24 cursor-pointer hover:text-gray-700">Manager{sortIcon('manager')}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20">Job Code</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-16">Asana</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map(entry => {
                    const isApproved = entry.approvalStatus === 'approved'
                    const isClosed = entry.approvalStatus === 'closed'
                    const isExported = entry.approvalStatus === 'exported'
                    const isExpanded = expandedRow === entry.id
                    const payCode = entry.hoursType?.toUpperCase() === 'OT' ? 'OT' : 'RG'
                    const coverDate = entry.coverDay
                      ? new Date(entry.coverDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'
                    const propShort = (entry.propertyAddress || entry.property || '').split(',')[0]
                    const entryTypeLabel = entry.entryType === 'billable' ? 'Billable'
                      : entry.entryType === 'extra_hours' ? 'Extra Hrs' : 'Cover'
                    const entryTypeBadge = entry.entryType === 'billable'
                      ? 'bg-purple-50 text-purple-700'
                      : entry.entryType === 'extra_hours'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-blue-50 text-blue-700'

                    return (
                      <>
                        <tr
                          key={entry.id}
                          onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                          className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer
                            ${isApproved ? 'bg-emerald-50/30' : ''}
                            ${isClosed ? 'bg-gray-50/60 opacity-70' : ''}
                            ${isExpanded ? 'bg-blue-50/20' : ''}
                            ${entry.isLastMinute && !isApproved && !isClosed ? 'bg-red-50/20' : ''}`}
                        >
                          <td className="px-2 py-2.5 text-center">
                            <span className={`text-gray-400 text-xs inline-block transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{entry.employeeNumber}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900 truncate text-xs">{entry.porterName || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                            {coverDate}{entry.isLastMinute && !isClosed && <span className="ml-1 text-red-500">⚡</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-xs">{entry.hours}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${payCode === 'OT' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{payCode}</span>
                              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${entryTypeBadge}`}>{entryTypeLabel}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 truncate text-xs">{propShort || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 truncate text-xs">{entry.manager || '—'}</td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            {entry.jobCode
                              ? <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{entry.jobCode}</span>
                              : <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Missing</span>}
                          </td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            {entry.asanaLink
                              ? <a href={entry.asanaLink} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] text-xs hover:underline">↗ Task</a>
                              : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            {isExported ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">Exported</span>
                              : isClosed ? <button onClick={() => handleReopen(entry)} className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">↩ Reopen</button>
                              : isApproved ? (
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleUnapprove(entry)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">✕</button>
                                  <button onClick={() => setCloseTarget(entry)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">Close</button>
                                </div>
                              ) : (
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleApprove(entry)} className="text-xs px-2 py-1 rounded border border-[#D4A843]/40 text-[#8B6A1A] bg-[#D4A843]/10 hover:bg-[#D4A843]/20">✓ Approve</button>
                                  <button onClick={() => setCloseTarget(entry)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">Close</button>
                                </div>
                              )}
                          </td>
                        </tr>

                        {/* Accordion detail row */}
                        {isExpanded && (
                          <tr key={`${entry.id}-acc`} className="border-b border-gray-100 bg-blue-50/10">
                            <td colSpan={11} className="px-5 py-4">
                              <div className="grid grid-cols-5 gap-4 text-xs">
                                {/* Rate field */}
                                <div>
                                  <div className="text-gray-400 mb-1 font-medium">Rate ($/hr) — required</div>
                                  <input
                                    type="number" step="0.01"
                                    value={entry.rate}
                                    onChange={e => handleRateChange(entry, e.target.value)}
                                    placeholder="0.00"
                                    className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4A843]
                                      ${!entry.rate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                                    onClick={e => e.stopPropagation()}
                                    disabled={isExported || isClosed}
                                  />
                                  {!entry.rate && <p className="text-red-500 text-xs mt-0.5">Rate required before approving</p>}
                                </div>

                                {entry.porterStatus && <div><div className="text-gray-400 mb-1">Porter status</div><div className="text-gray-800 font-medium">{entry.porterStatus}</div></div>}
                                {entry.buildingStatus && <div><div className="text-gray-400 mb-1">Building status</div><div className="text-gray-800 font-medium">{entry.buildingStatus}</div></div>}
                                {entry.buildingMaxRate && <div><div className="text-gray-400 mb-1">Building max rate</div><div className="text-gray-800 font-medium">${entry.buildingMaxRate}</div></div>}
                                {entry.totalPay && <div><div className="text-gray-400 mb-1">Total pay</div><div className="text-gray-800 font-medium">${entry.totalPay}</div></div>}
                                {entry.isApartmentCleaned && <div><div className="text-gray-400 mb-1">Apt cleaned?</div><div className="text-gray-800 font-medium">{entry.isApartmentCleaned}</div></div>}
                                {entry.apartmentNumber && <div><div className="text-gray-400 mb-1">Apt #</div><div className="text-gray-800 font-medium">{entry.apartmentNumber}</div></div>}
                                {entry.service && <div><div className="text-gray-400 mb-1">Service</div><div className="text-gray-800 font-medium">{entry.service}</div></div>}
                                {entry.earning && <div><div className="text-gray-400 mb-1">Earning</div><div className="text-gray-800 font-medium">{entry.earning}</div></div>}
                                {entry.reasonForCoverage && <div><div className="text-gray-400 mb-1">Reason</div><div className="text-gray-800 font-medium">{entry.reasonForCoverage}</div></div>}
                                <div><div className="text-gray-400 mb-1">Submitted</div><div className="text-gray-800 font-medium">{entry.submissionDay || '—'}</div></div>
                                {entry.jobCode && <div><div className="text-gray-400 mb-1">Job code</div><div className="text-gray-800 font-mono font-medium">{entry.jobCode}</div></div>}

                                {entry.extraDetails && (
                                  <div className="col-span-2">
                                    <div className="text-gray-400 mb-1">Extra details</div>
                                    <div className="text-gray-800">{entry.extraDetails}</div>
                                  </div>
                                )}
                                {entry.screenshotUrl && (
                                  <div>
                                    <div className="text-gray-400 mb-1">Approval screenshot</div>
                                    <a href={entry.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline">↗ View screenshot</a>
                                  </div>
                                )}
                                {entry.asanaLink && (
                                  <div>
                                    <div className="text-gray-400 mb-1">Asana task</div>
                                    <a href={entry.asanaLink} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline">↗ Open in Asana</a>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-2 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-400">{visibleEntries.length} entries · click any row to expand details</span>
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
              <div className="font-medium">{closeTarget.porterName || closeTarget.employeeNumber}</div>
              <div className="text-gray-500 mt-0.5">{closeTarget.propertyAddress} · {closeTarget.hours} hrs · {closeTarget.coverDay}</div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
              <input type="text" value={closeReason} onChange={e => setCloseReason(e.target.value)}
                placeholder="e.g. Duplicate entry, Under investigation…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]"
                autoFocus />
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
              <div className="flex justify-between pt-2.5 mt-1 border-t border-gray-300">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-semibold">{allApproved.length} · {allApproved.reduce((s,e)=>s+e.hours,0).toFixed(1)} hrs</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5">ℹ️ Exported entries move to Exported tab. Asana tasks get "entered" comment and are marked complete.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className="btn-outline" disabled={exporting}>Cancel</button>
              <button onClick={handleExport} disabled={exporting || !allApproved.length}
                className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] disabled:opacity-40 inline-flex items-center gap-2">
                {exporting ? 'Exporting…' : `↓ Download CSV (${allApproved.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
