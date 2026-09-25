import { useParams } from 'react-router-dom'
import { MapPin, XCircle } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { casesFor } from '@/domain/transitions'
import { CASE_STATUS, CLAIM_STATUS, CATEGORY } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, InventorySlot, Note } from '@/components/ui/Tile'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { Timeline } from '@/components/ui/Timeline'
import { ItemArt } from '@/components/ui/ItemArt'
import { Button } from '@/components/ui/Button'
import { NotFound } from '@/pages/NotFound'
import { cx } from '@/lib/util'

/** Family-facing case: what is confirmed, what is pending, and exactly who acts next. */
export function CaseView() {
  const { id } = useParams()
  const person = usePerson()!
  const state = useStore()
  const c = casesFor(state, person).find((x) => x.id === id)
  if (!c) return <NotFound />
  const item = c.itemId ? state.items.find((i) => i.id === c.itemId) : undefined
  const r = c.foundRecord
  const st = CASE_STATUS[c.status]
  const myClaim = c.claims.find((cl) => cl.claimantId === person.id)
  const title = item?.name ?? r?.description ?? c.handover?.description ?? 'Case'
  const who: Record<string, { you: string; staff: string }> = {
    reported_lost: { you: 'Nothing more to do. Check the gallery if you like.', staff: 'Staff watch for a matching found item.' },
    potential_match: { you: 'Wait for staff to confirm.', staff: 'Staff compare the found item with your record.' },
    match_confirmed: { you: 'Wait for collection details.', staff: 'Staff choose a pickup location and time.' },
    awaiting_collection: { you: `Collect from ${c.pickupLocation}${c.pickupWindow ? `, ${c.pickupWindow}` : ''}. Bring case code ${c.ref}.`, staff: 'Staff verify ownership at pickup and record the return.' },
    returned: { you: 'Done. The history stays here.', staff: 'Nothing. Case closed.' },
    claim_submitted: { you: 'Nothing more to do yet.', staff: 'Staff review your claim against the item.' },
    claim_under_review: { you: 'Nothing more to do yet.', staff: 'Staff are checking now.' },
    claim_verified: { you: 'Wait for collection details.', staff: 'Staff choose a pickup location and time.' },
    handover_pending: { you: 'Hand the item to the Lost Property Office.', staff: 'Staff log it and confirm your handover.' },
    closed: { you: 'Nothing.', staff: 'Nothing.' },
    found_unregistered: { you: 'Your claim was not verified; the item is back in the gallery.', staff: 'Waiting for another claim.' },
  }
  const steps = c.kind === 'found_unregistered'
    ? ['found_unregistered', 'claim_submitted', 'claim_under_review', 'claim_verified', 'awaiting_collection', 'returned']
    : c.kind === 'handover' ? ['handover_pending', 'closed'] : ['reported_lost', 'potential_match', 'match_confirmed', 'awaiting_collection', 'returned']
  const idx = Math.max(0, steps.indexOf(c.status))

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={item ? `/app/items/${item.id}` : c.kind === 'handover' ? '/app/found' : '/app/gallery'} eyebrow={`Case ${c.ref}`} title={title} compact
        actions={c.status === 'reported_lost' && (person.role === 'parent' || state.school.studentsCanReportLost) ? <Button variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => tryAction(() => { state.cancelLostReport(c.id); state.toast({ title: 'Report cancelled', tone: 'success' }) })}>Found it, cancel</Button> : undefined} />

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <Tile className={cx(c.status === 'awaiting_collection' && '!border-teal-500')}>
            <div className="flex flex-wrap items-center gap-2"><StatusSeal tone={st.tone} label={st.label} live />{myClaim && <StatusSeal tone={CLAIM_STATUS[myClaim.status].tone} label={`Claim ${CLAIM_STATUS[myClaim.status].label.toLowerCase()}`} size="sm" />}</div>
            <ol className="mt-4 flex items-center gap-1" aria-label="Progress">
              {steps.map((s, i) => <li key={s} className={cx('h-1.5 flex-1 rounded-full', i < idx ? 'bg-teal-600' : i === idx ? (c.status === 'returned' || c.status === 'closed' ? 'bg-status-done' : 'bg-teal-400') : 'bg-line')} aria-current={i === idx ? 'step' : undefined} />)}
            </ol>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-paper-2 p-3"><dt className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-3">You</dt><dd className="mt-1 text-[0.9rem] text-ink">{who[c.status]?.you}</dd></div>
              <div className="rounded-md bg-paper-2 p-3"><dt className="text-[0.72rem] font-semibold uppercase tracking-wider text-ink-3">Staff</dt><dd className="mt-1 text-[0.9rem] text-ink">{who[c.status]?.staff}</dd></div>
            </dl>
            {c.status === 'awaiting_collection' && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-teal-200 bg-teal-50 p-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /><div><p className="font-semibold text-teal-900">{c.pickupLocation}</p>{c.pickupWindow && <p className="text-[0.85rem] text-teal-900">{c.pickupWindow}</p>}<p className="mt-1 text-[0.8rem] text-teal-800">Bring case code <span className="font-mono font-semibold">{c.ref}</span>. Staff will ask about a detail only the owner knows.</p></div></div>
            )}
          </Tile>
          <Tile><Eyebrow>History</Eyebrow><Timeline className="mt-3" events={c.events} people={state.people} highlightLast={!['returned', 'closed'].includes(c.status)} /></Tile>
        </div>
        <div className="flex flex-col gap-4">
          {(item || r) && (
            <Tile pad="sm">
              <InventorySlot><ItemArt category={(item ?? r)!.category} photo={(item ?? r)!.photo} size="64%" /></InventorySlot>
              <p className="mt-2 font-medium text-ink">{item?.name ?? r?.description}</p>
              <p className="text-[0.78rem] text-ink-3">{CATEGORY[(item ?? r)!.category].label}{item ? ` · ${item.tagCode}` : r ? ` · found at ${r.locationFound}` : ''}</p>
            </Tile>
          )}
          {c.lostReport && <Tile pad="sm"><Eyebrow>Your report</Eyebrow><p className="mt-1 text-[0.85rem]"><span className="text-ink-3">Last seen:</span> {c.lostReport.lastSeen}</p><p className="text-[0.85rem]"><span className="text-ink-3">Date:</span> {c.lostReport.approxDate}</p>{c.lostReport.notes && <p className="text-[0.85rem]"><span className="text-ink-3">Notes:</span> {c.lostReport.notes}</p>}</Tile>}
          {myClaim && <Tile pad="sm"><Eyebrow>Your claim</Eyebrow><p className="mt-1 text-[0.85rem] text-ink-2">{myClaim.evidence}</p>{myClaim.reviewNote && myClaim.status !== 'rejected' && <p className="mt-1 text-[0.8rem] text-ink-3">Staff note: {myClaim.reviewNote}</p>}</Tile>}
          {c.kind === 'handover' && <Note tone="info">Thank you for handing it in. Who it belongs to stays private; you will be told when staff confirm receipt.</Note>}
        </div>
      </div>
    </div>
  )
}
