import { Link, NavLink, useLocation } from 'react-router-dom'
import { Search, ShoppingBag } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ProfileMenu } from '@/components/layout/ProfileMenu'
import { useServerCart } from '@/commerce/serverCart'
import { useCommerce } from '@/commerce/store'
import { cx } from '@/lib/util'
import '@/styles/cinema.css'

export type NavItem = { label: string; to: string }

/** The public site's sections. Same five everywhere, in the same order. */
export const SITE_LINKS: NavItem[] = [
  { label: 'Our story', to: '/#about' },
  { label: 'How it works', to: '/#how-it-works' },
  { label: 'Schools', to: '/schools' },
  { label: 'Shop', to: '/shop' },
  { label: 'Contact', to: '/#contact' },
]

/** Signed-in sections, mirroring the phone dock. */
export function appLinks(role: string): NavItem[] {
  return role === 'student'
    ? [{ label: 'Home', to: '/app/home' }, { label: 'My items', to: '/app/items' }, { label: 'Found', to: '/app/found' }, { label: 'Streaks', to: '/app/streaks' }, { label: 'Inbox', to: '/app/inbox' }]
    : role === 'staff' || role === 'manager'
      ? [{ label: 'Queue', to: '/manage' }, { label: 'Receive', to: '/manage/log' }, { label: 'Hand back', to: '/manage/collect' }, { label: 'Inbox', to: '/app/inbox' }, ...(role === 'manager' ? [{ label: 'School', to: '/app/school-admin' }] : [])]
      : [{ label: 'Home', to: '/app/home' }, { label: 'Items', to: '/app/items' }, { label: 'Activate', to: '/app/register' }, { label: 'Shop', to: '/app/shop' }, { label: 'Inbox', to: '/app/inbox' }]
}

function useCartCount() {
  const preview = useCommerce(s => s.cart)
  const server = useServerCart(s => s.lines)
  const cart = import.meta.env.VITE_SERVER_MODE === 'true' ? server : preview
  return Object.values(cart).reduce((a, b) => a + b, 0)
}

/** The black pill of links that hangs from the top edge. */
export function NavPill({ links = SITE_LINKS, className }: { links?: NavItem[]; className?: string }) {
  const { pathname, hash } = useLocation()
  return <nav aria-label="Main" className={cx('fb-nav-pill fb-dark-scope rounded-b-2xl bg-black px-4 py-2 md:rounded-b-3xl md:px-8 md:py-3', className)}>
    <ul className="flex items-center gap-3 whitespace-nowrap text-[10px] sm:gap-6 sm:text-xs md:gap-10 md:text-sm lg:gap-14">
      {links.map(n => {
        const [path, anchor] = n.to.split('#')
        const active = anchor ? pathname === (path || '/') && hash === '#' + anchor : pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to + '/'))
        return <li key={n.label}>
          {anchor ? <Link to={n.to} className={cx('cinema-link', active && 'is-current')} aria-current={active ? 'page' : undefined}>{n.label}</Link>
            : <NavLink to={n.to} className={cx('cinema-link', active && 'is-current')} aria-current={active ? 'page' : undefined}>{n.label}</NavLink>}
        </li>
      })}
    </ul>
  </nav>
}

/**
 * One navigation bar for every page: logo on the left, the hanging black pill of links in the centre,
 * and theme, bag and account on the right. `overlay` sits on top of a photo (landing, sign-in);
 * the default is a sticky bar for ordinary pages. Signed-in pages pass `user` to show app sections.
 */
export function SiteNav({ overlay = false, user, links, cart = !user, homeTo }: { overlay?: boolean; user?: { name: string; role: string } | null; links?: NavItem[]; cart?: boolean; homeTo?: string }) {
  const count = useCartCount()
  const items = links ?? (user ? appLinks(user.role) : SITE_LINKS)
  const shop = user ? '/app/shop' : '/shop'
  return <header className={cx('fb-site-nav', overlay ? 'is-overlay fb-dark-scope' : 'is-bar')}>
    <NavPill links={items} className={cx(user && 'fb-nav-pill-app')} />
    <div className="fb-site-nav-row">
      <Link to={homeTo ?? (user ? (user.role === 'staff' ? '/manage' : '/app/home') : '/')} aria-label="FindBox home" className="fb-nav-logo"><Logo height={18} /></Link>
      <div className="fb-nav-actions">
        {user && !['staff', 'manager'].includes(user.role) && <Link to="/app/items?search=1" className="fb-nav-round" aria-label="Search your belongings"><Search size={16} /></Link>}
        <ThemeToggle className="h-8 w-8 md:h-9 md:w-9" />
        {cart && <Link to={shop + '/cart'} className="fb-nav-round" aria-label={`Shopping bag, ${count} items`}><ShoppingBag size={16} />{count > 0 && <span className="fb-nav-badge">{count}</span>}</Link>}
        {user ? <ProfileMenu name={user.name} role={user.role} /> : <Link to="/app/sign-in" data-auth-bypass className="fb-nav-signin">Sign in</Link>}
      </div>
    </div>
  </header>
}
