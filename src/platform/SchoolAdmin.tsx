import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ClipboardList, Clock, Download, FileUp, GraduationCap, HelpCircle,
  Inbox, LayoutDashboard, LogOut, MapPin, PackageCheck, PackageSearch, Pencil, Plus, Search, Settings, ShieldCheck,
  UserPlus, X,
} from 'lucide-react'
import { api, ApiError, type Recovery } from './api'
import { CaseSafeguards } from './OperationsPanel'
import { parseRosterCsv } from './SchoolWorkspace'
import { notify } from './feedback'
import { useBackgroundRefresh } from '@/lib/useBackgroundRefresh'
import './dashboard.css'
import './school-admin.css'

type Row = Record<string, any>
type View = 'overview' | 'lost-found' | 'students' | 'points' | 'safeguarding' | 'settings'
type Case = Recovery & { created_at?: string; collected_at?: string | null }

const REASON = 'School administrator reviewed and approved this change'
const STATUSES = ['active', 'left', 'transferred', 'archived']
const views: [View, string, typeof LayoutDashboard][] = [
  ['overview', 'Overview', LayoutDashboard], ['lost-found', 'Lost & found', PackageSearch], ['students', 'Students', GraduationCap],
  ['points', 'Collection points', MapPin], ['safeguarding', 'Safeguarding', ShieldCheck], ['settings', 'School settings', Settings],
]
const nice = (s: string) => s.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())
const values = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string> }
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
const caseTone = (s: string) => s === 'awaiting_collection' ? 'is-warn' : s === 'returned' ? 'is-good' : s === 'unclaimed' ? 'is-bad' : 'is-neutral'
const TEMPLATE = 'schoolReference,name,className,guardianEmail,consentReference\nADM-001,Amani Otieno,Grade 4 East,parent@example.com,Consent form 2026\n'

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Slide-in panel used for every add/edit form, so the page never jumps. */
function Panel({ title, eyebrow, onClose, busy, children }: { title: string; eyebrow?: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not(.sa-panel-close)')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
      if (e.key !== 'Tab' || !ref.current) return
      const list = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'))
      const first = list[0], last = list.at(-1)
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); previous?.focus() }
  }, [busy])
  return (
    <div className="sa-panel-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <aside ref={ref} className="sa-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header><div>{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div><button type="button" className="sa-panel-close" aria-label="Close panel" disabled={busy} onClick={onClose}><X size={18} /></button></header>
        <div className="sa-panel-body">{children}</div>
      </aside>
    </div>
  )
}

function Input({ name, label, value = '', type = 'text', required = true, hint, minLength, maxLength = 300, placeholder }: { name: string; label: string; value?: string; type?: string; required?: boolean; hint?: string; minLength?: number; maxLength?: number; placeholder?: string }) {
  return <label className="sa-field"><span>{label}{!required && <em>Optional</em>}</span><input name={name} type={type} defaultValue={value} required={required} minLength={minLength} maxLength={maxLength} placeholder={placeholder} />{hint && <small>{hint}</small>}</label>
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 26, c = 2 * Math.PI * r, p = total ? done / total : 0
  return (
    <svg className="sa-ring" viewBox="0 0 64 64" role="img" aria-label={`${done} of ${total} setup steps complete`}>
      <circle cx="32" cy="32" r={r} className="sa-ring-track" />
      <circle cx="32" cy="32" r={r} className="sa-ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      <text x="32" y="37" textAnchor="middle">{done}/{total}</text>
    </svg>
  )
}

