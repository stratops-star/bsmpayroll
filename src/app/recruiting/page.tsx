'use client'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

export default function RecruitingHome() {
  return (
    <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', background: '#F5F6FA', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>🧑&zwj;💼</div>
        <h1 style={{ color: NAVY, fontSize: 24, marginBottom: 8 }}>Recruiting</h1>
        <p style={{ color: '#6B7280', lineHeight: 1.5, marginBottom: 22 }}>
          The candidate pipeline is being built. You have access to this module — the New Queue,
          Candidate Pool, Man Power Requests, and Rejected screens are coming next.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href="/hub" style={{ textDecoration: 'none', border: '1px solid #E5E7EB', color: NAVY, borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, background: '#fff' }}>← Hub</a>
          <a href="/recruiting/admin" style={{ textDecoration: 'none', background: GOLD, color: NAVY, borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>User Access</a>
        </div>
      </div>
    </div>
  )
}
