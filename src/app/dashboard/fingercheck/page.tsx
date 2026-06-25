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

export default function FingercheckeEmployeesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [employees, setEmployees] = useState<FCEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; new_employees: number; new_employee_list: any[] } | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showNewOnly, setShowNewOnly] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [lang, setLang] = useState<Lang>('en')
  const [lastSynced, setLastSynced] = useState('')

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
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (showNewOnly) params.set('new', 'true')
      const res = await fetch(`/api/fingercheck/employees?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmployees(data.employees || [])
      if (data.employees?.length > 0) {
        const latest = data.employees.reduce((a: FCEmployee, b: FCEmployee) =>
          new Date(a.synced_at) > new Date(b.synced_at) ? a : b
        )
        setLastSynced(new Date(latest.synced_at).toLocaleString('en-US', {
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

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const filtered = employees.filter(e => {
    if (showNewOnly) {
      const hireDate = e.raw_data?._hireDate
      if (!hireDate || new Date(hireDate) < thirtyDaysAgo) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return e.full_name?.toLowerCase().includes(q) ||
        e.employee_number?.toLowerCase().includes(q) ||
        e.job_code?.toLowerCase().includes(q) ||
        e.address?.toLowerCase().includes(q)
    }
    return true
  })

  const newEmployees = employees.filter(e => {
    const hireDate = e.raw_data?._hireDate
    return hireDate && new Date(hireDate) >= thirtyDaysAgo
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
                Employee roster, job codes, rates — synced from Fingercheck
                {lastSynced && <span className="ml-2 text-gray-400">· Last sync: {lastSynced}</span>}
              </p>
            </div>
            <button onClick={syncFromFingercheck} disabled={syncing}
              className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
              {syncing
                ? <><span className="animate-spin w-3 h-3 border border-[#0D1B35]/30 border-t-[#0D1B35] rounded-full" />Syncing…</>
                : '⟳ Sync from Fingercheck'}
            </button>
          </div>

          {syncResult && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
              <p className="text-xs text-emerald-700 font-medium">
                ✓ Synced {syncResult.synced} employees
                {syncResult.new_employees > 0 && (
                  <span className="ml-2 bg-emerald-100 px-2 py-0.5 rounded">
                    🆕 {syncResult.new_employees} new in last 30 days
                  </span>
                )}
              </p>
              {syncResult.new_employee_list?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {syncResult.new_employee_list.map(e => (
                    <span key={e.employee_number} className="text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded">
                      #{e.employee_number} {e.full_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card p-4">
            <div className="text-2xl font-semibold text-[#0D1B35]">{employees.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Employees</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-semibold text-emerald-700">
              {employees.filter(e => e.status?.toLowerCase() === 'active').length}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Active</div>
          </div>
          <div className="card p-4 cursor-pointer hover:border-[#D4A843]/50 transition-colors" onClick={() => setShowNewOnly(!showNewOnly)}>
            <div className="text-2xl font-semibold text-amber-700">{newEmployees.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">New (last 30 days) {showNewOnly ? '← showing' : '← click to filter'}</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 max-w-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, number, job code…"
                className="border-none bg-transparent text-xs focus:outline-none w-full text-gray-700 placeholder-gray-400" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
            </div>
            <button onClick={() => setShowNewOnly(!showNewOnly)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${showNewOnly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200'}`}>
              🆕 New only ({newEmployees.length})
            </button>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} employees</span>
          </div>

          {loading ? (
            <div className="py-14 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full" />
              Loading employees…
            </div>
          ) : employees.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-gray-400 text-sm mb-3">No employees synced yet</p>
              <button onClick={syncFromFingercheck} disabled={syncing}
                className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] disabled:opacity-40">
                ⟳ Sync from Fingercheck now
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No employees match this filter</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Employee</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Job Code</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Address</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Rate</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Hire Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const hireDate = e.raw_data?._hireDate
                    const isNew = hireDate && new Date(hireDate) >= thirtyDaysAgo
                    return (
                      <tr key={e.employee_number} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 ${isNew ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                                {e.full_name || '—'}
                                {isNew && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">🆕 New</span>}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">#{e.employee_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {e.job_code
                            ? <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{e.job_code}</span>
                            : <span className="text-xs text-red-400">Missing</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[180px] truncate">{e.address || '—'}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {e.rate
                            ? <span className="text-gray-700 font-medium">${e.rate}/hr</span>
                            : <span className="text-red-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            e.status?.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>{e.status || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(hireDate)}</td>
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
