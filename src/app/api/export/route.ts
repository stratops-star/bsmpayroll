import { NextRequest, NextResponse } from 'next/server'
import { PorterEntry } from '@/lib/types'
import { buildCSV } from '@/lib/fingercheckeExport'
import { postEntered } from '@/lib/asana'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { entries, periodStart, periodEnd, userEmail } = await request.json() as {
    entries: PorterEntry[]; periodStart: string; periodEnd: string; userEmail: string
  }

  const approved = entries.filter(e => e.approvalStatus === 'approved')
  if (!approved.length) return NextResponse.json({ error: 'No approved entries' }, { status: 400 })

  // Post to Asana — cover completes, extra/billable assigns to billing
  await Promise.allSettled(
    approved.filter(e => e.asanaId).map(e =>
      postEntered(e.asanaId, periodStart, periodEnd, e.entryType)
    )
  )

  const csv = buildCSV(approved, periodStart, periodEnd)
  const filename = `fingercheck_${periodStart}_${periodEnd}.csv`
  const totalHours = approved.reduce((s, e) => s + e.hours, 0)
  const tiersArr = Array.from(new Set(approved.map(e => e.tier)))

  try {
    const supabase = createServerClient()
    const { data: rec } = await supabase.from('exports').insert({
      filename,
      period_start: periodStart,
      period_end: periodEnd,
      exported_by: userEmail,
      total_entries: approved.length,
      total_hours: totalHours,
      tiers: tiersArr,
    }).select().single()

    if (rec) {
      // Fix: fetch saved rates from Supabase to ensure rate is populated at export time
      const sourceIds = approved.map(e => e.id)
      const { data: savedRates } = await supabase
        .from('entry_rates')
        .select('source_id, rate')
        .in('source_id', sourceIds)

      const rateMap: Record<string, string> = {}
      for (const r of savedRates || []) {
        rateMap[r.source_id] = r.rate
      }

      await supabase.from('export_rows').insert(
        approved.map(e => ({
          export_id: rec.id,
          tier: e.tier,
          employee_number: e.employeeNumber,
          porter_name: e.porterName,
          date_worked: e.coverDay,
          hours: e.hours,
          pay_code: e.hoursType?.toUpperCase() === 'OT' ? 'OT' : 'RG',
          rate: rateMap[e.id] || e.rate || null,  // prefer DB rate, fallback to entry rate
          property: e.property,
          property_address: e.propertyAddress,
          manager: e.manager,
          asana_link: e.asanaLink,
          asana_id: e.asanaId,
          period_begin: periodStart,
          period_end: periodEnd,
          entry_type: e.entryType,
          source_id: e.id,
          job: e.jobCode || null,
          extra_details: e.extraDetails || null,
        }))
      )
    }
  } catch (e) {
    console.error('Supabase export error:', e)
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
