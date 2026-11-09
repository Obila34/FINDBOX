import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { QRCode } from '@/components/ui/qr-code'
import { ArrowLeft, Check, Clock, GraduationCap, KeyRound, Printer, QrCode, RefreshCw, ScanLine, School, UserPlus, X } from 'lucide-react'
import { HousePicker, type HouseId } from './Houses'
import { api } from './api'
import { notify } from './feedback'
import './dashboard.css'
import './school-admin.css'
import './family.css'

type Row = Record<string, any>
type ChildQr = { id: string; name: string; house: HouseId | null; code: string | null; items: { id: string; name: string; category: string; status: string }[]; labels: { delivered: number; used: number; remaining: number } }
const CATEGORIES: [string, string][] = [['clothing', 'Clothing'], ['bottle', 'Bottle'], ['lunchbox', 'Lunchbox'], ['book', 'Book'], ['sports', 'Sports kit'], ['electronics', 'Gadget'], ['keys', 'Keys'], ['other', 'Other']]
const WORDS = ['mango', 'tiger', 'river', 'sunny', 'zebra', 'pencil', 'rocket', 'banana', 'cloud', 'forest', 'lemon', 'panda', 'comet', 'garden', 'violet', 'maple', 'ocean', 'pepper', 'robin', 'tulip', 'cobalt', 'falcon', 'meadow', 'rainbow', 'savanna', 'acacia', 'baobab', 'kestrel', 'safari', 'jungle', 'lagoon', 'orbit']
const shortLogin = (login = '') => login.replace('@students.findbox.invalid', '')
const pick = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]! % n }
/** Easy for a child to type, still long enough to be safe: e.g. "mango-tiger-river-47". */
const passphrase = () => [WORDS[pick(WORDS.length)], WORDS[pick(WORDS.length)], WORDS[pick(WORDS.length)], String(10 + pick(90))].join('-')

