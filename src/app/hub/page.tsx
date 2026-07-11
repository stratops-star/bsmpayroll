'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'
const BSM_DOMAIN = 'bsmfacilitysolutions.com'

type Mod = { key: string; name: string; desc: string; href: string; icon: string }

const MODULES: Record<string, Mod> = {
  payroll: { key: 'payroll', name: 'Payroll', desc: 'Employees, payments & reports', href: '/dashboard', icon: 'payroll' },
  recruiting: { key: 'recruiting', name: 'Recruiting', desc: 'Candidates, requests & pipeline', href: '/recruiting', icon: 'recruiting' },
  valet: { key: 'valet', name: 'Valet Parking', desc: 'Attendants, cars & reports', href: '/valet/manager', icon: 'valet' },
}

type Screen = 'loading' | 'no-session' | 'wrong-domain' | 'waiting' | 'ready'

export default function Hub() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('loading')
  const [cards, setCards] = useState<Mod[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [me, setMe] = useState<{ email: string; name: string } | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setScreen('no-session'); return }
      if (!user.email?.toLowerCase().endsWith('@' + BSM_DOMAIN)) {
        await supabase.auth.signOut(); setScreen('wrong-domain'); return
      }
      const { data: u } = await supabase
        .from('app_users').select('full_name, email, role, departments, active').eq('id', user.id).single()

      const depts: string[] = (u?.active && u.departments) || []
      const admin = u?.role === 'admin'
      setIsAdmin(admin)
      setMe({ email: u?.email || user.email!, name: u?.full_name || (u?.email || user.email!).split('@')[0] })

      const mods = depts.map(d => MODULES[d]).filter(Boolean)
      if (!admin && mods.length === 0) { setScreen('waiting'); return }
      if (!admin && mods.length === 1) { router.replace(mods[0].href); return }
      setCards(mods); setScreen('ready')
    })()
  }, [supabase, router])

  async function signOut() { await supabase.auth.signOut(); location.href = '/' }

  if (screen === 'loading') return <Center><p style={{ color: '#94A3B8' }}>Loading…</p></Center>
  if (screen === 'no-session') return <Center><Msg title="Sign in required">Please sign in with your BSM email.</Msg></Center>
  if (screen === 'wrong-domain') return <Center><Msg title="BSM accounts only">Only @{BSM_DOMAIN} accounts can access this app.</Msg></Center>
  if (screen === 'waiting') return (
    <Center>
      <Msg title="You're almost in">
        Your account is signed in and waiting for a department assignment. An administrator will grant you access shortly.
      </Msg>
      <button onClick={signOut} style={ghostBtn}>Sign out</button>
    </Center>
  )

  const allCards = [...cards]

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 600px at 50% -10%, #2A2621 0%, ${NAVY} 55%)`, fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px 60px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/bsm-mark.png" alt="BSM" style={{ height: 40, width: 'auto' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>BSM Facility Solutions</div>
              <div style={{ fontSize: 12, color: GOLD }}>Operations Platform</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{me?.name}</div>
              <div style={{ fontSize: 11, color: '#8C8375' }}>{me?.email}</div>
            </div>
            <button onClick={signOut} style={{ ...ghostBtn, padding: '7px 12px' }}>Sign out</button>
          </div>
        </div>

        {/* heading */}
        <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Choose a workspace</h1>
        <p style={{ color: '#A79C88', marginBottom: 34 }}>You have access to the modules below.</p>

        {/* cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {allCards.map(m => <Card key={m.key} icon={m.icon} name={m.name} desc={m.desc} href={m.href} />)}
          {isAdmin && !allCards.some(c => c.key === 'valet') && <Card icon="valet" name="Valet Parking" desc="Attendants, cars & reports" href="/valet/manager" />}
          {isAdmin && <Card icon="access" name="User Access" desc="Manage roles & departments" href="/recruiting/admin" accent />}
        </div>
      </div>
    </div>
  )
}

function Card({ icon, name, desc, href, accent }: { icon: string; name: string; desc: string; href: string; accent?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', textDecoration: 'none', background: '#211E1A', borderRadius: 18, padding: '20px 22px',
        border: `1.5px solid ${accent ? '#8A6D2F' : GOLD}`, minHeight: 116, position: 'relative', overflow: 'hidden',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? '0 18px 40px -16px rgba(0,0,0,.6)' : '0 6px 18px -10px rgba(0,0,0,.5)',
        transition: 'transform .18s, box-shadow .18s',
      }}
    >
      <div style={{ width: 66, height: 66, borderRadius: '50%', border: `1.5px solid ${GOLD}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <ModuleIcon k={icon} />
      </div>
      <div style={{ width: 1.5, alignSelf: 'stretch', background: GOLD, opacity: 0.35, margin: '4px 18px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 21 }}>{name}</div>
        <div style={{ width: 32, height: 2, background: GOLD, margin: '7px 0 9px' }} />
        <div style={{ color: '#A79C88', fontSize: 13.5 }}>{desc}</div>
        <div style={{ color: GOLD, fontWeight: 700, fontSize: 14, marginTop: 12 }}>Open →</div>
      </div>
      <Dots />
    </a>
  )
}

function Dots() {
  const rows = 4, cols = 6, gap = 7, r = 1.1
  const dots = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) dots.push(<circle key={`${x}-${y}`} cx={x * gap + r} cy={y * gap + r} r={r} fill={GOLD} />)
  return (
    <svg width={cols * gap} height={rows * gap} style={{ position: 'absolute', right: 16, bottom: 14, opacity: 0.5 }}>{dots}</svg>
  )
}

function ModuleIcon({ k }: { k: string }) {
  const p = { fill: 'none', stroke: GOLD, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (k === 'valet') return (
    <svg width="34" height="34" viewBox="0 0 24 24" {...p}>
      <path d="M4 15 l1.4-4.2 a2 2 0 0 1 1.9-1.3 h7.4 a2 2 0 0 1 1.9 1.3 L18 15" />
      <path d="M3.5 15 h17 v2.5 a1 1 0 0 1-1 1 H4.5 a1 1 0 0 1-1-1 z" />
      <circle cx="7" cy="18.5" r="1.3" /><circle cx="17" cy="18.5" r="1.3" />
    </svg>
  )
  if (k === 'payroll') return (
    <svg width="32" height="32" viewBox="0 0 24 24" {...p}>
      <path d="M7 3 h7 l4 4 v11 a1 1 0 0 1-1 1 H7 a1 1 0 0 1-1-1 V4 a1 1 0 0 1 1-1 z" />
      <path d="M14 3 v4 h4" />
      <path d="M11 10 v6 M9.6 11 h2.2 a1.2 1.2 0 0 1 0 2.4 h-2.2 M9.6 13.4 h2.6" />
    </svg>
  )
  if (k === 'access') return (
    <svg width="32" height="32" viewBox="0 0 24 24" {...p}>
      <path d="M12 3 l7 2.5 v5 c0 4.2-3 7.4-7 8.5 -4-1.1-7-4.3-7-8.5 v-5 z" />
      <path d="M9 12 l2 2 4-4.5" />
    </svg>
  )
  // recruiting (person)
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20 a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,.08)', color: '#D9D2C6', border: '1px solid rgba(255,255,255,.15)',
  borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: NAVY, fontFamily: 'system-ui', padding: 24 }}><div style={{ textAlign: 'center', maxWidth: 440 }}>{children}</div></div>
}
function Msg({ title, children }: { title: string; children: React.ReactNode }) {
  return <><h2 style={{ color: '#fff', marginBottom: 8 }}>{title}</h2><p style={{ color: '#A79C88', lineHeight: 1.5, marginBottom: 18 }}>{children}</p></>
}
