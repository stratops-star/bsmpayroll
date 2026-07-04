'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function AsanaImportPage() {
  const [supabase] = useState(() => createClient())
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [imported, setImported] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single()
      setIsAdmin(me?.role === 'admin')
    })()
  }, [])

  async function run() {
    setRunning(true); setDone(false); setErr(''); setImported(0); setSkipped(0); setLog([])
    let offset: string | null = null
    let imp = 0, skp = 0, guard = 0
    try {
      while (guard++ < 200) {
        const res = await fetch('/api/asana-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset, limit: 4 }) })
        const j = await res.json()
        if (!res.ok) { setErr(j.error || 'Import failed'); break }
        imp += j.imported; skp += j.skipped
        setImported(imp); setSkipped(skp)
        if (j.names?.length) setLog(l => [...l, ...j.names.map((n: string) => `Imported ${n}`)])
        offset = j.nextOffset
        if (j.done || !offset) { setDone(true); break }
      }
    } catch (e: any) { setErr(e.message) }
    setRunning(false)
  }

  if (isAdmin === null) return <Shell><p className="text-gray-400 text-sm">Loading…</p></Shell>
  if (!isAdmin) return <Shell><p className="text-gray-500">Admins only.</p></Shell>

  return (
    <Shell>
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-semibold text-[#0D1B35] mb-1">Import from Asana</h1>
        <p className="text-sm text-gray-500 mb-5">Pulls candidates from the “Prospective Candidates” project into the Candidate Pool. Already-imported candidates are skipped, so it’s safe to run more than once.</p>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex gap-4 mb-4">
            <div><div className="text-2xl font-bold text-emerald-600">{imported}</div><div className="text-xs text-gray-500">Imported</div></div>
            <div><div className="text-2xl font-bold text-gray-400">{skipped}</div><div className="text-xs text-gray-500">Skipped</div></div>
          </div>
          <button onClick={run} disabled={running}
            className="w-full bg-[#0D1B35] text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
            {running ? 'Importing…' : done ? 'Run again' : 'Start import'}
          </button>
          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{err}</p>}
          {done && !err && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg mt-3">Done — {imported} imported, {skipped} skipped. They’re in the <a href="/recruiting/pool" className="underline font-medium">Candidate Pool</a>.</p>}
        </div>

        {log.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4 max-h-72 overflow-auto">
            {log.map((l, i) => <div key={i} className="text-xs text-gray-600 py-0.5">✓ {l}</div>)}
          </div>
        )}

        <a href="/recruiting" className="inline-block mt-4 text-sm text-gray-500">← Back to recruiting</a>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F5F6FA] p-8">{children}</div>
}
