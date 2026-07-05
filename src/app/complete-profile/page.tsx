'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#0D1B35', GOLD = '#D4A843'

export default function CompleteProfilePage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUid(user.id)
      const { data: me } = await supabase.from('app_users').select('full_name, phone').eq('id', user.id).single()
      // already complete → go to hub
      if (me?.phone) { router.push('/hub'); return }
      setName(me?.full_name || (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || '')
      setLoading(false)
    })()
  }, [])

  async function submit() {
    setErr('')
    const digits = phone.replace(/\D/g, '')
    if (!name.trim()) { setErr('Please enter your name.'); return }
    if (digits.length < 10) { setErr('Please enter a valid cellphone number.'); return }
    setBusy(true)
    const { error } = await supabase.from('app_users').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', uid)
    setBusy(false)
    if (error) { setErr(error.message); return }
    router.push('/hub')
  }

  if (loading) return <Shell><p style={{ color: '#94A3B8' }}>Loading…</p></Shell>

  return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 50px -20px rgba(13,27,53,.35)', borderTop: `4px solid ${GOLD}` }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: '0 0 6px' }}>Complete your profile</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>We need your name and a cellphone number before you continue. Your number is used for interview and scheduling texts.</p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Full name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          style={inp} />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '14px 0 5px' }}>Cellphone</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel"
          style={inp} />

        {err && <p style={{ color: '#DC2626', fontSize: 13, background: '#FEF2F2', padding: '8px 12px', borderRadius: 8, margin: '14px 0 0' }}>{err}</p>}

        <button onClick={submit} disabled={busy}
          style={{ width: '100%', marginTop: 18, background: GOLD, color: NAVY, border: 0, borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </Shell>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F6FA', fontFamily: 'system-ui, sans-serif', padding: 20 }}>{children}</div>
}
