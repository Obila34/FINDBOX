import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, Download, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { api, money } from '../api'
import { CountUp, ease } from './fx'
import { notify } from '../feedback'
import type { RecordRef, Row } from './Board'

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) : 'No date')
const BANDS: [string, string][] = [['green', 'Healthy'], ['amber', 'Needs attention'], ['red', 'At risk'], ['new', 'New']]

function Panel({ i, children }: { i: number; children: React.ReactNode }) {
  const still = useReducedMotion()
  return <motion.section className="crm-panel" initial={still ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: i * 0.07 }} whileHover={still ? undefined : { y: -3 }}>{children}</motion.section>
}
const N = ({ v }: { v: number }) => <CountUp value={v} />

/** The work queue is read from live data: orders to fulfil, overdue tickets, stalled leads, schools at risk. */
function Queue({ items, go, onOpen, limit }: { items: Row[]; go: (page: string) => void; onOpen: (r: RecordRef) => void; limit?: number }) {
  if (!items.length) return <p className="crm-empty">Nothing is waiting on you.</p>
  return <ul className="crm-list">{items.slice(0, limit ?? items.length).map((x, i) => <li key={i}><i className={'crm-dot t-' + x.tone} /><div><button type="button" className="crm-link" onClick={() => { go(x.page); if (x.record) onOpen(x.record) }}>{x.title}</button></div><ArrowRight size={14} /></li>)}</ul>
}

