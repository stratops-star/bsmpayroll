import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ASANA_TOKEN = process.env.ASANA_TOKEN!
const PROJECT_GID = '1207418330856465'
const SECTION_GID = '1207418330856481'

export async function GET(request: NextRequest) {
  try {
    // Fetch tasks from the Payroll Issues section
    const res = await fetch(
      `https://app.asana.com/api/1.0/sections/${SECTION_GID}/tasks?opt_fields=gid,name,notes,completed,created_at,modified_at,assignee.name,assignee.email,due_on,tags.name,custom_fields.name,custom_fields.display_value&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${ASANA_TOKEN}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Asana API error: ${res.status} — ${err}`)
    }

    const data = await res.json()

    // Filter to only General Issue and Termination tasks (exclude Google Sheet cover/extra hour tasks)
    // Google Sheet tasks typically have a pattern like "Porter Name - Property" 
    // General Issues and Terminations are manually created and don't follow that pattern
    const tasks = (data.data || []).filter((task: any) => {
      const name = task.name?.toLowerCase() || ''
      // Include tasks that look like general issues or terminations
      // Exclude tasks that look like auto-generated sheet entries (contain " - " pattern with property names)
      const isGeneralOrTermination =
        name.includes('general issue') ||
        name.includes('termination') ||
        name.includes('terminate') ||
        name.includes('issue') ||
        name.includes('complaint') ||
        name.includes('incident')
      return isGeneralOrTermination || !name.includes(' - ')
    })

    return NextResponse.json({ tasks })
  } catch (e: any) {
    console.error('Asana Issues error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
