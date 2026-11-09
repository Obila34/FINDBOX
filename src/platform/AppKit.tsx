import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react'
import { AlertTriangle, ArrowRight, Check, Clock, ShoppingBag, type LucideIcon } from 'lucide-react'
import { useServerCart } from '@/commerce/serverCart'
import { notify } from './feedback'
import { cx } from '@/lib/util'
import './app-premium.css'

const ease = [0.16, 1, 0.3, 1] as const

export type Slide = { kicker: string; title: string; accent: string; body: string; cta: string; to: string; image: string; tone?: 'forest' | 'night' | 'pop' }

/** Swipeable promo banner: drag or wait, with dots. Pauses while touched and for reduced motion. */
export function PromoCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0), [dir, setDir] = useState(1), [held, setHeld] = useState(false)
  const still = useReducedMotion()
  useEffect(() => {
    if (held || still || slides.length < 2) return
    const t = window.setTimeout(() => { setDir(1); setI(n => (n + 1) % slides.length) }, 5200)
    return () => clearTimeout(t)
  }, [i, held, still, slides.length])
  const go = (n: number) => { setDir(n > i ? 1 : -1); setI((n + slides.length) % slides.length) }
  function end(_: unknown, info: PanInfo) { setHeld(false); if (info.offset.x < -50) go(i + 1); else if (info.offset.x > 50) go(i - 1) }
  const s = slides[i]!
  return <section className="pa-carousel" aria-roledescription="carousel" aria-label="Highlights">
    <div className="pa-carousel-frame">
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.article key={i} className={cx('pa-slide', 'tone-' + (s.tone ?? 'forest'))} custom={dir}
          initial={still ? false : { x: dir * 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -60, opacity: 0 }} transition={{ duration: 0.5, ease }}
          drag={still ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} onDragStart={() => setHeld(true)} onDragEnd={end}
          aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
          <img src={s.image} alt="" draggable={false} />
          <div className="pa-slide-copy">
            <span className="pa-slide-kicker">{s.kicker}</span>
            <h2>{s.title} <em>{s.accent}</em></h2>
            <p>{s.body}</p>
            <Link to={s.to} className="pa-cta">{s.cta} <ArrowRight size={16} /></Link>
          </div>
        </motion.article>
      </AnimatePresence>
    </div>
    {slides.length > 1 && <div className="pa-dots">{slides.map((_, n) => <button key={n} type="button" aria-label={`Show highlight ${n + 1}`} aria-current={n === i} onClick={() => go(n)}>{n === i && <motion.i layoutId="pa-dot" />}</button>)}</div>}
  </section>
}

export type Shortcut = { label: string; to: string; Icon: LucideIcon; badge?: number }

/** Round quick actions, scrolling sideways on phones. */
export function Shortcuts({ items }: { items: Shortcut[] }) {
  const still = useReducedMotion()
  return <nav className="pa-shortcuts" aria-label="Quick actions">
    {items.map(({ label, to, Icon, badge }, n) => <motion.div key={label} initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * n, duration: 0.45, ease }}>
      <Link to={to} className={cx('pa-shortcut', n === 0 && 'is-lead')}>
        <motion.span whileTap={{ scale: 0.88 }} whileHover={still ? undefined : { y: -3 }}><Icon size={24} strokeWidth={1.8} />{!!badge && <b>{badge}</b>}</motion.span>
        <small>{label}</small>
      </Link>
    </motion.div>)}
  </nav>
}

/** Pill filter chips with a sliding highlight. */
export function Chips<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return <div className="pa-chips" role="tablist" aria-label={label}>
    {options.map(o => <button key={o.id} type="button" role="tab" aria-selected={o.id === value} onClick={() => onChange(o.id)} className={cx(o.id === value && 'is-on')}>
      {o.id === value && <motion.i layoutId={'pa-chip-' + label} className="pa-chip-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <span>{o.label}{o.count !== undefined && <small>{o.count}</small>}</span>
    </button>)}
  </div>
}

