'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { Lang } from '@/lib/i18n'
import { createClient } from '@/lib/supabase-browser'

interface ExportRow {
  id: string
  export_id: string
  tier: string
  employee_number: string
  porter_name: string
  date_worked: string
  hours: number
  pay_code: string
  rate: string
  property_address: string
  manager: string
  asana_link: string
  entry_type: string
  job: string
  filename: string
  period_start: string
  period_end: string
  exported_at: string
}

interface ClosedRow {
  id: string
  entry_id: string
  reason: string
  closed_by: string
  closed_at: string
  entry: any
}

type ActiveTab = 'exported' | 'closed'

export default function PastTasksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [allRows, setAllRows] = useState<ExportRow[]>([])
  const [closedRows, setClosedRows] = useState<ClosedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('exported')
  const [userEmail, setUserEmail] = useState('')
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('bsm_lang') as Lang) || 'en'
    return 'en'
  })
  function switchLang(l: Lang) { setLang(l); localStorage.setItem('bsm_lang', l) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      await Promise.all([loadExported(), loadClosed()])
    })
  }, [])

  async function loadExported() {
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token || ''
      const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const exports = data.exports || []
      const allData: ExportRow[] = []
      for (const exp of exports) {
        const { data: rows } = await supabase
          .from('export_rows')
          .select('*')
          .eq('export_id', exp.id)
        if (rows) {
          rows.forEach(row => allData.push({
            ...row,
            filename: exp.filename,
            period_start: exp.period_start,
            period_end: exp.period_end,
            exported_at: exp.exported_at,
          }))
        }
      }
      allData.sort((a, b) => new Date(b.exported_at).getTime() - new Date(a.exported_at).getTime())
      setAllRows(allData)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function loadClosed() {
    try {
      const { data: closedData } = await supabase
        .from('closed_entries')
        .select('*')
        .order('closed_at', { ascending: false })

      // Also pull completed General Issues + Terminations from asana cache
      const { data: issueData } = await supabase
        .from('asana_task_cache')
        .select('task_id, name, notes, assignee, completed, task_type, updated_at')
        .in('task_type', ['general_issue', 'termination'])
        .eq('completed', true)
        .limit(500)

      // Convert asana issues to closed row format
      const issueRows: ClosedRow[] = (issueData || []).map(i => ({
        id: i.task_id,
        entry_id: i.task_id,
        reason: i.task_type === 'termination' ? 'Termination' : 'General Issue — Resolved',
        closed_by: i.assignee || 'Asana',
        closed_at: i.updated_at,
        entry: { porterName: i.name, asanaLink: `https://app.asana.com/0/0/${i.task_id}` },
      }))

      const combined = [...(closedData || []), ...issueRows]
        .sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime())
      setClosedRows(combined)
    } catch (e) { console.error(e) }
  }

  const filteredExported = !search.trim() ? allRows : allRows.filter(r =>
    r.employee_number?.toString().includes(search.trim()) ||
    r.porter_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.property_address?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredClosed = !search.trim() ? closedRows : closedRows.filter(r => {
    const q = search.toLowerCase()
    const entry = r.entry || {}
    return (
      entry.porterName?.toLowerCase().includes(q) ||
      entry.employeeNumber?.toString().includes(q) ||
      entry.propertyAddress?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    )
  })

  const totalHours = filteredExported.reduce((s, r) => s + Number(r.hours || 0), 0)
  const employeeCount = new Set(filteredExported.map(r => r.employee_number)).size

  function fmtDate(d: string) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang={lang} onLangChange={switchLang} userEmail={userEmail} />
      <main className="max-w-6xl mx-auto px-5 py-6">
        <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Past Tasks</h1>
            <p className="text-sm text-gray-500 mt-1">Payroll history — exported entries and closed/voided entries</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded">{allRows.length} exported</span>
            <span className="bg-gray-100 px-2 py-1 rounded">{closedRows.length} closed</span>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter by employee name, number, or property…"
              className="flex-1 border-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕ Clear</button>}
          </div>
          {search && (
            <p className="text-xs text-gray-400 mt-2">
              {activeTab === 'exported'
                ? `${filteredExported.length} result${filteredExported.length !== 1 ? 's' : ''} · ${employeeCount} employee${employeeCount !== 1 ? 's' : ''} · ${totalHours.toFixed(1)} hrs`
                : `${filteredClosed.length} closed result${filteredClosed.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-200 px-1">
            <button onClick={() => setActiveTab('exported')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors
                ${activeTab === 'exported' ? 'border-[#D4A843] text-[#0D1B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Exported
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{allRows.length}</span>
            </button>
            <button onClick={() => setActiveTab('closed')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors
                ${activeTab === 'closed' ? 'border-[#D4A843] text-[#0D1B35]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Closed / Voided
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{closedRows.length}</span>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
          ) : activeTab === 'exported' ? (
            <>
              {allRows.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-sm font-medium text-gray-700 mb-1">No export history yet</div>
                  <div className="text-xs text-gray-400">Entries appear here after you approve and export to Fingercheck</div>
                </div>
              ) : filteredExported.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-sm text-gray-500">No results for "{search}"</div>
                  <button onClick={() => setSearch('')} className="text-xs text-[#D4A843] mt-2 hover:underline block mx-auto">Clear search</button>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {search ? `${filteredExported.length} entries matching "${search}"` : `All ${allRows.length} exported entries`}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">Total hrs: <strong>{totalHours.toFixed(1)}</strong></span>
                      <span className="text-xs text-gray-400">🔒 Read only</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Employee</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Pay Period</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Date Worked</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Property</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5">Hours</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Rate</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Type</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Job Code</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Asana</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Manager</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Export</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExported.map((r, i) => (
                          <tr key={r.id || i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                            <td className="px-4 py-2.5">
                              <div className="text-xs font-medium text-gray-900">{r.porter_name || '—'}</div>
                              <div className="text-xs text-gray-400 font-mono">#{r.employee_number}</div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.period_start} → {r.period_end}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{r.date_worked}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[140px] truncate">{r.property_address || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-right font-medium">{r.hours}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {r.rate ? <span className="text-gray-700 font-medium">${r.rate}/hr</span> : <span className="text-red-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded
                                ${r.entry_type === 'billable' ? 'bg-purple-50 text-purple-700'
                                : r.entry_type === 'extra_hours' ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-700'}`}>
                                {r.entry_type === 'billable' ? 'Billable' : r.entry_type === 'extra_hours' ? 'Extra Hrs' : 'Cover'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.job || '—'}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {r.asana_link
                                ? <a href={r.asana_link} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline">↗ Task</a>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{r.manager || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{r.filename}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-400">🔒 All data is read only — exported payroll cannot be modified</span>
                    <span className="text-xs text-gray-400">{filteredExported.length} entries shown</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {closedRows.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">🔒</div>
                  <div className="text-sm font-medium text-gray-700 mb-1">No closed entries yet</div>
                  <div className="text-xs text-gray-400">Entries appear here when closed in the dashboard or in Asana</div>
                </div>
              ) : filteredClosed.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-sm text-gray-500">No results for "{search}"</div>
                  <button onClick={() => setSearch('')} className="text-xs text-[#D4A843] mt-2 hover:underline block mx-auto">Clear search</button>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {search ? `${filteredClosed.length} closed entries matching "${search}"` : `All ${closedRows.length} closed entries`}
                    </span>
                    <span className="text-xs text-gray-400">🔒 Read only</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Employee</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Date Worked</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Property</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5">Hours</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Type</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Close Reason</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Closed By</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Closed At</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Asana</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClosed.map((r, i) => {
                          const entry = r.entry || {}
                          const isAsanaClosed = r.reason === 'Closed in Asana'
                          return (
                            <tr key={r.id || i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5">
                                <div className="text-xs font-medium text-gray-900">{entry.porterName || '—'}</div>
                                <div className="text-xs text-gray-400 font-mono">#{entry.employeeNumber}</div>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">{entry.coverDay || '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[140px] truncate">{entry.propertyAddress || '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-right font-medium">{entry.hours || '—'}</td>
                              <td className="px-4 py-2.5 text-xs">
                                <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded
                                  ${entry.entryType === 'billable' ? 'bg-purple-50 text-purple-700'
                                  : entry.entryType === 'extra_hours' ? 'bg-amber-50 text-amber-700'
                                  : 'bg-blue-50 text-blue-700'}`}>
                                  {entry.entryType === 'billable' ? 'Billable' : entry.entryType === 'extra_hours' ? 'Extra Hrs' : 'Cover'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                {isAsanaClosed
                                  ? <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Closed in Asana</span>
                                  : <span className="text-gray-600">{r.reason || '—'}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">{r.closed_by || '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.closed_at)}</td>
                              <td className="px-4 py-2.5 text-xs">
                                {entry.asanaLink
                                  ? <a href={entry.asanaLink} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline">↗ Task</a>
                                  : <span className="text-gray-400">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-400">🔒 Read only</span>
                    <span className="text-xs text-gray-400">{filteredClosed.length} entries shown</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
