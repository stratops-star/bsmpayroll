import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const GOLD = '#D4A843', INK = '#222222', BLACK = '#1A1A1A', GREY = '#6B7280'

const s = StyleSheet.create({
  page: { paddingBottom: 46, fontSize: 9.5, fontFamily: 'Helvetica', color: INK, lineHeight: 1.45 },
  // header
  head: { flexDirection: 'row', marginBottom: 10 },
  headBlack: { backgroundColor: BLACK, paddingTop: 20, paddingBottom: 26, paddingLeft: 34, paddingRight: 44, width: '52%' },
  logoMark: { color: GOLD, fontSize: 26, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },
  logoSub: { color: GOLD, fontSize: 6, letterSpacing: 3, marginTop: 2 },
  headRight: { width: '48%', paddingTop: 16, paddingRight: 34, alignItems: 'flex-end' },
  title: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'right' },
  addr: { paddingHorizontal: 34, marginBottom: 12 },
  addrLine: { fontSize: 7.5, color: GREY },
  body: { paddingHorizontal: 34 },
  // blocks
  dateTag: { backgroundColor: '#FFF3A3', alignSelf: 'flex-start', paddingHorizontal: 3, paddingVertical: 1, fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginBottom: 8 },
  subject: { marginBottom: 12, fontSize: 9.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  italic: { fontFamily: 'Helvetica-Oblique' },
  p: { marginBottom: 8 },
  h: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.3, marginTop: 10, marginBottom: 4 },
  hBar: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.3, backgroundColor: '#F1F2F4', paddingVertical: 2, paddingHorizontal: 3, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 12 },
  bullet: { width: 10, fontSize: 9.5 },
  rowText: { flex: 1 },
  sub: { flexDirection: 'row', marginBottom: 2.5, paddingLeft: 28 },
  // signature
  ackTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 0.3, marginTop: 18, marginBottom: 6 },
  sigWrap: { marginTop: 14 },
  sigLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  sigImg: { height: 34, width: 150, marginTop: 2, marginBottom: 2 },
  sigTyped: { fontFamily: 'Helvetica-Oblique', fontSize: 16, marginTop: 4 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: '#555', width: 200, marginTop: 2, marginBottom: 10 },
  meta: { fontSize: 7, color: GREY, marginTop: 14, lineHeight: 1.5 },
  foot: { position: 'absolute', bottom: 18, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontSize: 6.5, color: '#9CA3AF' },
})

const Bullet = ({ children, sub = false }: any) => (
  <View style={sub ? s.sub : s.row}>
    <Text style={s.bullet}>{sub ? 'o' : '•'}</Text>
    <Text style={s.rowText}>{children}</Text>
  </View>
)

const Paras = ({ text }: { text?: string | null }) => (
  <>{(text || '').split(/\n{2,}/).filter(Boolean).map((p, i) => <Text key={i} style={s.p}>{p}</Text>)}</>
)

type Sig = { dataUrl?: string | null; typed?: string | null; name: string; date: string }

