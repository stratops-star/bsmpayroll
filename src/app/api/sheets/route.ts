import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTiers } from '@/lib/sheetParser'
import { createServerClient } from '@/lib/supabase-server'
import { PorterEntry, Tier } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  const fresh = searchParams.get('fresh') === 'true'

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    // Check if we have cached data for this period (unless fresh=true)
    if (!fresh) {
      const { data: cached, error } = await supabase
        .from('porter_entries')
        .select('id, tier, data')
        .eq('period_start', start)
        .eq('period_end', end)
        .limit(5000)

      if (!error && cached && cached.length > 0) {
        // Return from cache
        const result: Record<Tier, PorterEntry[]> = { T1: [], T2: [], T3: [] }
        for (const row of cached) {
          const tier = row.tier as Tier
          if (result[tier]) {
            result[tier].push(row.data as PorterEntry)
          }
        }
        return NextResponse.json({ ...result, fromCache: true })
      }
    }

    // Cache miss or fresh requested — fetch from Google Sheets
    const data = await fetchAllTiers(start, end)

    // Save to cache in background
    const allEntries = [
      ...data.T1.map(e => ({ id: e.id, tier: 'T1', data: e, period_start: start, period_end: end, synced_at: new Date().toISOString() })),
      ...data.T2.map(e => ({ id: e.id, tier: 'T2', data: e, period_start: start, period_end: end, synced_at: new Date().toISOString() })),
      ...data.T3.map(e => ({ id: e.id, tier: 'T3', data: e, period_start: start, period_end: end, synced_at: new Date().toISOString() })),
    ]

    // Upsert in background (don't await)
    const batchSize = 100
    ;(async () => {
      for (let i = 0; i < allEntries.length; i += batchSize) {
        await supabase
          .from('porter_entries')
          .upsert(allEntries.slice(i, i + batchSize), { onConflict: 'id' })
      }
    })()

    return NextResponse.json({ ...data, fromCache: false })
  } catch (e: any) {
    console.error('Sheets error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
