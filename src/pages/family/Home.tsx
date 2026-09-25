import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Search, HandHelping, Plus, Bell, MapPin } from 'lucide-react'
import { usePerson, useStore } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { itemsFor, casesFor } from '@/domain/transitions'
import { CASE_STATUS } from '@/domain/labels'
import { StreakSummary } from '@/components/ui/StreakSummary'
import { ItemTile } from '@/components/ui/ItemTile'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { Button } from '@/components/ui/Button'
import { Tile, Eyebrow, Note, InventorySlot } from '@/components/ui/Tile'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Tabs'
import type { TokenKind } from '@/components/ui/QuestToken'
import { DiscoveryRing } from '@/components/brand/Logo'
import { Icon3D } from '@/components/ui/Icon3D'
import { ItemArt } from '@/components/ui/ItemArt'
import { fmtRelative, cx } from '@/lib/util'
import { ExplorerExperience } from '@/components/scene/ExplorerExperience'
import { DayOverview } from '@/components/ui/DayOverview'

export function Home() {
  const person = usePerson()
  if (!person) return null
  return person.role === 'student' ? <StudentHome /> : <ParentHome />
}

/* ---------------- Student ---------------- */
function StudentHome() {
  const person = usePerson()!
  const state = useStore()
  const caps = capabilities(person, state.school)
  const items = itemsFor(state, person)
  const unread = state.notifications.filter((n) => n.toPersonId === person.id && !n.read)
  const restricted = state.school.youngStudentRestrictedPreview && (person.yearGroup ?? 9) <= 3
  const lost = items.filter((i) => i.status === 'reported_lost')

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div><Eyebrow>Inventory shelf</Eyebrow><h1 className="fb-display mt-1 text-[length:var(--t-display)] leading-tight text-ink">Hi {person.firstName}</h1><p className="text-ink-3">{items.length} belonging{items.length === 1 ? '' : 's'} tagged{lost.length ? `, ${lost.length} reported lost` : ', all accounted for'}.</p></div>
        {caps.has('register_item') && <Button to="/app/register" icon={<Plus className="h-4 w-4" />} className="hidden md:inline-flex">Add belonging</Button>}
      </header>
      {restricted && <Note tone="info" className="mb-4">You can review your belongings and build a daily streak. A grown-up or teacher helps with reports and claims.</Note>}
      <ExplorerExperience key={person.id} personId={person.id} compact />

      <section aria-labelledby="shelf">
        <h2 id="shelf" className="sr-only">My belongings</h2>
        {items.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {items.slice(0, 6).map((it, i) => <ItemTile key={it.id} item={it} to={`/app/items/${it.id}`} index={i} />)}
            {caps.has('register_item') && items.length < 6 && (
              <Link to="/app/register" className="fb-tile fb-press fb-raise fb-enter flex flex-col items-center justify-center gap-2 border-dashed p-3 text-center text-[0.85rem] text-ink-3 hover:text-teal-800" style={{ ['--i' as string]: items.length }}>
                <InventorySlot empty size="sm" className="!h-14 !w-14"><Plus className="h-5 w-5 text-ink-4" /></InventorySlot>Add something new<span className="text-[0.72rem]">Make it findable</span>
              </Link>
            )}
          </div>
        ) : (
          <EmptyState title="Your shelf is empty" body="Tag your first belonging. Give it a unique QR sticker and a way home." action={caps.has('register_item') ? <Button to="/app/register" icon={<Plus className="h-4 w-4" />}>Add belonging</Button> : undefined} />
        )}
        {items.length > 6 && <Link to="/app/items" className="fb-link mt-3 inline-block text-[0.85rem]">See all {items.length} belongings</Link>}
      </section>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {caps.has('report_lost') && (
          <Link to="/app/report" className="fb-tile fb-press fb-raise flex items-center gap-4 p-4">
            <Icon3D icon={Search} tone="gold" size={52} />
            <span className="flex-1"><span className="block font-semibold text-ink">Lost something?</span><span className="block text-[0.85rem] text-ink-3">Report it so staff know what to look for.</span></span><ArrowRight className="h-5 w-5 text-ink-4" />
          </Link>
        )}
        {caps.has('report_found') && (
          <Link to="/app/found" className="fb-tile fb-press fb-raise flex items-center gap-4 p-4">
            <Icon3D icon={HandHelping} tone="teal" size={52} />
            <span className="flex-1"><span className="block font-semibold text-ink">Found something?</span><span className="block text-[0.85rem] text-ink-3">Tell us, then hand it to the Lost Property Office.</span></span><ArrowRight className="h-5 w-5 text-ink-4" />
          </Link>
        )}
      </div>

      <StreakSummary />

      {!!unread.length && (
        <section className="mt-6" aria-labelledby="inbox-preview">
          <div className="mb-2 flex items-center justify-between"><h2 id="inbox-preview" className="font-semibold text-ink">New for you</h2><Link to="/app/inbox" className="fb-link text-[0.85rem]">Inbox</Link></div>
          {unread.slice(0, 2).map((n) => <Link key={n.id} to="/app/inbox" className="fb-tile fb-press mb-2 flex items-start gap-3 p-3"><Bell className="mt-0.5 h-4 w-4 text-teal-600" /><span className="flex-1"><span className="block font-medium">{n.title}</span><span className="block text-[0.82rem] text-ink-3">{n.body}</span></span></Link>)}
        </section>
      )}
    </div>
  )
}

