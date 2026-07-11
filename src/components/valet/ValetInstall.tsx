'use client'

import { useEffect, useState } from 'react'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'

export default function ValetInstall({ variant = 'button' }: { variant?: 'button' | 'icon' }) {
  const [deferred, setDeferred] = useState<any>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (standalone) setInstalled(true)
    window.addEventListener('appinstalled', () => setInstalled(true))
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => {}) }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Hide entirely once installed / running as an app
  if (installed) return null

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone

  async function onClick() {
    if (deferred) { deferred.prompt(); await deferred.userChoice; setDeferred(null) }
    else setShowHelp(true)
  }

  return (
    <>
      {variant === 'icon' ? (
        <button onClick={onClick} aria-label="Install app" title="Add app to home screen"
          style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 9px', fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>
          ⬇
        </button>
      ) : (
        <button onClick={onClick}
          style={{ display: 'flex', alignItems: 'center', width: '100%', background: NAVY, border: `1.5px solid ${GOLD}`, borderRadius: 14, padding: '13px 16px', cursor: 'pointer' }}>
          <div style={{ width: 40, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4 v10" /><path d="M8 11 l4 4 4-4" /><path d="M5 19 h14" />
            </svg>
          </div>
          <div style={{ width: 1.5, alignSelf: 'stretch', background: GOLD, opacity: 0.4, margin: '2px 14px' }} />
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Add app to home screen</div>
        </button>
      )}

      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.62)', display: 'grid', placeItems: 'center', zIndex: 130, padding: 18 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#F7F4EE', maxWidth: 360, width: '100%', borderRadius: 22, padding: 28, textAlign: 'center', border: `1.5px solid ${GOLD}`, boxShadow: '0 24px 60px rgba(0,0,0,.4)' }}>
            <div style={{ width: 76, height: 76, margin: '0 auto 16px', borderRadius: '50%', background: NAVY, display: 'grid', placeItems: 'center', border: `2px solid ${GOLD}` }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="3" width="11" height="18" rx="2" />
                <path d="M10.5 6.5 h1 M14 6.5 h1 M10.5 9.5 h1 M14 9.5 h1 M10.5 12.5 h1 M14 12.5 h1" />
                <path d="M2 12 h6 M5.5 9 l3 3-3 3" />
              </svg>
            </div>
            <h3 style={{ color: NAVY, margin: '0 0 4px', fontSize: 23, fontWeight: 700 }}>Install BSM Valet</h3>
            <div style={{ width: 96, height: 1, background: GOLD, margin: '12px auto 16px' }} />
            {isIos ? (
              <p style={{ color: '#5B5347', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                In Safari, tap <b>Share</b> <span style={{ color: GOLD }}>↑</span>, then choose <b style={{ color: GOLD }}>&ldquo;Add to Home Screen.&rdquo;</b>
              </p>
            ) : (
              <p style={{ color: '#5B5347', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                Open your browser menu (⋮) and choose <b style={{ color: GOLD }}>&ldquo;Install app&rdquo;</b> or <b style={{ color: GOLD }}>&ldquo;Add to Home screen.&rdquo;</b>
              </p>
            )}
            <button onClick={() => setShowHelp(false)} style={{ marginTop: 22, background: NAVY, color: GOLD, border: `1.5px solid ${GOLD}`, borderRadius: 12, padding: '12px 30px', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M8 12 l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
