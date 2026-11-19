import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Camera, ChevronRight, House, Inbox, LayoutDashboard, LogOut, MapPin, PackageSearch, ScanLine, Search, ShieldCheck, UserRound } from 'lucide-react'
import { api, ApiError } from '../api'
import { notify } from '../feedback'
import { FoundScan } from '../FoundScan'
import { ThemeChoice } from '@/components/ui/ThemeToggle'
import { CountUp, ease, spring } from '../crm/fx'
import { CasePanel, type Row } from './CasePanel'
import { groupLog, type LogData } from './DeskMore'
import '../platform.css'
import '../app-premium.css'
import '../crm/crm.css'
import './school.css'

const TABS = [['/manage', 'Home', House], ['/manage/box', 'Items', PackageSearch], ['/manage/scan', 'Scan', ScanLine], ['/manage/inbox', 'Inbox', Inbox], ['/manage/me', 'Me', UserRound]] as const
const FILTERS: [string, string][] = [['open', 'Not yet home'], ['box', 'At collection points'], ['missing', 'Still missing'], ['overdue', 'Overdue'], ['unnamed', 'Owner not known'], ['valuable', 'Valuables'], ['returned', 'Returned']]

/**
 * The staff app: for teachers and office staff who handle lost and found on their phone.
 * Receive an item (scan its QR, or describe it if it has none), see what is in the box, and hand things back.
 */
