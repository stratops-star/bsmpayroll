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
async function email(to: string, subject: string, html: string, text?: string) {
  const key = process.env.RESEND_API_KEY; if (!key || !to) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'BSM Valet <valet.fg@bsmfacilitysolutions.app>', to: [to], subject, html, ...(text ? { text } : {}) }),
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
  const APP = 'https://bsmfacilitysolutions.app'
  const GOLD = '#DCB878', CHAR = '#1E1B17', INK = '#3F3A32', MUTE = '#8C8375'

  const body =
    `BSM Valet access / Acceso BSM Valet\n\n` +
    `Sign in / Ingresa: ${LOGIN_URL}\n` +
    `Email: ${loginEmail}\n` +
    `Password / Contraseña: ${pw}\n\n` +
    `Change this password after your first sign in. / Cambia esta contraseña después de entrar.\n` +
    `Keep this private. / Manténlo privado.`

  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:9px 0;border-bottom:1px solid #F0EDE7;color:${MUTE};font-size:13px;white-space:nowrap">${label}</td>
       <td style="padding:9px 0 9px 18px;border-bottom:1px solid #F0EDE7;color:${CHAR};font-size:14px;font-weight:600;text-align:right;word-break:break-all">${value}</td>
     </tr>`

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F3EF;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your BSM Valet sign-in details are inside. / Tus datos de acceso están adentro.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 14px rgba(30,27,23,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">

        <tr><td style="background:${CHAR};padding:26px 28px;text-align:center">
          <img src="${APP}/bsm-logo.png" alt="BSM Facility Solutions" width="150" style="height:auto;display:block;margin:0 auto 4px" />
          <div style="color:${GOLD};font-size:11px;letter-spacing:2.5px;font-weight:700;margin-top:8px">VALET SERVICE</div>
        </td></tr>
        <tr><td style="height:3px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr>

        <tr><td style="padding:30px 28px 8px">
          <h1 style="margin:0 0 4px;color:${CHAR};font-size:21px;font-weight:700;letter-spacing:-.2px">Your account is ready</h1>
          <div style="width:34px;height:2px;background:${GOLD};margin:12px 0 18px"></div>
          <p style="margin:0 0 6px;color:${INK};font-size:15px">Hi ${name},</p>
          <p style="margin:0;color:${INK};font-size:15px;line-height:1.6">
            You can now sign in to the BSM Valet app with the details below.<br/>
            <span style="color:${MUTE};font-size:14px">Ya puedes entrar a la app de BSM Valet con estos datos.</span>
          </p>
        </td></tr>

        <tr><td style="padding:22px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F0EDE7">
            ${row('Email', loginEmail)}
            ${row('Password / Contraseña', pw)}
          </table>
        </td></tr>

        <tr><td style="padding:22px 28px 0" align="center">
          <a href="${LOGIN_URL}" style="display:inline-block;background:${GOLD};color:${CHAR};text-decoration:none;font-size:15px;font-weight:800;padding:14px 34px;border-radius:12px;letter-spacing:.2px">Sign in / Ingresar</a>
          <div style="color:${MUTE};font-size:11.5px;margin-top:10px;word-break:break-all">${LOGIN_URL}</div>
        </td></tr>

        <tr><td style="padding:20px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F2;border:1px solid #EFE6D3;border-radius:10px">
            <tr><td style="padding:14px 16px;color:${INK};font-size:13.5px;line-height:1.55">
              <strong style="color:${CHAR}">Change this password after your first sign in</strong>, and keep it private.<br/>
              <span style="color:${MUTE}">Cambia esta contraseña después de entrar y manténla privada.</span>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 28px 30px">
          <p style="margin:0;color:${INK};font-size:14.5px;line-height:1.6">Welcome to the team.<br/><span style="color:${MUTE}">Bienvenido al equipo.</span></p>
          <p style="margin:14px 0 0;color:${CHAR};font-size:14px;font-weight:700">The BSM Valet Team</p>
        </td></tr>

        <tr><td style="background:${CHAR};padding:18px 28px;text-align:center">
          <div style="color:${GOLD};font-size:12px;font-weight:700;letter-spacing:.4px">BSM Facility Solutions</div>
          <div style="color:#7C7266;font-size:11px;margin-top:5px;line-height:1.5">Trouble signing in? Contact your valet manager.<br/>Please do not reply to this message.</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`
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
      email(loginEmail, 'Your BSM Valet login — account ready', html, body),
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
      email(u.email, 'Your BSM Valet login — account ready', html, body),
    ])
    return NextResponse.json({ ok: true, sms: s, email: e })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
