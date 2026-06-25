import { PorterEntry } from './types'
import { fmtSlash } from './payPeriod'
import { escapeCSV } from './csvUtils'

const COLS = [
  'EmployeeNumber','PayNumber','PayCode','Hours','Rate','Amount','RateCode',
  'CostCenter1','CostCenter2','CostCenter3','CostCenter4','CostCenter5',
  'Job','Task','PeriodBegin','PeriodEnd','JobMapCode','RecordType','CheckType',
  'DateWorked','EntryType','StubMessage','TaxLocation'
]

// Tier #2 always exports with this job code regardless of what's on the entry
const T2_JOB_CODE = '203 BSM RD'

export function buildCSV(entries: PorterEntry[], start: string, end: string): string {
  const rows = entries.map(e => {
    const payCode = e.hoursType?.toUpperCase() === 'OT' ? 'OT' : 'RG'
    const entryLabel = e.entryType === 'billable' ? 'Billable' : e.entryType === 'extra_hours' ? 'Extra Hrs' : 'Cover'
    const propShort = (e.propertyAddress || e.property || '').split(',')[0]
    const stubMsg = e.extraDetails || `${entryLabel} - ${propShort}`.trim()

    // Tier #2 always uses the fixed T2 job code
    const jobCode = e.tier === 'T2' ? T2_JOB_CODE : (e.jobCode || '')

    const row: Record<string, string> = {
      EmployeeNumber: e.employeeNumber,
      PayNumber: '1',
      PayCode: payCode,
      Hours: String(e.hours),
      Rate: e.rate || '',
      Amount: '',
      RateCode: '',
      CostCenter1: '', CostCenter2: '', CostCenter3: '',
      CostCenter4: '', CostCenter5: '',
      Job: jobCode,
      Task: '',
      PeriodBegin: start ? fmtSlash(new Date(start)) : '',
      PeriodEnd: end ? fmtSlash(new Date(end)) : '',
      JobMapCode: '',
      RecordType: 'E',
      CheckType: '',
      DateWorked: e.coverDay ? fmtSlash(new Date(e.coverDay)) : '',
      EntryType: '',
      StubMessage: stubMsg.substring(0, 100),
      TaxLocation: '',
    }
    return COLS.map(c => escapeCSV(row[c] || '')).join(',')
  })
  return [COLS.join(','), ...rows].join('\n')
}
