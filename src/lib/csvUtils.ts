export function parseCSVText(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (!lines.length) return []
  const headers = parseRow(lines[0])
  return lines.slice(1).map(line => {
    const vals = parseRow(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim() })
    return obj
  })
}

export function parseRow(line: string): string[] {
  const result: string[] = []; let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else { cur += c }
  }
  result.push(cur); return result
}

export function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`
  return val
}

export function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s); return isNaN(d.getTime()) ? null : d
}