export function SchoolAdmin() {
  const location = useLocation(), navigate = useNavigate()
  const view = (views.find(([id]) => '#' + id === location.hash)?.[0] || 'overview') as View
  const setView = (v: View) => navigate({ hash: v === 'overview' ? '' : v })

  const [setup, setSetup] = useState<Row | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [boxes, setBoxes] = useState<Row[]>([])
  const [students, setStudents] = useState<Row[]>([])
  const [studentCount, setStudentCount] = useState<{ n: number; more: boolean } | null>(null)
  const [me, setMe] = useState<Row | null>(null)
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [page, setPage] = useState(0), [more, setMore] = useState(false)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<{ kind: 'student' | 'import' | 'point' | 'settings'; row?: Row } | null>(null)
  const [preview, setPreview] = useState<Row[]>([]), [pending, setPending] = useState<Row[]>([]), [drag, setDrag] = useState(false)
  const [flash, setFlash] = useState('')

  async function loadCore() {
    const [s, w, b, first] = await Promise.all([
      api<Row>('/school/setup'), api<Row>('/workspace'), api<{ rows: Row[] }>('/school/boxes'),
      api<{ rows: Row[]; hasMore: boolean }>('/school/students?q=&status=all&page=0'),
    ])
    setSetup(s); setCases(w.cases || []); setMe(w.user); setBoxes(b.rows); setStudentCount({ n: first.rows.length, more: first.hasMore }); setError('')
    return JSON.stringify([s, w.cases, b.rows, first.rows.length])
  }
  async function loadStudents() {
    const r = await api<{ rows: Row[]; hasMore: boolean }>(`/school/students?q=${encodeURIComponent(q)}&status=${status}&page=${page}`)
    setStudents(r.rows); setMore(r.hasMore)
  }
  const snapshot = useRef('')
  async function refresh() {
    try { snapshot.current = await loadCore(); if (view === 'students') await loadStudents() }
    catch (e) { setError((e as Error).message); if (e instanceof ApiError && [401, 403].includes(e.status)) setSetup(null) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0) }, 300); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (setup && view === 'students') loadStudents().catch(e => setError((e as Error).message)) }, [view, q, status, page, !!setup])
  useBackgroundRefresh(async () => { const next = await loadCore(); const changed = !!snapshot.current && next !== snapshot.current; snapshot.current = next; return changed }, !!setup && !busy && !panel, 'school-admin', () => notify('School records updated in the background.', 'info'))

  async function act(path: string, body: unknown, success: string, highlight?: string) {
    setBusy(true)
    try {
      await api(path, body)
      notify(success)
      window.dispatchEvent(new Event('findbox-form-saved'))
      setPanel(null)
      if (highlight) { setFlash(highlight); window.setTimeout(() => setFlash(''), 1800) }
      await refresh()
      return true
    } catch { return false } finally { setBusy(false) }
  }

  async function signOut() { try { await api('/auth/logout', {}) } finally { navigate('/app/sign-in') } }

  const now = Date.now()
  const stats = useMemo(() => {
    const waiting = cases.filter(c => c.status === 'awaiting_collection')
    return {
      waiting: waiting.length,
      overdue: waiting.filter(c => c.due_at && Date.parse(c.due_at) < now).length,
      incoming: cases.filter(c => ['awaiting_deposit', 'reported_lost'].includes(c.status)).length,
      returned: cases.filter(c => c.status === 'returned' && c.collected_at && now - Date.parse(c.collected_at) < 30 * 864e5).length,
    }
  }, [cases])

  const checklist = setup ? [
    { key: 'contact', done: setup.checklist.contact, title: 'Add a responsible contact', detail: 'Who parents and FindBox can reach.', action: () => setPanel({ kind: 'settings' }), cta: 'Add contact' },
    { key: 'privacy', done: setup.checklist.privacy, title: 'Record your safeguarding policy', detail: 'A reference to your consent and retention policy.', action: () => setPanel({ kind: 'settings' }), cta: 'Add policy' },
    { key: 'collection', done: setup.checklist.collection, title: 'Set up a collection point', detail: 'Where found items wait for families.', action: () => setPanel({ kind: 'point' }), cta: 'Add point' },
    { key: 'active', done: setup.checklist.active, title: 'School goes live', detail: setup.checklist.active ? 'Families can join with your school code.' : 'FindBox activates your school once the steps above are done.', action: undefined, cta: '' },
  ] : []
  const doneSteps = checklist.filter(c => c.done).length

  if (!setup) return (
    <main className="sa-gate">
      {loading ? <p role="status">Opening your school workspace…</p> : <section><ShieldCheck size={36} /><h1>School administrators only</h1><p>{error || 'Sign in with your school administrator account to continue.'}</p><Link className="sa-btn" to="/app/sign-in">Sign in <ArrowRight size={16} /></Link></section>}
    </main>
  )

  const school = setup.school
  const lifecycle = school.lifecycle as string

  return (
    <div className="sa-layout">
      <aside className="sa-sidebar">
        <div className="sa-school"><span>{initials(school.name)}</span><div><strong>{school.name}</strong><small>School administrator</small></div></div>
        <nav aria-label="School workspace">
          {views.map(([id, label, Icon]) => (
            <button key={id} type="button" className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
              <Icon size={18} />{label}
              {id === 'lost-found' && stats.waiting > 0 && <b>{stats.waiting}</b>}
              {id === 'overview' && doneSteps < checklist.length && <i className="sa-nav-dot" aria-label="Setup incomplete" />}
            </button>
          ))}
        </nav>
        <div className="sa-sidebar-foot">
          <Link to="/manage"><Inbox size={18} />Recovery queue</Link>
          <Link to="/app/help"><HelpCircle size={18} />Help & support</Link>
          <button type="button" onClick={() => void signOut()}><LogOut size={18} />Sign out</button>
        </div>
      </aside>

      <main className="sa-main">
        {error && <p role="alert" className="sa-alert"><AlertTriangle size={16} />{error}<button type="button" aria-label="Dismiss" onClick={() => setError('')}><X size={15} /></button></p>}

        {view === 'overview' && <div className="sa-view" key="overview">
          <section className="db-hero sa-hero">
            <div className="db-hero-art" aria-hidden="true"><i /><i /><i /></div>
            <div className="db-hero-main">
              <span className={`db-status is-${lifecycle === 'active' ? 'good' : lifecycle === 'pending' ? 'warning' : 'critical'}`}><i />{lifecycle === 'active' ? 'Live for families' : lifecycle === 'pending' ? 'Setting up' : nice(lifecycle)}</span>
              <h1>{greeting()}{me?.name ? `, ${String(me.name).split(' ')[0]}` : ''}.</h1>
              <p>{stats.waiting ? `${stats.waiting} ${stats.waiting === 1 ? 'item is' : 'items are'} waiting at your collection points.` : 'No items are waiting for collection right now.'}{stats.overdue ? ` ${stats.overdue} ${stats.overdue === 1 ? 'is' : 'are'} past the collection date.` : ''}</p>
              <div className="db-quick">
                <button type="button" onClick={() => setPanel({ kind: 'student' })}><UserPlus size={17} />Add student</button>
                <button type="button" onClick={() => setPanel({ kind: 'import' })}><FileUp size={17} />Import roster</button>
                <Link className="sa-quick-link" to="/manage/log"><PackageCheck size={17} />Log a found item</Link>
              </div>
            </div>
          </section>

          <div className="db-kpis">
            <Kpi tone="amber" icon={<Clock size={18} />} label="Waiting for collection" value={stats.waiting} hint="At your collection points" />
            <Kpi tone="coral" icon={<AlertTriangle size={18} />} label="Past collection date" value={stats.overdue} hint="Remind the family" />
            <Kpi tone="sky" icon={<PackageSearch size={18} />} label="Reported or on the way" value={stats.incoming} hint="Not yet at a box" />
            <Kpi tone="mint" icon={<CheckCircle2 size={18} />} label="Returned · 30 days" value={stats.returned} hint="Back with their owners" />
          </div>

          <div className="db-split">
            <section className="db-card sa-setup">
              <header><h3><ClipboardList size={18} />{doneSteps === checklist.length ? 'Setup complete' : 'Finish setting up'}</h3><Ring done={doneSteps} total={checklist.length} /></header>
              <ol>{checklist.map((c, i) => (
                <li key={c.key} className={c.done ? 'is-done' : ''} style={{ animationDelay: `${120 + i * 70}ms` }}>
                  <span className="sa-step">{c.done ? <Check size={15} /> : i + 1}</span>
                  <div><strong>{c.title}</strong><p>{c.detail}</p></div>
                  {!c.done && c.action && <button type="button" onClick={c.action}>{c.cta}<ArrowRight size={14} /></button>}
                </li>
              ))}</ol>
            </section>
            <section className="db-card">
              <header><h3><PackageSearch size={18} />Latest lost & found</h3><button type="button" className="db-link" onClick={() => setView('lost-found')}>See all <ArrowRight size={14} /></button></header>
              <CaseList cases={cases.slice(0, 5)} now={now} empty="No lost or found items yet. They will appear here as soon as someone reports one." />
            </section>
          </div>

          <div className="db-three">
            <MiniStat icon={<GraduationCap size={18} />} label="Students on roster" value={studentCount ? `${studentCount.n}${studentCount.more ? '+' : ''}` : '—'} action={() => setView('students')} cta="Manage students" />
            <MiniStat icon={<MapPin size={18} />} label="Collection points" value={String(boxes.filter(b => b.active).length)} action={() => setView('points')} cta="Manage points" />
            <MiniStat icon={<ShieldCheck size={18} />} label="Safeguarding" value={school.privacy_basis ? 'Policy recorded' : 'Policy missing'} action={() => setView('safeguarding')} cta="Case exceptions" />
          </div>
        </div>}

        {view === 'lost-found' && <div className="sa-view" key="lost-found">
          <SectionHead title="Lost & found" lede="Every item reported, waiting or returned at your school.">
            <Link className="sa-btn is-ghost" to="/manage"><Inbox size={16} />Open recovery queue</Link>
            <Link className="sa-btn" to="/manage/log"><Plus size={16} />Log found item</Link>
          </SectionHead>
          <div className="sa-filters-row">
            <span className="db-pill is-warn">{stats.waiting} waiting</span><span className="db-pill is-bad">{stats.overdue} overdue</span><span className="db-pill">{stats.incoming} reported</span><span className="db-pill is-good">{stats.returned} returned (30 days)</span>
          </div>
          <section className="db-card"><CaseList cases={cases} now={now} empty="Nothing has been reported yet." /></section>
        </div>}

        {view === 'students' && <div className="sa-view" key="students">
          <SectionHead title="Students" lede="Your roster. Children don't need an email or password to be protected.">
            <button type="button" className="sa-btn is-ghost" onClick={() => setPanel({ kind: 'import' })}><FileUp size={16} />Import CSV</button>
            <a className="sa-btn is-ghost" href="/api/school/students/export?format=csv" download="FindBox-students.csv"><Download size={16} />Export</a>
            <button type="button" className="sa-btn" onClick={() => setPanel({ kind: 'student' })}><Plus size={16} />Add student</button>
          </SectionHead>
          {!(setup.checklist.contact && setup.checklist.privacy) && <div className="sa-banner"><ShieldCheck size={20} /><div><strong>One step before adding students</strong><p>Record your school contact and safeguarding policy. It protects the children on your roster.</p></div><button type="button" className="sa-btn" onClick={() => setPanel({ kind: 'settings' })}>Add now</button></div>}
          <div className="sa-toolbar">
            <label className="sa-search"><Search size={17} /><input aria-label="Search student roster" placeholder="Search name, ID or class" value={search} onChange={e => setSearch(e.target.value)} /></label>
            <div className="sa-segment" role="group" aria-label="Filter enrollment status">{['all', ...STATUSES].map(s => <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(0) }}>{nice(s)}</button>)}</div>
          </div>
          <section className="db-card sa-roster">
            {students.length ? <div className="db-table"><table>
              <thead><tr><th>Student</th><th>Class</th><th>Status</th><th>Guardian</th><th><span className="sa-sr">Actions</span></th></tr></thead>
              <tbody>{students.map(r => (
                <tr key={r.id} className={flash === r.id || flash === r.school_reference ? 'is-flash' : ''}>
                  <td><div className="sa-person"><span className="db-avatar">{initials(r.name)}</span><div><strong>{r.name}</strong><small>{r.school_reference}</small></div></div></td>
                  <td><span className="sa-chip">{r.class_name}</span></td>
                  <td><span className={`db-pill ${r.status === 'active' ? 'is-good' : 'is-neutral'}`}>{nice(r.status)}</span></td>
                  <td>{r.guardian_verified_at ? <span className="db-pill is-good"><i />Linked</span> : r.guardian_email ? <span className="db-pill is-warn"><i />Invite pending</span> : <span className="db-pill"><i />No guardian yet</span>}</td>
                  <td><div className="sa-row-actions">
                    {r.guardian_email && !r.guardian_verified_at && <button type="button" disabled={busy} onClick={() => void act('/school/students/' + r.id + '/guardian', { reason: REASON }, `Invitation sent to ${r.guardian_email}.`, r.id)}>Invite guardian</button>}
                    <button type="button" aria-label={'Edit ' + r.name} onClick={() => setPanel({ kind: 'student', row: r })}><Pencil size={15} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div> : <div className="sa-empty"><GraduationCap size={34} /><strong>{q || status !== 'all' ? 'No students match this view' : 'No students yet'}</strong><p>{q || status !== 'all' ? 'Try another search or filter.' : 'Add students one at a time or import your whole roster from a spreadsheet.'}</p>{!q && status === 'all' && <div><button type="button" className="sa-btn" onClick={() => setPanel({ kind: 'import' })}><FileUp size={16} />Import CSV</button><button type="button" className="sa-btn is-ghost" onClick={() => setPanel({ kind: 'student' })}><Plus size={16} />Add one</button></div>}</div>}
            <div className="sa-pager"><button type="button" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" disabled={!more} onClick={() => setPage(page + 1)}>Next</button></div>
          </section>
        </div>}

        {view === 'points' && <div className="sa-view" key="points">
          <SectionHead title="Collection points" lede="Where found items wait and families collect them.">
            <button type="button" className="sa-btn" onClick={() => setPanel({ kind: 'point' })}><Plus size={16} />Add collection point</button>
          </SectionHead>
          {boxes.length ? <div className="sa-points">{boxes.map((b, i) => (
            <article key={b.id} className={`db-card sa-point ${b.active ? '' : 'is-off'} ${flash === b.name ? 'is-flash' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="sa-point-icon"><MapPin size={20} /></div>
              <h3>{b.name}</h3>
              <p>{b.directions}</p>
              <p className="sa-hours"><Clock size={14} />{b.opening_hours}</p>
              <footer><span className={`db-pill ${b.active ? 'is-good' : 'is-neutral'}`}><i />{b.active ? 'Open for collection' : 'Paused'}</span>{b.public_listing && <span className="db-pill">Public</span>}<button type="button" className="db-link" onClick={() => setPanel({ kind: 'point', row: b })}><Pencil size={14} />Edit</button></footer>
            </article>
          ))}</div> : <section className="db-card sa-empty"><MapPin size={34} /><strong>No collection points yet</strong><p>Most schools start with one at reception.</p><button type="button" className="sa-btn" onClick={() => setPanel({ kind: 'point', row: { name: 'Reception', directions: 'Main school office', opening_hours: 'Mon–Fri 8am–4pm', active: true } as Row })}><Plus size={16} />Add Reception</button></section>}
        </div>}

        {view === 'safeguarding' && <div className="sa-view sa-safeguarding" key="safeguarding">
          <SectionHead title="Safeguarding" lede="Rare case decisions: disputes, authorisations, corrections, disposal and tag replacement. Each one is recorded." />
          <CaseSafeguards />
        </div>}

        {view === 'settings' && <div className="sa-view" key="settings">
          <SectionHead title="School settings" lede="Contact details, safeguarding policy and directory listing.">
            <button type="button" className="sa-btn" onClick={() => setPanel({ kind: 'settings' })}><Pencil size={16} />Edit settings</button>
          </SectionHead>
          <section className="db-card sa-settings">
            <dl>
              <div><dt>School</dt><dd>{school.name}</dd></div>
              <div><dt>Status</dt><dd><span className={`db-pill ${lifecycle === 'active' ? 'is-good' : 'is-warn'}`}><i />{nice(lifecycle)}</span></dd></div>
              <div><dt>Responsible contact</dt><dd>{school.contact_name || <em>Not added</em>}</dd></div>
              <div><dt>Contact email</dt><dd>{school.contact_email || <em>Not added</em>}</dd></div>
              <div><dt>Safeguarding policy</dt><dd>{school.privacy_basis || <em>Not recorded</em>}</dd></div>
              <div><dt>Partner directory</dt><dd>{school.public_listing ? 'School name is listed publicly' : 'Not listed'}</dd></div>
            </dl>
          </section>
        </div>}
      </main>

      {panel?.kind === 'student' && <Panel title={panel.row ? 'Edit student' : 'Add a student'} eyebrow="STUDENTS" busy={busy} onClose={() => setPanel(null)}>
        <form className="sa-form" onSubmit={e => {
          const d = values(e), body = { schoolReference: d.schoolReference, name: d.name, className: d.className, guardianEmail: d.guardianEmail || '', consentReference: d.consentReference }
          void (panel.row ? act('/school/students/' + panel.row.id, { ...body, status: d.status, revision: panel.row.revision, reason: REASON }, `${d.name} updated.`, panel.row.id) : act('/school/students/import', { rows: [body], reason: REASON }, `${d.name} added to the roster.`, d.schoolReference))
        }}>
          <fieldset disabled={busy}>
            <Input name="name" label="Full name" value={panel.row?.name} maxLength={100} />
            <div className="sa-two"><Input name="schoolReference" label="Admission number" value={panel.row?.school_reference} maxLength={80} /><Input name="className" label="Class" value={panel.row?.class_name} maxLength={80} placeholder="Grade 4 East" /></div>
            <Input name="guardianEmail" label="Parent or guardian email" type="email" required={false} value={panel.row?.guardian_email} hint="We'll invite them to link their account." />
            <Input name="consentReference" label="Consent record" value={panel.row?.consent_reference} hint="Where the guardian's consent is kept, e.g. “Admission form 2026”. No documents here." />
            {panel.row && <label className="sa-field"><span>Enrollment</span><select name="status" defaultValue={panel.row.status}>{STATUSES.map(s => <option key={s} value={s}>{nice(s)}</option>)}</select></label>}
            <p className="sa-note">No child login is created. Parents can switch one on later.</p>
            <div className="sa-form-actions"><button type="button" className="sa-btn is-ghost" onClick={() => setPanel(null)}>Cancel</button><button className="sa-btn">{panel.row ? 'Save changes' : 'Add student'}</button></div>
          </fieldset>
        </form>
      </Panel>}

      {panel?.kind === 'import' && <Panel title="Import your roster" eyebrow="STUDENTS" busy={busy} onClose={() => { setPanel(null); setPreview([]); setPending([]) }}>
        <div className="sa-form">
          <label className={`sa-drop ${drag ? 'is-drag' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void readCsv(f) }}>
            <FileUp size={30} /><strong>Drop a CSV file here</strong><span>or click to choose one</span>
            <input type="file" accept=".csv,text/csv" aria-label="Choose student CSV" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void readCsv(f) }} />
          </label>
          <p className="sa-note">Columns can be in any order: schoolReference, name, className, guardianEmail, consentReference. Large rosters are sent in batches of 100. <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(TEMPLATE)} download="FindBox-roster-template.csv">Download a template</a></p>
          {preview.length > 0 && <>
            <div className="sa-preview-head"><strong>{preview.filter(r => !r.error).length} ready</strong>{preview.some(r => r.error) && <span className="db-pill is-bad">{preview.filter(r => r.error).length} need fixing</span>}</div>
            <ul className="sa-preview">{preview.map(r => <li key={r.row} className={r.error ? 'is-error' : ''}>{r.error ? <AlertTriangle size={15} /> : <Check size={15} />}<span>Row {r.row}</span><strong>{r.error || r.data.name}</strong></li>)}</ul>
            {preview.some(r => r.error) && <p className="sa-note">Rows with problems are skipped. Fix them in your file and import it again later.</p>}
            <div className="sa-form-actions"><button type="button" className="sa-btn is-ghost" onClick={() => { setPreview([]); setPending([]) }}>Choose another file</button><button type="button" className="sa-btn" disabled={busy || !importable().length} onClick={() => void importAll()}>Import {importable().length} {importable().length === 1 ? 'student' : 'students'}</button></div>
          </>}
        </div>
      </Panel>}

      {panel?.kind === 'point' && <Panel title={panel.row?.id ? 'Edit collection point' : 'Add a collection point'} eyebrow="COLLECTION POINTS" busy={busy} onClose={() => setPanel(null)}>
        <form className="sa-form" onSubmit={e => { const d = values(e); void act('/school/boxes', { id: panel.row?.id, name: d.name, directions: d.directions, hours: d.hours, active: d.active === 'on', publicListing: d.publicListing === 'on', reason: REASON }, `${d.name} saved.`, d.name) }}>
          <fieldset disabled={busy}>
            <Input name="name" label="Name" value={panel.row?.name} placeholder="Reception" maxLength={100} />
            <Input name="directions" label="Where is it?" value={panel.row?.directions} placeholder="Main office, next to the entrance" maxLength={500} />
            <Input name="hours" label="Collection hours" value={panel.row?.opening_hours} placeholder="Mon–Fri 8am–4pm" maxLength={200} />
            <label className="sa-toggle"><input name="active" type="checkbox" defaultChecked={panel.row?.active ?? true} /><span /><div><strong>Open for collection</strong><small>Families can be sent here.</small></div></label>
            <label className="sa-toggle"><input name="publicListing" type="checkbox" defaultChecked={panel.row?.public_listing ?? false} /><span /><div><strong>Show in the public school directory</strong><small>Only the name, directions and hours.</small></div></label>
            <div className="sa-form-actions"><button type="button" className="sa-btn is-ghost" onClick={() => setPanel(null)}>Cancel</button><button className="sa-btn">Save collection point</button></div>
          </fieldset>
        </form>
      </Panel>}

      {panel?.kind === 'settings' && <Panel title="School settings" eyebrow="SETTINGS" busy={busy} onClose={() => setPanel(null)}>
        <form className="sa-form" onSubmit={e => { const d = values(e); void act('/school/setup', { contactName: d.contactName, contactEmail: d.contactEmail, privacyBasis: d.privacyBasis, publicListing: d.publicListing === 'on', reason: REASON }, 'School settings saved.') }}>
          <fieldset disabled={busy}>
            <Input name="contactName" label="Responsible contact" value={school.contact_name} maxLength={100} placeholder="Head teacher or office lead" />
            <Input name="contactEmail" label="Contact email" type="email" value={school.contact_email} />
            <label className="sa-field"><span>Safeguarding policy reference</span><textarea name="privacyBasis" required maxLength={1000} defaultValue={school.privacy_basis || ''} placeholder="e.g. Child Protection & Data Policy v3, consent collected at admission" /><small>The name of your policy, not the policy itself or any ID documents.</small></label>
            <label className="sa-toggle"><input name="publicListing" type="checkbox" defaultChecked={school.public_listing} /><span /><div><strong>List our school in the partner directory</strong><small>Student records always stay private.</small></div></label>
            <div className="sa-form-actions"><button type="button" className="sa-btn is-ghost" onClick={() => setPanel(null)}>Cancel</button><button className="sa-btn">Save settings</button></div>
          </fieldset>
        </form>
      </Panel>}
    </div>
  )

  async function readCsv(file: File) {
    setPreview([]); setPending([])
    try {
      if (file.size > 250000) throw new Error('Choose a CSV below 250 KB.')
      const rows = parseRosterCsv(await file.text())
      if (!rows.length) throw new Error('That file has no student rows.')
      const checked: Row[] = []
      for (let i = 0; i < rows.length; i += 100) {
        const r = await api<{ rows: Row[] }>('/school/students/preview', { rows: rows.slice(i, i + 100) })
        checked.push(...r.rows.map(x => ({ ...x, row: x.row + i })))
      }
      setPending(rows); setPreview(checked)
    } catch (e) { notify((e as Error).message, 'error') }
  }
  function importable() { return pending.filter((_, i) => !preview.find(p => p.row === i + 1)?.error) }
  async function importAll() {
    const rows = importable()
    setBusy(true)
    try {
      for (let i = 0; i < rows.length; i += 100) await api('/school/students/import', { rows: rows.slice(i, i + 100), reason: REASON })
      notify(`${rows.length} ${rows.length === 1 ? 'student' : 'students'} imported.`)
      setPanel(null); setPreview([]); setPending([]); window.dispatchEvent(new Event('findbox-form-saved')); setView('students'); await refresh()
    } catch { /* the toast and button shake already explain it */ } finally { setBusy(false) }
  }
}

function SectionHead({ title, lede, children }: { title: string; lede: string; children?: ReactNode }) {
  return <header className="sa-section-head"><div><h1>{title}</h1><p>{lede}</p></div>{children && <div className="sa-section-actions">{children}</div>}</header>
}

function Kpi({ label, value, icon, tone, hint }: { label: string; value: number; icon: ReactNode; tone: string; hint: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    let raf = 0; const start = performance.now()
    const tick = (t: number) => { const p = Math.min(1, (t - start) / 800); setShown(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [value])
  return <section className={`db-kpi tone-${tone}`}><div className="db-kpi-top"><span className="db-kpi-icon">{icon}</span><span className="db-kpi-label">{label}</span></div><strong>{shown}</strong><div className="db-kpi-foot"><small>{hint}</small></div></section>
}

function MiniStat({ icon, label, value, action, cta }: { icon: ReactNode; label: string; value: string; action: () => void; cta: string }) {
  return <section className="db-card sa-mini"><span className="db-kpi-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div><button type="button" className="db-link" onClick={action}>{cta}<ArrowRight size={14} /></button></section>
}

const picture = (c: string) => ['bottle', 'book', 'clothing', 'lunchbox'].includes(c) ? `/media/catalog/${c}-480.webp` : `/media/products/${['sports', 'stationery'].includes(c) ? c : 'other'}-1024.webp`

function CaseList({ cases, now, empty }: { cases: Case[]; now: number; empty: string }) {
  if (!cases.length) return <div className="sa-empty is-small"><CheckCircle2 size={30} /><p>{empty}</p></div>
  return <ul className="sa-cases">{cases.map(c => {
    const overdue = c.status === 'awaiting_collection' && c.due_at && Date.parse(c.due_at) < now
    return <li key={c.id}>
      <img src={picture(c.category)} alt="" loading="lazy" />
      <div><strong>{c.title}</strong><small><MapPin size={12} />{c.box_name || 'Not at a box yet'}{c.due_at && c.status === 'awaiting_collection' && <> · collect by {new Date(c.due_at).toLocaleDateString('en-KE')}</>}</small></div>
      <span className={`db-pill ${overdue ? 'is-bad' : caseTone(c.status)}`}>{overdue ? 'Overdue' : nice(c.status)}</span>
    </li>
  })}</ul>
}
