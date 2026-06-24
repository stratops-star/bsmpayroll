import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    // Use ANON key for OAuth code exchange — service role key doesn't work here
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email?.toLowerCase() || ''

      // Check whitelist
      if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
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
