'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import NavBar from '@/components/NavBar'
import { Lang } from '@/lib/i18n'

interface FCEmployee {
  employee_number: string
  full_name: string
  email: string
  job_code: string
  address: string
  rate: number | null
  status: string
  synced_at: string
  raw_data: any
}

type TabFilter = 'active' | 'new' | 'terminated'
type SortCol = 'name' | 'number' | 'job_code' | 'department' | 'status' | 'hire_date' | 'term_date'
type SortDir = 'asc' | 'desc'

export default function FingercheckeEmployeesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState<FCEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('active')
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [userEmail, setUserEmail] = useState('')
  const [lang, setLang] = useState<Lang>('en')
  const [lastSynced, setLastSynced] = useState('')

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      loadEmployees()
    })
  }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function loadEmployees() {
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/fingercheck/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmployees(data.employees || [])
      if (data.employees?.length > 0) {
        const latest = data.employees.reduce((a: FCEmployee, b: FCEmployee) =>
          new Date(a.synced_at) > new Date(b.synced_at) ? a : b
        )
        setLastSynced(new Date(latest.synced_at).toLocaleTimeString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        }))
      }
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  async function syncFromFingercheck() {
    setSyncing(true)
    setSyncResult(null)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/fingercheck/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSyncResult(data)
      await loadEmployees()
    } catch (e: any) { setError(e.message) }
    setSyncing(false)
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col: SortCol) {
    if (sortCol !== col) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  // Tab filtering
  const activeEmployees = employees.filter(e => e.status === 'Active')
  const newEmployees = employees.filter(e => {
    const hireDate = e.raw_data?._hireDate
    return hireDate && new Date(hireDate) >= thirtyDaysAgo && e.status === 'Active'
  })
  const recentlyTerminated = employees.filter(e => {
    const termDate = e.raw_data?._termDate
    return termDate && new Date(termDate) >= ninetyDaysAgo && e.status === 'Terminated'
  })

  const tabEmployees = activeTab === 'active' ? activeEmployees
    : activeTab === 'new' ? newEmployees
    : recentlyTerminated

  // Search filter
  const searched = !search.trim() ? tabEmployees : tabEmployees.filter(e => {
    const q = search.toLowerCase()
    return e.full_name?.toLowerCase().includes(q) ||
      e.employee_number?.toString().includes(q) ||
      e.job_code?.toLowerCase().includes(q) ||
      e.address?.toLowerCase().includes(q) ||
      e.raw_data?._department?.toLowerCase().includes(q)
  })

  // Sort
  const sorted = [...searched].sort((a, b) => {
    let av = '', bv = ''
    if (sortCol === 'name') { av = a.full_name || ''; bv = b.full_name || '' }
    else if (sortCol === 'number') { return sortDir === 'asc' ? Number(a.employee_number) - Number(b.employee_number) : Number(b.employee_number) - Number(a.employee_number) }
    else if (sortCol === 'job_code') { av = a.job_code || ''; bv = b.job_code || '' }
    else if (sortCol === 'department') { av = a.raw_data?._department || ''; bv = b.raw_data?._department || '' }
    else if (sortCol === 'status') { av = a.status || ''; bv = b.status || '' }
    else if (sortCol === 'hire_date') { av = a.raw_data?._hireDate || ''; bv = b.raw_data?._hireDate || '' }
    else if (sortCol === 'term_date') { av = a.raw_data?._termDate || ''; bv = b.raw_data?._termDate || '' }
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  function fmtDate(d: string) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang={lang} onLangChange={l => setLang(l)} userEmail={userEmail} />
      <main className="max-w-6xl mx-auto px-5 py-6">

        {/* Header */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-base font-semibold text-[#0D1B35]">Fingercheck Employees</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Employee roster, departments, job codes
                {lastSynced && <span className="ml-2 text-gray-400">· Last sync: {lastSynced}</span>}
              </p>
            </div>
            <button onClick={syncFromFingercheck} disabled={syncing}
              className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
              {syncing ? <><span className="animate-spin w-3 h-3 border border-[#0D1B35]/30 border-t-[#0D1B35] rounded-full" />Syncing…</> : '⟳ Sync from Fingercheck'}
            </button>
          </div>

          {syncResult && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
              <p className="text-xs text-emerald-700 font-medium flex flex-wrap gap-2">
                ✓ Synced {syncResult.synced} employees
                {syncResult.rates_synced > 0 && <span className="bg-emerald-100 px-2 py-0.5 rounded">💰 {syncResult.rates_synced} rates</span>}
                {syncResult.jobs_synced > 0 && <span className="bg-emerald-100 px-2 py-0.5 rounded">🔧 {syncResult.jobs_synced} jobs</span>}
                {syncResult.new_employees > 0 && <span className="bg-emerald-100 px-2 py-0.5 rounded">🆕 {syncResult.new_employees} new in last 30 days</span>}
              </p>
              {syncResult.new_employee_list?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {syncResult.new_employee_list.map((e: any) => (
                    <span key={e.employee_number} className="text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded">
                      #{e.employee_number} {e.full_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-700">⚠️ {error}</div>}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card p-4 cursor-pointer hover:border-[#D4A843]/50" onClick={() => setActiveTab('active')}>
            <div className={`text-2xl font-semibold ${activeTab === 'active' ? 'text-[#D4A843]' : 'text-emerald-700'}`}>{activeEmployees.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active Employees</div>
          </div>
          <div className="card p-4 cursor-pointer hover:border-[#D4A843]/50" onClick={() => setActiveTab('new')}>
            <div className={`text-2xl font-semibold ${activeTab === 'new' ? 'text-[#D4A843]' : 'text-amber-700'}`}>{newEmployees.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">New (last 30 days)</div>
          </div>
          <div className="card p-4 cursor-pointer hover:border-[#D4A843]/50" onClick={() => setActiveTab('terminated')}>
            <div className={`text-2xl font-semibold ${activeTab === 'terminated' ? 'text-[#D4A843]' : 'text-red-700'}`}>{recentlyTerminated.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Terminated (last 90 days)</div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {/* Tabs + Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
            <div className="flex gap-1">
              {([['active', `Active (${activeEmployees.length})`], ['new', `🆕 New (${newEmployees.length})`], ['terminated', `Terminated 90d (${recentlyTerminated.length})`]] as [TabFilter, string][]).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${activeTab === tab ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, number, department…"
                className="border-none bg-transparent text-xs focus:outline-none w-full text-gray-700 placeholder-gray-400" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{sorted.length} employees</span>
          </div>

          {loading ? (
            <div className="py-14 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full" />Loading…
            </div>
          ) : employees.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-gray-400 text-sm mb-3">No employees synced yet</p>
              <button onClick={syncFromFingercheck} disabled={syncing} className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] disabled:opacity-40">
                ⟳ Sync from Fingercheck now
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No employees match this filter</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th onClick={() => handleSort('number')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700 w-16">#{sortIcon('number')}</th>
                    <th onClick={() => handleSort('name')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700">Name{sortIcon('name')}</th>
                    <th onClick={() => handleSort('department')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700">Department{sortIcon('department')}</th>
                    <th onClick={() => handleSort('job_code')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700">Job Code{sortIcon('job_code')}</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Address</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Rate</th>
                    <th onClick={() => handleSort('status')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700">Status{sortIcon('status')}</th>
                    <th onClick={() => handleSort('hire_date')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700">Hire Date{sortIcon('hire_date')}</th>
                    {activeTab === 'terminated' && <th onClick={() => handleSort('term_date')} className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 cursor-pointer hover:text-gray-700">Term Date{sortIcon('term_date')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(e => {
                    const hireDate = e.raw_data?._hireDate
                    const termDate = e.raw_data?._termDate
                    const department = e.raw_data?._department
                    const isNew = hireDate && new Date(hireDate) >= thirtyDaysAgo && e.status === 'Active'
                    return (
                      <tr key={e.employee_number} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 ${isNew ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{e.employee_number}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                            {e.full_name || '—'}
                            {isNew && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">🆕</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{department || '—'}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {e.job_code
                            ? <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{e.job_code}</span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[160px] truncate">{e.address || '—'}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {e.rate ? <span className="text-gray-700 font-medium">${e.rate}/hr</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            e.status === 'Active' ? 'bg-emerald-50 text-emerald-700'
                            : e.status === 'Terminated' ? 'bg-red-50 text-red-700'
                            : e.status === 'Onboarding' ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}>{e.status || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(hireDate)}</td>
                        {activeTab === 'terminated' && <td className="px-4 py-2.5 text-xs text-red-500">{fmtDate(termDate)}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
