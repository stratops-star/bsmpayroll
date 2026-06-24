import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
    const response = NextResponse.redirect(new URL(next, request.url))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email?.toLowerCase() || ''
      if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(
          new URL('/login?error=unauthorized', request.url)
        )
      }
      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
