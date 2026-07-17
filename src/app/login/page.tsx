'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ValetInstall from '@/components/valet/ValetInstall'

const DOMAIN = 'bsmfacilitysolutions.com'
const CHAR = '#1E1B17'
const GOLD = '#DCB878'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'unauthorized') setError('Access denied — only BSM accounts are authorized.')
    else if (err === 'auth_failed') setError('Authentication failed — please try again.')
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const emailLower = email.toLowerCase()
    if (!emailLower.endsWith(`@${DOMAIN}`)) {
      setError(`Only @${DOMAIN} accounts are allowed. Valet attendants, use the button below.`)
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/hub'); router.refresh() }
  }

  async function handleGoogle() {
    setGLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `https://bsmfacilitysolutions.app/auth/callback`,
        queryParams: { hd: DOMAIN },
      },
    })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '28px 18px',
      background: `radial-gradient(900px 520px at 50% -8%, #2E2924 0%, ${CHAR} 58%)`,
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        .bsm-inp { width:100%; box-sizing:border-box; background:#191612; color:#F2EDE3;
          border:1px solid rgba(220,184,120,.22); border-radius:12px; padding:13px 14px;
          font-size:16px; outline:none; transition:border-color .15s, box-shadow .15s; font-family:inherit; }
        .bsm-inp::placeholder { color:#6E6558; }
        .bsm-inp:focus { border-color:${GOLD}; box-shadow:0 0 0 3px rgba(220,184,120,.14); }
        @keyframes bsmfade { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
      `}</style>

      <div style={{ position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)', width: 460, height: 300, background: 'radial-gradient(circle, rgba(220,184,120,.10) 0%, transparent 68%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', animation: 'bsmfade .35s ease-out' }}>

        {/* brand */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <img src="/bsm-logo.png" alt="BSM Facility Solutions" style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginTop: 18 }}>
            <div style={{ width: 34, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
            <span style={{ color: GOLD, fontSize: 10.5, fontWeight: 800, letterSpacing: 3 }}>OPERATIONS PLATFORM</span>
            <div style={{ width: 34, height: 1, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
          </div>
        </div>

        {/* card */}
        <div style={{ background: '#211E1A', border: '1px solid rgba(220,184,120,.28)', borderRadius: 20, padding: '26px 22px', boxShadow: '0 24px 60px -20px rgba(0,0,0,.7)' }}>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-.2px' }}>Sign in</h1>
          <p style={{ color: '#8C8375', fontSize: 13.5, margin: '0 0 22px' }}>BSM staff accounts</p>

          <button onClick={handleGoogle} disabled={gLoading}
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
                onChange={e => setEmail(e.target.value)} required placeholder={`you@${DOMAIN}`} />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input className="bsm-inp" type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {error && (
              <p style={{ fontSize: 13, color: '#FCA5A5', background: 'rgba(185,28,28,.14)', border: '1px solid rgba(248,113,113,.3)', padding: '9px 11px', borderRadius: 10, margin: 0, lineHeight: 1.45 }}>{error}</p>
            )}
            <button type="submit" disabled={loading}
              style={{ background: GOLD, color: CHAR, border: 'none', borderRadius: 12, padding: '14px', fontSize: 15.5, fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.55 : 1, letterSpacing: '.2px', fontFamily: 'inherit', marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* valet door */}
        <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid rgba(220,184,120,.14)', textAlign: 'center' }}>
          <p style={{ color: '#8C8375', fontSize: 12.5, margin: '0 0 10px' }}>Valet attendant?</p>
          <a href="/valet/login"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'transparent', color: GOLD, border: `1.5px solid ${GOLD}`, borderRadius: 12, padding: '12px', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15 l1.4-4.2a2 2 0 0 1 1.9-1.3h7.4a2 2 0 0 1 1.9 1.3L18 15" />
              <path d="M3.5 15h17v2.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" />
              <circle cx="7" cy="18.5" r="1.2" /><circle cx="17" cy="18.5" r="1.2" />
            </svg>
            Valet sign in
          </a>
        </div>

        <ValetInstall appName="BSM Facility Solutions" />

        <p style={{ textAlign: 'center', fontSize: 11.5, color: '#5A5348', marginTop: 22, lineHeight: 1.6 }}>
          Access restricted to authorized accounts
        </p>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#A79C88', marginBottom: 7, letterSpacing: '.3px' }

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: CHAR }}>
        <div style={{ width: 26, height: 26, border: `2px solid rgba(220,184,120,.25)`, borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
