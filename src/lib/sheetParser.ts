import { PorterEntry, Tier } from './types'
import { parseCSVText, parseDate } from './csvUtils'
import { isLastMinute } from './payPeriod'

const SHEET_ID = process.env.GOOGLE_SHEET_ID!
const GIDS = {
  T1_MAIN:  process.env.GID_T1_MAIN  || '1355426696',
  T2_MAIN:  process.env.GID_T2_MAIN  || '785908016',
  T2_CHILD: process.env.GID_T2_CHILD || '735486758',
  T3_MAIN:  process.env.GID_T3_MAIN  || '991494440',
  T3_CHILD: process.env.GID_T3_CHILD || '510487684',
}

async function fetchTab(gid: string): Promise<Record<string, string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch tab gid=${gid}: ${res.status}`)
  return parseCSVText(await res.text())
}

function g(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) { const v = row[k]?.trim(); if (v) return v }
  return ''
}

function makeEntry(id: string, tier: Tier, row: Record<string, string>, overrides: Partial<PorterEntry>, periodEnd: Date): PorterEntry {
  const subDay = g(row, 'Submission Day ', 'Submission Day')
  const subDate = parseDate(subDay)
  return {
    id: id || `${tier}-${Math.random()}`,
    tier,
    entryType: 'cover',
    employeeNumber: '',
    porterName: '',
    manager: g(row, 'Manager', 'MANAGER'),
    coverDay: '',
    submissionDay: subDate ? subDate.toISOString().split('T')[0] : subDay,
    hours: 0,
    hoursType: 'Regular',
    property: g(row, 'Property'),
    propertyAddress: g(row, 'Property Address', 'Full Address Info'),
    asanaLink: g(row, 'Asana Link'),
    asanaId: g(row, 'ASANA ID'),
    rate: g(row, 'Building Max Rate', 'RATE'),
    status: g(row, 'Status'),
    approvalStatus: 'open',
    isLastMinute: subDate ? isLastMinute(subDate, periodEnd) : false,
    ...overrides,
  }
}

export async function fetchAllTiers(periodStart: string, periodEnd: string): Promise<{ T1: PorterEntry[]; T2: PorterEntry[]; T3: PorterEntry[] }> {
  const start = new Date(periodStart)
  const end = new Date(periodEnd + 'T23:59:59')

  function inPeriod(e: PorterEntry): boolean {
    const d = parseDate(e.coverDay); if (!d) return false
    return d >= start && d <= end
  }
  function notClosed(e: PorterEntry): boolean {
    return e.status?.toUpperCase() !== 'CLOSED'
  }

  const [t1, t2m, t2c, t3m, t3c] = await Promise.all([
    fetchTab(GIDS.T1_MAIN), fetchTab(GIDS.T2_MAIN), fetchTab(GIDS.T2_CHILD),
    fetchTab(GIDS.T3_MAIN), fetchTab(GIDS.T3_CHILD),
  ])

  const T1: PorterEntry[] = t1.map(row => {
    const coverDay = g(row, 'Cover Day ', 'Cover Day')
    const cd = parseDate(coverDay)
    const hrs = parseFloat(g(row, 'Hours')) || 0
    const porter = g(row, 'Porter')
    if (!porter || !hrs) return null
    return makeEntry(g(row,'ID'), 'T1', row, {
      employeeNumber: porter,
      porterName: g(row, 'Requesting Manager Porter Name', 'Porter'),
      coverDay: cd ? cd.toISOString().split('T')[0] : coverDay,
      hours: hrs,
      hoursType: g(row, 'Are these regular hours or OT?') || 'Regular',
    }, end)
  }).filter((e): e is PorterEntry => !!e && inPeriod(e) && notClosed(e))

  const T2: PorterEntry[] = [...t2m, ...t2c].map(row => {
    const coverDay = g(row, 'Cover Day ', 'Cover Day')
    const cd = parseDate(coverDay)
    const hrs = parseFloat(g(row, 'How many hours?', 'Hours')) || 0
    const porter = g(row, 'Porter ID Covering', 'Porter ID covered')
    if (!porter || !hrs) return null
    const isExtra = g(row, 'Is this a cover or extra hours?').toLowerCase().includes('extra')
    const extraApproved = g(row, 'Are these extra hours approved by manager?')
    return makeEntry(g(row,'ID'), 'T2', row, {
      employeeNumber: porter,
      porterName: g(row, 'Who is doing the covering?', 'Which Porter? Text'),
      coverDay: cd ? cd.toISOString().split('T')[0] : coverDay,
      hours: hrs,
      entryType: isExtra ? 'extra_hours' : 'cover',
      extraHoursApproved: extraApproved === 'TRUE' || extraApproved === 'true',
    }, end)
  }).filter((e): e is PorterEntry => !!e && inPeriod(e) && notClosed(e))

  const T3: PorterEntry[] = [...t3m, ...t3c].map((row, i) => {
    const isChild = i >= t3m.length
    const coverDay = isChild ? g(row,'Date') : g(row,'Cover Day ','Cover Day')
    const cd = parseDate(coverDay)
    const hrs = parseFloat(g(row,'How many Hours?','How many hours?','Hours')) || 0
    const porter = isChild ? g(row,'Concierge or Security ID') : g(row,'Porter')
    if (!porter || !hrs) return null
    return makeEntry(isChild ? g(row,'APP ID') : g(row,'ID'), 'T3', row, {
      employeeNumber: porter,
      porterName: isChild ? g(row,'Concierge or Security Full Name') : g(row,'Porter Name','Who is doing the covering?'),
      coverDay: cd ? cd.toISOString().split('T')[0] : coverDay,
      hours: hrs,
      property: isChild ? g(row,'Address ID') : g(row,'Property'),
      propertyAddress: isChild ? g(row,'Full Address Info') : g(row,'Property Address'),
    }, end)
  }).filter((e): e is PorterEntry => !!e && inPeriod(e) && notClosed(e))

  return { T1, T2, T3 }
}
