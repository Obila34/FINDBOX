import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CalendarDays, Camera, ChevronRight, House, Inbox, LayoutDashboard, LogOut, MapPin, PackageSearch, ScanLine, Search, ShieldCheck, UserRound } from 'lucide-react'
import { api, ApiError } from '../api'
import { notify } from '../feedback'
import { FoundScan } from '../FoundScan'
import { ThemeChoice } from '@/components/ui/ThemeToggle'
import { CountUp, ease, spring } from '../crm/fx'
import { CasePanel, type Row } from './CasePanel'
import '../platform.css'
import '../app-premium.css'
import '../crm/crm.css'
import './school.css'

const TABS = [['/manage', 'Home', House], ['/manage/box', 'Items', PackageSearch], ['/manage/scan', 'Receive', ScanLine], ['/manage/inbox', 'Inbox', Inbox], ['/manage/me', 'Me', UserRound]] as const
const FILTERS: [string, string][] = [['todo', 'To receive'], ['box', 'In the box'], ['overdue', 'Overdue'], ['unclaimed', 'Unclaimed'], ['returned', 'Returned']]

/**
 * The staff app: for teachers and office staff who handle lost and found on their phone.
 * Receive an item (scan its QR, or describe it if it has none), see what is in the box, and hand things back.
 */
