'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { PorterEntry, Tier } from '@/lib/types'
import { getCurrentPeriod, getPreviousPeriod, fmtISO } from '@/lib/payPeriod'
import { Lang, t, TRANSLATIONS } from '@/lib/i18n'
import NavBar from '@/components/NavBar'

type InnerTab = 'approved' | 'pending' | 'waiting' | 'billing' | 'errors' | 'closed' | 'exported' | 'general_issues' | 'terminations'
type EntryTypeFilter = 'all' | 'cover' | 'extra_hours' | 'billable'
interface SortState { col: string; dir: 'asc' | 'desc' }

const BILLING_ASSIGNEES = [
  'rebecca@bsmfacilitysolutions.com',
  'billing@bsmfacilitysolutions.com',
  'leah@bsmfacilitysolutions.com',
  'ella@bsmfacilitysolutions.com',
  'office@bsmfacilitysolutions.com',
  'abe@bsmfacilitysolutions.com',
]

function isBillingAssignee(email: string | null): boolean {
  if (!email) return false
  return BILLING_ASSIGNEES.includes(email.toLowerCase())
}

const TIERS: Tier[] = ['T1', 'T2', 'T3']

const FEDERAL_HOLIDAYS = [
  { name: "New Year's Day",             nameEs: 'Año Nuevo',                    nameYi: 'נייַ יאָר',          month: 1,  day: 1  },
  { name: "Martin Luther King Jr. Day", nameEs: 'Día de MLK Jr.',               nameYi: 'MLK Jr. טאָג',       month: 1,  day: 20 },
  { name: "Presidents Day",             nameEs: 'Día de los Presidentes',       nameYi: 'פּרעזידענטן טאָג',   month: 2,  day: 17 },
  { name: "Memorial Day",               nameEs: 'Día de los Caídos',            nameYi: 'מעמאָריאַל טאָג',    month: 5,  day: 26 },
  { name: "Juneteenth",                 nameEs: 'Juneteenth',                   nameYi: 'דזשונטינט',          month: 6,  day: 19 },
  { name: "Independence Day",           nameEs: 'Día de la Independencia',      nameYi: 'אומאַבהענגיקייט טאָג', month: 7, day: 4  },
  { name: "Labor Day",                  nameEs: 'Día del Trabajo',              nameYi: 'אַרבעטער טאָג',      month: 9,  day: 1  },
  { name: "Columbus Day",               nameEs: 'Día de Colón',                 nameYi: 'קאָלומבוס טאָג',     month: 10, day: 13 },
  { name: "Veterans Day",               nameEs: 'Día de los Veteranos',         nameYi: 'וועטעראַנן טאָג',    month: 11, day: 11 },
  { name: "Thanksgiving Day",           nameEs: 'Día de Acción de Gracias',     nameYi: 'דאַנקזאָגונג',       month: 11, day: 27 },
  { name: "Christmas Day",              nameEs: 'Navidad',                      nameYi: 'קריסטמאַס',          month: 12, day: 25 },
]

