import { NextRequest, NextResponse } from 'next/server'
import { postEntered } from '@/lib/asana'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { asanaId, periodStart, periodEnd } = await request.json()
  if (!asanaId) return NextResponse.json({ success: false, error: 'No task ID' })
  const result = await postEntered(asanaId, periodStart, periodEnd)
  return NextResponse.json(result)
}
