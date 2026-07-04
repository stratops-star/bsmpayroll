'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type AppUser = {
  id: string
  email: string
  full_name: string | null
  role: string
  departments: string[]
  active: boolean
}

const ROLES = ['admin', 'recruiter', 'manager', 'viewer']
const DEPTS = ['recruiting', 'payroll']

export default function AdminPage() {
  const [supabase] = useState(() => createClient())
  const [users, setUsers] = useState<AppUser[]>([])
  const [status, setStatus] = useState('Loading…')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('Please sign in.'); return }

      const { data: me } = await supabase
        .from('app_users').select('role').eq('id', user.id).single()
      if (!me || me.role !== 'admin') { setStatus('Admins only.'); return }
      setIsAdmin(true)

      const { data: all, error } = await supabase
        .from('app_users').select('*').order('email')
      if (error) { setStatus('Error: ' + error.message); return }
      setUsers(all ?? []); setStatus('')
    })()
  }, [supabase])

  function patch(id: string, p: Partial<AppUser>) {
    setUsers(us => us.map(u => (u.id === id ? { ...u, ...p } : u)))
  }
  function toggleDept(u: AppUser, d: string) {
    const has = u.departments?.includes(d)
    patch(u.id, {
      departments: has ? u.departments.filter(x => x !== d) : [...(u.departments || []), d],
    })
  }
  async function save(u: AppUser) {
    setStatus('Saving…')
    const { error } = await supabase
      .from('app_users')
      .update({ role: u.role, departments: u.departments, active: u.active })
      .eq('id', u.id)
    setStatus(error ? 'Error: ' + error.message : `Saved ${u.email}`)
  }

  if (!isAdmin) return <div style={{ padding: 24, fontFamily: 'system-ui' }}>{status}</div>

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0D1B35' }}>User Access</h1>
      <p style={{ color: '#6B7280' }}>
        People appear here after their first BSM sign-in. Assign a role and departments, then Save.
      </p>
      <p style={{ color: '#047857', minHeight: 20 }}>{status}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>
            <th style={{ padding: 8 }}>User</th>
            <th style={{ padding: 8 }}>Role</th>
            <th style={{ padding: 8 }}>Departments</th>
            <th style={{ padding: 8 }}>Active</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #F1F1F4' }}>
              <td style={{ padding: 8 }}>
                <div style={{ fontWeight: 600 }}>{u.full_name || '—'}</div>
                <div style={{ color: '#6B7280', fontSize: 12 }}>{u.email}</div>
              </td>
              <td style={{ padding: 8 }}>
                <select value={u.role} onChange={e => patch(u.id, { role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td style={{ padding: 8 }}>
                {DEPTS.map(d => (
                  <label key={d} style={{ marginRight: 12, whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={u.departments?.includes(d) || false}
                      onChange={() => toggleDept(u, d)}
                    /> {d}
                  </label>
                ))}
              </td>
              <td style={{ padding: 8 }}>
                <input
                  type="checkbox"
                  checked={u.active}
                  onChange={e => patch(u.id, { active: e.target.checked })}
                />
              </td>
              <td style={{ padding: 8 }}>
                <button
                  onClick={() => save(u)}
                  style={{ background: '#0D1B35', color: '#fff', border: 0, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