// Overlay tutorial steps
const TOUR_STEPS = [
  { target: 'tour-period', title: 'Pay Period', body: 'The current pay period loads automatically on login. Change dates and click Load to view a different period.' },
  { target: 'tour-export-btn', title: 'Export Approved', body: 'When you\'re ready, click here to export all approved entries to a Fingercheck CSV file.' },
  { target: 'tour-banners', title: 'Smart Reminders', body: 'Dismissible banners appear 7 days before SVPTO end of month, 1st & 15th rule dates, federal holidays, and prevailing wage updates.' },
  { target: 'tour-mini-cards', title: 'Tier Dashboard', body: 'Click any card to switch between Tier 1, 2, and 3. Shows approved, pending, urgent counts and approved hours.' },
  { target: 'tour-filter-bar', title: 'Filter & Search', body: 'Filter by entry type (Cover / Extra Hrs / Billable) or search by employee name or number.' },
  { target: 'tour-tabs', title: 'Entry Tabs', body: 'Approved · Pending · Waiting ⚡ (last-minute) · Billing · Errors (blocked) · Closed · Exported. Always check Errors first!' },
  { target: 'tour-table', title: 'Entry Table', body: 'Click any row to expand details. Rate is required before approving. Job code and Asana link must also be present.' },
  { target: 'tour-actions', title: 'Actions', body: 'Cover entries: Approve + Close. Extra Hrs + Billable: Approve only — no close. Asana task is updated automatically on approval.' },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const currentPeriod = getCurrentPeriod()
  const prevPeriod = getPreviousPeriod()

  const [lang, setLang] = useState<Lang>('en')
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
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([])
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [asanaCache, setAsanaCache] = useState<Record<string, { assignee: string | null; assignee_email: string | null; completed: boolean }>>({})
  const [asanaIssues, setAsanaIssues] = useState<{ task_id: string; name: string; notes: string; completed: boolean; assignee: string | null; due_on: string | null; task_type: string; updated_at: string }[]>([])
  const [syncingAsana, setSyncingAsana] = useState(false)
  const dir = TRANSLATIONS[lang].dir

  useEffect(() => {
    const saved = localStorage.getItem('bsm_lang') as Lang
    if (saved && ['en','es','yi'].includes(saved)) setLang(saved)
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      // Sync Asana first to get fresh data, then load cache and entries
      setSyncingAsana(true)
      try {
        const token = await getToken()
        await fetch('/api/asana-sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {}
      setSyncingAsana(false)
      // Now load cache with fresh data, then entries
      await loadAsanaCache()
      await Promise.all([loadEntries(), loadExportCount()])
      const tourDone = localStorage.getItem('bsm_tour_done')
      if (!tourDone) {
        setTimeout(() => setTourStep(0), 1000)
      }
    })
  }, [])

  async function syncAsanaInBackground() {
    try {
      setSyncingAsana(true)
      const token = await getToken()
      await fetch('/api/asana-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadAsanaCache()
    } catch {
      // Silent fail
    } finally {
      setSyncingAsana(false)
    }
  }

  function switchLang(l: Lang) { setLang(l); localStorage.setItem('bsm_lang', l) }

  function relaunchTour() {
    localStorage.removeItem('bsm_tour_done')
    setTourStep(0)
  }

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

  async function loadAsanaCache() {
    try {
      const supabase = createClient()
      const map: Record<string, { assignee: string | null; assignee_email: string | null; completed: boolean }> = {}
      const issues: typeof asanaIssues = []

      // Paginate to get all rows past Supabase's 1000 row default limit
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('asana_task_cache')
          .select('task_id, assignee, assignee_email, completed, name, notes, due_on, task_type, updated_at')
          .range(from, from + pageSize - 1)

        if (error || !data || data.length === 0) break

        for (const row of data) {
          map[row.task_id] = { assignee: row.assignee, assignee_email: row.assignee_email, completed: row.completed }
          if (row.task_type === 'general_issue' || row.task_type === 'termination') {
            issues.push(row)
          }
        }

        if (data.length < pageSize) break
        from += pageSize
      }

      setAsanaCache(map)
      setAsanaIssues(issues.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      console.log('Cache loaded:', Object.keys(map).length, 'tasks,', issues.length, 'issues')
      return map
    } catch (err) {
      console.error('Cache error:', err)
      return {}
    }
  }

  function getPastPeriods(count: number): { start: string; end: string; label: string }[] {
    const periods = []
    let endDate = new Date(periodStart)
    endDate.setDate(endDate.getDate() - 1)
    for (let i = 0; i < count; i++) {
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 6)
      const s = startDate.toISOString().split('T')[0]
      const e = endDate.toISOString().split('T')[0]
      const label = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      periods.push({ start: s, end: e, label })
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() - 1)
    }
    return periods
  }

  // Check Asana closed from cache map — accepts map directly to avoid stale state
  function isAsanaClosedFromMap(asanaId: string, cache: Record<string, { assignee: string | null; assignee_email: string | null; completed: boolean }>): boolean {
    if (!asanaId) return false
    return cache[asanaId]?.completed === true
  }

  // Check Asana closed from local state cache
  function isAsanaClosed(asanaId: string): boolean {
    if (!asanaId) return false
    return asanaCache[asanaId]?.completed === true
  }

  async function saveApprovalStatus(entryId: string, status: string, closedReason?: string) {
    try {
      const supabase = createClient()
      await supabase.from('entry_approvals').upsert({
        entry_id: entryId,
        approval_status: status,
        closed_reason: closedReason || null,
        approved_by: userEmail,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entry_id' })
    } catch {}
  }

  async function loadApprovals(entryIds: string[]): Promise<Record<string, { status: string; closedReason?: string }>> {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('entry_approvals')
        .select('entry_id, approval_status, closed_reason')
        .in('entry_id', entryIds)
      const map: Record<string, { status: string; closedReason?: string }> = {}
      for (const row of data || []) {
        map[row.entry_id] = { status: row.approval_status, closedReason: row.closed_reason }
      }
      return map
    } catch {
      return {}
    }
  }

  async function saveAsanaClosedEntry(entry: PorterEntry) {
    try {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('closed_entries')
        .select('id')
        .eq('entry_id', entry.id)
        .single()
      if (existing) return
      await supabase.from('closed_entries').insert({
        entry_id: entry.id,
        reason: 'Closed in Asana',
        closed_by: 'Asana',
        closed_at: new Date().toISOString(),
        entry: entry,
      })
    } catch {}
  }

  async function loadEntries() {
    setLoading(true)
    setStatusMsg(t(lang, 'period_loading'))
    try {
      const token = await getToken()

      // Get fresh cache map directly — don't rely on stale React state
      const freshCache = await loadAsanaCache()

      // Load current period + rates in parallel

      const [sheetsRes, ratesRes] = await Promise.all([
        fetch(`/api/sheets?start=${periodStart}&end=${periodEnd}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/rates?start=${periodStart}&end=${periodEnd}`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      const data = await sheetsRes.json()
      const ratesData = await ratesRes.json()
      if (data.error) throw new Error(data.error)
      const savedRates = ratesData.rates || {}

      // Collect all entry IDs to load approvals
      const allIds: string[] = []
      for (const tier of TIERS) {
        for (const e of (data[tier] || [])) allIds.push(e.id)
      }

      // Load past 4 periods entries
      const pastPeriods = getPastPeriods(4)
      const pastDataMap: Record<string, { data: any; rates: any }> = {}
      await Promise.all(pastPeriods.map(async period => {
        try {
          const [pastRes, pastRatesRes] = await Promise.all([
            fetch(`/api/sheets?start=${period.start}&end=${period.end}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`/api/rates?start=${period.start}&end=${period.end}`, { headers: { Authorization: `Bearer ${token}` } })
          ])
          const pastData = await pastRes.json()
          const pastRates = (await pastRatesRes.json()).rates || {}
          if (!pastData.error) {
            pastDataMap[period.label] = { data: pastData, rates: pastRates }
            for (const tier of TIERS) {
              for (const e of (pastData[tier] || [])) allIds.push(e.id)
            }
          }
        } catch {}
      }))

      // Load all approvals in ONE query
      const approvals = await loadApprovals(allIds)

      const mapped: Record<Tier, PorterEntry[]> = { T1: [], T2: [], T3: [] }

      // Map current period entries
      for (const tier of TIERS) {
        mapped[tier] = (data[tier] || []).map((e: PorterEntry) => {
          const saved = approvals[e.id]
          let approvalStatus: string
          if (saved?.status && saved.status !== 'pending') {
            approvalStatus = saved.status
          } else if (e.status?.toUpperCase() === 'CLOSED') {
            approvalStatus = 'closed'
          } else if (e.asanaId && isAsanaClosedFromMap(e.asanaId, freshCache)) {
            approvalStatus = 'closed'
            saveAsanaClosedEntry({ ...e, approvalStatus: 'closed', closedReason: 'Closed in Asana' })
            saveApprovalStatus(e.id, 'closed', 'Closed in Asana')
          } else {
            approvalStatus = e.isLastMinute ? 'waiting' : 'pending'
          }
          return {
            ...e,
            rate: savedRates[e.id] || e.rate || '',
            approvalStatus,
            closedReason: saved?.closedReason || (approvalStatus === 'closed' ? 'Closed in Asana' : undefined),
          }
        })
      }

      // Map past period entries
      for (const [periodLabel, { data: pastData, rates: pastRates }] of Object.entries(pastDataMap)) {
        for (const tier of TIERS) {
          const pastEntries = (pastData[tier] || []).map((e: PorterEntry) => {
            const saved = approvals[e.id]
            let approvalStatus: string
            if (saved?.status && saved.status !== 'pending') {
              approvalStatus = saved.status
            } else if (e.status?.toUpperCase() === 'CLOSED') {
              approvalStatus = 'closed'
            } else if (e.asanaId && isAsanaClosedFromMap(e.asanaId, freshCache)) {
              approvalStatus = 'closed'
              saveAsanaClosedEntry({ ...e, approvalStatus: 'closed', closedReason: 'Closed in Asana' })
              saveApprovalStatus(e.id, 'closed', 'Closed in Asana')
            } else {
              approvalStatus = e.isLastMinute ? 'waiting' : 'pending'
            }
            return {
              ...e,
              rate: pastRates[e.id] || e.rate || '',
              approvalStatus,
              closedReason: saved?.closedReason || (approvalStatus === 'closed' ? 'Closed in Asana' : undefined),
              pastPeriod: periodLabel,
            }
          }).filter((e: any) => ['pending','waiting','open','closed'].includes(e.approvalStatus))
          mapped[tier] = [...mapped[tier], ...pastEntries]
        }
      }

      setAllEntries(mapped)
      const total = TIERS.reduce((s, ti) => s + mapped[ti].length, 0)
      const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      setLastRefreshed(now)
      setStatusMsg(`${total} ${t(lang, 'period_loaded')}${data.fromCache ? ' (cached)' : ''}`)

      // Background sync to keep Supabase cache fresh
      syncSheetsInBackground()
    } catch (e: any) { setStatusMsg(`Error: ${e.message}`) }
    setLoading(false)
  }

  async function syncSheetsInBackground() {
    try {
      const token = await getToken()
      await fetch('/api/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ periodStart, periodEnd }),
      })
    } catch {}
  }


  function updateEntry(id: string, tier: Tier, patch: Partial<PorterEntry>) {
    setAllEntries(prev => ({ ...prev, [tier]: prev[tier].map(e => e.id === id ? { ...e, ...patch } : e) }))
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
    saveApprovalStatus(entry.id, 'approved')
    const token = await getToken()
    if (entry.asanaId) {
      await fetch('/api/asana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ asanaId: entry.asanaId, periodStart, periodEnd, entryType: entry.entryType }),
      })
    }
  }

  function handleUnapprove(entry: PorterEntry) {
    const status = entry.isLastMinute ? 'waiting' : 'pending'
    updateEntry(entry.id, entry.tier, { approvalStatus: status })
    saveApprovalStatus(entry.id, status)
  }

  async function handleCloseConfirm() {
    if (!closeTarget) return
    updateEntry(closeTarget.id, closeTarget.tier, { approvalStatus: 'closed', closedReason: closeReason })
    saveApprovalStatus(closeTarget.id, 'closed', closeReason)
    setCloseTarget(null); setCloseReason('')
    const token = await getToken()
    await fetch('/api/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entry: closeTarget, reason: closeReason, periodStart, periodEnd, userEmail }),
    })
  }

  function handleReopen(entry: PorterEntry) {
    const d = new Date(entry.submissionDay)
    if (Math.ceil((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)) > 14) return
    const status = 'pending'
    updateEntry(entry.id, entry.tier, { approvalStatus: status, closedReason: undefined })
    saveApprovalStatus(entry.id, status)
  }

  function isLocked(entry: PorterEntry): boolean {
    if (!['approved','exported'].includes(entry.approvalStatus)) return false
    return Math.ceil((Date.now() - new Date(entry.submissionDay).getTime()) / (1000 * 60 * 60 * 24)) > 14
  }

  function canApprove(entry: PorterEntry): boolean {
    return !!(entry.rate && entry.asanaLink && entry.jobCode)
  }

  function approveBlockReason(entry: PorterEntry): string {
    const m = []
    if (!entry.rate) m.push('rate')
    if (!entry.asanaLink) m.push('Asana link')
    if (!entry.jobCode) m.push('job code')
    return m.length ? `Missing: ${m.join(', ')}` : ''
  }

  async function handleExport() {
    setExporting(true)
    const token = await getToken()
    const allApproved = TIERS.flatMap(ti => allEntries[ti]).filter(e => e.approvalStatus === 'approved')
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
        setAllEntries(prev => ({ ...prev, [tier]: prev[tier].map(e => e.approvalStatus === 'approved' ? { ...e, approvalStatus: 'exported' as const } : e) }))
      }
      // Persist exported status for all approved entries
      for (const entry of allApproved) {
        saveApprovalStatus(entry.id, 'exported')
      }
      setExportCount(c => c + 1)
      setStatusMsg('Exported — Asana tasks updated')
    } catch (e: any) { setStatusMsg(`Error: ${e.message}`) }
    setExporting(false); setShowExport(false)
  }

  function handleSort(col: string) {
    setSort(prev => ({ col, dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
  }

  function sortIcon(col: string) {
    if (sort.col !== col) return ' ↕'
    return sort.dir === 'asc' ? ' ↑' : ' ↓'
  }

  function tabEntries(tier: Tier, tab: InnerTab): PorterEntry[] {
    let entries = allEntries[tier]
    if (tab === 'approved') entries = entries.filter(x => x.approvalStatus === 'approved')
    else if (tab === 'pending') entries = entries.filter(x => ['open','pending'].includes(x.approvalStatus) && !x.isLastMinute && x.entryType !== 'billable')
    else if (tab === 'waiting') entries = entries.filter(x => {
      // Exclude billing-assigned entries from waiting
      if (x.asanaId && asanaCache[x.asanaId] && isBillingAssignee(asanaCache[x.asanaId].assignee_email)) return false
      return (x.approvalStatus === 'waiting' || (x.isLastMinute && !['approved','closed','exported'].includes(x.approvalStatus))) && x.entryType !== 'billable'
    })
    else if (tab === 'billing') entries = entries.filter(x => {
      if (['closed','exported'].includes(x.approvalStatus)) return false
      if (x.entryType === 'billable') return true
      if (x.asanaId && asanaCache[x.asanaId]) {
        if (isBillingAssignee(asanaCache[x.asanaId].assignee_email)) return true
      }
      return false
    })
    else if (tab === 'errors') entries = entries.filter(x => {
      if (['closed','exported'].includes(x.approvalStatus)) return false
      // Exclude entries already in billing tab
      if (x.entryType === 'billable') return false
      if (x.asanaId && asanaCache[x.asanaId] && isBillingAssignee(asanaCache[x.asanaId].assignee_email)) return false
      return !x.jobCode || !x.asanaLink || !x.rate
    })
    else if (tab === 'errors') entries = entries.filter(x => !['closed','exported'].includes(x.approvalStatus) && (!x.jobCode || !x.asanaLink || !x.rate))
    else if (tab === 'closed') entries = entries.filter(x => x.approvalStatus === 'closed')
    else if (tab === 'exported') entries = entries.filter(x => x.approvalStatus === 'exported')
    // General Issues and Terminations come from asanaIssues, not entries — return empty array here
    if (tab === 'general_issues' || tab === 'terminations') return []
    if (typeFilter !== 'all') entries = entries.filter(x => x.entryType === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      entries = entries.filter(x => x.porterName?.toLowerCase().includes(q) || x.employeeNumber?.toLowerCase().includes(q) || x.propertyAddress?.toLowerCase().includes(q))
    }
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

  function getActiveBanners() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const banners: { id: string; type: 'holiday' | 'svpto' | 'first15' | 'prevwage'; message: string; sub: string }[] = []

    // Federal holiday banners
    for (const h of FEDERAL_HOLIDAYS) {
      const hDate = new Date(year, h.month - 1, h.day)
      const diff = Math.ceil((hDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diff >= 0 && diff <= 7) {
        const hName = lang === 'es' ? h.nameEs : lang === 'yi' ? h.nameYi : h.name
        banners.push({ id: `holiday-${year}-${h.month}-${h.day}`, type: 'holiday', message: `⚠️ ${t(lang,'banner_holiday')} — ${hName}`, sub: hDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) })
      }
    }

    // SVPTO — 7 days before end of month
    const endOfMonth = new Date(year, month, 0)
    if (Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
      banners.push({ id: `svpto-${year}-${month}`, type: 'svpto', message: `⚠️ ${t(lang,'banner_svpto')}`, sub: `${t(lang,'banner_end_of_month')}: ${endOfMonth.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
    }

    // Prevailing Wages — 7 days before end of month
    if (Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
      banners.push({ id: `prevwage-${year}-${month}`, type: 'prevwage', message: `💰 Remember to update all employees with Prevailing Wages.`, sub: `Due by end of month: ${endOfMonth.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
    }

    // 1st of next month
    const first = new Date(year, month, 1)
    if (Math.ceil((first.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
      banners.push({ id: `first-${year}-${month}`, type: 'first15', message: `⚠️ ${t(lang,'banner_first15')}`, sub: `${t(lang,'banner_the_1st')} ${first.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
    }

    // 15th
    const fifteen = now.getDate() < 15 ? new Date(year, month - 1, 15) : new Date(year, month, 15)
    if (Math.ceil((fifteen.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
      banners.push({ id: `fifteen-${fifteen.getFullYear()}-${fifteen.getMonth()}`, type: 'first15', message: `⚠️ ${t(lang,'banner_first15')}`, sub: `${t(lang,'banner_the_15th')} ${fifteen.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
    }

    return banners.filter(b => !dismissedBanners.includes(b.id))
  }

  // Group visible entries by period — current period first, then past periods
  function groupedEntries(entries: PorterEntry[]): { period: string | null; entries: PorterEntry[] }[] {
    const current: PorterEntry[] = []
    const pastMap = new Map<string, PorterEntry[]>()
    for (const e of entries) {
      const pp = (e as any).pastPeriod as string | undefined
      if (!pp) {
        current.push(e)
      } else {
        if (!pastMap.has(pp)) pastMap.set(pp, [])
        pastMap.get(pp)!.push(e)
      }
    }
    const groups: { period: string | null; entries: PorterEntry[] }[] = []
    if (current.length) groups.push({ period: null, entries: current })
    for (const [period, ents] of pastMap) {
      groups.push({ period, entries: ents })
    }
    return groups
  }

  const allApproved = TIERS.flatMap(ti => allEntries[ti]).filter(e => e.approvalStatus === 'approved')
  const payday = new Date(periodEnd + 'T12:00:00'); payday.setDate(payday.getDate() + 3)
  const paydayStr = payday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const hasEntries = TIERS.some(ti => allEntries[ti].length > 0)
  const visibleEntries = tabEntries(activeTier, activeTab)
  const tierLabels: Record<Tier, string> = { T1: t(lang,'tier1'), T2: t(lang,'tier2'), T3: t(lang,'tier3') }
  const groups = groupedEntries(visibleEntries)

  function renderEntryRow(entry: PorterEntry) {
    const isApproved = entry.approvalStatus === 'approved'
    const isClosed = entry.approvalStatus === 'closed'
    const isExported = entry.approvalStatus === 'exported'
    const isExpanded = expandedRow === entry.id
    const locked = isLocked(entry)
    const approved = canApprove(entry)
    const blockReason = approveBlockReason(entry)
    const payCode = entry.hoursType?.toUpperCase() === 'OT' ? 'OT' : 'RG'
    const coverDate = entry.coverDay ? new Date(entry.coverDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
    const propShort = (entry.propertyAddress || entry.property || '').split(',')[0]
    const etLabel = entry.entryType === 'billable' ? t(lang,'type_billable') : entry.entryType === 'extra_hours' ? t(lang,'type_extra') : t(lang,'type_cover')
    const etBadge = entry.entryType === 'billable' ? 'bg-purple-50 text-purple-700' : entry.entryType === 'extra_hours' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
    const wasClosedInAsana = isClosed && entry.closedReason === 'Closed in Asana'

    return (
      <>
        <tr key={entry.id}
          onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
          className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer
            ${isApproved ? 'bg-emerald-50/30' : ''}
            ${isClosed ? 'bg-gray-50/60 opacity-70' : ''}
            ${isExpanded ? 'bg-blue-50/20' : ''}
            ${entry.isLastMinute && !isApproved && !isClosed ? 'bg-red-50/20' : ''}`}>
          <td className="px-2 py-2.5 text-center">
            <span className={`text-gray-400 text-xs inline-block transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
          </td>
          <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{entry.employeeNumber}</td>
          <td className="px-3 py-2.5 font-medium text-gray-900 truncate text-xs">{entry.porterName || '—'}</td>
          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{coverDate}{entry.isLastMinute && !isClosed && <span className="ml-1 text-red-500">⚡</span>}</td>
          <td className="px-3 py-2.5 text-right font-medium text-xs">{entry.hours}</td>
          <td className="px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${payCode === 'OT' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{payCode}</span>
              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${etBadge}`}>{etLabel}</span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-gray-600 truncate text-xs">{propShort || '—'}</td>
          <td className="px-3 py-2.5 text-gray-600 truncate text-xs">{entry.manager || '—'}</td>
          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
            {entry.jobCode ? <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{entry.jobCode}</span> : <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{t(lang,'status_missing_job')}</span>}
          </td>
          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
            {entry.asanaLink ? <a href={entry.asanaLink} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] text-xs hover:underline">↗ Task</a> : <span className="text-gray-400 text-xs">—</span>}
          </td>
          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
            {locked ? (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{t(lang,'status_locked')}</span>
            ) : isExported ? (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{t(lang,'status_exported')}</span>
            ) : isClosed ? (
              <div className="flex flex-col gap-0.5">
                {wasClosedInAsana && <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Asana ✓</span>}
                <button onClick={() => handleReopen(entry)} className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">{t(lang,'action_reopen')}</button>
              </div>
            ) : entry.entryType === 'billable' ? (
              <button onClick={() => handleApprove(entry)} disabled={!approved}
                className={`text-xs px-2 py-1 rounded border transition-colors ${!approved ? 'border-red-200 text-red-400 bg-red-50 cursor-not-allowed' : 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100'}`}
                title={blockReason}>{!approved ? '🚫 Bill' : t(lang,'action_bill')}</button>
            ) : entry.entryType === 'extra_hours' ? (
              <button onClick={() => handleApprove(entry)} disabled={!approved}
                className={`text-xs px-2 py-1 rounded border transition-colors ${!approved ? 'border-red-200 text-red-400 bg-red-50 cursor-not-allowed' : 'border-[#D4A843]/40 text-[#8B6A1A] bg-[#D4A843]/10 hover:bg-[#D4A843]/20'}`}
                title={blockReason}>{!approved ? '🚫 Approve' : t(lang,'action_approve')}</button>
            ) : isApproved ? (
              <div className="flex gap-1.5">
                <button onClick={() => handleUnapprove(entry)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">{t(lang,'action_unapprove')}</button>
                <button onClick={() => setCloseTarget(entry)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">{t(lang,'action_close')}</button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => handleApprove(entry)} disabled={!approved}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${!approved ? 'border-red-200 text-red-400 bg-red-50 cursor-not-allowed' : 'border-[#D4A843]/40 text-[#8B6A1A] bg-[#D4A843]/10 hover:bg-[#D4A843]/20'}`}
                  title={blockReason}>{!approved ? '🚫 Approve' : t(lang,'action_approve')}</button>
                <button onClick={() => setCloseTarget(entry)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">{t(lang,'action_close')}</button>
              </div>
            )}
          </td>
        </tr>
        {isExpanded && (
          <tr key={`${entry.id}-acc`} className="border-b border-gray-100 bg-blue-50/10">
            <td colSpan={11} className="px-5 py-4">
              <div className="grid grid-cols-5 gap-4 text-xs">
                <div>
                  <div className="text-gray-400 mb-1 font-medium">{t(lang,'rate_label')}</div>
                  <input type="number" step="0.01" value={entry.rate}
                    onChange={e => handleRateChange(entry, e.target.value)} placeholder="0.00"
                    className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4A843] ${!entry.rate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    onClick={e => e.stopPropagation()} disabled={isExported || isClosed} />
                  {!entry.rate && <p className="text-red-500 text-xs mt-0.5">{t(lang,'rate_required')}</p>}
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
                {entry.asanaId && asanaCache[entry.asanaId]?.assignee && (
                  <div>
                    <div className="text-gray-400 mb-1">Asana assignee</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-800 font-medium text-xs">
                        👤 {asanaCache[entry.asanaId].assignee_email || asanaCache[entry.asanaId].assignee}
                      </span>
                      {isBillingAssignee(asanaCache[entry.asanaId].assignee_email) && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded flex-shrink-0">Billing</span>
                      )}
                    </div>
                  </div>
                )}
                {(entry as any).pastPeriod && <div><div className="text-gray-400 mb-1">Original period</div><div className="text-amber-700 font-medium">{(entry as any).pastPeriod}</div></div>}
                {entry.closedReason && <div><div className="text-gray-400 mb-1">Close reason</div><div className="text-gray-800 font-medium">{entry.closedReason}</div></div>}
                {entry.extraDetails && <div className="col-span-2"><div className="text-gray-400 mb-1">Extra details</div><div className="text-gray-800">{entry.extraDetails}</div></div>}
                {entry.screenshotUrl && <div><div className="text-gray-400 mb-1">Screenshot</div><a href={entry.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline">↗ View</a></div>}
                {entry.asanaLink && <div><div className="text-gray-400 mb-1">Asana task</div><a href={entry.asanaLink} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline">↗ Open in Asana</a></div>}
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]" dir={dir}>
      <NavBar lang={lang} onLangChange={switchLang} userEmail={userEmail} lastRefreshed={lastRefreshed} onRefresh={async () => { syncAsanaInBackground(); await loadEntries() }} loading={loading} exportCount={exportCount} onRelaunchTour={relaunchTour} syncing={syncingAsana} />

      <main className="px-5 py-4 max-w-7xl mx-auto">
        {/* Period card */}
        <div id="tour-period" className="card p-4 mb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t(lang,'period_label')}</p>
              <div className="flex items-center gap-2">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]" />
              </div>
            </div>
            <button onClick={() => { setPeriodStart(fmtISO(currentPeriod.start)); setPeriodEnd(fmtISO(currentPeriod.end)) }} className="btn-outline text-xs py-1.5">{t(lang,'period_current')}</button>
            <button onClick={() => { setPeriodStart(fmtISO(prevPeriod.start)); setPeriodEnd(fmtISO(prevPeriod.end)) }} className="btn-outline text-xs py-1.5">{t(lang,'period_previous')}</button>
            <button onClick={loadEntries} disabled={loading} className="bg-[#0D1B35] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#152444] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
              {loading ? <><span className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full" />{t(lang,'period_loading')}</> : t(lang,'period_load')}
            </button>
            <div id="tour-export-btn" className="ml-auto">
              <button onClick={() => setShowExport(true)} disabled={!allApproved.length} className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
                ↓ {t(lang,'export_approved')} ({allApproved.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {t(lang,'period_payday')}: <strong className="text-gray-600">{paydayStr}</strong>
            {statusMsg && <span className="ml-3 text-[#0D1B35] font-medium">{statusMsg}</span>}
          </p>
        </div>

        {/* Smart banners */}
        <div id="tour-banners">
          {getActiveBanners().map(banner => (
            <div key={banner.id} className={`border rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3
              ${banner.type === 'holiday' ? 'bg-blue-50 border-blue-200' :
                banner.type === 'prevwage' ? 'bg-green-50 border-green-200' :
                'bg-amber-50 border-amber-200'}`}>
              <div>
                <p className={`text-sm font-semibold
                  ${banner.type === 'holiday' ? 'text-blue-800' :
                    banner.type === 'prevwage' ? 'text-green-800' :
                    'text-amber-800'}`}>{banner.message}</p>
                <p className={`text-xs mt-0.5
                  ${banner.type === 'holiday' ? 'text-blue-600' :
                    banner.type === 'prevwage' ? 'text-green-600' :
                    'text-amber-600'}`}>{banner.sub}</p>
              </div>
              <button onClick={() => setDismissedBanners(prev => [...prev, banner.id])}
                className={`text-lg leading-none flex-shrink-0
                  ${banner.type === 'holiday' ? 'text-blue-400 hover:text-blue-600' :
                    banner.type === 'prevwage' ? 'text-green-400 hover:text-green-600' :
                    'text-amber-400 hover:text-amber-600'}`}>✕</button>
            </div>
          ))}
        </div>

        {/* Mini dashboards */}
        {hasEntries && (
          <div id="tour-mini-cards" className="grid grid-cols-3 gap-3 mb-4">
            {TIERS.map(tier => {
              const e = allEntries[tier]
              const ap = e.filter(x => x.approvalStatus === 'approved').length
              const pe = e.filter(x => ['open','pending'].includes(x.approvalStatus) && !x.isLastMinute).length
              const ur = e.filter(x => x.approvalStatus === 'waiting' || (x.isLastMinute && !['approved','closed','exported'].includes(x.approvalStatus))).length
              const hrs = e.filter(x => x.approvalStatus === 'approved').reduce((s, x) => s + x.hours, 0)
              return (
                <button key={tier} onClick={() => setActiveTier(tier)} className={`card p-4 text-left hover:border-[#D4A843]/50 transition-colors ${activeTier === tier ? 'border-[#D4A843] border-[1.5px]' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800">{tierLabels[tier]}</span>
                    <span className="text-xs text-gray-400">{t(lang,'mini_view')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-emerald-700">{ap}</div><div className="text-xs text-gray-500">{t(lang,'mini_approved')}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-amber-700">{pe}</div><div className="text-xs text-gray-500">{t(lang,'mini_pending')}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-red-700">{ur}</div><div className="text-xs text-gray-500">{t(lang,'mini_urgent')}</div></div>
                    <div className="bg-gray-50 rounded-lg p-2.5"><div className="text-lg font-semibold text-[#0D1B35]">{hrs.toFixed(1)}</div><div className="text-xs text-gray-500">{t(lang,'mini_appr_hrs')}</div></div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Main table */}
        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div id="tour-filter-bar" className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
            <div className="flex gap-1.5">
              {([['all', t(lang,'filter_all')], ['cover', t(lang,'filter_cover')], ['extra_hours', t(lang,'filter_extra')], ['billable', t(lang,'filter_billable')]] as [EntryTypeFilter, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setTypeFilter(val)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${typeFilter === val ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t(lang,'search_placeholder')} className="border-none bg-transparent text-xs focus:outline-none w-full text-gray-700 placeholder-gray-400" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{visibleEntries.length} {t(lang,'export_entries')}</span>
          </div>

          {/* Inner tabs */}
          <div id="tour-tabs" className="flex border-b border-gray-200 px-1 items-center overflow-x-auto">
            {(['approved','pending','waiting','billing','errors','closed','exported','general_issues','terminations'] as InnerTab[]).map(tab => {
              const isIssueTab = tab === 'general_issues' || tab === 'terminations'
              const count = isIssueTab
                ? asanaIssues.filter(i => i.task_type === (tab === 'general_issues' ? 'general_issue' : 'termination') && !i.completed).length
                : tabEntries(activeTier, tab).length
              const labels: Record<InnerTab,string> = {
                approved: t(lang,'tab_approved'),
                pending: t(lang,'tab_pending'),
                waiting: t(lang,'tab_waiting'),
                billing: t(lang,'tab_billing'),
                errors: t(lang,'tab_errors'),
                closed: t(lang,'tab_closed'),
                exported: t(lang,'tab_exported'),
                general_issues: 'General Issues',
                terminations: 'Terminations',
              }
              const colors: Record<InnerTab,string> = {
                approved:'bg-emerald-50 text-emerald-700',
                pending:'bg-amber-50 text-amber-700',
                waiting:'bg-red-50 text-red-700',
                billing:'bg-purple-50 text-purple-700',
                errors:'bg-red-50 text-red-700',
                closed:'bg-gray-100 text-gray-600',
                exported:'bg-blue-50 text-blue-700',
                general_issues:'bg-amber-50 text-amber-700',
                terminations:'bg-red-50 text-red-700',
              }
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap
                    ${activeTab === tab
                      ? tab === 'errors' ? 'border-red-500 text-red-700'
                      : tab === 'billing' ? 'border-purple-500 text-purple-700'
                      : tab === 'terminations' ? 'border-red-500 text-red-700'
                      : tab === 'general_issues' ? 'border-amber-500 text-amber-700'
                      : 'border-[#D4A843] text-[#0D1B35]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {labels[tab]}
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colors[tab]}`}>{count}</span>
                </button>
              )
            })}
            <span className="ml-auto pr-3 text-xs text-gray-400">{tierLabels[activeTier]}</span>
          </div>

          {activeTab === 'billing' && <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100"><p className="text-xs text-purple-700">Billable entries — approve to confirm hours. Asana task assigned to billing team.</p></div>}
          {activeTab === 'errors' && visibleEntries.length > 0 && <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2"><span className="text-red-500">⚠️</span><p className="text-xs text-red-700"><strong>{visibleEntries.length} entries cannot be approved</strong> — fix missing rate, job code, or Asana link first</p></div>}
          {activeTab === 'waiting' && visibleEntries.length > 0 && <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-2"><span className="text-red-500 mt-0.5">⚡</span><p className="text-xs text-red-700">Last-minute — review before payday <strong>{paydayStr}</strong></p></div>}
          {activeTab === 'closed' && visibleEntries.filter(e => e.closedReason === 'Closed in Asana').length > 0 && (
            <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
              <span className="text-orange-500">ℹ️</span>
              <p className="text-xs text-orange-700"><strong>{visibleEntries.filter(e => e.closedReason === 'Closed in Asana').length} entries</strong> were closed directly in Asana</p>
            </div>
          )}

          {/* General Issues tab content */}
          {activeTab === 'general_issues' && (
            <div className="divide-y divide-gray-100">
              {asanaIssues.filter(i => i.task_type === 'general_issue' && !i.completed).length === 0 ? (
                <div className="py-14 text-center text-gray-400 text-sm">No open general issues</div>
              ) : asanaIssues.filter(i => i.task_type === 'general_issue' && !i.completed).map(issue => (
                <div key={issue.task_id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{issue.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {issue.assignee && <span>👤 {issue.assignee}</span>}
                      {issue.due_on && <span>📅 {new Date(issue.due_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                    {issue.notes && <p className="text-xs text-gray-500 mt-1 truncate">{issue.notes}</p>}
                  </div>
                  <a href={`https://app.asana.com/0/0/${issue.task_id}`} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] text-xs hover:underline flex-shrink-0">↗ Asana</a>
                </div>
              ))}
            </div>
          )}

          {/* Terminations tab content */}
          {activeTab === 'terminations' && (
            <div className="divide-y divide-gray-100">
              {asanaIssues.filter(i => i.task_type === 'termination' && !i.completed).length === 0 ? (
                <div className="py-14 text-center text-gray-400 text-sm">No open terminations</div>
              ) : asanaIssues.filter(i => i.task_type === 'termination' && !i.completed).map(issue => (
                <div key={issue.task_id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{issue.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {issue.assignee && <span>👤 {issue.assignee}</span>}
                      {issue.due_on && <span>📅 {new Date(issue.due_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                    {issue.notes && <p className="text-xs text-gray-500 mt-1 truncate">{issue.notes}</p>}
                  </div>
                  <a href={`https://app.asana.com/0/0/${issue.task_id}`} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] text-xs hover:underline flex-shrink-0">↗ Asana</a>
                </div>
              ))}
            </div>
          )}

          {activeTab !== 'general_issues' && activeTab !== 'terminations' && (visibleEntries.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">{t(lang,'no_entries')}</div>
          ) : (
            <div id="tour-table" className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8 px-2 py-2.5"></th>
                    <th onClick={() => handleSort('emp')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-14 cursor-pointer hover:text-gray-700">{t(lang,'col_emp')}{sortIcon('emp')}</th>
                    <th onClick={() => handleSort('name')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-32 cursor-pointer hover:text-gray-700">{t(lang,'col_name')}{sortIcon('name')}</th>
                    <th onClick={() => handleSort('date')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20 cursor-pointer hover:text-gray-700">{t(lang,'col_date')}{sortIcon('date')}</th>
                    <th onClick={() => handleSort('hrs')} className="text-right text-xs font-medium text-gray-500 px-3 py-2.5 w-12 cursor-pointer hover:text-gray-700">{t(lang,'col_hrs')}{sortIcon('hrs')}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20">{t(lang,'col_type')}</th>
                    <th onClick={() => handleSort('property')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-32 cursor-pointer hover:text-gray-700">{t(lang,'col_property')}{sortIcon('property')}</th>
                    <th onClick={() => handleSort('manager')} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-24 cursor-pointer hover:text-gray-700">{t(lang,'col_manager')}{sortIcon('manager')}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-20">{t(lang,'col_jobcode')}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-16">{t(lang,'col_asana')}</th>
                    <th id="tour-actions" className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-28">{t(lang,'col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => (
                    <>
                      {group.period && (
                        <tr key={`sep-${group.period}`}>
                          <td colSpan={11} className="px-3 py-2 bg-amber-50 border-y border-amber-100">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-amber-700">⚠️ Past period: {group.period}</span>
                              <span className="text-xs text-amber-600">— {group.entries.length} unresolved {group.entries.length === 1 ? 'entry' : 'entries'} carried forward</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {group.entries.map(entry => renderEntryRow(entry))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {activeTab !== 'general_issues' && activeTab !== 'terminations' && (
          <div className="px-4 py-2 border-t border-gray-100 flex justify-between">
            <span className="text-xs text-gray-400">{visibleEntries.length} {t(lang,'export_entries')} · {t(lang,'click_to_expand')}</span>
            <span className="text-xs text-gray-400">{t(lang,'period_payday')} {paydayStr}</span>
          </div>
          )}
        </div>
      </main>

      {/* Interactive overlay tutorial */}
      {tourStep !== null && (
        <div className="fixed inset-0 z-[100]" onClick={() => {}}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#D4A843] flex items-center justify-center text-[#0D1B35] text-xs font-bold">{tourStep + 1}</div>
                <span className="text-xs text-gray-400">{tourStep + 1} of {TOUR_STEPS.length}</span>
              </div>
              <button onClick={() => { setTourStep(null); localStorage.setItem('bsm_tour_done', '1') }} className="text-gray-400 hover:text-gray-600 text-sm">✕ Skip</button>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{TOUR_STEPS[tourStep].title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{TOUR_STEPS[tourStep].body}</p>
            <div className="flex items-center justify-between">
              <button onClick={() => setTourStep(s => s !== null && s > 0 ? s - 1 : s)}
                disabled={tourStep === 0}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                ← Back
              </button>
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === tourStep ? 'bg-[#D4A843]' : 'bg-gray-200'}`} />
                ))}
              </div>
              {tourStep < TOUR_STEPS.length - 1 ? (
                <button onClick={() => setTourStep(s => s !== null ? s + 1 : s)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#0D1B35] text-white hover:bg-[#152444]">
                  Next →
                </button>
              ) : (
                <button onClick={() => { setTourStep(null); localStorage.setItem('bsm_tour_done', '1') }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#D4A843] text-[#0D1B35] font-semibold hover:bg-[#C49A38]">
                  Done ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Close modal */}
      {closeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={dir}>
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">{t(lang,'close_title')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t(lang,'close_body')}</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="font-medium">{closeTarget.porterName || closeTarget.employeeNumber}</div>
              <div className="text-gray-500 mt-0.5">{closeTarget.propertyAddress} · {closeTarget.hours} hrs · {closeTarget.coverDay}</div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t(lang,'close_reason')}</label>
              <input type="text" value={closeReason} onChange={e => setCloseReason(e.target.value)}
                placeholder={t(lang,'close_placeholder')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCloseTarget(null); setCloseReason('') }} className="btn-outline">{t(lang,'export_cancel')}</button>
              <button onClick={handleCloseConfirm} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900">{t(lang,'close_confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={dir}>
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{t(lang,'export_title')}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{t(lang,'export_period')} {periodStart} → {periodEnd}</p>
              </div>
              <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              {TIERS.map(tier => {
                const rows = allEntries[tier].filter(e => e.approvalStatus === 'approved')
                const hrs = rows.reduce((s, e) => s + e.hours, 0)
                return (
                  <div key={tier} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-600">{tierLabels[tier]}</span>
                    <span className="text-sm">{rows.length} {t(lang,'export_entries')} · {hrs.toFixed(1)} {t(lang,'export_hrs')}</span>
                  </div>
                )
              })}
              <div className="flex justify-between pt-2.5 mt-1 border-t border-gray-300">
                <span className="text-sm font-semibold">{t(lang,'export_total')}</span>
                <span className="text-sm font-semibold">{allApproved.length} · {allApproved.reduce((s,e)=>s+e.hours,0).toFixed(1)} {t(lang,'export_hrs')}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5">ℹ️ {t(lang,'export_note')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExport(false)} className="btn-outline" disabled={exporting}>{t(lang,'export_cancel')}</button>
              <button onClick={handleExport} disabled={exporting || !allApproved.length}
                className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] disabled:opacity-40 inline-flex items-center gap-2">
                {exporting ? t(lang,'export_exporting') : `↓ ${t(lang,'export_download')} (${allApproved.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
