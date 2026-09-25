import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PackagePlus, Search, ArrowRight } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { CASE_STATUS, CATEGORY } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { InventorySlot } from '@/components/ui/Tile'
import { ItemArt } from '@/components/ui/ItemArt'
import { Segmented } from '@/components/ui/Tabs'
import { fmtDate, daysBetween } from '@/lib/util'

/** Staff view of the gallery: includes claim counts and age. Still no owner data on the card. */
export function StaffGallery() {
  const person = usePerson()!
  const state = useStore()
  const [view, setView] = useState<'open' | 'all'>('open')
  const [q, setQ] = useState('')
  const list = useMemo(() => state.cases.filter((c) => c.kind === 'found_unregistered' && (view === 'all' || !['returned', 'closed'].includes(c.status)) && (!q || `${c.ref} ${c.foundRecord?.description} ${c.foundRecord?.locationFound}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [state.cases, view, q])
  return (
    <div>
      <PageHeader title="Found Items Gallery" lede="Unregistered property in custody. Families see the safe card; you see claims and age." compact actions={person.role === 'staff' ? <Button to="/manage/log" icon={<PackagePlus className="h-4 w-4" />}>Log found</Button> : undefined} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented ariaLabel="Show" value={view} onChange={setView} options={[{ value: 'open', label: 'In custody' }, { value: 'all', label: 'Including returned' }]} />
        <label className="relative block md:w-72"><span className="sr-only">Search gallery</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, description, place" className="fb-input !min-h-[40px] pl-9" type="search" /></label>
      </div>
      {list.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => {
            const r = c.foundRecord!
            const age = Math.floor(daysBetween(r.loggedAt, new Date().toISOString()))
            const openClaims = c.claims.filter((cl) => cl.status !== 'rejected').length
            return (
              <li key={c.id} className="fb-enter min-w-0" style={{ ['--i' as string]: i }}>
                <Link to={`/manage/cases/${c.id}`} className="fb-tile fb-press fb-raise flex min-w-0 gap-3 p-3">
                  <InventorySlot size="sm" className="!h-20 !w-20 shrink-0"><ItemArt category={r.category} photo={r.photo} size={56} /></InventorySlot>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[0.72rem] text-ink-3">{c.ref}</span><StatusSeal tone={CASE_STATUS[c.status].tone} label={CASE_STATUS[c.status].label} size="sm" /></span>
                    <span className="mt-1 block truncate font-medium text-ink">{r.description || CATEGORY[r.category].label}</span>
                    <span className="block text-[0.78rem] text-ink-3">{r.locationFound} · {fmtDate(r.dateFound)}</span>
                    <span className="mt-1 flex items-center justify-between text-[0.75rem] text-ink-3"><span>{age} d in custody · {openClaims} open claim{openClaims === 1 ? '' : 's'}{c.claims.length - openClaims ? `, ${c.claims.length - openClaims} rejected` : ''}</span><ArrowRight className="h-3.5 w-3.5" /></span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : <EmptyState icon={<Search className="h-5 w-5" />} title={q ? 'No items match' : 'Gallery is empty'} body={q ? 'Try the ref or where it was found.' : 'Log a found item to list it.'} action={q ? <Button size="sm" variant="secondary" onClick={() => setQ('')}>Clear</Button> : person.role === 'staff' ? <Button to="/manage/log" icon={<PackagePlus className="h-4 w-4" />}>Log found</Button> : undefined} />}
    </div>
  )
}
