import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ASANA_TOKEN = process.env.ASANA_TOKEN!

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  try {
    const res = await fetch(
      `https://app.asana.com/api/1.0/tasks/${taskId}?opt_fields=gid,completed`,
      {
        headers: {
          Authorization: `Bearer ${ASANA_TOKEN}`,
          Accept: 'application/json',
        },
      }
    )

    if (!res.ok) {
      return NextResponse.json({ completed: false })
    }

    const data = await res.json()
    return NextResponse.json({ completed: data.data?.completed === true })
  } catch {
    return NextResponse.json({ completed: false })
  }
}
