'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { Lang } from '@/lib/i18n'
import { createClient } from '@/lib/supabase-browser'

const SECTIONS = [
  { id:'overview', title:'1. Role Overview', content:`The Payroll Specialist is responsible for ensuring employees are paid accurately and on time while maintaining compliance with company policies, prevailing wage requirements, payroll regulations, and client contract obligations.

Primary responsibilities include:
- Weekly payroll processing
- Prevailing wage administration
- New employee onboarding
- Rate changes
- Direct deposit updates
- Garnishment administration
- Earnings and deduction adjustments
- PTO, Sick and Vacation payouts
- Payroll documentation
- Fingercheck administration` },
  { id:'calendar', title:'2. Payroll Calendar & Deadlines', content:`Pay Period: Wednesday through Tuesday
Payday: Friday

Submission Deadlines:
- Tier 1: Tuesday by 10:00 PM
- Tier 2: Tuesday by 10:00 PM
- Tier 3: Wednesday by 7:00 AM

Failure to meet deadlines may result in payroll delays.` },
  { id:'process', title:'3. Weekly Payroll Process', content:`Step 1: Review employee hours
Step 2: Review missing punches
Step 3: Review overtime
Step 4: Review prevailing wage employees
Step 5: Review PTO, Sick, and Vacation requests
Step 6: Review rate changes
Step 7: Review garnishments
Step 8: Review direct deposit updates
Step 9: Review earnings and deductions
Step 10: Review holiday pay
Step 11: Review payroll totals
Step 12: Approve payroll before deadline` },
  { id:'prevailing', title:'4. Prevailing Wage Administration', content:`The HR Prevailing Sheet is the source of truth for:
- Prevailing wage assignments
- Wage rates
- Employee classifications
- Building assignments

Prevailing wage employees must always be paid at their assigned prevailing wage rate.

Never substitute base rates, cover rates, or standard building rates unless specifically approved.` },
  { id:'overtime', title:'5. Overtime Rules', content:`Standard overtime applies after 40 hours worked.

Special OT Rule applies when an employee works both Regular Rate and Prevailing Wage Rate during the same payroll period. Use the OT Prevailing Wage Calculator.

OT Rate $8.25:
- Abel Hernandez (34)
- Miguel Gomez (911)
- Alianni Quinal (12)
Formula: (Total Hours - 40) × 8.25

OT Rate $10.00:
- Freddy Arboleada (10017)
Formula: (Total Hours - 40) × 10.00` },
  { id:'holidays', title:'6. Holiday Pay Policy', content:`Federal Holidays: New Year's Day, MLK Jr. Day, Presidents Day, Memorial Day, Juneteenth, Independence Day, Labor Day, Columbus Day, Veterans Day, Thanksgiving Day, Christmas Day

Scenario 1 — Building Closed:
- Employee does not report
- Employee receives scheduled hours at their assigned rate
- Prevailing Wage employees receive their prevailing wage rate

Scenario 2 — Building Open:
Employee receives: Base Rate + Holiday Premium (1.5×) + Supplement

Verify holiday calculations before payroll approval.` },
  { id:'svpto', title:'7. PTO, Sick & Vacation Payouts', content:`Payouts are processed on the 1st and 15th of the Month.

─── ELIGIBILITY ───────────────────────────────
Prevailing Wage employees become eligible for Vacation and Sick benefits 60 days after their Start Date.

Example:
  Start Date:         January 1, 2026
  Eligibility Begins: March 1, 2026

─── 10-MONTH PAYMENT RULE ─────────────────────
Once eligible, Vacation and Sick benefits are paid for 10 consecutive months.

Eligible months (using Jan 1 start):
  March · April · May · June · July
  August · September · October · November · December

No payments during: January · February

─── ANNUAL RESET ──────────────────────────────
The benefit cycle resets each year based on the employee's original Start Date.

  Year 1: March 2026 – December 2026
  Year 2: March 2027 – December 2027
  Year 3: March 2028 – December 2028

─── PTO ELIGIBILITY ───────────────────────────
PTO follows a different rule — employees become eligible after completing TWO years of employment.

Example:
  Start Date:        January 1, 2026
  PTO Eligibility:   January 1, 2028

Once eligible, PTO payments are calculated based on contracted hours and follow the employee's eligibility schedule.

─── PAYROLL SPECIALIST VERIFICATION ───────────
Step 1: Verify employee is Prevailing Wage
Step 2: Verify building participation requirements
Step 3: Verify employee Start Date
Step 4: Determine employee's current eligibility month
Step 5: Confirm employee is within their annual 10-month payment period
Step 6: Verify contracted hours
Step 7: Calculate payable benefit hours
Step 8: Process payment
Step 9: Document any exceptions

Eligibility is driven by: Start Date · Prevailing Wage Status · Contracted Hours · Building Participation · Length of Service

Always calculate eligibility from the employee's original Start Date.

─── EARNINGS CODES ────────────────────────────
MANUAL BENEFIT ENTRIES:
  SK       Manual Sick           — Manual sick payment adjustment or correction
  VA       Manual Vacation       — Manual vacation payment adjustment or correction
  PTO|PW   PTO Prevailing Wage   — Prevailing wage PTO payment

AUTOMATIC BENEFIT ENTRIES:
  SK1      Auto First Sick       — Generated when employee first becomes eligible
  VA1      Auto First Vacation   — Generated when employee first becomes eligible
  SK115    Sick 1st & 15th       — For buildings using 1st & 15th payment structure
  VA115    Vacation 1st & 15th   — For buildings using 1st & 15th payment structure
  PTO115   PTO 1st & 15th        — For buildings using 1st & 15th payment structure

SK1 and VA1 are used ONLY for the employee's initial benefit payment after becoming eligible.
After the initial payment, employee moves to recurring benefit schedule based on:
  Building participation · Contract hours · Start Date · Benefit type · Eligibility rules

Always verify the employee's eligibility before processing any manual benefit adjustment.` },
  { id:'onboarding', title:'8. Employee Onboarding', content:`Employee Setup Includes:
1. Accounting Allocation
2. Profile Controls
3. Pay Group Assignment
4. Tax Type Assignment
5. Wage Assignment
6. Department Assignment
7. Supervisor Assignment

Verify: W2 or 1099, Pay Group, Starting Rate, Division Assignment` },
  { id:'wages', title:'9. Wage Progression & Rate Changes', content:`Every employee starts with Base Rate Only — no supplement at hire.

Position Milestones:
- Porter: 3, 12, 21, 42, 43 months
- Super: 3, 4 months
- Security: 4, 23, 24 months
- Concierge: 3, 12, 21, 42, 43 months
- Concierge Security: 4, 23, 24 months
- Handyman: 3, 4 months

At the first eligible milestone, supplement is added. Payroll must monitor milestone dates monthly.` },
  { id:'cover', title:'10. Cover Pay Rules', content:`Non-Prevailing Wage Employees:
- Coverage 8+ Hours: $22.33/hour
- Coverage Under 8 Hours: $17.00/hour

Prevailing Wage Employees:
Always use assigned prevailing wage rate.

Building Porter Rate: Highest paid porter assigned to building
Building Super Rate: Highest paid super assigned to building` },
  { id:'direct', title:'11. Direct Deposit Changes', content:`Payroll Specialist Responsibilities:
- Verify employee authorization
- Update banking information
- Confirm account setup
- Document change

Always verify effective date.` },
  { id:'garnish', title:'12. Garnishments', content:`Payroll Specialist Responsibilities:
- Enter garnishment order
- Verify deduction amount
- Verify withholding requirements
- Monitor balances
- Maintain compliance

Never modify garnishments without documentation.` },
  { id:'earnings', title:'13. Earnings & Deductions', content:`Earnings Examples:
- Covered Pay  • Snow Labor  • Retro Pay  • Bonus

Deductions Examples:
- Overpayment Recovery  • Payroll Corrections  • Other Approved Deductions

All adjustments require documentation.` },
  { id:'fingercheck', title:'14. Creating Jobs in Fingercheck', content:`Process:
1. Add Rate Code
2. Add Maximum Hour Policy
3. Add Job
4. Create Master Profile
5. Link Master Profile to Job

All job setups must be completed before assigning employees.` },
  { id:'fencing', title:'15. Job Fencing', content:`Policy Radius: 0.25 Miles
Used for: Porters, Supers
Verify job fencing is active before employee assignment.` },
  { id:'docs', title:'16. Documentation Requirements', content:`Every payroll change must include:
- Employee Note  • Date  • Reason
- Supporting documentation
- Asana Task Link (when applicable)

If it is not documented, it did not happen.` },
  { id:'exceptions', title:'17. Special Cases & Exceptions', content:`Common Exceptions:
- Prevailing wage corrections  • Retroactive raises
- Payroll corrections  • Emergency holiday coverage
- Special OT calculations  • Rehires  • Promotions
- Contract exceptions  • Legacy rates

When unsure: Stop → Review documentation → Verify with management → Document decision` },
  { id:'checklist', title:'18. Payroll Approval Checklist', content:`☐ Hours reviewed
☐ Missing punches resolved
☐ Overtime reviewed
☐ Prevailing wage verified
☐ Rate changes reviewed
☐ Direct deposit updates reviewed
☐ Garnishments reviewed
☐ PTO reviewed
☐ Vacation reviewed
☐ Sick time reviewed
☐ Earnings reviewed
☐ Deductions reviewed
☐ Holiday pay reviewed
☐ Payroll totals reviewed
☐ Payroll approved before deadline

Remember: Payroll accuracy is more important than payroll speed.` },
]

