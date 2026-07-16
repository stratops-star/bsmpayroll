'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useRecruitingLang } from '@/components/recruiting-i18n'

const TABS: [string, string][] = [
  ['tab_queue', '/recruiting'],
  ['tab_virtual', '/recruiting/virtual'],
  ['tab_inperson', '/recruiting/inperson'],
  ['tab_pool', '/recruiting/pool'],
  ['tab_requests', '/recruiting/requests'],
  ['tab_offers', '/recruiting/offers'],
  ['tab_rejected', '/recruiting/rejected'],
]

export default function RecruitingTabs(_props: { newCount?: number } = {}) {
  const path = usePathname()
  const { t } = useRecruitingLang()
  const [supabase] = useState(() => createClient())
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    (async () => {
      const cand = () => supabase.from('candidates').select('id', { count: 'exact', head: true })
      const [q, v, ip, rq, of] = await Promise.all([
        cand().eq('status', 'applied'),
        cand().eq('status', 'interview').neq('stage', '2nd_interview'),
        cand().eq('status', 'interview').eq('stage', '2nd_interview'),
        supabase.from('man_power_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        cand().eq('onboarding_status', 'offer_pending'),
      ])
      setCounts({
        tab_queue: q.count ?? 0,
        tab_virtual: v.count ?? 0,
        tab_inperson: ip.count ?? 0,
        tab_requests: rq.count ?? 0,
        tab_offers: of.count ?? 0,
      })
    })()
  }, [path])

  const isActive = (h: string) => h === '/recruiting' ? path === '/recruiting' : (path?.startsWith(h) ?? false)

  return (
    <div className="flex gap-1 border-b-2 border-gray-200 mb-5 overflow-x-auto flex-wrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {TABS.map(([key, href]) => {
        const on = isActive(href)
        const n = counts[key]
        return (
          <a key={href} href={href}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-0.5 flex items-center gap-1.5 whitespace-nowrap ${on ? 'text-[#0D1B35] border-[#D4A843]' : 'text-gray-500 border-transparent hover:text-[#0D1B35]'}`}>
            {t(key)}
            {n != null && n > 0 && <span className={`text-[11px] font-bold rounded-full px-1.5 ${on ? 'bg-[#D4A843] text-[#0D1B35]' : 'bg-gray-200 text-gray-600'}`}>{n}</span>}
          </a>
        )
      })}
    </div>
  )
}
