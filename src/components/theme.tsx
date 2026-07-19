'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
const Ctx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: 'dark', toggle: () => {}, setTheme: () => {},
})

// Runs BEFORE React hydrates, in <head>, so there's no light-flash on load.
// Default is dark unless the user has chosen otherwise.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('bsm-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('bsm-theme')) as Theme | null
    const initial: Theme = saved === 'light' || saved === 'dark' ? saved : 'dark'
    setThemeState(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    try { localStorage.setItem('bsm-theme', t) } catch {}
  }
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)

// Sun/moon toggle for the header. Sits next to the EN/ES switch.
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} title={dark ? 'Switch to light' : 'Switch to dark'} aria-label="Toggle theme"
      style={{
        width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.08)',
        border: '1px solid rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', cursor: 'pointer',
      }}>
      {dark ? (
        // moon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DCB878" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : (
        // sun
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DCB878" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
    </button>
  )
}
