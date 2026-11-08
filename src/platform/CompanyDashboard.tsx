import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Bell, Boxes, CheckCircle2, Clock, Database, FileText, HardDriveDownload,
  LogOut, Mail, MessageSquare, Package, Plug, RefreshCw, School, Server, ShieldCheck, ShoppingBag, Sparkles,
  UserPlus, Users, Wallet, Zap,
} from 'lucide-react'
import { money } from './api'
import { CompanyTrends } from './CompanyTrends'
import './dashboard.css'

type Count = { status: string; count: number }
export type Overview = {
  generatedAt: string; accounts: { total: number; new_today: number; verified: number }
  activity: { action: string; count: number }[]; daily: { day: string; count: number }[]
  sales?: { orders: number; collected_minor: string; awaiting_fulfillment: number; refunded: number }
  schools?: number; stock?: Count[]; support?: Count[]; orderStatuses?: Count[]
  orders?: { id: string; status: string; amount_minor: number; currency: string; payment_method: string; created_at: string }[]
  registrations?: { id: string; role: string; verified: boolean; created_at: string }[]
}
export type Health = {
  offsiteBackup?: { last_ok: string } | null; alerts?: { name: string; state: string }[]; worker?: { last_ok: string } | null
  status: string; databaseMs: number; uptimeSeconds: number; memoryMb: number; requests: number; serverErrors: number
  averageResponseMs: number; queue: { pending: number; failed: number }; integrations: Record<string, boolean>; note: string
}
type Severity = 'critical' | 'warning' | 'info'
type Attention = { id: string; severity: Severity; title: string; detail: string; icon: ReactNode; action?: { label: string; tab: string; form?: string } }

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const go = (tab: string, form?: string) => window.dispatchEvent(new CustomEvent('findbox-console-tab', { detail: { tab, form } }))
const nice = (s: string) => s.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, c => c.toUpperCase())
const sum = (rows: Count[] | undefined, ...statuses: string[]) => (rows || []).filter(r => !statuses.length || statuses.includes(r.status)).reduce((n, r) => n + Number(r.count), 0)

