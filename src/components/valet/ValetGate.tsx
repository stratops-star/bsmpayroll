'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// Valet roles are their own island: NO @bsm domain requirement (attendants
// sign in with personal emails). Access is by role only.
const VALET_ROLES = ['valet', 'valet_manager', 'admin']

type State = 'loading' | 'redirect' | 'denied' | 'ok'

export default function ValetGate({
  require: req,
  children,
}: {
  require?: 'manager' // when set, only valet_manager / admin may view
  children: React.ReactNode
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setState('redirect'); router.replace('/valet/login'); return }

      const { data: me } = await supabase
        .from('app_users')
        .select('role, active, approved')
        .eq('id', user.id)
        .single()

      const role = me?.role || ''
      const activeOk = me?.active === true
      const approvedOk = role === 'admin' ? true : me?.approved === true
      const ok = VALET_ROLES.includes(role) && activeOk && approvedOk

      if (!ok) { setState('denied'); return }

      // Manager-only areas bounce plain attendants back to the capture app.
      if (req === 'manager' && role === 'valet') { router.replace('/valet'); return }

      setState('ok')
    })()
  }, [supabase, router, req])

  if (state === 'ok') return <>{children}</>
  if (state === 'loading') return <Screen>Loading…</Screen>
  if (state === 'redirect') return <Screen>Redirecting to sign in…</Screen>
  return (
    <Screen title="No valet access">
      This account isn’t set up for the valet app. Ask your manager to add you.
    </Screen>
  )
}

function Screen({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        {title && <h2 style={{ color: '#1E1B17', marginBottom: 8 }}>{title}</h2>}
        <p style={{ color: '#6B7280', lineHeight: 1.5 }}>{children}</p>
      </div>
    </div>
  )
}