export function StaffApp() {
  const navigate = useNavigate(), path = useLocation().pathname.replace(/\/$/, ''), still = useReducedMotion()
  const tab = ['/manage/scan', '/manage/log'].includes(path) ? 'scan' : ['/manage/box', '/manage/collect'].includes(path) ? 'box' : path === '/manage/inbox' ? 'inbox' : path === '/manage/me' ? 'me' : 'home'
  const [home, setHome] = useState<Row | null>(null), [denied, setDenied] = useState(''), [version, setVersion] = useState(0), [item, setItem] = useState<string | null>(null)
  const [filter, setFilter] = useState('open'), [q, setQ] = useState(''), [board, setBoard] = useState<Row[] | null>(null), [log, setLog] = useState<LogData | null>(null), [notes, setNotes] = useState<Row[] | null>(null)
  const bump = () => setVersion((v) => v + 1)
  useEffect(() => { document.title = 'FindBox · Staff' }, [])
  useEffect(() => {
    api<Row>('/school/desk/home').then(setHome).catch((e) => { if (e instanceof ApiError && e.status === 401) navigate('/school/sign-in', { replace: true }); else setDenied((e as Error).message) })
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab !== 'box') return; let live = true; const qs = new URLSearchParams(q ? { q } : {}).toString()
    api<LogData>('/school/desk/log?' + qs).then((d) => { if (live) setLog(d) }).catch(() => { if (live) setLog({ total: 0, holdDays: 30, rows: [] }) })
    api<{ columns: { id: string; cards: Row[] }[] }>('/school/desk/board?' + qs).then((d) => { if (live) setBoard(d.columns.flatMap((c) => c.cards)) }).catch(() => { if (live) setBoard([]) }); return () => { live = false } }, [tab, q, version])
  useEffect(() => { api<{ notifications: Row[] }>('/workspace').then((w) => setNotes(w.notifications)).catch(() => setNotes([])) }, [version])
  async function logout() { try { await api('/auth/logout', {}) } finally { navigate('/school/sign-in', { replace: true }) } }
  const openBox = (f: string) => { setFilter(f); navigate('/manage/box') }

  if (denied) return <main className="sf-root"><p role="alert" className="crm-empty" style={{ margin: 24 }}>{denied}</p></main>
  if (!home) return <main className="sf-root"><p role="status" style={{ padding: 32 }}>Opening FindBox…</p></main>
  const c = home.counts, hour = new Date().getHours(), unread = notes?.filter((n) => !n.read_at).length || 0
  const match = (r: Row) => filter === 'open' ? true : filter === 'box' ? r.atBox : filter === 'missing' ? !r.atBox : filter === 'overdue' ? r.overdue || r.holdOver : filter === 'unnamed' ? r.owner === 'Owner not known' : filter === 'valuable' ? r.valuable : false
  const shown = (log?.rows || []).filter(match), returned = (board || []).filter((x) => x.status === 'returned')

  return <div className="sf-root crm-root" style={{ display: 'block' }}>
    <main className="sf-main">
      <AnimatePresence mode="wait"><motion.div key={tab} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={still ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.26, ease }}>
        {tab === 'home' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {home.me.name.split(' ')[0]}</h1></div></header>
          <motion.button type="button" className="sf-scan" onClick={() => navigate('/manage/scan')} whileTap={{ scale: 0.98 }} transition={spring}><span><Camera size={28} /></span><div><strong>Scan an item</strong><small>Receive a found item, or hand one back</small></div><ArrowRight size={20} /></motion.button>
          <div className="sf-tiles">
            {([['open', 'Not yet home', c.notHome, ''], ['box', 'At collection points', c.inBox + c.unclaimed, ''], ['overdue', 'Overdue', c.overdue + c.holdOver, c.overdue + c.holdOver ? 'bad' : ''], ['unnamed', 'Owner not known', c.unclaimed, c.unclaimed ? 'warn' : '']] as [string, string, number, string][]).map(([f, label, n, tone], i) =>
              <motion.button type="button" key={f} className={'sf-tile' + (tone ? ' t-' + tone : '')} onClick={() => openBox(f)} initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: i * 0.05 }} whileTap={{ scale: 0.97 }}><strong><CountUp value={n} /></strong><span>{label}</span></motion.button>)}
          </div>
          <section className="sf-card"><h2>Needs attention</h2>
            {home.attention.length ? <ul className="crm-list">{home.attention.map((a: Row, i: number) => <li key={i}><i className={'crm-dot t-' + a.tone} /><div><button type="button" className="crm-link" onClick={() => { if (a.record) setItem(a.record); else openBox(a.page === 'approvals' ? 'unnamed' : 'open') }}>{a.title}</button></div><ChevronRight size={15} /></li>)}</ul> : <p className="crm-empty">All clear. Nothing is waiting.</p>}
          </section>
          <section className="sf-card"><h2>Collection boxes</h2>
            {home.boxes.length ? <ul className="crm-list">{home.boxes.map((b: Row) => <li key={b.id}><MapPin size={16} /><div><span>{b.name}</span><small>{b.directions} · {b.opening_hours}</small></div><span className="crm-flag">{b.count} item{b.count === 1 ? '' : 's'}</span></li>)}</ul> : <p className="crm-empty">No collection box yet. Ask your school administrator to add one.</p>}
          </section>
          <p className="sf-foot">Today: {home.today.received} received, {home.today.handed} handed back{home.today.mine ? ` (${home.today.mine} by you)` : ''}</p>
          <p className="sf-foot">{c.returned30} item{c.returned30 === 1 ? '' : 's'} returned in the last 30 days{home.returnRate.pct === null ? '' : ` · ${home.returnRate.pct}% make it home`}</p>
        </>}

        {tab === 'scan' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Scan an item</h1></div></header>
          <p className="sf-lede">Scan the FindBox QR to put a found item in a box, or to open one that is being collected. No QR? Describe it and add a photo.</p>
          <FoundScan staff boxes={home.boxes} onDone={bump} onCase={(caseId) => setItem(caseId)} />
        </>}

        {tab === 'box' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Items</h1></div><span className="crm-chip">{log ? log.total : '…'} not yet home</span></header>
          <label className="sf-search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, student, class or shelf tag" aria-label="Search items" /></label>
          <div className="sf-chips" role="tablist">{FILTERS.map(([f, label]) => <button type="button" role="tab" aria-selected={filter === f} key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>{label}</button>)}</div>
          {filter === 'returned'
            ? (!board ? <p role="status" className="crm-empty">Loading…</p> : !returned.length ? <p className="crm-empty">Nothing returned in the last two weeks.</p> : <div className="sf-list">{returned.map((card) => <button type="button" key={card.id} className="sf-item" onClick={() => setItem(card.id)}><div><strong>{card.title}</strong><small>{card.line}</small></div><span className={'crm-chip t-' + card.chip.tone}>{card.chip.text}</span></button>)}</div>)
            : !log ? <p role="status" className="crm-empty">Loading…</p> : !shown.length ? <p className="crm-empty">{q ? 'Nothing matches.' : filter === 'open' ? 'Everything has reached its owner.' : 'Nothing here.'}</p>
            : groupLog(shown).map(([where, rows]) => <section key={where} className="sf-group"><h2><MapPin size={14} />{where}<span>{rows.length}</span></h2>
              <div className="sf-list">{rows.map((r, n) => <motion.button type="button" key={r.id} className="sf-item" onClick={() => setItem(r.id)} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease, delay: Math.min(n, 10) * 0.03 }} whileTap={{ scale: 0.985 }}>
                <div><strong>{r.title}</strong><small>{r.owner}</small><span className="crm-flags"><i className="crm-flag" style={{ fontStyle: 'normal' }}>{r.ref}</i>{r.valuable && <i className="crm-flag t-warn" style={{ fontStyle: 'normal' }}>Valuable</i>}{r.overdue && <i className="crm-flag t-bad" style={{ fontStyle: 'normal' }}>Past collection date</i>}{r.holdOver && <i className="crm-flag t-warn" style={{ fontStyle: 'normal' }}>Held over {log.holdDays} days</i>}</span></div>
                <span className={'crm-chip t-' + (r.overdue ? 'bad' : r.holdOver ? 'warn' : 'muted')}>{r.ageDays === 0 ? 'Today' : r.ageDays + (r.ageDays === 1 ? ' day' : ' days')}</span>
              </motion.button>)}</div></section>)}
        </>}

        {tab === 'inbox' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Inbox</h1></div>{unread > 0 && <button type="button" className="crm-outline" onClick={() => void api('/notifications/read', {}).then(() => { notify('All marked as read.'); bump() }).catch(() => {})}>Mark all read</button>}</header>
          {!notes ? <p role="status" className="crm-empty">Loading…</p> : !notes.length ? <p className="crm-empty">You're all caught up.</p> : <div className="sf-list">{notes.map((n) => <div key={n.id} className={'sf-item sf-note' + (n.read_at ? '' : ' is-new')}><div><span>{n.message}</span><small>{new Date(n.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div></div>)}</div>}
        </>}

        {tab === 'me' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>{home.me.name}</h1></div></header>
          <section className="sf-card"><p className="sf-lede" style={{ margin: 0 }}>{home.me.role === 'manager' ? 'School administrator' : 'Teacher or office staff'}</p>
            <nav className="sf-menu">
              {home.me.role === 'manager' && <Link to="/app/school-admin"><LayoutDashboard size={18} /><span>School workspace</span><ChevronRight size={16} /></Link>}
              <Link to="/app/security"><ShieldCheck size={18} /><span>Password and security</span><ChevronRight size={16} /></Link>
            </nav></section>
          <section className="sf-card"><ThemeChoice /></section>
          <button type="button" className="sf-signout" onClick={() => void logout()}><LogOut size={17} />Sign out</button>
        </>}
      </motion.div></AnimatePresence>
    </main>

    <nav className="sf-dock" aria-label="Staff app">
      {TABS.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/manage'} className={({ isActive }) => (isActive || (to === '/manage/scan' && tab === 'scan') || (to === '/manage/box' && tab === 'box') ? 'is-on' : '') + (to === '/manage/scan' ? ' is-main' : '')}>
        {({ isActive }) => <>{(isActive || (to === '/manage/scan' && tab === 'scan') || (to === '/manage/box' && tab === 'box')) && to !== '/manage/scan' && <motion.b layoutId="sf-dock-pill" transition={spring} />}<span><Icon size={to === '/manage/scan' ? 24 : 21} strokeWidth={1.8} />{to === '/manage/inbox' && unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}</span><small>{label}</small></>}
      </NavLink>)}
    </nav>
    <AnimatePresence>{item && <CasePanel key="case" id={item} boxes={home.boxes} onClose={() => setItem(null)} onChanged={bump} />}</AnimatePresence>
  </div>
}
