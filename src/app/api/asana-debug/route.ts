import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT = '1207417865507098'
const A = 'https://app.asana.com/api/1.0'

export async function GET(req: NextRequest) {
  if (!process.env.ASANARECRUITER) return NextResponse.json({ error: 'ASANARECRUITER not set' }, { status: 500 })
  const headers = { Authorization: `Bearer ${process.env.ASANARECRUITER}` }
  const gid = req.nextUrl.searchParams.get('gid')

  // dump ONE task fully
  if (gid) {
    const r = await fetch(`${A}/tasks/${gid}?opt_fields=name,notes,html_notes,completed`, { headers })
    if (!r.ok) return NextResponse.json({ error: `Asana ${r.status}`, body: await r.text() }, { status: 502 })
    const j = await r.json()
    return NextResponse.json({ gid, name: j.data?.name, completed: j.data?.completed, notes: j.data?.notes, html_notes: j.data?.html_notes })
  }

  // otherwise LIST task names + a snippet so we can see the mix
  const out: any[] = []
  let offset: string | null = null, guard = 0
  while (guard++ < 6) {
    const url = new URL(`${A}/projects/${PROJECT}/tasks`)
    url.searchParams.set('opt_fields', 'name,notes,completed')
    url.searchParams.set('limit', '50')
    if (offset) url.searchParams.set('offset', offset)
    const r = await fetch(url.toString(), { headers })
    if (!r.ok) return NextResponse.json({ error: `Asana ${r.status}`, body: await r.text() }, { status: 502 })
    const j = await r.json()
    for (const t of (j.data || [])) {
      const notes = (t.notes || '').replace(/\n/g, ' ⏎ ')
      out.push({ gid: t.gid, name: t.name, completed: t.completed, looks_like_candidate: /name\s*:/i.test(t.notes || ''), snippet: notes.slice(0, 90) })
    }
    offset = j.next_page?.offset || null
    if (!offset) break
  }
  const candidates = out.filter(t => t.looks_like_candidate).length
  return NextResponse.json({ total: out.length, looks_like_candidate: candidates, tasks: out })
}
