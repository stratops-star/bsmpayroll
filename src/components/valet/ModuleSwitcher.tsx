'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const GOLD = '#DCB878'

type Mod = { key: string; name: string; href: string; icon: string }
const ALL: Record<string, Mod> = {
  hub: { key: 'hub', name: 'All modules (Hub)', href: '/hub', icon: '▦' },
  recruiting: { key: 'recruiting', name: 'Recruiting', href: '/recruiting', icon: '🧑\u200d💼' },
  payroll: { key: 'payroll', name: 'Payroll', href: '/dashboard', icon: '💰' },
  valet: { key: 'valet', name: 'Valet Parking', href: '/valet/manager', icon: '🚗' },
  access: { key: 'access', name: 'User Access', href: '/recruiting/admin', icon: '🛡️' },
}

export default function ModuleSwitcher({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [mods, setMods] = useState<Mod[]>([ALL.hub])
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
      setMods([ALL.hub, ...Array.from(keys).map(k => ALL[k]).filter(Boolean)])
    })()
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: 0 }}>
        <img src="/bsm-mark.png" alt="BSM" style={{ height: 28, width: 'auto' }} />
        <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 10.5, color: GOLD }}>tap to switch ▾</div>
        </div>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: 220, background: '#26221D', border: `1px solid ${GOLD}55`, borderRadius: 12, padding: 6, zIndex: 80, boxShadow: '0 16px 40px rgba(0,0,0,.5)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#8C8375', padding: '6px 10px 8px' }}>Switch module</div>
          {mods.map(m => (
            <a key={m.key} href={m.href}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(220,184,120,.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 8, textDecoration: 'none', color: '#EDE7DB', fontSize: 14, fontWeight: 500 }}>
              <span style={{ width: 20, textAlign: 'center' }}>{m.icon}</span>{m.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