export default function RulesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('bsm_lang') as Lang) || 'en'
    return 'en'
  })
  function switchLang(l: Lang) { setLang(l); localStorage.setItem('bsm_lang', l) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: nd } = await supabase.from('payroll_notes').select('note').eq('user_email', data.user.email).single()
      if (nd) setNote(nd.note)
    })
  }, [])

  async function saveNote() {
    const { data: ud } = await supabase.auth.getUser()
    if (!ud.user) return
    await supabase.from('payroll_notes').upsert({ user_email: ud.user.email, note, updated_at: new Date().toISOString() }, { onConflict: 'user_email' })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const filtered = SECTIONS.filter(s =>
    !search.trim() ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang={lang} onLangChange={switchLang} />
      <main className="max-w-5xl mx-auto px-5 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Payroll Rules & Questions</h1>
          <p className="text-sm text-gray-500 mt-1">BSM Facility Solutions — Payroll Specialist Training Manual v1.0</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search rules… (e.g. overtime, holiday, prevailing wage, SK1, cover pay)"
            className="flex-1 border-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕ Clear</button>}
          {search && <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit md:sticky top-6">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Sections</div>
            <nav className="space-y-0.5">
              {SECTIONS.map(s => (
                <a key={s.id} href={`#${s.id}`}
                  className={`block text-xs py-1.5 px-2 rounded-lg transition-colors ${
                    search && (s.title.toLowerCase().includes(search.toLowerCase()) || s.content.toLowerCase().includes(search.toLowerCase()))
                      ? 'text-[#D4A843] font-medium bg-amber-50'
                      : 'text-gray-600 hover:text-[#0D1B35] hover:bg-gray-50'
                  }`}>{s.title}
                </a>
              ))}
              <a href="#notes" className="block text-xs text-[#D4A843] font-medium py-1.5 px-2 rounded-lg hover:bg-amber-50 transition-colors mt-2">📝 My Notes</a>
            </nav>
          </div>
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm text-gray-500">No results for "{search}"</div>
                <button onClick={() => setSearch('')} className="text-xs text-[#D4A843] mt-2 hover:underline">Clear search</button>
              </div>
            ) : filtered.map(section => (
              <div key={section.id} id={section.id} className={`bg-white border rounded-xl p-6 ${
                search && (section.title.toLowerCase().includes(search.toLowerCase()) || section.content.toLowerCase().includes(search.toLowerCase()))
                  ? 'border-[#D4A843]/40 bg-amber-50/20' : 'border-gray-200'}`}>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">{section.title}</h2>
                <pre className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">{section.content}</pre>
              </div>
            ))}
            {!search && (
              <div id="notes" className="bg-white border border-[#D4A843]/40 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">📝 My Personal Notes & Reminders</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Private notes visible only to you</p>
                  </div>
                  <button onClick={saveNote} className="bg-[#D4A843] text-[#0D1B35] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#C49A38]">
                    {saved ? '✓ Saved!' : 'Save notes'}
                  </button>
                </div>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Add your personal notes, reminders, special cases, or anything you want to remember here…"
                  className="w-full h-40 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#D4A843]/30 focus:border-[#D4A843] resize-none leading-relaxed" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
