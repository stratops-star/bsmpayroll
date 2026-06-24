'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { Lang } from '@/lib/i18n'
import { createClient } from '@/lib/supabase-browser'

export default function PastTasksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('bsm_lang') as Lang) || 'en'
    return 'en'
  })
  function switchLang(l: Lang) { setLang(l); localStorage.setItem('bsm_lang', l) }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUserEmail(data.user.email || '')
    })
  }, [])

  async function handleSearch() {
    if (!search.trim()) return
    setLoading(true); setSearched(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token || ''
      const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const exports = data.exports || []
      const allRows: any[] = []
      for (const exp of exports) {
        const { data: rows } = await supabase.from('export_rows').select('*').eq('export_id', exp.id)
        if (rows) {
          for (const row of rows) {
            if (row.employee_number?.toString().includes(search.trim()) ||
                row.porter_name?.toLowerCase().includes(search.toLowerCase())) {
              allRows.push({ ...row, filename: exp.filename, period_start: exp.period_start, period_end: exp.period_end, exported_at: exp.exported_at })
            }
          }
        }
      }
      setResults(allRows)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang={lang} onLangChange={switchLang} userEmail={userEmail} />
      <main className="max-w-5xl mx-auto px-5 py-6">
        <div className="mb-5">
          <h1 className="text-base font-semibold text-gray-900">Past Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">Search any employee name or number to see their full payroll history across all past exports</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
          <div className="flex gap-3">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter employee number or name (e.g. 794, Rivera, Kelly…)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843]" />
            <button onClick={handleSearch} disabled={loading}
              className="bg-[#0D1B35] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#152444] disabled:opacity-40">
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {!searched && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm font-medium text-gray-700 mb-1">Search for an employee</div>
            <div className="text-xs text-gray-400">Enter an employee number or name to see all their past payroll entries</div>
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-sm text-gray-500">No past payroll history found for "{search}"</div>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-sm font-medium text-gray-700">{results[0]?.porter_name || search} — {results.length} entries found</span>
                <span className="text-xs text-gray-500 ml-2">Emp # {results[0]?.employee_number}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Total hours: <strong>{results.reduce((s, r) => s + Number(r.hours || 0), 0).toFixed(1)}</strong></span>
                <span className="text-xs text-gray-400">🔒 Read only</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Pay Period</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Date Worked</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Property</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5">Hours</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Rate</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Job Code</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Export File</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-xs">{r.period_start} → {r.period_end}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{r.date_worked}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[140px]">{r.property_address || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-medium">{r.hours}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{r.rate ? `$${r.rate}/hr` : '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.job || '—'}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded
                          ${r.entry_type === 'billable' ? 'bg-purple-50 text-purple-700' : r.entry_type === 'extra_hours' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                          {r.entry_type === 'billable' ? 'Billable' : r.entry_type === 'extra_hours' ? 'Extra Hrs' : 'Cover'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 truncate max-w-[120px]">{r.filename}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <span className="text-xs text-gray-400">🔒 All data is read only — exported payroll cannot be modified</span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
