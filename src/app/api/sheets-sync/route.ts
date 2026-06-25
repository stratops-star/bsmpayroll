import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTiers } from '@/lib/sheetParser'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { periodStart, periodEnd } = await request.json() as { periodStart: string; periodEnd: string }

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd required' }, { status: 400 })
    }

    // Fetch fresh data from Google Sheets
    const data = await fetchAllTiers(periodStart, periodEnd)

    const supabase = createServerClient()

    // Flatten all entries
    const allEntries = [
      ...data.T1.map(e => ({ id: e.id, tier: 'T1', data: e, period_start: periodStart, period_end: periodEnd, synced_at: new Date().toISOString() })),
      ...data.T2.map(e => ({ id: e.id, tier: 'T2', data: e, period_start: periodStart, period_end: periodEnd, synced_at: new Date().toISOString() })),
      ...data.T3.map(e => ({ id: e.id, tier: 'T3', data: e, period_start: periodStart, period_end: periodEnd, synced_at: new Date().toISOString() })),
    ]

    // Upsert in batches of 100
    const batchSize = 100
    for (let i = 0; i < allEntries.length; i += batchSize) {
      await supabase
        .from('porter_entries')
        .upsert(allEntries.slice(i, i + batchSize), { onConflict: 'id' })
    }

    return NextResponse.json({
      synced: allEntries.length,
      T1: data.T1.length,
      T2: data.T2.length,
      T3: data.T3.length,
    })
  } catch (e: any) {
    console.error('Sheets sync error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
