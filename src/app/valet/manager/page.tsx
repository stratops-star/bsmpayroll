'use client'

import ValetGate from '@/components/valet/ValetGate'
import ValetManager from '@/components/valet/ValetManager'

export default function ValetManagerPage() {
  return (
    <ValetGate require="manager">
      <ValetManager />
    </ValetGate>
  )
}
