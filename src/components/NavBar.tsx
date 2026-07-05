'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Lang, t, TRANSLATIONS } from '@/lib/i18n'
import { useRecruitingChrome } from '@/components/RecruitingChrome'
import { useRecruitingLang } from '@/components/recruiting-i18n'

interface NavBarProps {
  lang?: Lang
  onLangChange?: (l: Lang) => void
  userEmail?: string
  lastRefreshed?: string
  onRefresh?: () => void
  loading?: boolean
  exportCount?: number
  onRelaunchTour?: () => void
  syncing?: boolean
}

type Mod = { label: string; href: string }
const MODULE_MAP: Record<string, Mod> = {
  payroll: { label: 'Payroll', href: '/dashboard' },
  recruiting: { label: 'Recruiting', href: '/recruiting' },
}

export default function NavBar({ lang = 'en', onLangChange, userEmail, lastRefreshed, onRefresh, loading, exportCount, onRelaunchTour, syncing }: NavBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const chrome = useRecruitingChrome()
  const recLang = useRecruitingLang()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const dir = TRANSLATIONS[lang].dir

  const isRecruiting = !!pathname && pathname.startsWith('/recruiting')
  const isDashboard = pathname === '/dashboard'
  const showLang = !!onLangChange && !isRecruiting

  const [email, setEmail] = useState(userEmail || '')

  // ── Module switcher ───────────────────────────────────────────────
  const [switcherMods, setSwitcherMods] = useState<Mod[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (!userEmail && user.email) setEmail(user.email)
      const { data: me } = await supabase.from('app_users').select('role, departments, active').eq('id', user.id).single()
      if (!me?.active) return
      const admin = me.role === 'admin'
      setIsAdmin(admin)
      setSwitcherMods((me.departments || []).map((d: string) => MODULE_MAP[d]).filter(Boolean))
    })()
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) { if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const canSwitch = switcherMods.length > 1 || isAdmin
  const homeHref = isRecruiting ? '/recruiting' : '/dashboard'

  async function signOut() { await supabase.auth.signOut(); router.push('/login') }

  const links = [
    { label: t(lang, 'nav_past_tasks'),     href: '/dashboard/past-tasks', badge: 0 },
    { label: t(lang, 'nav_exported_files'), href: '/dashboard/history',    badge: exportCount && exportCount > 0 ? exportCount : 0 },
    { label: t(lang, 'nav_payroll_rules'),  href: '/dashboard/rules',      badge: 0 },
  ]

  return (
    <header className="bg-[#0D1B35] h-[48px] px-4 flex items-center justify-between gap-3 relative z-50" dir={dir}>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => canSwitch ? setSwitcherOpen(o => !o) : router.push(homeHref)}
            className="w-7 h-7 rounded-lg bg-[#D4A843] flex items-center justify-center font-bold text-[#0D1B35] text-xs flex-shrink-0"
            title={canSwitch ? 'Switch module' : 'Home'}>
            B
          </button>

          {canSwitch && switcherOpen && (
            <div className="absolute top-[38px] left-0 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 w-52 z-[60]">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Switch workspace</div>
              {switcherMods.map(m => (
                <button key={m.href} onClick={() => { setSwitcherOpen(false); router.push(m.href) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4A843]" /> {m.label}
                </button>
              ))}
              {isAdmin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setSwitcherOpen(false); router.push('/recruiting/admin') }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <span>🛡️</span> User Access
                  </button>
                  <button onClick={() => { setSwitcherOpen(false); router.push('/hub') }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50">
                    Open full hub →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-white/15 hidden sm:block" />
        {isRecruiting ? (
          <span className="text-white/50 text-xs hidden sm:block">Recruiting</span>
        ) : isDashboard ? (
          <span className="text-white/50 text-xs hidden sm:block">{t(lang, 'nav_dashboard')}</span>
        ) : (
          <button onClick={() => router.push('/dashboard')}
            className="text-white/60 text-xs hover:text-white transition-colors hidden sm:flex items-center gap-1">
            ← {t(lang, 'nav_dashboard')}
          </button>
        )}
      </div>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-3">
        {showLang && (
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            {(['en','es','yi'] as Lang[]).map(l => (
              <button key={l} onClick={() => onLangChange!(l)}
                className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${lang === l ? 'bg-[#D4A843] text-[#0D1B35]' : 'text-white/60 hover:text-white'}`}>
                {l === 'en' ? 'EN' : l === 'es' ? 'ES' : 'יי'}
              </button>
            ))}
          </div>
        )}

        {!isRecruiting && links.map(link => (
          <button key={link.href} onClick={() => router.push(link.href)}
            className={`text-xs transition-colors flex items-center gap-1.5 ${pathname === link.href ? 'text-[#D4A843]' : 'text-white/55 hover:text-white'}`}>
            {link.label}
            {link.badge > 0 && <span className="bg-[#D4A843] text-[#0D1B35] text-xs font-semibold px-1.5 py-0.5 rounded">{link.badge}</span>}
          </button>
        ))}

        {!isRecruiting && (
          <button onClick={() => router.push('/dashboard/help')}
            className={`text-xs transition-colors ${pathname === '/dashboard/help' ? 'text-[#D4A843]' : 'text-white/55 hover:text-white'}`}>
            {t(lang, 'nav_tutorial')}
          </button>
        )}
        {onRelaunchTour && isDashboard && (
          <button onClick={onRelaunchTour}
            className="text-xs text-white/40 hover:text-[#D4A843] transition-colors border border-white/10 px-2 py-0.5 rounded-md"
            title="Relaunch tutorial tour">
            ▶ Tour
          </button>
        )}

        {isRecruiting && (
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            {(['en', 'es'] as const).map(l => (
              <button key={l} onClick={() => recLang.setLang(l)}
                className={`text-xs px-2 py-1 rounded-md font-medium ${recLang.lang === l ? 'bg-[#D4A843] text-[#0D1B35]' : 'text-white/60 hover:text-white'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {isRecruiting && chrome.actions && (
          <div className="flex items-center gap-2">{chrome.actions}</div>
        )}

        <div className="w-px h-4 bg-white/15" />
        <span className="text-white/35 text-xs truncate max-w-[130px]">{email}</span>
        <button onClick={signOut} className="text-white/35 text-xs hover:text-white transition-colors">{t(lang, 'nav_signout')}</button>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center gap-2">
        {showLang && (
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
            {(['en','es','yi'] as Lang[]).map(l => (
              <button key={l} onClick={() => onLangChange!(l)}
                className={`text-xs px-1.5 py-0.5 rounded-md transition-colors font-medium ${lang === l ? 'bg-[#D4A843] text-[#0D1B35]' : 'text-white/60 hover:text-white'}`}>
                {l === 'en' ? 'EN' : l === 'es' ? 'ES' : 'יי'}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="w-8 h-8 rounded-md border border-white/10 bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors">
          {menuOpen
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-[48px] left-0 right-0 bg-[#0D1B35] border-t border-white/10 shadow-xl md:hidden z-50" dir={dir}>
          <div className="px-4 py-3 space-y-1">
            {canSwitch && (
              <div className="border-b border-white/10 pb-2 mb-2">
                <div className="text-white/35 text-xs px-3 py-1">Switch workspace</div>
                {switcherMods.map(m => (
                  <button key={m.href} onClick={() => { router.push(m.href); setMenuOpen(false) }}
                    className="w-full text-left text-sm text-white/70 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4A843]" /> {m.label}
                  </button>
                ))}
                {isAdmin && (
                  <button onClick={() => { router.push('/recruiting/admin'); setMenuOpen(false) }}
                    className="w-full text-left text-sm text-white/70 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3">
                    🛡️ User Access
                  </button>
                )}
              </div>
            )}
            {!isRecruiting && !isDashboard && (
              <button onClick={() => { router.push('/dashboard'); setMenuOpen(false) }}
                className="w-full text-left text-sm text-white/70 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3">
                ← {t(lang, 'nav_dashboard')}
              </button>
            )}
            {!isRecruiting && links.map(link => (
              <button key={link.href} onClick={() => { router.push(link.href); setMenuOpen(false) }}
                className={`w-full text-left text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3 ${pathname === link.href ? 'text-[#D4A843]' : 'text-white/70 hover:text-white'}`}>
                {link.label}
                {link.badge > 0 && <span className="bg-[#D4A843] text-[#0D1B35] text-xs font-semibold px-1.5 py-0.5 rounded ml-auto">{link.badge}</span>}
              </button>
            ))}
            {!isRecruiting && (
              <button onClick={() => { router.push('/dashboard/help'); setMenuOpen(false) }}
                className={`w-full text-left text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors ${pathname === '/dashboard/help' ? 'text-[#D4A843]' : 'text-white/70 hover:text-white'}`}>
                {t(lang, 'nav_tutorial')}
              </button>
            )}
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="text-white/35 text-xs px-3 py-1 truncate">{email}</div>
              <button onClick={() => { signOut(); setMenuOpen(false) }}
                className="w-full text-left text-sm text-white/50 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors">
                {t(lang, 'nav_signout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
