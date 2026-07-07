'use client'

import { useState } from 'react'

export default function ShareManpower() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/manpower/new` : '/manpower/new'

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="text-sm bg-white/10 hover:bg-white/20 text-white border border-white/15 font-medium rounded-lg px-3 py-1.5 whitespace-nowrap flex items-center gap-1.5">🔗 Share request form</button>
      {open && (
        <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-72">
          <div className="text-xs font-semibold text-gray-500 mb-2">Managers sign in with their email to submit</div>
          <div className="flex items-center gap-2 mb-3">
            <input readOnly value={url} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600" />
            <button onClick={copy} className="text-xs font-semibold bg-[#0D1B35] text-white rounded-lg px-2.5 py-1.5">{copied ? '✓' : 'Copy'}</button>
          </div>
          <img alt="QR" className="w-full rounded-lg border border-gray-100" src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`} />
        </div>
      )}
    </div>
  )
}
