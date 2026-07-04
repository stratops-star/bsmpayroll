'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const BSM_DOMAIN = 'bsmfacilitysolutions.com' // ← confirm / change

type State = 'loading' | 'no-session' | 'wrong-domain' | 'no-department' | 'ok'

export default function AccessGate({
  requireDepartment,
  children,
}: {
  requireDepartment?: string
  children: React.ReactNode
}) {
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setState('no-session'); return }

      if (!user.email?.toLowerCase().endsWith('@' + BSM_DOMAIN)) {
        await supabase.auth.signOut()
        setState('wrong-domain'); return
      }

      const { data: me } = await supabase
        .from('app_users').select('departments, active').eq('id', user.id).single()

      const depts = (me?.active && me.departments) || []
      const allowed = requireDepartment ? depts.includes(requireDepartment) : depts.length > 0
      setState(allowed ? 'ok' : 'no-department')
    })()
  }, [supabase, requireDepartment])

  if (state === 'ok') return <>{children}</>
  if (state === 'loading') return <Screen>Loading…</Screen>
  if (state === 'no-session')
    return <Screen title="Sign in required">Please sign in with your BSM email.</Screen>
  if (state === 'wrong-domain')
    return <Screen title="BSM accounts only">Only @{BSM_DOMAIN} accounts can access this app.</Screen>
  return (
    <Screen title="You're almost in">
      Your account is signed in and waiting for a department assignment.
      An administrator will grant you access shortly.
    </Screen>
  )
}

function Screen({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 440 }}>
        {title && <h2 style={{ color: '#0D1B35', marginBottom: 8 }}>{title}</h2>}
        <p style={{ color: '#6B7280', lineHeight: 1.5 }}>{children}</p>
      </div>
    </div>
  )
}
