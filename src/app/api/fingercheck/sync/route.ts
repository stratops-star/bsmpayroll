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
  const res = await fetch(url, {
    method: 'GET',
    headers: fcHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fingercheck ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Fetch employees, rates, and jobs in parallel
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

    // Fetch active rates for all employees
    try {
      const data = await fcGet(`/v1/Reports/GetEmployeeActiveRates?startDate=${startDate}&endDate=${today}&companyId=${FC_COMPANY_ID}`)
      ratesData = Array.isArray(data) ? data : (data.data || data.Data || [])
    } catch (e) {
      console.log('Could not fetch rates:', e)
    }

    // Fetch job list
    try {
      const data = await fcGet(`/v1/Sync/GetJobList?companyId=${FC_COMPANY_ID}`)
      jobsData = Array.isArray(data) ? data : (data.data || data.Data || [])
    } catch (e) {
      console.log('Could not fetch jobs:', e)
    }

    if (!employees.length) {
      return NextResponse.json({ error: 'No employees returned from Fingercheck' }, { status: 400 })
    }

    // Build rate map by employee number
    const rateMap: Record<string, number> = {}
    for (const r of ratesData) {
      const empNum = String(r.EmployeeNumber || r.employeeNumber || '')
      const rate = parseFloat(r.Rate || r.rate || r.HourlyRate || '0')
      if (empNum && rate) rateMap[empNum] = rate
    }

    // Build job map by job code
    const jobMap: Record<string, string> = {}
    for (const j of jobsData) {
      const code = j.Code || j.code || j.JobCode || ''
      const name = j.Name || j.name || j.Description || ''
      if (code) jobMap[code] = name
    }

    console.log(`Fetched ${employees.length} employees, ${ratesData.length} rates, ${jobsData.length} jobs`)

    // Calculate 30 days ago for new employee detection
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Map employees to our schema
    const rows = employees.map((emp: any) => {
      const employeeNumber = String(emp.EmployeeNumber || emp.EmployeeId || emp.Id || '')
      const fullName = emp.FirstLast || `${emp.FirstName || ''} ${emp.LastName || ''}`.trim()
      const jobCode = emp.Job || emp.JobCode || emp.JobTitle || ''
      const address = [emp.Address1, emp.City, emp.State].filter(Boolean).join(', ')
      // Use rate from rates API first, fall back to employee record
      const rate = rateMap[employeeNumber] || parseFloat(emp.HourlyRate || emp.Rate || emp.PayRate || '0') || null
      
      // DivisionEmployeeStatus: A=Active, T=Terminated, I=Inactive, O=Onboarding
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

      // isNew: hired in last 30 days AND active
      const isNew = hireDate && new Date(hireDate) >= thirtyDaysAgo && rawStatus === 'A'
      
      // recentlyTerminated: terminated in last 90 days
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const isRecentlyTerminated = termDate && new Date(termDate) >= ninetyDaysAgo && rawStatus === 'T'

      return {
        employee_number: employeeNumber,
        full_name: fullName,
        email,
        job_code: jobCode,
        address,
        rate,
        company_id: FC_COMPANY_ID,
        status,
        raw_data: { ...emp, _isNew: isNew, _hireDate: hireDate, _termDate: termDate, _department: department, _isRecentlyTerminated: isRecentlyTerminated },
        synced_at: new Date().toISOString(),
      }
    }).filter(r => r.employee_number)

    // Upsert in batches of 100
    const batchSize = 100
    for (let i = 0; i < rows.length; i += batchSize) {
      const { error } = await supabase
        .from('fingercheck_employees')
        .upsert(rows.slice(i, i + batchSize), { onConflict: 'employee_number' })
      if (error) console.error('Upsert error:', error)
    }

    // Count new employees (hired in last 30 days)
    const newEmployees = rows.filter(r => r.raw_data._isNew)

    return NextResponse.json({
      synced: rows.length,
      new_employees: newEmployees.length,
      rates_synced: Object.keys(rateMap).length,
      jobs_synced: jobsData.length,
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
