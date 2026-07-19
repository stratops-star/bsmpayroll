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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
