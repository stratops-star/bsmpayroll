export interface PayPeriod { start: Date; end: Date; payday: Date; label: string }

export function getCurrentPeriodStart(from: Date = new Date()): Date {
  const d = new Date(from); d.setHours(0,0,0,0)
  const day = d.getDay()
  const diff = day >= 3 ? day - 3 : day + 4
  d.setDate(d.getDate() - diff)
  return d
}

export function getCurrentPeriod(from: Date = new Date()): PayPeriod {
  const start = getCurrentPeriodStart(from)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  const payday = new Date(end); payday.setDate(end.getDate() + 3)
  return { start, end, payday, label: `${fmt(start)} – ${fmt(end)}` }
}

export function getPreviousPeriod(from: Date = new Date()): PayPeriod {
  const start = getCurrentPeriodStart(from)
  const prev = new Date(start); prev.setDate(start.getDate() - 7)
  return getCurrentPeriod(prev)
}

export function fmt(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtISO(d: Date): string { return d.toISOString().split('T')[0] }

export function fmtSlash(d: Date): string {
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`
}

export function fmtEST(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short',
    day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' EST'
}

export function isLastMinute(subDate: Date, periodEnd: Date): boolean {
  const cutoff = new Date(periodEnd); cutoff.setHours(23,59,59,999)
  const window = new Date(cutoff); window.setHours(window.getHours() - 24)
  return subDate >= window && subDate <= cutoff
}
