'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import RecruitingTabs from '@/components/RecruitingTabs'

const NAVY = 'var(--text-strong)', GOLD = 'var(--gold)'
const inp = 'w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)]'
const lbl = 'block text-[11px] uppercase tracking-wide text-[var(--muted)] font-bold mb-1'

type Settings = Record<string, any>
type Tmpl = { id: string; position_name: string; duties_intro_en: string | null; duties_intro_es: string | null; duties_en: string[]; duties_es: string[]; active: boolean; sort: number }

// [label, key, kind] — bilingual fields render EN + ES side by side
const TEXTS: [string, string, 'line' | 'area'][] = [
  ['Subject line', 'subject', 'line'],
  ['Opening paragraph', 'intro', 'area'],
  ['Contingency bullet', 'contingency', 'area'],
  ['Lead-in to details', 'details_lead', 'line'],
  ['Payment schedule', 'pay_schedule', 'line'],
  ['Payment schedule detail', 'pay_detail', 'area'],
  ['Work hours & overtime', 'overtime', 'area'],
  ['Job-description note', 'jd_note', 'area'],
  ['At-will employment', 'at_will', 'area'],
  ['Next steps', 'next_steps', 'area'],
  ['Closing paragraph', 'closing', 'area'],
  ['Acknowledgment & acceptance', 'acknowledgment', 'area'],
]

