import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Activity } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { EVENT_LABEL } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { Note } from '@/components/ui/Tile'
import { fmtRelative, cx } from '@/lib/util'
import { caseTitle } from './Queue'

/** Staff notifications plus a cross-case actor/action feed. */
export function ActivityFeed() {
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState('alerts')
  const alerts = state.notifications.filter((n) => n.toPersonId === person.id).sort((a, b) => Number(a.read) - Number(b.read) || b.at.localeCompare(a.at))
  const unread = alerts.filter((n) => !n.read).length
  const events = useMemo(() => state.cases.flatMap((c) => c.events.map((e) => ({ ...e, caseId: c.id, ref: c.ref, title: caseTitle(c, state.items) }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60), [state.cases, state.items])
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity" lede={unread ? `${unread} unread alert${unread === 1 ? '' : 's'}.` : 'All alerts read.'} compact actions={unread > 0 && <Button variant="secondary" size="sm" icon={<CheckCheck className="h-4 w-4" />} onClick={() => state.markAllRead()}>Mark all read</Button>} />
      <Tabs ariaLabel="Activity" value={tab} onChange={setTab} tabs={[{ id: 'alerts', label: 'Alerts', count: unread }, { id: 'feed', label: 'All case events' }]} className="mb-4" />
      {tab === 'alerts' ? (
        alerts.length ? (
          <ul className="flex flex-col gap-2">{alerts.map((n, i) => (
            <li key={n.id} className="fb-enter" style={{ ['--i' as string]: i }}>
              <button type="button" onClick={() => { state.markRead(n.id); if (n.caseId) nav(`/manage/cases/${n.caseId}`) }} className={cx('fb-tile fb-press flex w-full items-start gap-3 p-3 text-left hover:bg-paper-2', !n.read && '!border-teal-300 bg-teal-50/40')}>
                <Bell className={cx('mt-0.5 h-4 w-4 shrink-0', n.read ? 'text-ink-4' : 'text-teal-700')} />
                <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className={cx('truncate', n.read ? 'font-medium text-ink-2' : 'font-semibold text-ink')}>{n.title}</span><time className="shrink-0 text-[0.72rem] text-ink-4">{fmtRelative(n.at)}</time></span><span className="block text-[0.85rem] text-ink-3">{n.body}</span></span>
              </button>
            </li>
          ))}</ul>
        ) : <EmptyState icon={<Bell className="h-5 w-5" />} title="No alerts" body="New reports, claims and reminders will appear here." />
      ) : (
        <ol className="divide-y divide-line rounded-md border border-line bg-paper">
          {events.map((e) => {
            const actor = e.actorId === 'system' ? 'FindBox' : state.people.find((p) => p.id === e.actorId)?.name ?? 'Unknown'
            return (
              <li key={e.id}><button type="button" onClick={() => nav(`/manage/cases/${e.caseId}`)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-[0.85rem] hover:bg-paper-2"><Activity className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-4" /><span className="min-w-0 flex-1"><span className="font-medium text-ink">{EVENT_LABEL[e.type]}</span><span className="text-ink-3"> · {actor} · <span className="font-mono">{e.ref}</span> {e.title}</span>{e.note && <span className="block text-[0.78rem] text-ink-3">{e.note}</span>}</span><time className="shrink-0 text-[0.72rem] text-ink-4">{fmtRelative(e.at)}</time></button></li>
            )
          })}
        </ol>
      )}
      <Note tone="demo" className="mt-6">Activity shows the latest updates to school records.</Note>
    </div>
  )
}
