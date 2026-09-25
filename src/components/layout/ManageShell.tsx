import { LayoutList, ScanLine, PackagePlus, Images, BarChart3, Settings2, Activity } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { WorkspaceShell, type WorkspaceLink } from './WorkspaceShell'
export function ManageShell() {
  const person = usePerson()
  const cases = useStore(s => s.cases)
  if (!person) return null
  const isManager = person.role === 'manager'
  const openCount = cases.filter(c => !['returned', 'closed'].includes(c.status)).length
  const links: WorkspaceLink[] = [
    { to: '/manage', label: 'Queue', icon: LayoutList, end: true, badge: openCount },
    ...(!isManager ? [{ to: '/manage/scan', label: 'Scan tag', icon: ScanLine }] : []),
    { to: '/manage/gallery', label: 'Gallery', icon: Images },
    ...(isManager ? [{ to: '/manage/dashboard', label: 'Dashboard', icon: BarChart3 }, { to: '/manage/settings', label: 'Configuration', icon: Settings2 }] : []),
    { to: '/manage/activity', label: 'Activity', icon: Activity },
  ]
  return <WorkspaceShell links={links} primary={!isManager ? { to: '/manage/log', label: 'Log found', icon: PackagePlus } : undefined} />
}
