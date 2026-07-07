'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const NAVY = '#0D1B35', GOLD = '#D4A843'
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1'

const DEPTS = [['janitorial', 'Janitorial'], ['concierge', 'Concierge'], ['security', 'Security'], ['maintenance', 'Maintenance'], ['superintendent', 'Superintendent'], ['parking_attendant', 'Parking Attendant']]
const POSITIONS = ['Porter Services T1', 'Super', 'Concierge', 'Security', 'T2 Garbage Porter', 'T2 Morning Porter', 'T2 Porter Services']
const SITES = ['Queens', 'Brooklyn', 'Bronx', 'Manhattan', 'Staten Island']
const TRANSPORT = [['train', 'Train'], ['car', 'Car'], ['bus', 'Bus'], ['any', 'Any']]

export default function ManpowerIntake() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<'loading' | 'denied' | 'pending' | 'ready' | 'done'>('loading')
  const [me, setMe] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState<any>({
    urgency: 'standard', department: '', position: '', building_type: 'mid', gender_pref: 'any',
    employment: 'part_time', reason: '', replacing_employee: '', building: '', work_hours: 'flexible',
    work_hours_other: '', work_days: '', schedule_uploaded: false, transportation: 'train',
    education: 'High School (GED)', state: 'New York', site: '', location: '', compensation: '',
    start_date: '', expectation_details: '', notes: '', count_needed: '1',
  })
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: u } = await supabase.from('app_users').select('*').eq('id', user.id).single()
      if (!u) { setState('denied'); return }
      const allowed = u.role === 'admin' || u.role === 'recruiter' || u.role === 'manager'
      if (!allowed || !u.approved) { setMe(u); setState('pending'); return }
      setMe(u); set('department', u.department || ''); setState('ready')
    })()
  }, [])

  const showReplacing = ['replace_employee', 'turnover', 'employee_quit'].includes(f.reason)
  const showBuilding = f.reason === 'new_building'

  async function submit() {
    setErr('')
    if (!f.department || !f.position || !f.reason || !f.start_date || !f.compensation) { setErr('Please fill department, position, reason, start date and compensation.'); return }
    setBusy(true)
    let schedule_path: string | null = null
    if (f.schedule_uploaded && f._file) {
      const path = `${Date.now()}-${f._file.name}`
      const up = await supabase.storage.from('request-schedules').upload(path, f._file, { upsert: false })
      if (!up.error) schedule_path = path
    }
    const { data: user } = await supabase.auth.getUser()
    const { data: inserted, error } = await supabase.from('man_power_requests').insert({
      created_by: user.user?.id,
      supervisor_name: [me?.full_name, me?.title].filter(Boolean).join(' — ') || me?.email,
      department: f.department, urgency: f.urgency, position: f.position, building_type: f.building_type,
      expectation_details: f.expectation_details || null, gender_pref: f.gender_pref, employment: f.employment,
      reason: f.reason, replacing_employee: showReplacing ? (f.replacing_employee || null) : null,
      building: showBuilding ? (f.building || null) : null,
      work_hours: f.work_hours === 'other' ? (f.work_hours_other || 'Other') : 'Flexible',
      work_days: f.schedule_uploaded ? 'Schedule uploaded' : (f.work_days || null), schedule_path,
      transportation: f.transportation, education: f.education, state: f.state, site: f.site || null,
      location: f.location || null, compensation: Number(f.compensation), start_date: f.start_date, notes: f.notes || null,
    }).select('id').single()
    if (error) { setBusy(false); setErr(error.message); return }
    await supabase.from('man_power_request_items').insert({ request_id: inserted.id, position_name: f.position, count_needed: Number(f.count_needed) || 1 })
    try { await fetch('/api/manpower-asana', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inserted.id }) }) } catch {}
    setBusy(false); setState('done')
  }

  if (state === 'loading') return <Shell><p className="text-gray-400">Loading…</p></Shell>
  if (state === 'denied') return <Shell><p className="text-gray-500">No access.</p></Shell>
  if (state === 'pending') return <Shell><div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl border-t-4" style={{ borderColor: GOLD }}><div className="text-4xl mb-3">⏳</div><h1 className="text-lg font-bold" style={{ color: NAVY }}>Access pending approval</h1><p className="text-sm text-gray-500 mt-2">You're signed in as {me?.email}. An administrator needs to approve your access before you can submit manpower requests. You'll be able to log in and submit once approved.</p></div></Shell>
  if (state === 'done') return <Shell><div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl border-t-4" style={{ borderColor: GOLD }}><div className="text-4xl mb-3">✅</div><h1 className="text-lg font-bold" style={{ color: NAVY }}>Request submitted</h1><p className="text-sm text-gray-500 mt-2">Your manpower request has been sent to recruiting. You can track it and review candidates from your board.</p><button onClick={() => { setState('ready'); setF((p: any) => ({ ...p, position: '', reason: '', expectation_details: '', notes: '' })) }} className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: GOLD, color: NAVY }}>Submit another</button></div></Shell>

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div style={{ background: NAVY }} className="text-white px-6 py-4 border-b-[3px]" >
        <div className="max-w-2xl mx-auto flex items-center gap-3" style={{ borderColor: GOLD }}>
          <span className="w-8 h-8 rounded-lg grid place-items-center font-bold text-sm" style={{ background: GOLD, color: NAVY }}>B</span>
          <div><div className="text-lg font-semibold">Manpower Request</div><div className="text-xs text-white/50">{me?.full_name || me?.email} · {me?.department || 'Manager'}</div></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        <Row><Fld label="Urgency"><select className={inp} value={f.urgency} onChange={e => set('urgency', e.target.value)}><option value="immediate">Immediate</option><option value="standard">Standard</option><option value="high">High priority</option></select></Fld>
          <Fld label="Department"><select className={inp} value={f.department} onChange={e => set('department', e.target.value)}><option value="">Select…</option>{DEPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Fld></Row>

        <Row><Fld label="Position"><select className={inp} value={f.position} onChange={e => set('position', e.target.value)}><option value="">Select…</option>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></Fld>
          <Fld label="How many needed"><input type="number" min="1" className={inp} value={f.count_needed} onChange={e => set('count_needed', e.target.value)} /></Fld></Row>

        <Row><Fld label="Building type"><select className={inp} value={f.building_type} onChange={e => set('building_type', e.target.value)}><option value="high">High-Expectation</option><option value="mid">Mid</option><option value="low">Low</option></select></Fld>
          <Fld label="Gender preference"><select className={inp} value={f.gender_pref} onChange={e => set('gender_pref', e.target.value)}><option value="any">No preference</option><option value="female">Female</option><option value="male">Male</option></select></Fld></Row>

        <Row><Fld label="Employment"><select className={inp} value={f.employment} onChange={e => set('employment', e.target.value)}><option value="part_time">Part-Time</option><option value="full_time">Full-Time</option></select></Fld>
          <Fld label="Reason for request"><select className={inp} value={f.reason} onChange={e => set('reason', e.target.value)}><option value="">Select…</option><option value="workload_increase">Workload Increase</option><option value="new_building">New Building</option><option value="turnover">Employee Turnover</option><option value="replace_employee">Replace Employee</option><option value="employee_quit">Employee Quit</option></select></Fld></Row>

        {showReplacing && <Fld label="Employee being replaced"><input className={inp} value={f.replacing_employee} onChange={e => set('replacing_employee', e.target.value)} /></Fld>}
        {showBuilding && <Fld label="New building name"><input className={inp} value={f.building} onChange={e => set('building', e.target.value)} /></Fld>}

        <Row><Fld label="Work hours"><select className={inp} value={f.work_hours} onChange={e => set('work_hours', e.target.value)}><option value="flexible">Flexible</option><option value="other">Other (specify)</option></select></Fld>
          <Fld label="Transportation"><select className={inp} value={f.transportation} onChange={e => set('transportation', e.target.value)}>{TRANSPORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Fld></Row>
        {f.work_hours === 'other' && <Fld label="Specify hours"><input className={inp} value={f.work_hours_other} onChange={e => set('work_hours_other', e.target.value)} /></Fld>}

        <Fld label="Work days">
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-2"><input type="checkbox" checked={f.schedule_uploaded} onChange={e => set('schedule_uploaded', e.target.checked)} /> Upload a schedule file instead</label>
          {f.schedule_uploaded ? <input type="file" className="text-sm" onChange={e => set('_file', e.target.files?.[0] || null)} /> : <input className={inp} placeholder="e.g. Mon–Fri, or specific days" value={f.work_days} onChange={e => set('work_days', e.target.value)} />}
        </Fld>

        <Row><Fld label="Education"><select className={inp} value={f.education} onChange={e => set('education', e.target.value)}><option>High School (GED)</option><option>None required</option><option>Other</option></select></Fld>
          <Fld label="State"><input className={inp} value={f.state} onChange={e => set('state', e.target.value)} /></Fld></Row>

        <Row><Fld label="Site / Borough"><select className={inp} value={f.site} onChange={e => set('site', e.target.value)}><option value="">Select…</option>{SITES.map(s => <option key={s} value={s}>{s}</option>)}</select></Fld>
          <Fld label="Location / Address"><input className={inp} value={f.location} onChange={e => set('location', e.target.value)} /></Fld></Row>

        <Row><Fld label="Compensation ($/hr)"><input type="number" step="0.01" className={inp} value={f.compensation} onChange={e => set('compensation', e.target.value)} /></Fld>
          <Fld label="Desired start date"><input type="date" className={inp} value={f.start_date} onChange={e => set('start_date', e.target.value)} /></Fld></Row>

        <Fld label="Expectation details"><textarea rows={4} className={inp} value={f.expectation_details} onChange={e => set('expectation_details', e.target.value)} placeholder="Describe the role, building, responsibilities…" /></Fld>
        <Fld label="Notes (optional)"><textarea rows={2} className={inp} value={f.notes} onChange={e => set('notes', e.target.value)} /></Fld>

        {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <button disabled={busy} onClick={submit} className="w-full font-semibold py-3 rounded-lg disabled:opacity-50" style={{ background: GOLD, color: NAVY }}>{busy ? 'Submitting…' : 'Submit request'}</button>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) { return <div className="min-h-screen grid place-items-center bg-[#F5F6FA] p-6" style={{ fontFamily: 'system-ui' }}>{children}</div> }
function Row({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div> }
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className={lbl}>{label}</label>{children}</div> }
