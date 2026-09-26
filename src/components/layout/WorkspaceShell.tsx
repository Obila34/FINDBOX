import { useCallback, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, ArrowUpRight, LogOut, WifiOff, type LucideIcon } from 'lucide-react'
import { StudioBrand } from '@/components/brand/StudioBrand'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { LiveClock } from '@/components/ui/LiveClock'
import { usePerson, useStore } from '@/store/useStore'
import { useOnline } from '@/lib/hooks'
import { ROLE_LABEL } from '@/domain/labels'
import { cx } from '@/lib/util'

export interface WorkspaceLink { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number }
export function WorkspaceShell({ links, primary, family = false, hideBottomNav = false }: { links: WorkspaceLink[]; primary?: WorkspaceLink | null; family?: boolean; hideBottomNav?: boolean }) {
  const person = usePerson()
  const school = useStore(s => s.school)
  const signOut = useStore(s => s.signOut)
  const online = useOnline()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const closeMenu = useCallback(() => setMenu(false), [])
  if (!person) return null
  const home = family ? '/app/home' : '/manage'
  const exit = () => { signOut(); nav(family ? '/app/welcome' : '/app/invite') }
  const navLink = (l: WorkspaceLink, mobile = false) => <NavLink key={l.to} to={l.to} end={l.end} onClick={closeMenu} className={({ isActive }) => cx(mobile ? 'fb-workspace-mobile-link' : 'fb-workspace-link', isActive && 'is-active')}>
    {mobile ? <><span className="fb-dock-icon"><l.icon size={21} strokeWidth={1.35} aria-hidden="true" /></span><span className="sr-only">{l.label}</span>{!!l.badge && <span className="fb-dock-badge" aria-label={`${l.badge} updates`}>{l.badge}</span>}</> : <><l.icon size={16} aria-hidden="true" /><span>{l.label}</span>{!!l.badge && <span className="fb-nav-count">{l.badge}</span>}</>}
  </NavLink>
  return <div className={cx('fb-workspace fb-unified-app', !hideBottomNav && 'fb-has-bottom-nav')}>
    <a href="#main" className="fb-skip">Skip to content</a>
    <header className="fb-workspace-header"><div className="fb-pill-nav">
      <StudioBrand to={home} />
      <nav aria-label={family ? 'Primary' : 'Workspace'} className="fb-workspace-desktop-nav">{links.map(l => navLink(l))}</nav>
      <div className="fb-workspace-tools">
        {primary && <Button to={primary.to} size="sm" arrow className="hidden lg:inline-flex">{primary.label}</Button>}
        {family ? <NavLink to="/app/account" aria-label={'Account, ' + person.name} className="fb-account-button"><Avatar person={person} size={32} /></NavLink> : <button type="button" onClick={exit} className="fb-account-button" aria-label="Sign out"><LogOut size={18} /></button>}
        <button type="button" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)} className="fb-menu-toggle lg:hidden"><Menu size={17} /><span>Menu</span></button>
      </div>
    </div></header>
    <div className="fb-workspace-meta fb-container"><p><span className="fb-brand-dot" />{school.name}<span className="fb-meta-divider">/</span>{ROLE_LABEL[person.role]}</p><span className="hidden sm:inline"><LiveClock /></span></div>
    {!online && <div role="status" className="fb-container mb-5 flex items-center gap-2 text-[13px] text-ink-3"><WifiOff size={15} />You are offline. Changes save on this device only.</div>}
    <main id="main" className="fb-workspace-main fb-container"><Outlet /></main>
    <footer className="fb-workspace-footer fb-container"><span>A little less lost. A lot more found.</span><Logo height={18} /></footer>
    {!hideBottomNav && <nav aria-label="Mobile primary" className="fb-bottom-nav fb-safe-b">
      {links.slice(0, 2).map(l => navLink(l, true))}
      {primary && navLink(primary, true)}
      {links.slice(2).map(l => navLink(l, true))}
    </nav>}
    <Sheet open={menu} onClose={closeMenu} title="Your workspace" description={school.name}>
      <div className="mb-5 flex items-center gap-3"><Avatar person={person} size={42} /><div><p className="font-medium">{person.name}</p><p className="text-[13px] text-ink-3">{ROLE_LABEL[person.role]}</p></div></div>
      <nav aria-label="Workspace menu" className="fb-mobile-site-nav">{links.map(l => <NavLink key={l.to} to={l.to} end={l.end} onClick={closeMenu}>{l.label}<ArrowUpRight size={20} /></NavLink>)}</nav>
      {primary && <Button to={primary.to} full arrow className="mt-5">{primary.label}</Button>}
      <Button onClick={exit} variant="ghost" full icon={<LogOut size={16} />} className="mt-3">Sign out</Button>
    </Sheet>
  </div>
}
