import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { itemsFor } from '@/domain/transitions'
import { CATEGORY } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, FieldWrap } from '@/components/ui/Field'
import { ItemArt } from '@/components/ui/ItemArt'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { cx } from '@/lib/util'

export function ReportLost() {
  const { id } = useParams()
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const caps = capabilities(person, state.school)
  const eligible = itemsFor(state, person).filter((i) => ['with_owner', 'returned'].includes(i.status))
  const [itemId, setItemId] = useState(id ?? '')
  const [f, setF] = useState({ lastSeen: '', approxDate: new Date().toISOString().slice(0, 10), notes: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const item = state.items.find((i) => i.id === itemId)

  if (!caps.has('report_lost')) return <EmptyState title="Reports are made by a guardian" body="Your school has set student accounts to view only. Ask a grown-up to report it." action={<Button to="/app/home">Home</Button>} />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!itemId) errs.item = 'Choose the belonging.'
    if (f.lastSeen.trim().length < 3) errs.lastSeen = 'Where was it last seen? e.g. “Sports pavilion”.'
    setErr(errs)
    if (Object.keys(errs).length) return
    tryAction(() => {
      const caseId = state.reportLost({ itemId, ...f })
      state.toast({ title: 'Reported to the Lost Property Office', body: 'You will get an update here if it turns up.' })
      nav(`/app/cases/${caseId}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={id ? `/app/items/${id}` : '/app/home'} title="Report an item lost" lede="Tell staff what to look for. This takes under a minute and can be cancelled." compact />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FieldWrap label="Which belonging?" error={err.item} required>{() => (
          eligible.length ? (
            <div role="radiogroup" aria-label="Belonging" className="grid gap-2 sm:grid-cols-2">
              {eligible.map((it) => (
                <button key={it.id} type="button" role="radio" aria-checked={itemId === it.id} onClick={() => setItemId(it.id)} className={cx('fb-press flex items-center gap-3 rounded-md border p-2.5 text-left', itemId === it.id ? 'border-teal-600 bg-teal-50' : 'border-line bg-paper hover:bg-paper-2')}>
                  <InventorySlot size="sm" className="!h-12 !w-12 shrink-0"><ItemArt category={it.category} photo={it.photo} size={36} /></InventorySlot>
                  <span className="min-w-0"><span className="block truncate font-medium text-ink">{it.name}</span><span className="block text-[0.75rem] text-ink-3">{CATEGORY[it.category].label} · {it.tagCode}</span></span>
                </button>
              ))}
            </div>
          ) : <EmptyState compact title="Nothing to report" body="Every registered belonging already has an open case, or none is registered yet." />
        )}</FieldWrap>

        {item && (
          <Tile pad="sm" className="flex items-center gap-3"><StatusSeal tone="neutral" label="With owner" size="sm" /><span className="text-[0.85rem] text-ink-3">→</span><StatusSeal tone="lost" label="Reported lost" size="sm" /><span className="ml-auto text-[0.78rem] text-ink-3">Staff will see this immediately.</span></Tile>
        )}

        <Input label="Where was it last seen?" value={f.lastSeen} onChange={(e) => setF({ ...f, lastSeen: e.target.value })} error={err.lastSeen} placeholder="Sports pavilion, after PE" required />
        <Input label="Approximate date" type="date" value={f.approxDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, approxDate: e.target.value })} />
        <Textarea label="Anything that helps" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} hint="A sticker, a dent, what was inside." />
        <Note>No points or scores are attached to reporting a loss. This just helps staff match it.</Note>
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => nav(-1)}>Cancel</Button><Button type="submit" full icon={<Search className="h-4 w-4" />} disabled={!eligible.length}>Report lost</Button></div>
      </form>
    </div>
  )
}
