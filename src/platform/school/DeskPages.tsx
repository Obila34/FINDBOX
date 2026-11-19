import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, ArrowUpDown, CalendarDays, Camera, Check, Copy, Download, Mail, Pencil, Printer, RefreshCw, Upload, UserMinus, X } from 'lucide-react'
import { api } from '../api'
import { notify } from '../feedback'
import { QRCode } from '@/components/ui/qr-code'
import { CountUp, ease } from '../crm/fx'
import type { Row } from './CasePanel'

const REASON = 'School administrator update'
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const HOUSES = ['green', 'red', 'blue', 'yellow']
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export function Panel({ i = 0, title, action, children }: { i?: number; title: string; action?: ReactNode; children: ReactNode }) {
  const still = useReducedMotion()
  return <motion.section className="crm-panel" initial={still ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: i * 0.07 }} whileHover={still ? undefined : { y: -3 }}><h2>{title}{action}</h2>{children}</motion.section>
}
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="crm-scrim is-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="crm-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>{children}
  </div></div>
}
const fields = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string> }
function useLoad<T>(path: string, version: number) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => { let live = true; api<T>(path).then((d) => { if (live) setData(d) }).catch(() => {}); return () => { live = false } }, [path, version])
  return data
}

/** Attention list: each line is one thing that needs a decision, and goes straight to it. */
export function Attention({ items, go, onOpen }: { items: Row[]; go: (p: string) => void; onOpen: (id: string) => void }) {
  if (!items.length) return <p className="crm-empty">Nothing is waiting on you.</p>
  return <ul className="crm-list">{items.map((x, i) => <li key={i}><i className={'crm-dot t-' + x.tone} /><div><button type="button" className="crm-link" onClick={() => { go(x.page); if (x.record) onOpen(x.record) }}>{x.title}</button></div><ArrowRight size={14} /></li>)}</ul>
}

