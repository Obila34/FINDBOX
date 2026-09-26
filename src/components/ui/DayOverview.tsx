import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
export function DayOverview({ teacher = false }: { teacher?: boolean }) {
  return <section className="fb-day-overview"><div><p className="fb-kicker">{teacher ? 'YOUR SCHOOL, CONNECTED' : 'MORE PEACE OF MIND'}</p><h2>{teacher ? <>A little care.<br />A lot more found.</> : <>Good things.<br />Safely connected.</>}</h2><Link className="fb-black-link" to={teacher ? '/manage/scan' : '/app/items'}>{teacher ? 'Scan a belonging' : 'Your family’s belongings'}<ArrowUpRight size={17} /></Link></div><img src={teacher ? '/media/products/airtag-1024.webp' : '/media/products/bottle-1024.webp'} alt={teacher ? 'Keyring tracker' : 'Clear bottle with a FindBox tag'} /></section>
}
