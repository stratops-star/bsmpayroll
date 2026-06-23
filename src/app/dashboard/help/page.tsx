'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { id:'overview', title:'Overview', body:'The BSM Payroll Dashboard pulls porter cover, extra hours, and billable hours data from three Google Sheets (Tier 1, Tier 2, Tier 3), lets you review and approve entries, and exports a single Fingercheck-formatted CSV. It automatically posts comments and completes Asana tasks on approval.' },
  { id:'login', title:'Logging in', body:'Go to bsm-payroll.vercel.app. Sign in with your @bsmfacilitysolutions.com Google account or email and password. The dashboard auto-loads the current pay period immediately after login.' },
  { id:'loading', title:'Loading entries', body:'The app auto-loads the current pay period (Wed → Tue) on login. Change dates and click Load to view a different period. Click the ↻ icon in the nav to refresh at any time. Hover over ↻ to see last refresh time.' },
  { id:'tiers', title:'Tier tabs', body:'Three tiers — Tier 1, Tier 2, Tier 3 — each reading from separate Google Sheet tabs. Click any tier tab or mini dashboard card to switch. Each tier has tabs: Approved, Pending, Waiting ⚡, Billing, Errors, Closed, Exported.' },
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
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#0D1B35] h-[48px] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#D4A843] flex items-center justify-center font-bold text-[#0D1B35] text-xs">B</div>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-white/50 text-xs">Tutorial & Help guide</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-white/55 text-xs hover:text-white">← Dashboard</button>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">BSM Payroll — Tutorial & Help</h1>
          <p className="text-sm text-gray-500 mt-1">Complete guide to using the payroll dashboard</p>
        </div>
        <div className="grid grid-cols-[200px_1fr] gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit sticky top-6">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Sections</div>
            <nav className="space-y-1">
              {STEPS.map(s => (
                <a key={s.id} href={`#${s.id}`} className="block text-xs text-gray-600 hover:text-[#0D1B35] py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">{s.title}</a>
              ))}
            </nav>
          </div>
          <div className="space-y-4">
            {STEPS.map(s => (
              <div key={s.id} id={s.id} className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-2 pb-2 border-b border-gray-100">{s.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
            <div className="bg-white border border-[#D4A843]/30 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Video walkthrough script</h2>
              <div className="space-y-3">
                {[
                  ['0:00','Hi, this is the BSM Payroll Dashboard — how we process porter cover entries and extra hours for Fingercheck payroll each week.'],
                  ['0:20','The current pay period loads automatically on login. You can see all three tiers and how many entries are in each.'],
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
          </div>
        </div>
      </main>
    </div>
  )
}
