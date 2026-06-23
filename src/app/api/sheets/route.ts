import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTiers } from '@/lib/sheetParser'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })
  try {
    const data = await fetchAllTiers(start, end)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
