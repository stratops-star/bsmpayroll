import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const newOnly = searchParams.get('new') === 'true'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Paginate past the 1000-row Supabase cap
    let allEmployees: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      let query = supabase
        .from('fingercheck_employees')
        .select('employee_number, full_name, email, job_code, address, rate, status, raw_data, rates, profile, synced_at')
        .order('full_name', { ascending: true })
        .range(from, from + pageSize - 1)

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,employee_number.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      allEmployees = [...allEmployees, ...data]
      if (data.length < pageSize) break
      from += pageSize
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let employees = allEmployees
    if (newOnly) {
      employees = employees.filter(e => {
        const hireDate = e.raw_data?._hireDate
        const isNotTerminated = e.status !== 'Terminated'
        return hireDate && new Date(hireDate) >= thirtyDaysAgo && isNotTerminated
      })
    }

    // Fetch last sync time from sync_log
    const { data: syncLogRow } = await supabase
      .from('sync_log')
      .select('synced_at')
      .eq('id', 'fingercheck_employees')
      .single()

    return NextResponse.json({
      employees,
      last_synced_at: syncLogRow?.synced_at || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
