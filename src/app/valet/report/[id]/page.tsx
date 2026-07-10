'use client'

import { useEffect, useState } from 'react'

const NAVY = '#0D1B35'
const GOLD = '#D4A843'

type Section = { at: string; note: string | null; photos: string[] } | null
type Data = { plate: string; name: string; unit: string; park: Section; retrieve: Section }

export default function ReportPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/valet-report?id=${encodeURIComponent(params.id)}`)
        if (!r.ok) { setErr('Report not found.'); return }
        setData(await r.json())
      } catch { setErr('Could not load report.') }
    })()
  }, [params.id])

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', background: '#F1F3F8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: NAVY, color: '#fff', padding: '18px 16px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: GOLD, display: 'grid', placeItems: 'center', color: NAVY, fontWeight: 800 }}>B</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>BSM Valet — Vehicle Report</div>
            <div style={{ fontSize: 11, color: '#9FB0CC' }}>Facility Solutions</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        {err && <div style={cardBox}><p style={{ color: '#B91C1C' }}>{err}</p></div>}
        {!data && !err && <div style={cardBox}><p style={{ color: '#94A3B8' }}>Loading…</p></div>}
        {data && (
          <>
            <div style={cardBox}>
              <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{data.plate}</div>
              <div style={{ color: '#64748B', fontSize: 14, marginTop: 2 }}>{data.name} · Unit {data.unit}</div>
            </div>
            <Block title="Park — intake condition" section={data.park} fmt={fmt} />
            <Block title="Retrieve — return condition" section={data.retrieve} fmt={fmt} />
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 18 }}>
              Photos are timestamped and stamped with the BSM logo at capture.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function Block({ title, section, fmt }: { title: string; section: Section; fmt: (s: string) => string }) {
  return (
    <div style={cardBox}>
      <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{title}</div>
      {section ? (
        <>
          <div style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 10px' }}>
            {fmt(section.at)}{section.note ? ' · ' + section.note : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {section.photos.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', borderRadius: 10 }} />)}
          </div>
        </>
      ) : <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>No record.</div>}
    </div>
  )
}

const cardBox: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, marginBottom: 14 }
