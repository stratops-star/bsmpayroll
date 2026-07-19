'use client'

import { useRecruitingLang } from '@/components/recruiting-i18n'
import { useRecruitingChrome } from '@/components/RecruitingChrome'

// Right-side content for BsmHeader inside the recruiting module:
// the EN/ES language toggle plus any page-injected actions (Share, etc.)
export default function RecruitingHeaderActions() {
  const { lang, setLang } = useRecruitingLang()
  const chrome = useRecruitingChrome()
  return (
    <div className="flex items-center gap-3">
      {chrome.actions && <div className="flex items-center gap-2">{chrome.actions}</div>}
      <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
        {(['en', 'es'] as const).map(l => (
          <button key={l} onClick={() => setLang(l)}
            className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${lang === l ? 'bg-[#DCB878] text-[#1E1B17]' : 'text-white/60 hover:text-white'}`}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
