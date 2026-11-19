import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDownWideNarrow, ArrowRight, BarChart3, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut, MapPin, Menu, PackageSearch, Plus, RefreshCw, Search, Settings as Cog, SlidersHorizontal, Trophy, UserCog, Users, type LucideIcon } from 'lucide-react'
import { api, ApiError } from '../api'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SwirlMark } from '@/components/brand/Logo'
import { Houses } from '../Houses'
import { CountUp, ease, spring } from '../crm/fx'
import { CasePanel, type Row } from './CasePanel'
import { Approvals, Boxes, DeskBoard, Families, Overview, Report, Settings, StaffPage, Students } from './DeskPages'
import '../crm/crm.css'
import './school.css'

type NavItem = [page: string, label: string, Icon: LucideIcon, badge?: string]
const NAV: [string, NavItem[]][] = [
  ['', [['overview', 'Overview', LayoutDashboard], ['board', 'Lost and found', PackageSearch, 'board'], ['approvals', 'Approvals', ClipboardCheck, 'approvals']]],
  ['People', [['students', 'Students', GraduationCap], ['families', 'Families', Users], ['staff', 'Staff', UserCog], ['houses', 'Houses', Trophy]]],
  ['School', [['boxes', 'Collection boxes', MapPin], ['report', 'Report', BarChart3], ['settings', 'Settings', Cog]]],
]
const CATEGORIES: [string, string][] = [['clothing', 'Clothing'], ['bottle', 'Bottles'], ['lunchbox', 'Lunchboxes'], ['book', 'Books'], ['sports', 'Sports kit'], ['electronics', 'Gadgets'], ['other', 'Other']]
const TOOLS: Record<string, { sorts: [string, string][]; filters: [string, string][]; search: string }> = {
  board: { search: 'Search items, students or classes…', sorts: [['recent', 'Newest'], ['oldest', 'Oldest first'], ['due', 'Collection date'], ['name', 'Name']], filters: [['overdue', 'Overdue only'], ...CATEGORIES] },
  students: { search: 'Search students, classes or admission numbers…', sorts: [], filters: [['active', 'Active'], ['left', 'Left'], ['transferred', 'Transferred'], ['archived', 'Archived']] },
}
const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** The principal's workspace: what needs a decision, the lost-and-found board, people, and a term report. */
export function SchoolDesk() {
  const navigate = useNavigate(), still = useReducedMotion()
  const [home, setHome] = useState<Row | null>(null), [denied, setDenied] = useState(''), [version, setVersion] = useState(0)
  const [page, setPage] = useState('overview'), [search, setSearch] = useState(''), [q, setQ] = useState(''), [sort, setSort] = useState(''), [filter, setFilter] = useState(''), [menu, setMenu] = useState(''), [open, setOpen] = useState(false)
  const [item, setItem] = useState<string | null>(null), [form, setForm] = useState('')
  const bump = () => setVersion((v) => v + 1)
  useEffect(() => { document.title = 'FindBox · School workspace'; try { if (!localStorage.getItem('fb-theme')) document.documentElement.dataset.theme = 'light' } catch { /* keep the current theme */ } }, [])
  useEffect(() => {
    api<Row>('/school/desk/home').then((h) => { if (h.me.role !== 'manager') { navigate('/manage', { replace: true }); return } setHome(h) })
      .catch((e) => { if (e instanceof ApiError && e.status === 401) navigate('/school/sign-in', { replace: true }); else setDenied((e as Error).message) })
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 250); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (!menu) return; const close = () => setMenu(''); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [menu])
  function go(next: string) { setPage(next); setSort(''); setFilter(''); setSearch(''); setQ(''); setOpen(false); window.scrollTo({ top: 0 }) }
  async function logout() { try { await api('/auth/logout', {}) } finally { navigate('/school/sign-in', { replace: true }) } }
  const tools = TOOLS[page]
  const query = useMemo(() => new URLSearchParams({ ...(q ? { q } : {}), ...(sort ? { sort } : {}), ...(filter ? { filter } : {}) }).toString(), [q, sort, filter])
  const add: Record<string, [string, () => void]> = { students: ['Add student', () => setForm('student')], staff: ['Invite teacher', () => setForm('staff')], boxes: ['Add box', () => setForm('box')] }
  const primary = add[page]

  if (denied) return <main className="crm-root" style={{ display: 'grid', placeItems: 'center', gridTemplateColumns: '1fr' }}><p role="alert" className="crm-empty">{denied}</p></main>
  if (!home) return <main className="crm-root" style={{ display: 'grid', placeItems: 'center', gridTemplateColumns: '1fr' }}><p role="status">Opening your school…</p></main>
  const c = home.counts, max = Math.max(1, ...home.bars.map((b: Row) => Math.max(b.found, b.returned))), pct = home.returnRate.pct, ticks = 44, lit = pct === null ? 0 : Math.round((pct / 100) * ticks)

  return <div className={'crm-root' + (open ? ' is-open' : '')}>
    <aside className="crm-side" aria-label="School workspace">
      <div className="crm-brand"><SwirlMark size={22} /><span>FindBox <small>School</small></span></div>
      <p className="sd-school">{home.school.name}</p>
      {NAV.map(([group, items]) => <div key={group || 'main'}>
        {group && <h4>{group}</h4>}
        {items.map(([id, label, Icon, badge]) => { const on = page === id, n = badge ? home.badges[badge] : 0; return <button type="button" key={id} className={'crm-nav' + (on ? ' is-on' : '')} aria-current={on ? 'page' : undefined} onClick={() => go(id)} style={{ position: 'relative', background: 'transparent' }}>
          {on && <motion.i layoutId="sd-nav-pill" transition={spring} style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'var(--c-soft)' }} />}
          <Icon size={17} strokeWidth={on ? 2.1 : 1.7} style={{ position: 'relative' }} /><span style={{ position: 'relative' }}>{label}</span>{n ? <b style={{ position: 'relative' }}>{n}</b> : null}
        </button> })}
      </div>)}
      <div className="crm-me"><div className="crm-person"><span className="crm-avatar">{initials(home.me.name)}</span><div><strong>{home.me.name}</strong><small>School administrator</small></div></div><ThemeToggle /><button type="button" className="crm-icon" aria-label="Sign out" title="Sign out" onClick={() => void logout()}><LogOut size={17} /></button></div>
    </aside>
    {open && <div className="crm-scrim" style={{ zIndex: 65 }} onClick={() => setOpen(false)} />}

    <main className="crm-main">
      <div className="crm-top">
        <button type="button" className="crm-icon crm-menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={19} /></button>
        {tools ? <label className="crm-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tools.search} aria-label="Search" /></label> : <span className="crm-search" />}
        {tools && tools.sorts.length > 0 && <div className="crm-tool"><button type="button" className={sort ? 'is-on' : ''} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'sort' ? '' : 'sort') }}><ArrowDownWideNarrow size={16} />Sort by</button>
          {menu === 'sort' && <div className="crm-menu">{tools.sorts.map(([id, label], i) => <button type="button" key={id} className={(sort || (i === 0 ? id : '')) === id ? 'is-on' : ''} onClick={() => setSort(id)}>{label}</button>)}</div>}</div>}
        {tools && tools.filters.length > 0 && <div className="crm-tool"><button type="button" className={filter ? 'is-on' : ''} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'filter' ? '' : 'filter') }}><SlidersHorizontal size={16} />{filter ? tools.filters.find((f) => f[0] === filter)?.[1] : 'Filters'}</button>
          {menu === 'filter' && <div className="crm-menu"><button type="button" className={!filter ? 'is-on' : ''} onClick={() => setFilter('')}>Everything</button>{tools.filters.map(([id, label]) => <button type="button" key={id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div>}</div>}
        <div className="crm-tool"><button type="button" aria-label="Refresh" title="Refresh" onClick={bump}><RefreshCw size={16} /></button></div>
        {primary && <motion.button type="button" className="crm-primary" onClick={primary[1]} whileHover={still ? undefined : { y: -1 }} whileTap={{ scale: 0.96 }} transition={spring}><Plus size={16} />{primary[0]}</motion.button>}
      </div>

      {['overview', 'board'].includes(page) && <motion.section className="crm-band" initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
        <div><h3>Found and returned this week</h3>
          <div className="crm-bars" role="img" aria-label={'Items found and returned per day: ' + home.bars.map((b: Row) => `${b.label} ${b.found} found, ${b.returned} returned`).join('; ')}>{home.bars.map((b: Row, i: number) => <div key={b.day}><span>
            <motion.i className="is-b" title={`${b.found} found`} initial={still ? false : { height: 0 }} animate={{ height: `${(b.found / max) * 100}%` }} transition={{ delay: 0.15 + i * 0.05, duration: 0.7, ease }} />
            <motion.i title={`${b.returned} returned`} initial={still ? false : { height: 0 }} animate={{ height: `${(b.returned / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.7, ease }} />
          </span>{b.label}</div>)}</div></div>
        <div className="crm-gauge"><svg viewBox="0 0 220 118" aria-hidden="true">{Array.from({ length: ticks }, (_, i) => { const a = Math.PI - (i / (ticks - 1)) * Math.PI, on = i < lit, r1 = on ? 78 : 86
          return <motion.line key={i} x1={110 + Math.cos(a) * r1} y1={110 - Math.sin(a) * r1} x2={110 + Math.cos(a) * 104} y2={110 - Math.sin(a) * 104} stroke="currentColor" strokeWidth={on ? 2.2 : 1.2} strokeLinecap="round" initial={still ? false : { opacity: 0 }} animate={{ opacity: on ? 1 : 0.28 }} transition={{ delay: 0.25 + i * 0.018, duration: 0.3 }} /> })}</svg>
          <strong>{pct === null ? '—' : <><CountUp value={pct} />%</>}</strong><small>{pct === null ? 'No items logged yet' : 'Items back with their owners'}</small></div>
        <motion.button type="button" className="crm-num" onClick={() => go('board')} whileHover={still ? undefined : { x: 3 }} transition={spring}><strong><CountUp value={c.inBox} /></strong><span>Waiting in a box<ArrowRight size={16} /></span></motion.button>
        <motion.button type="button" className="crm-num" onClick={() => go('approvals')} whileHover={still ? undefined : { x: 3 }} transition={spring}><strong><CountUp value={home.badges.approvals} /></strong><span>Waiting for your approval<ArrowRight size={16} /></span></motion.button>
      </motion.section>}

      <AnimatePresence mode="wait">
        <motion.div key={page} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={still ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.28, ease }}>
          {page === 'overview' ? <Overview home={home} go={go} onOpen={setItem} />
            : page === 'board' ? <DeskBoard query={query} open={item} onOpen={setItem} version={version} />
            : page === 'approvals' ? <Approvals version={version} onOpen={setItem} onChanged={bump} isManager />
            : page === 'students' ? <Students query={query} version={version} onChanged={bump} form={form} setForm={setForm} />
            : page === 'families' ? <Families home={home} version={version} onChanged={bump} />
            : page === 'staff' ? <StaffPage version={version} onChanged={bump} form={form} setForm={setForm} />
            : page === 'houses' ? <div className="sd-houses"><Houses /></div>
            : page === 'boxes' ? <Boxes version={version} onChanged={bump} form={form} setForm={setForm} />
            : page === 'report' ? <Report school={home.school.name} />
            : <Settings version={version} onChanged={bump} onLogout={() => void logout()} />}
        </motion.div>
      </AnimatePresence>
    </main>
    <AnimatePresence>{item && <CasePanel key="case" id={item} boxes={home.boxes} onClose={() => setItem(null)} onChanged={bump} />}</AnimatePresence>
  </div>
}