export function Overview({ home, go, onOpen }: { home: Row; go: (p: string) => void; onOpen: (id: string) => void }) {
  const s = home.stats, c = home.counts, hour = new Date().getHours()
  const parts: [string, string, number][] = [['adoption', 'Parents linked', 35], ['usage', 'Items labelled', 30], ['outcomes', 'Items returned', 15], ['setup', 'Setup', 10], ['support', 'Support', 10]]
  return <>
    <div className="crm-head"><div><h1>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {home.me.name.split(' ')[0]}</h1><p>{home.school.name} · {s.students} students · {s.families} families · {s.items} labelled items</p></div></div>
    <div className="crm-grid">
      <Panel i={0} title="Needs your decision" action={<button type="button" onClick={() => go('approvals')}>Approvals<ArrowRight size={13} /></button>}><Attention items={home.attention} go={go} onOpen={onOpen} /></Panel>
      <Panel i={1} title="Lost and found" action={<button type="button" onClick={() => go('board')}>Open board<ArrowRight size={13} /></button>}>
        <div className="crm-kpis"><div><strong><CountUp value={c.inBox} /></strong><small>In the box</small></div><div><strong style={c.overdue ? { color: 'var(--c-bad)' } : undefined}><CountUp value={c.overdue} /></strong><small>Past collection date</small></div><div><strong><CountUp value={c.unclaimed} /></strong><small>Unclaimed</small></div><div><strong><CountUp value={c.returned30} /></strong><small>Returned, 30 days</small></div></div>
        <div className="crm-legend"><span>{c.lost} reported lost and not yet found</span><span>{home.avgDays === null ? 'No returns yet' : home.avgDays < 1 ? 'Items get home the same day on average' : `${home.avgDays} days on average to get home`}</span></div>
      </Panel>
      <Panel i={2} title="How the rollout is going" action={<button type="button" onClick={() => go('families')}>Invite parents<ArrowRight size={13} /></button>}>
        <div className="crm-health"><span className={'crm-ring b-' + s.health.band}>{s.health.band === 'new' ? 'New' : s.health.score}</span>
          <div className="crm-parts">{parts.map(([k, label, max]) => <div key={k} style={{ gridTemplateColumns: '104px 1fr 40px' }}><span>{label}</span><i><b style={{ width: `${(s.health.parts[k] / max) * 100}%` }} /></i><span>{s.health.parts[k]}/{max}</span></div>)}</div></div>
        <div className="crm-legend"><span>{s.linked} of {s.students} students linked to a parent</span></div>
      </Panel>
      <Panel i={3} title="Collection points" action={<button type="button" onClick={() => go('boxes')}>Manage<ArrowRight size={13} /></button>}>
        {home.boxes.length ? <ul className="crm-list">{home.boxes.map((b: Row) => <li key={b.id}><div><span>{b.name}</span><small>{b.count ? `Oldest item has waited ${b.oldestDays} day${b.oldestDays === 1 ? '' : 's'}` : 'Empty'}</small></div><strong>{b.count}</strong></li>)}</ul> : <p className="crm-empty">No collection box yet.</p>}
        <div className="crm-legend"><span>Today: {home.today.received} received, {home.today.handed} handed back</span>{c.valuables > 0 && <span>{c.valuables} valuable{c.valuables === 1 ? '' : 's'} held</span>}</div>
      </Panel>
      {home.classes.length > 0 && <Panel i={3} title="Classes to nudge" action={<button type="button" onClick={() => go('classes')}>All classes<ArrowRight size={13} /></button>}>
        <ul className="crm-list">{home.classes.map((k: Row) => <li key={k.name}><div><span>{k.name}</span><small>{k.linked} of {k.students} students have a parent linked</small></div><span className={'crm-chip t-' + (k.linked / k.students >= 0.4 ? 'warn' : 'bad')}>{Math.round((k.linked / k.students) * 100)}%</span></li>)}</ul>
      </Panel>}
      <Panel i={3} title="Houses" action={<button type="button" onClick={() => go('houses')}>Standings<ArrowRight size={13} /></button>}>
        <ul className="crm-list">{home.houses.map((h: Row) => <li key={h.house}><i className={'hs-dot is-' + h.house} style={{ width: 11, height: 11 }} /><div><span>{h.name}</span><small>{h.members} members · {h.lost} lost · {h.stars} stars</small></div><strong>{h.score}</strong></li>)}</ul>
      </Panel>
      <Panel i={4} title="Staff" action={<button type="button" onClick={() => go('staff')}>Manage<ArrowRight size={13} /></button>}>
        <ul className="crm-list">{home.team.map((t: Row) => <li key={t.id}><span className={'crm-avatar' + (t.last_seen && Date.now() - new Date(t.last_seen).getTime() < 6e5 ? ' is-live' : '')}>{t.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span><div><span>{t.name}</span><small>{t.role === 'manager' ? 'Administrator' : 'Teacher'} · {t.handled} item{t.handled === 1 ? '' : 's'} handled in 30 days</small></div></li>)}</ul>
      </Panel>
    </div>
  </>
}

type BoardData = { columns: { id: string; title: string; cards: Row[] }[] }
/** The lost-and-found board: where every item is, from reported or found to back home. */
export function DeskBoard({ query, open, onOpen, version, compact = false }: { query: string; open: string | null; onOpen: (id: string) => void; version: number; compact?: boolean }) {
  const still = useReducedMotion(), data = useLoad<BoardData>('/school/desk/board?' + query, version), [flip, setFlip] = useState<Record<string, boolean>>({})
  if (!data) return <p role="status" className="crm-empty">Loading the board…</p>
  return <>
    {!compact && <div className="crm-head"><div><h1>Lost and found</h1><p>Every item, from the moment it is reported or found until it is back with its owner.</p></div></div>}
    <div className="crm-board">{data.columns.map((col, ci) => { const cards = flip[col.id] ? [...col.cards].reverse() : col.cards; return <motion.section key={col.id} className="crm-col" initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: ci * 0.05 }}>
      <header><div><h2>{col.title}</h2></div><button type="button" className="crm-count" title="Reverse the order" onClick={() => setFlip((f) => ({ ...f, [col.id]: !f[col.id] }))}>{col.cards.length}<ArrowUpDown size={13} /></button></header>
      {cards.map((card, n) => <motion.div key={card.id} layout={!still} initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: Math.min(n, 8) * 0.04 }}>
        <article className={'crm-card' + (open === card.id ? ' is-on' : '') + (col.id === 'returned' && open !== card.id ? ' is-done' : '')} tabIndex={0} onClick={() => onOpen(card.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(card.id) }}>
          <h3>{card.title}</h3><p>{card.line}</p>
          {card.flags.length > 0 && <div className="crm-flags">{card.flags.map((f: Row) => <span key={f.text} className={'crm-flag t-' + f.tone}>{f.text}</span>)}</div>}
          <footer><span className={'crm-chip t-' + card.chip.tone}><CalendarDays size={13} />{card.chip.text}</span><span>{card.hasPhoto && <i title="Has a photo"><Camera size={13} /></i>}<i>{card.ref}</i><i>{cap(card.category)}</i></span></footer>
        </article></motion.div>)}
      {!col.cards.length && <p className="crm-empty">Nothing here</p>}
    </motion.section> })}</div>
  </>
}

