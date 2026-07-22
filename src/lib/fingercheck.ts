// src/lib/fingercheck.ts
// Thin client for the Fingercheck REST API.
// Docs: https://developer.fingercheck.com/api/help
// Auth: two headers — APIKEY (per programmer) + ClientSecretKey (per company/user).
// Env: FINGERCHECK_API_KEY, FINGERCHECK_SECRET_KEY, FINGERCHECK_API_URL (optional)
// Node runtime only — never import this into a client component (keys must stay server-side).

// Base URL comes from env (FINGERCHECK_API_URL) with the documented default as fallback.
// Trailing slashes are trimmed so path joins stay clean.
const BASE = (process.env.FINGERCHECK_API_URL || 'https://developer.fingercheck.com/api').replace(/\/+$/, '')

export function fingercheckConfigured(): boolean {
  return Boolean(process.env.FINGERCHECK_API_KEY && process.env.FINGERCHECK_SECRET_KEY)
}

function headers() {
  return {
    APIKEY: process.env.FINGERCHECK_API_KEY || '',
    ClientSecretKey: process.env.FINGERCHECK_SECRET_KEY || '',   // header name per Fingercheck docs
    'Content-Type': 'application/json',
  }
}

export type FcResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

async function call<T>(path: string, init?: RequestInit): Promise<FcResult<T>> {
  if (!fingercheckConfigured()) return { ok: false, error: 'Fingercheck env vars missing' }
  try {
    const res = await fetch(`${BASE}/${path}`, { ...init, headers: headers(), cache: 'no-store' })
    const text = await res.text()
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!res.ok) return { ok: false, status: res.status, error: typeof data === 'string' ? data.slice(0, 300) : (data?.Message || `HTTP ${res.status}`) }
    return { ok: true, data: data as T }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

// ── The fields that tell us where someone is in onboarding ──
export type FcEmployee = {
  EmployeeNumber: string
  EmployeeID?: number
  FirstName?: string
  LastName?: string
  Email?: string
  MobilePhone?: string
  HireDate?: string | null
  DivisionEmployeeStatus?: string | null
  OnBoardingStatus?: number | null
  NewHireStatus?: number | null
  SkipI9Verification?: boolean
  Position?: string | null
  JobTitle?: string | null
  Location?: string | null
  CostCenter1?: string | null
  SupervisorEmployeeNumber?: string | null
  ModifiedOn?: string | null
  EmployeeEVerifyTransactions?: Array<{
    Status?: number | null
    CurrentState?: string | null
    CreatedOn?: string | null
    CompletedOn?: string | null
    ClosedDate?: string | null
    ClosureDescription?: string | null
    CaseNumber?: string | null
  }> | null
}

export function getEmployee(employeeNumber: string) {
  return call<FcEmployee>(`v1/Employees/GetEmployeeByEmployeeNumber/${encodeURIComponent(employeeNumber)}`)
}

export function getAllActiveEmployees() {
  return call<FcEmployee[]>('v1/Employees/GetAllActiveEmployees')
}

// Sends the employee the Fingercheck Self Service invite email.
export function enrollForSelfService(employeeNumber: string) {
  return call<unknown>(`v1/Employees/EnrollEmployeeForSelfService/${encodeURIComponent(employeeNumber)}`, { method: 'POST' })
}

// ── Onboarding snapshot: just the progress-relevant bits, normalized ──
export type OnboardingSnapshot = {
  employeeNumber: string
  name: string
  onBoardingStatus: number | null
  newHireStatus: number | null
  divisionEmployeeStatus: string | null
  hireDate: string | null
  modifiedOn: string | null
  everify: { status: number | null; currentState: string | null; completedOn: string | null; closureDescription: string | null } | null
  position: string | null
  location: string | null
  costCenter1: string | null
  supervisorEmployeeNumber: string | null
}

export function toSnapshot(e: FcEmployee): OnboardingSnapshot {
  const ev = (e.EmployeeEVerifyTransactions || [])[0] || null
  return {
    employeeNumber: e.EmployeeNumber,
    name: [e.FirstName, e.LastName].filter(Boolean).join(' '),
    onBoardingStatus: e.OnBoardingStatus ?? null,
    newHireStatus: e.NewHireStatus ?? null,
    divisionEmployeeStatus: e.DivisionEmployeeStatus ?? null,
    hireDate: e.HireDate ?? null,
    modifiedOn: e.ModifiedOn ?? null,
    everify: ev ? {
      status: ev.Status ?? null,
      currentState: ev.CurrentState ?? null,
      completedOn: ev.CompletedOn ?? null,
      closureDescription: ev.ClosureDescription ?? null,
    } : null,
    position: e.Position ?? e.JobTitle ?? null,
    location: e.Location ?? null,
    costCenter1: e.CostCenter1 ?? null,
    supervisorEmployeeNumber: e.SupervisorEmployeeNumber ?? null,
  }
}
