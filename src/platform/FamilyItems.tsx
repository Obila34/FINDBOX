import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { imagery } from '@/data/imagery'
import type { Workspace } from './api'
import { Chips, ItemCard, SectionHead } from './AppKit'

type Filter = 'all' | 'with_owner' | 'lost' | 'waiting' | 'bottle' | 'clothing' | 'book' | 'lunchbox'
const picture = (category: string) => (imagery.catalog[category as keyof typeof imagery.catalog] ?? imagery.catalog.book).src

/** Every belonging, searchable, with a few simple filters. Belongings are added under each child's QR. */
export function FamilyItems({ workspace, staff }: { workspace: Workspace; staff: boolean }) {
  const params = new URLSearchParams(useLocation().search)
  const initial = params.get('q') || '', focus = !!initial || params.has('search')
  const [q, setQ] = useState(initial), [filter, setFilter] = useState<Filter>('all')
  const waitingIds = new Set(workspace.cases.filter(c => c.status === 'awaiting_collection').map(c => c.item_id))
  const openIds = new Set(workspace.cases.filter(c => !['returned', 'closed'].includes(c.status)).map(c => c.item_id))
  const items = useMemo(() => workspace.items.map(i => ({ ...i, shown: waitingIds.has(i.id) ? 'awaiting_collection' : i.status === 'found' ? 'found' : openIds.has(i.id) || i.status === 'lost' ? 'lost' : i.status })), [workspace])
  const needle = q.trim().toLowerCase()
  const shown = items.filter(i => {
    if (needle && ![i.name, i.child_name, i.code, i.category, i.color].join(' ').toLowerCase().includes(needle)) return false
    if (filter === 'all') return true
    if (filter === 'with_owner') return i.shown === 'with_owner'
    if (filter === 'lost') return i.shown === 'lost' || i.shown === 'found'
    if (filter === 'waiting') return i.shown === 'awaiting_collection'
    return i.category === filter
  })
  const count = (f: (i: (typeof items)[number]) => boolean) => items.filter(f).length
  return <div className="pa-home">
    <SectionHead title="Belongings" to={staff ? undefined : '/app/children'} action="Add a belonging" />
    <label className="pa-search"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, child or tag code" aria-label="Search belongings" autoFocus={focus} />{q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>}</label>
    <Chips label="Items filter" value={filter} onChange={setFilter} options={[
      { id: 'all', label: 'All', count: items.length },
      { id: 'with_owner', label: 'With you', count: count(i => i.shown === 'with_owner') },
      { id: 'lost', label: 'Lost', count: count(i => i.shown === 'lost' || i.shown === 'found') },
      { id: 'waiting', label: 'Ready to collect', count: count(i => i.shown === 'awaiting_collection') },
    ]} />
    {shown.length ? <div className="pa-grid">{shown.map((i, n) => <ItemCard key={i.id} index={n} name={i.name} image={picture(i.category)} status={i.shown} owner={[i.child_name, i.color].filter(Boolean).join(' · ') || undefined} code={i.code} />)}</div>
      : <p className="pa-empty">{items.length ? 'No belongings match. Try another filter or search.' : <>Add your child's belongings under their QR. <Link to="/app/children">Add a belonging <Plus size={13} /></Link></>}</p>}
  </div>
}
