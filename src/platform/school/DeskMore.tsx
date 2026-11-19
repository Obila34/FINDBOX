import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { BellRing, Download, Printer, X } from 'lucide-react'
import { api } from '../api'
import { notify } from '../feedback'
import { spring } from '../crm/fx'
import type { Row } from './CasePanel'

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) : '—')
const age = (n: number) => (n === 0 ? 'Today' : n === 1 ? '1 day' : n + ' days')
function useLoad<T>(path: string, version: number) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => { let live = true; api<T>(path).then((d) => { if (live) setData(d) }).catch(() => {}); return () => { live = false } }, [path, version])
  return data
}
export type LogData = { total: number; holdDays: number; rows: Row[] }
/** Groups the not-yet-home log by where each item is: each collection point first, then on its way, then still missing. */
export function groupLog(rows: Row[]) {
  const order = (w: string) => (w === 'Still missing' ? 3 : w === 'On its way' ? 2 : w === 'No box recorded' ? 1 : 0)
  const groups = new Map<string, Row[]>()
  for (const r of rows) groups.set(r.where, [...(groups.get(r.where) || []), r])
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
}

/** The principal's log: every item that has not reached its owner, where it is and how long it has waited. */
export function ItemLog({ query, version, onOpen, onChanged }: { query: string; version: number; onOpen: (id: string) => void; onChanged: () => void }) {
  const data = useLoad<LogData>('/school/desk/log?' + query, version), [busy, setBusy] = useState(false)
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  function exportCsv() {
    const lines = [['Item', 'Kind', 'Stage', 'Where', 'Owner', 'Logged', 'Days waiting', 'Collect by'], ...data!.rows.map((r) => [r.title, r.category, r.stage, r.where, r.owner, day(r.createdAt), r.ageDays, r.dueAt ? day(r.dueAt) : ''])]
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'findbox-items-not-yet-home.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <div className="crm-actions" style={{ marginBottom: 16 }}>
      <span className="crm-chip">{data.total} item{data.total === 1 ? '' : 's'} not yet home</span>
      <button type="button" className="crm-outline" disabled={busy || !data.rows.some((r) => r.atBox)} onClick={() => { if (!window.confirm('Send every parent a reminder that items are waiting at your collection points?')) return; setBusy(true); void api<{ families: number }>('/school/desk/remind-families', {}).then((r) => { notify(`Reminder sent to ${r.families} famil${r.families === 1 ? 'y' : 'ies'}.`); onChanged() }).catch(() => {}).finally(() => setBusy(false)) }}><BellRing size={14} />Remind all families</button>
      <button type="button" className="crm-outline" disabled={!data.rows.length} onClick={exportCsv}><Download size={14} />Export</button>
      <button type="button" className="crm-outline" disabled={!data.rows.length} onClick={() => window.print()}><Printer size={14} />Print list</button>
    </div>
    {!data.rows.length ? <p className="crm-empty">Everything has reached its owner.</p> : groupLog(data.rows).map(([where, rows]) => <section key={where} style={{ marginBottom: 22 }}>
      <p className="crm-sub" style={{ marginBottom: 8 }}>{where} ({rows.length})</p>
      <div className="crm-table-wrap"><table className="crm-table">
        <thead><tr>{['Item', 'Owner', 'Stage', 'Waiting', 'Collect by'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id) }}>
          <td><strong>{r.title}</strong><small>{r.category}{r.hasPhoto ? ' · photo' : ''}{r.tagged ? '' : ' · no QR'}</small></td><td>{r.owner}</td><td>{r.stage}</td>
          <td><span className={'crm-chip t-' + (r.overdue ? 'bad' : r.holdOver ? 'warn' : 'muted')}>{age(r.ageDays)}</span></td><td>{r.dueAt ? <span style={r.overdue ? { color: 'var(--c-bad)', fontWeight: 600 } : undefined}>{day(r.dueAt)}</span> : '—'}</td>
        </tr>)}</tbody></table></div>
    </section>)}
  </>
}

