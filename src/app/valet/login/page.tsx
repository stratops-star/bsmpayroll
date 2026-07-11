'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ValetInstall from '@/components/valet/ValetInstall'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'
const VALET_ROLES = ['valet', 'valet_manager', 'admin']

export default function ValetLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const router = useRouter()

  async function handleGoogle() {
    setGLoading(true)
    const supabase = createClient()
    // Reuse the office OAuth callback (enforces @bsm), then route to the valet manager area.
    // ValetGate on /valet/manager only admits admin / valet_manager.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://bsmfacilitysolutions.app/auth/callback?next=/valet/manager',
        queryParams: { hd: 'bsmfacilitysolutions.com' },
      },
    })
  }

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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ background: NAVY, borderRadius: 16, padding: '22px 24px', marginBottom: 14 }}>
            <img src="/bsm-logo.png" alt="BSM Facility Solutions" style={{ width: '100%', maxWidth: 210, height: 'auto', display: 'block', margin: '0 auto' }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>Valet</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Attendant sign in</p>
        </div>

        <button onClick={handleGoogle} disabled={gLoading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', border: '1px solid #D1D5DB', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer', opacity: gLoading ? 0.5 : 1, marginBottom: 14 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" />
          </svg>
          {gLoading ? 'Redirecting…' : 'Sign in with Google (BSM staff)'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>or attendant sign in</span>
          <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
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

        <ValetInstall />
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '12px', fontSize: 16, outline: 'none' }
