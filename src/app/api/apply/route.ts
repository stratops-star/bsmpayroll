import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM = 'BSM Careers <careers@bsmfacilitysolutions.com>' // ← verified Resend sender (email optional)

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    if ((fd.get('company') as string)?.trim()) return NextResponse.json({ ok: true })

    const get = (k: string) => ((fd.get(k) as string) || '').trim()
    const full_name = get('full_name')
    const phone = get('phone')
    const email = get('email')
    const preferred_lang = get('preferred_lang') === 'es' ? 'es' : 'en'

    const positions = fd.getAll('positions').map(v => String(v)).filter(Boolean)
    if (!full_name || !phone || !email || positions.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sub_type = get('sub_type')
    const work_areas = fd.getAll('work_areas').map(v => String(v)).filter(Boolean)
    const transportation = fd.getAll('transportation').map(v => String(v)).filter(Boolean)

    let role_experience: Record<string, string> = {}
    try { role_experience = JSON.parse(get('role_experience') || '{}') } catch {}

    const licRaw = get('security_licensed')
    const security_licensed = licRaw === 'true' ? true : licRaw === 'false' ? false : null

    const payMin = get('pay_min') ? Number(get('pay_min')) : null
    const payMax = get('pay_max') ? Number(get('pay_max')) : null
    const expected_pay = payMin != null && payMax != null ? `$${payMin}–${payMax}/hr` : null

    // Primary position for the pool = first chosen (position_id kept for existing filters)
    const supabase = createServerClient()
    const { data: pos } = await supabase
      .from('positions').select('id').eq('name', positions[0]).maybeSingle()

    async function upload(bucket: string, file: File | null): Promise<string | null> {
      if (!file || typeof file !== 'object' || file.size === 0) return null
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `${crypto.randomUUID()}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      const { error } = await supabase.storage.from(bucket).upload(path, buf, { contentType: file.type || 'application/octet-stream' })
      return error ? null : path
    }

    const resume_path = await upload('candidate-resumes', fd.get('resume') as File | null)
    const license_path = await upload('candidate-licenses', fd.get('license') as File | null)

    const { data: inserted, error } = await supabase.from('candidates').insert({
      intake_channel: 'public_form',
      status: 'applied',
      stage: 'applied',
      in_pool: false,
      position_id: pos?.id ?? null,
      positions,
      sub_type: sub_type || null,
      role_experience: Object.keys(role_experience).length ? role_experience : null,
      security_licensed,
      full_name, phone, email, preferred_lang,
      state: get('state') || null,
      city: get('city') || null,
      borough: get('borough') || null,
      work_areas: work_areas.length ? work_areas : null,
      pay_min: payMin, pay_max: payMax, expected_pay,
      transportation: transportation.length ? transportation.join(', ') : null,
      availability: get('availability') || null,
      english_level: get('english_level') || null,
      referral_source: get('referral_source') || null,
      experience: get('experience') || null,
      resume_path, license_path,
    }).select('id').single()

    if (error) {
      console.error('Candidate insert error:', error.message)
      return NextResponse.json({ error: 'Could not save application' }, { status: 500 })
    }

    // Mirror the application into Asana (as a task) and store the link back.
    // The task carries a BSM_ID marker so the importer never re-pulls it.
    try {
      const asana = await pushToAsana(inserted.id, {
        full_name, phone, email, preferred_lang, positions, security_licensed,
        location: [get('borough'), get('city'), get('state')].filter(Boolean).join(', '),
        work_areas, expected_pay,
        transportation: transportation.join(', '),
        availability: get('availability'), english_level: get('english_level'),
        referral_source: get('referral_source'), experience: get('experience'),
      })
      if (asana) await supabase.from('candidates').update({ asana_task_id: asana.gid, asana_url: asana.url }).eq('id', inserted.id)
    } catch (e: any) { console.error('Asana push failed:', e?.message) }

    sendConfirmation(email, full_name, positions.join(', '), preferred_lang).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Apply route error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function sendConfirmation(email: string, name: string, roles: string, lang: 'en' | 'es') {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const subject = lang === 'es'
    ? 'Recibimos tu solicitud — BSM Facility Solutions'
    : 'We received your application — BSM Facility Solutions'
  const body = lang === 'es'
    ? `<p>Hola ${name},</p><p>Gracias por aplicar a <strong>${roles}</strong> en BSM Facility Solutions. Recibimos tu solicitud y un reclutador la revisará pronto.</p><p>— Equipo de Reclutamiento de BSM</p>`
    : `<p>Hi ${name},</p><p>Thanks for applying for <strong>${roles}</strong> at BSM Facility Solutions. We've received your application and a recruiter will review it shortly.</p><p>— BSM Recruiting Team</p>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [email], subject, html: body }),
  })
}

// ── Asana mirror ───────────────────────────────────────────────────────
const ASANA_PROJECT = '1207417865507098' // Prospective Candidates

type AsanaPayload = {
  full_name: string; phone: string; email: string; preferred_lang: string
  positions: string[]; security_licensed: boolean | null; location: string
  work_areas: string[]; expected_pay: string | null; transportation: string
  availability: string; english_level: string; referral_source: string; experience: string
}

function buildNotes(candidateId: string, c: AsanaPayload): string {
  const sec = c.security_licensed === true ? 'Licensed' : c.security_licensed === false ? 'Unlicensed' : '—'
  const L = (k: string, v: string) => `${k}:: ${v || '—'}`
  return [
    'SOURCE:: BSM Careers Website',
    `BSM_ID:: ${candidateId}`,
    '(Already in the BSM system — do not import.)',
    '',
    L('Full Name', c.full_name),
    L('Phone', c.phone),
    L('Email', c.email),
    L('Preferred language', c.preferred_lang === 'es' ? 'Español' : 'English'),
    L('Position(s)', c.positions.join(', ')),
    L('Security licensed', sec),
    L('Location', c.location),
    L('Open to work in', c.work_areas.join(', ')),
    L('Expected pay', c.expected_pay || '—'),
    L('Transportation', c.transportation),
    L('Availability', c.availability),
    L('English level', c.english_level),
    L('Heard via', c.referral_source),
    L('Experience', c.experience),
  ].join('\n')
}

async function pushToAsana(candidateId: string, c: AsanaPayload): Promise<{ gid: string; url: string } | null> {
  const token = process.env.ASANARECRUITER
  if (!token) return null
  const res = await fetch('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { name: c.full_name, notes: buildNotes(candidateId, c), projects: [ASANA_PROJECT] } }),
  })
  if (!res.ok) { console.error('Asana create failed:', res.status, await res.text().catch(() => '')); return null }
  const j = await res.json()
  const gid = j?.data?.gid
  return gid ? { gid, url: `https://app.asana.com/0/${ASANA_PROJECT}/${gid}` } : null
}
