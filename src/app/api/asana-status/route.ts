import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('asana_task_cache')
      .select('completed')
      .eq('task_id', taskId)
      .single()

    return NextResponse.json({ completed: data?.completed === true })
  } catch {
    return NextResponse.json({ completed: false })
  }
}
