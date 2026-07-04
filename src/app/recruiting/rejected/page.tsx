'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Candidate = { id: string; created_at: string; full_name: string; phone: string | null; email: string | null; positions: string[] | null; borough: string | null; city: string | null; rejected_reason: string | null; profile_tier: string | null }

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function RejectedPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter') }
    const { data } = await supabase.from('candidates').select('id,created_at,full_name,phone,email,positions,borough,city,rejected_reason,profile_tier').eq('status', 'rejected').order('created_at', { ascending: false })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200) }
  async function restore(c: Candidate) { const { error } = await supabase.from('candidates').update({ status: 'applied', stage: 'applied' }).eq('id', c.id); if (error) { flash('Error: ' + error.message); return }; setRows(rs => rs.filter(r => r.id !== c.id)); flash('Restored to New Queue') }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="bg-[#0D1B35] text-white px-6 py-4 border-b-[3px] border-[#D4A843]">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <a href="/hub" className="text-white/50 text-sm">← Hub</a>
          <div><div className="text-lg font-semibold">Rejected</div><div className="text-xs text-white/50">Not advanced · kept for reference</div></div>
        </div>
        <div className="max-w-5xl mx-auto flex gap-1 mt-3 flex-wrap">{[['New Queue', '/recruiting'], ['Interview', '/recruiting/interview'], ['Candidate Pool', '/recruiting/pool'], ['Rejected', '/recruiting/rejected']].map(([l, h]) => <a key={h} href={h} className={`text-sm px-3 py-1.5 rounded-lg ${l === 'Rejected' ? 'bg-white/15 text-white font-medium' : 'text-white/55 hover:text-white'}`}>{l}</a>)}</div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? <p className="text-gray-400 text-sm">Loading…</p>
          : rows.length === 0 ? <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">No rejected candidates.</div>
          : (<>
            <div className="text-sm text-gray-500 mb-4">{rows.length} rejected candidate{rows.length > 1 ? 's' : ''} · reference only</div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200"><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Rejected</th>{canAct && <th className="px-4 py-3"></th>}</tr></thead>
                <tbody>{rows.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold opacity-70" style={{ background: hue(c.email || c.full_name) }}>{ini(c.full_name)}</span><div><div className="font-semibold text-gray-700">{c.full_name}</div><div className="text-xs text-gray-400">{[c.borough, c.city].filter(Boolean).join(', ')}</div></div></div></td>
                    <td className="px-4 py-3 text-gray-500">{(c.positions || [])[0] || '—'}{(c.positions || []).length > 1 ? ` +${(c.positions || []).length - 1}` : ''}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[220px]">{c.rejected_reason || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    {canAct && <td className="px-4 py-3 text-right"><button onClick={() => restore(c)} className="text-xs border border-gray-200 text-gray-600 rounded-lg px-2.5 py-1 hover:bg-gray-50">↩ Restore</button></td>}
                  </tr>))}
                </tbody></table>
            </div>
          </>)}
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0D1B35] text-white px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[#D4A843]">✓</span> {toast}</div>}
    </div>
  )
}
