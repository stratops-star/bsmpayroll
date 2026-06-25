import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const newOnly = searchParams.get('new') === 'true'

    const supabase = createServerClient()

    let query = supabase
      .from('fingercheck_employees')
      .select('*')
      .order('full_name', { ascending: true })
      .limit(500)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,employee_number.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let employees = data || []

    if (newOnly) {
      employees = employees.filter(e => {
        const hireDate = e.raw_data?._hireDate
        return hireDate && new Date(hireDate) >= thirtyDaysAgo
      })
    }

    return NextResponse.json({ employees })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
