import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { sourceId, tier, rate, periodStart, periodEnd } = await request.json()
  try {
    const supabase = createServerClient()
    await supabase.from('entry_rates').upsert({
      source_id: sourceId,
      tier,
      rate,
      period_start: periodStart,
      period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source_id' })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const periodStart = searchParams.get('start')
  const periodEnd = searchParams.get('end')
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('entry_rates')
      .select('source_id, rate')
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
    const rateMap: Record<string, string> = {}
    ;(data || []).forEach((r: any) => { rateMap[r.source_id] = r.rate })
    return NextResponse.json({ rates: rateMap })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
