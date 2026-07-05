import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROJECT = '1207417865507098'
const A = 'https://app.asana.com/api/1.0'
const BOROUGHS = ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island']

function auth() { return { Authorization: `Bearer ${process.env.ASANARECRUITER}` } }
const yesNo = (v?: string) => { if (!v) return null; if (/^\s*(y|yes|si|sí)/i.test(v)) return true; if (/^\s*(n|no)/i.test(v)) return false; return null }

// Jotform-style labels (end with : or ::). Value is on the following line(s), until the next label.
// Labels may end with "?:" or "::" — the value is on the following line(s).
// [^\n]*? stays on the label line and absorbs any trailing "?" before the colon.
const FIELDS: [RegExp, string][] = [
  [/full name[^\n]*?:{1,2}/i, 'full_name'],
  [/current address[^\n]*?:{1,2}/i, 'address'],
  [/(?:what is your cellphone|cellphone|phone number|tel[eé]fono)[^\n]*?:{1,2}/i, 'phone'],
  [/email address[^\n]*?:{1,2}/i, 'email'],
  [/who referred you[^\n]*?:{1,2}/i, 'referral'],
  [/languages spoken[^\n]*?:{1,2}/i, 'languages'],
  [/english proficiency[^\n]*?:{1,2}/i, 'english'],
  [/what position[^\n]*?:{1,2}/i, 'position'],
  [/do you have any training[^\n]*?:{1,2}/i, 'training'],
  [/what areas are you open to work[^\n]*?:{1,2}/i, 'areas'],
  [/valid driver['’`]?s? license[^\n]*?:{1,2}/i, 'license'],
  [/means of transportation[^\n]*?:{1,2}/i, 'transportation'],
  [/date available to start[^\n]*?:{1,2}/i, 'start_date'],
  [/weekends\s*\/?\s*holidays[^\n]*?:{1,2}/i, 'weekends'],
  [/preferred shift[^\n]*?:{1,2}/i, 'shift'],
  [/are you able to perform the essential functions[\s\S]*?:{1,2}/i, 'lift50'],
  [/do you have a bank account[^\n]*?:{1,2}/i, 'bank'],
  [/what is your expected pay[^\n]*?:{1,2}/i, 'pay'],
  [/legally eligible to work[^\n]*?:{1,2}/i, 'eligible'],
  [/social security number[^\n]*?:{1,2}/i, 'ss'],
  [/highest level of education[^\n]*?:{1,2}/i, 'education'],
  [/other relevant education[^\n]*?:{1,2}/i, 'other_education'],
  [/did you graduate[^\n]*?:{1,2}/i, 'graduate'],
  [/relevant certifications[^\n]*?:{1,2}/i, 'certifications'],
]

function extract(notes: string) {
  const hits: { key: string; start: number; end: number }[] = []
  for (const [re, key] of FIELDS) {
    const m = notes.match(re)
    if (m && m.index != null) hits.push({ key, start: m.index, end: m.index + m[0].length })
  }
  hits.sort((a, b) => a.start - b.start)
  const fm = notes.match(/—{3,}|-{6,}|This task was submitted/i)
  const footer = fm && fm.index != null ? fm.index : notes.length
  const out: Record<string, string> = {}
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]
    let end = i + 1 < hits.length ? hits[i + 1].start : footer
    if (end > footer) end = footer
    const val = notes.slice(h.end, Math.max(h.end, end)).trim()
    if (out[h.key] == null) out[h.key] = val
  }
  return out
}

function toCandidate(gid: string, permalink: string, title: string, notes: string) {
  if (!/full name\s*:{1,2}/i.test(notes || '')) return null // not a candidate profile
  const f = extract(notes || '')
  const titleName = (title || '').split(',')[0].trim()
  const full_name = (f.full_name && f.full_name.trim()) || titleName
  if (!full_name) return null

  const positions = f.position ? f.position.split(/[,/]| and | y /i).map(s => s.trim()).filter(Boolean) : null
  const borough = f.address ? (BOROUGHS.find(b => f.address.toLowerCase().includes(b.toLowerCase())) || null) : null
  let work_areas: string[] | null = null
  if (f.areas) { const g = BOROUGHS.filter(b => f.areas.toLowerCase().includes(b.toLowerCase())); work_areas = g.length ? g : /open|all|todos|any|cualquier/i.test(f.areas) ? [...BOROUGHS] : null }
  const payNums = (f.pay || '').match(/\d+(\.\d+)?/g)?.map(Number) || []
  const hasRange = /[-/]|to|a\b/i.test(f.pay || '') && payNums.length >= 2
  const preferred_lang = /espa|spanish/i.test(f.languages || '') ? 'es' : 'en'
  const email = f.email && f.email.includes('@') ? f.email.trim() : null
  const phone = f.phone ? f.phone.trim() : null

  const onboarding: Record<string, any> = {
    start_date: f.start_date, shift: f.shift, education: f.education, other_education: f.other_education,
    graduated: f.graduate, certifications: f.certifications, us_eligible: f.eligible, lift_50: f.lift50,
    drivers_license: f.license, areas_answer: f.areas, languages: f.languages, address: f.address, expected_pay_raw: f.pay,
  }
  Object.keys(onboarding).forEach(k => { if (!onboarding[k]) delete onboarding[k] })

  return {
    intake_channel: 'asana_import', status: 'in_pool', in_pool: true, stage: 'available', asana_task_id: gid, asana_url: permalink,
    full_name, phone, email, preferred_lang,
    positions, borough, state: borough ? 'NY' : null, work_areas, address: f.address || null,
    referral_source: f.referral || null, english_level: f.english || null,
    transportation: f.transportation || null,
    training: yesNo(f.training), has_bank_account: yesNo(f.bank), has_ss: yesNo(f.ss),
    weekends_holidays: yesNo(f.weekends),
    availability: yesNo(f.weekends) === true ? 'All' : yesNo(f.weekends) === false ? 'Weekdays' : null,
    pay_min: hasRange ? payNums[0] : null, pay_max: hasRange ? payNums[1] : null,
    expected_pay: f.pay ? f.pay.trim() : null,
    onboarding: Object.keys(onboarding).length ? onboarding : null,
  }
}

