'use client'

import { useEffect, useRef, useState } from 'react'

// BSM house brand tokens
const CHAR = '#1E1B17', GOLD = '#DCB878', INK = '#3F3A32', MUTE = '#8C8375'
const PAGE = '#F5F3EF', HAIR = '#F0EDE7', CREAM = '#FBF8F2', CREAM_B = '#EFE6D3'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const APP = 'https://bsmfacilitysolutions.app'

const T = {
  en: { eyebrow: 'CONDITIONAL OFFER', review: 'Please review your offer letter below, then sign at the bottom of this page.', sign: 'Sign your offer', signSub: 'Draw your signature or type your name.', draw: 'Draw', type: 'Type', clear: 'Clear signature', typedPh: 'Type your full name', printed: 'Printed name', date: 'Date', accept: 'I have read and accept the terms of this conditional offer of employment.', submit: 'Sign and accept offer', sending: 'Submitting your signature…', needSig: 'Please add your signature.', needName: 'Please enter your printed name.', needAccept: 'Please confirm that you accept the offer.', doneTitle: 'Your offer is signed', doneBody: 'Thank you. A copy of your signed offer letter has been emailed to you, and our team has been notified. We will be in touch shortly with your next steps.', download: 'Download signed PDF', signedOn: 'Signed', legal: 'By signing electronically, you agree that your electronic signature is the legal equivalent of your handwritten signature.', footer: 'This offer is personal to you. Please do not forward this link.' },
  es: { eyebrow: 'OFERTA CONDICIONAL', review: 'Revise su carta de oferta a continuación y luego firme al final de esta página.', sign: 'Firme su oferta', signSub: 'Dibuje su firma o escriba su nombre.', draw: 'Dibujar', type: 'Escribir', clear: 'Borrar firma', typedPh: 'Escriba su nombre completo', printed: 'Nombre en letra de molde', date: 'Fecha', accept: 'He leído y acepto los términos de esta oferta condicional de empleo.', submit: 'Firmar y aceptar la oferta', sending: 'Enviando su firma…', needSig: 'Por favor agregue su firma.', needName: 'Por favor escriba su nombre.', needAccept: 'Por favor confirme que acepta la oferta.', doneTitle: 'Su oferta está firmada', doneBody: 'Gracias. Le enviamos por correo una copia de su carta de oferta firmada y nuestro equipo ya fue notificado. Nos comunicaremos con usted en breve con los siguientes pasos.', download: 'Descargar PDF firmado', signedOn: 'Firmada', legal: 'Al firmar electrónicamente, usted acepta que su firma electrónica es el equivalente legal de su firma manuscrita.', footer: 'Esta oferta es personal. Por favor no reenvíe este enlace.' },
}

