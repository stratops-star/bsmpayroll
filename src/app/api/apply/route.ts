import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM = 'BSM Careers <careers@bsmfacilitysolutions.com>' // ← must be a verified Resend sender

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()

    // Honeypot: real users never fill this. Silently accept + drop.
    if ((fd.get('company') as string)?.trim()) {
      return NextResponse.json({ ok: true })
    }

    const get = (k: string) => ((fd.get(k) as string) || '').trim()
    const full_name = get('full_name')
    const phone = get('phone')
    const email = get('email')
    const position = get('position')
    const preferred_lang = get('preferred_lang') === 'es' ? 'es' : 'en'

    if (!full_name || !phone || !email || !position) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Resolve position name → id
    const { data: pos } = await supabase
      .from('positions').select('id').eq('name', position).maybeSingle()

    // Optional résumé upload → private bucket (service role bypasses storage RLS)
    let resume_path: string | null = null
    const file = fd.get('resume') as File | null
    if (file && typeof file === 'object' && file.size > 0) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `${crypto.randomUUID()}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await supabase.storage
        .from('candidate-resumes').upload(path, buf, { contentType: file.type || 'application/octet-stream' })
      if (!upErr) resume_path = path
    }

    const { error } = await supabase.from('candidates').insert({
      intake_channel: 'public_form',
      status: 'applied',
      stage: 'applied',
      in_pool: false,
      position_id: pos?.id ?? null,
      full_name,
      phone,
      email,
      preferred_lang,
      location: get('location') || null,
      expected_pay: get('expected_pay') || null,
      english_level: get('english_level') || null,
      referral_source: get('referral_source') || null,
      experience: get('experience') || null,
      resume_path,
    })

    if (error) {
      console.error('Candidate insert error:', error.message)
      return NextResponse.json({ error: 'Could not save application' }, { status: 500 })
    }

    // Confirmation email — non-blocking (never fails the application)
    sendConfirmation(email, full_name, position, preferred_lang).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Apply route error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function sendConfirmation(email: string, name: string, position: string, lang: 'en' | 'es') {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const subject = lang === 'es'
    ? 'Recibimos tu solicitud — BSM Facility Solutions'
    : 'We received your application — BSM Facility Solutions'

  const body = lang === 'es'
    ? `<p>Hola ${name},</p>
       <p>Gracias por aplicar al puesto de <strong>${position}</strong> en BSM Facility Solutions. Recibimos tu solicitud y un reclutador la revisará pronto.</p>
       <p>Si es un buen momento, te contactaremos para una entrevista inicial.</p>
       <p>— Equipo de Reclutamiento de BSM</p>`
    : `<p>Hi ${name},</p>
       <p>Thanks for applying for the <strong>${position}</strong> role at BSM Facility Solutions. We've received your application and a recruiter will review it shortly.</p>
       <p>If it's a good fit, we'll reach out to schedule an initial interview.</p>
       <p>— BSM Recruiting Team</p>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [email], subject, html: body }),
  })
}
