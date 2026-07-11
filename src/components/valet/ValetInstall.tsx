'use client'

import { useEffect, useState } from 'react'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'

export default function ValetInstall() {
  const [deferred, setDeferred] = useState<any>(null)
  const [showIos, setShowIos] = useState(false)
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

  if (installed) return null

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone

  async function onClick() {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
    } else if (isIos) {
      setShowIos(true)
    } else {
      setShowIos(true) // fallback instructions
    }
  }

  return (
    <>
      <button onClick={onClick} style={{ width: '100%', marginTop: 14, background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}`, borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        ⬇ Add app to home screen
      </button>

      {showIos && (
        <div onClick={() => setShowIos(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.6)', display: 'grid', placeItems: 'center', zIndex: 120, padding: 18 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', maxWidth: 340, borderRadius: 18, padding: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📲</div>
            <h3 style={{ color: NAVY, margin: '0 0 10px' }}>Install BSM Valet</h3>
            {isIos ? (
              <p style={{ color: '#5B5347', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                In Safari, tap the <b>Share</b> button <span style={{ color: GOLD }}>↑</span>, then choose
                <b> "Add to Home Screen."</b> The app opens straight to sign in.
              </p>
            ) : (
              <p style={{ color: '#5B5347', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Open your browser menu (⋮) and choose <b>"Install app"</b> or <b>"Add to Home screen."</b>
              </p>
            )}
            <button onClick={() => setShowIos(false)} style={{ marginTop: 18, background: NAVY, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}
