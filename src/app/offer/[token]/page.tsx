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

  if (!offer || !offer.snapshot) return <Msg title="Offer not found" body="This link isn't valid. Please contact BSM Facility Solutions." />
  if (offer.status === 'withdrawn') return <Msg title="Offer withdrawn" body="This offer is no longer available. Please contact BSM Facility Solutions with any questions." />

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

function Msg({ title, body }: { title: string; body: string }) {
  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EF', fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1E1B17', padding: '26px 24px', textAlign: 'center' }}>
        <img src="https://bsmfacilitysolutions.app/bsm-logo.png" alt="BSM Facility Solutions" width={150} style={{ height: 'auto', display: 'block', margin: '0 auto' }} />
        <div style={{ color: '#DCB878', fontSize: 11, letterSpacing: 2.5, fontWeight: 700, marginTop: 8 }}>CAREERS</div>
      </div>
      <div style={{ height: 3, background: '#DCB878' }} />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', maxWidth: 440, textAlign: 'center', boxShadow: '0 2px 14px rgba(30,27,23,.08)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1E1B17', margin: '0 0 4px', letterSpacing: '-.2px' }}>{title}</h1>
          <div style={{ width: 34, height: 2, background: '#DCB878', margin: '12px auto 16px' }} />
          <p style={{ fontSize: 14.5, color: '#3F3A32', margin: 0, lineHeight: 1.6 }}>{body}</p>
        </div>
      </div>
      <div style={{ background: '#1E1B17', padding: '18px 24px', textAlign: 'center' }}>
        <div style={{ color: '#DCB878', fontSize: 12, fontWeight: 700 }}>BSM Facility Solutions</div>
      </div>
    </div>
  )
}
