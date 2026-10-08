import { useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LockKeyhole, UserPlus } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { useSession } from '@/store/useStore'

function needsAccount(path: string) {
  return path.startsWith('/shop') || path.startsWith('/app/') || path === '/app' || path.startsWith('/refer')
}

function destinationName(path: string) {
  if (path.startsWith('/refer')) return 'refer your school'
  if (path.includes('/cart')) return 'open your bag'
  if (path.includes('/account')) return 'view your tags and orders'
  if (path.startsWith('/shop')) return 'shop FindBox labels'
  return 'open the FindBox app'
}

export function LandingAuthGate({ children }: { children: ReactNode }) {
  const session = useSession()
  const [destination, setDestination] = useState<string | null>(null)
  const resume = destination === '/app/sign-in' || destination === '/app/sign-up' ? '/app/home' : destination || '/app/home'

  function intercept(event: MouseEvent<HTMLDivElement>) {
    if (session || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = event.target as Element
    const protectedButton = target.closest<HTMLButtonElement>('button[data-protected-destination]')
    const anchor = target.closest<HTMLAnchorElement>('a[href]')
    if (protectedButton) {
      event.preventDefault()
      event.stopPropagation()
      setDestination(protectedButton.dataset.protectedDestination || '/app/home')
      return
    }
    if (!anchor || anchor.hasAttribute('data-auth-bypass') || anchor.target === '_blank') return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || !needsAccount(url.pathname)) return
    event.preventDefault()
    setDestination(url.pathname + url.search + url.hash)
  }

  return <div onClickCapture={intercept}>
    {children}
    <Sheet open={Boolean(destination)} onClose={() => setDestination(null)} title="Your FindBox account" description={`Log in or create an account to ${destinationName(destination || '')}.`}>
      <div className="fb-auth-gate-copy">
        <span><LockKeyhole size={20} /></span>
        <div><h3>Keep every label connected to the right person.</h3><p>Your account protects orders, registered belongings and school referrals, then brings you back to exactly where you were going.</p></div>
      </div>
      <div className="fb-auth-gate-actions">
        <Link data-auth-bypass to="/app/sign-in" state={{ from: resume }} onClick={() => setDestination(null)}>Log in <ArrowRight size={17} /></Link>
        <Link data-auth-bypass to="/app/sign-up" state={{ from: resume }} onClick={() => setDestination(null)}><UserPlus size={17} /> Create account</Link>
      </div>
      <button className="fb-auth-gate-cancel" type="button" onClick={() => setDestination(null)}>Not now</button>
    </Sheet>
  </div>
}
