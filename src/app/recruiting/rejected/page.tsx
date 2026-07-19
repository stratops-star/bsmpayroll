'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import RecruitingTabs from '@/components/RecruitingTabs'
import { useRecruitingLang, SourceBadge } from '@/components/recruiting-i18n'

type Candidate = { id: string; created_at: string; full_name: string; phone: string | null; email: string | null; positions: string[] | null; borough: string | null; city: string | null; rejected_reason: string | null; profile_tier: string | null; intake_channel: string | null }

const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function RejectedPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [canAct, setCanAct] = useState(false)
  const [toast, setToast] = useState('');
  const { t } = useRecruitingLang()

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single(); setCanAct(me?.role === 'admin' || me?.role === 'recruiter') }
    const { data } = await supabase.from('candidates').select('id,created_at,full_name,phone,email,positions,borough,city,rejected_reason,profile_tier,intake_channel').eq('status', 'rejected').order('created_at', { ascending: false })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200) }
  async function restore(c: Candidate) {
    const toPool = c.rejected_reason === 'No longer interested'
    const patch = toPool ? { status: 'in_pool', in_pool: true, stage: 'available' } : { status: 'applied', stage: 'applied' }
    const { error } = await supabase.from('candidates').update(patch).eq('id', c.id)
    if (error) { flash(t('error') + ': ' + error.message); return }
    setRows(rs => rs.filter(r => r.id !== c.id)); flash(toPool ? t('restore_pool') : t('restore_queue'))
  }

  return (
    <div className="min-h-screen bsm-app">
      <div className="max-w-5xl mx-auto px-6 py-5">
        <div className="mb-4"><h1 className="text-xl font-semibold text-[var(--text-strong)]">{t('tab_rejected')}</h1><p className="text-xs text-[var(--muted)]">{t('rejected_sub')}</p></div>
        <RecruitingTabs />
        {loading ? <p className="text-[var(--faint)] text-sm">{t('loading')}</p>
          : rows.length === 0 ? <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center text-[var(--muted)]">{t('no_rejected')}</div>
          : (<>
            <div className="text-sm text-[var(--muted)] mb-4">{rows.length} · {t('rejected_sub')}</div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)] bg-gray-50 border-b border-[var(--border)]"><th className="px-4 py-3">{t('th_candidate')}</th><th className="px-4 py-3">{t('th_position')}</th><th className="px-4 py-3">{t('reason')}</th><th className="px-4 py-3">{t('rejected_on')}</th>{canAct && <th className="px-4 py-3"></th>}</tr></thead>
                <tbody>{rows.map(c => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center text-white text-xs font-semibold opacity-70" style={{ background: hue(c.email || c.full_name) }}>{ini(c.full_name)}</span><div><div className="font-semibold text-[var(--text)] flex items-center gap-2">{c.full_name}<SourceBadge channel={c.intake_channel} /></div><div className="text-xs text-[var(--faint)]">{[c.borough, c.city].filter(Boolean).join(', ')}</div></div></div></td>
                    <td className="px-4 py-3 text-[var(--muted)]">{(c.positions || [])[0] || '—'}{(c.positions || []).length > 1 ? ` +${(c.positions || []).length - 1}` : ''}</td>
                    <td className="px-4 py-3 text-[var(--muted)] max-w-[220px]">{c.rejected_reason === 'No longer interested' ? t('no_longer_interested') : (c.rejected_reason || <span className="text-[var(--faint)]">—</span>)}</td>
                    <td className="px-4 py-3 text-[var(--faint)] whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    {canAct && <td className="px-4 py-3 text-right"><button onClick={() => restore(c)} className="text-xs border border-[var(--border)] text-[var(--muted)] rounded-lg px-2.5 py-1 hover:bg-gray-50 whitespace-nowrap">↩ {c.rejected_reason === 'No longer interested' ? t('restore_pool') : t('restore_queue')}</button></td>}
                  </tr>))}
                </tbody></table>
            </div>
          </>)}
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[var(--gold)]">✓</span> {toast}</div>}
    </div>
  )
}