export function OfferDoc({ snap, sig }: { snap: any; sig: Sig }) {
  const L = snap.labels || {}
  const d = snap.details || {}
  return (
    <Document title={`Offer — ${snap.candidate_name}`} author="BSM Facility Solutions">
      <Page size="LETTER" style={s.page}>
        {/* Letterhead */}
        <View style={s.head} fixed={false}>
          <View style={s.headBlack}><Text style={s.logoMark}>BSM</Text><Text style={s.logoSub}>FACILITY SOLUTIONS</Text></View>
          <View style={s.headRight}><Text style={s.title}>POSITION</Text><Text style={s.title}>OFFER</Text></View>
        </View>
        <View style={s.addr}>
          <Text style={s.addrLine}>{snap.company?.address}</Text>
          <Text style={s.addrLine}>{snap.company?.phone}  ·  {snap.company?.email}  ·  {snap.company?.web}</Text>
        </View>

        <View style={s.body}>
          <Text style={s.dateTag}>{snap.letter_date}</Text>
          <Text style={s.subject}><Text style={s.bold}>{L.subject}: </Text>{snap.subject}</Text>

          <Text style={s.p}>Dear {snap.candidate_name},</Text>
          <Text style={s.p}>{snap.intro}</Text>
          <Bullet>{snap.contingency}</Bullet>
          <Text style={[s.p, { marginTop: 8 }]}>{snap.details_lead}</Text>

          <Text style={s.h}>{L.details}:</Text>
          <Bullet><Text style={s.bold}>{L.position}: </Text>{d.position}</Bullet>
          <Bullet><Text style={s.bold}>{L.start}: </Text>{d.start_date}</Bullet>
          <Text style={s.hBar}>{L.schedule}: {d.schedule}</Text>
          <Bullet><Text style={s.bold}>{L.location}: </Text>{d.location}</Bullet>

          <Text style={s.h}>{L.comp}:</Text>
          <Text style={s.hBar}>{L.rate}: {d.hourly_rate}</Text>
          <Bullet><Text style={s.bold}>{L.pay}: </Text>{snap.pay_schedule}</Bullet>
          <Bullet sub>{snap.pay_detail}</Bullet>

          <Text style={s.h}>{L.benefits}:</Text>
          {(snap.benefits || []).map((b: string, i: number) => <Bullet key={i}>{b}</Bullet>)}

          {(snap.duties || []).length > 0 && (<>
            <Text style={s.h}>{L.duties}:</Text>
            {snap.duties_intro ? <Text style={s.p}>{snap.duties_intro}</Text> : null}
            {(snap.duties || []).map((x: string, i: number) => <Bullet key={i} sub>{x}</Bullet>)}
          </>)}

          <Text style={s.h}>{L.hours}</Text>
          <Paras text={snap.overtime} />

          {snap.jd_note ? <Text style={[s.p, s.italic]}>{snap.jd_note}</Text> : null}

          <Text style={s.p}><Text style={s.bold}>{L.atwill}: </Text>{snap.at_will}</Text>
          <Text style={s.p}><Text style={s.bold}>{L.next}: </Text>{snap.next_steps}</Text>
          <Text style={s.p}>{snap.closing}</Text>

          <Text style={[s.p, { marginTop: 10, marginBottom: 0 }]}>{L.sincerely},</Text>
          <Text style={[s.italic, { fontSize: 13, marginTop: 2 }]}>{snap.signer?.name}</Text>
          <Text>{snap.signer?.title}</Text>
          <Text>BSM Facility Solutions</Text>
          <Text style={{ marginBottom: 4 }}>{snap.signer?.phone}</Text>

          {/* Acknowledgment */}
          <Text style={s.ackTitle}>{L.ack}</Text>
          <Text style={s.p}>{snap.acknowledgment}</Text>

          <View style={s.sigWrap}>
            <Text style={s.sigLabel}>{L.sig}:</Text>
            {sig.dataUrl
              ? <Image style={s.sigImg} src={sig.dataUrl} />
              : <Text style={s.sigTyped}>{sig.typed || sig.name}</Text>}
            <View style={s.sigLine} />

            <Text style={s.sigLabel}>{L.printed}:</Text>
            <Text style={{ marginTop: 3 }}>{sig.name}</Text>
            <View style={s.sigLine} />

            <Text style={s.sigLabel}>{L.date}:</Text>
            <Text style={{ marginTop: 3 }}>{sig.date}</Text>
            <View style={s.sigLine} />
          </View>

          <Text style={s.meta}>{snap.meta_line}</Text>
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footText}>BSM Facility Solutions · {snap.company?.web}</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function renderOfferPdf(snap: any, sig: Sig): Promise<Buffer> {
  return renderToBuffer(<OfferDoc snap={snap} sig={sig} />)
}