/** Animates a number from its previous value to the new one. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(reduced() ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduced() || !Number.isFinite(target)) { setValue(target); return }
    const start = performance.now(), base = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - p, 3)
      setValue(base + (target - base) * eased)
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values), w = 120, h = 36
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - (v / max) * (h - 8)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg className={`db-spark tone-${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className="db-spark-fill" />
      <path d={line} className="db-spark-line" pathLength={1} />
    </svg>
  )
}

function Kpi({ label, value, format, icon, tone, hint, spark, index }: { label: string; value: number | string; format?: (n: number) => string; icon: ReactNode; tone: string; hint?: string; spark?: number[]; index: number }) {
  const numeric = typeof value === 'number'
  const animated = useCountUp(numeric ? value : 0)
  const shown = numeric ? (format ? format(animated) : Math.round(animated).toLocaleString('en-KE')) : value
  return (
    <section className={`db-kpi tone-${tone}`} style={{ animationDelay: `${80 + index * 60}ms` }}>
      <div className="db-kpi-top"><span className="db-kpi-icon">{icon}</span><span className="db-kpi-label">{label}</span></div>
      <strong>{shown}</strong>
      <div className="db-kpi-foot">{hint && <small>{hint}</small>}{spark && <Sparkline values={spark} tone={tone} />}</div>
    </section>
  )
}

function Breakdown({ title, icon, rows, empty, tone, onOpen }: { title: string; icon: ReactNode; rows: Count[] | undefined; empty: string; tone: string; onOpen?: () => void }) {
  const total = sum(rows)
  return (
    <section className={`db-card db-breakdown tone-${tone}`}>
      <header><h3>{icon}{title}</h3>{onOpen && <button type="button" className="db-link" onClick={onOpen}>Open <ArrowRight size={14} /></button>}</header>
      {total ? <>
        <div className="db-stack" role="img" aria-label={`${title}: ${(rows || []).map(r => `${nice(r.status)} ${r.count}`).join(', ')}`}>
          {(rows || []).map((r, i) => <span key={r.status} className={`seg-${i % 5}`} style={{ flexGrow: Number(r.count) }} />)}
        </div>
        <ul>{(rows || []).map((r, i) => <li key={r.status}><i className={`seg-${i % 5}`} />{nice(r.status)}<strong>{r.count}</strong></li>)}</ul>
      </> : <p className="db-empty-line">{empty}</p>}
    </section>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone = ['paid', 'fulfilled', 'ok', 'confirmed'].includes(status) ? 'good' : ['pending', 'starting', 'in_progress'].includes(status) ? 'warn' : ['cancelled', 'refunded', 'expired', 'failed'].includes(status) ? 'bad' : 'neutral'
  return <span className={`db-pill is-${tone}`}>{nice(status)}</span>
}

function relative(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(iso).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function CompanyDashboard({ role, name, overview, health, busy, onRefresh, onLogout, security, children }: {
  role: string; name: string; overview: Overview | null; health: Health | null; busy: boolean
  onRefresh: () => void; onLogout: () => void; security: ReactNode; children?: ReactNode
}) {
  const admin = role === 'admin'
  const [now, setNow] = useState(Date.now())
  const [orderStatus, setOrderStatus] = useState('all'), [orderSearch, setOrderSearch] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  const count = (action: string) => overview?.activity.find(a => a.action === action)?.count || 0
  const last14 = useMemo(() => {
    if (!overview) return []
    const end = Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(overview.generatedAt)) + 'T00:00:00Z')
    return Array.from({ length: 14 }, (_, i) => { const day = new Date(end - (13 - i) * 864e5).toISOString().slice(0, 10); return overview.daily.find(d => d.day === day)?.count || 0 })
  }, [overview])

  const attention = useMemo<Attention[]>(() => {
    const list: Attention[] = []
    if (admin && overview) {
      const waiting = overview.sales?.awaiting_fulfillment || 0
      if (waiting) list.push({ id: 'orders', severity: 'critical', icon: <ShoppingBag size={18} />, title: `${waiting} paid ${waiting === 1 ? 'order is' : 'orders are'} waiting to be fulfilled`, detail: 'Families have paid. Prepare the packs for school collection.', action: { label: 'Fulfil orders', tab: 'orders' } })
      const fresh = sum(overview.support, 'new')
      if (fresh) list.push({ id: 'support', severity: 'warning', icon: <MessageSquare size={18} />, title: `${fresh} new support ${fresh === 1 ? 'request' : 'requests'}`, detail: 'Nobody has replied yet.', action: { label: 'Reply', tab: 'support' } })
      const open = sum(overview.support, 'in_progress')
      if (open) list.push({ id: 'support-open', severity: 'info', icon: <MessageSquare size={18} />, title: `${open} support ${open === 1 ? 'request is' : 'requests are'} in progress`, detail: 'Follow up and mark them resolved when done.', action: { label: 'Review', tab: 'support' } })
      const stock = sum(overview.stock, 'stock')
      if (overview.stock && stock < 24) list.push({ id: 'stock', severity: stock ? 'warning' : 'critical', icon: <Boxes size={18} />, title: stock ? `Only ${stock} tags left in stock` : 'No tags left in stock', detail: 'New orders cannot be fulfilled without printed tags.' })
      if (!overview.schools) list.push({ id: 'schools', severity: 'info', icon: <School size={18} />, title: 'No schools yet', detail: 'Ask a developer to onboard the first school.' })
    }
    if (!admin && health) {
      if (health.status !== 'ok') list.push({ id: 'api', severity: 'critical', icon: <Server size={18} />, title: `API status: ${health.status}`, detail: 'The API is not reporting healthy.' })
      health.alerts?.filter(a => a.state !== 'ok').forEach(a => list.push({ id: 'alert-' + a.name, severity: 'critical', icon: <AlertTriangle size={18} />, title: nice(a.name), detail: `Alert state: ${a.state}` }))
      if (health.queue.failed) list.push({ id: 'mail', severity: 'critical', icon: <Mail size={18} />, title: `${health.queue.failed} ${health.queue.failed === 1 ? 'email' : 'emails'} failed after all retries`, detail: 'People did not receive these messages.', action: { label: 'Inspect delivery', tab: 'mail' } })
      if (health.serverErrors) list.push({ id: 'errors', severity: 'warning', icon: <Zap size={18} />, title: `${health.serverErrors} server ${health.serverErrors === 1 ? 'error' : 'errors'} since the last restart`, detail: 'Check the server logs for the failing requests.' })
      if (!health.worker) list.push({ id: 'worker', severity: 'warning', icon: <Clock size={18} />, title: 'Background worker has not reported yet', detail: 'Reminders and emails depend on it.' })
      if (!health.offsiteBackup) list.push({ id: 'backup', severity: 'warning', icon: <HardDriveDownload size={18} />, title: 'No off-site backup reported yet', detail: 'Run the laptop backup and confirm it arrives.' })
      const missing = Object.entries(health.integrations).filter(([, v]) => !v).map(([k]) => nice(k))
      if (missing.length) list.push({ id: 'integrations', severity: 'info', icon: <Plug size={18} />, title: `${missing.length} ${missing.length === 1 ? 'integration' : 'integrations'} not configured`, detail: missing.join(', ') })
    }
    return list
  }, [admin, overview, health])

  const urgent = attention.filter(a => a.severity !== 'info').length
  const statusTone = urgent ? (attention.some(a => a.severity === 'critical') ? 'critical' : 'warning') : 'good'
  const statusText = urgent ? `${urgent} ${urgent === 1 ? 'thing needs' : 'things need'} you` : admin ? 'Everything is on track' : 'All systems normal'

  const orders = overview?.orders?.filter(o => (orderStatus === 'all' || o.status === orderStatus) && o.id.toLowerCase().includes(orderSearch.toLowerCase())) || []
  const quick = admin
    ? [{ label: 'Create invoice', icon: <FileText size={17} />, run: () => go('invoices', 'invoice') }, { label: 'Publish update', icon: <Bell size={17} />, run: () => go('announcements', 'announcement') }, { label: 'Invite client', icon: <UserPlus size={17} />, run: () => go('clients', 'invite') }]
    : [{ label: 'Onboard school', icon: <School size={17} />, run: () => go('schools', 'school-new') }, { label: 'School access', icon: <ShieldCheck size={17} />, run: () => go('school-access') }, { label: 'Manage accounts', icon: <Users size={17} />, run: () => go('users') }]

  return (
    <main className={`db-root ${admin ? 'is-admin' : 'is-developer'}`}>
      <section className="db-hero">
        <div className="db-hero-art" aria-hidden="true"><i /><i /><i /></div>
        <div className="db-hero-main">
          <span className={`db-status is-${statusTone}`}><i />{statusText}</span>
          <h1>{greeting()}, {name.split(' ')[0]}.</h1>
          <p>{admin ? 'Here is how FindBox is doing today: sales, orders, schools and support.' : 'Here is the health of FindBox right now: services, email, backups and accounts.'}</p>
          <div className="db-quick">{quick.map(q => <button key={q.label} type="button" onClick={q.run}>{q.icon}{q.label}</button>)}</div>
        </div>
        <div className="db-hero-side">
          <div className="db-hero-actions">
            {security}
            <button type="button" onClick={onRefresh} disabled={busy} className={busy ? 'is-spinning' : ''}><RefreshCw size={16} /> Refresh</button>
            <button type="button" onClick={onLogout}><LogOut size={16} /> Sign out</button>
          </div>
          <p className="db-updated">{overview ? <>Updated {relative(overview.generatedAt, now)}</> : 'Loading the latest numbers…'}</p>
        </div>
      </section>

      <div className="db-kpis">
        {admin ? <>
          <Kpi index={0} tone="mint" icon={<Wallet size={18} />} label="Collected sales" value={overview?.sales ? Number(overview.sales.collected_minor) : '—'} format={n => money(Math.round(n))} hint="Paid and fulfilled, refunds excluded" />
          <Kpi index={1} tone="amber" icon={<ShoppingBag size={18} />} label="Awaiting fulfilment" value={overview?.sales?.awaiting_fulfillment ?? '—'} hint={`${overview?.sales?.orders ?? 0} orders all time`} />
          <Kpi index={2} tone="sky" icon={<UserPlus size={18} />} label="New accounts · 24h" value={overview?.accounts.new_today ?? '—'} hint={`${overview?.accounts.total ?? 0} accounts in total`} spark={last14} />
          <Kpi index={3} tone="lilac" icon={<School size={18} />} label="Schools" value={overview?.schools ?? '—'} hint="Partner schools on FindBox" />
        </> : <>
          <Kpi index={0} tone={health && health.status !== 'ok' ? 'coral' : 'mint'} icon={<Server size={18} />} label="API status" value={health ? (health.status === 'ok' ? 'Healthy' : nice(health.status)) : '—'} hint={health ? `Up ${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m · ${health.memoryMb} MB` : undefined} />
          <Kpi index={1} tone="sky" icon={<Activity size={18} />} label="Mean response" value={health?.averageResponseMs ?? '—'} format={n => `${Math.round(n)} ms`} hint={health ? `${health.requests.toLocaleString('en-KE')} requests · database ${health.databaseMs} ms` : undefined} />
          <Kpi index={2} tone={health?.serverErrors ? 'coral' : 'amber'} icon={<Zap size={18} />} label="Server errors" value={health?.serverErrors ?? '—'} hint="Since the last restart" />
          <Kpi index={3} tone="lilac" icon={<Users size={18} />} label="Accounts" value={overview?.accounts.total ?? '—'} hint={`${overview?.accounts.new_today ?? 0} new today · ${count('login_failed')} failed sign-ins`} spark={last14} />
        </>}
      </div>

      <div className="db-split">
        <section className="db-card db-attention">
          <header><h3><Sparkles size={18} />Needs your attention</h3>{attention.length > 0 && <span className="db-count">{attention.length}</span>}</header>
          {attention.length ? <ul>{attention.map((a, i) => (
            <li key={a.id} className={`is-${a.severity}`} style={{ animationDelay: `${150 + i * 70}ms` }}>
              <span className="db-att-icon">{a.icon}</span>
              <div><strong>{a.title}</strong><p>{a.detail}</p></div>
              {a.action && <button type="button" onClick={() => go(a.action!.tab, a.action!.form)}>{a.action.label}<ArrowRight size={14} /></button>}
            </li>
          ))}</ul> : <div className="db-clear"><CheckCircle2 size={40} /><strong>You're all caught up</strong><p>Nothing needs action right now. New items appear here automatically.</p></div>}
        </section>
        <div className="db-chart-wrap">{overview && <CompanyTrends daily={overview.daily} generatedAt={overview.generatedAt} />}</div>
      </div>

      {admin && overview?.sales && <>
        <div className="db-three">
          <Breakdown title="Order pipeline" icon={<ShoppingBag size={17} />} rows={overview.orderStatuses} empty="No orders yet. They will appear here as families buy tags." tone="amber" onOpen={() => go('orders')} />
          <Breakdown title="Tag inventory" icon={<Package size={17} />} rows={overview.stock} empty="No tags have been printed yet." tone="mint" />
          <Breakdown title="Support requests" icon={<MessageSquare size={17} />} rows={overview.support} empty="No support requests. Quiet is good." tone="lilac" onOpen={() => go('support')} />
        </div>
        <div className="db-split is-wide">
          <section className="db-card">
            <header><h3><ShoppingBag size={17} />Latest orders</h3><button type="button" className="db-link" onClick={() => go('orders')}>All orders <ArrowRight size={14} /></button></header>
            <div className="db-filters">
              <select aria-label="Filter order status" value={orderStatus} onChange={e => setOrderStatus(e.target.value)}><option value="all">All statuses</option>{['pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'expired'].map(v => <option key={v} value={v}>{nice(v)}</option>)}</select>
              <input aria-label="Search order reference" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Search reference" type="search" />
            </div>
            {orders.length ? <div className="db-table"><table><thead><tr><th>Reference</th><th>Status</th><th>Total</th><th>Method</th><th>Created</th></tr></thead><tbody>{orders.slice(0, 8).map(o => <tr key={o.id}><td><code>{o.id.slice(0, 8)}</code></td><td><StatusPill status={o.status} /></td><td>{money(o.amount_minor)}</td><td>{o.payment_method}</td><td>{new Date(o.created_at).toLocaleDateString('en-KE')}</td></tr>)}</tbody></table></div>
              : <p className="db-empty-line">{overview.orders?.length ? 'No orders match these filters.' : 'No orders yet.'}</p>}
          </section>
          <section className="db-card db-people">
            <header><h3><UserPlus size={17} />Newest accounts</h3></header>
            {overview.registrations?.length ? <ul>{overview.registrations.slice(0, 7).map(r => <li key={r.id}><span className="db-avatar">{r.role.slice(0, 1).toUpperCase()}</span><div><strong>{nice(r.role)}</strong><small>{new Date(r.created_at).toLocaleDateString('en-KE')} · {r.id.slice(0, 8)}</small></div><span className={`db-pill ${r.verified ? 'is-good' : 'is-warn'}`}>{r.verified ? 'Verified' : 'Unverified'}</span></li>)}</ul> : <p className="db-empty-line">No accounts yet.</p>}
          </section>
        </div>
      </>}

      {!admin && health && <>
        <section className="db-card">
          <header><h3><Server size={17} />Services</h3><span className="db-muted">Live from the API</span></header>
          <div className="db-services">
            <Service icon={<Server size={18} />} name="API" ok={health.status === 'ok'} value={health.status === 'ok' ? 'Healthy' : nice(health.status)} />
            <Service icon={<Database size={18} />} name="Database" ok={health.databaseMs < 250} value={`${health.databaseMs} ms round trip`} />
            <Service icon={<Clock size={18} />} name="Background worker" ok={!!health.worker} value={health.worker ? `Last ran ${relative(health.worker.last_ok, now)}` : 'Not reported yet'} />
            <Service icon={<Mail size={18} />} name="Email queue" ok={!health.queue.failed} value={`${health.queue.pending} pending · ${health.queue.failed} failed`} />
            <Service icon={<HardDriveDownload size={18} />} name="Off-site backup" ok={!!health.offsiteBackup} value={health.offsiteBackup ? new Date(health.offsiteBackup.last_ok).toLocaleString('en-KE') : 'Awaiting first report'} />
            {health.alerts?.map(a => <Service key={a.name} icon={<AlertTriangle size={18} />} name={nice(a.name)} ok={a.state === 'ok'} value={nice(a.state)} />)}
          </div>
          <div className="db-integrations"><span>Integrations</span>{Object.entries(health.integrations).map(([k, v]) => <span key={k} className={`db-pill ${v ? 'is-good' : 'is-neutral'}`}><i />{nice(k)}</span>)}</div>
          <p className="db-note">{health.note}</p>
        </section>
      </>}

      {children}
    </main>
  )
}

function Service({ icon, name, ok, value }: { icon: ReactNode; name: string; ok: boolean; value: string }) {
  return (
    <div className={`db-service ${ok ? 'is-ok' : 'is-bad'}`}>
      <span className="db-service-icon">{icon}</span>
      <div><strong>{name}</strong><small>{value}</small></div>
      <i className="db-dot" aria-label={ok ? 'Healthy' : 'Needs attention'} />
    </div>
  )
}

