'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { Lang } from '@/lib/i18n'

const STEPS = [
  {
    id: 'overview',
    title: 'Overview',
    body: 'The BSM Payroll Dashboard pulls porter cover, extra hours, and billable hours from three Google Sheets (Tier 1, Tier 2, Tier 3). It routes each entry to the correct tab based on Asana task assignment, lets you review and approve entries, and exports a Fingercheck-formatted CSV. It also shows General Issues and Terminations from Asana for full operational visibility.',
  },
  {
    id: 'login',
    title: 'Logging in',
    body: 'Go to bsmfacilitysolutions.app. Sign in with your @bsmfacilitysolutions.com Google account or email and password. The dashboard auto-syncs Asana and loads the current pay period immediately after login.',
  },
  {
    id: 'loading',
    title: 'Loading entries',
    body: 'The app auto-loads the current pay period (Wed → Tue) on login. On every load, it syncs fresh data from Google Sheets and Asana. Change dates and click Load to view a different period. Click ↻ in the nav to refresh at any time.',
  },
  {
    id: 'tab-routing',
    title: 'Tab Priority System',
    body: 'Every entry is routed to exactly ONE tab based on a priority system:\n\n1. Errors — missing rate, job code, or Asana link. Cannot be approved.\n2. Billing — Asana task assigned to billing team (Rebecca, Anthony, Leah, Ella, Office, Abe).\n3. Waiting ⚡ — Asana task assigned to a manager or staff member.\n4. Pending — Asana task has no assignee yet.\n\nAn entry only ever appears in one tab. Fix errors first, then work through billing and waiting.',
  },
  {
    id: 'errors',
    title: 'Errors Tab',
    body: 'Entries missing a job code, Asana link, or rate appear here with a red badge. The Approve button is blocked (🚫) until all issues are fixed. Enter the rate in the accordion row and it moves out automatically. Errors take priority over all other tabs — always check Errors first.',
  },
  {
    id: 'billing',
    title: 'Billing Tab',
    body: 'Entries whose Asana task is assigned to the billing team route here automatically. This includes all Billable Extra Hours entries AND any Cover/Extra Hrs entries assigned to: Rebecca, Anthony (billing@), Leah, Ella, Office, or Abe. Click Approve to confirm hours — the Asana task is assigned to billing but NOT completed (billing team handles invoicing separately).',
  },
  {
    id: 'waiting',
    title: 'Waiting Tab ⚡',
    body: 'Entries whose Asana task is assigned to a manager or staff member (Albert Arana, Gissele Ruiz, Maria Jose, etc.) appear here. These need review before approval. The assignee\'s name and email show in the accordion row. Rate must be set before approving.',
  },
  {
    id: 'pending',
    title: 'Pending Tab',
    body: 'Entries with no Asana assignee appear here. These are typically new submissions that haven\'t been reviewed by anyone yet. Review the extra details, set the rate, and approve.',
  },
  {
    id: 'approving',
    title: 'Approving Entries',
    body: 'Click any row to expand the accordion. Enter the rate ($/hr). Click ✓ Approve. On approval: Cover entries → Asana task is marked complete + "entered" comment posted. Extra Hrs + Billable → Asana task assigned to billing team + "entered" comment posted. Rate, job code, and Asana link are all required.',
  },
  {
    id: 'general-issues',
    title: 'General Issues Tab',
    body: 'Shows open General Issues from Asana across all tiers (TIER#1, TIER#2, etc.). These are operational issues reported by managers — porter complaints, property issues, manager issues. They are informational only and are NEVER exported to Fingercheck. When resolved in Asana they move to Past Tasks → Closed/Voided.',
  },
  {
    id: 'terminations',
    title: 'Terminations Tab',
    body: 'Shows open Termination requests from Asana. Format: "Manager - Terminated - #ID - Employee Name - on Date". These are informational only and are NEVER exported to Fingercheck. When completed in Asana they move to Past Tasks → Closed/Voided.',
  },
  {
    id: 'closing',
    title: 'Closing Entries',
    body: 'Click Close on any Cover entry to exclude it from export. Enter a reason. Closed entries appear in the Closed tab. Use ↩ Reopen within 14 days. After 14 days entries are locked (🔒). If a task is completed in Asana manually, it auto-moves to Closed with "Closed in Asana" badge.',
  },
  {
    id: 'exporting',
    title: 'Exporting to Fingercheck',
    body: 'Click Export approved. Review T1+T2+T3 totals. Click Download CSV. Upload to Fingercheck via mass import. After export: entries move to Exported tab and a snapshot saves to history. Only Cover, Extra Hrs, and Billable entries are exported — never General Issues or Terminations.',
  },
  {
    id: 'past-tasks',
    title: 'Past Tasks',
    body: 'Click Past Tasks in the nav. Two tabs:\n\nExported — every entry sent to Fingercheck with hours, rate, job code, and export file.\n\nClosed / Voided — all closed payroll entries (manually closed or Asana-closed), plus completed General Issues and Terminations from Asana. Source badge shows "Dashboard" or "Asana".',
  },
  {
    id: 'banners',
    title: 'Reminders & Banners',
    body: 'Banners appear 7 days before key dates:\n🟡 SVPTO — end of month approaching\n💰 Prevailing Wages — remember to update all employees\n🟡 1st & 15th Rule — upcoming date reminder\n🔵 Federal Holiday — upcoming holiday pay\n\nAll dismissible with ✕. They reset each new month.',
  },
  {
    id: 'history',
    title: 'Exported Files',
    body: 'Click Exported Files in the nav to see every past Fingercheck CSV. Re-download any file — the snapshot is frozen, sheet edits after export do not affect records.',
  },
  {
    id: 'language',
    title: 'Language Switcher',
    body: 'Click EN / ES / יי in the nav to switch between English, Spanish, and Yiddish. Your preference is saved automatically. Yiddish switches the layout to right-to-left.',
  },
  {
    id: 'rules',
    title: 'Payroll Rules',
    body: 'Click Payroll Rules in the nav to access the full BSM Payroll Specialist Training Manual v1.0, covering overtime rules, prevailing wage, holiday pay, cover pay rates, and earnings codes. Add personal notes at the bottom — they save automatically to your account.',
  },
]