export function Approvals({ version, onOpen, onChanged, isManager }: { version: number; onOpen: (id: string) => void; onChanged: () => void; isManager: boolean }) {
  const data = useLoad<{ claims: Row[]; disposals: Row[] }>('/school/desk/approvals', version)
  const requests = useLoad<{ rows: Row[] }>(isManager ? '/school/child-requests' : '/school/desk/approvals', version)
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<unknown>, done: string) { setBusy(true); try { await fn(); notify(done); onChanged() } catch { /* toast shown */ } finally { setBusy(false) } }
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  const kids = isManager ? requests?.rows || [] : []
  return <>
    <div className="crm-head"><div><h1>Approvals</h1><p>Decisions only you can make: who belongs to your school, whose item it is, and what may be donated.</p></div></div>
    <div className="crm-grid">
      {isManager && <Panel i={0} title={`Parents adding a child (${kids.length})`}>
        {kids.length ? <ul className="crm-list">{kids.map((r) => <li key={r.id} style={{ flexWrap: 'wrap' }}><div><span>{r.name} · {r.class_name}</span><small>Asked by {r.guardian} ({r.guardian_email}) on {day(r.created_at)}</small><small>{r.match_id ? 'Matches a student on your roster' : 'Not on your roster yet: approving adds them'}</small></div>
          <span className="crm-actions"><button type="button" className="crm-outline" disabled={busy} onClick={() => void run(() => api('/school/child-requests/' + r.id + '/decline', {}), 'Declined. The parent has been told.')}>Decline</button><button type="button" className="crm-primary" disabled={busy} onClick={() => void run(() => api('/school/child-requests/' + r.id + '/approve', {}), `${r.name} is now linked to ${r.guardian}.`)}><Check size={15} />Approve</button></span></li>)}</ul> : <p className="crm-empty">No parents are waiting.</p>}
      </Panel>}
      <Panel i={1} title={`Claims on unclaimed items (${data.claims.length})`}>
        {data.claims.length ? <ul className="crm-list">{data.claims.map((c) => <li key={c.id} style={{ flexWrap: 'wrap' }}><div><button type="button" className="crm-link" onClick={() => onOpen(c.case_id)}>{c.title}</button><small>{c.name} says: “{c.evidence}”</small>{c.private_note && <small>Private detail on file: {c.private_note}</small>}</div>
          <span className="crm-actions"><button type="button" className="crm-outline" disabled={busy} onClick={() => void run(() => api('/staff/claims/' + c.id, { decision: 'rejected' }), 'Claim declined.')}>Decline</button><button type="button" className="crm-primary" disabled={busy} onClick={() => void run(() => api('/staff/claims/' + c.id, { decision: 'approved' }), 'Claim approved. They can collect it.')}><Check size={15} />Approve</button></span></li>)}</ul> : <p className="crm-empty">No claims to review.</p>}
      </Panel>
      {isManager && <Panel i={2} title={`Donation requests (${data.disposals.length})`}>
        {data.disposals.length ? <ul className="crm-list">{data.disposals.map((d) => <li key={d.case_id}><div><button type="button" className="crm-link" onClick={() => onOpen(d.case_id)}>{d.title}</button><small>{d.requested_by}: {d.note}</small></div><button type="button" className="crm-outline" onClick={() => onOpen(d.case_id)}>Review</button></li>)}</ul> : <p className="crm-empty">Nothing is waiting to be donated.</p>}
      </Panel>}
    </div>
  </>
}

function csvRows(text: string): string[][] {
  const out: string[][] = []; let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) { const ch = text[i]!
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false; else cell += ch }
    else if (ch === '"') quoted = true; else if (ch === ',') { row.push(cell.trim()); cell = '' } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); cell = ''; if (row.some(Boolean)) out.push(row); row = [] } else cell += ch }
  row.push(cell.trim()); if (row.some(Boolean)) out.push(row)
  return out
}

