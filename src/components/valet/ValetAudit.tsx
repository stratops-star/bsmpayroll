'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#1E1B17'

type Row = {
  id: string; action: string; event_at: string; note: string | null; voided?: boolean; employee_id: string | null
  valet_customers: { full_name: string; valet_units: { unit_number: string } | null } | null
  valet_vehicles: { license_plate: string } | null
}

export default function ValetAudit() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Row[]>([])
  const [emp, setEmp] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const sel = 'id, action, event_at, note, voided, employee_id, valet_customers(full_name, valet_units(unit_number)), valet_vehicles(license_plate)'
      const { data: fc } = await supabase.from('valet_events').select(sel).ilike('note', '%Force-closed%').order('event_at', { ascending: false }).limit(200)
      const { data: vd } = await supabase.from('valet_events').select(sel).eq('voided', true).order('event_at', { ascending: false }).limit(200)
      const all = [...(fc || []), ...(vd || [])].sort((a: any, b: any) => +new Date(b.event_at) - +new Date(a.event_at))
      setRows(all as Row[])
      const ids = Array.from(new Set(all.map((r: any) => r.employee_id).filter(Boolean))) as string[]
      if (ids.length) {
        const { data: us } = await supabase.from('app_users').select('id, full_name').in('id', ids)
        const m: Record<string, string> = {}
        ;(us || []).forEach((u: any) => { m[u.id] = u.full_name || '' })
        setEmp(m)
      }
      setLoading(false)
    })()
  }, [supabase])

  function fmt(iso: string) { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

  if (loading) return <p style={{ color: '#94A3B8', padding: 16 }}>Loading…</p>
  if (rows.length === 0) return <p style={{ color: '#94A3B8', padding: 16 }}>No manual fixes yet. Force-closes and voided captures will appear here.</p>

  return (
    <div style={{ padding: '4px 2px' }}>
      <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 12px' }}>Every manual fix — force-closes and voids — with who did it and when.</p>
      {rows.map(r => {
        const isVoid = r.voided
        const by = /attendant/i.test(r.note || '') ? 'an attendant' : 'a manager'
        return (
          <div key={r.id + (isVoid ? '-v' : '-f')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '11px 8px', borderBottom: '1px solid #F1F3F8' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: isVoid ? '#B91C1C' : '#B7791F', background: isVoid ? '#FEE2E2' : '#FEF3C7', padding: '2px 7px', borderRadius: 6 }}>
                {isVoid ? 'VOID' : 'FORCE-CLOSE'}
              </span>
              <div style={{ marginTop: 4 }}>
                <b style={{ color: NAVY }}>{r.valet_vehicles?.license_plate || '—'}</b> · {r.valet_customers?.full_name || '—'}
                {r.valet_customers?.valet_units?.unit_number ? ` · Apt ${r.valet_customers.valet_units.unit_number}` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>by {emp[r.employee_id || ''] || by}</div>
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(r.event_at)}</div>
          </div>
        )
      })}
    </div>
  )
}
