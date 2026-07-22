'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const BSM_DOMAIN = 'bsmfacilitysolutions.com' // ← confirm / change

// Where a scoped role lands when it has NOT been granted the department it tried to open.
// This is a default home, not a cage: departments decide access (see below).
const SCOPED_HOME: Record<string, string> = { pool: '/pool', manager: '/manpower' }

type State = 'loading' | 'no-session' | 'wrong-domain' | 'inactive' | 'no-department' | 'ok'

export default function AccessGate({
  requireDepartment,
  children,
}: {
  requireDepartment?: string
  children: React.ReactNode
}) {
  const router = useRouter()
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
        .from('app_users').select('role, departments, active').eq('id', user.id).single()

      if (!me?.active) { setState('inactive'); return }

      const role = me.role || ''

      // 1. Admins may enter any department-gated area.
      if (role === 'admin') { setState('ok'); return }

      // 2. Departments are the authority for access. If this user has been granted the
      //    department this area requires, they're in — whatever their role is. This is what
      //    lets a `manager` who has the `valet` department open the Valet module instead of
      //    being bounced to /manpower.
      const depts: string[] = me.departments || []
      const allowed = requireDepartment ? depts.includes(requireDepartment) : depts.length > 0
      if (allowed) { setState('ok'); return }

      // 3. Not granted this area. A scoped role goes to its own home screen rather than
      //    hitting a dead end; everyone else sees the "waiting for access" message.
      if (SCOPED_HOME[role]) { router.replace(SCOPED_HOME[role]); return }

      setState('no-department')
    })()
  }, [supabase, requireDepartment, router])

  if (state === 'ok') return <>{children}</>
  if (state === 'loading') return <Screen>Loading…</Screen>
  if (state === 'no-session')
    return <Screen title="Sign in required">Please sign in with your BSM email.</Screen>
  if (state === 'wrong-domain')
    return <Screen title="BSM accounts only">Only @{BSM_DOMAIN} accounts can access this app.</Screen>
  if (state === 'inactive')
    return <Screen title="Account inactive">Your account has been deactivated. Please contact an administrator.</Screen>
  return (
    <Screen title="You're almost in">
      Your account is signed in and waiting for a department assignment.
      An administrator will grant you access shortly.
    </Screen>
  )
}

function Screen({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bsm-app" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 440 }}>
        {title && <h2 className="text-[var(--text-strong)]" style={{ marginBottom: 8, fontSize: 20, fontWeight: 600 }}>{title}</h2>}
        <p className="text-[var(--muted)]" style={{ lineHeight: 1.55, fontSize: 14 }}>{children}</p>
      </div>
    </div>
  )
}
