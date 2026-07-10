'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'
const VALET_ROLES = ['valet', 'valet_manager', 'admin']

export default function ValetLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data, error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (signErr || !data.user) {
      setError(signErr?.message || 'Sign in failed.')
      setLoading(false)
      return
    }

    const { data: me } = await supabase
      .from('app_users').select('role, active, approved').eq('id', data.user.id).single()
    const role = me?.role || ''
    if (!VALET_ROLES.includes(role) || me?.active === false) {
      await supabase.auth.signOut()
      setError('This account is not authorized for the valet app.')
      setLoading(false)
      return
    }

    router.replace(role === 'valet_manager' || role === 'admin' ? '/valet/manager' : '/valet')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F6FA', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-grid', placeItems: 'center', width: 64, height: 64, borderRadius: 18, background: NAVY, marginBottom: 14 }}>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 26 }}>B</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>BSM Valet</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Attendant sign in</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20, display: 'grid', gap: 14 }}>
          <div>
            <label style={lbl}>Email</label>
            <input type="email" inputMode="email" autoComplete="username" value={email}
              onChange={e => setEmail(e.target.value)} required placeholder="you@email.com" style={inp} />
          </div>
          <div>
            <label style={lbl}>Password</label>
            <input type="password" autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inp} />
          </div>
          {error && <p style={{ fontSize: 13, color: '#B91C1C', background: '#FEF2F2', padding: '8px 10px', borderRadius: 10, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 18 }}>
          Trouble signing in? Contact your valet manager.
        </p>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '12px', fontSize: 16, outline: 'none' }
