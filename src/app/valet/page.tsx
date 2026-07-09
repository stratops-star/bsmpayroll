'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ValetGate from '@/components/valet/ValetGate'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

function ValetHome() {
  const [supabase] = useState(() => createClient())
  const [name, setName] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: me } = await supabase
        .from('app_users').select('full_name, email').eq('id', user.id).single()
      setName(me?.full_name || me?.email || user.email || '')
    })()
  }, [supabase])

  async function signOut() {
    await supabase.auth.signOut()
    location.href = '/valet/login'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6FA', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: NAVY, color: '#fff', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: GOLD, display: 'grid', placeItems: 'center', color: NAVY, fontWeight: 800 }}>B</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>BSM Valet</div>
            <div style={{ fontSize: 11, color: '#9FB0CC' }}>{name}</div>
          </div>
        </div>
        <button onClick={signOut} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Sign out
        </button>
      </header>

      <main style={{ maxWidth: 520, margin: '0 auto', padding: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🚗</div>
          <h2 style={{ color: NAVY, margin: '0 0 6px', fontSize: 18 }}>You’re signed in</h2>
          <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Login is working. The park / retrieve capture flow — customer &amp; plate select,
            the guided 5-photo shots, and the offline queue — lands in the next step.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function ValetPage() {
  return <ValetGate><ValetHome /></ValetGate>
}
