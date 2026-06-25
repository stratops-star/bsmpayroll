'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const DOMAIN = 'bsmfacilitysolutions.com'
const ALLOWED_EMAILS = [
  'strat.ops@bsmfacilitysolutions.com',
  'pinny@bsmfacilitysolutions.com',
  'payroll@bsmfacilitysolutions.com',
]

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
    if (err === 'unauthorized') setError('Access denied — your account is not authorized for this application.')
    else if (err === 'auth_failed') setError('Authentication failed — please try again.')
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const emailLower = email.toLowerCase()
    if (!emailLower.endsWith(`@${DOMAIN}`)) {
      setError(`Only @${DOMAIN} accounts are allowed.`)
      return
    }
    if (!ALLOWED_EMAILS.includes(emailLower)) {
      setError('Access denied — your account is not authorized for this application.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0D1B35] mb-4">
            <span className="text-[#F5C072] font-bold text-2xl">B</span>
          </div>
          <h1 className="text-xl font-semibold text-[#0D1B35]">BSM Facility Solutions</h1>
          <p className="text-sm text-gray-500 mt-1">Payroll Approval Dashboard</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <button onClick={handleGoogle} disabled={gLoading}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {gLoading
              ? <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full" />
              : <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
                </svg>}
            {gLoading ? 'Redirecting…' : 'Sign in with Google'}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder={`you@${DOMAIN}`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B35]/20 focus:border-[#0D1B35]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B35]/20 focus:border-[#0D1B35]" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#0D1B35] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#152444] transition-colors disabled:opacity-40 flex items-center justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">Access restricted to authorized BSM accounts only</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]"><div className="animate-spin w-6 h-6 border-2 border-[#D4A843] border-t-transparent rounded-full" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
