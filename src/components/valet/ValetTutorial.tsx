'use client'

import { useState } from 'react'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'

export type TutorialStep = { icon: string; title: string; body: string }

export default function ValetTutorial({ steps, onClose }: { steps: TutorialStep[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.72)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 18 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ background: NAVY, padding: '26px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 42 }}>{step.icon}</div>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 16 }}>
            {steps.map((_, k) => (
              <div key={k} style={{ width: k === i ? 22 : 7, height: 7, borderRadius: 4, background: k === i ? GOLD : '#E5E0D8', transition: 'all .2s' }} />
            ))}
          </div>
          <h2 style={{ color: NAVY, fontSize: 19, margin: '0 0 8px', textAlign: 'center' }}>{step.title}</h2>
          <p style={{ color: '#5B5347', fontSize: 15, lineHeight: 1.55, textAlign: 'center', margin: 0 }}>{step.body}</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {i > 0 && (
              <button onClick={() => setI(i - 1)} style={{ flex: 1, background: '#fff', color: '#5B5347', border: '1.5px solid #D8D2C7', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Back</button>
            )}
            <button onClick={() => (last ? onClose() : setI(i + 1))} style={{ flex: 2, background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {last ? 'Got it' : 'Next'}
            </button>
          </div>
          <button onClick={onClose} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#A89F90', fontSize: 13, cursor: 'pointer' }}>Skip</button>
        </div>
      </div>
    </div>
  )
}

export const ATTENDANT_STEPS: TutorialStep[] = [
  { icon: '👋', title: 'Welcome to BSM Valet', body: 'This app documents every car you park and retrieve with timestamped, logo-stamped photos — your protection on any damage claim.' },
  { icon: '🅿️', title: 'Parking a car', body: 'Tap Park a car, search the resident by name or plate (or add a guest), then take the 5 guided photos: the four corners and the plate.' },
  { icon: '📸', title: 'The 5 photos', body: 'Follow the on-screen prompts for each angle. Each shot is automatically stamped with the time and BSM logo. Retake any photo before saving.' },
  { icon: '🚗', title: 'Retrieving a car', body: 'Tap Retrieve, pick the car from the PARKED list, and take 5 return photos. This records the car\u2019s condition when it goes back to the resident.' },
  { icon: '📶', title: 'Works offline', body: 'No signal in the garage? Keep working — captures save to your phone and sync automatically once you\u2019re back online.' },
  { icon: '🧾', title: 'See any report', body: 'Tap any car under Recent activity to view its photos and download the report. Replay this guide anytime with the ? button.' },
]

export const MANAGER_STEPS: TutorialStep[] = [
  { icon: '👋', title: 'Manager dashboard', body: 'From here you onboard attendants, manage residents, and pull the full history and reports for the building.' },
  { icon: '➕', title: 'Quick add', body: 'The top bar adds an employee (creates their login), a tenant, or a car in one tap — from anywhere in the manager area.' },
  { icon: '👤', title: 'Attendants', body: 'Add an attendant with their name + email; the app creates their login. Use Resend to re-send it, or Deactivate to revoke access.' },
  { icon: '🏠', title: 'Residents & import', body: 'Import your building roster (Excel or CSV) in one pass — it creates units, tenants, and their cars. Add tenants or extra cars manually anytime.' },
  { icon: '🧾', title: 'History & reports', body: 'The History tab is searchable by date, plate, tenant, or attendant. Tap any stay to see the park + retrieve photos and download the branded PDF.' },
  { icon: '🔧', title: 'Fixes', body: 'From a stay you can void a bad capture or force-close a car stuck as parked. Replay this guide anytime with the ? button.' },
]
