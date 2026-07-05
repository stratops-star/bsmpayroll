import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROJECT = '1207417865507098'
const A = 'https://app.asana.com/api/1.0'

export async function GET() {
  if (!process.env.ASANARECRUITER) return NextResponse.json({ error: 'ASANARECRUITER not set' }, { status: 500 })
  const headers = { Authorization: `Bearer ${process.env.ASANARECRUITER}` }

  // grab first 2 tasks with both plain notes and html_notes
  const url = new URL(`${A}/projects/${PROJECT}/tasks`)
  url.searchParams.set('opt_fields', 'name,notes,html_notes')
  url.searchParams.set('limit', '2')
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) return NextResponse.json({ error: `Asana ${res.status}`, body: await res.text() }, { status: 502 })
  const j = await res.json()

  const tasks = (j.data || []).map((t: any) => ({
    gid: t.gid,
    name: t.name,
    notes_raw: t.notes,
    notes_first_400: (t.notes || '').slice(0, 400),
    html_notes_first_600: (t.html_notes || '').slice(0, 600),
  }))
  return NextResponse.json({ count: tasks.length, tasks }, { headers: { 'content-type': 'application/json' } })
}
