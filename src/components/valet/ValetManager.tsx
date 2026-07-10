'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ValetTenants from '@/components/valet/ValetTenants'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

type Attendant = { id: string; full_name: string; email: string; phone: string | null; active: boolean }

export default function ValetManager() {
  const [supabase] = useState(() => createClient())
  const [meName, setMeName] = useState('')
  const [tab, setTab] = useState<'attendants' | 'tenants'>('attendants')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('app_users').select('full_name, email').eq('id', user.id).single()
      setMeName(u?.full_name || u?.email || '')
    })()
  }, [supabase])

  return (
    <div style={{ minHeight: '100vh', background: '#F1F3F8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: NAVY, color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: GOLD, display: 'grid', placeItems: 'center', color: NAVY, fontWeight: 800 }}>B</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>BSM Valet — Manager</div>
            <div style={{ fontSize: 11, color: '#9FB0CC' }}>{meName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/valet" style={{ ...miniBtn, textDecoration: 'none', display: 'inline-block' }}>Capture app</a>
          <button onClick={async () => { await supabase.auth.signOut(); location.href = '/valet/login' }} style={miniBtn}>Sign out</button>
        </div>
      </header>

      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 4, padding: '0 12px' }}>
        <Tab active={tab === 'attendants'} onClick={() => setTab('attendants')}>Attendants</Tab>
        <Tab active={tab === 'tenants'} onClick={() => setTab('tenants')}>Tenants</Tab>
      </div>

      <main style={{ maxWidth: 620, margin: '0 auto', padding: 16 }}>
        {tab === 'attendants' ? <Attendants supabase={supabase} /> : <ValetTenants />}
      </main>
    </div>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 12px', fontSize: 14, fontWeight: 700,
      color: active ? NAVY : '#94A3B8', borderBottom: active ? `2.5px solid ${GOLD}` : '2.5px solid transparent',
    }}>{children}</button>
  )
}

// ---------------- Attendants ----------------
function Attendants({ supabase }: { supabase: any }) {
  const [rows, setRows] = useState<Attendant[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ full_name: '', email: '', phone: '' })

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('app_users').select('id, full_name, email, phone, active').eq('role', 'valet').order('full_name')
    setRows((data as Attendant[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function call(body: any) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/valet-onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(body),
    })
    return res.json().catch(() => ({ error: 'Request failed' }))
  }

  async function addAttendant() {
    if (!f.full_name.trim() || !f.email.trim()) { flash('Name and email are required.'); return }
    setBusy(true)
    const r = await call({ action: 'create', full_name: f.full_name.trim(), email: f.email.trim(), phone: f.phone.trim() })
    setBusy(false)
    if (r.error) { flash(r.error); return }
    const ch = [r.email ? 'email' : '', r.sms ? 'text' : ''].filter(Boolean).join(' + ')
    flash(ch ? `Added — login sent by ${ch} ✓` : 'Added ✓ (set Twilio/Resend to send the login)')
    setF({ full_name: '', email: '', phone: '' }); setAdding(false); load()
  }
  async function toggle(a: Attendant) {
    const r = await call({ action: 'set_active', id: a.id, active: !a.active })
    if (r.error) { flash(r.error); return }
    flash(a.active ? 'Deactivated' : 'Reactivated'); load()
  }
  async function resend(a: Attendant) {
    const r = await call({ action: 'resend', id: a.id })
    if (r.error) { flash(r.error); return }
    const ch = [r.email ? 'email' : '', r.sms ? 'text' : ''].filter(Boolean).join(' + ')
    flash(ch ? `New login sent by ${ch} ✓` : 'Sent (check Twilio/Resend config)')
  }

  return (
    <div>
      {toast && <div style={toastStyle}>{toast}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 4px 12px' }}>
        <h2 style={{ color: NAVY, fontSize: 18, margin: 0 }}>Attendants ({rows.length})</h2>
        {!adding && <button onClick={() => setAdding(true)} style={{ ...primaryBtn, width: 'auto', padding: '9px 14px' }}>+ Add attendant</button>}
      </div>

      {adding && (
        <div style={{ ...card, padding: 16, marginBottom: 16 }}>
          <Field label="Full name" value={f.full_name} onChange={(v: string) => setF(s => ({ ...s, full_name: v }))} />
          <Field label="Email (their login)" value={f.email} onChange={(v: string) => setF(s => ({ ...s, email: v }))} type="email" />
          <Field label="Mobile phone (for the text)" value={f.phone} onChange={(v: string) => setF(s => ({ ...s, phone: v }))} type="tel" />
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 12px' }}>A login + temporary password is created and sent to them by email{f.phone ? ' + text' : ''}.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addAttendant} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating…' : 'Create & send login'}</button>
            <button onClick={() => setAdding(false)} style={{ ...primaryBtn, background: '#fff', color: '#64748B', border: '1.5px solid #CBD5E1' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={card}>
        {loading ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>No attendants yet. Add your first one above.</Empty> :
          rows.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F3F8', padding: '12px 8px', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.full_name}
                  {!a.active && <span style={{ fontSize: 11, color: '#B91C1C', background: '#FEF2F2', padding: '1px 6px', borderRadius: 6 }}>inactive</span>}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}{a.phone ? ' · ' + a.phone : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => resend(a)} style={tinyBtn}>Resend</button>
                <button onClick={() => toggle(a)} style={{ ...tinyBtn, color: a.active ? '#B91C1C' : '#166534' }}>{a.active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} />
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px 12px', color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>{children}</div>
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 8 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 10, padding: '11px 12px', fontSize: 16, outline: 'none' }
const primaryBtn: React.CSSProperties = { width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const miniBtn: React.CSSProperties = { background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const tinyBtn: React.CSSProperties = { background: '#E4E9F2', color: NAVY, border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const toastStyle: React.CSSProperties = { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 14, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.3)', maxWidth: '92%', textAlign: 'center' }