export function FamilyChildren() {
  const [roster, setRoster] = useState<Row[]>([]), [requests, setRequests] = useState<Row[]>([]), [hasSchool, setHasSchool] = useState(true)
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [card, setCard] = useState<{ child: Row; login?: string; password: string; qr?: string } | null>(null)
  const [qrs, setQrs] = useState<ChildQr[]>([]), [open, setOpen] = useState<string | null>(null), [house, setHouse] = useState<HouseId | null>(null)
  async function load() {
    const [r, q, c] = await Promise.all([api<{ rows: Row[] }>('/family/roster').catch(() => ({ rows: [] })), api<{ rows: Row[]; school: boolean }>('/family/children/requests'), api<{ children: ChildQr[] }>('/family/qr').catch(() => ({ children: [] }))])
    setRoster(r.rows); setQrs(c.children); setRequests(q.rows.filter(x => x.status !== 'approved')); setHasSchool(q.school); setLoaded(true)
  }
  useEffect(() => { load().catch(e => { notify((e as Error).message, 'error'); setLoaded(true) }) }, [])
  async function run(fn: () => Promise<void>) { setBusy(true); try { await fn(); await load() } catch { /* toast already shown */ } finally { setBusy(false) } }
  function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, d = Object.fromEntries(new FormData(form)) as Record<string, string>
    void run(async () => { await api('/family/children/request', { ...d, ...(house ? { house } : {}) }); notify(`Sent to your school. You'll see ${d.name} here once they approve.`); form.reset(); setHouse(null) })
  }
  async function enableLogin() {
    if (!card) return
    setBusy(true)
    try {
      const r = await api<{ login: string }>('/family/roster/' + card.child.id + '/login', { password: card.password, approve: true })
      setCard({ ...card, login: r.login, qr: `${location.origin}/app/sign-in?email=${encodeURIComponent(shortLogin(r.login))}` }); notify(`${card.child.name} can now sign in.`); await load()
    } catch { /* toast already shown */ } finally { setBusy(false) }
  }
  return (
    <main className="fm-page">
      <Link to="/app/home" className="fm-back"><ArrowLeft size={16} />Back to home</Link>
      <header className="fm-head"><h1>Your children</h1><p>Add your child so their belongings come back to the right family. A login for your child is optional.</p></header>
      {!loaded ? <p role="status">Loading…</p> : <>
        {!hasSchool ? <div className="sa-banner"><School size={20} /><div><strong>Join your school first</strong><p>Use the link or poster from your school, or add its code under Profile settings & security.</p></div><Link className="sa-btn" to="/app/security">Add school</Link></div>
          : <section className="db-card"><header><h3><UserPlus size={18} />Add a child</h3></header>
            <form className="fm-add" onSubmit={ask}><fieldset disabled={busy}>
              <label className="sa-field"><span>Child's full name</span><input name="name" required maxLength={100} placeholder="As the school knows them" /></label>
              <label className="sa-field"><span>Class</span><input name="className" required maxLength={80} placeholder="e.g. Grade 4 East" /></label>
              <div className="sa-field"><span>House</span><HousePicker value={house} onPick={setHouse} name="Child's house" /></div>
              <button className="sa-btn"><UserPlus size={16} />Send to school</button>
            </fieldset></form>
            <p className="sa-note">Your school checks this against their records before linking your child to your account.</p>
          </section>}
        {requests.length > 0 && <section className="db-card"><header><h3><Clock size={18} />Waiting for your school</h3></header>
          <ul className="fm-list">{requests.map(r => <li key={r.id}><span className="db-avatar is-pending"><Clock size={15} /></span><div><strong>{r.name}</strong><small>{r.class_name} · sent {new Date(r.created_at).toLocaleDateString('en-KE')}</small></div><span className={`db-pill ${r.status === 'declined' ? 'is-bad' : 'is-warn'}`}>{r.status === 'declined' ? 'Not approved' : 'Pending'}</span></li>)}</ul>
        </section>}
        <section className="fm-children">
          {roster.map(c => <article key={c.id} className="db-card fm-child">
            <span className="fm-child-icon"><GraduationCap size={22} /></span>
            <h3>{c.name}</h3><p>{c.school} · {c.class_name}</p>
            {c.status === 'active' && <div className="fm-house"><HousePicker value={qrs.find(q => q.id === c.id)?.house} disabled={busy} name={`${c.name}'s house`} onPick={h => void run(async () => { await api('/family/children/' + c.id + '/house', { house: h }); notify(`${c.name} is in ${h[0]!.toUpperCase() + h.slice(1)} house.`) })} /></div>}
            <p className="fm-login">{c.user_id ? <><Check size={14} />Can sign in as <strong>{shortLogin(c.login)}</strong></> : 'No login. Most children do not need one.'}</p>
            <footer>
              {c.status === 'active' && <button type="button" className="sa-btn" onClick={() => setOpen(c.id)}><QrCode size={15} />Labels &amp; belongings ({qrs.find(q => q.id === c.id)?.items.length || 0})</button>}
              {c.status === 'active' && <button type="button" className="sa-btn is-ghost" onClick={() => setCard({ child: c, password: passphrase() })}><KeyRound size={15} />{c.user_id ? 'New password & card' : 'Create login card'}</button>}
              {c.user_id && <button type="button" className="fm-link" disabled={busy} onClick={() => void run(async () => { await api('/family/roster/' + c.id + '/disable-login', {}); notify(`${c.name}'s login is turned off.`) })}>Turn off login</button>}
            </footer>
          </article>)}
          {!roster.length && <div className="sa-empty is-small"><GraduationCap size={30} /><p>No children linked yet. Add your child above, or accept the invitation your school emailed you.</p></div>}
        </section>
      </>}
      {open && (() => {
        const child = qrs.find(q => q.id === open)
        if (!child) return null
        const first = child.name.split(' ')[0]
        return <div className="sa-panel-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setOpen(null) }}>
          <aside className="sa-panel" role="dialog" aria-modal="true" aria-label={`${child.name}'s QR`}>
            <header><div><p>LABELS &amp; BELONGINGS</p><h2>{child.name}</h2></div><button type="button" className="sa-panel-close" aria-label="Close" onClick={() => setOpen(null)}><X size={18} /></button></header>
            <div className="sa-panel-body"><div className="sa-form">
              <div className="fm-labels">
                <strong>{child.labels.remaining}</strong>
                <span>{child.labels.delivered ? `of ${child.labels.delivered} delivered labels left` : "No labels delivered yet"}</span>
              </div>
              <p className="sa-note">{child.labels.delivered
                ? `To add a belonging, stick one of ${first}'s labels on it, then scan it with I found it. Every label carries the same QR with ${first}'s name.`
                : `Order labels for ${first}. Once FindBox marks them delivered, scan a label to add each belonging.`}</p>
              <h3 className="fm-sub">Belongings</h3>
              {child.items.length ? <ul className="fm-items">{child.items.map(i => <li key={i.id}><span>{i.name}</span><small>{CATEGORIES.find(c => c[0] === i.category)?.[1] || 'Other'}</small></li>)}</ul> : <p className="sa-note">Nothing listed yet.</p>}
              <div className="sa-form-actions"><Link className="sa-btn is-ghost" to="/app/shop">Order labels</Link>{child.labels.remaining > 0 && <Link className="sa-btn" to="/app/found"><ScanLine size={16} />Scan a label</Link>}</div>
            </div></div>
          </aside>
        </div>
      })()}
      {card && <div className="sa-panel-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setCard(null) }}>
        <aside className="sa-panel" role="dialog" aria-modal="true" aria-label="Login card">
          <header><div><p>LOGIN CARD</p><h2>{card.child.name}</h2></div><button type="button" className="sa-panel-close" aria-label="Close" onClick={() => setCard(null)}><X size={18} /></button></header>
          <div className="sa-panel-body">{!card.login ? <div className="sa-form">
            <p className="sa-note">We made an easy password. Your child types it once on their own device, or you keep this card somewhere safe.</p>
            <div className="fm-pass"><code>{card.password}</code><button type="button" className="fm-link" onClick={() => setCard({ ...card, password: passphrase() })}><RefreshCw size={14} />Another</button></div>
            <label className="sa-toggle"><input type="checkbox" required id="fm-approve" /><span /><div><strong>I am this child's guardian and approve this login</strong><small>You can turn it off at any time.</small></div></label>
            <div className="sa-form-actions"><button type="button" className="sa-btn is-ghost" onClick={() => setCard(null)}>Cancel</button><button type="button" className="sa-btn" disabled={busy} onClick={() => { const ok = (document.getElementById('fm-approve') as HTMLInputElement)?.checked; if (!ok) { notify('Tick the approval box first.', 'error'); return } void enableLogin() }}>Turn on login</button></div>
          </div> : <div className="sa-form">
            <div className="fm-card" id="fm-card">
              <p className="fm-card-brand">FINDBOX</p><h3>{card.child.name}</h3>
              {card.qr && <QRCode value={card.qr} size={180} variant="rounded" errorCorrection="Q" color="#123a2e" reveal="load" aria-label="QR code that opens the FindBox sign-in page" />}
              <dl><dt>Sign in at</dt><dd>{location.host}/app/sign-in</dd><dt>Username</dt><dd>{shortLogin(card.login)}</dd><dt>Password</dt><dd>{card.password}</dd></dl>
              <p>Keep this card private.</p>
            </div>
            <div className="sa-form-actions"><button type="button" className="sa-btn is-ghost" onClick={() => setCard(null)}>Done</button><button type="button" className="sa-btn" onClick={() => window.print()}><Printer size={16} />Print card</button></div>
          </div>}</div>
        </aside>
      </div>}
    </main>
  )
}
