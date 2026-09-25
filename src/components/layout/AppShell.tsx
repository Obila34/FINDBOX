import { useLocation } from 'react-router-dom'
import { Home, Boxes, Search, Flame, Inbox, Plus, HandHelping } from 'lucide-react'
import { usePerson, useStore, useUnread } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { WorkspaceShell, type WorkspaceLink } from './WorkspaceShell'

export function AppShell() {
  const person = usePerson()
  const school = useStore(s => s.school)
  const unread = useUnread(person?.id)
  const location = useLocation()
  if (!person) return null
  const caps = capabilities(person, school)
  const isStudent = person.role === 'student'
  const links: WorkspaceLink[] = [
    { to: '/app/home', label: 'Home', icon: Home },
    { to: '/app/items', label: isStudent ? 'Inventory' : 'Items', icon: Boxes },
    isStudent && caps.has('report_found') ? { to: '/app/found', label: 'Found', icon: HandHelping } : { to: '/app/gallery', label: 'Gallery', icon: Search },
    ...(isStudent ? [{ to: '/app/streaks', label: 'Streaks', icon: Flame }] : []),
    { to: '/app/inbox', label: 'Inbox', icon: Inbox, badge: unread },
  ]
  const primary = caps.has('register_item') ? { to: '/app/register', label: 'Register item', icon: Plus } : caps.has('report_found') ? { to: '/app/found', label: 'Found something', icon: HandHelping } : null
  const hideBottomNav = /\/app\/(register|report|found|gallery\/.+\/claim)/.test(location.pathname)
  return <WorkspaceShell links={links} primary={primary} family hideBottomNav={hideBottomNav} />
}
