import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRightLeft, CalendarDays, Check, FileText, Mail, MessageSquare, Phone, ShoppingBag, StickyNote, Users, X } from 'lucide-react'
import { motion } from 'motion/react'
import { api, money } from '../api'
import { spring } from './fx'
import { notify } from '../feedback'
import type { RecordRef, Row } from './Board'

const ICON: Record<string, typeof Mail> = { note: StickyNote, call: Phone, meeting: Users, email: Mail, stage: ArrowRightLeft, audit: FileText, order: ShoppingBag, ticket: MessageSquare }
const when = (d: string) => new Date(d).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => <div><dt>{label}</dt><dd>{children || '—'}</dd></div>
const PARTS: [string, string, number][] = [['adoption', 'Adoption', 35], ['usage', 'Usage', 30], ['outcomes', 'Outcomes', 15], ['setup', 'Setup', 10], ['support', 'Support', 10]]

/** One customer record with everything linked: facts, health, people, orders, tickets, notes, tasks and a timeline. */
export function RecordPanel({ target, team, isAdmin, onClose, onOpen, onChanged, onLegacy }: { target: RecordRef; team: Row[]; isAdmin: boolean; onClose: () => void; onOpen: (r: RecordRef) => void; onChanged: () => void; onLegacy: (tab: string) => void }) {
  const [r, setR] = useState<Row | null>(null), [busy, setBusy] = useState(false), [tab, setTab] = useState<'timeline' | 'tasks'>('timeline'), [schools, setSchools] = useState<Row[]>([])
  const load = () => api<Row>(`/company/crm/record/${target.type}/${encodeURIComponent(target.id)}`).then(setR).catch(() => onClose())
  useEffect(() => { setR(null); setTab('timeline'); void load() }, [target.type, target.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onClose])
  async function run(fn: () => Promise<unknown>, done?: string) { setBusy(true); try { await fn(); if (done) notify(done); await load(); onChanged() } catch { /* toast shown */ } finally { setBusy(false) } }

  function saveLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>, l = r!.lead
    void run(() => api('/company/crm/leads/' + l.id, { revision: l.revision, contactName: f.contactName, contactEmail: f.contactEmail, contactPhone: f.contactPhone, location: f.location, source: f.source, estStudents: f.estStudents ? Number(f.estStudents) : null, valueKes: Number(f.valueKes || 0), nextStep: f.nextStep, nextAt: f.nextAt || null, ownerId: f.ownerId || null }), 'Lead saved.')
  }
  function stage(s: string) {
    const l = r!.lead, body: Row = { revision: l.revision, stage: s }
    if (s === 'lost') { const reason = (document.getElementById('crm-lost') as HTMLInputElement | null)?.value.trim() || ''; if (reason.length < 3) { notify('Say why this lead was lost, then choose Lost.', 'error'); document.getElementById('crm-lost')?.focus(); return } body.lostReason = reason }
    if (s === 'won') { const sid = (document.getElementById('crm-won') as HTMLSelectElement | null)?.value; if (sid) body.schoolId = sid }
    void run(() => api('/company/crm/leads/' + l.id, body), `Moved to ${r!.stages.find((x: Row) => x.id === s)?.title}.`)
  }
  function saveIssue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>, i = r!.issue
    void run(() => api('/company/crm/issues/' + i.id, { revision: i.revision, severity: f.severity || null, area: f.area, assigneeId: f.assigneeId || null, steps: f.steps, resolution: f.resolution, rootCause: f.rootCause }), 'Issue saved.')
  }
  function issueStatus(s: string) {
    const i = r!.issue, val = (idName: string) => (document.getElementById(idName) as HTMLTextAreaElement | null)?.value.trim() ?? ''
    const sev = (document.querySelector('.crm-drawer select[name=severity]') as HTMLSelectElement | null)?.value || null, area = (document.querySelector('.crm-drawer select[name=area]') as HTMLSelectElement | null)?.value
    void run(async () => { const x = await api<{ notified: number }>('/company/crm/issues/' + i.id, { revision: i.revision, status: s, severity: sev, ...(area ? { area } : {}), resolution: val('crm-resolution'), rootCause: val('crm-root') }); if (x.notified) notify(`${x.notified} reporter${x.notified === 1 ? ' has' : 's have'} been emailed that it is fixed.`) }, `Moved to ${r!.stages.find((x: Row) => x.id === s)?.title}.`)
  }
  function addNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = Object.fromEntries(new FormData(form)) as Record<string, string>
    void run(async () => { await api('/company/crm/notes', { entityType: target.type, entityId: target.id, kind: f.kind, body: f.body }); form.reset() }, 'Note added.')
  }
  function addTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = Object.fromEntries(new FormData(form)) as Record<string, string>
    void run(async () => { await api('/company/crm/tasks', { title: f.title, dueAt: f.dueAt || null, assigneeId: f.assigneeId || null, entityType: target.type, entityId: target.id, entityLabel: r!.title }); form.reset() }, 'Task added.')
  }
  useEffect(() => { if (r?.lead && isAdmin && !schools.length) api<{ rows: Row[] }>('/company/crm/customers?type=schools').then((d) => setSchools(d.rows)).catch(() => {}) }, [r?.lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return <motion.div className="crm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <motion.aside className="crm-drawer" role="dialog" aria-modal="true" aria-label={r?.title || 'Record'} initial={{ x: 60, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={spring}>
      {!r ? <p role="status">Opening…</p> : <>
        <header><div><h2>{r.title}</h2><p>{r.subtitle}</p></div><button type="button" className="crm-icon" aria-label="Close" onClick={onClose}><X size={18} /></button></header>

        {r.lead && <>
          <div className="crm-steps" role="group" aria-label="Stage">{r.stages.map((s: Row) => <button type="button" key={s.id} disabled={busy} className={r.lead.stage === s.id ? 'is-on' : ''} onClick={() => r.lead.stage !== s.id && stage(s.id)}>{s.title}</button>)}</div>
          <div className="crm-flags"><span className="crm-flag">Score {r.lead.score}</span><span className="crm-flag">{Math.round(r.lead.probability * 100)}% likely</span>{r.lead.stalled && <span className="crm-flag t-warn">Stalled</span>}{r.lead.overdue && <span className="crm-flag t-bad">Next step overdue</span>}{r.lead.school && <span className="crm-flag t-good">Now {r.lead.school}</span>}</div>
          {r.lead.stage === 'lost' && r.lead.lost_reason && <p className="crm-quote">Lost: {r.lead.lost_reason}</p>}
          <form className="crm-form" onSubmit={saveLead} key={r.lead.revision}><fieldset disabled={busy} style={{ display: 'contents' }}>
            <div className="crm-two"><label>Contact person<input name="contactName" defaultValue={r.lead.contact_name} maxLength={120} /></label><label>Phone<input name="contactPhone" defaultValue={r.lead.contact_phone} maxLength={30} inputMode="tel" /></label></div>
            <div className="crm-two"><label>Email<input name="contactEmail" type="email" defaultValue={r.lead.contact_email} maxLength={254} /></label><label>Location<input name="location" defaultValue={r.lead.location} maxLength={150} /></label></div>
            <div className="crm-two"><label>Estimated students<input name="estStudents" type="number" min={1} max={100000} defaultValue={r.lead.est_students ?? ''} /></label><label>Estimated value (KSh)<input name="valueKes" type="number" min={0} step="1" defaultValue={r.lead.value_kes || ''} /></label></div>
            <div className="crm-two"><label>Next step<input name="nextStep" defaultValue={r.lead.next_step} maxLength={200} placeholder="e.g. Demo with the head teacher" /></label><label>Due<input name="nextAt" type="date" defaultValue={r.lead.next_at || ''} /></label></div>
            <div className="crm-two"><label>Source<select name="source" defaultValue={r.lead.source}>{['website', 'referral', 'event', 'outreach', 'other'].map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}</select></label><label>Owner<select name="ownerId" defaultValue={r.lead.owner_id || ''}><option value="">Unassigned</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
            <div className="crm-actions"><button className="crm-primary"><Check size={15} />Save lead</button></div>
          </fieldset></form>
          {!['won', 'lost'].includes(r.lead.stage) && <div className="crm-form">
            <div className="crm-two"><label>If won, which school did it become?<select id="crm-won" defaultValue=""><option value="">Not created yet</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>If lost, why?<input id="crm-lost" maxLength={300} placeholder="e.g. Chose another supplier" /></label></div>
          </div>}
        </>}

        {r.school && <>
          <div className="crm-health">
            <span className={'crm-ring b-' + r.school.health.band}>{r.school.health.band === 'new' ? 'New' : r.school.health.score}</span>
            <div className="crm-parts">{PARTS.map(([k, label, max]) => <div key={k}><span>{label}</span><i><b style={{ width: `${(r.school.health.parts[k] / max) * 100}%` }} /></i><span>{r.school.health.parts[k]}/{max}</span></div>)}</div>
          </div>
          <dl className="crm-facts">
            <Fact label="Students">{r.school.students}</Fact><Fact label="Linked to a guardian">{r.school.linked}</Fact>
            <Fact label="Families">{r.school.families}</Fact><Fact label="Items labelled">{r.school.items}</Fact>
            <Fact label="Lost items home (90 days)">{r.school.cases90 ? `${r.school.returned90} of ${r.school.cases90}` : 'None lost'}</Fact><Fact label="Collection boxes">{r.school.boxes}</Fact>
            <Fact label="Contact">{[r.school.contact_name, r.school.contact_email].filter(Boolean).join(' · ')}</Fact><Fact label="Partner since">{day(r.school.created_at)}</Fact>
            {r.school.orders && <><Fact label="Label orders">{r.school.orders.count}</Fact><Fact label="Collected">{money(r.school.orders.totalMinor)}</Fact></>}
            {r.school.houses.length > 0 && <Fact label="Houses">{r.school.houses.map((h: Row) => `${h.house} ${h.n}`).join(' · ')}</Fact>}
          </dl>
          <p className="crm-sub">School team</p>
          {r.school.people.length ? <ul className="crm-list">{r.school.people.map((p: Row) => <li key={p.email}><div><span>{p.name}</span><small>{p.email}</small></div><span className="crm-flag">{p.role === 'manager' ? 'Manager' : 'Teacher'}</span></li>)}</ul> : <p className="crm-empty">No manager or teachers yet. Invite a school administrator.</p>}
          <div className="crm-actions"><button type="button" className="crm-outline" onClick={() => onLegacy('schools')}>Manage school access</button>{isAdmin && <button type="button" className="crm-outline" onClick={() => onLegacy('reports')}>School report</button>}</div>
        </>}

        {r.family && <>
          <dl className="crm-facts">
            <Fact label="Email">{r.family.email}</Fact><Fact label="Email verified">{r.family.verified ? 'Yes' : 'Not yet'}</Fact>
            <Fact label="Joined">{day(r.family.created_at)}</Fact><Fact label="Last active">{r.family.last_seen ? when(r.family.last_seen) : '—'}</Fact>
          </dl>
          <p className="crm-sub">Children</p>
          {r.family.children.length ? <ul className="crm-list">{r.family.children.map((c: Row) => <li key={c.id}><div><span>{c.name}</span><small>{[c.school, c.class_name, c.house && c.house + ' house'].filter(Boolean).join(' · ')}</small></div><span className="crm-flag">{c.items} item{c.items === 1 ? '' : 's'}</span></li>)}</ul> : <p className="crm-empty">No children linked yet.</p>}
          {r.family.orders && <><p className="crm-sub">Orders</p>{r.family.orders.length ? <ul className="crm-list">{r.family.orders.map((o: Row) => <li key={o.id}><div><button type="button" className="crm-link" onClick={() => onOpen({ type: 'order', id: o.id })}>{money(Number(o.amount_minor))}</button><small>{day(o.created_at)}</small></div><span className="crm-flag">{o.delivered_at ? 'Delivered' : o.status}</span></li>)}</ul> : <p className="crm-empty">No orders yet.</p>}</>}
          {r.family.tickets?.length > 0 && <><p className="crm-sub">Support</p><ul className="crm-list">{r.family.tickets.map((t: Row) => <li key={t.id}><div><button type="button" className="crm-link" onClick={() => onOpen({ type: 'ticket', id: t.id })}>{t.subject}</button><small>{day(t.created_at)}</small></div><span className="crm-flag">{t.status.replace('_', ' ')}</span></li>)}</ul></>}
        </>}

        {r.issue && <>
          <div className="crm-steps" role="group" aria-label="Status">{r.stages.map((s: Row) => <button type="button" key={s.id} disabled={busy || !r.issue.canEdit} className={r.issue.status === s.id ? 'is-on' : ''} onClick={() => r.issue.status !== s.id && issueStatus(s.id)}>{s.title}</button>)}</div>
          <div className="crm-flags">
            <span className={'crm-flag' + (r.issue.severity === 's1' ? ' t-bad' : r.issue.severity === 's2' ? ' t-warn' : '')}>{r.issue.severity ? r.severities[r.issue.severity] : 'Needs triage'}</span><span className="crm-flag">{r.areas[r.issue.area]}</span>
            {r.issue.sla.triageLate && <span className="crm-flag t-bad">Acknowledge overdue</span>}{r.issue.sla.fixLate && <span className="crm-flag t-bad">Fix overdue</span>}{r.issue.sla.onTime === true && <span className="crm-flag t-good">Fixed on time</span>}{r.issue.sla.onTime === false && <span className="crm-flag t-warn">Fixed late</span>}
            {r.issue.targets && <span className="crm-flag">Target: acknowledge in {r.issue.targets.triage}h, fix in {r.issue.targets.fix >= 48 ? r.issue.targets.fix / 24 + ' days' : r.issue.targets.fix + 'h'}</span>}
          </div>
          {r.issue.description && <p className="crm-quote">{r.issue.description}</p>}
          <p className="crm-sub">Reported by ({r.issue.reports.length})</p>
          {r.issue.reports.length ? <ul className="crm-list">{r.issue.reports.map((p: Row) => <li key={p.id}><div><span>{p.name || p.email || 'Unknown'}</span><small>{[p.email, p.subject && '“' + p.subject + '”', day(p.created_at)].filter(Boolean).join(' · ')}</small></div>{p.notified_at && <span className="crm-flag t-good">Told it's fixed</span>}</li>)}</ul> : <p className="crm-empty">No reporter recorded.</p>}
          <form className="crm-form" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget, f = Object.fromEntries(new FormData(form)) as Record<string, string>; void run(async () => { await api('/company/crm/issues/' + r.issue.id + '/reports', { name: f.name, email: f.email }); form.reset() }, 'Report added to this issue.') }}><fieldset disabled={busy} style={{ display: 'contents' }}>
            <div className="crm-two"><label>Someone else reported this<input name="name" maxLength={120} placeholder="Name" /></label><label>Their email<input name="email" type="email" required maxLength={254} /></label></div>
            <div className="crm-actions"><button className="crm-outline">Add report</button></div>
          </fieldset></form>
          {r.issue.canEdit ? <form className="crm-form" onSubmit={saveIssue} key={r.issue.revision}><fieldset disabled={busy} style={{ display: 'contents' }}>
            <div className="crm-two"><label>Severity (by customer impact)<select name="severity" defaultValue={r.issue.severity || ''}><option value="">Not triaged</option>{Object.entries(r.severities).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}</select></label><label>Area<select name="area" defaultValue={r.issue.area}>{Object.entries(r.areas).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}</select></label></div>
            <label>Assigned to<select name="assigneeId" defaultValue={r.issue.assignee_id || ''}><option value="">Unassigned</option>{team.filter((t) => t.role === 'developer').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Steps to reproduce<textarea name="steps" defaultValue={r.issue.steps} maxLength={3000} placeholder={'1. Sign in as a parent\n2. Open Scan\n3. …'} /></label>
            <label>What was fixed (sent to everyone who reported it)<textarea id="crm-resolution" name="resolution" defaultValue={r.issue.resolution} maxLength={3000} /></label>
            <label>Root cause (needed for S1 and S2)<textarea id="crm-root" name="rootCause" defaultValue={r.issue.root_cause} maxLength={3000} /></label>
            <div className="crm-actions"><button className="crm-primary"><Check size={15} />Save issue</button></div>
          </fieldset></form> : <>
            <dl className="crm-facts"><Fact label="Assigned to">{r.issue.assignee}</Fact><Fact label="Logged by">{r.issue.logged_by}</Fact><Fact label="Logged">{when(r.issue.created_at)}</Fact><Fact label="Fixed">{r.issue.fixed_at ? when(r.issue.fixed_at) : 'Not yet'}</Fact></dl>
            {r.issue.resolution && <p className="crm-quote">Fix: {r.issue.resolution}</p>}
          </>}
        </>}

        {r.ticket && <>
          <div className="crm-flags">{r.ticket.overdue && <span className="crm-flag t-bad">Overdue</span>}<span className="crm-flag">{r.ticket.kind}</span></div>
          <dl className="crm-facts"><Fact label="From">{r.ticket.user_id ? <button type="button" className="crm-link" onClick={() => onOpen({ type: 'family', id: r.ticket.user_id })}>{r.ticket.name}</button> : r.ticket.name}</Fact><Fact label="Email">{r.ticket.email}</Fact><Fact label="Received">{when(r.ticket.created_at)}</Fact><Fact label="Status">{r.ticket.status.replace('_', ' ')}</Fact></dl>
          <p className="crm-quote">{r.ticket.message}</p>
          <form className="crm-form" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; void run(() => api('/company/support/' + r.ticket.id, { status: f.status, reply: f.reply || '', reason: 'Support ticket updated from the CRM board' }), f.reply ? 'Reply queued and ticket updated.' : 'Ticket updated.') }}><fieldset disabled={busy} style={{ display: 'contents' }}>
            <label>Reply to {r.ticket.name} (emailed; leave empty to only change the status)<textarea name="reply" maxLength={4000} /></label>
            <div className="crm-two"><label>Status<select name="status" defaultValue={r.ticket.status === 'new' ? 'in_progress' : r.ticket.status}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label><div className="crm-actions" style={{ alignItems: 'end' }}><button className="crm-primary">Update ticket</button></div></div>
          </fieldset></form>
          <div className="crm-actions">{r.ticket.issueId ? <button type="button" className="crm-outline" onClick={() => onOpen({ type: 'issue', id: r.ticket.issueId })}>Open the system issue</button> : <button type="button" className="crm-outline" disabled={busy} onClick={() => void run(async () => { const x = await api<{ id: string }>('/company/crm/issues/from-ticket/' + r.ticket.id, {}); onOpen({ type: 'issue', id: x.id }) }, 'Sent to the developer as a system issue.')}>Escalate to the developer</button>}</div>
          {r.ticket.kind === 'school' && <div className="crm-actions">{r.ticket.leadId ? <button type="button" className="crm-outline" onClick={() => onOpen({ type: 'lead', id: r.ticket.leadId })}>Open the lead</button> : <button type="button" className="crm-outline" disabled={busy} onClick={() => void run(async () => { const x = await api<{ id: string }>('/company/crm/leads/from-ticket/' + r.ticket.id, {}); onOpen({ type: 'lead', id: x.id }) }, 'Lead created from this enquiry.')}>Turn into a school lead</button>}</div>}
        </>}

        {r.order && <>
          <dl className="crm-facts">
            <Fact label="Customer"><button type="button" className="crm-link" onClick={() => onOpen({ type: 'family', id: r.order.customer_id })}>{r.order.customer}</button></Fact><Fact label="Total">{money(r.order.amount_minor)}</Fact>
            <Fact label="Labels for">{r.order.child || 'Not chosen'}</Fact><Fact label="School">{r.order.school}</Fact>
            <Fact label="Delivery">{r.order.delivery === 'home' ? 'Home: ' + (r.order.delivery_address || 'address missing') : 'Pick up at school'}</Fact><Fact label="Ordered">{when(r.order.created_at)}</Fact>
          </dl>
          <ul className="crm-list">{(r.order.lines || []).map((l: Row) => <li key={l.productId}><div><span>{l.name}</span><small>{l.tagCount} labels each</small></div><span className="crm-flag">× {l.quantity}</span></li>)}</ul>
          <div className="crm-actions">
            {r.order.status === 'paid' && <button type="button" className="crm-primary" disabled={busy} onClick={() => void run(() => api('/company/orders/' + r.order.id + '/fulfill', { reason: 'Order fulfilled from the CRM orders board' }), 'Order fulfilled. The family has been told.')}>Fulfil order</button>}
            {r.order.status === 'fulfilled' && !r.order.delivered_at && <button type="button" className="crm-primary" disabled={busy} onClick={() => void run(() => api('/company/orders/' + r.order.id + '/delivered', { reason: 'Labels delivered; marked from the CRM orders board' }), 'Marked delivered. The family can now add belongings.')}>Mark delivered</button>}
            {r.order.delivered_at && <span className="crm-flag t-good">Delivered {day(r.order.delivered_at)}</span>}
          </div>
        </>}

        <div className="crm-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === 'timeline'} className={tab === 'timeline' ? 'is-on' : ''} onClick={() => setTab('timeline')}>Timeline</button><button type="button" role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'is-on' : ''} onClick={() => setTab('tasks')}>Tasks ({r.tasks.filter((t: Row) => t.status === 'open').length})</button></div>
        {tab === 'timeline' ? <>
          {(isAdmin || ['school', 'family', 'issue'].includes(target.type)) && <form className="crm-form" onSubmit={addNote}><fieldset disabled={busy} style={{ display: 'contents' }}>
            <textarea name="body" required minLength={2} maxLength={4000} placeholder="Log a call, a meeting or a note…" aria-label="Note" />
            <div className="crm-actions"><select name="kind" aria-label="Kind of note" style={{ width: 'auto' }}><option value="note">Note</option><option value="call">Call</option><option value="meeting">Meeting</option><option value="email">Email</option></select><button className="crm-outline">Add to timeline</button></div>
          </fieldset></form>}
          {r.timeline.length ? <ul className="crm-timeline">{r.timeline.map((t: Row, i: number) => { const I = ICON[t.kind] || StickyNote; return <li key={i}><span><I size={13} /></span><div><p>{t.text}</p><small>{[t.who, when(t.at)].filter(Boolean).join(' · ')}</small></div></li> })}</ul> : <p className="crm-empty">Nothing on the timeline yet.</p>}
        </> : <>
          <form className="crm-form" onSubmit={addTask}><fieldset disabled={busy} style={{ display: 'contents' }}>
            <input name="title" required minLength={2} maxLength={200} placeholder="What needs doing?" aria-label="Task" />
            <div className="crm-two"><label>Due<input name="dueAt" type="date" /></label><label>Assign to<select name="assigneeId" defaultValue=""><option value="">Me</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
            <div className="crm-actions"><button className="crm-outline">Add task</button></div>
          </fieldset></form>
          <ul className="crm-list">{r.tasks.map((t: Row) => <li key={t.id} className={t.status === 'done' ? 'is-done' : ''}><button type="button" className={'crm-check' + (t.status === 'done' ? ' is-on' : '')} aria-label={t.status === 'done' ? 'Reopen task' : 'Complete task'} onClick={() => void run(() => api('/company/crm/tasks/' + t.id, { done: t.status !== 'done' }))}>{t.status === 'done' && <Check size={13} />}</button><div><span>{t.title}</span><small><CalendarDays size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {day(t.due_at)} · {t.assignee || 'Unassigned'}</small></div></li>)}</ul>
          {!r.tasks.length && <p className="crm-empty">No tasks on this record.</p>}
        </>}
      </>}
    </motion.aside>
  </motion.div>
}
