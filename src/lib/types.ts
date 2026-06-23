export type Tier = 'T1' | 'T2' | 'T3'
export type ApprovalStatus = 'open' | 'approved' | 'pending' | 'waiting' | 'closed' | 'exported'
export type EntryType = 'cover' | 'extra_hours' | 'billable'

export interface PorterEntry {
  id: string
  tier: Tier
  entryType: EntryType
  entryTypeLabel?: string
  employeeNumber: string
  porterName: string
  manager: string
  coverDay: string
  submissionDay: string
  hours: number
  hoursType: string
  property: string
  propertyAddress: string
  jobCode: string
  asanaLink: string
  asanaId: string
  rate: string
  status: string
  extraHoursApproved?: boolean
  approvalStatus: ApprovalStatus
  isLastMinute: boolean
  closedReason?: string
  porterStatus?: string
  buildingStatus?: string
  buildingMaxRate?: string
  totalPay?: string
  totalCharge?: string
  isApartmentCleaned?: string
  apartmentNumber?: string
  extraDetails?: string
  screenshotUrl?: string
  service?: string
  earning?: string
  reasonForCoverage?: string
}

export interface ExportRecord {
  id: string
  filename: string
  period_start: string
  period_end: string
  exported_by: string
  exported_at: string
  total_entries: number
  total_hours: number
  tiers: string[]
}
