'use client'

// Shared candidate avatar. Shows the photo when a signed URL is provided,
// otherwise gold initials on the raised surface. Gold ring, per brand.
const RAISE = '#2A241D', GOLD = '#DCB878'

const initials = (name: string) =>
  (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

export default function Avatar({ name, src, size = 46 }: { name: string; src?: string | null; size?: number }) {
  const fontSize = Math.round(size * 0.32)
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${GOLD}`, overflow: 'hidden', background: RAISE,
        display: 'grid', placeItems: 'center', color: GOLD, fontWeight: 700, fontSize,
      }}
    >
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : initials(name)}
    </span>
  )
}
