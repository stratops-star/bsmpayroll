'use client'
import { useState } from 'react'

export default function ShareCareers() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/careers` : 'https://bsmfacilitysolutions.app/careers'
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  return (
    <div className="relative">
      {/* Trigger — desktop: pill · mobile: full-width menu row inside the gear */}
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 whitespace-nowrap text-white text-sm font-medium w-full justify-start px-3 py-2.5 rounded-lg hover:bg-white/10 sm:w-auto sm:justify-center sm:py-1.5 sm:font-normal sm:bg-white/10 sm:hover:bg-white/20 sm:border sm:border-white/15">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#DCB878" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 15l6-6" /><path d="M11.5 6.5l.8-.8a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6" /><path d="M12.5 17.5l-.8.8a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6" /></svg>
        Share application link
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          {/* mobile: centered sheet · desktop: corner popover */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[300px] max-w-[92vw] sm:absolute sm:left-auto sm:right-0 sm:top-[44px] sm:translate-x-0 sm:translate-y-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-4 text-left">
            <div className="text-sm font-semibold text-[var(--text-strong)] mb-0.5">Public application form</div>
            <div className="text-xs text-[var(--muted)] mb-3">Anyone can apply — no login needed.</div>
            <div className="flex gap-2 mb-3">
              <input readOnly value={url} onFocus={e => e.currentTarget.select()}
                className="flex-1 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] rounded-lg px-2 py-1.5 text-xs min-w-0" />
              <button onClick={copy} className="bg-[var(--gold)] text-[var(--on-gold)] text-xs font-semibold px-3 rounded-lg flex-shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div className="grid place-items-center bg-[var(--raise)] rounded-lg p-3">
              <img alt="QR code to the application form" width={160} height={160}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(url)}`} />
            </div>
            <div className="text-[11px] text-[var(--faint)] text-center mt-2">Scan to open the form</div>
          </div>
        </>
      )}
    </div>
  )
}
