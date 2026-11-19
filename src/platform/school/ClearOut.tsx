import { useEffect, useState } from 'react'
import { Check, PackageX } from 'lucide-react'
import { api } from '../api'
import { notify } from '../feedback'
import type { Row } from './CasePanel'

type Data = { holdDays: number; canApprove: boolean; rows: Row[] }
const DEFAULT_NOTE = 'End-of-term clear-out: not collected after the holding period'

/**
 * End-of-term clear-out: decide many items at once instead of opening each one.
 * The two-person rule still holds: one person requests donation, the school administrator approves,
 * and nobody approves their own request. Valuables and claimed items are always decided one at a time.
 */
export function ClearOut({ version, onChanged, onOpen }: { version: number; onChanged: () => void; onOpen: (id: string) => void }) {
  const [data, setData] = useState<Data | null>(null), [picked, setPicked] = useState<Set<string>>(new Set()), [note, setNote] = useState(DEFAULT_NOTE)
  const [busy, setBusy] = useState(false), [skipped, setSkipped] = useState<Row[]>([])
  useEffect(() => { let live = true; api<Data>('/school/desk/clearout').then((d) => { if (live) { setData(d); setPicked(new Set()) } }).catch(() => { if (live) setData({ holdDays: 30, canApprove: false, rows: [] }) }); return () => { live = false } }, [version])
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  if (!data.rows.length) return <p className="crm-empty">Nothing is past its collection date. There is nothing to clear out.</p>
  const canRequest = (r: Row) => !r.requestedBy && !r.claimed
  const canApprove = (r: Row) => data.canApprove && !!r.requestedBy && !r.requestedByMe && !r.valuable && !r.claimed
  const chosen = data.rows.filter((r) => picked.has(r.id)), toRequest = chosen.filter(canRequest), toApprove = chosen.filter(canApprove)
  const selectable = data.rows.filter((r) => canRequest(r) || canApprove(r))
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  async function run(action: 'request' | 'approve', rows: Row[]) {
    if (note.trim().length < 8) { notify('Add a short reason first (at least 8 characters).', 'error'); return }
    if (action === 'approve' && !window.confirm(`Approve donation of ${rows.length} item${rows.length === 1 ? '' : 's'}? They leave the lost and found and cannot be collected afterwards.`)) return
    setBusy(true)
    try {
      const r = await api<{ done: number; skipped: Row[] }>('/school/desk/clearout', { action, caseIds: rows.map((x) => x.id), note: note.trim() })
      notify(`${r.done} item${r.done === 1 ? '' : 's'} ${action === 'request' ? 'put forward for donation' : 'approved for donation'}${r.skipped.length ? `; ${r.skipped.length} left as they are` : ''}.`)
      setSkipped(r.skipped); onChanged()
    } catch { /* toast shown */ } finally { setBusy(false) }
  }
  const status = (r: Row) => r.claimed ? ['Claimed: review the claim', 'warn'] : r.requestedByMe ? ['You requested donation', 'muted'] : r.requestedBy ? [`Requested by ${r.requestedBy}`, 'good'] : ['Not requested yet', 'muted']
  return <div className="co-root">
    <p className="crm-sub" style={{ margin: 0 }}>{data.rows.length} item{data.rows.length === 1 ? ' is' : 's are'} past the collection date or held over {data.holdDays} days. One person requests donation and the school administrator approves; nobody approves their own request.</p>
    <div className="crm-actions">
      <button type="button" className="crm-outline" disabled={!selectable.length} onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.id)))}>{picked.size && picked.size === selectable.length ? 'Clear selection' : `Select all (${selectable.length})`}</button>
      <span className="crm-chip">{picked.size} selected</span>
    </div>
    <ul className="crm-list co-list">{data.rows.map((r) => { const [text, tone] = status(r), open = canRequest(r) || canApprove(r); return <li key={r.id}>
      <input type="checkbox" aria-label={`Select ${r.title}`} checked={picked.has(r.id)} disabled={!open || busy} onChange={() => toggle(r.id)} />
      <div><button type="button" className="crm-link" onClick={() => onOpen(r.id)}>{r.title}</button><small>{r.owner} · {r.where} · {r.ageDays} days · {r.why}</small>
        <span className="crm-flags"><i className={'crm-flag t-' + tone} style={{ fontStyle: 'normal' }}>{text}</i>{r.valuable && <i className="crm-flag t-warn" style={{ fontStyle: 'normal' }}>Valuable: decide on its own</i>}<i className="crm-flag" style={{ fontStyle: 'normal' }}>{r.ref}</i></span></div>
    </li> })}</ul>
    <label className="co-note"><span>Reason, kept in the record of every item</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
    <div className="crm-actions">
      <button type="button" className={data.canApprove && toApprove.length ? 'crm-outline' : 'crm-primary'} disabled={busy || !toRequest.length} onClick={() => void run('request', toRequest)}><PackageX size={15} />Request donation ({toRequest.length})</button>
      {data.canApprove && <button type="button" className="crm-primary" disabled={busy || !toApprove.length} onClick={() => void run('approve', toApprove)}><Check size={15} />Approve donation ({toApprove.length})</button>}
    </div>
    {skipped.length > 0 && <div className="crm-quote" role="status"><strong>Left as they are</strong>{skipped.map((s, i) => <span key={i} style={{ display: 'block' }}>{s.title}: {s.why}</span>)}</div>}
  </div>
}
