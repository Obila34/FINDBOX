import { Link } from 'react-router-dom'
import { Flame, ArrowUpRight } from 'lucide-react'
import { usePerson } from '@/store/useStore'
import { useStreaks } from '@/store/useStreaks'
import { streakStats } from '@/domain/streaks'
const EMPTY: string[] = []
export function StreakSummary() {
  const person = usePerson()!; const days = useStreaks(s => s.accounts[person.id] ?? EMPTY); const stats = streakStats(days)
  return <Link to="/app/streaks" className="fb-streak-summary"><span className="fb-streak-summary-icon"><Flame size={36} /></span><div><span>YOUR DAILY RHYTHM</span><h2>{stats.current ? `${stats.current}-day streak. Keep it going.` : 'Your first good day starts here.'}</h2><p>{stats.checked ? 'Checked in today. See you tomorrow.' : 'Check your belongings. Start a little habit.'}</p></div><ArrowUpRight size={22} /></Link>
}
