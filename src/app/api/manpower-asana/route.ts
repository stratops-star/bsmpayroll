import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT = '1209199782023351' // MAN POWER REQUESTS
const ASANA = 'https://app.asana.com/api/1.0'

const DEPT_LABEL: Record<string, string> = {
  janitorial: 'JANITORIAL', concierge: 'CONCIERGE', security: 'SECURITY',
  maintenance: 'MAINTENANCE', superintendent: 'SUPERINTENDENT', parking_attendant: 'PARKING ATTENDANT',
}
const GENDER_LABEL: Record<string, string> = { female: 'Female', male: 'Male', any: 'Male or Female' }

async function asana(path: string, token: string, init?: RequestInit) {
  const r = await fetch(`${ASANA}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!r.ok) throw new Error(`Asana ${path} ${r.status} ${await r.text().catch(() => '')}`)
  return r.json()
}

async function sectionFor(dept: string, token: string): Promise<string | null> {
  const want = (DEPT_LABEL[dept || ''] || dept || 'GENERAL').toUpperCase()
  try {
    const { data } = await asana(`/projects/${PROJECT}/sections`, token)
    const hit = (data || []).find((s: any) => (s.name || '').trim().toUpperCase() === want)
    if (hit) return hit.gid
    const made = await asana(`/projects/${PROJECT}/sections`, token, { method: 'POST', body: JSON.stringify({ data: { name: want } }) })
    return made?.data?.gid ?? null
  } catch { return null }
}

function notes(r: any, marker: string): string {
  const L = (k: string, v: any) => `${k}:: ${v ?? '—'}`
  return [
    'SOURCE:: BSM Manpower Platform', marker, '(Already in the BSM system — do not import.)', '',
    L('Supervisor', r.supervisor_name), L('Department', r.department), L('Urgency', r.urgency),
    L('Position', r.position), L('Building type', r.building_type), L('Gender', GENDER_LABEL[r.gender_pref] || r.gender_pref),
    L('Employment', r.employment), L('Reason', r.reason), r.replacing_employee ? L('Replacing', r.replacing_employee) : '',
    L('Work hours', r.work_hours), L('Work days', r.work_days), L('Transportation', r.transportation),
    L('Education', r.education), L('State', r.state), L('Site', r.site), L('Location', r.location),
    L('Compensation', r.compensation != null ? `$${r.compensation}/hr` : '—'), L('Start date', r.start_date),
    '', L('Expectations', r.expectation_details), r.notes ? L('Notes', r.notes) : '',
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  const token = process.env.ASANARECRUITER
  if (!token) return NextResponse.json({ error: 'No Asana token' }, { status: 500 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServerClient()
  const { data: r, error } = await supabase.from('man_power_requests').select('*').eq('id', id).single()
  if (error || !r) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const name = `${r.seq} - ${r.supervisor_name || 'Manager'} - ${GENDER_LABEL[r.gender_pref] || 'Any'} - ${(r.transportation || '—')} - ${r.position || 'Position'}`
  const section = await sectionFor(r.department, token)

  try {
    const body: any = { data: { name, notes: notes(r, `BSM_ID:: ${r.id}`), projects: [PROJECT] } }
    if (section) body.data.memberships = [{ project: PROJECT, section }]
    const created = await asana('/tasks', token, { method: 'POST', body: JSON.stringify(body) })
    const gid = created?.data?.gid
    if (gid) {
      const url = `https://app.asana.com/0/${PROJECT}/${gid}`
      await supabase.from('man_power_requests').update({ asana_task_id: gid, asana_url: url }).eq('id', id)
      return NextResponse.json({ ok: true, gid, url })
    }
    return NextResponse.json({ ok: false })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 200 }) // non-fatal
  }
}
