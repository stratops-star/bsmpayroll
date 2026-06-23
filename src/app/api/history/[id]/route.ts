import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { buildCSV } from '@/lib/fingercheckeExport'
import { PorterEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: rec } = await supabase.from('exports').select('*').eq('id', params.id).single()
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: rows } = await supabase.from('export_rows').select('*').eq('export_id', params.id)
  if (!rows?.length) return NextResponse.json({ error: 'No rows' }, { status: 404 })
  const entries = rows.map(r => ({
    id: r.source_id, tier: r.tier, entryType: r.entry_type,
    employeeNumber: r.employee_number, porterName: r.porter_name,
    manager: r.manager, coverDay: r.date_worked, submissionDay: r.date_worked,
    hours: r.hours, hoursType: r.pay_code === 'OT' ? 'OT' : 'Regular',
    property: r.property, propertyAddress: r.property_address,
    asanaLink: r.asana_link, asanaId: r.asana_id, rate: r.rate,
    status: 'CLOSED', approvalStatus: 'exported', isLastMinute: false,
  } as PorterEntry))
  const csv = buildCSV(entries, rec.period_start, rec.period_end)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${rec.filename}"`,
    },
  })
}
