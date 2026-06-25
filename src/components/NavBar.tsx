'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Lang, t, TRANSLATIONS } from '@/lib/i18n'

interface NavBarProps {
  lang: Lang
  onLangChange: (l: Lang) => void
  userEmail?: string
  lastRefreshed?: string
  onRefresh?: () => void
  loading?: boolean
  exportCount?: number
  onRelaunchTour?: () => void
}

export default function NavBar({ lang, onLangChange, userEmail, lastRefreshed, onRefresh, loading, exportCount, onRelaunchTour }: NavBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const dir = TRANSLATIONS[lang].dir

  const isDashboard = pathname === '/dashboard'

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { label: t(lang, 'nav_past_tasks'),     href: '/dashboard/past-tasks', badge: 0 },
    { label: t(lang, 'nav_exported_files'), href: '/dashboard/history',    badge: exportCount && exportCount > 0 ? exportCount : 0 },
    { label: t(lang, 'nav_payroll_rules'),  href: '/dashboard/rules',      badge: 0 },
    { label: 'Asana Issues',                href: '/dashboard/asana-issues', badge: 0 },
  ]

  return (
    <header className="bg-[#0D1B35] h-[48px] px-4 flex items-center justify-between gap-3 relative z-50" dir={dir}>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.push('/dashboard')}
          className="w-7 h-7 rounded-lg bg-[#D4A843] flex items-center justify-center font-bold text-[#0D1B35] text-xs flex-shrink-0"
          title="Go to dashboard">B</button>
        <div className="w-px h-4 bg-white/15 hidden sm:block" />
        {isDashboard ? (
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
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
          {(['en','es','yi'] as Lang[]).map(l => (
            <button key={l} onClick={() => onLangChange(l)}
              className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${lang === l ? 'bg-[#D4A843] text-[#0D1B35]' : 'text-white/60 hover:text-white'}`}>
              {l === 'en' ? 'EN' : l === 'es' ? 'ES' : 'יי'}
            </button>
          ))}
        </div>

        {onRefresh && (
          <div className="relative group">
            <button onClick={onRefresh} disabled={loading}
              className="w-7 h-7 rounded-md border border-white/10 bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors disabled:opacity-40">
              <svg className={loading ? 'animate-spin' : ''} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            </button>
            {lastRefreshed && (
              <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {t(lang, 'nav_last_refreshed')}: {lastRefreshed}
              </div>
            )}
          </div>
        )}

        {links.map(link => (
          <button key={link.href} onClick={() => router.push(link.href)}
            className={`text-xs transition-colors flex items-center gap-1.5 ${pathname === link.href ? 'text-[#D4A843]' : 'text-white/55 hover:text-white'}`}>
            {link.label}
            {link.badge > 0 && (
              <span className="bg-[#D4A843] text-[#0D1B35] text-xs font-semibold px-1.5 py-0.5 rounded">{link.badge}</span>
            )}
          </button>
        ))}

        {/* Tutorial + Relaunch Tour */}
        <button onClick={() => router.push('/dashboard/help')}
          className={`text-xs transition-colors ${pathname === '/dashboard/help' ? 'text-[#D4A843]' : 'text-white/55 hover:text-white'}`}>
          {t(lang, 'nav_tutorial')}
        </button>
        {onRelaunchTour && isDashboard && (
          <button onClick={onRelaunchTour}
            className="text-xs text-white/40 hover:text-[#D4A843] transition-colors border border-white/10 px-2 py-0.5 rounded-md"
            title="Relaunch tutorial tour">
            ▶ Tour
          </button>
        )}

        <div className="w-px h-4 bg-white/15" />
        <span className="text-white/35 text-xs truncate max-w-[120px]">{userEmail}</span>
        <button onClick={signOut} className="text-white/35 text-xs hover:text-white transition-colors">{t(lang, 'nav_signout')}</button>
      </div>

      {/* Mobile: lang + hamburger */}
      <div className="flex md:hidden items-center gap-2">
        <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
          {(['en','es','yi'] as Lang[]).map(l => (
            <button key={l} onClick={() => onLangChange(l)}
              className={`text-xs px-1.5 py-0.5 rounded-md transition-colors font-medium ${lang === l ? 'bg-[#D4A843] text-[#0D1B35]' : 'text-white/60 hover:text-white'}`}>
              {l === 'en' ? 'EN' : l === 'es' ? 'ES' : 'יי'}
            </button>
          ))}
        </div>
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
            {!isDashboard && (
              <button onClick={() => { router.push('/dashboard'); setMenuOpen(false) }}
                className="w-full text-left text-sm text-white/70 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3">
                ← {t(lang, 'nav_dashboard')}
              </button>
            )}
            {onRefresh && (
              <button onClick={() => { onRefresh(); setMenuOpen(false) }}
                className="w-full text-left text-sm text-white/70 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3">
                <svg className={loading ? 'animate-spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                {t(lang, 'nav_refresh')}
                {lastRefreshed && <span className="text-white/35 text-xs ml-auto">{lastRefreshed}</span>}
              </button>
            )}
            {links.map(link => (
              <button key={link.href} onClick={() => { router.push(link.href); setMenuOpen(false) }}
                className={`w-full text-left text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3 ${pathname === link.href ? 'text-[#D4A843]' : 'text-white/70 hover:text-white'}`}>
                {link.label}
                {link.badge > 0 && (
                  <span className="bg-[#D4A843] text-[#0D1B35] text-xs font-semibold px-1.5 py-0.5 rounded ml-auto">{link.badge}</span>
                )}
              </button>
            ))}
            <button onClick={() => { router.push('/dashboard/help'); setMenuOpen(false) }}
              className={`w-full text-left text-sm py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors ${pathname === '/dashboard/help' ? 'text-[#D4A843]' : 'text-white/70 hover:text-white'}`}>
              {t(lang, 'nav_tutorial')}
            </button>
            {onRelaunchTour && isDashboard && (
              <button onClick={() => { onRelaunchTour(); setMenuOpen(false) }}
                className="w-full text-left text-sm text-white/70 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-3">
                ▶ Relaunch Tour
              </button>
            )}
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="text-white/35 text-xs px-3 py-1 truncate">{userEmail}</div>
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
