import { NextRequest, NextResponse } from 'next/server'
import { postClosed } from '@/lib/asana'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { entry, reason, periodStart, periodEnd, userEmail } = await request.json()
  if (entry.asanaId) await postClosed(entry.asanaId, reason, periodStart, periodEnd)
  try {
    const supabase = createServerClient()
    await supabase.from('closed_entries').insert({
      source_id: entry.id, tier: entry.tier, employee_number: entry.employeeNumber,
      porter_name: entry.porterName, date_worked: entry.coverDay, hours: entry.hours,
      property_address: entry.propertyAddress, manager: entry.manager,
      asana_link: entry.asanaLink, closed_by: userEmail, reason,
      period_start: periodStart, period_end: periodEnd,
    })
  } catch (e) { console.error('Supabase close error:', e) }
  return NextResponse.json({ success: true })
}
