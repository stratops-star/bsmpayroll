'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

type AppUser = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  departments: string[]
  active: boolean
}

const ROLES = ['admin', 'payroll', 'recruiter', 'manager', 'pool', 'viewer']
const DEPTS = ['recruiting', 'payroll']
const ROLE_DEPTS: Record<string, string[]> = {
  admin: ['recruiting', 'payroll'],
  payroll: ['payroll'],
  recruiter: ['recruiting'],
  viewer: ['recruiting'],
  manager: [],
  pool: [],
}
const AV = ['#2C4066', '#7C3AED', '#0891B2', '#DB2777', '#059669', '#D97706', '#4F46E5', '#BE123C']
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const hue = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length]
const fieldStyle: React.CSSProperties = { padding: '6px 9px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }

export default function AdminPage() {
  const [supabase] = useState(() => createClient())
  const [users, setUsers] = useState<AppUser[]>([])
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading')
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('denied'); return }
      const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single()
      if (me?.role !== 'admin') { setStatus('denied'); return }
      const { data: all, error } = await supabase.from('app_users').select('*').order('email')
      if (error) { setMsg(error.message); return }
      setUsers(all ?? []); setStatus('ready')
    })()
  }, [supabase])

  function patch(id: string, p: Partial<AppUser>) { setUsers(us => us.map(u => (u.id === id ? { ...u, ...p } : u))) }
  function toggleDept(u: AppUser, d: string) {
    const has = u.departments?.includes(d)
    patch(u.id, { departments: has ? u.departments.filter(x => x !== d) : [...(u.departments || []), d] })
  }
  async function save(u: AppUser) {
    const { error } = await supabase.from('app_users')
      .update({ role: u.role, departments: u.departments, active: u.active, full_name: u.full_name || null, phone: u.phone || null, approved: true }).eq('id', u.id)
    flash(error ? 'Error: ' + error.message : `Saved ${u.full_name || u.email.split('@')[0]}`)
  }
  let t: any
  function flash(m: string) { setToast(m); clearTimeout(t); t = setTimeout(() => setToast(''), 2200) }

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return users.filter(u => u.email.toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s))
  }, [users, q])
  const pending = filtered.filter(u => !u.departments?.length)
  const assigned = filtered.filter(u => u.departments?.length)

  if (status === 'loading') return <Shell><p style={{ color: '#94A3B8' }}>Loading…</p></Shell>
  if (status === 'denied') return <Shell><p style={{ color: '#94A3B8' }}>Admins only.{msg && ' ' + msg}</p></Shell>

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6FA', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '22px 24px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>User Access</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>Assign roles, departments, and contact details</div>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '22px 24px 60px' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email…"
          style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 22 }} />

        {pending.length > 0 && (<>
          <SectionLabel>Pending assignment · {pending.length}</SectionLabel>
          {pending.map(u => <Row key={u.id} u={u} patch={patch} toggleDept={toggleDept} save={save} pending />)}
        </>)}

        <SectionLabel>Active users · {assigned.length}</SectionLabel>
        {assigned.map(u => <Row key={u.id} u={u} patch={patch} toggleDept={toggleDept} save={save} />)}
        {filtered.length === 0 && <p style={{ color: '#6B7280' }}>No users match “{q}”.</p>}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: NAVY, color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 12px 30px -8px rgba(0,0,0,.4)' }}>
          <span style={{ color: GOLD }}>✓</span> {toast}
        </div>
      )}
    </div>
  )
}

function Row({ u, patch, toggleDept, save, pending }: {
  u: AppUser
  patch: (id: string, p: Partial<AppUser>) => void
  toggleDept: (u: AppUser, d: string) => void
  save: (u: AppUser) => void
  pending?: boolean
}) {
  const name = u.full_name || u.email.split('@')[0]
  return (
    <div style={{ background: '#fff', border: `1px solid ${pending ? '#FDE68A' : '#EEF0F4'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: hue(u.email), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{ini(name)}</div>

      <div style={{ minWidth: 220, flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <input value={u.full_name || ''} onChange={e => patch(u.id, { full_name: e.target.value })} placeholder="Full name"
          style={{ ...fieldStyle, fontWeight: 600, color: NAVY }} />
        <div style={{ color: '#6B7280', fontSize: 12 }}>{u.email}</div>
        <input value={u.phone || ''} onChange={e => patch(u.id, { phone: e.target.value })} placeholder="Cellphone (for interview texts)"
          style={fieldStyle} />
      </div>

      <select value={u.role} onChange={e => { const r = e.target.value; patch(u.id, { role: r, departments: ROLE_DEPTS[r] ?? u.departments }) }}
        style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <div style={{ display: 'flex', gap: 6 }}>
        {DEPTS.map(d => {
          const on = u.departments?.includes(d)
          return (
            <button key={d} onClick={() => toggleDept(u, d)}
              style={{ padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: on ? `1px solid ${NAVY}` : '1px solid #E5E7EB', background: on ? NAVY : '#fff', color: on ? '#fff' : '#9CA3AF' }}>
              {on ? '✓ ' : ''}{d}
            </button>
          )
        })}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B7280', cursor: 'pointer' }}>
        <input type="checkbox" checked={u.active} onChange={e => patch(u.id, { active: e.target.checked })} /> active
      </label>

      <button onClick={() => save(u)}
        style={{ marginLeft: 'auto', background: GOLD, color: NAVY, border: 0, borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Save
      </button>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.7px', color: '#9CA3AF', fontWeight: 700, margin: '18px 2px 10px' }}>{children}</div>
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F6FA', fontFamily: 'system-ui' }}>{children}</div>
}
