import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { CATEGORY } from '@/domain/labels'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Textarea, Checkbox, FieldWrap } from '@/components/ui/Field'
import { ItemArt } from '@/components/ui/ItemArt'
import { Segmented } from '@/components/ui/Tabs'
import { NotFound } from '@/pages/NotFound'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/util'

/** Privacy-conscious claim: describe a distinguishing detail; never see other families' data. */
export function ClaimForm() {
  const { id } = useParams()
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const c = state.cases.find((x) => x.id === id && x.kind === 'found_unregistered')
  const kids = state.people.filter((p) => person.childIds?.includes(p.id))
  const [onBehalf, setOnBehalf] = useState(kids[0]?.id ?? person.id)
  const [evidence, setEvidence] = useState('')
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  if (!c || !c.foundRecord) return <NotFound />
  const caps = capabilities(person, state.school)
  if (!caps.has('submit_claim')) return <EmptyState title="Claims are made by a guardian" body="Ask a parent to submit the claim, or tell the Lost Property Office in person." action={<Button to="/app/gallery">Back to gallery</Button>} />
  if (c.status !== 'found_unregistered') return <EmptyState title="This item already has a claim under review" body="If it is not verified, the item returns to the gallery and you can claim it then." action={<Button to="/app/gallery">Back to gallery</Button>} />
  const r = c.foundRecord

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (evidence.trim().length < 12) errs.evidence = 'Describe a detail only the owner would know (a short sentence).'
    if (!ok) errs.ok = 'Please confirm.'
    setErr(errs)
    if (Object.keys(errs).length) return
    tryAction(() => {
      state.submitClaim({ caseId: c.id, onBehalfOf: onBehalf !== person.id ? onBehalf : undefined, evidence })
      state.toast({ title: 'Claim sent to staff', body: 'You will hear back in your inbox. Nothing is released until staff verify.' })
      nav(`/app/cases/${c.id}`)
    })
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back="/app/gallery" backLabel="Gallery" title="Claim this item" lede="Staff compare what you write with the item. Be specific." compact />
      <Tile pad="sm" className="mb-5 flex items-center gap-3">
        <InventorySlot size="sm" className="!h-16 !w-16 shrink-0"><ItemArt category={r.category} photo={r.photo} size={44} /></InventorySlot>
        <div><p className="font-medium text-ink">{r.description || CATEGORY[r.category].label}</p><p className="text-[0.78rem] text-ink-3">{CATEGORY[r.category].label} · found at {r.locationFound}, {fmtDate(r.dateFound)} · {c.ref}</p></div>
      </Tile>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {kids.length > 0 && <FieldWrap label="Whose is it?">{() => <Segmented ariaLabel="Child" value={onBehalf} onChange={setOnBehalf} options={kids.map((k) => ({ value: k.id, label: k.firstName }))} />}</FieldWrap>}
        <Textarea label="What makes it recognisably yours?" rows={4} value={evidence} onChange={(e) => setEvidence(e.target.value)} error={err.evidence} placeholder="e.g. Grey pencil case with a zip; a small ink stain inside the lid and a broken pencil sharpener." required />
        <Checkbox label="I understand staff verify ownership before anything is released" hint="A claim is a request, not proof. Staff may ask you to describe the item at pickup." checked={ok} onChange={(e) => setOk(e.target.checked)} />
        {err.ok && <p role="alert" className="-mt-2 text-[0.8rem] font-medium text-status-danger">{err.ok}</p>}
        <Note tone="info">Your name and contact details are only visible to authorised staff. Other families never see them.</Note>
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => nav('/app/gallery')}>Cancel</Button><Button type="submit" full icon={<Send className="h-4 w-4" />}>Submit claim</Button></div>
      </form>
    </div>
  )
}
