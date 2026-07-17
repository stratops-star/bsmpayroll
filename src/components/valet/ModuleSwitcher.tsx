'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const GOLD = '#DCB878'

type Mod = { key: string; name: string; href: string; icon: string }
const ALL: Record<string, Mod> = {
  hub: { key: 'hub', name: 'All modules (Hub)', href: '/hub', icon: 'hub' },
  recruiting: { key: 'recruiting', name: 'Recruiting', href: '/recruiting', icon: 'recruiting' },
  payroll: { key: 'payroll', name: 'Payroll', href: '/dashboard', icon: 'payroll' },
  valet: { key: 'valet', name: 'Valet Parking', href: '/valet/manager', icon: 'valet' },
  access: { key: 'access', name: 'User Access', href: '/recruiting/admin', icon: 'access' },
}

function ModIcon({ k }: { k: string }) {
  const p = { fill: 'none', stroke: GOLD, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (k === 'hub') return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  )
  if (k === 'valet') return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <path d="M4 15 l1.4-4.2 a2 2 0 0 1 1.9-1.3 h7.4 a2 2 0 0 1 1.9 1.3 L18 15" />
      <path d="M3.5 15 h17 v2.5 a1 1 0 0 1-1 1 H4.5 a1 1 0 0 1-1-1 z" />
      <circle cx="7" cy="18.5" r="1.2" /><circle cx="17" cy="18.5" r="1.2" />
    </svg>
  )
  if (k === 'payroll') return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <path d="M7 3 h7 l4 4 v11 a1 1 0 0 1-1 1 H7 a1 1 0 0 1-1-1 V4 a1 1 0 0 1 1-1 z" />
      <path d="M14 3 v4 h4" />
      <path d="M11 10 v6 M9.6 11 h2.2 a1.2 1.2 0 0 1 0 2.4 h-2.2 M9.6 13.4 h2.6" />
    </svg>
  )
  if (k === 'access') return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <path d="M12 3 l7 2.5 v5 c0 4.2-3 7.4-7 8.5 -4-1.1-7-4.3-7-8.5 v-5 z" />
      <path d="M9 12 l2 2 4-4.5" />
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="8" r="3.2" /><path d="M5.5 20 a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

export default function ModuleSwitcher({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [mods, setMods] = useState<Mod[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: me } = await supabase.from('app_users').select('role, departments').eq('id', user.id).single()
      const role = me?.role || ''
      const depts: string[] = Array.isArray((me as any)?.departments) ? (me as any).departments : []
      const keys = new Set<string>()
      if (role === 'admin') { keys.add('recruiting'); keys.add('payroll'); keys.add('valet'); keys.add('access') }
      depts.forEach(d => { if (ALL[d]) keys.add(d) })
      if (role === 'valet_manager' || role === 'valet') keys.add('valet')
      // The hub is BSM-staff only — it signs out anyone without a @bsm email.
      const isStaff = (user.email || '').toLowerCase().endsWith('@bsmfacilitysolutions.com')
      const list = Array.from(keys).map(k => ALL[k]).filter(Boolean)
      setMods(isStaff ? [ALL.hub, ...list] : list)
    })()
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const canSwitch = mods.length > 1

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => canSwitch && setOpen(o => !o)} disabled={!canSwitch}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: canSwitch ? 'pointer' : 'default', color: '#fff', padding: 0 }}>
        <img src="/bsm-mark.png" alt="BSM" style={{ height: 28, width: 'auto' }} />
        <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          {canSwitch && <div style={{ fontSize: 10.5, color: GOLD }}>tap to switch ▾</div>}
        </div>
      </button>

      {open && canSwitch && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: 220, background: '#26221D', border: `1px solid ${GOLD}55`, borderRadius: 12, padding: 6, zIndex: 80, boxShadow: '0 16px 40px rgba(0,0,0,.5)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#8C8375', padding: '6px 10px 8px' }}>Switch module</div>
          {mods.map(m => (
            <a key={m.key} href={m.href}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(220,184,120,.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 8, textDecoration: 'none', color: '#EDE7DB', fontSize: 14, fontWeight: 500 }}>
              <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', border: `1px solid ${GOLD}66`, display: 'grid', placeItems: 'center' }}><ModIcon k={m.icon} /></span>{m.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
