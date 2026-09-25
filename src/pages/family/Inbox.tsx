import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Sparkles, Info, MapPin } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Note } from '@/components/ui/Tile'
import { DiscoveryRing } from '@/components/brand/Logo'
import { fmtRelative, cx } from '@/lib/util'
import type { Notification } from '@/domain/types'

export function Inbox() {
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const list = state.notifications.filter((n) => n.toPersonId === person.id).sort((a, b) => Number(a.read) - Number(b.read) || b.at.localeCompare(a.at))
  const unread = list.filter((n) => !n.read).length
  const open = (n: Notification) => {
    state.markRead(n.id)
    if (n.caseId && state.cases.some((c) => c.id === n.caseId)) nav(person.role === 'student' || person.role === 'parent' ? `/app/cases/${n.caseId}` : `/manage/cases/${n.caseId}`)
    else if (n.itemId) nav(`/app/items/${n.itemId}`)
  }
  const icon = (n: Notification) => n.kind === 'reward' ? <Sparkles className="h-5 w-5 text-teal-600" /> : n.kind === 'action' ? <MapPin className="h-5 w-5 text-teal-700" /> : n.kind === 'update' ? <DiscoveryRing size={26} className="text-teal-700" active={!n.read} /> : <Info className="h-5 w-5 text-ink-3" />
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Inbox" lede={unread ? `${unread} unread.` : 'You are up to date.'} compact actions={unread > 0 && <Button variant="secondary" size="sm" icon={<CheckCheck className="h-4 w-4" />} onClick={() => state.markAllRead()}>Mark all read</Button>} />
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((n, i) => (
            <li key={n.id} className="fb-enter" style={{ ['--i' as string]: i }}>
              <button type="button" onClick={() => open(n)} className={cx('fb-tile fb-press flex w-full items-start gap-3 p-3 text-left hover:bg-paper-2', !n.read && '!border-teal-300 bg-teal-50/40')}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">{icon(n)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2"><span className={cx('truncate', n.read ? 'font-medium text-ink-2' : 'font-semibold text-ink')}>{n.title}</span><time dateTime={n.at} className="shrink-0 text-[0.72rem] text-ink-4">{fmtRelative(n.at)}</time></span>
                  <span className="mt-0.5 block text-[0.85rem] text-ink-3">{n.body}</span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-600" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Bell className="h-5 w-5" />} title="No messages yet" body="Updates about lost, found, matched and returned items appear here." />}
      <Note tone="demo" className="mt-6">Your school updates appear here. Open a notification to see the next step.</Note>
    </div>
  )
}