export function Dashboard({ home, go, onOpen, version, onIssue }: { home: Row; go: (page: string) => void; onOpen: (r: RecordRef) => void; version: number; onIssue?: (title: string) => void }) {
  const [queue, setQueue] = useState<Row[]>([])
  useEffect(() => { api<{ queue: Row[] }>('/company/crm/tasks').then((d) => setQueue(d.queue)).catch(() => {}) }, [version])
  const p = home.pipeline, h = home.schools, max = p ? Math.max(1, ...p.byStage.map((s: Row) => s.count)) : 1
  return <>
    <div className="crm-head"><div><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {home.me.name.split(' ')[0]}</h1><p>{home.customers.schools} partner school{home.customers.schools === 1 ? '' : 's'} · {home.customers.families} families · {home.customers.students} students</p></div></div>
    <div className="crm-grid">
      <Panel i={0}><h2>Needs attention<button type="button" onClick={() => go('tasks')}>All tasks<ArrowRight size={13} /></button></h2><Queue items={queue} go={go} onOpen={onOpen} limit={6} /></Panel>
      {home.issues && <Panel i={1}><h2>System issues<button type="button" onClick={() => go('issues')}>Open board<ArrowRight size={13} /></button></h2>
        <div className="crm-kpis"><div><strong><N v={home.issues.open} /></strong><small>Open</small></div><div><strong style={home.issues.critical ? { color: 'var(--c-bad)' } : undefined}><N v={home.issues.critical} /></strong><small>Critical or major</small></div><div><strong style={home.issues.overdue ? { color: 'var(--c-bad)' } : undefined}><N v={home.issues.overdue} /></strong><small>Overdue</small></div><div><strong>{home.issues.mttrHours === null ? '—' : home.issues.mttrHours < 48 ? home.issues.mttrHours + 'h' : Math.round(home.issues.mttrHours / 24) + 'd'}</strong><small>Average time to fix</small></div></div>
        {home.issues.byArea.length > 0 && <div className="crm-funnel">{home.issues.byArea.map((a: Row) => <div key={a.area}><span>{a.title}</span><motion.i initial={{ width: 0 }} animate={{ width: `${(a.count / Math.max(1, ...home.issues.byArea.map((x: Row) => x.count))) * 100}%` }} transition={{ duration: 0.8, ease, delay: 0.2 }} /><span>{a.count}</span></div>)}</div>}
        <div className="crm-legend">{home.issues.bySeverity.map((s: Row) => <span key={s.severity}>{s.title}: {s.count}</span>)}</div>
      </Panel>}
      {home.signals && <Panel i={2}><h2>System signals<button type="button" onClick={() => go('legacy:overview')}>System health<ArrowRight size={13} /></button></h2>
        <ul className="crm-list">{home.signals.map((s: Row) => <li key={s.name}><i className={'crm-dot t-' + (s.state === 'ok' ? 'good' : s.state)} /><div><button type="button" className="crm-link" onClick={() => go(s.page)}>{s.name}</button><small>{s.detail}</small></div>{s.state !== 'ok' && onIssue && <button type="button" className="crm-outline" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => onIssue(s.name + ': ' + s.detail)}>Log issue</button>}</li>)}</ul>
      </Panel>}
      {p && <Panel i={1}><h2>School pipeline<button type="button" onClick={() => go('leads')}>Open board<ArrowRight size={13} /></button></h2>
        <div className="crm-kpis"><div><strong><N v={p.open} /></strong><small>Open leads</small></div><div><strong><CountUp value={p.weightedMinor} format={(n) => money(Math.round(n))} /></strong><small>Weighted forecast</small></div><div><strong>{p.winRate === null ? '—' : p.winRate + '%'}</strong><small>Win rate</small></div><div><strong>{p.avgCycleDays === null ? '—' : p.avgCycleDays + 'd'}</strong><small>Average time to win</small></div></div>
        <div className="crm-funnel">{p.byStage.map((s: Row) => <div key={s.stage}><span>{s.title}</span><motion.i initial={{ width: 0 }} animate={{ width: `${(s.count / max) * 100}%` }} transition={{ duration: 0.8, ease, delay: 0.2 }} style={{ opacity: s.stage === 'lost' ? 0.35 : 1 }} /><span>{s.count}</span></div>)}</div>
        {p.bySource.length > 0 && <div className="crm-legend">{p.bySource.map((s: Row) => <span key={s.source}>{s.source[0].toUpperCase() + s.source.slice(1)}: {s.count}</span>)}</div>}
      </Panel>}
      <Panel i={2}><h2>School health<button type="button" onClick={() => go('onboarding')}>Open board<ArrowRight size={13} /></button></h2>
        <div className="crm-kpis"><div><strong><N v={h.total} /></strong><small>Schools</small></div><div><strong><N v={h.green} /></strong><small>Healthy</small></div><div><strong><N v={h.red} /></strong><small>At risk</small></div></div>
        {h.total > 0 && <div className="crm-stack">{BANDS.map(([b]) => h[b] > 0 && <i key={b} className={'b-' + b} style={{ width: `${(h[b] / h.total) * 100}%` }} />)}</div>}
        <div className="crm-legend">{BANDS.map(([b, label]) => <span key={b}><i className={'b-' + b} style={{ background: b === 'green' ? 'var(--c-good)' : b === 'amber' ? 'var(--c-warn)' : b === 'red' ? 'var(--c-bad)' : 'var(--c-mute)' }} />{label} {h[b]}</span>)}</div>
      </Panel>
      {home.orders && <Panel i={3}><h2>Orders<button type="button" onClick={() => go('orders')}>Open board<ArrowRight size={13} /></button></h2>
        <div className="crm-kpis"><div><strong><N v={home.orders.toFulfil} /></strong><small>To fulfil</small></div><div><strong><N v={home.orders.toDeliver} /></strong><small>To deliver</small></div><div><strong><CountUp value={home.orders.collected30Minor} format={(n) => money(Math.round(n))} /></strong><small>Collected, last 30 days</small></div></div>
      </Panel>}
      {home.support && <Panel i={4}><h2>Support<button type="button" onClick={() => go('support')}>Open board<ArrowRight size={13} /></button></h2>
        <div className="crm-kpis"><div><strong><N v={home.support.new} /></strong><small>New</small></div><div><strong><N v={home.support.open} /></strong><small>Open</small></div><div><strong style={home.support.overdue ? { color: 'var(--c-bad)' } : undefined}>{home.support.overdue}</strong><small>Overdue</small></div></div>
      </Panel>}
    </div>
  </>
}

