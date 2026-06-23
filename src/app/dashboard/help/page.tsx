'use client'

import { useRouter } from 'next/navigation'

export default function HelpPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#0D1B35] h-[50px] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F5C072] flex items-center justify-center font-bold text-[#0D1B35] text-sm">B</div>
          <div className="w-px h-5 bg-white/15" />
          <span className="text-white/50 text-sm">Help guide</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-white/55 text-xs hover:text-white">← Dashboard</button>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">BSM Payroll — Help guide</h1>
        <p className="text-sm text-gray-500 mb-6">Quick reference for using the payroll dashboard</p>
        <div className="space-y-4">
          {[
            { title: '1. Loading entries', body: 'Set the pay period (auto-filled to current Wed–Tue) and click "Load all tiers". Entries from all three Google Sheets load simultaneously.' },
            { title: '2. Approving an entry', body: 'Click "✓ Approve" on any pending row. The entry moves to the Approved tab and the app posts "entered — [dates]" on the linked Asana task automatically.' },
            { title: '3. Waiting ⚡ tab', body: 'Entries submitted within 24 hours of the Tuesday cutoff are flagged as last-minute. Review these urgently before payday (Friday).' },
            { title: '4. Closing an entry', body: 'Click "Close" to exclude an entry from export. Enter a reason (e.g. duplicate, under investigation). Closed entries stay in the Closed tab permanently — they never disappear.' },
            { title: '5. Reopening a closed entry', body: 'In the Closed tab, click "↩ Reopen" to move the entry back to Pending for re-review.' },
            { title: '6. Exporting to Fingercheck', body: 'Click "Export approved" when ready. A confirmation shows T1+T2+T3 totals. Download the CSV and upload it to Fingercheck mass import.' },
            { title: '7. Export history', body: 'Click "Export history" in the nav to see all past exports with EST timestamps and re-download any file. Snapshots are frozen — sheet edits don\'t affect past exports.' },
            { title: '8. Pay period schedule', body: 'Period runs Wednesday → Tuesday. Payday is the following Friday. The app auto-calculates and pre-fills the current period.' },
          ].map(s => (
            <div key={s.title} className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
