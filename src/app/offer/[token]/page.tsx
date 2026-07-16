import { createServerClient } from '@/lib/supabase-server'
import OfferSign from '@/components/OfferSign'

export const dynamic = 'force-dynamic'

export default async function OfferTokenPage({ params }: { params: { token: string } }) {
  const supabase = createServerClient()
  const { data: offer } = await supabase
    .from('offers')
    .select('id, token, status, lang, snapshot, signed_at, signed_name, signature_data, signed_pdf_path')
    .eq('token', params.token)
    .maybeSingle()

  if (!offer || !offer.snapshot) return <Msg icon="🔍" title="Offer not found" body="This link isn't valid. Please contact BSM Facility Solutions." />
  if (offer.status === 'withdrawn') return <Msg icon="🚫" title="Offer withdrawn" body="This offer is no longer available. Please contact BSM Facility Solutions with any questions." />

  let signedUrl: string | null = null
  if (offer.status === 'signed' && offer.signed_pdf_path) {
    const { data } = await supabase.storage.from('offers').createSignedUrl(offer.signed_pdf_path, 60 * 60)
    signedUrl = data?.signedUrl ?? null
  }

  return (
    <OfferSign
      token={offer.token}
      snap={offer.snapshot}
      alreadySigned={offer.status === 'signed'}
      signedAt={offer.signed_at}
      signedName={offer.signed_name}
      signedUrl={signedUrl}
    />
  )
}

function Msg({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F6FA', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, textAlign: 'center', borderTop: '4px solid #D4A843', boxShadow: '0 20px 50px -20px rgba(13,27,53,.35)' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0D1B35', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  )
}
