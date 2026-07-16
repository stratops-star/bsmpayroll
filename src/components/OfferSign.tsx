'use client'

import { useEffect, useRef, useState } from 'react'

const NAVY = '#0D1B35', GOLD = '#D4A843'

const T = {
  en: { review: 'Please review your offer letter below, then sign at the bottom.', sign: 'Sign here', draw: 'Draw', type: 'Type', clear: 'Clear', typedPh: 'Type your full name', printed: 'Printed name', date: 'Date', accept: 'I have read and accept this conditional offer', submit: 'Sign & accept offer', sending: 'Submitting…', needSig: 'Please add your signature.', needName: 'Please enter your printed name.', needAccept: 'Please confirm you accept the offer.', doneTitle: 'Offer signed', doneBody: 'Thank you! Your signed offer letter has been sent to BSM Facility Solutions and a copy has been emailed to you.', download: 'Download signed PDF', signedOn: 'Signed on', legal: 'By signing electronically you agree your electronic signature is the legal equivalent of your handwritten signature.' },
  es: { review: 'Revise su carta de oferta a continuación y luego firme al final.', sign: 'Firme aquí', draw: 'Dibujar', type: 'Escribir', clear: 'Borrar', typedPh: 'Escriba su nombre completo', printed: 'Nombre en letra de molde', date: 'Fecha', accept: 'He leído y acepto esta oferta condicional', submit: 'Firmar y aceptar oferta', sending: 'Enviando…', needSig: 'Por favor agregue su firma.', needName: 'Por favor escriba su nombre.', needAccept: 'Por favor confirme que acepta la oferta.', doneTitle: 'Oferta firmada', doneBody: '¡Gracias! Su carta de oferta firmada fue enviada a BSM Facility Solutions y se le envió una copia por correo.', download: 'Descargar PDF firmado', signedOn: 'Firmada el', legal: 'Al firmar electrónicamente, usted acepta que su firma electrónica es el equivalente legal de su firma manuscrita.' },
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

  // signature pad
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

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6FA', fontFamily: 'system-ui, sans-serif', padding: '0 0 40px' }}>
      {/* header */}
      <div style={{ background: '#1A1A1A', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div><div style={{ color: GOLD, fontSize: 20, fontWeight: 800, letterSpacing: 2 }}>BSM</div><div style={{ color: GOLD, fontSize: 6, letterSpacing: 3 }}>FACILITY SOLUTIONS</div></div>
        <div style={{ marginLeft: 'auto', color: '#fff', fontWeight: 700, fontSize: 15, textAlign: 'right' }}>POSITION OFFER</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px' }}>
        {done ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', margin: '24px 0', borderTop: `4px solid ${GOLD}` }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>{t.doneTitle}</h1>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55, margin: '0 0 18px' }}>{t.doneBody}</p>
            {(signedAt || alreadySigned) && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px' }}>{t.signedOn} {signedAt ? new Date(signedAt).toLocaleString(L === 'es' ? 'es-US' : 'en-US') : today}{signedName ? ` · ${signedName}` : ''}</p>}
            {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: GOLD, color: NAVY, fontWeight: 700, padding: '11px 22px', borderRadius: 10, textDecoration: 'none', fontSize: 14 }}>⬇ {t.download}</a>}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#6B7280', margin: '18px 0 12px', textAlign: 'center' }}>{t.review}</p>
        )}

        {/* letter */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '30px 32px', fontSize: 13.5, lineHeight: 1.6, color: '#222', boxShadow: '0 4px 24px -12px rgba(13,27,53,.25)' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14 }}>{snap.company?.address}<br />{snap.company?.phone} · {snap.company?.email} · {snap.company?.web}</div>
          <div style={{ background: '#FFF3A3', display: 'inline-block', padding: '1px 5px', fontWeight: 700, marginBottom: 12 }}>{snap.letter_date}</div>
          <p style={{ margin: '0 0 16px' }}><b>{lab.subject}:</b> {snap.subject}</p>

          <p style={{ margin: '0 0 12px' }}>Dear {snap.candidate_name},</p>
          <p style={{ margin: '0 0 10px' }}>{snap.intro}</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}><li>{snap.contingency}</li></ul>
          <p style={{ margin: '0 0 16px' }}>{snap.details_lead}</p>

          <H>{lab.details}:</H>
          <ul style={{ margin: '0 0 6px', paddingLeft: 22 }}>
            <li><b>{lab.position}:</b> {d.position}</li>
            <li><b>{lab.start}:</b> {d.start_date}</li>
          </ul>
          <Bar>{lab.schedule}: {d.schedule}</Bar>
          <ul style={{ margin: '6px 0 0', paddingLeft: 22 }}><li><b>{lab.location}:</b> {d.location}</li></ul>

          <H>{lab.comp}:</H>
          <Bar>{lab.rate}: {d.hourly_rate}</Bar>
          <ul style={{ margin: '6px 0 0', paddingLeft: 22 }}>
            <li><b>{lab.pay}:</b> {snap.pay_schedule}<ul style={{ paddingLeft: 20, marginTop: 3 }}><li style={{ listStyle: 'circle' }}>{snap.pay_detail}</li></ul></li>
          </ul>

          <H>{lab.benefits}:</H>
          <ul style={{ margin: 0, paddingLeft: 22 }}>{(snap.benefits || []).map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>

          {(snap.duties || []).length > 0 && (<>
            <H>{lab.duties}:</H>
            {snap.duties_intro && <p style={{ margin: '0 0 6px' }}>{snap.duties_intro}</p>}
            <ul style={{ margin: 0, paddingLeft: 34 }}>{(snap.duties || []).map((x: string, i: number) => <li key={i} style={{ listStyle: 'circle' }}>{x}</li>)}</ul>
          </>)}

          <H>{lab.hours}</H>
          {(snap.overtime || '').split(/\n{2,}/).filter(Boolean).map((p: string, i: number) => <p key={i} style={{ margin: '0 0 10px' }}>{p}</p>)}

          {snap.jd_note && <p style={{ margin: '0 0 12px', fontStyle: 'italic' }}>{snap.jd_note}</p>}
          <p style={{ margin: '0 0 12px' }}><b>{lab.atwill}:</b> {snap.at_will}</p>
          <p style={{ margin: '0 0 12px' }}><b>{lab.next}:</b> {snap.next_steps}</p>
          <p style={{ margin: '0 0 18px' }}>{snap.closing}</p>

          <p style={{ margin: 0 }}>{lab.sincerely},</p>
          <p style={{ fontStyle: 'italic', fontSize: 17, margin: '4px 0 2px' }}>{snap.signer?.name}</p>
          <p style={{ margin: 0, fontSize: 12.5 }}>{snap.signer?.title}<br />BSM Facility Solutions<br />{snap.signer?.phone}</p>

          <div style={{ borderTop: '1px solid #E5E7EB', margin: '22px 0 0', paddingTop: 16 }}>
            <H>{lab.ack}</H>
            <p style={{ margin: 0 }}>{snap.acknowledgment}</p>
          </div>
        </div>

        {/* signature */}
        {!done && (
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginTop: 16, borderTop: `4px solid ${GOLD}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 12px' }}>✍️ {t.sign}</h2>

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['draw', 'type'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid ' + (mode === m ? NAVY : '#E5E7EB'), background: mode === m ? NAVY : '#fff', color: mode === m ? '#fff' : '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{m === 'draw' ? t.draw : t.type}</button>
              ))}
            </div>

            {mode === 'draw' ? (
              <div>
                <canvas ref={canvasRef} style={{ width: '100%', height: 150, border: '1px dashed #CBD5E1', borderRadius: 10, background: '#FCFCFD', touchAction: 'none', cursor: 'crosshair' }} />
                <button onClick={clearPad} style={{ marginTop: 6, background: 'none', border: 0, color: '#6B7280', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>{t.clear}</button>
              </div>
            ) : (
              <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={t.typedPh}
                style={{ width: '100%', padding: '14px 12px', border: '1px dashed #CBD5E1', borderRadius: 10, fontSize: 26, fontStyle: 'italic', fontFamily: 'Georgia, serif', boxSizing: 'border-box', outline: 'none' }} />
            )}

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase' }}>{t.printed}</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 9, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: '#6B7280' }}>{t.date}: <b style={{ color: '#222' }}>{today}</b></div>

            <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 14, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} style={{ marginTop: 3 }} />
              <span>{t.accept}</span>
            </label>

            {err && <p style={{ color: '#DC2626', fontSize: 13, background: '#FEF2F2', padding: '9px 12px', borderRadius: 8, margin: '12px 0 0' }}>{err}</p>}

            <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 16, background: GOLD, color: NAVY, border: 0, borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? t.sending : t.submit}</button>
            <p style={{ fontSize: 10.5, color: '#9CA3AF', margin: '10px 0 0', lineHeight: 1.5, textAlign: 'center' }}>{t.legal}</p>
          </div>
        )}
      </div>
    </div>
  )
}

const H = ({ children }: any) => <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.3, margin: '16px 0 5px', color: '#111' }}>{children}</div>
const Bar = ({ children }: any) => <div style={{ fontWeight: 700, fontSize: 12, background: '#F1F2F4', padding: '3px 5px' }}>{children}</div>
