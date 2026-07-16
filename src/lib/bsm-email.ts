// BSM Facility Solutions — branded transactional email builder.
// House style per BSM_email_template.md. Tables + inline styles only (Outlook/Gmail safe).

export const APP = process.env.NEXT_PUBLIC_SITE_URL || 'https://bsmfacilitysolutions.app'

const CHAR = '#1E1B17', GOLD = '#DCB878', INK = '#3F3A32', MUTE = '#8C8375'
const PAGE = '#F5F3EF', HAIRLINE = '#F0EDE7', CREAM = '#FBF8F2', CREAM_B = '#EFE6D3'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

export type Row = [string, string | null | undefined]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const row = (label: string, value: string | null | undefined) => value
  ? `<tr>
       <td style="padding:9px 0;border-bottom:1px solid ${HAIRLINE};color:${MUTE};font-size:13px;white-space:nowrap">${esc(label)}</td>
       <td style="padding:9px 0 9px 18px;border-bottom:1px solid ${HAIRLINE};color:${CHAR};font-size:14px;font-weight:600;text-align:right">${esc(String(value))}</td>
     </tr>` : ''

export type EmailOpts = {
  preheader: string
  eyebrow: string          // e.g. 'CAREERS'
  headline: string
  name?: string
  lede: string
  ctaLabel?: string
  ctaUrl?: string
  rows?: Row[]
  calloutHtml?: string
  disclaimerHtml?: string
  thanks?: string
  signoff: string
  footerNote: string
  greeting?: string        // 'Hi' | 'Hola'
}

export function bsmEmail(o: EmailOpts): string {
  const rowsHtml = (o.rows || []).map(([l, v]) => row(l, v)).join('')
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:540px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 14px rgba(30,27,23,.08);font-family:${FONT}">

        <tr><td style="background:${CHAR};padding:26px 28px;text-align:center">
          <img src="${APP}/bsm-logo.png" alt="BSM Facility Solutions" width="150" style="height:auto;display:block;margin:0 auto 4px" />
          <div style="color:${GOLD};font-size:11px;letter-spacing:2.5px;font-weight:700;margin-top:8px">${esc(o.eyebrow)}</div>
        </td></tr>

        <tr><td style="height:3px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr>

        <tr><td style="padding:30px 28px 8px">
          <h1 style="margin:0 0 4px;color:${CHAR};font-size:21px;font-weight:700;letter-spacing:-.2px">${esc(o.headline)}</h1>
          <div style="width:34px;height:2px;background:${GOLD};margin:12px 0 18px"></div>
          ${o.name ? `<p style="margin:0 0 6px;color:${INK};font-size:15px">${esc(o.greeting || 'Hi')} ${esc(o.name)},</p>` : ''}
          <p style="margin:0;color:${INK};font-size:15px;line-height:1.6">${o.lede}</p>
        </td></tr>

        ${o.ctaUrl && o.ctaLabel ? `
        <tr><td style="padding:24px 28px 4px" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${GOLD};border-radius:10px">
              <a href="${o.ctaUrl}" style="display:inline-block;padding:14px 30px;color:${CHAR};font-size:15px;font-weight:700;text-decoration:none;font-family:${FONT}">${esc(o.ctaLabel)}</a>
            </td>
          </tr></table>
        </td></tr>` : ''}

        ${rowsHtml ? `
        <tr><td style="padding:22px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${HAIRLINE}">${rowsHtml}</table>
        </td></tr>` : ''}

        ${o.calloutHtml ? `
        <tr><td style="padding:20px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border:1px solid ${CREAM_B};border-radius:10px">
            <tr><td style="padding:14px 16px;color:${INK};font-size:13.5px;line-height:1.5">${o.calloutHtml}</td></tr>
          </table>
        </td></tr>` : ''}

        ${o.disclaimerHtml ? `
        <tr><td style="padding:16px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-left:3px solid ${GOLD};border-radius:0 8px 8px 0">
            <tr><td style="padding:10px 0 10px 14px;color:${MUTE};font-size:12.5px;line-height:1.6">${o.disclaimerHtml}</td></tr>
          </table>
        </td></tr>` : ''}

        <tr><td style="padding:26px 28px 30px">
          ${o.thanks ? `<p style="margin:0 0 4px;color:${INK};font-size:15px;line-height:1.6">${o.thanks}</p>` : ''}
          <p style="margin:14px 0 0;color:${CHAR};font-size:14px;font-weight:700">${esc(o.signoff)}</p>
        </td></tr>

        <tr><td style="background:${CHAR};padding:18px 28px;text-align:center">
          <div style="color:${GOLD};font-size:12px;font-weight:700;letter-spacing:.4px">BSM Facility Solutions</div>
          <div style="color:#7C7266;font-size:11px;margin-top:5px;line-height:1.5">${esc(o.footerNote)}</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`
}

// Plain-text companion — always send alongside html.
export function bsmText(o: EmailOpts): string {
  const strip = (h: string) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const lines = [
    o.headline, '',
    o.name ? `${o.greeting || 'Hi'} ${o.name},` : '',
    strip(o.lede), '',
    o.ctaUrl && o.ctaLabel ? `${o.ctaLabel}: ${o.ctaUrl}` : '',
    ...(o.rows || []).filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`),
    '',
    o.calloutHtml ? strip(o.calloutHtml) : '',
    o.disclaimerHtml ? strip(o.disclaimerHtml) : '',
    '',
    o.thanks ? strip(o.thanks) : '',
    o.signoff, '',
    'BSM Facility Solutions',
    o.footerNote,
  ]
  return lines.filter(l => l !== '').join('\n')
}

export async function sendBsmEmail(opts: {
  to: string[]; subject: string; from?: string
  email: EmailOpts
  attachments?: { filename: string; content: string }[]
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: opts.from || process.env.RESEND_FROM || 'BSM Facility Solutions <careers@bsmfacilitysolutions.app>',
        to: opts.to,
        subject: opts.subject,
        html: bsmEmail(opts.email),
        text: bsmText(opts.email),
        ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
      }),
    })
    return r.ok
  } catch { return false }
}
