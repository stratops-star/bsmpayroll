import { PorterEntry, Tier } from './types'
import { parseCSVText, parseDate } from './csvUtils'
import { isLastMinute } from './payPeriod'

const SHEET_ID = process.env.GOOGLE_SHEET_ID!
const GIDS = {
  T1_MAIN:  process.env.GID_T1_MAIN   || '1355426696',
  T2_MAIN:  process.env.GID_T2_MAIN   || '785908016',
  T2_CHILD: process.env.GID_T2_CHILD  || '735486758',
  T3_MAIN:  process.env.GID_T3_MAIN   || '991494440',
  T3_CHILD: process.env.GID_T3_CHILD  || '510487684',
  BUILDING: process.env.GID_BUILDING  || '1150035765',
}

const T2_JOB_CODE = '203 Clifton'

async function fetchTab(gid: string): Promise<Record<string, string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch tab gid=${gid}: ${res.status}`)
  return parseCSVText(await res.text())
}

function g(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]?.trim()
    if (v) return v
  }
  return ''
}

// Extract Asana task GID from URL — always accurate, avoids scientific notation issue
// Supports both old format: /0/0/1234567890 and new format: /task/1234567890
function extractAsanaId(url: string, fallbackId: string): string {
  if (!url) return fallbackId || ''
  // New format: /task/1234567890
  const newMatch = url.match(/\/task\/(\d+)/)
  if (newMatch) return newMatch[1]
  // Old format: /0/PROJECT_ID/TASK_ID
  const oldMatch = url.match(/\/(\d{16,})(?:[/?]|$)/)
  if (oldMatch) return oldMatch[1]
  // Last segment fallback
  const segments = url.replace(/\/$/, '').split('/')
  const last = segments[segments.length - 1]
  if (/^\d{10,}$/.test(last)) return last
  return fallbackId || ''
}

async function buildJobCodeMap(): Promise<Map<string, string>> {
  const rows = await fetchTab(GIDS.BUILDING)
  const map = new Map<string, string>()
  for (const row of rows) {
    const id = g(row, 'ID')
    const jobCode = g(row, 'JOBCODE')
    if (id && jobCode) map.set(id.trim(), jobCode.trim())
  }
  return map
}

function resolveEntryType(raw: string): 'cover' | 'extra_hours' | 'billable' {
  const v = raw?.toUpperCase().trim()
  if (v === 'BILLABLE EXTRA HOURS') return 'billable'
  if (v === 'EXTRA HOURS') return 'extra_hours'
  return 'cover'
}

function entryTypeLabel(type: string): string {
  if (type === 'billable') return 'Billable'
  if (type === 'extra_hours') return 'Extra Hours'
  return 'Cover'
}

export async function fetchAllTiers(
  periodStart: string,
  periodEnd: string
): Promise<{ T1: PorterEntry[]; T2: PorterEntry[]; T3: PorterEntry[] }> {
  const start = new Date(periodStart)
  const end = new Date(periodEnd + 'T23:59:59')

  function inPeriod(e: PorterEntry): boolean {
    const d = parseDate(e.coverDay)
    if (!d) return false
    return d >= start && d <= end
  }

  function notClosed(e: PorterEntry): boolean {
    return e.status?.toUpperCase() !== 'CLOSED'
  }

  const [t1, t2m, t2c, t3m, t3c, jobCodeMap] = await Promise.all([
    fetchTab(GIDS.T1_MAIN),
    fetchTab(GIDS.T2_MAIN),
    fetchTab(GIDS.T2_CHILD),
    fetchTab(GIDS.T3_MAIN),
    fetchTab(GIDS.T3_CHILD),
    buildJobCodeMap(),
  ])

  // Build T3 parent map: parentId → { asanaLink, asanaId, manager, status }
  const t3ParentMap = new Map<string, {
    asanaLink: string
    asanaId: string
    manager: string
    status: string
    coverDay: string
    property: string
    propertyAddress: string
  }>()

  for (const row of t3m) {
    const id = g(row, 'ID')
    if (!id) continue
    const asanaLink = g(row, 'Asana Link', 'ASANA LINK', 'asana link')
    const rawAsanaId = g(row, 'ASANA ID', 'Asana ID', 'asana id')
    t3ParentMap.set(id.trim(), {
      asanaLink,
      asanaId: extractAsanaId(asanaLink, rawAsanaId),
      manager: g(row, 'Manager', 'MANAGER'),
      status: g(row, 'Status', 'STATUS'),
      coverDay: g(row, 'Coverage Date', 'Coverage D', 'Date', 'Coverage Day'),
      property: g(row, 'Property', 'PROPERTY'),
      propertyAddress: g(row, 'Property Address', 'Full Address Info'),
    })
  }

  // T1
  const T1: PorterEntry[] = t1.map(row => {
    const coverDay = g(row, 'Cover Day ', 'Cover Day')
    const cd = parseDate(coverDay)
    const hrs = parseFloat(g(row, 'Hours')) || 0
    const porter = g(row, 'Porter')
    if (!porter || !hrs) return null
    const subDay = g(row, 'Submission Day ', 'Submission Day')
    const subDate = parseDate(subDay)
    const propertyId = g(row, 'Property')
    const entryTypeRaw = g(row, 'Is this a cover or extra hours?')
    const entryType = resolveEntryType(entryTypeRaw)
    const asanaLink = g(row, 'Asana Link')
    const rawAsanaId = g(row, 'ASANA ID')
    return {
      id: g(row, 'ID') || `t1-${Math.random()}`,
      tier: 'T1' as Tier,
      entryType,
      entryTypeLabel: entryTypeLabel(entryType),
      employeeNumber: porter,
      porterName: g(row, 'Requesting Manager Porter Name', 'Porter'),
      manager: g(row, 'Manager'),
      coverDay: cd ? cd.toISOString().split('T')[0] : coverDay,
      submissionDay: subDate ? subDate.toISOString().split('T')[0] : subDay,
      hours: hrs,
      hoursType: g(row, 'Are these regular hours or OT?') || 'Regular',
      property: propertyId,
      propertyAddress: g(row, 'Property Address'),
      jobCode: jobCodeMap.get(propertyId) || '',
      asanaLink,
      asanaId: extractAsanaId(asanaLink, rawAsanaId),
      rate: '',
      status: g(row, 'Status'),
      approvalStatus: 'open',
      isLastMinute: subDate ? isLastMinute(subDate, end) : false,
      buildingMaxRate: g(row, 'Building Max Rate'),
      totalPay: g(row, 'Total Pay'),
      totalCharge: g(row, 'Total Charge'),
      porterStatus: g(row, 'Porter Status'),
      buildingStatus: g(row, 'Building Status'),
      extraDetails: g(row, 'Details', 'Extra Details'),
      screenshotUrl: g(row, 'Upload Screenshot of Approval'),
      service: g(row, 'Which Service?'),
    } as PorterEntry
  }).filter((e): e is PorterEntry => !!e && inPeriod(e) && notClosed(e))

  // T2
  const T2: PorterEntry[] = [...t2m, ...t2c].map(row => {
    const coverDay = g(row, 'Cover Day ', 'Cover Day')
    const cd = parseDate(coverDay)
    const hrs = parseFloat(g(row, 'How many hours?', 'Hours')) || 0
    const porter = g(row, 'Porter ID Covering', 'Porter ID covered')
    if (!porter || !hrs) return null
    const subDay = g(row, 'Submission Day ', 'Submission Day')
    const subDate = parseDate(subDay)
    const entryTypeRaw = g(row, 'Is this a cover or extra hours?')
    const entryType = resolveEntryType(entryTypeRaw)
    const asanaLink = g(row, 'Asana Link')
    const rawAsanaId = g(row, 'ASANA ID')
    return {
      id: g(row, 'ID') || `t2-${Math.random()}`,
      tier: 'T2' as Tier,
      entryType,
      entryTypeLabel: entryTypeLabel(entryType),
      employeeNumber: porter,
      porterName: g(row, 'Who is doing the covering?', 'Which Porter? Text'),
      manager: g(row, 'Manager'),
      coverDay: cd ? cd.toISOString().split('T')[0] : coverDay,
      submissionDay: subDate ? subDate.toISOString().split('T')[0] : subDay,
      hours: hrs,
      hoursType: 'Regular',
      property: g(row, 'Property'),
      propertyAddress: g(row, 'Property Address'),
      jobCode: T2_JOB_CODE,
      asanaLink,
      asanaId: extractAsanaId(asanaLink, rawAsanaId),
      rate: '',
      status: g(row, 'Status'),
      extraHoursApproved: g(row, 'Are these extra hours approved by manager?') === 'TRUE',
      approvalStatus: 'open',
      isLastMinute: subDate ? isLastMinute(subDate, end) : false,
      buildingMaxRate: g(row, 'Building Max Rate'),
      totalPay: g(row, 'Total Pay'),
      porterStatus: g(row, 'Porter Status'),
      buildingStatus: g(row, 'Building Status'),
      isApartmentCleaned: g(row, 'Is an apartment being cleaned?'),
      apartmentNumber: g(row, 'Apartment #', 'Apt #'),
      extraDetails: g(row, 'Details', 'Extra Details'),
      screenshotUrl: g(row, 'Upload Screenshot of Approval'),
      service: g(row, 'Which Service?'),
    } as PorterEntry
  }).filter((e): e is PorterEntry => !!e && inPeriod(e) && notClosed(e))

  // T3 — join child rows with parent data
  const T3: PorterEntry[] = t3c.map(row => {
    const parentId = g(row, 'ID')
    if (!parentId) return null

    const parent = t3ParentMap.get(parentId.trim())

    const hrs = parseFloat(g(row, 'How many Hours?', 'How many hours?', 'Hours')) || 0
    const porter = g(row, 'Concierge or Security ID', 'Concierge or Sec')
    if (!porter || !hrs) return null

    const coverDayRaw = g(row, 'Date') || (parent?.coverDay || '')
    const cd = parseDate(coverDayRaw)

    const propertyId = g(row, 'Address I', 'Address ID', 'Property')
    const jobCode = jobCodeMap.get(propertyId) || ''
    const propertyAddress = g(row, 'Full Address Info', 'Property Address')
    const status = parent?.status || g(row, 'Status', 'STATUS')

    const entryTypeRaw = g(row, 'Is this a coverage or extra hours?', 'Is this a cover or extra hours?', 'Reason for Coverage')
    const entryType = resolveEntryType(entryTypeRaw)
    const subDate = cd

    return {
      id: g(row, 'APP ID') || `t3-${Math.random()}`,
      tier: 'T3' as Tier,
      entryType,
      entryTypeLabel: entryTypeLabel(entryType),
      employeeNumber: porter,
      porterName: g(row, 'Concierge or Security Full Name'),
      manager: parent?.manager || g(row, 'MANAGER', 'Manager'),
      coverDay: cd ? cd.toISOString().split('T')[0] : coverDayRaw,
      submissionDay: cd ? cd.toISOString().split('T')[0] : coverDayRaw,
      hours: hrs,
      hoursType: g(row, 'EARNING', 'Earning') === 'OT' ? 'OT' : 'Regular',
      property: propertyId,
      propertyAddress,
      jobCode,
      asanaLink: parent?.asanaLink || '',
      asanaId: parent?.asanaId || '',
      rate: g(row, 'RATE', 'Rate') || '',
      status,
      approvalStatus: 'open',
      isLastMinute: subDate ? isLastMinute(subDate, end) : false,
      service: g(row, 'SERVICE', 'Service'),
      earning: g(row, 'EARNING', 'Earning'),
      reasonForCoverage: g(row, 'Reason for Coverage'),
      extraDetails: g(row, 'Details', 'Extra Details'),
    } as PorterEntry
  }).filter((e): e is PorterEntry => !!e && inPeriod(e) && notClosed(e))

  return { T1, T2, T3 }
}
