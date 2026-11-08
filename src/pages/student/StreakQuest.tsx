import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Backpack, Check, Droplets, Flame, Lock, Shirt, Sparkles, Trophy, Zap } from 'lucide-react'
import { cx } from '@/lib/util'
import './streak-quest.css'

const LEVELS = [0, 50, 120, 220, 350, 520, 750, 1000, 1400, 1900]
const TITLES = ['New finder', 'Tag rookie', 'Bag keeper', 'Bottle boss', 'Locker legend', 'Lost-and-found hero', 'Return ranger', 'Belongings master', 'FindBox champion', 'FindBox legend']
const MISSIONS = [
  { id: 'bag', label: 'My bag is packed and with me', Icon: Backpack },
  { id: 'bottle', label: 'Bottle and lunchbox are coming home', Icon: Droplets },
  { id: 'uniform', label: 'Sweater or blazer is on me or in my bag', Icon: Shirt },
]
const BADGES = [
  { id: 'first', title: 'First spark', hint: 'Check in once', need: (s: Stats) => s.total >= 1 },
  { id: 'three', title: 'Hat-trick', hint: '3-day streak', need: (s: Stats) => s.best >= 3 },
  { id: 'week', title: 'Week warrior', hint: '7-day streak', need: (s: Stats) => s.best >= 7 },
  { id: 'fortnight', title: 'Fortnight focus', hint: '14-day streak', need: (s: Stats) => s.best >= 14 },
  { id: 'month', title: 'Month master', hint: '30-day streak', need: (s: Stats) => s.best >= 30 },
  { id: 'fifty', title: 'Half century', hint: '50 check-ins', need: (s: Stats) => s.total >= 50 },
  { id: 'weekend', title: 'Weekend keeper', hint: 'Check in on a weekend', need: (s: Stats) => s.weekend },
  { id: 'hundred', title: 'Centurion', hint: '100 check-ins', need: (s: Stats) => s.total >= 100 },
]
type Stats = { current: number; best: number; total: number; xp: number; weekend: boolean; checkedToday: boolean }

const dayMs = 864e5
const toDate = (d: string) => new Date(d + 'T12:00:00Z')
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

function computeStats(days: string[], today: string): Stats {
  const set = new Set(days), sorted = [...set].sort()
  let best = 0, run = 0, xp = 0, prev = 0, weekend = false
  for (const d of sorted) {
    const t = toDate(d).getTime()
    run = prev && t - prev === dayMs ? run + 1 : 1
    best = Math.max(best, run); prev = t
    xp += 10 + Math.min(run, 7) * 2
    const wd = toDate(d).getUTCDay(); if (wd === 0 || wd === 6) weekend = true
  }
  const checkedToday = set.has(today)
  let current = 0, cursor = toDate(today).getTime() - (checkedToday ? 0 : dayMs)
  while (set.has(iso(cursor))) { current++; cursor -= dayMs }
  return { current, best, total: set.size, xp, weekend, checkedToday }
}
function levelOf(xp: number) {
  let i = 0; while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1]!) i++
  const floor = LEVELS[i]!, ceil = LEVELS[i + 1] ?? floor + 600
  return { level: i + 1, title: TITLES[i]!, progress: (xp - floor) / (ceil - floor), toNext: ceil - xp }
}

function Counter({ value }: { value: number }) {
  const mv = useMotionValue(0), rounded = useTransform(mv, v => Math.round(v))
  const [shown, setShown] = useState(0)
  useEffect(() => { const c = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] }); const u = rounded.on('change', setShown); return () => { c.stop(); u() } }, [value, mv, rounded])
  return <>{shown}</>
}

function Burst() {
  const bits = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2 + Math.random() * 0.3, d: 70 + Math.random() * 90, c: ['#e7ecde', '#aebe9e', '#f3b27a', '#657b56', '#9cc6e4'][i % 5], s: 5 + Math.random() * 6 })), [])
  return <div className="sq-burst" aria-hidden="true">{bits.map((b, i) => <motion.span key={i} style={{ background: b.c, width: b.s, height: b.s }}
    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d, opacity: 0, scale: 0.4, rotate: 180 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />)}</div>
}