export default function HelpPage() {
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

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search the guide… (e.g. billing, waiting, approve, export)"
            className="flex-1 border-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕ Clear</button>}
          {search && <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          {/* Sidebar nav */}
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

          {/* Content */}
          <div className="space-y-4">
            {/* Tab routing summary card */}
            {!search && (
              <div className="bg-[#0D1B35] rounded-xl p-5 text-white">
                <h2 className="text-sm font-semibold mb-3">⚡ Tab Priority — Quick Reference</h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-red-300 font-semibold mb-1">① Errors</div>
                    <div className="text-white/70">Missing rate, job code, or Asana link</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-purple-300 font-semibold mb-1">② Billing</div>
                    <div className="text-white/70">Assigned to billing team in Asana</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-amber-300 font-semibold mb-1">③ Waiting ⚡</div>
                    <div className="text-white/70">Assigned to manager/staff in Asana</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-blue-300 font-semibold mb-1">④ Pending</div>
                    <div className="text-white/70">No Asana assignee yet</div>
                  </div>
                </div>
                <p className="text-white/50 text-xs mt-3">Each entry appears in ONE tab only. Fix Errors first.</p>
              </div>
            )}

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
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{s.body}</p>
              </div>
            ))}

            {/* Video walkthrough */}
            {!search && (
              <div className="bg-white border border-[#D4A843]/30 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Video walkthrough script</h2>
                <div className="space-y-3">
                  {[
                    ['0:00', 'This is the BSM Payroll Dashboard — how we process porter cover entries, extra hours, and billable hours for Fingercheck payroll each week.'],
                    ['0:20', 'On login, the dashboard syncs Asana and loads the current pay period. Every entry is routed to a tab based on its Asana task assignment.'],
                    ['0:40', 'Check Errors first — any entry missing rate, job code, or Asana link is blocked here. Enter the rate in the accordion and it moves out automatically.'],
                    ['1:00', 'Billing tab shows entries assigned to the billing team in Asana. Approve to confirm hours — the task stays open for billing to handle invoicing.'],
                    ['1:20', 'Waiting ⚡ shows entries assigned to managers or staff. Review the assignee in the accordion, set the rate, and approve.'],
                    ['1:40', 'Pending shows entries with no Asana assignee yet. These are new submissions. Review, set rate, approve.'],
                    ['2:00', 'General Issues and Terminations tabs show open Asana tasks across all tiers. Informational only — never exported to Fingercheck.'],
                    ['2:20', 'To approve: expand the row, enter rate, click Approve. Cover tasks complete in Asana. Extra Hrs/Billable tasks assign to billing team.'],
                    ['2:40', 'Export approved entries → Download CSV → Upload to Fingercheck mass import. Only payroll entries export, not General Issues or Terminations.'],
                    ['3:00', 'Past Tasks shows all exported entries and closed/voided history including resolved General Issues and Terminations from Asana.'],
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
