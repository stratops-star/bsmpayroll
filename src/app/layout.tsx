import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@/styles/bsm-theme.css'
import { ThemeProvider, themeInitScript } from '@/components/theme'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BSM Facility Solutions',
  description: 'BSM Facility Solutions — Operations Platform for payroll, recruiting, and valet.',
  manifest: '/platform.webmanifest',
  appleWebApp: { capable: true, title: 'BSM', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#1E1B17',
  // NOTE: colorScheme is intentionally NOT set here. bsm-theme.css sets
  // `color-scheme` per theme ([data-theme='dark'|'light']), so native controls
  // follow the user's choice. Hard-coding it here would pin them to one mode.
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: themeInitScript sets data-theme on <html> before
    // React hydrates, so the server and client markup intentionally differ here.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the theme BEFORE first paint so there's no flash of the wrong mode. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />

        {/* Warm the connection to Supabase so the first query skips DNS + TLS setup. */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
      </head>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
