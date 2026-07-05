'use client'

import { usePathname } from 'next/navigation'

const TABS: [string, string][] = [
  ['New Queue', '/recruiting'],
  ['Interview', '/recruiting/interview'],
  ['Candidate Pool', '/recruiting/pool'],
  ['Rejected', '/recruiting/rejected'],
]

export default function RecruitingTabs({ newCount = 0 }: { newCount?: number }) {
  const path = usePathname()
  const isActive = (h: string) => h === '/recruiting' ? path === '/recruiting' : (path?.startsWith(h) ?? false)
  return (
    <div className="flex gap-1 border-b-2 border-gray-200 mb-5 overflow-x-auto">
      {TABS.map(([label, href]) => {
        const on = isActive(href)
        return (
          <a key={href} href={href}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-0.5 flex items-center gap-1.5 whitespace-nowrap ${on ? 'text-[#0D1B35] border-[#D4A843]' : 'text-gray-500 border-transparent hover:text-[#0D1B35]'}`}>
            {label}
            {label === 'New Queue' && newCount > 0 && <span className="bg-[#D4A843] text-[#0D1B35] text-[11px] font-bold rounded-full px-1.5">{newCount}</span>}
          </a>
        )
      })}
    </div>
  )
}
