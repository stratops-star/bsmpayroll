'use client'

import { useState } from 'react'

const NAVY = '#1E1B17'
const GOLD = '#DCB878'

export type TutorialStep = { icon: string; title: string; body: string }

function TutIcon({ k }: { k: string }) {
  const p = { fill: 'none', stroke: GOLD, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const S = 40
  switch (k) {
    case 'welcome': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M3 20 V8 l4-3 4 3 v12" /><path d="M11 20 V11 l4-3 4 3 v9" />
        <path d="M2 20 h20" /><path d="M6 9 v2 M6 13 v2 M15 13 v2" />
      </svg>
    )
    case 'park': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M7 8 H4 V12 M17 8 H20 V12" />
        <rect x="9.5" y="3" width="5" height="5.5" rx="1" /><path d="M11 4.5 v3 M11 4.5 h1.4 a1 1 0 0 1 0 2 H11" />
        <path d="M6 17 l.8-3 a1.6 1.6 0 0 1 1.5-1.1 h7.4 a1.6 1.6 0 0 1 1.5 1.1 L18 17" />
        <rect x="5" y="17" width="14" height="3.4" rx="1.2" />
      </svg>
    )
    case 'camera': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M4 8 h3 l1.5-2 h7 L17 8 h3 a1 1 0 0 1 1 1 v9 a1 1 0 0 1-1 1 H4 a1 1 0 0 1-1-1 V9 a1 1 0 0 1 1-1 z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    )
    case 'retrieve': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <circle cx="12" cy="6.5" r="3" /><path d="M12 9.5 v3 M12 12 h2" />
        <path d="M6 18 l.8-3 a1.6 1.6 0 0 1 1.5-1.1 h7.4 a1.6 1.6 0 0 1 1.5 1.1 L18 18" />
        <rect x="5" y="18" width="14" height="3.2" rx="1.2" />
      </svg>
    )
    case 'offline': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M5 18 h11 a3.5 3.5 0 0 0 .5-6.96 A5 5 0 0 0 7 9.5" />
        <path d="M3 5 l16 16" />
      </svg>
    )
    case 'report': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M7 3 h7 l4 4 v13 a1 1 0 0 1-1 1 H7 a1 1 0 0 1-1-1 V4 a1 1 0 0 1 1-1 z" /><path d="M14 3 v4 h4" />
        <path d="M9 12 h6 M9 15 h6 M9 18 h4" />
      </svg>
    )
    case 'dashboard': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
      </svg>
    )
    case 'add': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <circle cx="12" cy="12" r="9" /><path d="M12 8 v8 M8 12 h8" />
      </svg>
    )
    case 'person': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <circle cx="12" cy="8" r="3.2" /><path d="M5.5 20 a6.5 6.5 0 0 1 13 0" />
      </svg>
    )
    case 'building': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M5 21 V5 a1 1 0 0 1 1-1 h8 a1 1 0 0 1 1 1 v16" /><path d="M15 21 V10 h3 a1 1 0 0 1 1 1 v10" />
        <path d="M8 8 h1 M11 8 h1 M8 11 h1 M11 11 h1 M8 14 h1 M11 14 h1" /><path d="M3 21 h18" />
      </svg>
    )
    case 'fix': return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}>
        <path d="M15 6 a3.5 3.5 0 0 0-4.6 4.3 L4 16.7 V20 h3.3 l6.4-6.4 A3.5 3.5 0 0 0 18 9 l-2.2 2.2-2-2 z" />
      </svg>
    )
    default: return (
      <svg width={S} height={S} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /></svg>
    )
  }
}

export default function ValetTutorial({ steps, onClose }: { steps: TutorialStep[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,9,.72)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 18 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ background: NAVY, padding: '26px 22px', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 74, height: 74, borderRadius: '50%', border: `2px solid ${GOLD}`, display: 'grid', placeItems: 'center' }}>
            <TutIcon k={step.icon} />
          </div>
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
  { icon: 'welcome', title: 'Welcome to BSM Valet', body: 'This app documents every car you park and retrieve with timestamped, logo-stamped photos — your protection on any damage claim.' },
  { icon: 'park', title: 'Parking a car', body: 'Tap Park a car, search the resident by name, apartment, plate, or color (or add a guest), then take the 8 guided photos all around the car.' },
  { icon: 'camera', title: 'The 8 photos', body: 'Follow the on-screen prompts for each angle — front, corners, sides and rear. Each shot is stamped with the time and BSM logo. Retake any before saving.' },
  { icon: 'retrieve', title: 'Retrieving a car', body: 'Tap Retrieve, pick the car from the PARKED list, and take 5 return photos. This records the car\u2019s condition as it goes back to the resident.' },
  { icon: 'offline', title: 'Works offline', body: 'No signal in the garage? Keep working — captures save to your phone and sync automatically once you\u2019re back online.' },
  { icon: 'report', title: 'See any report', body: 'Tap any car under Recent activity to view its photos and download the report. Replay this guide anytime with the ? button.' },
]

export const MANAGER_STEPS: TutorialStep[] = [
  { icon: 'dashboard', title: 'Manager dashboard', body: 'From here you onboard attendants, manage residents, and pull the full history and reports for the building.' },
  { icon: 'add', title: 'Quick add', body: 'The top bar adds an employee (creates their login), a tenant, or a car in one tap — from anywhere in the manager area.' },
  { icon: 'person', title: 'Attendants', body: 'Add an attendant with their name + email; the app creates their login. Use Resend to re-send it, or Deactivate to revoke access.' },
  { icon: 'building', title: 'Residents & import', body: 'Import your building roster (Excel or CSV) in one pass — it creates units, tenants, and their cars. Add tenants or extra cars manually anytime.' },
  { icon: 'report', title: 'History & reports', body: 'The History tab is searchable by date, plate, tenant, or attendant. Tap any stay to see the photos and download the branded PDF.' },
  { icon: 'fix', title: 'Audit & fixes', body: 'Void a bad capture or force-close a stuck car — every fix is logged in the Audit tab with who did it and when. Replay this guide with the ? button.' },
]
