'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { Lang } from '@/lib/i18n'

const STEPS = [
  { id:'overview', title:'Overview', body:'The BSM Payroll Dashboard pulls porter cover, extra hours, and billable hours data from three Google Sheets (Tier 1, Tier 2, Tier 3), lets you review and approve entries, and exports a single Fingercheck-formatted CSV. It automatically posts comments and completes Asana tasks on approval.' },
  { id:'login', title:'Logging in', body:'Go to bsm-payroll.vercel.app. Sign in with your @bsmfacilitysolutions.com Google account or email and password. The dashboard auto-loads the current pay period immediately after login.' },
  { id:'loading', title:'Loading entries', body:'The app auto-loads the current pay period (Wed → Tue) on login. Change dates and click Load to view a different period. Click the ↻ icon in the nav to refresh at any time. Hover over ↻ to see last refresh time.' },
  { id:'tiers', title:'Tier tabs', body:'Three tiers — Tier 1, Tier 2, Tier 3 — each reading from separate Google Sheet tabs. Click any mini dashboard card to switch tiers. Each tier has tabs: Approved, Pending, Waiting ⚡, Billing, Errors, Closed, Exported.' },
  { id:'errors', title:'Errors tab', body:'Any entry missing a job code, Asana link, or rate appears in the Errors tab with a red badge. The Approve button is blocked (🚫) until all issues are fixed. Enter the rate in the accordion row and it moves out automatically.' },
  { id:'approving', title:'Approving entries', body:'Find an entry in Pending or Waiting ⚡. Click the row to expand the accordion. Enter the rate. Click ✓ Approve. The app posts "entered — [dates]" on the Asana task AND marks it complete. Rate, job code, and Asana link are all required.' },
  { id:'billing', title:'Billable entries', body:'Entries with type "BILLABLE EXTRA HOURS" route to the Billing tab automatically. Click ✓ Bill to approve them for billing records. These are tracked separately from regular cover entries.' },
  { id:'closing', title:'Closing entries', body:'Click Close on any entry to exclude it from export. Enter a reason. Closed entries stay in the Closed tab permanently. Use ↩ Reopen within 14 days of approval. After 14 days entries are locked (🔒) and cannot be reopened.' },
  { id:'exporting', title:'Exporting to Fingercheck', body:'Click Export approved. Review the T1+T2+T3 totals. Click Download CSV. Upload to Fingercheck via mass import. After export: entries move to Exported tab, Asana tasks get "entered" comment and are marked complete, a frozen snapshot saves to history.' },
  { id:'history', title:'Exported Files', body:'Click Exported Files in the nav to see every past Fingercheck CSV. Re-download any file — the snapshot is frozen, sheet edits after export do not affect records.' },
  { id:'past', title:'Past Tasks', body:'Click Past Tasks in the nav. Enter any employee number or name to see every pay period they appeared in, with hours, rate, job code, and export file. Read only.' },
  { id:'banners', title:'Reminders & banners', body:'Blue banner = upcoming federal holiday pay (7 days before). Amber banner = SVPTO reminder (7 days before end of month). Amber banner = 1st & 15th Rule reminder (7 days before). All dismissible with ✕.' },
  { id:'language', title:'Language switcher', body:'Click EN / ES / יי in the nav bar to switch between English, Spanish, and Yiddish. Your preference is saved automatically. Yiddish switches the layout to right-to-left.' },
  { id:'rules', title:'Payroll Rules', body:'Click Payroll Rules in the nav to access the full BSM Payroll Specialist Training Manual v1.0, covering overtime rules, prevailing wage, holiday pay, cover pay rates, and more. Add personal notes at the bottom — they save automatically to your account.' },
]

export default function HelpPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('bsm_lang') as Lang) || 'en'
    return 'en'
  })
  function switchLang(l: Lang) { setLang(l); localStorage.setItem('bsm_lang', l) }

  const filtered = STEPS.filter(s =>
    !search.trim() ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.body.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang={lang} onLangChange={switchLang} />
      <main className="max-w-4xl mx-auto px-5 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">BSM Payroll — Tutorial & Help</h1>
          <p className="text-sm text-gray-500 mt-1">Complete guide to using the payroll dashboard</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search the guide… (e.g. approve, export, holiday, rate)"
            className="flex-1 border-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕ Clear</button>}
          {search && <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit md:sticky top-6">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Sections</div>
            <nav className="space-y-1">
              {STEPS.map(s => (
                <a key={s.id} href={`#${s.id}`}
                  className={`block text-xs py-1.5 px-2 rounded-lg transition-colors ${
                    search && (s.title.toLowerCase().includes(search.toLowerCase()) || s.body.toLowerCase().includes(search.toLowerCase()))
                      ? 'text-[#D4A843] font-medium bg-amber-50'
                      : 'text-gray-600 hover:text-[#0D1B35] hover:bg-gray-50'
                  }`}>{s.title}
                </a>
              ))}
            </nav>
          </div>
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm text-gray-500">No results for "{search}"</div>
                <button onClick={() => setSearch('')} className="text-xs text-[#D4A843] mt-2 hover:underline">Clear search</button>
              </div>
            ) : filtered.map(s => (
              <div key={s.id} id={s.id} className={`bg-white border rounded-xl p-6 ${
                search && (s.title.toLowerCase().includes(search.toLowerCase()) || s.body.toLowerCase().includes(search.toLowerCase()))
                  ? 'border-[#D4A843]/40 bg-amber-50/20' : 'border-gray-200'}`}>
                <h2 className="text-sm font-semibold text-gray-900 mb-2 pb-2 border-b border-gray-100">{s.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
            {!search && (
              <div className="bg-white border border-[#D4A843]/30 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Video walkthrough script</h2>
                <div className="space-y-3">
                  {[
                    ['0:00','Hi, this is the BSM Payroll Dashboard — how we process porter cover entries and extra hours for Fingercheck payroll each week.'],
                    ['0:20','The current pay period loads automatically on login. You can see all three tiers and how many entries are in each mini dashboard card.'],
                    ['0:40','Check the Errors tab first. Any entry with a missing job code, Asana link, or rate is blocked here. Enter the rate in the accordion row and it moves to Pending automatically.'],
                    ['1:00','In the Waiting ⚡ tab you\'ll find last-minute submissions — within 24 hours of the Tuesday cutoff. Review these urgently.'],
                    ['1:20','To approve: click the row to expand, enter the rate, then click Approve. The app posts "entered" on Asana and marks the task complete.'],
                    ['1:40','Billable entries go to the Billing tab automatically. Click Bill to approve them for billing records.'],
                    ['2:00','To close: click Close, enter a reason, confirm. You can reopen within 14 days. After that it\'s locked 🔒.'],
                    ['2:20','Click Export approved, review T1+T2+T3 totals, download CSV, upload to Fingercheck mass import.'],
                    ['2:50','Check Exported Files for all past exports. Use Past Tasks to search any employee\'s full payroll history.'],
                    ['3:10','Watch for banners — blue for upcoming holiday pay, amber for SVPTO and 1st & 15th reminders. Switch languages with EN / ES / יי in the nav.'],
                  ].map(([time, text]) => (
                    <div key={time} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs text-[#C9943A] flex-shrink-0 mt-0.5 w-12">{time}</span>
                      <p className="text-gray-700 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