export default function OfferSettingsPage() {
  const [supabase] = useState(() => createClient())
  const [s, setS] = useState<Settings | null>(null)
  const [tmpls, setTmpls] = useState<Tmpl[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [openTmpl, setOpenTmpl] = useState<string | null>(null)

  useEffect(() => { (async () => {
    const [{ data: st }, { data: tp }] = await Promise.all([
      supabase.from('offer_settings').select('*').eq('id', 1).single(),
      supabase.from('offer_templates').select('*').order('sort'),
    ])
    setS(st || {})
    setTmpls((tp ?? []).map((t: any) => ({ ...t, duties_en: t.duties_en || [], duties_es: t.duties_es || [] })))
    setLoading(false)
  })() }, [])

  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }))
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function saveSettings() {
    setBusy(true)
    const { id, updated_at, ...rest } = s || {}
    const { error } = await supabase.from('offer_settings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    flash(error ? 'Error: ' + error.message : 'Settings saved')
  }

  async function saveTmpl(t: Tmpl) {
    setBusy(true)
    const { error } = await supabase.from('offer_templates').update({
      duties_intro_en: t.duties_intro_en, duties_intro_es: t.duties_intro_es,
      duties_en: t.duties_en.filter(Boolean), duties_es: t.duties_es.filter(Boolean), active: t.active,
    }).eq('id', t.id)
    setBusy(false)
    flash(error ? 'Error: ' + error.message : `${t.position_name} saved`)
  }

  const patchT = (id: string, p: Partial<Tmpl>) => setTmpls(ts => ts.map(t => t.id === id ? { ...t, ...p } : t))

  if (loading) return <div className="min-h-screen bsm-app p-6"><p className="text-[var(--faint)] text-sm">Loading…</p></div>

  return (
    <div className="min-h-screen bsm-app">
      <div className="max-w-5xl mx-auto px-6 py-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-strong)]">Offer letter settings</h1>
            <p className="text-xs text-[var(--muted)]">Repetitive wording, edited once · used by every new letter</p>
          </div>
          <a href="/recruiting/offers" className="text-sm text-[var(--muted)] hover:text-[var(--text)] whitespace-nowrap">← Offers</a>
        </div>
        <RecruitingTabs />

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-800">
          <b>Spanish text is a translation for your review.</b> Read it over and edit anything before the first Spanish letter goes out. Sent letters are frozen — editing settings never changes a letter already sent.
        </div>

        {/* Company + signer */}
        <Card title="Letterhead & signer">
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Company address"><input className={inp} value={s?.company_address || ''} onChange={e => set('company_address', e.target.value)} /></F>
            <F label="Company phone"><input className={inp} value={s?.company_phone || ''} onChange={e => set('company_phone', e.target.value)} /></F>
            <F label="Company email"><input className={inp} value={s?.company_email || ''} onChange={e => set('company_email', e.target.value)} /></F>
            <F label="Website"><input className={inp} value={s?.company_web || ''} onChange={e => set('company_web', e.target.value)} /></F>
            <F label="Signer name"><input className={inp} value={s?.signer_name || ''} onChange={e => set('signer_name', e.target.value)} /></F>
            <F label="Signer title"><input className={inp} value={s?.signer_title || ''} onChange={e => set('signer_title', e.target.value)} /></F>
            <F label="Signer phone"><input className={inp} value={s?.signer_phone || ''} onChange={e => set('signer_phone', e.target.value)} /></F>
            <F label="Questions phone (in closing)"><input className={inp} value={s?.questions_phone || ''} onChange={e => set('questions_phone', e.target.value)} /></F>
          </div>
        </Card>

        {/* Benefits */}
        <Card title="Benefits list">
          <div className="grid sm:grid-cols-2 gap-4">
            <ListEditor label="English" items={s?.benefits_en || []} onChange={v => set('benefits_en', v)} />
            <ListEditor label="Español" items={s?.benefits_es || []} onChange={v => set('benefits_es', v)} />
          </div>
        </Card>

        {/* Bilingual boilerplate */}
        <Card title="Letter wording">
          <p className="text-[11px] text-[var(--faint)] mb-3">Placeholders auto-fill: <code className="bg-[var(--raise)] px-1 rounded">{'{position}'}</code> <code className="bg-[var(--raise)] px-1 rounded">{'{name}'}</code> <code className="bg-[var(--raise)] px-1 rounded">{'{sign_by}'}</code> <code className="bg-[var(--raise)] px-1 rounded">{'{questions_phone}'}</code></p>
          <div className="space-y-4">
            {TEXTS.map(([label, key, kind]) => (
              <div key={key}>
                <div className={lbl}>{label}</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(['en', 'es'] as const).map(L => (
                    <div key={L}>
                      <div className="text-[10px] font-semibold text-[var(--faint)] mb-1">{L === 'en' ? 'ENGLISH' : 'ESPAÑOL'}</div>
                      {kind === 'area'
                        ? <textarea rows={key === 'overtime' ? 6 : 3} className={inp} value={s?.[`${key}_${L}`] || ''} onChange={e => set(`${key}_${L}`, e.target.value)} />
                        : <input className={inp} value={s?.[`${key}_${L}`] || ''} onChange={e => set(`${key}_${L}`, e.target.value)} />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <button disabled={busy} onClick={saveSettings} className="w-full font-semibold py-3 rounded-lg mb-8 disabled:opacity-50" style={{ background: GOLD, color: NAVY }}>{busy ? 'Saving…' : 'Save settings'}</button>

        {/* Per-tier templates */}
        <Card title="Position templates">
          <p className="text-[11px] text-[var(--faint)] mb-3">Each position tier has its own <b>Duties &amp; Responsibilities</b> block. Everything else comes from the settings above.</p>
          <div className="space-y-2">
            {tmpls.map(t => {
              const open = openTmpl === t.id
              const filled = (t.duties_en || []).length > 0
              return (
                <div key={t.id} className="border border-[var(--border)] rounded-xl overflow-hidden">
                  <button onClick={() => setOpenTmpl(open ? null : t.id)} className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface)] hover:bg-gray-50">
                    <span className="font-semibold text-sm text-[var(--text)]">{t.position_name}</span>
                    <span className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${filled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{filled ? 'Ready' : 'Needs duties'}</span>
                      <span className="text-[var(--faint)] text-xs">{open ? '▲' : '▼'}</span>
                    </span>
                  </button>
                  {open && (
                    <div className="p-4 bg-[#F9FAFB] border-t border-[var(--border)] space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <F label="Duties intro — English"><input className={inp} placeholder="As a Porter, your primary responsibilities will include, but are not limited to:" value={t.duties_intro_en || ''} onChange={e => patchT(t.id, { duties_intro_en: e.target.value })} /></F>
                        <F label="Duties intro — Español"><input className={inp} placeholder="Como Porter, sus responsabilidades principales incluirán, entre otras:" value={t.duties_intro_es || ''} onChange={e => patchT(t.id, { duties_intro_es: e.target.value })} /></F>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <ListEditor label="Duties — English" items={t.duties_en} onChange={v => patchT(t.id, { duties_en: v })} />
                        <ListEditor label="Duties — Español" items={t.duties_es} onChange={v => patchT(t.id, { duties_es: v })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" checked={t.active} onChange={e => patchT(t.id, { active: e.target.checked })} /> Active</label>
                        <button disabled={busy} onClick={() => saveTmpl(t)} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: NAVY, color: '#fff' }}>Save {t.position_name}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-40"><span className="text-[var(--gold)]">✓</span> {toast}</div>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-4">
    <h2 className="text-sm font-bold text-[var(--text)] mb-3">{title}</h2>{children}
  </div>
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className={lbl}>{label}</label>{children}</div> }

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const list = items || []
  return (
    <div>
      <div className={lbl}>{label}</div>
      <div className="space-y-1.5">
        {list.map((it, i) => (
          <div key={i} className="flex gap-1.5">
            <input className={inp} value={it} onChange={e => { const n = [...list]; n[i] = e.target.value; onChange(n) }} />
            <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-[var(--faint)] hover:text-red-500 px-1.5 text-sm">✕</button>
          </div>
        ))}
        <button onClick={() => onChange([...list, ''])} className="text-xs text-blue-600 font-medium">+ Add line</button>
      </div>
    </div>
  )
}