export function Classes({ version, onPick }: { version: number; onPick: (name: string) => void }) {
  const data = useLoad<{ rows: Row[] }>('/school/desk/classes', version)
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  return <>
    <div className="crm-head"><div><h1>Classes</h1><p>How far each class has got: parents linked, items labelled, and what is currently missing. Use it to nudge class teachers.</p></div></div>
    {!data.rows.length ? <p className="crm-empty">No classes yet. Add students first.</p> : <div className="crm-table-wrap"><table className="crm-table">
      <thead><tr>{['Class', 'Students', 'Parents linked', 'Items labelled', 'Not yet home', 'Lost in 90 days'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{data.rows.map((c) => { const pct = c.students ? Math.round((c.linked / c.students) * 100) : 0; return <tr key={c.name} tabIndex={0} onClick={() => onPick(c.name)} onKeyDown={(e) => { if (e.key === 'Enter') onPick(c.name) }}>
        <td><strong>{c.name}</strong></td><td>{c.students}</td>
        <td><span className={'crm-chip t-' + (pct >= 70 ? 'good' : pct >= 40 ? 'warn' : 'bad')}>{c.linked} of {c.students} · {pct}%</span></td>
        <td>{c.items}</td><td>{c.open ? <strong>{c.open}</strong> : 0}</td><td>{c.lost90}</td>
      </tr> })}</tbody></table></div>}
  </>
}

export function ActivityLog({ version, onOpen }: { version: number; onOpen: (id: string) => void }) {
  const data = useLoad<{ rows: Row[] }>('/school/desk/activity', version)
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  let last = ''
  return <>
    <div className="crm-head"><div><h1>Activity</h1><p>Who handled what, newest first. Every receive, hand-back, reminder and decision is recorded.</p></div></div>
    {!data.rows.length ? <p className="crm-empty">No activity yet.</p> : <ul className="crm-list">{data.rows.map((r, i) => { const d = new Date(r.at).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' }), head = d !== last; last = d; return <li key={i} style={head ? { flexWrap: 'wrap' } : undefined}>
      {head && <p className="crm-day" style={{ flexBasis: '100%' }}>{d}</p>}
      <span className="crm-avatar">{r.who.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span>
      <div><span><strong>{r.who}</strong> · {r.text}: <button type="button" className="crm-link" onClick={() => onOpen(r.caseId)}>{r.title}</button></span>{r.note && <small>{r.note}</small>}</div>
      <small>{new Date(r.at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</small>
    </li> })}</ul>}
  </>
}

/** One student: who their parent is, whether they have a QR, their labelled belongings and anything not yet home. */
export function StudentPanel({ id, onClose, onOpenCase, onEdit }: { id: string; onClose: () => void; onOpenCase: (id: string) => void; onEdit: () => void }) {
  const s = useLoad<Row>('/school/desk/student/' + encodeURIComponent(id), 0)
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onClose])
  const open = s?.cases.filter((c: Row) => !['returned', 'closed'].includes(c.status)) || []
  return <motion.div className="crm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <motion.aside className="crm-drawer" role="dialog" aria-modal="true" aria-label={s?.name || 'Student'} initial={{ x: 60, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={spring}>
      {!s ? <p role="status">Opening…</p> : <>
        <header><div><h2>{s.name}</h2><p>{s.className} · {s.reference}</p></div><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        <div className="crm-flags"><span className={'crm-flag ' + (s.linked ? 't-good' : 't-warn')}>{s.linked ? 'Parent linked' : s.invited ? 'Parent invited' : 'No parent linked'}</span><span className={'crm-flag ' + (s.hasQr ? 't-good' : '')}>{s.hasQr ? 'Has a FindBox QR' : 'No QR yet'}</span>{s.house && <span className="crm-flag">{s.house[0].toUpperCase() + s.house.slice(1)} house</span>}{s.hasLogin && <span className="crm-flag">Has a student login</span>}{s.status !== 'active' && <span className="crm-flag t-warn">{s.status}</span>}</div>
        <dl className="crm-facts"><div><dt>Parent or guardian</dt><dd>{s.guardian || 'Not linked'}</dd></div><div><dt>Parent email on file</dt><dd>{s.guardianEmail || '—'}</dd></div></dl>
        <div className="crm-actions"><button type="button" className="crm-outline" onClick={onEdit}>Edit details</button></div>
        <p className="crm-sub">Not yet home ({open.length})</p>
        {open.length ? <ul className="crm-list">{open.map((c: Row) => <li key={c.id}><div><button type="button" className="crm-link" onClick={() => onOpenCase(c.id)}>{c.title}</button><small>{c.stage}{c.box ? ' · ' + c.box : ''} · since {day(c.created_at)}</small></div></li>)}</ul> : <p className="crm-empty">Nothing missing.</p>}
        <p className="crm-sub">Labelled belongings ({s.items.length})</p>
        {s.items.length ? <ul className="crm-list">{s.items.map((i: Row) => <li key={i.id}><div><span>{i.name}</span><small>{i.category}</small></div><span className="crm-flag">{i.status === 'with_owner' ? 'With them' : i.status.replaceAll('_', ' ')}</span></li>)}</ul> : <p className="crm-empty">Nothing labelled yet. Belongings appear once the family's labels are delivered and scanned.</p>}
        {s.cases.length > open.length && <><p className="crm-sub">Returned before</p><ul className="crm-list">{s.cases.filter((c: Row) => ['returned', 'closed'].includes(c.status)).map((c: Row) => <li key={c.id}><div><button type="button" className="crm-link" onClick={() => onOpenCase(c.id)}>{c.title}</button><small>{c.stage} {day(c.collected_at || c.created_at)}</small></div></li>)}</ul></>}
      </>}
    </motion.aside>
  </motion.div>
}

