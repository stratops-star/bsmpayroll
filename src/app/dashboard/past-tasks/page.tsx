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

export default function PastTasksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [allRows, setAllRows] = useState<ExportRow[]>([])
  const [loading, setLoading] = useState(true)
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
      await loadAll()
    })
  }, [])

  async function loadAll() {
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

  const filtered = !search.trim() ? allRows : allRows.filter(r =>
    r.employee_number?.toString().includes(search.trim()) ||
    r.porter_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.property_address?.toLowerCase().includes(search.toLowerCase())
  )

  const employeeCount = new Set(filtered.map(r => r.employee_number)).size
  const totalHours = filtered.reduce((s, r) => s + Number(r.hours || 0), 0)

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang={lang} onLangChange={switchLang} userEmail={userEmail} />
      <main className="max-w-6xl mx-auto px-5 py-6">
        <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Past Tasks</h1>
            <p className="text-sm text-gray-500 mt-1">Full payroll history across all exports — search by name, number, or property</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded">{allRows.length} total entries</span>
            <span className="bg-gray-100 px-2 py-1 rounded">{new Set(allRows.map(r => r.employee_number)).size} employees</span>
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
            <p className="text-xs text-gray-400 mt-2">{filtered.length} result{filtered.length !== 1 ? 's' : ''} · {employeeCount} employee{employeeCount !== 1 ? 's' : ''} · {totalHours.toFixed(1)} hrs</p>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-sm text-gray-400">Loading payroll history…</div>
          </div>
        ) : allRows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-medium text-gray-700 mb-1">No export history yet</div>
            <div className="text-xs text-gray-400">Entries appear here after you approve and export them to Fingercheck</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-sm text-gray-500">No results for "{search}"</div>
            <button onClick={() => setSearch('')} className="text-xs text-[#D4A843] mt-2 hover:underline block mx-auto">Clear search</button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700">
                {search ? `${filtered.length} entries matching "${search}"` : `All ${allRows.length} exported entries`}
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
                  {filtered.map((r, i) => (
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
              <span className="text-xs text-gray-400">{filtered.length} entries shown</span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