export function Students({ query, version, onChanged, form, setForm, onOpen, editId, clearEdit }: { query: string; version: number; onChanged: () => void; form: string; setForm: (f: string) => void; onOpen: (id: string) => void; editId?: string; clearEdit?: () => void }) {
  const [page, setPage] = useState(0), [edit, setEdit] = useState<Row | null>(null), [busy, setBusy] = useState(false), [preview, setPreview] = useState<{ good: Row[]; bad: Row[] } | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const params = new URLSearchParams(query), q = params.get('q') || '', status = params.get('filter') || 'all'
  useEffect(() => setPage(0), [query])
  const data = useLoad<{ rows: Row[]; hasMore?: boolean }>(`/school/students?q=${encodeURIComponent(q)}&status=${status}&page=${page}`, version)
  async function run(fn: () => Promise<unknown>, done: string) { setBusy(true); try { await fn(); notify(done); setEdit(null); setForm(''); setPreview(null); onChanged() } catch { /* toast shown */ } finally { setBusy(false) } }
  function save(e: FormEvent<HTMLFormElement>) {
    const f = fields(e), body = { schoolReference: f.schoolReference, name: f.name, className: f.className, guardianEmail: f.guardianEmail || '', consentReference: f.consentReference }
    void (edit ? run(() => api('/school/students/' + edit.id, { ...body, status: f.status, revision: edit.revision, reason: REASON }), `${f.name} updated.`) : run(() => api('/school/students/import', { rows: [body], reason: REASON }), `${f.name} added to the roster.`))
  }
  async function pick(f?: File) {
    if (!f) return
    const lines = csvRows(await f.text()); if (lines.length < 2) { notify('That file has no students in it.', 'error'); return }
    const head = lines[0]!.map((h) => h.toLowerCase().replace(/[^a-z]/g, '')), at = (names: string[]) => head.findIndex((h) => names.includes(h))
    const ref = at(['schoolreference', 'admissionnumber', 'admno', 'reference', 'id']), name = at(['name', 'studentname', 'fullname']), cls = at(['classname', 'class', 'grade']), mail = at(['guardianemail', 'parentemail', 'email'])
    if (ref < 0 || name < 0 || cls < 0) { notify('The file needs columns for admission number, name and class.', 'error'); return }
    const rows = lines.slice(1, 1001).map((l) => ({ schoolReference: l[ref] || '', name: l[name] || '', className: l[cls] || '', guardianEmail: mail >= 0 ? l[mail] || '' : '', consentReference: 'School enrolment record' }))
    setBusy(true)
    try { const good: Row[] = [], bad: Row[] = []; for (let i = 0; i < rows.length; i += 100) { const r = await api<{ rows: Row[] }>('/school/students/preview', { rows: rows.slice(i, i + 100) }); r.rows.forEach((x, n) => (x.error ? bad.push({ ...rows[i + n], error: x.error, line: i + n + 2 }) : good.push(rows[i + n]!))) } setPreview({ good, bad }) } catch { /* toast shown */ } finally { setBusy(false) }
  }
  useEffect(() => { if (editId && data) { const s = data.rows.find((x) => x.id === editId); if (s) setEdit(s); clearEdit?.() } }, [editId, data]) // eslint-disable-line react-hooks/exhaustive-deps
  async function inviteAll() {
    setBusy(true)
    try {
      const waiting: Row[] = []
      for (let p = 0; p < 10; p++) { const r = await api<{ rows: Row[]; hasMore?: boolean }>(`/school/students?q=&status=unlinked&page=${p}`); waiting.push(...r.rows.filter((s) => s.guardian_email)); if (!r.hasMore) break }
      if (!waiting.length) { notify('No unlinked students have a parent email on file. Add emails, or share the parent link.', 'info'); return }
      if (!window.confirm(`Email an invitation to the parents of ${waiting.length} student${waiting.length === 1 ? '' : 's'}?`)) return
      let sent = 0
      for (const s of waiting) { try { await api('/school/students/' + s.id + '/guardian', { reason: REASON }); sent++ } catch { /* keep going */ } }
      notify(`${sent} invitation${sent === 1 ? '' : 's'} sent.`); onChanged()
    } catch { /* toast shown */ } finally { setBusy(false) }
  }
  const showForm = form === 'student' || edit
  return <>
    <div className="crm-head"><div><h1>Students</h1><p>Your roster. A student linked to a parent gets a FindBox QR for their belongings.</p></div>
      <div className="crm-actions"><button type="button" className="crm-outline" disabled={busy} onClick={() => void inviteAll()}><Mail size={14} />Invite all parents</button><button type="button" className="crm-outline" disabled={busy} onClick={() => file.current?.click()}><Upload size={14} />Import a list</button><a className="crm-outline" href="/api/school/students/export?format=csv" download><Download size={14} />Export</a>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} /></div></div>
    {!data ? <p role="status" className="crm-empty">Loading…</p> : !data.rows.length ? <p className="crm-empty">{q || status !== 'all' ? 'No students match.' : 'No students yet. Add one, or import your class lists as a CSV file (admission number, name, class, parent email).'}</p> : <div className="crm-table-wrap"><table className="crm-table">
      <thead><tr>{['Student', 'Class', 'House', 'Parent', 'Status', ''].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{data.rows.slice(0, 50).map((s) => <tr key={s.id} style={{ cursor: 'default' }}>
        <td><button type="button" className="crm-link" onClick={() => onOpen(s.id)}><strong>{s.name}</strong></button><small>{s.school_reference}</small></td><td>{s.class_name}</td>
        <td><select aria-label={'House for ' + s.name} value={s.house || ''} disabled={busy || s.status !== 'active'} style={{ width: 'auto', padding: '5px 8px' }} onChange={(e) => void run(() => api('/school/houses/' + s.id, { house: e.target.value || null }), 'House updated.')}><option value="">None</option>{HOUSES.map((h) => <option key={h} value={h}>{cap(h)}</option>)}</select></td>
        <td>{s.guardian_id ? <span className="crm-chip t-good">Linked</span> : s.guardian_email ? <button type="button" className="crm-outline" style={{ padding: '4px 9px', fontSize: 12 }} disabled={busy} onClick={() => void run(() => api('/school/students/' + s.id + '/guardian', { reason: REASON }), `Invitation sent to ${s.guardian_email}.`)}><Mail size={12} />Invite</button> : <span className="crm-chip t-muted">No email</span>}</td>
        <td>{cap(s.status)}</td><td><button type="button" className="crm-icon" aria-label={'Edit ' + s.name} onClick={() => setEdit(s)}><Pencil size={15} /></button></td>
      </tr>)}</tbody></table></div>}
    {data && (page > 0 || data.rows.length > 50 || data.hasMore) && <div className="crm-actions" style={{ marginTop: 14, justifyContent: 'flex-end' }}><button type="button" className="crm-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="crm-chip t-muted">Page {page + 1}</span><button type="button" className="crm-outline" disabled={!(data.rows.length > 50 || data.hasMore)} onClick={() => setPage(page + 1)}>Next</button></div>}
    {showForm && <Dialog title={edit ? 'Edit ' + edit.name : 'Add a student'} onClose={() => { setEdit(null); setForm('') }}><form className="crm-form" onSubmit={save}><fieldset disabled={busy} style={{ display: 'contents' }}>
      <div className="crm-two"><label>Full name<input name="name" required maxLength={100} defaultValue={edit?.name} autoFocus /></label><label>Admission number<input name="schoolReference" required maxLength={80} defaultValue={edit?.school_reference} /></label></div>
      <div className="crm-two"><label>Class<input name="className" required maxLength={80} defaultValue={edit?.class_name} placeholder="e.g. Grade 4 East" /></label><label>Parent or guardian email (optional)<input name="guardianEmail" type="email" maxLength={254} defaultValue={edit?.guardian_email} /></label></div>
      <label>Consent on file<input name="consentReference" required maxLength={300} defaultValue={edit?.consent_reference || 'School enrolment record'} /></label>
      {edit && <label>Status<select name="status" defaultValue={edit.status}><option value="active">Active</option><option value="left">Left the school</option><option value="transferred">Transferred</option><option value="archived">Archived</option></select></label>}
      <div className="crm-actions"><button className="crm-primary">{edit ? 'Save changes' : 'Add student'}</button><button type="button" className="crm-outline" onClick={() => { setEdit(null); setForm('') }}>Cancel</button></div>
    </fieldset></form></Dialog>}
    {preview && <Dialog title="Import students" onClose={() => setPreview(null)}>
      <div className="crm-kpis"><div><strong>{preview.good.length}</strong><small>Ready to import</small></div><div><strong style={preview.bad.length ? { color: 'var(--c-bad)' } : undefined}>{preview.bad.length}</strong><small>Need fixing</small></div></div>
      {preview.bad.length > 0 && <ul className="crm-list" style={{ maxHeight: 180, overflow: 'auto' }}>{preview.bad.slice(0, 30).map((b) => <li key={b.line}><div><span>Line {b.line}: {b.name || 'no name'}</span><small>{b.error}</small></div></li>)}</ul>}
      <div className="crm-actions"><button type="button" className="crm-primary" disabled={busy || !preview.good.length} onClick={() => void run(async () => { for (let i = 0; i < preview.good.length; i += 100) await api('/school/students/import', { rows: preview.good.slice(i, i + 100), reason: REASON }) }, `${preview.good.length} students imported.`)}>Import {preview.good.length} students</button><button type="button" className="crm-outline" onClick={() => setPreview(null)}>Cancel</button></div>
    </Dialog>}
  </>
}

export function Families({ home, version, onChanged }: { home: Row; version: number; onChanged: () => void }) {
  const link = useLoad<{ code: string | null; live: boolean; name: string }>('/school/join-link', version), [busy, setBusy] = useState(false)
  const url = link?.code ? `${location.origin.replace('//school.', '//')}/app/sign-up?school=${encodeURIComponent(link.code)}` : ''
  const s = home.stats
  return <>
    <div className="crm-head"><div><h1>Families</h1><p>Parents join with your school's link, then add their child for you to approve.</p></div></div>
    <div className="crm-grid">
      <Panel i={0} title="Parent invitation">
        {!link ? <p role="status">Loading…</p> : !link.code ? <><p className="crm-empty">Create the link parents use to join {link.name}.</p><div className="crm-actions"><button type="button" className="crm-primary" disabled={busy} onClick={() => { setBusy(true); void api('/school/join-link', {}).then(() => { notify('Parent link created.'); onChanged() }).catch(() => {}).finally(() => setBusy(false)) }}>Create parent link</button></div></> : <>
          <div className="sd-poster" id="sd-poster"><p>{link.name}</p><h3>Join us on FindBox</h3><QRCode value={url} size={190} variant="rounded" errorCorrection="Q" color="#123a2e" aria-label="QR code parents scan to join" /><small>Scan with your phone camera to create your parent account.</small></div>
          <label className="crm-form" style={{ fontSize: 12, color: 'var(--c-mute)' }}>Link<input readOnly value={url} onFocus={(e) => e.currentTarget.select()} /></label>
          <div className="crm-actions"><button type="button" className="crm-primary" onClick={() => { void navigator.clipboard.writeText(url).then(() => notify('Link copied.')) }}><Copy size={14} />Copy link</button><button type="button" className="crm-outline" onClick={() => window.print()}><Printer size={14} />Print poster</button>
            <button type="button" className="crm-outline" disabled={busy} onClick={() => { if (!window.confirm('Make a new link? The old link and printed posters will stop working.')) return; setBusy(true); void api('/school/join-link', {}).then(() => { notify('New link created. The old one no longer works.'); onChanged() }).catch(() => {}).finally(() => setBusy(false)) }}><RefreshCw size={14} />New link</button></div>
        </>}
      </Panel>
      <Panel i={1} title="Where you are">
        <div className="crm-kpis"><div><strong><CountUp value={s.families} /></strong><small>Families joined</small></div><div><strong><CountUp value={s.linked} /></strong><small>Students linked</small></div><div><strong><CountUp value={Math.max(0, s.students - s.linked)} /></strong><small>Students not linked yet</small></div></div>
        <div className="crm-stack"><i className="b-green" style={{ width: `${s.students ? (s.linked / s.students) * 100 : 0}%` }} /></div>
        <p className="crm-legend">Send the link in your newsletter or class groups, or print the poster for the gate and reception. Parents waiting for approval appear under Approvals.</p>
      </Panel>
    </div>
  </>
}

export function StaffPage({ version, onChanged, form, setForm }: { version: number; onChanged: () => void; form: string; setForm: (f: string) => void }) {
  const data = useLoad<{ members: Row[]; invites: Row[] }>('/school/staff', version), [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<unknown>, done: string) { setBusy(true); try { await fn(); notify(done); setForm(''); onChanged() } catch { /* toast shown */ } finally { setBusy(false) } }
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  return <>
    <div className="crm-head"><div><h1>Staff</h1><p>Teachers and office staff use the FindBox staff app on their phone to log found items and hand them back.</p></div></div>
    <div className="crm-grid">
      <Panel i={0} title={`Team (${data.members.length})`}><ul className="crm-list">{data.members.map((m) => <li key={m.id}><span className="crm-avatar">{m.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</span><div><span>{m.name}</span><small>{m.email} · {m.last_seen ? 'last active ' + day(m.last_seen) : 'not signed in yet'}</small></div>
        {m.role === 'manager' ? <span className="crm-flag">Administrator</span> : <button type="button" className="crm-icon" aria-label={'Remove ' + m.name} title="Remove access" disabled={busy} onClick={() => { if (window.confirm(`Remove ${m.name}'s access to ${'your school'}?`)) void run(() => api('/school/staff/' + m.id + '/remove', {}), `${m.name} no longer has access.`) }}><UserMinus size={16} /></button>}</li>)}</ul></Panel>
      <Panel i={1} title={`Invitations (${data.invites.length})`}>
        {data.invites.length ? <ul className="crm-list">{data.invites.map((v) => <li key={v.id}><div><span>{v.name}</span><small>{v.email} · expires {day(v.expires_at)}</small></div><button type="button" className="crm-outline" disabled={busy} onClick={() => void run(() => api('/school/staff/invites/' + v.id + '/cancel', {}), 'Invitation cancelled.')}>Cancel</button></li>)}</ul> : <p className="crm-empty">No invitations waiting.</p>}
        <div className="crm-actions"><button type="button" className="crm-primary" onClick={() => setForm('staff')}>Invite a teacher</button></div>
      </Panel>
    </div>
    {form === 'staff' && <Dialog title="Invite a teacher" onClose={() => setForm('')}><form className="crm-form" onSubmit={(e) => { const f = fields(e); void run(() => api('/school/staff/invite', { name: f.name, email: f.email }), `Invitation sent to ${f.email}.`) }}><fieldset disabled={busy} style={{ display: 'contents' }}>
      <label>Name<input name="name" required maxLength={100} autoFocus /></label><label>Work email<input name="email" type="email" required maxLength={254} /></label>
      <p className="crm-legend">They get an email to set a password, then sign in at the school portal and use the staff app.</p>
      <div className="crm-actions"><button className="crm-primary">Send invitation</button><button type="button" className="crm-outline" onClick={() => setForm('')}>Cancel</button></div>
    </fieldset></form></Dialog>}
  </>
}

export function Boxes({ version, onChanged, form, setForm, load = [] }: { version: number; onChanged: () => void; form: string; setForm: (f: string) => void; load?: Row[] }) {
  const data = useLoad<{ rows: Row[] }>('/school/boxes', version), [edit, setEdit] = useState<Row | null>(null), [busy, setBusy] = useState(false)
  const close = () => { setEdit(null); setForm('') }
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  return <>
    <div className="crm-head"><div><h1>Collection boxes</h1><p>Where found items wait for their owners. Staff choose a box when they receive an item.</p></div></div>
    {data.rows.length ? <div className="crm-grid">{data.rows.map((b, i) => <Panel key={b.id} i={i} title={b.name} action={<button type="button" onClick={() => setEdit(b)}><Pencil size={13} />Edit</button>}>
      <p style={{ fontSize: 13.5 }}>{b.directions}</p><div className="crm-flags"><span className="crm-flag">{b.opening_hours}</span><span className={'crm-flag ' + (b.active ? 't-good' : 't-warn')}>{b.active ? 'In use' : 'Not in use'}</span>{(() => { const l = load.find((x) => x.id === b.id); return l ? <span className="crm-flag">{l.count} item{l.count === 1 ? '' : 's'} inside{l.count ? `, oldest ${l.oldestDays} day${l.oldestDays === 1 ? '' : 's'}` : ''}</span> : null })()}</div>
    </Panel>)}</div> : <p className="crm-empty">No collection box yet. Add one so found items have somewhere to go.</p>}
    {(form === 'box' || edit) && <Dialog title={edit ? 'Edit ' + edit.name : 'Add a collection box'} onClose={close}><form className="crm-form" onSubmit={(e) => { const f = fields(e); setBusy(true); void api('/school/boxes', { ...(edit ? { id: edit.id } : {}), name: f.name, directions: f.directions, hours: f.hours, active: f.active === 'on', publicListing: false, reason: REASON }).then(() => { notify('Collection box saved.'); close(); onChanged() }).catch(() => {}).finally(() => setBusy(false)) }}><fieldset disabled={busy} style={{ display: 'contents' }}>
      <label>Name<input name="name" required maxLength={100} defaultValue={edit?.name} placeholder="e.g. Reception" autoFocus /></label>
      <label>Where is it?<input name="directions" required maxLength={500} defaultValue={edit?.directions} placeholder="e.g. Main office, next to the front desk" /></label>
      <label>When can parents collect?<input name="hours" required maxLength={200} defaultValue={edit?.opening_hours} placeholder="e.g. Mon to Fri, 8am to 4pm" /></label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--c-ink)' }}><input name="active" type="checkbox" defaultChecked={edit ? edit.active : true} style={{ width: 'auto' }} />In use</label>
      <div className="crm-actions"><button className="crm-primary">Save box</button><button type="button" className="crm-outline" onClick={close}>Cancel</button></div>
    </fieldset></form></Dialog>}
  </>
}

export function Report({ school }: { school: string }) {
  const [span, setSpan] = useState('90'), r = useLoad<Row>('/school/desk/report?days=' + span, 0)
  const table = (title: string, rows: Row[], i: number) => <Panel i={i} title={title}>{rows.length ? <div className="crm-funnel">{rows.slice(0, 10).map((g) => <div key={g.name} style={{ gridTemplateColumns: '120px 1fr 74px' }}><span>{g.name}</span><motion.i initial={{ width: 0 }} animate={{ width: `${(g.found / Math.max(1, rows[0]!.found)) * 100}%` }} transition={{ duration: 0.8, ease }} /><span>{g.returned}/{g.found}</span></div>)}</div> : <p className="crm-empty">Nothing in this period.</p>}</Panel>
  function exportCsv() {
    if (!r) return
    const lines = [['Section', 'Name', 'Found', 'Returned'], ...(['byCategory', 'byClass', 'byHouse', 'byBox'] as const).flatMap((k) => r[k].map((g: Row) => [k.slice(2), g.name, g.found, g.returned]))]
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map((v: string | number) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'findbox-lost-and-found-report.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <div className="crm-head"><div><h1>Report</h1><p>{school}: lost and found over the last {span === '365' ? 'year' : span + ' days'}. Counts are found/returned.</p></div>
      <div className="crm-actions"><div className="crm-tabs">{[['30', '30 days'], ['90', 'Term'], ['365', 'Year']].map(([v, l]) => <button type="button" key={v} className={span === v ? 'is-on' : ''} onClick={() => setSpan(v!)}>{l}</button>)}</div><button type="button" className="crm-outline" onClick={exportCsv} disabled={!r}><Download size={14} />Export</button><button type="button" className="crm-outline" onClick={() => window.print()}><Printer size={14} />Print</button></div></div>
    {!r ? <p role="status" className="crm-empty">Loading…</p> : <div className="crm-grid">
      <Panel i={0} title="Summary"><div className="crm-kpis"><div><strong><CountUp value={r.total} /></strong><small>Items logged</small></div><div><strong><CountUp value={r.returned} /></strong><small>Back with owners</small></div><div><strong>{r.returnRate === null ? '—' : r.returnRate + '%'}</strong><small>Return rate</small></div><div><strong>{r.avgDays === null ? '—' : r.avgDays}</strong><small>Days to return</small></div></div>
        <div className="crm-legend"><span>{r.waiting} waiting in a box</span><span>{r.unclaimed} unclaimed</span><span>{r.closed} donated or closed</span></div></Panel>
      {table('By kind of item', r.byCategory, 1)}{table('By class', r.byClass, 2)}{table('By house', r.byHouse, 3)}{table('By collection box', r.byBox, 4)}{r.byPlace.length > 0 && table('Where things are found', r.byPlace, 4)}
      <Panel i={5} title="Staff who handled items">{r.staff.length ? <ul className="crm-list">{r.staff.map((s: Row) => <li key={s.name}><div><span>{s.name}</span><small>{s.received} received · {s.handed} handed back</small></div></li>)}</ul> : <p className="crm-empty">No activity in this period.</p>}
        {r.finders.length > 0 && <div className="crm-legend">{r.finders.map((f: Row) => <span key={f.house}>{cap(f.house)} house: {f.stars} return{f.stars === 1 ? '' : 's'} by students</span>)}</div>}</Panel>
    </div>}
  </>
}

export function Settings({ version, onChanged, onLogout }: { version: number; onChanged: () => void; onLogout: () => void }) {
  const data = useLoad<{ school: Row; checklist: Row }>('/school/setup', version), [busy, setBusy] = useState(false)
  if (!data) return <p role="status" className="crm-empty">Loading…</p>
  const steps: [string, string][] = [['contact', 'Contact person and email'], ['privacy', 'Privacy basis recorded'], ['collection', 'At least one collection box'], ['active', 'School is live']]
  return <>
    <div className="crm-head"><div><h1>Settings</h1><p>Your school's details, and your own sign-in.</p></div></div>
    <div className="crm-grid">
      <Panel i={0} title="School details"><form className="crm-form" onSubmit={(e) => { const f = fields(e); setBusy(true); void api('/school/setup', { contactName: f.contactName, contactEmail: f.contactEmail, privacyBasis: f.privacyBasis, publicListing: false, reason: REASON }).then(() => { notify('School details saved.'); onChanged() }).catch(() => {}).finally(() => setBusy(false)) }}><fieldset disabled={busy} style={{ display: 'contents' }}>
        <div className="crm-two"><label>Contact person<input name="contactName" required maxLength={100} defaultValue={data.school.contact_name} /></label><label>Contact email<input name="contactEmail" type="email" required maxLength={254} defaultValue={data.school.contact_email} /></label></div>
        <label>On what basis does the school hold student data? (for example, your enrolment and data protection policy)<textarea name="privacyBasis" required maxLength={1000} defaultValue={data.school.privacy_basis} /></label>
        <div className="crm-actions"><button className="crm-primary">Save details</button></div>
      </fieldset></form></Panel>
      <Panel i={1} title="Setup checklist"><ul className="crm-list">{steps.map(([k, label]) => <li key={k}><span className={'crm-check' + (data.checklist[k] ? ' is-on' : '')}>{data.checklist[k] && <Check size={13} />}</span><div><span>{label}</span></div></li>)}</ul></Panel>
      <Panel i={2} title="Your account"><div className="crm-actions"><a className="crm-outline" href="/app/security">Password and security</a><a className="crm-outline" href="/manage">Open the staff app</a><button type="button" className="crm-outline" onClick={onLogout}>Sign out</button></div></Panel>
    </div>
  </>
}
