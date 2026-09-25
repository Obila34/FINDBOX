import type { CaseEvent, Person } from '@/domain/types'
import { EVENT_LABEL } from '@/domain/labels'
import { fmtDateTime, cx } from '@/lib/util'
import { Mark } from '@/components/brand/Logo'

const OWNER_SAFE_ACTOR = (p: Person | undefined, staffView: boolean) => {
  if (!p) return 'FindBox'
  if (p.role === 'staff' || p.role === 'manager') return staffView ? p.name : 'Lost Property staff'
  return staffView ? p.name : p.firstName
}

/** Actor/action history. Owner view hides staff-only events and staff identities. */
export function Timeline({ events, people, staffView = false, highlightLast = false, className }: { events: CaseEvent[]; people: Person[]; staffView?: boolean; highlightLast?: boolean; className?: string }) {
  const visible = events.filter((e) => staffView || e.visibility === 'owner')
  if (!visible.length) return <p className="text-[0.85rem] text-ink-3">No activity yet.</p>
  return (
    <ol className={cx('relative ml-2 border-l border-line-strong', className)} aria-label="Case history">
      {visible.map((e, i) => {
        const last = i === visible.length - 1
        const actor = e.actorId === 'system' ? undefined : people.find((p) => p.id === e.actorId)
        const isDiscovery = ['found_logged', 'match_confirmed', 'claim_verified'].includes(e.type)
        return (
          <li key={e.id} className="relative pl-6 pb-5 last:pb-0">
            <span className={cx('absolute -left-[7px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-paper', last ? 'border-teal-600' : 'border-line-strong')} aria-hidden="true">
              {last && highlightLast && isDiscovery && <span className="absolute inset-[-6px] rounded-full border border-teal-300 fb-pulse-ring" />}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className={cx('text-[0.9rem] font-medium', last ? 'text-ink' : 'text-ink-2')}>{EVENT_LABEL[e.type]}</p>
              <time dateTime={e.at} className="text-[0.75rem] tabular-nums text-ink-4">{fmtDateTime(e.at)}</time>
            </div>
            <p className="text-[0.8rem] text-ink-3">
              {e.actorId === 'system' ? <span className="inline-flex items-center gap-1"><Mark size={12} /> FindBox</span> : OWNER_SAFE_ACTOR(actor, staffView)}
              {e.note && <span> · {e.note}</span>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
