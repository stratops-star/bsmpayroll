'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Theme tokens
const CHAR = 'var(--bg)', PANEL = 'var(--surface)', HOVER = 'var(--surface-2)', RAISE = 'var(--raise)'
const GOLD = 'var(--gold)', ON_GOLD = 'var(--on-gold)'
const INK = 'var(--text)', STRONG = 'var(--text-strong)', MUTE = 'var(--muted)', FAINT = 'var(--faint)'
const BORDER = 'var(--border)', BORDER_GOLD = 'color-mix(in srgb, var(--gold) 38%, transparent)'

type AppUser = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  departments: string[]
  active: boolean
}

// `valet` = attendant (walled-off lane). `valet_manager` = valet supervisor.
const ROLES = ['admin', 'payroll', 'recruiter', 'manager', 'pool', 'viewer', 'valet', 'valet_manager']
const DEPTS = ['recruiting', 'payroll', 'valet']

// The walled-off valet lane: these roles may ONLY ever hold the valet department.
const VALET_LANE = ['valet', 'valet_manager']
const isValetLane = (role: string) => VALET_LANE.includes(role)

// Suggested departments when a user has NONE yet. Never used to overwrite existing
// departments — changing a role must not silently grant or revoke access.
const ROLE_SUGGESTED_DEPTS: Record<string, string[]> = {
  admin: ['recruiting', 'payroll'],
  payroll: ['payroll'],
  recruiter: ['recruiting'],
  viewer: ['recruiting'],
  valet: ['valet'],
  valet_manager: ['valet'],
  manager: [],
  pool: [],
}

const ini = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

const Check = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

const Trash = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M4 7h16" /><path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
)

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
  const [meId, setMeId] = useState('')
  const [armed, setArmed] = useState<string | null>(null)   // row awaiting delete confirmation

  // Which group each user was in WHEN LOADED. Frozen for the life of the page so a card
  // never jumps between "Pending" and "Active" while you're editing or saving it.
  const groupRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bsm:area', { detail: 'User Access' }))
    return () => window.dispatchEvent(new CustomEvent('bsm:area', { detail: null }))
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('denied'); return }
      setMeId(user.id)
      const { data: me } = await supabase.from('app_users').select('role').eq('id', user.id).single()
      if (me?.role !== 'admin') { setStatus('denied'); return }
      const { data: all, error } = await supabase.from('app_users').select('*').order('email')
      if (error) { setMsg(error.message); return }
      const list = all ?? []
      const g: Record<string, boolean> = {}
      list.forEach((u: AppUser) => { g[u.id] = (u.departments?.length ?? 0) > 0 })
      groupRef.current = g
      setUsers(list); setStatus('ready')
    })()
  }, [supabase])

  function patch(id: string, p: Partial<AppUser>) { setUsers(us => us.map(u => (u.id === id ? { ...u, ...p } : u))) }

  function toggleDept(u: AppUser, d: string) {
    // Valet-lane users can never hold a non-valet department.
    if (isValetLane(u.role) && d !== 'valet') { flash('Valet accounts can only hold the valet department.'); return }
    const has = u.departments?.includes(d)
    patch(u.id, { departments: has ? u.departments.filter(x => x !== d) : [...(u.departments || []), d] })
  }

  function changeRole(u: AppUser, r: string) {
    const current = u.departments || []
    // Entering the valet lane strips everything but valet — that is the whole point of the lane.
    if (isValetLane(r)) { patch(u.id, { role: r, departments: ['valet'] }); return }
    // Leaving the valet lane clears valet-only access so it must be re-granted deliberately.
    const wasLane = isValetLane(u.role)
    if (wasLane) { patch(u.id, { role: r, departments: ROLE_SUGGESTED_DEPTS[r] ?? [] }); return }
    // Otherwise: only suggest departments when the user has none. Never overwrite.
    const next = current.length ? current : (ROLE_SUGGESTED_DEPTS[r] ?? [])
    patch(u.id, { role: r, departments: next })
  }

  async function save(u: AppUser) {
    // Final server-side-shaped guard: a valet-lane account is forced to valet only.
    const departments = isValetLane(u.role) ? ['valet'] : (u.departments || [])
    const { error } = await supabase.from('app_users')
      .update({ role: u.role, departments, active: u.active, full_name: u.full_name || null, phone: u.phone || null, approved: true })
      .eq('id', u.id)
    if (!error && departments !== u.departments) patch(u.id, { departments })
    flash(error ? 'Error: ' + error.message : `Saved ${u.full_name || u.email.split('@')[0]}`)
  }

  async function remove(u: AppUser) {
    if (u.id === meId) { flash('You cannot remove your own account.'); setArmed(null); return }
    const { error } = await supabase.from('app_users').delete().eq('id', u.id)
    if (error) {
      // Most common cause: this user is referenced by offers / requests they created.
      const fk = /foreign key|violates/i.test(error.message)
      flash(fk
        ? 'Cannot remove — this user is linked to existing records. Untick "active" instead.'
        : 'Error: ' + error.message)
      setArmed(null)
      return
    }
    delete groupRef.current[u.id]
    setUsers(us => us.filter(x => x.id !== u.id))
    setArmed(null)
    flash(`Removed ${u.full_name || u.email.split('@')[0]}`)
  }

  let tmr: any
  function flash(m: string) { setToast(m); clearTimeout(tmr); tmr = setTimeout(() => setToast(''), 2600) }

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return users.filter(u => u.email.toLowerCase().includes(s) || (u.full_name || '').toLowerCase().includes(s))
  }, [users, q])

  // Grouping uses the frozen snapshot, not live edits — cards stay put.
  const pending = filtered.filter(u => groupRef.current[u.id] === false)
  const assigned = filtered.filter(u => groupRef.current[u.id] !== false)

  if (status === 'loading') return <Shell>Loading…</Shell>
  if (status === 'denied') return <Shell>Admins only.{msg && ' ' + msg}</Shell>

  return (
    <div className="bsm-app" style={{ minHeight: '100vh', color: INK, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '34px 20px 80px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.22em', color: GOLD, textTransform: 'uppercase' }}>User Access</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: STRONG, margin: '10px 0 0', letterSpacing: '-.01em' }}>Manage roles &amp; departments</h1>
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
          {pending.map(u => <Row key={u.id} u={u} patch={patch} toggleDept={toggleDept} changeRole={changeRole} save={save} remove={remove} armed={armed === u.id} setArmed={setArmed} isSelf={u.id === meId} pending />)}
        </>)}

        <SectionLabel>Active users · <b style={{ color: GOLD }}>{assigned.length}</b></SectionLabel>
        {assigned.map(u => <Row key={u.id} u={u} patch={patch} toggleDept={toggleDept} changeRole={changeRole} save={save} remove={remove} armed={armed === u.id} setArmed={setArmed} isSelf={u.id === meId} />)}
        {filtered.length === 0 && <p style={{ color: MUTE }}>No users match “{q}”.</p>}

        <div style={{ marginTop: 34, padding: '16px 18px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 12, color: MUTE, lineHeight: 1.7 }}>
          <b style={{ color: GOLD }}>Departments</b> unlock full modules (recruiting, payroll, valet). <b style={{ color: GOLD }}>Scoped roles</b> — pool and manager — get their own screen. <b style={{ color: GOLD }}>Valet accounts</b> (valet, valet_manager) are limited to the valet module and cannot be granted recruiting or payroll. Saving a user grants access immediately.
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: PANEL, border: `1px solid ${BORDER_GOLD}`, color: INK, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 18px 40px -10px rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: GOLD, display: 'inline-flex' }}><Check size={13} /></span> {toast}
        </div>
      )}
    </div>
  )
}

