'use client'

import { useEffect, useRef, useState } from 'react'

export function SearchSelect({ value, onChange, options, placeholder = 'Select…', searchLabel = 'Search…' }: {
  value: string | null | undefined
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  searchLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setQ('') }}
        className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white flex items-center justify-between gap-2">
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>{value || placeholder}</span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={searchLabel}
            className="px-3 py-2 text-sm border-b border-gray-100 outline-none" />
          <div className="overflow-auto">
            {value && <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50">— Clear —</button>}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No matches</div>}
            {filtered.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${o === value ? 'bg-[#0D1B35]/5 font-medium text-[#0D1B35]' : 'text-gray-700'}`}>{o}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Time-in-USA as Years + Months. Stores/reads a string like "2 years 3 months".
export function YearsMonths({ value, onSave, yearsLabel = 'Years', monthsLabel = 'Months' }: {
  value: string | null | undefined
  onSave: (v: string) => void
  yearsLabel?: string
  monthsLabel?: string
}) {
  const parse = (s: string | null | undefined) => {
    if (!s) return { y: '', m: '' }
    const y = s.match(/(\d+)\s*(year|año|yr|y)/i)?.[1] ?? ''
    const m = s.match(/(\d+)\s*(month|mes|mo|m)/i)?.[1] ?? ''
    if (!y && !m) { const n = s.match(/\d+/)?.[0] ?? ''; return { y: n, m: '' } }
    return { y, m }
  }
  const init = parse(value)
  const [y, setY] = useState(init.y)
  const [m, setM] = useState(init.m)

  function commit(ny: string, nm: string) {
    const parts: string[] = []
    if (ny) parts.push(`${ny} year${ny === '1' ? '' : 's'}`)
    if (nm) parts.push(`${nm} month${nm === '1' ? '' : 's'}`)
    onSave(parts.join(' '))
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div><div className="text-[11px] text-gray-500 mb-0.5">{yearsLabel}</div><input type="number" min="0" value={y} onChange={e => setY(e.target.value)} onBlur={() => commit(y, m)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" /></div>
      <div><div className="text-[11px] text-gray-500 mb-0.5">{monthsLabel}</div><input type="number" min="0" max="11" value={m} onChange={e => setM(e.target.value)} onBlur={() => commit(y, m)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" /></div>
    </div>
  )
}
