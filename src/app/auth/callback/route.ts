import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const ALLOWED_EMAILS = [
  'strat.ops@bsmfacilitysolutions.com',
  'pinny@bsmfacilitysolutions.com',
  'payroll@bsmfacilitysolutions.com',
]

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email?.toLowerCase() || ''

      // Check whitelist
      if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
        // Sign them out immediately
        await supabase.auth.signOut()
        return NextResponse.redirect(
          new URL('/login?error=unauthorized', request.url)
        )
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
