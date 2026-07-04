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
      <button onClick={() => setOpen(o => !o)}
        className="text-sm bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg px-3 py-1.5 flex items-center gap-2 whitespace-nowrap">
        🔗 Share application link
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[44px] z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-72 text-left">
            <div className="text-sm font-semibold text-[#0D1B35] mb-0.5">Public application form</div>
            <div className="text-xs text-gray-500 mb-3">Anyone can apply — no login needed.</div>
            <div className="flex gap-2 mb-3">
              <input readOnly value={url} onFocus={e => e.currentTarget.select()}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 min-w-0" />
              <button onClick={copy} className="bg-[#0D1B35] text-white text-xs font-semibold px-3 rounded-lg flex-shrink-0">{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div className="grid place-items-center bg-[#F5F6FA] rounded-lg p-3">
              <img alt="QR code to the application form" width={160} height={160}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(url)}`} />
            </div>
            <div className="text-[11px] text-gray-400 text-center mt-2">Scan to open the form</div>
          </div>
        </>
      )}
    </div>
  )
}
