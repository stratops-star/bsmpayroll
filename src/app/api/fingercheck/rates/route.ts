import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FC_API_URL = (process.env.FINGERCHECK_API_URL || 'https://developer.fingercheck.com/api').replace(/\/$/, '')
const FC_API_KEY = process.env.FINGERCHECK_API_KEY || ''
const FC_SECRET_KEY = process.env.FINGERCHECK_SECRET_KEY || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeNumber = searchParams.get('employeeNumber')

  if (!employeeNumber) return NextResponse.json({ error: 'employeeNumber required' }, { status: 400 })

  try {
    const res = await fetch(`${FC_API_URL}/v1/Employees/GetEmployeePayRatesByEmployeeNumber/${employeeNumber}`, {
      headers: {
        'APIKEY': FC_API_KEY,
        'ClientSecretKey': FC_SECRET_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Fingercheck ${res.status}: ${text}`, rates: [] })
    }

    const data = await res.json()
    const rates = Array.isArray(data) ? data : (data.data || data.Data || data.rates || [])

    return NextResponse.json({ rates })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, rates: [] })
  }
}
