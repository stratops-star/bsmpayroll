import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.from('exports').select('*').order('exported_at', { ascending: false }).limit(50)
    if (error) throw error
    return NextResponse.json({ exports: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
