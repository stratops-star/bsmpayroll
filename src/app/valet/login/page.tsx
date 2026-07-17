'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ValetInstall from '@/components/valet/ValetInstall'

const CHAR = '#1E1B17'
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
      .from('app_users').select('role, active, approved, departments').eq('id', data.user.id).single()
    const role = me?.role || ''
    const dept = Array.isArray((me as any)?.departments) ? (me as any).departments : []
    const hasValet = dept.includes('valet')
    if (!(VALET_ROLES.includes(role) || hasValet) || me?.active === false) {
      await supabase.auth.signOut()
      setError('This account is not authorized for the valet app.')
      setLoading(false)
      return
    }

    const mgr = role === 'valet_manager' || role === 'admin' || hasValet
    router.replace(mgr ? '/valet/manager' : '/valet')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '28px 18px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      background: `radial-gradient(900px 520px at 50% -8%, #2E2924 0%, ${CHAR} 58%)`,
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        .bsm-inp { width:100%; box-sizing:border-box; background:#191612; color:#F2EDE3;
          border:1px solid rgba(220,184,120,.22); border-radius:12px; padding:13px 14px;
          font-size:16px; outline:none; transition:border-color .15s, box-shadow .15s; font-family:inherit; }
        .bsm-inp::placeholder { color:#6E6558; }
        .bsm-inp:focus { border-color:${GOLD}; box-shadow:0 0 0 3px rgba(220,184,120,.14); }
        .bsm-gbtn:active { transform:scale(.99); }
        .bsm-sbtn:active { transform:scale(.99); }
        @keyframes bsmfade { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
      `}</style>

      {/* corner glow */}
      <div style={{ position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)', width: 460, height: 300, background: 'radial-gradient(circle, rgba(220,184,120,.10) 0%, transparent 68%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', animation: 'bsmfade .35s ease-out' }}>

        {/* brand */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <img src="/bsm-logo.png" alt="BSM Facility Solutions" style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginTop: 18 }}>
            <div style={{ width: 34, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
            <span style={{ color: GOLD, fontSize: 10.5, fontWeight: 800, letterSpacing: 3 }}>VALET SERVICE</span>
            <div style={{ width: 34, height: 1, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
          </div>
        </div>

        {/* card */}
        <div style={{
          background: '#211E1A', border: '1px solid rgba(220,184,120,.28)', borderRadius: 20, padding: '26px 22px',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.7)',
        }}>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-.2px' }}>Sign in</h1>
          <p style={{ color: '#8C8375', fontSize: 13.5, margin: '0 0 22px' }}>Attendants and BSM staff</p>

          <button onClick={handleGoogle} disabled={gLoading} className="bsm-gbtn"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14.5, fontWeight: 600, color: '#3C4043', cursor: 'pointer', opacity: gLoading ? 0.55 : 1, fontFamily: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" />
            </svg>
            {gLoading ? 'Redirecting…' : 'Sign in with Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(220,184,120,.18)' }} />
            <span style={{ fontSize: 10.5, color: '#6E6558', fontWeight: 700, letterSpacing: 1.4 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(220,184,120,.18)' }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 15 }}>
            <div>
              <label style={lbl}>Email</label>
              <input className="bsm-inp" type="email" inputMode="email" autoComplete="username" value={email}
                onChange={e => setEmail(e.target.value)} required placeholder="you@email.com" />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input className="bsm-inp" type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {error && (
              <p style={{ fontSize: 13, color: '#FCA5A5', background: 'rgba(185,28,28,.14)', border: '1px solid rgba(248,113,113,.3)', padding: '9px 11px', borderRadius: 10, margin: 0, lineHeight: 1.45 }}>{error}</p>
            )}
            <button type="submit" disabled={loading} className="bsm-sbtn"
              style={{ background: GOLD, color: CHAR, border: 'none', borderRadius: 12, padding: '14px', fontSize: 15.5, fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.55 : 1, letterSpacing: '.2px', fontFamily: 'inherit', marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#6E6558', marginTop: 20, lineHeight: 1.6 }}>
          Trouble signing in? Contact your valet manager.
        </p>

        <ValetInstall />

        <div style={{ textAlign: 'center', marginTop: 26, color: '#4F4840', fontSize: 10.5, letterSpacing: '.4px' }}>
          BSM FACILITY SOLUTIONS
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#A79C88', marginBottom: 7, letterSpacing: '.3px' }
