import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { itemsFor } from '@/domain/transitions'
import { capabilities } from '@/domain/permissions'
import { ITEM_STATUS } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { ItemTile } from '@/components/ui/ItemTile'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'

export function Items() {
  const person = usePerson()!
  const state = useStore()
  const caps = capabilities(person, state.school)
  const all = itemsFor(state, person)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const items = useMemo(() => all.filter((i) => (tab === 'all' || (tab === 'open' ? !['with_owner', 'returned'].includes(i.status) : ['with_owner', 'returned'].includes(i.status))) && (!q || `${i.name} ${i.tagCode} ${i.description}`.toLowerCase().includes(q.toLowerCase()))), [all, q, tab])
  const openCount = all.filter((i) => !['with_owner', 'returned'].includes(i.status)).length
  const student = person.role === 'student'
  return (
    <div>
      <PageHeader title={student ? 'My inventory' : 'Belongings'} lede={`${all.length} registered${openCount ? `, ${openCount} with an open case` : ''}.`} actions={caps.has('register_item') && <Button to="/app/register" icon={<Plus className="h-4 w-4" />}>Register</Button>} compact />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs ariaLabel="Filter" size="sm" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: all.length }, { id: 'open', label: 'Open cases', count: openCount }, { id: 'safe', label: 'With owner', count: all.length - openCount }]} className="!border-0" />
        <label className="relative block md:w-72"><span className="sr-only">Search belongings</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or tag" className="fb-input pl-9" type="search" /></label>
      </div>
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{items.map((it, i) => <ItemTile key={it.id} item={it} to={`/app/items/${it.id}`} index={i} ownerLabel={!student && person.childIds && person.childIds.length > 1 ? state.people.find((p) => p.id === it.ownerId)?.firstName : undefined} />)}</div>
      ) : q ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title={`Nothing matches “${q}”`} body="Try a different word, or check the tag code on the sticker." action={<Button variant="secondary" size="sm" onClick={() => setQ('')}>Clear search</Button>} />
      ) : (
        <EmptyState title={tab === 'open' ? 'No open cases' : 'No belongings yet'} body={tab === 'open' ? `All ${all.length} belongings are ${ITEM_STATUS.with_owner.label.toLowerCase()}.` : 'Register the first one to get a QR tag.'} action={caps.has('register_item') && tab !== 'open' ? <Button to="/app/register" icon={<Plus className="h-4 w-4" />}>Register a belonging</Button> : undefined} />
      )}
    </div>
  )
}