/** Compact live counts. */
export function StatStrip({ stats }: { stats: { label: string; value: number; to: string; tone?: 'pop' | 'calm' | 'alert' }[] }) {
  return <div className="pa-stats">{stats.map(s => <Link key={s.label} to={s.to} className={cx('pa-stat', 'tone-' + (s.tone ?? 'calm'))}><strong>{s.value}</strong><span>{s.label}</span></Link>)}</div>
}

const STATUS: Record<string, { label: string; tone: string; Icon: LucideIcon }> = {
  with_owner: { label: 'With you', tone: 'ok', Icon: Check },
  lost: { label: 'Lost', tone: 'alert', Icon: AlertTriangle },
  reported_lost: { label: 'Lost', tone: 'alert', Icon: AlertTriangle },
  awaiting_collection: { label: 'Ready to collect', tone: 'pop', Icon: Clock },
  awaiting_deposit: { label: 'On its way', tone: 'pop', Icon: Clock },
  found: { label: 'Found · on its way', tone: 'pop', Icon: Clock },
}

/** A belonging: photo, status badge and owner. */
export function ItemCard({ name, image, status, owner, code, index = 0, to }: { name: string; image: string; status: string; owner?: string; code: string; index?: number; to?: string }) {
  const still = useReducedMotion()
  const st = STATUS[status] ?? { label: status.replaceAll('_', ' '), tone: 'calm', Icon: Check }
  const body = <>
    <div className="pa-card-media"><img src={image} alt="" loading="lazy" /><span className={'pa-badge tone-' + st.tone}><st.Icon size={12} />{st.label}</span></div>
    <div className="pa-card-body"><h3>{name}</h3><p>{owner || 'Your belonging'}</p><small>{code}</small></div>
  </>
  return <motion.article className="pa-card" initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.5, ease }} whileHover={still ? undefined : { y: -4 }}>
    {to ? <Link to={to} className="pa-card-link">{body}</Link> : body}
  </motion.article>
}

/** A shop product with a badge, price and one-tap add to bag. */
export function ProductCard({ id, name, subtitle, priceMinor, image, badge, to, index = 0 }: { id: string; name: string; subtitle: string; priceMinor: number; image: string; badge?: string; to: string; index?: number }) {
  const still = useReducedMotion()
  const qty = useServerCart(s => s.lines[id] ?? 0), change = useServerCart(s => s.change)
  const [added, setAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  function add() { change(id, qty + 1); setAdded(true); notify(`${name} added to your bag`); clearTimeout(timer.current); timer.current = window.setTimeout(() => setAdded(false), 1400); try { navigator.vibrate?.(10) } catch { /* no haptics */ } }
  return <motion.article className="pa-card pa-product" initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.5, ease }} whileHover={still ? undefined : { y: -4 }}>
    <Link to={to} className="pa-card-link">
      <div className="pa-card-media"><img src={image} alt="" loading="lazy" />{badge && <span className={'pa-badge ' + (badge === 'New' ? 'tone-night' : 'tone-pop')}>{badge}</span>}</div>
      <div className="pa-card-body"><h3>{name}</h3><p>{subtitle}</p><strong>KSh {(priceMinor / 100).toLocaleString('en-KE')}</strong></div>
    </Link>
    <motion.button type="button" whileTap={{ scale: 0.86 }} className={cx('pa-card-action', added && 'is-done')} onClick={add} aria-label={`Add ${name} to bag`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={added ? 'ok' : 'bag'} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.18 }}>{added ? <Check size={17} /> : <ShoppingBag size={17} />}</motion.span>
      </AnimatePresence>
      {qty > 0 && <b>{qty}</b>}
    </motion.button>
  </motion.article>
}

/** Section title with an optional "see all" link. */
export function SectionHead({ title, to, action = 'See all', children }: { title: string; to?: string; action?: string; children?: ReactNode }) {
  return <div className="pa-section-head"><h2>{title}</h2>{children}{to && <Link to={to}>{action} <ArrowRight size={14} /></Link>}</div>
}
