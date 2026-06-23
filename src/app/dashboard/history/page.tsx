'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { ExportRecord } from '@/lib/types'

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token || ''
      const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setExports(json.exports || [])
      setLoading(false)
    })
  }, [])

  async function redownload(exp: ExportRecord) {
    setDownloading(exp.id)
    const { data: sd } = await supabase.auth.getSession()
    const token = sd.session?.access_token || ''
    const res = await fetch(`/api/history/${exp.id}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = exp.filename; a.click()
    }
    setDownloading(null)
  }

  const totalEntries = exports.reduce((s, e) => s + e.total_entries, 0)
  const totalHours = exports.reduce((s, e) => s + Number(e.total_hours), 0)

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#0D1B35] h-[50px] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F5C072] flex items-center justify-center font-bold text-[#0D1B35] text-sm">B</div>
          <div className="w-px h-5 bg-white/15" />
          <span className="text-white/50 text-sm">Export history</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-white/55 text-xs hover:text-white">← Dashboard</button>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-white/40 text-xs">{userEmail}</span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="text-white/40 text-xs hover:text-white">Sign out</button>
        </div>
      </header>

      <main className="px-5 py-5 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Fingercheck export history</h1>
            <p className="text-sm text-gray-500 mt-0.5">All CSV exports — click Download to re-download any file</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="btn-navy text-xs py-1.5">← Dashboard</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[['Total exports', exports.length], ['Total entries', totalEntries.toLocaleString()], ['Total hours', totalHours.toFixed(1)]].map(([label, val]) => (
            <div key={label} className="card p-4">
              <div className="text-xl font-semibold text-gray-900">{val}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_160px_110px_80px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            {['File', 'Pay period', 'Date & time (EST)', 'Entries', ''].map(h => (
              <span key={h} className="text-xs font-medium text-gray-500">{h}</span>
            ))}
          </div>

          {loading && <div className="py-12 text-center text-sm text-gray-400">Loading…</div>}
          {!loading && !exports.length && <div className="py-12 text-center text-sm text-gray-400">No exports yet — they'll appear here after your first download</div>}

          {exports.map((exp, i) => {
            const exportedAt = new Date(exp.exported_at)
            const estStr = exportedAt.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
            const pStart = new Date(exp.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const pEnd = new Date(exp.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <div key={exp.id} className={`grid grid-cols-[1fr_100px_160px_110px_80px] gap-3 px-4 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < exports.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-[#FEF6E7] border border-[#F5C072]/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-[#C9943A] text-xs font-bold">FC</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{exp.filename}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{exp.exported_by} · {(exp.tiers || []).join(' + ')}</div>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-blue-50 text-blue-700 whitespace-nowrap">{pStart}–{pEnd}</span>
                <div>
                  <div className="text-xs text-gray-900">{estStr}</div>
                  <div className="text-xs text-gray-400 mt-0.5">EST</div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 whitespace-nowrap">{exp.total_entries} · {Number(exp.total_hours).toFixed(1)} hrs</span>
                <button onClick={() => redownload(exp)} disabled={downloading === exp.id}
                  className="btn-outline text-xs py-1.5 justify-center">
                  {downloading === exp.id ? '…' : '↓'}
                </button>
              </div>
            )
          })}

          {exports.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <span className="text-xs text-gray-400">Showing {exports.length} exports · All times in EST</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
