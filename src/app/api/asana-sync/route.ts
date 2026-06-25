import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const ASANA_TOKEN = process.env.ASANA_TOKEN!
const PROJECT_GID = '1207418330856465'

function detectTaskType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('general issue')) return 'general_issue'
  if (n.includes('terminated') || n.includes('termination')) return 'termination'
  if (n.includes('payroll notes') || n.includes('payroll note')) return 'payroll_notes'
  if (n.includes('billable payroll')) return 'billable'
  return 'cover'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Fetch all tasks from the project (paginate if needed)
    let allTasks: any[] = []
    let offset: string | null = null

    do {
      const url = `https://app.asana.com/api/1.0/projects/${PROJECT_GID}/tasks?opt_fields=gid,name,notes,completed,created_at,modified_at,assignee.name,assignee.email,due_on&limit=100${offset ? `&offset=${offset}` : ''}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${ASANA_TOKEN}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `Asana API error: ${res.status} — ${err}` }, { status: 500 })
      }

      const data = await res.json()
      allTasks = [...allTasks, ...(data.data || [])]
      offset = data.next_page?.offset || null
    } while (offset)

    // Upsert all tasks into Supabase cache
    const rows = allTasks.map((task: any) => ({
      task_id: task.gid,
      completed: task.completed === true,
      name: task.name || '',
      notes: task.notes || '',
      assignee: task.assignee?.name || null,
      assignee_email: task.assignee?.email || null,
      due_on: task.due_on || null,
      task_type: detectTaskType(task.name || ''),
      updated_at: new Date().toISOString(),
    }))

    // Upsert in batches of 100
    const batchSize = 100
    for (let i = 0; i < rows.length; i += batchSize) {
      await supabase
        .from('asana_task_cache')
        .upsert(rows.slice(i, i + batchSize), { onConflict: 'task_id' })
    }

    return NextResponse.json({
      synced: rows.length,
      general_issues: rows.filter(r => r.task_type === 'general_issue').length,
      terminations: rows.filter(r => r.task_type === 'termination').length,
      cover: rows.filter(r => r.task_type === 'cover').length,
    })
  } catch (e: any) {
    console.error('Asana sync error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
