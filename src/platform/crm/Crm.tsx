import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Activity, ArrowRight, BarChart3, Bell, FileText, HeartPulse, History, LayoutDashboard, LineChart, ListChecks, LogOut, Mail, Menu, MessageSquare, Package, Plus, RefreshCw, School, Search, Settings, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Target, User, Users, Wallet, ArrowDownWideNarrow, type LucideIcon } from 'lucide-react'
import { api, money } from '../api'
import { Assistant } from '../assistant/Assistant'
import { CompanyConsole } from '../CompanyConsole'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SwirlMark } from '@/components/brand/Logo'
import { Board, type RecordRef, type Row } from './Board'
import { RecordPanel } from './Record'
import { ActivityFeed, Customers, Dashboard, LeadForm, TaskForm, Tasks } from './Pages'
import { CountUp, ease, spring } from './fx'
import './crm.css'

type NavItem = [page: string, label: string, Icon: LucideIcon, badge?: string]
const BANDS: [string, string][] = [['green', 'Healthy'], ['amber', 'Needs attention'], ['red', 'At risk'], ['new', 'New']]
const TOOLS: Record<string, { sorts: [string, string][]; filters: [string, string][]; me?: boolean }> = {
  leads: { me: true, sorts: [['recent', 'Recently updated'], ['oldest', 'Oldest first'], ['value', 'Highest value'], ['score', 'Best score'], ['name', 'Name']], filters: [['website', 'Website'], ['referral', 'Referral'], ['event', 'Event'], ['outreach', 'Outreach'], ['other', 'Other']] },
  onboarding: { sorts: [['name', 'Name'], ['score', 'Healthiest first'], ['recent', 'Newest']], filters: BANDS },
  orders: { sorts: [['recent', 'Newest'], ['oldest', 'Oldest first'], ['value', 'Highest value']], filters: [['school', 'School pickup'], ['home', 'Home delivery']] },
  support: { sorts: [['recent', 'Newest'], ['oldest', 'Oldest first']], filters: [['school', 'School enquiries'], ['order', 'Orders'], ['bug', 'Bugs'], ['general', 'General'], ['feedback', 'Feedback'], ['suggestion', 'Suggestions']] },
  'customers:schools': { sorts: [['name', 'Name'], ['health', 'Lowest health first'], ['size', 'Largest'], ['recent', 'Newest']], filters: BANDS },
  'customers:families': { sorts: [['name', 'Name'], ['recent', 'Newest'], ['spend', 'Top spenders'], ['size', 'Most children']], filters: [['buyers', 'Have ordered'], ['no_children', 'No children yet']] },
  activity: { me: true, sorts: [], filters: [['sales', 'Sales'], ['support', 'Support'], ['schools', 'Schools'], ['system', 'System']] },
  tasks: { me: true, sorts: [], filters: [] },
}
const nav = (admin: boolean): [string, NavItem[]][] => {
  const work: NavItem[] = [['dashboard', 'Dashboard', LayoutDashboard], ['tasks', 'Tasks', ListChecks, 'tasks'], ['activity', 'Activity', Activity], ['customers', 'Customers', Users], ['assistant', 'Assistant', Sparkles]]
  return admin ? [
    ['', work],
    ['Pipelines', [['leads', 'School leads', Target, 'leads'], ['onboarding', 'Onboarding', School, 'onboarding'], ['orders', 'Orders', ShoppingBag, 'orders'], ['support', 'Support', MessageSquare, 'support']]],
    ['Finance', [['legacy:invoices', 'Invoices', FileText], ['legacy:clients', 'Billing clients', User], ['legacy:ledger', 'Balances & credits', Wallet]]],
    ['Engage', [['legacy:announcements', 'Announcements', Bell], ['legacy:reports', 'School reports', BarChart3]]],
    ['Admin', [['legacy:schools', 'Schools setup', School], ['legacy:users', 'Accounts & access', ShieldCheck], ['legacy:audit', 'Audit history', History], ['legacy:overview', 'Sales & stock', LineChart], ['legacy:settings', 'Business profile', Settings]]],
  ] : [
    ['', work],
    ['Pipelines', [['onboarding', 'Onboarding', School, 'onboarding']]],
    ['Data', [['legacy:schools', 'School access', School], ['legacy:users', 'Users & accounts', Users], ['legacy:items', 'Items & labels', Package]]],
    ['System', [['legacy:overview', 'System health', HeartPulse], ['legacy:mail', 'Mail delivery', Mail], ['legacy:privacy', 'Privacy requests', ShieldCheck], ['legacy:audit', 'Audit history', History]]],
  ]
}
const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** The summary band: new customers by day, the return rate, and two headline numbers that link to their detail. */
function Band({ home, go }: { home: Row; go: (p: string) => void }) {
  const still = useReducedMotion()
  const max = Math.max(1, ...home.bars.map((b: Row) => Math.max(b.parents, b.students)))
  const pct = home.returnRate.pct, ticks = 44, lit = pct === null ? 0 : Math.round((pct / 100) * ticks)
  return <motion.section className="crm-band" initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
    <div>
      <h3>New customers</h3>
      <div className="crm-bars" role="img" aria-label={'New parents and students per day: ' + home.bars.map((b: Row) => `${b.label} ${b.parents + b.students}`).join(', ')}>
        {home.bars.map((b: Row, i: number) => <div key={b.day}><span>
          <motion.i className="is-b" title={`${b.students} students`} initial={still ? false : { height: 0 }} animate={{ height: `${(b.students / max) * 100}%` }} transition={{ delay: 0.15 + i * 0.05, duration: 0.7, ease }} />
          <motion.i title={`${b.parents} parents`} initial={still ? false : { height: 0 }} animate={{ height: `${(b.parents / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.7, ease }} />
        </span>{b.label}</div>)}
      </div>
    </div>
    <div className="crm-gauge">
      <svg viewBox="0 0 220 118" aria-hidden="true">{Array.from({ length: ticks }, (_, i) => {
        const a = Math.PI - (i / (ticks - 1)) * Math.PI, on = i < lit, r1 = on ? 78 : 86, r2 = 104
        return <motion.line key={i} x1={110 + Math.cos(a) * r1} y1={110 - Math.sin(a) * r1} x2={110 + Math.cos(a) * r2} y2={110 - Math.sin(a) * r2} stroke="currentColor" strokeWidth={on ? 2.2 : 1.2} strokeLinecap="round"
          initial={still ? false : { opacity: 0 }} animate={{ opacity: on ? 1 : 0.28 }} transition={{ delay: 0.25 + i * 0.018, duration: 0.3 }} />
      })}</svg>
      <strong>{pct === null ? '—' : <><CountUp value={pct} />%</>}</strong>
      <small>{pct === null ? 'No lost items yet' : 'Lost items back home'}</small>
    </div>
    <motion.button type="button" className="crm-num" onClick={() => go('tasks')} whileHover={still ? undefined : { x: 3 }} transition={spring}>
      <strong><CountUp value={home.tasksOpen} /></strong><span>Tasks in progress<ArrowRight size={16} /></span>
    </motion.button>
    {home.orders
      ? <motion.button type="button" className="crm-num" onClick={() => go('orders')} whileHover={still ? undefined : { x: 3 }} transition={spring}><strong><CountUp value={home.orders.collectedMinor} format={(n) => money(Math.round(n))} /></strong><span>Collected from label orders<ArrowRight size={16} /></span></motion.button>
      : <motion.button type="button" className="crm-num" onClick={() => go('customers')} whileHover={still ? undefined : { x: 3 }} transition={spring}><strong><CountUp value={home.customers.families} /></strong><span>Families on FindBox<ArrowRight size={16} /></span></motion.button>}
  </motion.section>
}

/** The operations CRM shell: sidebar, top bar, summary band, the current page and the record panel. */
export function Crm({ access, overview, onLogout }: { access: { role: string; name: string }; overview: ReactNode; onLogout: () => void }) {
  const isAdmin = access.role === 'admin', still = useReducedMotion()
  const [page, setPage] = useState('dashboard'), [home, setHome] = useState<Row | null>(null), [version, setVersion] = useState(0)
  const [search, setSearch] = useState(''), [q, setQ] = useState(''), [sort, setSort] = useState(''), [filter, setFilter] = useState(''), [mine, setMine] = useState(false)
  const [kind, setKind] = useState<'schools' | 'families'>('schools'), [record, setRecord] = useState<RecordRef | null>(null), [form, setForm] = useState<'lead' | 'task' | null>(null), [menu, setMenu] = useState(''), [open, setOpen] = useState(false)
  const bump = () => setVersion((v) => v + 1)
  useEffect(() => { try { if (!localStorage.getItem('fb-theme')) document.documentElement.dataset.theme = 'light' } catch { /* keep the current theme */ } }, [])
  useEffect(() => { api<Row>('/company/crm/home').then(setHome).catch(() => {}) }, [version])
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 250); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (!menu) return; const close = () => setMenu(''); window.addEventListener('click', close); return () => window.removeEventListener('click', close) }, [menu])
  // Older dashboard cards still ask for a section by name.
  useEffect(() => { const on = (e: Event) => { const t = (e as CustomEvent<{ tab: string }>).detail?.tab; if (t && t !== 'overview') setPage('legacy:' + t) }; window.addEventListener('findbox-console-tab', on); return () => window.removeEventListener('findbox-console-tab', on) }, [])
  function go(next: string) { setPage(next); setSort(''); setFilter(''); setMine(false); setSearch(''); setQ(''); setOpen(false); window.scrollTo({ top: 0 }) }
  const toolKey = page === 'customers' ? 'customers:' + kind : page, tools = TOOLS[toolKey]
  const query = useMemo(() => new URLSearchParams({ ...(q ? { q } : {}), ...(sort ? { sort } : {}), ...(filter ? { filter } : {}), ...(mine && page !== 'activity' ? { mine: '1' } : {}), ...(mine && page === 'activity' && !filter ? { filter: 'mine' } : {}) }).toString(), [q, sort, filter, mine, page])
  const add = !isAdmin ? (page === 'customers' ? 'school' : 'task') : ['dashboard', 'leads', 'customers'].includes(page) ? 'lead' : 'task'
  function onAdd() {
    if (add === 'school') { go('legacy:schools'); setTimeout(() => window.dispatchEvent(new CustomEvent('findbox-console-tab', { detail: { tab: 'schools', form: 'school-new' } })), 120) }
    else setForm(add)
  }
  const legacy = page.startsWith('legacy:') ? page.slice(7) : ''
  const team = home?.team ?? []

  return <div className={'crm-root' + (open ? ' is-open' : '')}>
    <aside className="crm-side" aria-label="Workspace">
      <div className="crm-brand"><SwirlMark size={22} /><span>FindBox <small>{isAdmin ? 'Operations' : 'Developer'}</small></span></div>
      {nav(isAdmin).map(([group, items]) => <div key={group || 'main'}>
        {group && <h4>{group}</h4>}
        {items.map(([id, label, Icon, badge]) => { const on = page === id, n = badge ? home?.badges?.[badge] : 0; return <button type="button" key={id} className={'crm-nav' + (on ? ' is-on' : '')} aria-current={on ? 'page' : undefined} onClick={() => go(id)} style={{ position: 'relative', background: 'transparent' }}>
          {on && <motion.i layoutId="crm-nav-pill" transition={spring} style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'var(--c-soft)' }} />}
          <Icon size={17} strokeWidth={on ? 2.1 : 1.7} style={{ position: 'relative' }} /><span style={{ position: 'relative' }}>{label}</span>{n ? <b style={{ position: 'relative' }}>{n}</b> : null}
        </button> })}
      </div>)}
      {team.length > 0 && <><h4>Team</h4><div className="crm-team">{team.map((t: Row) => <div className="crm-person" key={t.id}><span className={'crm-avatar' + (t.last_seen && Date.now() - new Date(t.last_seen).getTime() < 6e5 ? ' is-live' : '')}>{initials(t.name)}</span><div><strong>{t.name}</strong><small>{t.role === 'admin' ? 'Company admin' : 'Developer'}</small></div></div>)}</div></>}
      <div className="crm-me"><div className="crm-person"><span className="crm-avatar">{initials(access.name)}</span><div><strong>{access.name}</strong><small>{isAdmin ? 'Company admin' : 'Developer'}</small></div></div><ThemeToggle /><button type="button" className="crm-icon" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={17} /></button></div>
    </aside>
    {open && <div className="crm-scrim" style={{ zIndex: 65 }} onClick={() => setOpen(false)} />}

    <main className="crm-main">
      <div className="crm-top">
        <button type="button" className="crm-icon crm-menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={19} /></button>
        {legacy || page === 'assistant' ? <span className="crm-search" /> : <label className="crm-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !tools) { const v = search; go('customers'); setSearch(v) } }} placeholder={page === 'leads' ? 'Search leads…' : page === 'orders' ? 'Search orders…' : page === 'support' ? 'Search tickets…' : page === 'activity' ? 'Search activity…' : 'Search customers…'} aria-label="Search" /></label>}
        {tools && tools.sorts.length > 0 && <div className="crm-tool"><button type="button" className={sort ? 'is-on' : ''} aria-haspopup="menu" aria-expanded={menu === 'sort'} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'sort' ? '' : 'sort') }}><ArrowDownWideNarrow size={16} />Sort by</button>
          {menu === 'sort' && <div className="crm-menu" role="menu">{tools.sorts.map(([id, label], i) => <button type="button" role="menuitemradio" aria-checked={(sort || tools.sorts[0]![0]) === id} key={id} className={(sort || (i === 0 ? id : '')) === id ? 'is-on' : ''} onClick={() => setSort(id)}>{label}</button>)}</div>}</div>}
        {tools && tools.filters.length > 0 && <div className="crm-tool"><button type="button" className={filter ? 'is-on' : ''} aria-haspopup="menu" aria-expanded={menu === 'filter'} onClick={(e) => { e.stopPropagation(); setMenu(menu === 'filter' ? '' : 'filter') }}><SlidersHorizontal size={16} />{filter ? tools.filters.find((f) => f[0] === filter)?.[1] : 'Filters'}</button>
          {menu === 'filter' && <div className="crm-menu" role="menu"><button type="button" className={!filter ? 'is-on' : ''} onClick={() => setFilter('')}>Everything</button>{tools.filters.map(([id, label]) => <button type="button" key={id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div>}</div>}
        {tools?.me && <div className="crm-tool"><button type="button" className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(!mine)}><User size={16} />Me</button></div>}
        <div className="crm-tool"><button type="button" aria-label="Refresh" title="Refresh" onClick={bump}><RefreshCw size={16} /></button></div>
        {!legacy && page !== 'assistant' && <motion.button type="button" className="crm-primary" onClick={onAdd} whileHover={still ? undefined : { y: -1 }} whileTap={{ scale: 0.96 }} transition={spring}><Plus size={16} />{add === 'lead' ? 'Add lead' : add === 'school' ? 'Add school' : 'Add task'}</motion.button>}
      </div>

      {home && ['dashboard', 'leads', 'onboarding', 'orders', 'support', 'customers'].includes(page) && <Band home={home} go={go} />}

      <AnimatePresence mode="wait">
        <motion.div key={page + kind} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={still ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.28, ease }}>
          {page === 'dashboard' ? (home ? <Dashboard home={home} go={go} onOpen={setRecord} version={version} /> : <p role="status" className="crm-empty">Loading your workspace…</p>)
            : ['leads', 'onboarding', 'orders', 'support'].includes(page) ? <Board kind={page} query={query} open={record} onOpen={setRecord} version={version} onChanged={bump} />
            : page === 'customers' ? <Customers kind={kind} setKind={(k) => { setKind(k); setSort(''); setFilter('') }} query={query} onOpen={setRecord} version={version} />
            : page === 'tasks' ? <Tasks go={go} onOpen={setRecord} version={version} onChanged={bump} mine={mine} />
            : page === 'activity' ? <ActivityFeed query={query} version={version} />
            : page === 'assistant' ? <Assistant />
            : <CompanyConsole access={access} onLogout={onLogout} bare section={legacy}>{overview}</CompanyConsole>}
        </motion.div>
      </AnimatePresence>
    </main>

    <AnimatePresence>{record && <RecordPanel key="record" target={record} team={team} isAdmin={isAdmin} onClose={() => setRecord(null)} onOpen={setRecord} onChanged={bump} onLegacy={(t) => { setRecord(null); go('legacy:' + t) }} />}</AnimatePresence>
    {form === 'lead' && <LeadForm onClose={() => setForm(null)} onSaved={(id) => { setForm(null); bump(); go('leads'); setRecord({ type: 'lead', id }) }} />}
    {form === 'task' && <TaskForm team={team} onClose={() => setForm(null)} onSaved={() => { setForm(null); bump() }} />}
  </div>
}
