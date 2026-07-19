'use client'

import { useRecruitingLang } from '@/components/recruiting-i18n'
import { useRecruitingChrome } from '@/components/RecruitingChrome'

// Right-side content for BsmHeader inside recruiting.
// Desktop: inline (page actions + EN/ES). Mobile: stacks as rows inside the header gear menu.
export default function RecruitingHeaderActions() {
  const { lang, setLang } = useRecruitingLang()
  const chrome = useRecruitingChrome()
  const seg = (
    <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
      {(['en', 'es'] as const).map(l => (
        <button key={l} onClick={() => setLang(l)}
          className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${lang === l ? 'bg-[#DCB878] text-[#1E1B17]' : 'text-white/60 hover:text-white'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
  return (
    <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-3">
      {chrome.actions && <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2">{chrome.actions}</div>}
      {/* desktop: bare segmented toggle */}
      <div className="hidden sm:block">{seg}</div>
      {/* mobile: a Language row inside the gear */}
      <div className="flex sm:hidden items-center justify-between px-3 py-2 rounded-lg">
        <span className="text-sm text-white/60">Language</span>
        {seg}
      </div>
    </div>
  )
}
