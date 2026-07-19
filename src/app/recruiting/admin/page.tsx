'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Hub dark palette
const CHAR = '#1E1B17', PANEL = '#211E1A', HOVER = '#26221D', RAISE = '#2A241D'
const GOLD = '#DCB878'
const INK = '#EDE7DD', MUTE = '#8C8375', FAINT = '#6E665C'
const BORDER = '#3A342B', BORDER_GOLD = 'rgba(220,184,120,.28)'

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
const DEPTS = ['recruiting', 'payroll', 'valet']
const ROLE_DEPTS: Record<string, string[]> = {
  admin: ['recruiting', 'payroll'],
  payroll: ['payroll'],
  recruiter: ['recruiting'],
  viewer: ['recruiting'],
  manager: [],
  pool: [],
}
const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

const field: React.CSSProperties = {
  background: HOVER, border: `1px solid ${BORDER}`, borderRadius: 9,
  padding: '9px 12px', color: INK, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', width: '100%',
}

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
  let tmr: any
  function flash(m: string) { setToast(m); clearTimeout(tmr); tmr = setTimeout(() => setToast(''), 2200) }

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return users.filter(u => u.email.toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s))
  }, [users, q])
  const pending = filtered.filter(u => !u.departments?.length)
  const assigned = filtered.filter(u => u.departments?.length)

  if (status === 'loading') return <Shell>Loading…</Shell>
  if (status === 'denied') return <Shell>Admins only.{msg && ' ' + msg}</Shell>

  return (
    <div style={{ minHeight: '100vh', background: CHAR, color: INK, fontFamily: 'system-ui, sans-serif',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(220,184,120,.05) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '34px 20px 80px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.22em', color: GOLD, textTransform: 'uppercase' }}>User Access</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#fff', margin: '10px 0 0', letterSpacing: '-.01em' }}>Manage roles &amp; departments</h1>
        <div style={{ width: 38, height: 2, background: GOLD, margin: '14px 0 8px' }} />
        <p style={{ color: MUTE, fontSize: 14, margin: 0 }}>Assign roles, departments, and contact details. Saving grants access immediately.</p>

        <div style={{ position: 'relative', maxWidth: 420, margin: '26px 0 30px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTE} strokeWidth="1.8" strokeLinecap="round"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email…"
            style={{ width: '100%', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 14px 13px 42px', color: INK, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>

        {pending.length > 0 && (<>
          <SectionLabel>Pending assignment · <b style={{ color: GOLD }}>{pending.length}</b></SectionLabel>
          {pending.map(u => <Row key={u.id} u={u} patch={patch} toggleDept={toggleDept} save={save} pending />)}
        </>)}

        <SectionLabel>Active users · <b style={{ color: GOLD }}>{assigned.length}</b></SectionLabel>
        {assigned.map(u => <Row key={u.id} u={u} patch={patch} toggleDept={toggleDept} save={save} />)}
        {filtered.length === 0 && <p style={{ color: MUTE }}>No users match “{q}”.</p>}

        <div style={{ marginTop: 34, padding: '16px 18px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 12, color: MUTE, lineHeight: 1.7 }}>
          <b style={{ color: GOLD }}>Departments</b> unlock full modules (recruiting, payroll, valet). <b style={{ color: GOLD }}>Scoped roles</b> — pool and manager — get their own screen and need no department. Saving a user grants access immediately.
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: PANEL, border: `1px solid ${BORDER_GOLD}`, color: INK, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 18px 40px -10px rgba(0,0,0,.6)' }}>
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
    <div style={{
      background: pending ? `linear-gradient(0deg,rgba(220,184,120,.03),rgba(220,184,120,.03)),${PANEL}` : PANEL,
      border: `1px solid ${pending ? BORDER_GOLD : BORDER}`, borderRadius: 16, padding: '18px 20px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 240px', minWidth: 240 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `1.5px solid ${GOLD}`, background: RAISE, color: GOLD, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{ini(name)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input value={u.full_name || ''} onChange={e => patch(u.id, { full_name: e.target.value })} placeholder="Full name"
            style={{ ...field, fontWeight: 600, color: '#fff' }} />
          <div style={{ color: MUTE, fontSize: 12.5, margin: '5px 2px 0' }}>{u.email}</div>
          <input value={u.phone || ''} onChange={e => patch(u.id, { phone: e.target.value })} placeholder="Cellphone (for interview texts)"
            style={{ ...field, fontSize: 12.5, marginTop: 7 }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select value={u.role} onChange={e => { const r = e.target.value; patch(u.id, { role: r, departments: ROLE_DEPTS[r] ?? u.departments }) }}
          style={{
            background: HOVER, border: `1px solid ${BORDER}`, borderRadius: 9, color: INK, fontSize: 13,
            padding: '9px 30px 9px 12px', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none',
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238C8375' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center',
          }}>
          {ROLES.map(r => <option key={r} value={r} style={{ background: PANEL }}>{r}</option>)}
        </select>

        {DEPTS.map(d => {
          const on = u.departments?.includes(d)
          return (
            <button key={d} onClick={() => toggleDept(u, d)}
              style={{
                border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD : 'transparent', color: on ? CHAR : MUTE,
                borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: '.15s',
              }}>
              {on ? '✓ ' : ''}{d}
            </button>
          )
        })}

        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: MUTE, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={u.active} onChange={e => patch(u.id, { active: e.target.checked })} style={{ accentColor: GOLD, width: 16, height: 16 }} /> active
        </label>

        <button onClick={() => save(u)}
          style={{ background: GOLD, color: CHAR, border: 0, borderRadius: 9, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Save
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.2em', color: MUTE, fontWeight: 800, margin: '26px 2px 12px' }}>{children}</div>
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: CHAR, color: MUTE, fontFamily: 'system-ui' }}>{children}</div>
}