export function StaffApp() {
  const navigate = useNavigate(), path = useLocation().pathname.replace(/\/$/, ''), still = useReducedMotion()
  const tab = ['/manage/scan', '/manage/log'].includes(path) ? 'scan' : ['/manage/box', '/manage/collect'].includes(path) ? 'box' : path === '/manage/inbox' ? 'inbox' : path === '/manage/me' ? 'me' : 'home'
  const [home, setHome] = useState<Row | null>(null), [denied, setDenied] = useState(''), [version, setVersion] = useState(0), [item, setItem] = useState<string | null>(null)
  const [filter, setFilter] = useState('todo'), [q, setQ] = useState(''), [board, setBoard] = useState<Row[] | null>(null), [notes, setNotes] = useState<Row[] | null>(null)
  const bump = () => setVersion((v) => v + 1)
  useEffect(() => { document.title = 'FindBox · Staff' }, [])
  useEffect(() => {
    api<Row>('/school/desk/home').then(setHome).catch((e) => { if (e instanceof ApiError && e.status === 401) navigate('/school/sign-in', { replace: true }); else setDenied((e as Error).message) })
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab !== 'box') return; let live = true; api<{ columns: { id: string; cards: Row[] }[] }>('/school/desk/board?' + new URLSearchParams(q ? { q } : {}).toString()).then((d) => { if (live) setBoard(d.columns.flatMap((c) => c.cards)) }).catch(() => { if (live) setBoard([]) }); return () => { live = false } }, [tab, q, version])
  useEffect(() => { api<{ notifications: Row[] }>('/workspace').then((w) => setNotes(w.notifications)).catch(() => setNotes([])) }, [version])
  async function logout() { try { await api('/auth/logout', {}) } finally { navigate('/school/sign-in', { replace: true }) } }
  const openBox = (f: string) => { setFilter(f); navigate('/manage/box') }

  if (denied) return <main className="sf-root"><p role="alert" className="crm-empty" style={{ margin: 24 }}>{denied}</p></main>
  if (!home) return <main className="sf-root"><p role="status" style={{ padding: 32 }}>Opening FindBox…</p></main>
  const c = home.counts, hour = new Date().getHours(), unread = notes?.filter((n) => !n.read_at).length || 0
  const match = (card: Row) => filter === 'todo' ? ['reported_lost', 'awaiting_deposit'].includes(card.status) : filter === 'box' ? card.status === 'awaiting_collection' : filter === 'overdue' ? card.flags.some((f: Row) => f.tone !== 'plain') : filter === 'unclaimed' ? card.status === 'unclaimed' : card.status === 'returned'
  const shown = (board || []).filter(match)

  return <div className="sf-root crm-root" style={{ display: 'block' }}>
    <main className="sf-main">
      <AnimatePresence mode="wait"><motion.div key={tab} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={still ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.26, ease }}>
        {tab === 'home' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {home.me.name.split(' ')[0]}</h1></div></header>
          <motion.button type="button" className="sf-scan" onClick={() => navigate('/manage/scan')} whileTap={{ scale: 0.98 }} transition={spring}><span><Camera size={28} /></span><div><strong>Receive an item</strong><small>Scan its QR, or describe it if it has none</small></div><ArrowRight size={20} /></motion.button>
          <div className="sf-tiles">
            {([['todo', 'To receive', c.onWay + c.lost, c.onWay ? 'warn' : ''], ['box', 'In the box', c.inBox, ''], ['overdue', 'Overdue', c.overdue + c.holdOver, c.overdue + c.holdOver ? 'bad' : ''], ['unclaimed', 'Unclaimed', c.unclaimed, '']] as [string, string, number, string][]).map(([f, label, n, tone], i) =>
              <motion.button type="button" key={f} className={'sf-tile' + (tone ? ' t-' + tone : '')} onClick={() => openBox(f)} initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: i * 0.05 }} whileTap={{ scale: 0.97 }}><strong><CountUp value={n} /></strong><span>{label}</span></motion.button>)}
          </div>
          <section className="sf-card"><h2>Needs attention</h2>
            {home.attention.length ? <ul className="crm-list">{home.attention.map((a: Row, i: number) => <li key={i}><i className={'crm-dot t-' + a.tone} /><div><button type="button" className="crm-link" onClick={() => { if (a.record) setItem(a.record); else openBox(a.page === 'approvals' ? 'unclaimed' : 'todo') }}>{a.title}</button></div><ChevronRight size={15} /></li>)}</ul> : <p className="crm-empty">All clear. Nothing is waiting.</p>}
          </section>
          <section className="sf-card"><h2>Collection boxes</h2>
            {home.boxes.length ? <ul className="crm-list">{home.boxes.map((b: Row) => <li key={b.id}><MapPin size={16} /><div><span>{b.name}</span><small>{b.directions} · {b.opening_hours}</small></div></li>)}</ul> : <p className="crm-empty">No collection box yet. Ask your school administrator to add one.</p>}
          </section>
          <p className="sf-foot">{c.returned30} item{c.returned30 === 1 ? '' : 's'} returned in the last 30 days{home.returnRate.pct === null ? '' : ` · ${home.returnRate.pct}% make it home`}</p>
        </>}

        {tab === 'scan' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Receive an item</h1></div></header>
          <p className="sf-lede">Scan the FindBox QR on the item. If there is no QR, describe it and add a photo.</p>
          <FoundScan staff boxes={home.boxes} onDone={bump} />
        </>}

        {tab === 'box' && <>
          <header className="sf-head"><div><p>{home.school.name}</p><h1>Items</h1></div></header>
          <label className="sf-search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by item, student or class" aria-label="Search items" /></label>
          <div className="sf-chips" role="tablist">{FILTERS.map(([f, label]) => <button type="button" role="tab" aria-selected={filter === f} key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>{label}</button>)}</div>
          {!board ? <p role="status" className="crm-empty">Loading…</p> : !shown.length ? <p className="crm-empty">{q ? 'Nothing matches.' : 'Nothing here.'}</p> : <div className="sf-list">{shown.map((card, n) => <motion.button type="button" key={card.id} className="sf-item" onClick={() => setItem(card.id)} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease, delay: Math.min(n, 10) * 0.03 }} whileTap={{ scale: 0.985 }}>
            <div><strong>{card.title}</strong><small>{card.line}</small>{card.flags.length > 0 && <span className="crm-flags">{card.flags.map((f: Row) => <i key={f.text} className={'crm-flag t-' + f.tone} style={{ fontStyle: 'normal' }}>{f.text}</i>)}</span>}</div>
            <span className={'crm-chip t-' + card.chip.tone}><CalendarDays size={12} />{card.chip.text}</span>
          </motion.button>)}</div>}
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