function csv(name: string, head: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"' : s }
  const url = URL.createObjectURL(new Blob([[head, ...rows].map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Customers({ kind, setKind, query, onOpen, version }: { kind: 'schools' | 'families'; setKind: (k: 'schools' | 'families') => void; query: string; onOpen: (r: RecordRef) => void; version: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => { let live = true; setRows(null); api<{ rows: Row[] }>(`/company/crm/customers?type=${kind}&${query}`).then((d) => { if (live) setRows(d.rows) }).catch(() => { if (live) setRows([]) }); return () => { live = false } }, [kind, query, version])
  const schools = kind === 'schools'
  return <>
    <div className="crm-head"><div><h1>Customers</h1><p>{schools ? 'Partner schools with their health score.' : 'Parents and guardians. Children are shown only inside a family record.'}</p></div>
      <div className="crm-actions"><div className="crm-tabs"><button type="button" className={schools ? 'is-on' : ''} onClick={() => setKind('schools')}>Schools</button><button type="button" className={!schools ? 'is-on' : ''} onClick={() => setKind('families')}>Families</button></div>
        <button type="button" className="crm-outline" disabled={!rows?.length} onClick={() => rows && csv(`findbox-${kind}.csv`, schools ? ['School', 'Contact', 'Students', 'Families', 'Items', 'Health'] : ['Name', 'Email', 'School', 'Children', 'Items', 'Spent KSh'], rows.map((r) => schools ? [r.name, r.sub, r.a, r.b, r.c, r.health.score] : [r.name, r.sub, r.school, r.a, r.b, r.c / 100]))}><Download size={14} />Export</button></div></div>
    {!rows ? <p role="status" className="crm-empty">Loading…</p> : !rows.length ? <p className="crm-empty">No {kind} match.</p> : <div className="crm-table-wrap"><table className="crm-table">
      <thead><tr>{(schools ? ['School', 'Students', 'Families', 'Items', 'Health'] : ['Family', 'School', 'Children', 'Items', 'Spent']).map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id} tabIndex={0} onClick={() => onOpen({ type: r.type, id: r.id })} onKeyDown={(e) => { if (e.key === 'Enter') onOpen({ type: r.type, id: r.id }) }}>
        <td><strong>{r.name}</strong><small>{r.sub}</small></td>
        {schools ? <><td>{r.a}</td><td>{r.b}</td><td>{r.c}</td><td><span className={'crm-chip t-' + ({ green: 'good', amber: 'warn', red: 'bad', new: 'muted' } as Row)[r.health.band]}>{r.health.band === 'new' ? 'New' : r.health.score}</span></td></>
          : <><td>{r.school || '—'}</td><td>{r.a}</td><td>{r.b}</td><td>{r.c ? money(r.c) : '—'}</td></>}
      </tr>)}</tbody>
    </table></div>}
  </>
}

export function Tasks({ go, onOpen, version, onChanged, mine }: { go: (page: string) => void; onOpen: (r: RecordRef) => void; version: number; onChanged: () => void; mine: boolean }) {
  const [data, setData] = useState<{ tasks: Row[]; queue: Row[] } | null>(null)
  const load = () => api<{ tasks: Row[]; queue: Row[] }>('/company/crm/tasks?scope=' + (mine ? 'mine' : 'all')).then(setData).catch(() => setData({ tasks: [], queue: [] }))
  useEffect(() => { void load() }, [version, mine]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  const today = new Date().toISOString().slice(0, 10)
  return <>
    <div className="crm-head"><div><h1>Tasks</h1><p>{mine ? 'Your tasks and what the business needs next.' : 'Everyone’s tasks and what the business needs next.'}</p></div></div>
    <div className="crm-grid">
      <section className="crm-panel"><h2>Work queue</h2><Queue items={data.queue} go={go} onOpen={onOpen} /></section>
      <section className="crm-panel"><h2>{mine ? 'My tasks' : 'Team tasks'}</h2>
        {data.tasks.length ? <ul className="crm-list">{data.tasks.map((t) => <li key={t.id} className={t.status === 'done' ? 'is-done' : ''}>
          <button type="button" className={'crm-check' + (t.status === 'done' ? ' is-on' : '')} aria-label={t.status === 'done' ? 'Reopen task' : 'Complete task'} onClick={() => void api('/company/crm/tasks/' + t.id, { done: t.status !== 'done' }).then(() => { void load(); onChanged() }).catch(() => {})}>{t.status === 'done' && <Check size={13} />}</button>
          <div><span>{t.title}</span><small>{t.entity_id ? <button type="button" className="crm-link" style={{ fontSize: 12 }} onClick={() => onOpen({ type: t.entity_type, id: t.entity_id })}>{t.entity_label || t.entity_type}</button> : 'General'} · {t.assignee || 'Unassigned'}</small></div>
          <span className={'crm-chip t-' + (t.status === 'open' && t.due_at && String(t.due_at).slice(0, 10) < today ? 'bad' : 'muted')}>{day(t.due_at)}</span>
        </li>)}</ul> : <p className="crm-empty">No tasks yet. Use Add task to create one.</p>}
      </section>
    </div>
  </>
}

export function ActivityFeed({ query, version }: { query: string; version: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => { let live = true; api<{ rows: Row[] }>('/company/crm/activity?' + query).then((d) => { if (live) setRows(d.rows) }).catch(() => { if (live) setRows([]) }); return () => { live = false } }, [query, version])
  if (!rows) return <p role="status" className="crm-empty">Loading…</p>
  let last = ''
  return <>
    <div className="crm-head"><div><h1>Activity</h1><p>Everything operators and school administrators changed, newest first.</p></div></div>
    {!rows.length ? <p className="crm-empty">No activity matches.</p> : <ul className="crm-list">{rows.map((r) => { const d = new Date(r.at).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' }), head = d !== last; last = d; return <li key={r.id} style={head ? { flexWrap: 'wrap' } : undefined}>
      {head && <p className="crm-day" style={{ flexBasis: '100%' }}>{d}</p>}
      <span className="crm-avatar">{r.actor.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span>
      <div><span><strong>{r.actor}</strong> · {r.action}</span><small>{r.reason}</small></div>
      <small>{new Date(r.at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</small>
    </li> })}</ul>}
  </>
}

const AREAS: [string, string][] = [['family_app', 'Family app'], ['school_portal', 'School portal'], ['ops', 'Operations'], ['sign_in', 'Sign-in'], ['payments', 'Payments'], ['email', 'Email'], ['labels', 'Labels & QR'], ['other', 'Other']]
/** Log a system issue, for example from a complaint email: paste the email, say who sent it. */
export function IssueForm({ preset, onClose, onSaved }: { preset?: { title?: string; source?: string }; onClose: () => void; onSaved: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setBusy(true)
    try { const r = await api<{ id: string }>('/company/crm/issues', { title: f.title, description: f.description, source: f.source, severity: f.severity || null, area: f.area, reporterName: f.reporterName, reporterEmail: f.reporterEmail }); notify('Issue logged.'); onSaved(r.id) } catch { /* toast shown */ } finally { setBusy(false) }
  }
  return <div className="crm-scrim is-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><form className="crm-dialog crm-form" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Log a system issue">
    <header><h2>Log a system issue</h2><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
    <fieldset disabled={busy} style={{ display: 'contents' }}>
      <label>What is going wrong?<input name="title" required minLength={3} maxLength={200} defaultValue={preset?.title || ''} autoFocus placeholder="e.g. Parents cannot pay with M-Pesa" /></label>
      <label>Details (paste the complaint email here)<textarea name="description" maxLength={6000} /></label>
      <div className="crm-two"><label>Reported by<input name="reporterName" maxLength={120} placeholder="Name" /></label><label>Their email (they are told when it is fixed)<input name="reporterEmail" type="email" maxLength={254} /></label></div>
      <div className="crm-two"><label>Where did it come from?<select name="source" defaultValue={preset?.source || 'email'}><option value="email">Complaint email</option><option value="support">Support request</option><option value="monitor">System monitoring</option><option value="internal">Noticed by the team</option></select></label><label>Area<select name="area" defaultValue="other">{AREAS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
      <label>Severity, by customer impact (leave for the developer if unsure)<select name="severity" defaultValue=""><option value="">Not sure yet</option><option value="s1">S1 Critical: people cannot use FindBox, or data is at risk</option><option value="s2">S2 Major: an important feature is broken</option><option value="s3">S3 Minor: something is wrong but there is a way round it</option><option value="s4">S4 Cosmetic: looks wrong, works fine</option></select></label>
      <div className="crm-actions"><button className="crm-primary">Log issue</button><button type="button" className="crm-outline" onClick={onClose}>Cancel</button></div>
    </fieldset>
  </form></div>
}

/** Add a school lead. Duplicates (same school or contact email) are refused by the server. */
export function LeadForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setBusy(true)
    try { const r = await api<{ id: string }>('/company/crm/leads', { schoolName: f.schoolName, contactName: f.contactName, contactEmail: f.contactEmail, contactPhone: f.contactPhone, location: f.location, source: f.source, estStudents: f.estStudents ? Number(f.estStudents) : null, valueKes: Number(f.valueKes || 0), nextStep: f.nextStep, nextAt: f.nextAt || null }); notify('Lead added.'); onSaved(r.id) } catch { /* toast shown */ } finally { setBusy(false) }
  }
  return <div className="crm-scrim is-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><form className="crm-dialog crm-form" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Add a school lead">
    <header><h2>Add a school lead</h2><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
    <fieldset disabled={busy} style={{ display: 'contents' }}>
      <label>School name<input name="schoolName" required minLength={2} maxLength={150} autoFocus /></label>
      <div className="crm-two"><label>Contact person<input name="contactName" maxLength={120} /></label><label>Phone<input name="contactPhone" maxLength={30} inputMode="tel" /></label></div>
      <div className="crm-two"><label>Email<input name="contactEmail" type="email" maxLength={254} /></label><label>Location<input name="location" maxLength={150} placeholder="e.g. Kilimani, Nairobi" /></label></div>
      <div className="crm-two"><label>Estimated students<input name="estStudents" type="number" min={1} max={100000} /></label><label>Estimated value (KSh)<input name="valueKes" type="number" min={0} /></label></div>
      <div className="crm-two"><label>Source<select name="source" defaultValue="outreach">{['website', 'referral', 'event', 'outreach', 'other'].map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}</select></label><label>Next step due<input name="nextAt" type="date" /></label></div>
      <label>Next step<input name="nextStep" maxLength={200} placeholder="e.g. Call the head teacher" /></label>
      <div className="crm-actions"><button className="crm-primary">Add lead</button><button type="button" className="crm-outline" onClick={onClose}>Cancel</button></div>
    </fieldset>
  </form></div>
}

export function TaskForm({ team, onClose, onSaved }: { team: Row[]; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setBusy(true)
    try { await api('/company/crm/tasks', { title: f.title, dueAt: f.dueAt || null, assigneeId: f.assigneeId || null }); notify('Task added.'); onSaved() } catch { /* toast shown */ } finally { setBusy(false) }
  }
  return <div className="crm-scrim is-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><form className="crm-dialog crm-form" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Add a task">
    <header><h2>Add a task</h2><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
    <fieldset disabled={busy} style={{ display: 'contents' }}>
      <label>What needs doing?<input name="title" required minLength={2} maxLength={200} autoFocus /></label>
      <div className="crm-two"><label>Due<input name="dueAt" type="date" /></label><label>Assign to<select name="assigneeId" defaultValue=""><option value="">Me</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
      <div className="crm-actions"><button className="crm-primary">Add task</button><button type="button" className="crm-outline" onClick={onClose}>Cancel</button></div>
    </fieldset>
  </form></div>
}
