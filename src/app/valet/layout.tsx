import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'BSM Valet',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'BSM Valet', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#1E1B17',
  colorScheme: 'light',   // stop iOS Dark Mode from inverting form fields
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function ValetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
