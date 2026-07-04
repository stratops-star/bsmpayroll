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
const num = (v?: string) => { if (!v) return null; const m = v.match(/\d+/); return m ? parseInt(m[0], 10) : null }

const TOP: Record<string, string> = {
  'name': 'full_name', 'nationality': 'nationality', 'age': 'age', 'contact': 'phone', 'ethnicity': 'ethnicity',
  'position': 'position', 'referral': 'referral_source', 'location': 'loc', 'open to work area': 'open',
  'training': 'training', 'time in usa': 'time_in_usa', 'family': 'family', 'expected pay': 'pay',
  'tax id': 'has_tax_id', 'ss': 'has_ss', 'bank account': 'has_bank_account', 'weekends / holidays': 'weekends',
  'mode of transportation': 'transportation', 'email address': 'email', 'email': 'email', 'english level': 'english_level',
}
const SECTIONS = ['relevant experience', 'availability', 'strengths', 'location']

function parse(notes: string) {
  const lines = (notes || '').replace(/\r/g, '').split('\n')
  const out: Record<string, string> = {}
  const sec: Record<string, string[]> = { experience: [], 'relevant experience': [], availability: [], strengths: [], location: [] }
  const onboarding: Record<string, string> = {}
  let mode: 'top' | 'experience' | 'section' | 'onboarding' = 'top'
  let cur = ''
  for (const raw of lines) {
    const line = raw.trim()
    const low = line.toLowerCase()
    if (low.includes('onboarding details')) { mode = 'onboarding'; continue }
    if (/^[.\s·]{5,}$/.test(line)) continue
    if (!line) continue
    if (mode === 'onboarding') { const m = line.match(/^([^:]+):\s*(.*)$/); if (m) onboarding[m[1].trim()] = m[2].trim(); continue }
    if (!line.includes(':') && SECTIONS.includes(low)) { cur = low; mode = 'section'; continue }
    const lm = line.match(/^([^:]+):\s*(.*)$/)
    if (lm) {
      const label = lm[1].trim().toLowerCase(); const val = lm[2].trim()
      if (label === 'experience') { mode = 'experience'; if (val) sec.experience.push(val); continue }
      if (TOP[label] && mode === 'top') { out[TOP[label]] = val; continue }
    }
    if (mode === 'experience') sec.experience.push(line)
    else if (mode === 'section' && cur) sec[cur].push(line)
  }
  return { out, sec, onboarding }
}

function toCandidate(gid: string, permalink: string, notes: string) {
  const { out, sec, onboarding } = parse(notes)
  const experience = [sec.experience, sec['relevant experience'], sec.location].map(a => a.join('\n')).filter(Boolean).join('\n\n') || null
  const strengths = sec.strengths.join(' ') || null
  const availability_notes = sec.availability.join(' ') || null
  const positions = out.position ? out.position.split(/[,/]| and /i).map(s => s.trim()).filter(Boolean) : null
  const borough = out.loc && BOROUGHS.find(b => b.toLowerCase() === out.loc.toLowerCase()) || null
  let work_areas: string[] | null = null
  if (out.open) {
    const found = BOROUGHS.filter(b => out.open.toLowerCase().includes(b.toLowerCase()))
    work_areas = found.length ? found : /open|all|todos/i.test(out.open) ? [...BOROUGHS] : null
  }
  const nums = (out.pay || '').match(/\d+(\.\d+)?/g)?.map(Number) || []
  const weekends = yesNo(out.weekends)
  return {
    intake_channel: 'asana_import', status: 'in_pool', in_pool: true, stage: 'available',
    asana_task_id: gid, asana_url: permalink,
    full_name: out.full_name || 'Unknown', phone: out.phone || null, email: out.email || null,
    preferred_lang: 'es',
    positions, borough, state: borough ? 'NY' : null, work_areas,
    nationality: out.nationality || null, ethnicity: out.ethnicity || null, age: num(out.age),
    referral_source: out.referral_source || null, time_in_usa: out.time_in_usa || null,
    training: yesNo(out.training), has_ss: yesNo(out.has_ss), has_bank_account: yesNo(out.has_bank_account),
    has_tax_id: out.has_tax_id ? true : null, weekends_holidays: weekends,
    availability: weekends === true ? 'All' : weekends === false ? 'Weekdays' : null,
    transportation: out.transportation || null, english_level: out.english_level || null,
    pay_min: nums[0] ?? null, pay_max: nums[1] ?? null,
    expected_pay: out.pay ? (nums.length >= 2 ? `$${nums[0]}–${nums[1]}/hr` : out.pay) : null,
    experience, strengths, availability_notes,
    onboarding: (Object.keys(onboarding).length || out.family) ? { ...onboarding, family: out.family || undefined } : null,
  }
}

async function importAttachments(supabase: any, gid: string) {
  const paths: Record<string, string> = {}
  try {
    const r = await fetch(`${A}/tasks/${gid}/attachments?opt_fields=name,download_url,resource_subtype`, { headers: auth() })
    const j = await r.json()
    for (const att of (j.data || [])) {
      if (!att.download_url) continue
      const name = (att.name || '').toLowerCase()
      const ext = name.split('.').pop() || ''
      let bucket = '', col = ''
      if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) { bucket = 'candidate-photos'; col = 'photo_path' }
      else if (['mp4', 'mov', 'm4v', 'webm'].includes(ext)) { bucket = 'candidate-videos'; col = 'video_path' }
      else if (['pdf', 'doc', 'docx'].includes(ext)) { bucket = 'candidate-resumes'; col = 'resume_path' }
      else continue
      if (paths[col]) continue // keep first of each type
      const file = await fetch(att.download_url)
      const len = Number(file.headers.get('content-length') || 0)
      if (len > 40 * 1024 * 1024) continue // skip >40MB
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
  const { offset, limit = 4 } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const url = new URL(`${A}/projects/${PROJECT}/tasks`)
  url.searchParams.set('opt_fields', 'name,notes,permalink_url')
  url.searchParams.set('limit', String(limit))
  if (offset) url.searchParams.set('offset', offset)

  const res = await fetch(url.toString(), { headers: auth() })
  if (!res.ok) return NextResponse.json({ error: `Asana ${res.status}: ${await res.text()}` }, { status: 502 })
  const j = await res.json()
  const tasks = j.data || []

  const gids = tasks.map((t: any) => t.gid)
  const { data: existing } = await supabase.from('candidates').select('asana_task_id').in('asana_task_id', gids)
  const have = new Set((existing || []).map((r: any) => r.asana_task_id))

  let imported = 0, skipped = 0
  const names: string[] = []
  for (const t of tasks) {
    if (have.has(t.gid)) { skipped++; continue }
    const row: any = toCandidate(t.gid, t.permalink_url || '', t.notes || '')
    const files = await importAttachments(supabase, t.gid)
    Object.assign(row, files)
    const { error } = await supabase.from('candidates').insert(row)
    if (error) { skipped++ } else { imported++; names.push(row.full_name) }
  }

  return NextResponse.json({ imported, skipped, names, nextOffset: j.next_page?.offset || null, done: !j.next_page })
}
