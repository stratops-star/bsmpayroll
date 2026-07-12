import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOGIN_URL = 'https://bsmfacilitysolutions.app/valet/login'

function e164(phone: string) {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d[0] === '1') return '+' + d
  return d ? '+' + d : ''
}
function tempPassword() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)]
  return 'Bsm-' + out
}
async function sms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM
  const e = e164(to); if (!sid || !tok || !from || !e) return false
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e, From: from, Body: body }),
    })
    return r.ok
  } catch { return false }
}
async function email(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; if (!key || !to) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'BSM Valet <valet.fg@bsmfacilitysolutions.app>', to: [to], subject, html }),
    })
    return r.ok
  } catch { return false }
}

// Verify the caller is a valet manager (or admin). Client sends its access token.
async function requireManager(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return false
  const svc = createServerClient()
  const { data: me } = await svc.from('app_users').select('role, active').eq('id', user.id).single()
  return !!me && me.active === true && (me.role === 'valet_manager' || me.role === 'admin')
}

function notifyText(name: string, loginEmail: string, pw: string) {
  const body =
    `BSM Valet access / Acceso BSM Valet\n\n` +
    `Sign in / Ingresa: ${LOGIN_URL}\n` +
    `Email: ${loginEmail}\n` +
    `Password / Contraseña: ${pw}\n\n` +
    `Keep this private. / Manténlo privado.`
  const html =
    `<p>Hi ${name},</p>` +
    `<p>Your BSM Valet account is ready. / Tu cuenta de BSM Valet está lista.</p>` +
    `<p><strong>Sign in / Ingresa:</strong> <a href="${LOGIN_URL}">${LOGIN_URL}</a><br>` +
    `<strong>Email:</strong> ${loginEmail}<br>` +
    `<strong>Password / Contraseña:</strong> ${pw}</p>` +
    `<p>Please keep this private. / Por favor manténlo privado.</p><p>— BSM</p>`
  return { body, html }
}

export async function POST(req: NextRequest) {
  if (!(await requireManager(req))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  const payload = await req.json().catch(() => ({}))
  const action = payload.action as string
  const svc = createServerClient()

  // -------- create a new attendant --------
  if (action === 'create') {
    const full_name = (payload.full_name || '').trim()
    const loginEmail = (payload.email || '').trim().toLowerCase()
    const phone = (payload.phone || '').trim()
    if (!full_name || !loginEmail) return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })

    const pw = tempPassword()
    let userId = ''
    const { data: created, error: cErr } = await svc.auth.admin.createUser({
      email: loginEmail, password: pw, email_confirm: true, user_metadata: { full_name },
    })
    if (cErr || !created?.user) {
      // email may already exist — find the existing auth user
      const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
      const found = list?.users?.find(u => (u.email || '').toLowerCase() === loginEmail)
      if (!found) return NextResponse.json({ error: cErr?.message || 'Could not create user.' }, { status: 400 })
      userId = found.id
      await svc.auth.admin.updateUserById(userId, { password: pw }) // reset so we can send a known pw
    } else {
      userId = created.user.id
    }

    const { error: uErr } = await svc.from('app_users').upsert({
      id: userId, email: loginEmail, full_name, phone: phone || null,
      role: 'valet', departments: [], active: true, approved: true,
    }, { onConflict: 'id' })
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

    const { body, html } = notifyText(full_name, loginEmail, pw)
    const [s, e] = await Promise.all([
      phone ? sms(phone, body) : Promise.resolve(false),
      email(loginEmail, 'Your BSM Valet login', html),
    ])
    return NextResponse.json({ ok: true, id: userId, sms: s, email: e })
  }

  // -------- activate / deactivate --------
  if (action === 'set_active') {
    const { error } = await svc.from('app_users').update({ active: !!payload.active }).eq('id', payload.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // -------- resend a fresh password --------
  if (action === 'resend') {
    const { data: u } = await svc.from('app_users').select('full_name, email, phone').eq('id', payload.id).single()
    if (!u?.email) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    const pw = tempPassword()
    await svc.auth.admin.updateUserById(payload.id, { password: pw })
    const { body, html } = notifyText(u.full_name || 'there', u.email, pw)
    const [s, e] = await Promise.all([
      u.phone ? sms(u.phone, body) : Promise.resolve(false),
      email(u.email, 'Your BSM Valet login', html),
    ])
    return NextResponse.json({ ok: true, sms: s, email: e })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
