import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Check, Clock, HandHeart, PackageCheck, ShieldAlert, X } from 'lucide-react'
import { api } from '../api'
import { notify } from '../feedback'
import { imagery } from '@/data/imagery'
import { spring } from '../crm/fx'
import '../crm/crm.css'

export type Row = Record<string, any>
const when = (d: string) => new Date(d).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const picture = (category: string) => (imagery.catalog[category as keyof typeof imagery.catalog] ?? imagery.catalog.book).src
const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => <div><dt>{label}</dt><dd>{children || '—'}</dd></div>

/**
 * One lost-and-found item for school staff and the principal: what it is, whose it is, where it is,
 * what can be done next, and the custody trail of everyone who handled it.
 */
export function CasePanel({ id, boxes, onClose, onChanged }: { id: string; boxes: Row[]; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState<Row | null>(null), [busy, setBusy] = useState(false), [mode, setMode] = useState('')
  const load = () => api<Row>('/school/desk/case/' + encodeURIComponent(id)).then(setC).catch(() => onClose())
  useEffect(() => { setC(null); setMode(''); void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onClose])
  async function run(fn: () => Promise<unknown>, done: string) { setBusy(true); try { await fn(); notify(done); setMode(''); await load(); onChanged() } catch { /* toast shown */ } finally { setBusy(false) } }
  const form = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string> }
  const review = (kind: string, note: string, done: string) => run(() => api('/school/case-reviews', { caseId: id, kind, note }), done)

  return <motion.div className="crm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <motion.aside className="crm-drawer" role="dialog" aria-modal="true" aria-label={c?.title || 'Item'} initial={{ x: 60, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={spring}>
      {!c ? <p role="status">Opening…</p> : <>
        <header><div><h2>{c.title}</h2><p>{c.stage}{c.box ? ' · ' + c.box : ''}</p></div><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        <div className="sd-item"><img src={c.photo || picture(c.category)} alt={c.photo ? 'Photo of the item' : ''} /><div className="crm-flags">
          {c.overdue && <span className="crm-flag t-bad">Past collection date</span>}{c.holdOver && <span className="crm-flag t-warn">Held over {c.holdDays} days</span>}{c.dispute && <span className="crm-flag t-bad">Ownership disputed</span>}
          <span className="crm-flag">{c.tagged ? 'Has a FindBox QR' : 'No QR'}</span>{c.disposal && c.status !== 'closed' && <span className="crm-flag t-warn">Donation requested by {c.disposal.requestedBy}</span>}
        </div></div>
        <dl className="crm-facts">
          {c.owner ? <><Fact label="Belongs to">{c.owner.child}</Fact><Fact label="Class">{[c.owner.className, c.owner.house && c.owner.house + ' house'].filter(Boolean).join(' · ')}</Fact><Fact label="Parent or guardian">{c.owner.guardian}</Fact></> : <Fact label="Belongs to">Not known yet</Fact>}
          <Fact label="Logged">{when(c.createdAt)}</Fact>
          {c.status === 'awaiting_collection' && <Fact label="Collect by">{day(c.dueAt)}</Fact>}{c.collectedAt && <Fact label="Handed back">{when(c.collectedAt)}</Fact>}
          {c.privateNote && <Fact label="Private detail (for checking ownership)">{c.privateNote}</Fact>}
        </dl>

        {mode === '' && <div className="crm-actions">
          {c.can.receive && <button type="button" className="crm-primary" onClick={() => setMode('receive')}><PackageCheck size={16} />Receive into a box</button>}
          {c.can.handBack && <button type="button" className="crm-primary" disabled={c.dispute} onClick={() => setMode('hand')}><Check size={16} />Hand back</button>}
          {c.can.extend && <button type="button" className="crm-outline" onClick={() => setMode('extend')}><Clock size={15} />Give more time</button>}
          {c.can.requestDisposal && <button type="button" className="crm-outline" onClick={() => setMode('donate')}><HandHeart size={15} />Ask to donate</button>}
          {c.can.approveDisposal && <button type="button" className="crm-primary" onClick={() => setMode('approve')}><HandHeart size={16} />Approve donation</button>}
          {['awaiting_collection', 'unclaimed'].includes(c.status) && !c.dispute && <button type="button" className="crm-outline" onClick={() => setMode('dispute')}><ShieldAlert size={15} />Ownership is disputed</button>}
          {c.dispute && <button type="button" className="crm-outline" onClick={() => setMode('resolve')}>Dispute resolved</button>}
        </div>}
        {c.dispute && mode === '' && <p className="crm-quote">This item cannot be handed back until the ownership dispute is resolved.</p>}

        {mode === 'receive' && <form className="crm-form" onSubmit={(e) => { const f = form(e); void run(() => api('/staff/cases/' + id + '/receive', { boxId: f.boxId }), 'Received. The family has been told where to collect it.') }}><fieldset disabled={busy} style={{ display: 'contents' }}>
          <label>Which box is it going into?<select name="boxId" required>{boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <div className="crm-actions"><button className="crm-primary">Confirm it is in the box</button><button type="button" className="crm-outline" onClick={() => setMode('')}>Cancel</button></div>
        </fieldset></form>}
        {mode === 'hand' && <form className="crm-form" onSubmit={(e) => { const f = form(e); void run(() => api('/staff/cases/' + id + '/collect', { verification: f.verification }), 'Handed back and recorded.') }}><fieldset disabled={busy} style={{ display: 'contents' }}>
          <label>Who collected it, and how did you check? (kept on the record)<textarea name="verification" required minLength={3} maxLength={500} placeholder={c.owner ? `e.g. ${c.owner.child} collected it; matched the name on the label` : 'e.g. Parent described the initials inside the collar'} /></label>
          <div className="crm-actions"><button className="crm-primary">Record hand-back</button><button type="button" className="crm-outline" onClick={() => setMode('')}>Cancel</button></div>
        </fieldset></form>}
        {mode === 'extend' && <form className="crm-form" onSubmit={(e) => { const f = form(e); void run(() => api('/staff/cases/' + id + '/extend', { days: Number(f.days), reason: f.reason }), 'Collection date extended. The family has been told.') }}><fieldset disabled={busy} style={{ display: 'contents' }}>
          <div className="crm-two"><label>Extra days<input name="days" type="number" min={1} max={30} defaultValue={7} required /></label><label>Why?<input name="reason" required minLength={3} maxLength={500} placeholder="e.g. Family is away this week" /></label></div>
          <div className="crm-actions"><button className="crm-primary">Extend</button><button type="button" className="crm-outline" onClick={() => setMode('')}>Cancel</button></div>
        </fieldset></form>}
        {['donate', 'approve', 'dispute', 'resolve'].includes(mode) && <form className="crm-form" onSubmit={(e) => { const f = form(e); void (mode === 'donate' ? review('disposal_request', f.note!, 'Sent to the principal to approve.') : mode === 'approve' ? review('disposal_approved', f.note!, 'Donation approved. The item is closed.') : mode === 'dispute' ? review('dispute', f.note!, 'Dispute recorded. Hand-back is on hold.') : review('correction', f.note!, 'Dispute resolved.')) }}><fieldset disabled={busy} style={{ display: 'contents' }}>
          <label>{mode === 'donate' ? 'Where should it go, and why? (the principal approves)' : mode === 'approve' ? 'Confirm where it is going' : mode === 'dispute' ? 'What is disputed?' : 'How was it resolved?'}<textarea name="note" required minLength={8} maxLength={500} placeholder={mode === 'donate' || mode === 'approve' ? 'e.g. Unclaimed for a month; donate to the uniform bank' : ''} defaultValue={mode === 'approve' ? c.disposal?.note : ''} /></label>
          {mode === 'approve' && <p className="hs-note" style={{ fontSize: 12.5 }}>Requested by {c.disposal?.requestedBy}. Two different people must agree before anything is donated.</p>}
          <div className="crm-actions"><button className="crm-primary">{mode === 'donate' ? 'Ask the principal' : mode === 'approve' ? 'Approve donation' : mode === 'dispute' ? 'Record dispute' : 'Mark resolved'}</button><button type="button" className="crm-outline" onClick={() => setMode('')}>Cancel</button></div>
        </fieldset></form>}

        {c.can.reviewClaims && <>
          <p className="crm-sub">Claims ({c.claims.filter((x: Row) => x.status === 'submitted').length})</p>
          {c.claims.length ? <ul className="crm-list">{c.claims.map((x: Row) => <li key={x.id} style={{ alignItems: 'flex-start' }}><div><span>{x.name}</span><small>“{x.evidence}”</small></div>
            {x.status === 'submitted' ? <span className="crm-actions"><button type="button" className="crm-outline" disabled={busy} onClick={() => void run(() => api('/staff/claims/' + x.id, { decision: 'rejected' }), 'Claim declined.')}>Decline</button><button type="button" className="crm-primary" disabled={busy} onClick={() => void run(() => api('/staff/claims/' + x.id, { decision: 'approved' }), 'Claim approved. They can now collect it.')}>Approve</button></span> : <span className="crm-flag">{x.status}</span>}
          </li>)}</ul> : <p className="crm-empty">Nobody has claimed this yet. Families see it in the unclaimed gallery.</p>}
        </>}

        <p className="crm-sub">Custody trail</p>
        {c.trail.length ? <ul className="crm-timeline">{c.trail.map((t: Row, i: number) => <li key={i}><span><Check size={12} /></span><div><p>{t.text}{t.note ? ': ' + t.note : ''}</p><small>{[t.who, when(t.at)].filter(Boolean).join(' · ')}</small></div></li>)}</ul> : <p className="crm-empty">No history yet.</p>}
      </>}
    </motion.aside>
  </motion.div>
}
