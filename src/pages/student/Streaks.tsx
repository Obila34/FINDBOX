import { useEffect, useState } from 'react'
import { Flame, Check, ArrowUpRight, Info, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePerson } from '@/store/useStore'
import { useStreaks } from '@/store/useStreaks'
import { dayKey, dayOffset, streakStats } from '@/domain/streaks'
import { ExplorerExperience } from '@/components/scene/ExplorerExperience'
import { PageHeader } from '@/components/ui/PageHeader'
const EMPTY: string[] = []
export function Streaks() {
  const person = usePerson()!
  const days = useStreaks(s => s.accounts[person.id] ?? EMPTY)
  const checkIn = useStreaks(s => s.checkIn)
  const [today, setToday] = useState(dayKey()); const [info, setInfo] = useState(false)
  useEffect(() => { const id = setInterval(() => setToday(dayKey()), 30000); return () => clearInterval(id) }, [])
  const stats = streakStats(days, today)
  const next = [7, 14, 30, 60, 100, 365].find(n => n > stats.current) ?? (Math.floor(stats.current / 100) + 1) * 100
  return <div className="fb-streak-page"><PageHeader eyebrow="A LITTLE BETTER, EVERY DAY" title="Your streak" lede="Small habits. Good days. Keep showing up for the things that matter." compact />
    <div className="fb-streak-layout"><section className="fb-streak-card" aria-label="Day streak"><div className="fb-streak-top"><span>DAY STREAK</span><button aria-label="How streaks work" aria-expanded={info} onClick={() => setInfo(!info)}><Info size={19} /></button></div>
      <div className="fb-streak-flame" aria-hidden="true"><Flame /><Flame /></div><strong className="fb-streak-number">{stats.current}</strong><p className="fb-streak-label">{stats.current === 1 ? 'DAY' : 'DAYS'} & COUNTING</p>
      <div className="fb-streak-stats"><div><strong>{stats.started ? new Date(stats.started + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Today?'}</strong><span>Streak started</span></div><div><Trophy size={18} /><span>Personal progress</span></div><div><strong>{stats.best}</strong><span>Best streak</span></div></div>
      {info && <p className="fb-streak-info">Check in after reviewing your belongings each day. One check-in counts per calendar day on this device. Missing a full day starts a new streak; your personal best stays. No rankings or penalties.</p>}
      <div className="fb-streak-week"><p>YOUR LAST SEVEN DAYS</p><div>{Array.from({ length: 7 }, (_, i) => dayOffset(today, i - 6)).map(d => <div key={d}><span>{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</span><span className={days.includes(d) ? 'is-lit' : 'is-empty'}>{days.includes(d) ? <Flame size={22} /> : '·'}</span></div>)}</div></div>
      <div className="fb-streak-milestone"><Flame size={32} /><div><p>{next - stats.current} more {next - stats.current === 1 ? 'day' : 'days'} to your next milestone</p><progress value={stats.current} max={next} aria-label={`Progress to ${next} days`} /><span>{next}-day milestone</span></div><strong>{next}</strong></div>
      <button className="fb-streak-checkin" disabled={stats.checked} onClick={() => checkIn(person.id)}>{stats.checked ? <><Check size={18} /> You showed up today</> : <><Flame size={18} /> I checked my belongings today</>}</button><p className="fb-streak-note" role="status">{stats.checked ? 'See you tomorrow. Your streak is saved.' : 'A quick check. A little peace of mind.'}</p>
    </section><div className="fb-streak-companion"><ExplorerExperience key={person.id} personId={person.id} /><div className="fb-streak-next"><span>MAKE TODAY COUNT</span><h2>Your everyday,<br />a little more organised.</h2><Link to="/app/items">Review your belongings <ArrowUpRight size={18} /></Link><Link to="/app/register">Tag something new <ArrowUpRight size={18} /></Link><Link to="/app/gallery">Help something home <ArrowUpRight size={18} /></Link></div></div></div>
  </div>
}