export default function OfferSign({ token, snap, alreadySigned, signedAt, signedName, signedUrl }: {
  token: string; snap: any; alreadySigned: boolean; signedAt: string | null; signedName: string | null; signedUrl: string | null
}) {
  const L = snap.lang === 'es' ? 'es' : 'en'
  const t = T[L as 'en' | 'es']
  const lab = snap.labels || {}
  const d = snap.details || {}

  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState('')
  const [name, setName] = useState(snap.candidate_name || '')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(alreadySigned)
  const [pdfUrl, setPdfUrl] = useState<string | null>(signedUrl)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drew = useRef(false)

  useEffect(() => {
    if (done || mode !== 'draw') return
    const c = canvasRef.current; if (!c) return
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * ratio; c.height = rect.height * ratio
    const ctx = c.getContext('2d')!; ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'
    let drawing = false
    const pos = (e: any) => { const r = c.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top } }
    const start = (e: any) => { e.preventDefault(); drawing = true; drew.current = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y) }
    const move = (e: any) => { if (!drawing) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke() }
    const end = () => { drawing = false }
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move); window.addEventListener('mouseup', end)
    c.addEventListener('touchstart', start, { passive: false }); c.addEventListener('touchmove', move, { passive: false }); c.addEventListener('touchend', end)
    return () => { c.removeEventListener('mousedown', start); c.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); c.removeEventListener('touchstart', start); c.removeEventListener('touchmove', move); c.removeEventListener('touchend', end) }
  }, [mode, done])

  function clearPad() { const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height); drew.current = false }

  async function submit() {
    setErr('')
    if (mode === 'draw' && !drew.current) { setErr(t.needSig); return }
    if (mode === 'type' && !typed.trim()) { setErr(t.needSig); return }
    if (!name.trim()) { setErr(t.needName); return }
    if (!accept) { setErr(t.needAccept); return }
    setBusy(true)
    const dataUrl = mode === 'draw' ? canvasRef.current?.toDataURL('image/png') : null
    try {
      const r = await fetch('/api/offer-sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signature: dataUrl, typed: mode === 'type' ? typed.trim() : null, printed_name: name.trim() }),
      })
      const j = await r.json()
      setBusy(false)
      if (!r.ok) { setErr(j.error || 'Something went wrong. Please try again.'); return }
      setPdfUrl(j.url || null); setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setBusy(false); setErr('Network error. Please try again.') }
  }

  const today = new Date().toLocaleDateString(L === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, boxShadow: '0 2px 14px rgba(30,27,23,.08)', overflow: 'hidden' }

  return (
    <div style={{ minHeight: '100vh', background: PAGE, fontFamily: FONT, color: INK }}>
      {/* Letterhead */}
      <div style={{ background: CHAR, padding: '26px 24px', textAlign: 'center' }}>
        <img src={`${APP}/bsm-logo.png`} alt="BSM Facility Solutions" width={150} style={{ height: 'auto', display: 'block', margin: '0 auto' }} />
        <div style={{ color: GOLD, fontSize: 11, letterSpacing: 2.5, fontWeight: 700, marginTop: 8 }}>{t.eyebrow}</div>
      </div>
      <div style={{ height: 3, background: GOLD }} />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 14px 48px' }}>
        {done ? (
          <div style={{ ...card, padding: '36px 30px', textAlign: 'center', margin: '22px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: GOLD, margin: '0 auto 14px', display: 'grid', placeItems: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={CHAR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: CHAR, margin: '0 0 6px', letterSpacing: '-.2px' }}>{t.doneTitle}</h1>
            <div style={{ width: 34, height: 2, background: GOLD, margin: '12px auto 16px' }} />
            <p style={{ fontSize: 15, color: INK, lineHeight: 1.6, margin: '0 0 18px' }}>{t.doneBody}</p>
            {(signedAt || alreadySigned) && <p style={{ fontSize: 12.5, color: MUTE, margin: '0 0 18px' }}>{t.signedOn}: {signedAt ? new Date(signedAt).toLocaleString(L === 'es' ? 'es-US' : 'en-US') : today}{signedName ? ` — ${signedName}` : ''}</p>}
            {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: GOLD, color: CHAR, fontWeight: 700, padding: '13px 28px', borderRadius: 10, textDecoration: 'none', fontSize: 15 }}>{t.download}</a>}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: MUTE, margin: '20px 0 14px', textAlign: 'center', lineHeight: 1.6 }}>{t.review}</p>
        )}

        {/* The letter */}
        <div style={{ ...card, padding: '34px 34px 38px', fontSize: 13.5, lineHeight: 1.65 }}>
          <div style={{ fontSize: 11, color: MUTE, marginBottom: 16, lineHeight: 1.6 }}>
            {snap.company?.address}<br />{snap.company?.phone} &nbsp;·&nbsp; {snap.company?.email} &nbsp;·&nbsp; {snap.company?.web}
          </div>
          <div style={{ height: 1, background: HAIR, margin: '0 0 18px' }} />

          <div style={{ fontWeight: 700, color: CHAR, marginBottom: 14 }}>{snap.letter_date}</div>
          <p style={{ margin: '0 0 18px', color: CHAR }}><b>{lab.subject}:</b> {snap.subject}</p>

          <p style={{ margin: '0 0 12px' }}>Dear {snap.candidate_name},</p>
          <p style={{ margin: '0 0 10px' }}>{snap.intro}</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}><li>{snap.contingency}</li></ul>
          <p style={{ margin: '0 0 4px' }}>{snap.details_lead}</p>

          <H>{lab.details}:</H>
          <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
            <li><b>{lab.position}:</b> {d.position}</li>
            <li><b>{lab.start}:</b> {d.start_date}</li>
          </ul>
          <Bar>{lab.schedule}: {d.schedule}</Bar>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}><li><b>{lab.location}:</b> {d.location}</li></ul>

          <H>{lab.comp}:</H>
          <Bar>{lab.rate}: {d.hourly_rate}</Bar>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li><b>{lab.pay}:</b> {snap.pay_schedule}
              <ul style={{ paddingLeft: 18, marginTop: 4 }}><li style={{ listStyle: 'circle' }}>{snap.pay_detail}</li></ul>
            </li>
          </ul>

          <H>{lab.benefits}:</H>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{(snap.benefits || []).map((b: string, i: number) => <li key={i} style={{ marginBottom: 2 }}>{b}</li>)}</ul>

          {(snap.duties || []).length > 0 && (<>
            <H>{lab.duties}:</H>
            {snap.duties_intro && <p style={{ margin: '0 0 7px' }}>{snap.duties_intro}</p>}
            <ul style={{ margin: 0, paddingLeft: 32 }}>{(snap.duties || []).map((x: string, i: number) => <li key={i} style={{ listStyle: 'circle', marginBottom: 2 }}>{x}</li>)}</ul>
          </>)}

          <H>{lab.hours}</H>
          {(snap.overtime || '').split(/\n{2,}/).filter(Boolean).map((p: string, i: number) => <p key={i} style={{ margin: '0 0 10px' }}>{p}</p>)}

          {snap.jd_note && <p style={{ margin: '0 0 12px', fontStyle: 'italic', color: MUTE }}>{snap.jd_note}</p>}
          <p style={{ margin: '0 0 12px' }}><b>{lab.atwill}:</b> {snap.at_will}</p>
          <p style={{ margin: '0 0 12px' }}><b>{lab.next}:</b> {snap.next_steps}</p>
          <p style={{ margin: '0 0 20px' }}>{snap.closing}</p>

          <p style={{ margin: 0 }}>{lab.sincerely},</p>
          <p style={{ fontStyle: 'italic', fontSize: 18, margin: '6px 0 4px', color: CHAR, fontFamily: 'Georgia, serif' }}>{snap.signer?.name}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE, lineHeight: 1.6 }}>{snap.signer?.title}<br />BSM Facility Solutions<br />{snap.signer?.phone}</p>

          <div style={{ background: CREAM, border: `1px solid ${CREAM_B}`, borderRadius: 10, padding: '16px 18px', marginTop: 26 }}>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: .4, color: CHAR, marginBottom: 8 }}>{lab.ack}</div>
            <p style={{ margin: 0, fontSize: 13 }}>{snap.acknowledgment}</p>
          </div>
        </div>

        {/* Signature */}
        {!done && (
          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ height: 3, background: GOLD }} />
            <div style={{ padding: '26px 28px 30px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: CHAR, margin: '0 0 2px', letterSpacing: '-.2px' }}>{t.sign}</h2>
              <div style={{ width: 30, height: 2, background: GOLD, margin: '10px 0 8px' }} />
              <p style={{ fontSize: 13.5, color: MUTE, margin: '0 0 16px' }}>{t.signSub}</p>

              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['draw', 'type'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid ' + (mode === m ? CHAR : '#E5E1DA'), background: mode === m ? CHAR : '#fff', color: mode === m ? GOLD : MUTE, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>{m === 'draw' ? t.draw : t.type}</button>
                ))}
              </div>

              {mode === 'draw' ? (
                <div>
                  <canvas ref={canvasRef} style={{ width: '100%', height: 160, border: `1px dashed ${CREAM_B}`, borderRadius: 10, background: CREAM, touchAction: 'none', cursor: 'crosshair', display: 'block' }} />
                  <button onClick={clearPad} style={{ marginTop: 7, background: 'none', border: 0, color: MUTE, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: FONT }}>{t.clear}</button>
                </div>
              ) : (
                <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={t.typedPh}
                  style={{ width: '100%', padding: '18px 14px', border: `1px dashed ${CREAM_B}`, borderRadius: 10, background: CREAM, fontSize: 28, fontStyle: 'italic', fontFamily: 'Georgia, serif', boxSizing: 'border-box', outline: 'none', color: CHAR }} />
              )}

              <div style={{ marginTop: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTE, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>{t.printed}</label>
                <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: '1px solid #E5E1DA', borderRadius: 9, fontSize: 14, boxSizing: 'border-box', fontFamily: FONT, color: CHAR }} />
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: MUTE }}>{t.date}: <b style={{ color: CHAR }}>{today}</b></div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, fontSize: 13.5, color: INK, cursor: 'pointer', lineHeight: 1.5 }}>
                <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} style={{ marginTop: 3, accentColor: CHAR, width: 16, height: 16 }} />
                <span>{t.accept}</span>
              </label>

              {err && <p style={{ color: '#B42318', fontSize: 13, background: '#FEF3F2', border: '1px solid #FECDCA', padding: '10px 12px', borderRadius: 8, margin: '14px 0 0' }}>{err}</p>}

              <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 18, background: GOLD, color: CHAR, border: 0, borderRadius: 10, padding: 15, fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1, fontFamily: FONT }}>{busy ? t.sending : t.submit}</button>
              <p style={{ fontSize: 11, color: MUTE, margin: '12px 0 0', lineHeight: 1.55, textAlign: 'center' }}>{t.legal}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: CHAR, padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: .4 }}>BSM Facility Solutions</div>
        <div style={{ color: '#7C7266', fontSize: 11, marginTop: 5, lineHeight: 1.5 }}>{t.footer}</div>
      </div>
    </div>
  )
}

const H = ({ children }: any) => <div style={{ fontWeight: 700, fontSize: 11.5, letterSpacing: .5, margin: '18px 0 6px', color: CHAR, textTransform: 'uppercase' }}>{children}</div>
const Bar = ({ children }: any) => <div style={{ fontWeight: 700, fontSize: 12.5, background: CREAM, border: `1px solid ${CREAM_B}`, borderRadius: 6, padding: '5px 9px', color: CHAR }}>{children}</div>
