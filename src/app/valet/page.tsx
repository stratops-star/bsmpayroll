'use client'

import ValetGate from '@/components/valet/ValetGate'
import ValetCapture from '@/components/valet/ValetCapture'

export default function ValetPage() {
  return (
    <ValetGate>
      <ValetCapture />
    </ValetGate>
  )
}
