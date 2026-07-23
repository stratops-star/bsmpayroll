'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { ThemeToggle } from '@/components/theme'

// ── Module map: department → destination ──────────────────────────────
type Mod = { key: string; label: string; href: string }
const MODULES: Record<string, Mod> = {
  recruiting: { key: 'recruiting', label: 'Recruiting', href: '/recruiting' },
  payroll: { key: 'payroll', label: 'Payroll', href: '/dashboard' },
  valet: { key: 'valet', label: 'Valet Parking', href: '/valet' },
}

// gold-outline module icons (brand: stroke #DCB878, no fill)
const ICON: Record<string, JSX.Element> = {
  recruiting: <><circle cx="12" cy="8" r="3.2" /><path d="M6 19c0-3.3 2.7-5 6-5s6 1.7 6 5" /></>,
  payroll: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M12 9v6M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2-5 1-5 3 0 1 1 1.6 2.5 1.6s2.5-.5 2.5-1.5" /></>,
  valet: <path d="M5 15l1.5-4.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 15M5 15h14v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM7.5 15h.01M16.5 15h.01" />,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  hub: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></>,
}
const Ring = ({ k }: { k: string }) => (
  <span className="w-7 h-7 rounded-full border border-[#DCB878] grid place-items-center flex-shrink-0">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DCB878" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICON[k]}</svg>
  </span>
)

const Mark = () => (
  // The real BSM wordmark. Sits on the charcoal header, which stays charcoal in
  // both themes, so the standard (light-on-dark) logo file is correct here.
  <img src="/bsm-logo.png" alt="BSM Facility Solutions" height={24}
    className="h-[24px] w-auto flex-shrink-0 object-contain" />
)

export default function BsmHeader({ area, right }: { area?: string; right?: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [mods, setMods] = useState<Mod[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(false)   // module switcher
  const [gear, setGear] = useState(false)   // mobile gear menu
  const [areaOverride, setAreaOverride] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const gearRef = useRef<HTMLDivElement>(null)

  // A page can set the header area by dispatching a 'bsm:area' event.
  useEffect(() => {
    const onArea = (e: any) => setAreaOverride(e?.detail ?? null)
    window.addEventListener('bsm:area', onArea as any)
    return () => window.removeEventListener('bsm:area', onArea as any)
  }, [])
  const shownArea = areaOverride ?? area

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || '')
      const { data: me } = await supabase.from('app_users').select('role, departments, active').eq('id', user.id).single()
      if (!me?.active) return
      const admin = me.role === 'admin'
      setIsAdmin(admin)
      const depts: string[] = me.departments || []
      const list = admin
        ? Object.values(MODULES)                       // admins see everything
        : depts.map(d => MODULES[d]).filter(Boolean)   // others: only their departments
      setMods(list)
    })()
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGear(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const canSwitch = mods.length > 1 || isAdmin
  async function signOut() { await supabase.auth.signOut(); router.push('/login') }

  return (
    <header className="bg-[#1E1B17] h-[52px] px-[18px] flex items-center justify-between gap-3 relative z-50">
      {/* left: mark + switcher */}
      <div className="flex items-center gap-3 min-w-0" ref={ref}>
        <button
          onClick={() => canSwitch ? setOpen(o => !o) : router.push(mods[0]?.href || '/hub')}
          className="flex items-center gap-3 min-w-0"
          title={canSwitch ? 'Switch module' : 'Home'}>
          <Mark />
          <span className="flex flex-col items-start leading-tight min-w-0">
            {/* mobile: just the area · desktop: BSM — area */}
            <span className="text-white text-[15px] font-bold truncate">
              {shownArea || 'Operations'}
            </span>
            {canSwitch && <span className="text-[#DCB878] text-[11px] flex items-center gap-1">tap to switch <span className="opacity-60">▾</span></span>}
          </span>
        </button>

        {canSwitch && open && (
          <div className="absolute top-[48px] left-0 bg-[#211E1A] border border-[#DCB878]/25 rounded-[14px] p-[7px] w-[246px] z-[60] shadow-[0_24px_50px_-18px_rgba(0,0,0,.7)]">
            <div className="text-[10px] font-bold tracking-[.18em] text-[#8C8375] uppercase px-2.5 pt-2 pb-1.5">Switch workspace</div>
            {mods.map(m => (
              <button key={m.href} onClick={() => { setOpen(false); router.push(m.href) }}
                className="w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-[9px] text-[#EDE7DD] text-sm font-medium hover:bg-[#26221D]">
                <Ring k={m.key} /> {m.label}
              </button>
            ))}
            {isAdmin && (<>
              <div className="h-px bg-white/[.08] mx-2 my-1.5" />
              <button onClick={() => { setOpen(false); router.push('/recruiting/admin') }}
                className="w-full text-left flex items-center gap-3 px-2.5 py-2.5 rounded-[9px] text-[#EDE7DD] text-sm font-medium hover:bg-[#26221D]">
                <Ring k="shield" /> User Access
              </button>
              <button onClick={() => { setOpen(false); router.push('/hub') }}
                className="w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-[9px] text-[#8C8375] text-xs hover:bg-[#26221D]">
                <Ring k="hub" /> Open full hub
              </button>
            </>)}
          </div>
        )}
      </div>

      {/* right */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* desktop: page actions inline */}
        <div className="hidden sm:flex items-center gap-3">{right}</div>
        <ThemeToggle />
        {/* desktop: divider + email + sign out */}
        <div className="w-px h-4 bg-white/15 hidden sm:block" />
        <span className="text-white/30 text-xs truncate max-w-[150px] hidden sm:block">{email}</span>
        <button onClick={signOut} className="text-white/40 text-xs hover:text-white transition-colors hidden sm:block">Sign out</button>

        {/* mobile: gear menu holds the page actions + language + sign out */}
        <div className="sm:hidden relative" ref={gearRef}>
          <button onClick={() => setGear(g => !g)} title="Menu"
            className={`w-9 h-9 grid place-items-center rounded-lg border text-[#DCB878] ${gear ? 'border-[#DCB878]/50 bg-[#241f19]' : 'border-white/15 bg-white/5'}`}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          {gear && (
            <div className="absolute right-0 top-[44px] w-[252px] bg-[#1E1B17] border border-[#DCB878]/40 rounded-2xl p-[7px] z-[60] shadow-[0_26px_54px_-18px_rgba(0,0,0,.8)]">
              <div className="text-[10px] font-bold tracking-[.18em] text-[#8C8375] uppercase px-2.5 pt-1.5 pb-1">Actions</div>
              {right}
              <div className="h-px bg-white/10 mx-2 my-1.5" />
              <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#e88b8b] text-sm font-medium hover:bg-white/5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
