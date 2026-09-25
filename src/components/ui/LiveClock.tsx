import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
const time = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' }).format(new Date())
export function LiveClock() {
  const [now, setNow] = useState(time)
  useEffect(() => { const timer = window.setInterval(() => setNow(time()), 1000); return () => window.clearInterval(timer) }, [])
  return <span className="fb-live-clock"><Clock size={14} aria-hidden="true" /><span>{now} in Nairobi</span></span>
}
