import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, HandHelping, MapPin, Calendar } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { galleryCases } from '@/domain/transitions'
import { CATEGORY, CATEGORY_ORDER, CLAIM_STATUS } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { ItemArt } from '@/components/ui/ItemArt'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { fmtDate, cx } from '@/lib/util'

/** Found Items Gallery, safe view: photo, category, location, date. Never names, classes or claimants. */
export function Gallery() {
  const person = usePerson()!
  const state = useStore()
  const caps = capabilities(person, state.school)
  const all = galleryCases(state)
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')
  const list = useMemo(() => all.filter((c) => (cat === 'all' || c.foundRecord!.category === cat) && (!q || `${c.foundRecord!.description} ${c.foundRecord!.locationFound}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, cat, q])
  const student = person.role === 'student'
  return (
    <div>
      <PageHeader title="Found Items Gallery" lede="Unregistered items handed to staff. Recognise one? Submit a claim and staff will verify it with you." compact
        actions={student && caps.has('report_found') ? <Button variant="secondary" to="/app/found" icon={<HandHelping className="h-4 w-4" />}>I found something</Button> : undefined} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="fb-scroll-x flex gap-1.5" role="radiogroup" aria-label="Category">
          {[{ value: 'all', label: 'All' }, ...CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY[c].plural }))].map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={cat === o.value} onClick={() => setCat(o.value)} className={cx('fb-press shrink-0 rounded-full border px-3 py-1.5 text-[0.8rem] font-medium', cat === o.value ? 'border-teal-700 bg-teal-700 text-white' : 'border-line-strong bg-paper text-ink-2 hover:bg-paper-2')}>{o.label}</button>
          ))}
        </div>
        <label className="relative block md:ml-auto md:w-64"><span className="sr-only">Search the gallery</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description or place" className="fb-input pl-9" type="search" /></label>
      </div>

      {list.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => {
            const r = c.foundRecord!
            const mine = c.claims.find((cl) => cl.claimantId === person.id && cl.status !== 'rejected')
            const someoneElse = !mine && c.status !== 'found_unregistered'
            return (
              <li key={c.id} className="fb-tile fb-enter flex gap-3 p-3" style={{ ['--i' as string]: i }}>
                <InventorySlot size="sm" className="!h-20 !w-20 shrink-0"><ItemArt category={r.category} photo={r.photo} size={56} /></InventorySlot>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.description || CATEGORY[r.category].label}</p>
                  <p className="text-[0.75rem] text-ink-3">{CATEGORY[r.category].label} · {c.ref}</p>
                  <p className="mt-1 flex items-center gap-1 text-[0.78rem] text-ink-2"><MapPin className="h-3.5 w-3.5 text-ink-4" /> {r.locationFound}</p>
                  <p className="flex items-center gap-1 text-[0.78rem] text-ink-2"><Calendar className="h-3.5 w-3.5 text-ink-4" /> Found {fmtDate(r.dateFound)}</p>
                  <div className="mt-2">
                    {mine ? <Link to={`/app/cases/${c.id}`} className="inline-flex"><StatusSeal tone={CLAIM_STATUS[mine.status].tone} label={`Your claim: ${CLAIM_STATUS[mine.status].label}`} size="sm" /></Link>
                      : someoneElse ? <StatusSeal tone="review" label="A claim is being reviewed" size="sm" />
                      : caps.has('submit_claim') ? <Button size="sm" to={`/app/gallery/${c.id}/claim`}>This is ours</Button>
                      : <p className="text-[0.75rem] text-ink-3">Recognise it? Ask a grown-up or tell the Lost Property Office.</p>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : all.length ? (
        <EmptyState icon={<Search className="h-5 w-5" />} title="No items match" body="Try another category or clear the search." action={<Button size="sm" variant="secondary" onClick={() => { setCat('all'); setQ('') }}>Show everything</Button>} />
      ) : (
        <EmptyState title="The gallery is empty" body="Everything handed in has been matched or claimed. Check back after the next lost-property round." />
      )}
      <Note tone="info" className="mt-6">Gallery cards never show who found an item, who claimed it, or any owner details. A claim is only a request: staff verify before anything is released.</Note>
    </div>
  )
}
