import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const FC_API_URL = (process.env.FINGERCHECK_API_URL || 'https://developer.fingercheck.com/api').replace(/\/$/, '')
const FC_API_KEY = process.env.FINGERCHECK_API_KEY || ''
const FC_SECRET_KEY = process.env.FINGERCHECK_SECRET_KEY || ''
const FC_COMPANY_ID = process.env.FINGERCHECK_COMPANY_ID || 'BE4627'

function fcHeaders() {
  return {
    'APIKEY': FC_API_KEY,
    'ClientSecretKey': FC_SECRET_KEY,
    'Content-Type': 'application/json',
  }
}

async function fcGet(path: string) {
  const url = `${FC_API_URL}${path}`
  const res = await fetch(url, { method: 'GET', headers: fcHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fingercheck ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

// Fetch rates + profile for a single employee — returns both or nulls on failure
async function fetchEmpDetails(employeeNumber: string): Promise<{ rates: any[] | null; profile: any | null }> {
  const [ratesResult, profileResult] = await Promise.allSettled([
    fcGet(`/v1/Employees/GetEmployeePayRatesByEmployeeNumber/${employeeNumber}`),
    fcGet(`/v1/Employees/GetEmployeeByEmployeeNumber/${employeeNumber}`),
  ])

  const rates = ratesResult.status === 'fulfilled'
    ? (Array.isArray(ratesResult.value) ? ratesResult.value : (ratesResult.value?.data || ratesResult.value?.Data || []))
    : null

  const profile = profileResult.status === 'fulfilled'
    ? (Array.isArray(profileResult.value) ? profileResult.value[0] : profileResult.value)
    : null

  return { rates, profile }
}

// Process employees in batches to avoid overwhelming the Fingercheck API
async function fetchAllEmpDetails(
  employeeNumbers: string[],
  batchSize = 10
): Promise<Record<string, { rates: any[] | null; profile: any | null }>> {
  const results: Record<string, { rates: any[] | null; profile: any | null }> = {}

  for (let i = 0; i < employeeNumbers.length; i += batchSize) {
    const batch = employeeNumbers.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async empNum => ({ empNum, ...(await fetchEmpDetails(empNum)) }))
    )
    for (const r of batchResults) {
      results[r.empNum] = { rates: r.rates, profile: r.profile }
    }
    // Small delay between batches to be gentle on the API
    if (i + batchSize < employeeNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const syncStart = new Date().toISOString()

    // ── Step 1: Fetch employees, rates report, jobs in parallel ──────────
    const today = new Date().toISOString().split('T')[0]
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const startDate = oneYearAgo.toISOString().split('T')[0]

    let employees: any[] = []
    let ratesData: any[] = []
    let jobsData: any[] = []

    try {
      const data = await fcGet(`/v1/Employees/GetAllEmployees?companyId=${FC_COMPANY_ID}`)
      employees = Array.isArray(data) ? data : (data.data || data.employees || data.Data || [])
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to fetch employees: ${e.message}` }, { status: 500 })
    }

    try {
      const data = await fcGet(`/v1/Reports/GetEmployeeActiveRates?startDate=${startDate}&endDate=${today}&companyId=${FC_COMPANY_ID}`)
      ratesData = Array.isArray(data) ? data : (data.data || data.Data || [])
    } catch (e) { console.log('Could not fetch rates report:', e) }

    try {
      const data = await fcGet(`/v1/Sync/GetJobList?companyId=${FC_COMPANY_ID}`)
      jobsData = Array.isArray(data) ? data : (data.data || data.Data || [])
    } catch (e) { console.log('Could not fetch jobs:', e) }

    if (!employees.length) {
      return NextResponse.json({ error: 'No employees returned from Fingercheck' }, { status: 400 })
    }

    // ── Step 2: Build lookup maps ─────────────────────────────────────────
    const rateMap: Record<string, number> = {}
    for (const r of ratesData) {
      const empNum = String(r.EmployeeNumber || r.employeeNumber || '')
      const rate = parseFloat(r.Rate || r.rate || r.HourlyRate || '0')
      if (empNum && rate) rateMap[empNum] = rate
    }

    const jobMap: Record<string, string> = {}
    for (const j of jobsData) {
      const code = j.Code || j.code || j.JobCode || ''
      const name = j.Name || j.name || j.Description || ''
      if (code) jobMap[code] = name
    }

    console.log(`Fetched ${employees.length} employees, ${ratesData.length} rates, ${jobsData.length} jobs`)

    // ── Step 3: Filter to tier employees ─────────────────────────────────
    const EXCLUDED_DEPTS = ['hr & recruiting team', 'office admin', 'payroll team', 'sales team']
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const tierEmployees = employees.filter((emp: any) => {
      const dept = (emp.CostCenter1 || '').toLowerCase().trim()
      return !EXCLUDED_DEPTS.includes(dept)
    })

    console.log(`Total: ${employees.length}, Tier only: ${tierEmployees.length}`)

    // ── Step 4: Fetch rates + profile for ALL employees in batches ────────
    const allEmpNumbers = tierEmployees.map((emp: any) =>
      String(emp.EmployeeNumber || emp.EmployeeId || emp.Id || '')
    ).filter(Boolean)

    console.log(`Fetching rates + profile for ${allEmpNumbers.length} employees in batches of 10…`)
    const empDetails = await fetchAllEmpDetails(allEmpNumbers, 10)
    console.log(`Done fetching employee details`)

    // ── Step 5: Build upsert rows ─────────────────────────────────────────
    const rows = tierEmployees.map((emp: any) => {
      const employeeNumber = String(emp.EmployeeNumber || emp.EmployeeId || emp.Id || '')
      const fullName = emp.FirstLast || `${emp.FirstName || ''} ${emp.LastName || ''}`.trim()
      const jobCode = emp.Job || emp.JobCode || emp.JobTitle || ''
      const address = [emp.Address1, emp.City, emp.State].filter(Boolean).join(', ')
      const rate = rateMap[employeeNumber] || parseFloat(emp.HourlyRate || emp.Rate || emp.PayRate || '0') || null

      const rawStatus = emp.DivisionEmployeeStatus || emp.Status || 'A'
      const status = rawStatus === 'A' ? 'Active'
        : rawStatus === 'T' ? 'Terminated'
        : rawStatus === 'I' ? 'Inactive'
        : rawStatus === 'O' ? 'Onboarding'
        : rawStatus

      const email = emp.Email || emp.PersonalEmail || ''
      const hireDate = emp.HireDate || emp.StartDate
      const termDate = emp.TerminationDate || null
      const department = emp.CostCenter1 || emp.CostCenter2 || emp.Department || ''
      const isNew = hireDate && new Date(hireDate) >= thirtyDaysAgo && rawStatus === 'A'
      const isRecentlyTerminated = termDate && new Date(termDate) >= ninetyDaysAgo && rawStatus === 'T'

      const details = empDetails[employeeNumber] || { rates: null, profile: null }

      return {
        employee_number: employeeNumber,
        full_name: fullName,
        email,
        job_code: jobCode,
        address,
        rate,
        company_id: FC_COMPANY_ID,
        status,
        raw_data: {
          ...emp,
          _isNew: isNew,
          _hireDate: hireDate,
          _termDate: termDate,
          _department: department,
          _isRecentlyTerminated: isRecentlyTerminated,
        },
        rates: details.rates,
        profile: details.profile,
        synced_at: syncStart,
      }
    }).filter(r => r.employee_number)

    // ── Step 6: Upsert in batches of 100 ─────────────────────────────────
    const batchSize = 100
    for (let i = 0; i < rows.length; i += batchSize) {
      const { error } = await supabase
        .from('fingercheck_employees')
        .upsert(rows.slice(i, i + batchSize), { onConflict: 'employee_number' })
      if (error) console.error('Upsert error:', error)
    }

    // ── Step 7: Log sync time ─────────────────────────────────────────────
    await supabase.from('sync_log').upsert({
      id: 'fingercheck_employees',
      synced_at: syncStart,
      details: {
        total_synced: rows.length,
        new_employees: rows.filter(r => r.raw_data._isNew).length,
        rates_fetched: allEmpNumbers.length,
        jobs_synced: jobsData.length,
      }
    }, { onConflict: 'id' })

    const newEmployees = rows.filter(r => r.raw_data._isNew)

    return NextResponse.json({
      synced: rows.length,
      new_employees: newEmployees.length,
      rates_synced: allEmpNumbers.length,
      jobs_synced: jobsData.length,
      synced_at: syncStart,
      new_employee_list: newEmployees.map(e => ({
        employee_number: e.employee_number,
        full_name: e.full_name,
        hire_date: e.raw_data._hireDate,
      })),
    })
  } catch (e: any) {
    console.error('Fingercheck sync error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
