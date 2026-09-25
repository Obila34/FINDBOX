import { useMemo, useState } from 'react'
import { DayOverview } from '@/components/ui/DayOverview'
import { Link, useNavigate } from 'react-router-dom'
import { ScanLine, PackagePlus, Search, ArrowRight } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { CASE_STATUS, CATEGORY } from '@/domain/labels'
import type { Case } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stat } from '@/components/ui/Stat'
import { InventorySlot } from '@/components/ui/Tile'
import { ItemArt } from '@/components/ui/ItemArt'
import { fmtRelative, daysBetween, cx } from '@/lib/util'

type TabId = 'action' | 'matches' | 'claims' | 'collect' | 'handovers' | 'lost' | 'closed'

export function caseTitle(c: Case, items: { id: string; name: string }[]) {
  return c.itemId ? items.find((i) => i.id === c.itemId)?.name ?? 'Registered item' : c.foundRecord?.description || c.handover?.description || 'Item'
}

export function Queue() {
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState<TabId>('action')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'updated' | 'age'>('updated')
  const cases = state.cases

  const buckets: Record<TabId, Case[]> = useMemo(() => ({
    action: cases.filter((c) => ['potential_match', 'claim_submitted', 'claim_under_review', 'match_confirmed', 'claim_verified', 'handover_pending'].includes(c.status)),
    matches: cases.filter((c) => ['potential_match', 'match_confirmed'].includes(c.status)),
    claims: cases.filter((c) => ['claim_submitted', 'claim_under_review', 'claim_verified'].includes(c.status)),
    collect: cases.filter((c) => c.status === 'awaiting_collection'),
    handovers: cases.filter((c) => c.status === 'handover_pending'),
    lost: cases.filter((c) => c.status === 'reported_lost'),
    closed: cases.filter((c) => ['returned', 'closed'].includes(c.status)),
  }), [cases])

  const list = useMemo(() => buckets[tab]
    .filter((c) => !q || `${c.ref} ${caseTitle(c, state.items)} ${c.foundRecord?.locationFound ?? ''} ${state.items.find((i) => i.id === c.itemId)?.tagCode ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'updated' ? b.updatedAt.localeCompare(a.updatedAt) : a.createdAt.localeCompare(b.createdAt))), [buckets, tab, q, sort, state.items])

  const uncollectedOld = buckets.collect.filter((c) => daysBetween(c.updatedAt, new Date().toISOString()) >= state.school.uncollectedReminderDays).length
  const gallery = cases.filter((c) => c.kind === 'found_unregistered' && c.status === 'found_unregistered').length

  return (
    <div>
      <PageHeader eyebrow={`${state.school.name} · Lost Property`} title={`Good day, ${person.firstName}`} lede={`${buckets.action.length} case${buckets.action.length === 1 ? ' needs' : 's need'} a decision. ${buckets.lost.length} open lost report${buckets.lost.length === 1 ? '' : 's'}.`}
        actions={person.role === 'staff' ? <><Button variant="secondary" to="/manage/scan" icon={<ScanLine className="h-4 w-4" />}>Scan tag</Button><Button to="/manage/log" icon={<PackagePlus className="h-4 w-4" />}>Log found</Button></> : undefined} compact />

      <DayOverview teacher />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat index={0} label="Needs a decision" value={buckets.action.length} hint="Matches, claims, handovers" onClick={() => setTab('action')} tone={buckets.action.length ? 'attention' : 'neutral'} />
        <Stat index={1} label="Awaiting collection" value={buckets.collect.length} hint={uncollectedOld ? `${uncollectedOld} over ${state.school.uncollectedReminderDays} days` : 'All recent'} onClick={() => setTab('collect')} />
        <Stat index={2} label="Open lost reports" value={buckets.lost.length} hint="Watch for these" onClick={() => setTab('lost')} />
        <Stat index={3} label="In gallery" value={gallery} hint="Unregistered, unclaimed" onClick={() => nav('/manage/gallery')} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Tabs ariaLabel="Queue" size="sm" value={tab} onChange={(v) => setTab(v as TabId)} tabs={[
          { id: 'action', label: 'Needs action', count: buckets.action.length }, { id: 'matches', label: 'Matches', count: buckets.matches.length }, { id: 'claims', label: 'Claims', count: buckets.claims.length },
          { id: 'handovers', label: 'Handovers', count: buckets.handovers.length }, { id: 'collect', label: 'Collection', count: buckets.collect.length }, { id: 'lost', label: 'Lost reports', count: buckets.lost.length }, { id: 'closed', label: 'Closed', count: buckets.closed.length },
        ]} className="flex-1" />
        <div className="flex gap-2">
          <label className="relative block flex-1 md:w-64"><span className="sr-only">Search cases</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, item, tag, place" className="fb-input !min-h-[40px] pl-9" type="search" /></label>
          <label className="sr-only" htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as 'updated')} className="fb-input !min-h-[40px] w-auto"><option value="updated">Latest first</option><option value="age">Oldest first</option></select>
        </div>
      </div>

      {list.length ? (
        <div className="mt-3 overflow-hidden rounded-md border border-line bg-paper">
          <table className="w-full text-[0.85rem]">
            <thead className="hidden bg-paper-2 text-left text-[0.7rem] uppercase tracking-wider text-ink-3 md:table-header-group"><tr><th className="px-3 py-2 font-semibold">Case</th><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 font-semibold">Next</th><th className="px-3 py-2 font-semibold">Updated</th><th className="px-3 py-2"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {list.map((c, i) => {
                const st = CASE_STATUS[c.status]
                const cat = state.items.find((it) => it.id === c.itemId)?.category ?? c.foundRecord?.category ?? 'other'
                const photo = state.items.find((it) => it.id === c.itemId)?.photo ?? c.foundRecord?.photo
                const stale = c.status === 'awaiting_collection' && daysBetween(c.updatedAt, new Date().toISOString()) >= state.school.uncollectedReminderDays
                return (
                  <tr key={c.id} className={cx('fb-enter cursor-pointer border-t border-line hover:bg-teal-50/50 md:table-row', 'grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-3 py-2 md:p-0')} style={{ ['--i' as string]: i }} onClick={() => nav(`/manage/cases/${c.id}`)}>
                    <td className="row-span-2 md:table-cell md:px-3 md:py-2"><div className="flex items-center gap-2"><InventorySlot size="sm" className="!h-10 !w-10 shrink-0"><ItemArt category={cat} photo={photo} size={28} /></InventorySlot><span className="hidden font-mono text-[0.72rem] text-ink-3 md:inline">{c.ref}</span></div></td>
                    <td className="min-w-0 md:table-cell md:px-3 md:py-2"><p className="truncate font-medium text-ink">{caseTitle(c, state.items)}</p><p className="truncate text-[0.72rem] text-ink-3"><span className="font-mono md:hidden">{c.ref} · </span>{CATEGORY[cat].label}{c.foundRecord ? ` · ${c.foundRecord.locationFound}` : c.lostReport ? ` · last seen ${c.lostReport.lastSeen}` : c.handover ? ` · ${c.handover.location}` : ''}</p></td>
                    <td className="md:table-cell md:px-3 md:py-2"><StatusSeal tone={stale ? 'lost' : st.tone} label={stale ? 'Uncollected' : st.label} size="sm" /></td>
                    <td className="col-span-2 text-[0.75rem] text-ink-3 md:table-cell md:px-3 md:py-2 md:text-[0.8rem]">{st.next}</td>
                    <td className="hidden whitespace-nowrap text-ink-3 md:table-cell md:px-3 md:py-2">{fmtRelative(c.updatedAt)}</td>
                    <td className="hidden md:table-cell md:px-3 md:py-2"><Link to={`/manage/cases/${c.id}`} aria-label={`Open case ${c.ref}`} className="text-teal-700"><ArrowRight className="h-4 w-4" /></Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3"><EmptyState icon={<Search className="h-5 w-5" />} title={q ? `No cases match “${q}”` : tab === 'action' ? 'Nothing needs a decision' : 'Nothing here'} body={q ? 'Try the ref, the tag code or where it was found.' : tab === 'action' ? 'New reports, scans and claims will appear here.' : 'This queue is clear.'} action={q ? <Button size="sm" variant="secondary" onClick={() => setQ('')}>Clear search</Button> : undefined} /></div>
      )}
    </div>
  )
}