function Row({ u, patch, toggleDept, changeRole, save, remove, armed, setArmed, isSelf, pending }: {
  u: AppUser
  patch: (id: string, p: Partial<AppUser>) => void
  toggleDept: (u: AppUser, d: string) => void
  changeRole: (u: AppUser, r: string) => void
  save: (u: AppUser) => void
  remove: (u: AppUser) => void
  armed: boolean
  setArmed: (id: string | null) => void
  isSelf: boolean
  pending?: boolean
}) {
  const name = u.full_name || u.email.split('@')[0]
  const lane = isValetLane(u.role)
  return (
    <div style={{
      background: PANEL,
      border: `1px solid ${pending ? BORDER_GOLD : BORDER}`, borderRadius: 16, padding: '18px 20px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 240px', minWidth: 240 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `1.5px solid ${GOLD}`, background: RAISE, color: GOLD, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{ini(name)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input value={u.full_name || ''} onChange={e => patch(u.id, { full_name: e.target.value })} placeholder="Full name"
            style={{ ...field, fontWeight: 600, color: STRONG }} />
          <div style={{ color: MUTE, fontSize: 12.5, margin: '5px 2px 0' }}>{u.email}</div>
          <input value={u.phone || ''} onChange={e => patch(u.id, { phone: e.target.value })} placeholder="Cellphone (for interview texts)"
            style={{ ...field, fontSize: 12.5, marginTop: 7 }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select value={u.role} onChange={e => changeRole(u, e.target.value)}
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
          const locked = lane && d !== 'valet'
          return (
            <button key={d} onClick={() => toggleDept(u, d)} disabled={locked}
              title={locked ? 'Valet accounts are limited to the valet module' : undefined}
              style={{
                border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD : 'transparent',
                color: on ? ON_GOLD : (locked ? FAINT : MUTE),
                borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 600,
                cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: '.15s',
                opacity: locked ? 0.4 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
              {on && <Check />}{d}
            </button>
          )
        })}

        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: MUTE, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={u.active} onChange={e => patch(u.id, { active: e.target.checked })} style={{ accentColor: GOLD, width: 16, height: 16 }} /> active
        </label>

        <button onClick={() => save(u)}
          style={{ background: GOLD, color: ON_GOLD, border: 0, borderRadius: 9, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Save
        </button>

        {!isSelf && (
          <button onClick={() => setArmed(armed ? null : u.id)}
            title="Remove user"
            style={{
              background: 'transparent', border: `1px solid ${BORDER}`, color: armed ? 'var(--danger)' : FAINT,
              borderRadius: 9, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center',
            }}>
            <Trash />
          </button>
        )}
      </div>

      {armed && (
        <div style={{
          flexBasis: '100%', marginTop: 4, padding: '11px 14px', borderRadius: 10,
          background: 'var(--danger-bg)', border: '1px solid var(--danger)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--danger)', flex: '1 1 240px', lineHeight: 1.5 }}>
            Remove <b>{u.full_name || u.email}</b> from the app? This deletes their access record.
            It does not delete their sign-in account — to block access instead, untick “active”.
          </span>
          <button onClick={() => setArmed(null)}
            style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTE, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={() => remove(u)}
            style={{ background: 'var(--danger)', border: 0, color: '#fff', borderRadius: 8, padding: '7px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Remove
          </button>
        </div>
      )}

      {lane && (
        <div style={{ flexBasis: '100%', fontSize: 11.5, color: FAINT, marginTop: -4 }}>
          Valet lane — this account can only reach the valet module.
          {u.role === 'valet' ? ' Attendant access (no manager screens).' : ' Manager access to the valet module.'}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.2em', color: MUTE, fontWeight: 800, margin: '26px 2px 12px' }}>{children}</div>
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="bsm-app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: MUTE, fontFamily: 'system-ui' }}>{children}</div>
}
