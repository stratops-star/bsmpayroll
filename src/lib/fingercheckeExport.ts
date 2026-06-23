import { PorterEntry } from './types'
import { fmtSlash } from './payPeriod'
import { escapeCSV } from './csvUtils'

const COLS = ['EmployeeNumber','PayNumber','PayCode','Hours','Rate','Amount','RateCode',
  'CostCenter1','CostCenter2','CostCenter3','CostCenter4','CostCenter5','Job','Task',
  'PeriodBegin','PeriodEnd','JobMapCode','RecordType','CheckType','DateWorked',
  'EntryType','StubMessage','TaxLocation']

export function buildCSV(entries: PorterEntry[], start: string, end: string): string {
  const rows = entries.map(e => {
    const payCode = e.hoursType?.toUpperCase() === 'OT' ? 'OT' : 'RG'
    const row: Record<string, string> = {
      EmployeeNumber: e.employeeNumber, PayNumber: '1', PayCode: payCode,
      Hours: String(e.hours), Rate: e.rate || '', Amount: '',
      RateCode: '', CostCenter1: '', CostCenter2: '', CostCenter3: '', CostCenter4: '', CostCenter5: '',
      Job: '', Task: '',
      PeriodBegin: start ? fmtSlash(new Date(start)) : '',
      PeriodEnd: end ? fmtSlash(new Date(end)) : '',
      JobMapCode: '', RecordType: '', CheckType: '',
      DateWorked: e.coverDay ? fmtSlash(new Date(e.coverDay)) : '',
      EntryType: '', StubMessage: '', TaxLocation: '',
    }
    return COLS.map(c => escapeCSV(row[c] || '')).join(',')
  })
  return [COLS.join(','), ...rows].join('\n')
}