export const tokenFor = (a: string): TokenKind => (({ register_item: 'tag', label_refreshed: 'label', handover_confirmed: 'lantern', helped_return: 'key', profile_complete: 'compass' } as Record<string, TokenKind>)[a] ?? 'tag')

/* ---------------- Parent ---------------- */
function ParentHome() {
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const kids = state.people.filter((p) => person.childIds?.includes(p.id))
  const [kid, setKid] = useState<string>('all')
  const items = useMemo(() => itemsFor(state, person).filter((i) => kid === 'all' || i.ownerId === kid), [state, person, kid])
  const cases = casesFor(state, person)
  const counts = { safe: items.filter((i) => ['with_owner', 'returned'].includes(i.status)).length, lost: items.filter((i) => i.status === 'reported_lost').length, progress: items.filter((i) => ['potential_match', 'match_confirmed'].includes(i.status)).length, collect: items.filter((i) => i.status === 'awaiting_collection').length }
  const latest = state.notifications.filter((n) => n.toPersonId === person.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  const collectCase = cases.find((c) => c.status === 'awaiting_collection' && (kid === 'all' || state.items.find((i) => i.id === c.itemId)?.ownerId === kid || c.claims.some((cl) => cl.claimantId === person.id)))
  const claimCase = cases.find((c) => ['claim_submitted', 'claim_under_review'].includes(c.status) && c.claims.some((cl) => cl.claimantId === person.id))
  const lostItem = items.find((i) => i.status === 'reported_lost')

  const next = collectCase
    ? { title: `Collect ${collectCase.itemId ? state.items.find((i) => i.id === collectCase.itemId)?.name : collectCase.foundRecord?.description}`, body: `${collectCase.pickupLocation}${collectCase.pickupWindow ? `, ${collectCase.pickupWindow}` : ''}. Bring case code ${collectCase.ref}.`, cta: 'Collection details', to: `/app/cases/${collectCase.id}`, icon: MapPin, tone: 'ready' as const }
    : claimCase ? { title: 'Claim under review', body: 'Staff are comparing your details with the found item. Nothing more to do yet.', cta: 'View claim', to: `/app/cases/${claimCase.id}`, icon: Search, tone: 'review' as const }
    : lostItem ? { title: `${lostItem.name} is reported lost`, body: 'Staff can see the report. You will get an update here if it turns up. You can check the gallery too.', cta: 'Browse the gallery', to: '/app/gallery', icon: Search, tone: 'lost' as const }
    : { title: 'Everything is accounted for', body: items.length < 4 ? 'Tag a few more belongings so staff can identify them if they turn up.' : 'Nothing needs your attention right now.', cta: 'Register a belonging', to: '/app/register', icon: Plus, tone: 'neutral' as const }

  return (
    <div>
      <header className="mb-5">
        <Eyebrow>{state.school.name}</Eyebrow>
        <h1 className="fb-display mt-1 text-[length:var(--t-display)] leading-tight text-ink">Hello {person.firstName}</h1>
        {kids.length > 1 && <Segmented className="mt-3" ariaLabel="Child" value={kid} onChange={setKid} options={[{ value: 'all', label: 'All children' }, ...kids.map((k) => ({ value: k.id, label: `${k.firstName}${k.classLabel ? ` · ${k.classLabel}` : ''}` }))]} />}
      </header>

      <DayOverview />
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <Tile className={cx('relative overflow-hidden', next.tone === 'ready' && '!border-teal-500')}>
          <div className="flex items-start gap-4">
            <span className="shrink-0">{next.tone === 'ready' ? <DiscoveryRing size={48} className="text-teal-700" /> : <Icon3D icon={next.icon} tone={next.tone === 'lost' ? 'gold' : next.tone === 'review' ? 'plum' : 'teal'} size={52} />}</span>
            <div className="min-w-0 flex-1"><Eyebrow>Next best action</Eyebrow><h2 className="mt-1 text-lg font-semibold leading-tight text-ink">{next.title}</h2><p className="mt-1 text-[0.9rem] text-ink-3">{next.body}</p><Button className="mt-3" size="sm" onClick={() => nav(next.to)} iconRight={<ArrowRight className="h-4 w-4" />}>{next.cta}</Button></div>
          </div>
        </Tile>
        <Tile>
          <Eyebrow>At a glance</Eyebrow>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            {[['With owner', counts.safe, 'neutral'], ['Reported lost', counts.lost, 'lost'], ['Being matched', counts.progress, 'match'], ['Ready to collect', counts.collect, 'ready']].map(([l, v, t]) => (
              <div key={l as string} className="rounded-md border border-line bg-paper-2 p-2.5"><dt className="text-[0.72rem] text-ink-3">{l}</dt><dd className="mt-0.5 flex items-center gap-2"><span className="fb-display text-2xl leading-none tabular-nums">{v}</span><StatusSeal tone={t as 'lost'} label="" size="sm" className="!px-1.5" /></dd></div>
            ))}
          </dl>
          {latest && <p className="mt-3 text-[0.8rem] text-ink-3"><Bell className="mr-1 inline h-3.5 w-3.5" />Latest: {latest.title} · {fmtRelative(latest.at)}</p>}
        </Tile>
      </div>

      <section className="mt-6" aria-labelledby="belongings">
        <div className="mb-3 flex items-center justify-between"><h2 id="belongings" className="font-semibold text-ink">Belongings</h2><div className="flex gap-2"><Link to="/app/items" className="fb-link text-[0.85rem]">All items</Link><Link to="/app/register" className="fb-link text-[0.85rem]">Register</Link></div></div>
        {items.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.slice(0, 6).map((it, i) => <ItemTile key={it.id} item={it} to={`/app/items/${it.id}`} index={i} ownerLabel={kid === 'all' ? state.people.find((p) => p.id === it.ownerId)?.firstName : undefined} />)}
          </div>
        ) : <EmptyState title="No belongings registered yet" body="Registration is the most useful preventive step: it gives staff something reliable to match." action={<Button to="/app/register" icon={<Plus className="h-4 w-4" />}>Register a belonging</Button>} />}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2" aria-label="More">
        <Link to="/app/gallery" className="fb-tile fb-press fb-raise flex items-center gap-4 p-4">
          <InventorySlot size="sm" className="!h-12 !w-12 shrink-0"><ItemArt category="stationery" size={36} /></InventorySlot>
          <span className="flex-1"><span className="block font-semibold text-ink">Found Items Gallery</span><span className="block text-[0.85rem] text-ink-3">{state.cases.filter((c) => c.kind === 'found_unregistered' && c.status === 'found_unregistered').length} unclaimed items. Recognise one? Submit a claim.</span></span><ArrowRight className="h-5 w-5 text-ink-4" />
        </Link>
        {cases.filter((c) => c.status === 'returned').slice(0, 1).map((c) => (
          <Link key={c.id} to={`/app/cases/${c.id}`} className="fb-tile fb-press fb-raise flex items-center gap-4 p-4">
            <Icon3D icon={MapPin} tone="mint" size={52} />
            <span className="flex-1"><span className="block font-semibold text-ink">Recently returned</span><span className="block text-[0.85rem] text-ink-3">{state.items.find((i) => i.id === c.itemId)?.name ?? c.foundRecord?.description} · {CASE_STATUS[c.status].label}, {c.returnedAt ? fmtRelative(c.returnedAt) : ''}</span></span><ArrowRight className="h-5 w-5 text-ink-4" />
          </Link>
        ))}
      </section>

    </div>
  )
}