async function importAttachments(supabase: any, gid: string) {
  const paths: Record<string, string> = {}
  try {
    const r = await fetch(`${A}/tasks/${gid}/attachments?opt_fields=name,download_url`, { headers: auth() })
    const j = await r.json()
    for (const att of (j.data || [])) {
      if (!att.download_url) continue
      const ext = (att.name || '').toLowerCase().split('.').pop() || ''
      let bucket = '', col = ''
      if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) { bucket = 'candidate-photos'; col = 'photo_path' }
      else if (['mp4', 'mov', 'm4v', 'webm'].includes(ext)) { bucket = 'candidate-videos'; col = 'video_path' }
      else if (['pdf', 'doc', 'docx'].includes(ext)) { bucket = 'candidate-resumes'; col = 'resume_path' }
      else continue
      if (paths[col]) continue
      const file = await fetch(att.download_url)
      if (Number(file.headers.get('content-length') || 0) > 40 * 1024 * 1024) continue
      const buf = Buffer.from(await file.arrayBuffer())
      const path = `${gid}-${col}.${ext}`
      const { error } = await supabase.storage.from(bucket).upload(path, buf, { upsert: true, contentType: file.headers.get('content-type') || undefined })
      if (!error) paths[col] = path
    }
  } catch {}
  return paths
}

export async function POST(req: NextRequest) {
  if (!process.env.ASANARECRUITER) return NextResponse.json({ error: 'ASANARECRUITER token not set in environment' }, { status: 500 })
  const { offset, limit = 5 } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const url = new URL(`${A}/projects/${PROJECT}/tasks`)
  url.searchParams.set('opt_fields', 'name,notes,permalink_url,completed') // include completed candidate tasks
  url.searchParams.set('limit', String(limit))
  if (offset) url.searchParams.set('offset', offset)

  const res = await fetch(url.toString(), { headers: auth() })
  if (!res.ok) return NextResponse.json({ error: `Asana ${res.status}: ${await res.text()}` }, { status: 502 })
  const j = await res.json()
  const tasks = j.data || []

  // build candidate rows first
  const built: { gid: string; row: any }[] = []
  let notCandidate = 0
  for (const t of tasks) {
    const row = toCandidate(t.gid, t.permalink_url || '', t.name || '', t.notes || '')
    if (!row) { notCandidate++; continue }
    built.push({ gid: t.gid, row })
  }

  // skip tasks already imported (by asana id) and people already present (by name)
  const gids = built.map(b => b.gid)
  const nameList = built.map(b => b.row.full_name)
  const [{ data: byId }, { data: byName }] = await Promise.all([
    gids.length ? supabase.from('candidates').select('asana_task_id').in('asana_task_id', gids) : Promise.resolve({ data: [] }),
    nameList.length ? supabase.from('candidates').select('full_name').in('full_name', nameList) : Promise.resolve({ data: [] }),
  ])
  const haveId = new Set((byId || []).map((r: any) => r.asana_task_id))
  const haveName = new Set((byName || []).map((r: any) => (r.full_name || '').toLowerCase()))
  const seen = new Set<string>()

  let imported = 0, skipped = 0
  const names: string[] = []
  for (const { gid, row } of built) {
    const nl = row.full_name.toLowerCase()
    if (haveId.has(gid) || haveName.has(nl) || seen.has(nl)) { skipped++; continue }
    seen.add(nl)
    Object.assign(row, await importAttachments(supabase, gid))
    const { error } = await supabase.from('candidates').insert(row)
    if (error) { skipped++ } else { imported++; names.push(row.full_name) }
  }

  return NextResponse.json({ imported, skipped, notCandidate, names, nextOffset: j.next_page?.offset || null, done: !j.next_page })
}
