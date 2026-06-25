import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('asana_task_cache')
      .select('*')
      .in('task_type', ['general_issue', 'termination'])
      .order('updated_at', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({ tasks: data || [] })
  } catch (e: any) {
    console.error('Asana issues error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
