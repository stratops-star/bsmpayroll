'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'
const BSM_DOMAIN = 'bsmfacilitysolutions.com' // ← confirm / change

type Mod = { key: string; name: string; desc: string; href: string; icon: string }

const MODULES: Record<string, Mod> = {
  payroll: { key: 'payroll', name: 'Payroll', desc: 'Porter entries, rates & exports', href: '/dashboard', icon: '💰' },
  recruiting: { key: 'recruiting', name: 'Recruiting', desc: 'Candidates, requests & pipeline', href: '/recruiting', icon: '🧑\u200d💼' },
  valet: { key: 'valet', name: 'Valet Parking', desc: 'Attendants, cars & reports', href: '/valet/manager', icon: '🚗' },
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
    <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 600px at 50% -10%, #16264a 0%, ${NAVY} 55%)`, fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 24px 60px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${GOLD}, #B98A2E)`, display: 'grid', placeItems: 'center', color: NAVY, fontWeight: 800, fontSize: 18 }}>B</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>BSM Facility</div>
              <div style={{ fontSize: 12, color: GOLD }}>Operations Platform</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{me?.name}</div>
              <div style={{ fontSize: 11, color: '#8895AC' }}>{me?.email}</div>
            </div>
            <button onClick={signOut} style={{ ...ghostBtn, padding: '7px 12px' }}>Sign out</button>
          </div>
        </div>

        {/* heading */}
        <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Choose a workspace</h1>
        <p style={{ color: '#94A3B8', marginBottom: 34 }}>You have access to the modules below.</p>

        {/* cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
          {allCards.map(m => <Card key={m.key} icon={m.icon} name={m.name} desc={m.desc} href={m.href} />)}
          {isAdmin && !allCards.some(c => c.key === 'valet') && <Card icon="🚗" name="Valet Parking" desc="Attendants, cars & reports" href="/valet/manager" />}
          {isAdmin && <Card icon="🛡️" name="User Access" desc="Manage roles & departments" href="/recruiting/admin" accent />}
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
        display: 'block', textDecoration: 'none', background: '#fff', borderRadius: 16, padding: '22px 22px 20px',
        border: accent ? `1px solid ${GOLD}` : '1px solid transparent',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? '0 18px 40px -16px rgba(0,0,0,.55)' : '0 6px 18px -10px rgba(0,0,0,.4)',
        transition: 'transform .18s, box-shadow .18s',
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 14 }}>{icon}</div>
      <div style={{ color: NAVY, fontWeight: 700, fontSize: 17 }}>{name}</div>
      <div style={{ color: '#6B7280', fontSize: 13, marginTop: 3 }}>{desc}</div>
      <div style={{ color: accent ? '#8A6D1E' : GOLD, fontWeight: 600, fontSize: 13, marginTop: 16 }}>Open →</div>
    </a>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,.08)', color: '#C7D0E0', border: '1px solid rgba(255,255,255,.15)',
  borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: NAVY, fontFamily: 'system-ui', padding: 24 }}><div style={{ textAlign: 'center', maxWidth: 440 }}>{children}</div></div>
}
function Msg({ title, children }: { title: string; children: React.ReactNode }) {
  return <><h2 style={{ color: '#fff', marginBottom: 8 }}>{title}</h2><p style={{ color: '#94A3B8', lineHeight: 1.5, marginBottom: 18 }}>{children}</p></>
}