export function StreakQuest({ personId, days, today, onCheckIn, busy = false, error = '', embedded = false }: { personId: string; days: string[]; today: string; onCheckIn: () => Promise<void> | void; busy?: boolean; error?: string; embedded?: boolean }) {
  const still = useReducedMotion()
  const stats = useMemo(() => computeStats(days, today), [days, today])
  const lvl = levelOf(stats.xp)
  const key = `fb-mission-${personId}-${today}`
  const [ticks, setTicks] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } })
  const [celebrate, setCelebrate] = useState(0)
  const [gain, setGain] = useState(0)
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(ticks)) } catch {} }, [key, ticks])
  const missionDone = MISSIONS.every(m => ticks.includes(m.id))
  const set = new Set(days)
  const week = Array.from({ length: 7 }, (_, i) => iso(toDate(today).getTime() - (6 - i) * dayMs))
  const month = Array.from({ length: 35 }, (_, i) => iso(toDate(today).getTime() - (34 - i) * dayMs))
  const flame = Math.min(1.15, 0.8 + stats.current / 25)

  async function check() {
    const before = stats.xp
    await onCheckIn()
    const after = computeStats([...days, today], today).xp
    setGain(after - before); setCelebrate(c => c + 1)
    try { navigator.vibrate?.([12, 40, 18]) } catch { /* no haptics on this device */ }
  }

  return <section className={cx('sq', embedded && 'is-embedded')} aria-label="Daily streak">
    <div className="sq-hero">
      <div className="sq-flame-wrap">
        <motion.div className="sq-flame" style={{ scale: flame }} animate={still ? undefined : { y: [0, -4, 0], rotate: [-2, 2, -2] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
          <Flame size={96} strokeWidth={1.4} />
        </motion.div>
        <AnimatePresence>{celebrate > 0 && <Burst key={celebrate} />}</AnimatePresence>
        <AnimatePresence>{gain > 0 && <motion.span key={'g' + celebrate} className="sq-gain" initial={{ y: 0, opacity: 0 }} animate={{ y: -50, opacity: [0, 1, 0] }} transition={{ duration: 1.6 }} onAnimationComplete={() => setGain(0)}>+{gain} XP</motion.span>}</AnimatePresence>
      </div>
      <div className="sq-count">
        <strong><Counter value={stats.current} /></strong>
        <span>day{stats.current === 1 ? '' : 's'} in a row</span>
      </div>
      <div className="sq-level">
        <div className="sq-level-top"><span><Zap size={14} />Level {lvl.level} · {lvl.title}</span><span>{stats.xp} XP</span></div>
        <div className="sq-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(4, lvl.progress * 100)}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} /></div>
        <small>{lvl.toNext} XP to level {lvl.level + 1}</small>
      </div>
      <div className="sq-week">
        {week.map(d => { const on = set.has(d), isToday = d === today; return <div key={d} className={cx('sq-day', on && 'is-on', isToday && 'is-today')}>
          <span>{toDate(d).toLocaleDateString('en-KE', { weekday: 'narrow', timeZone: 'UTC' })}</span>
          <motion.i initial={false} animate={{ scale: on ? 1 : 0.85 }}>{on ? <Flame size={14} /> : null}</motion.i>
        </div> })}
      </div>
    </div>

    <div className="sq-mission">
      <div className="sq-head"><h3>Today’s mission</h3><span>{stats.checkedToday ? 'Complete' : `${ticks.length}/${MISSIONS.length}`}</span></div>
      <ul>
        {MISSIONS.map(({ id, label, Icon }) => { const on = stats.checkedToday || ticks.includes(id); return <li key={id}>
          <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={stats.checkedToday} aria-pressed={on} className={cx(on && 'is-on')} onClick={() => setTicks(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]))}>
            <span className="sq-tick">{on ? <Check size={15} /> : <Icon size={15} />}</span>{label}
          </motion.button>
        </li> })}
      </ul>
      <motion.button type="button" className="fp-primary sq-go" whileTap={{ scale: 0.96 }} disabled={busy || stats.checkedToday || !missionDone} onClick={() => void check()}>
        {stats.checkedToday ? <><Check size={17} />Checked in today. See you tomorrow</> : busy ? 'Checking in…' : missionDone ? <><Flame size={17} />Check in and keep the streak</> : 'Tick all three to check in'}
      </motion.button>
      {error && <p role="alert" className="sq-error">{error}</p>}
    </div>

    {!embedded && <>
      <div className="sq-stats">
        <div><Trophy size={16} /><strong>{stats.best}</strong><span>Best streak</span></div>
        <div><Sparkles size={16} /><strong>{stats.total}</strong><span>Check-ins</span></div>
        <div><Zap size={16} /><strong>{lvl.level}</strong><span>Level</span></div>
      </div>
      <div className="sq-panel">
        <div className="sq-head"><h3>Last five weeks</h3><span>{month.filter(d => set.has(d)).length} days</span></div>
        <div className="sq-grid">{month.map((d, i) => <motion.i key={d} title={d} className={cx(set.has(d) && 'is-on', d === today && 'is-today')} initial={still ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.012 }} />)}</div>
      </div>
      <div className="sq-panel">
        <div className="sq-head"><h3>Badges</h3><span>{BADGES.filter(b => b.need(stats)).length}/{BADGES.length}</span></div>
        <div className="sq-badges">{BADGES.map((b, i) => { const won = b.need(stats); return <motion.div key={b.id} className={cx('sq-badge', won && 'is-won')} initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} whileHover={won && !still ? { rotate: [0, -6, 6, 0], transition: { duration: 0.5 } } : undefined}>
          <span>{won ? <Trophy size={18} /> : <Lock size={16} />}</span><strong>{b.title}</strong><small>{b.hint}</small>
        </motion.div> })}</div>
      </div>
    </>}
  </section>
}
