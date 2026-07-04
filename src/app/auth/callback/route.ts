import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const DOMAIN = 'bsmfacilitysolutions.com'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/hub'
  console.log('Auth callback hit, code present:', !!code)
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
    console.log('Exchange result - error:', error?.message, 'user:', data?.user?.email)
    if (!error && data.user) {
      const email = data.user.email?.toLowerCase() || ''
      if (!email.endsWith(`@${DOMAIN}`)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
      }
      return response
    }
  }
  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
