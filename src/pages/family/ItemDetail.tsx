import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Printer, Share2, Tag, Pencil, XCircle, ArrowRight, Nfc, QrCode } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { openCaseForItem } from '@/domain/transitions'
import { ITEM_STATUS, CATEGORY, CATEGORY_ORDER } from '@/domain/labels'
import type { ItemCategory } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, InventorySlot, Note } from '@/components/ui/Tile'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { Button } from '@/components/ui/Button'
import { ItemArt } from '@/components/ui/ItemArt'
import { QRCodeView, tagUrl } from '@/components/ui/QRCodeView'
import { Timeline } from '@/components/ui/Timeline'
import { Sheet } from '@/components/ui/Sheet'
import { Input, Textarea, Select } from '@/components/ui/Field'
import { NotFound } from '@/pages/NotFound'
import { fmtDate, tagCode as newTag } from '@/lib/util'
import { ProductViewer } from '@/components/scene/ProductViewer'

export function ItemDetail() {
  const { id } = useParams()
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const item = state.items.find((i) => i.id === id)
  const [tagOpen, setTagOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [relabelOpen, setRelabelOpen] = useState(false)
  if (!item) return <NotFound />
  const owns = person.role === 'student' ? item.ownerId === person.id : (person.childIds?.includes(item.ownerId) || item.guardianId === person.id)
  if (!owns) return <NotFound />
  const caps = capabilities(person, state.school)
  const st = ITEM_STATUS[item.status]
  const openCase = openCaseForItem(state, item.id)
  const lastCase = openCase ?? [...state.cases].filter((c) => c.itemId === item.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const owner = state.people.find((p) => p.id === item.ownerId)
  const canReport = caps.has('report_lost') && ['with_owner', 'returned'].includes(item.status)
  const canCancel = openCase?.status === 'reported_lost' && caps.has('report_lost')

  const share = async () => {
    const data = { title: `FindBox tag ${item.tagCode}`, text: `${item.name} · FindBox tag ${item.tagCode}`, url: tagUrl(item.tagCode) }
    if (navigator.share) { try { await navigator.share(data) } catch { /* cancelled */ } }
    else { await navigator.clipboard?.writeText(data.url); state.toast({ title: 'Tag link copied', body: 'Sharing is not available here, so the link is on your clipboard.' }) }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/app/items" backLabel="Belongings" eyebrow={CATEGORY[item.category].label} title={item.name} compact
        actions={<>{canReport && <Button to={`/app/report/${item.id}`} icon={<Search className="h-4 w-4" />}>Report lost</Button>}{canCancel && <Button variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => tryAction(() => { state.cancelLostReport(openCase!.id); state.toast({ title: 'Report cancelled', body: `${item.name} is back to “with owner”.`, tone: 'success' }) })}>Found it, cancel report</Button>}</>} />

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div>
          {!item.photo?.startsWith('data:') ? <ProductViewer category={item.category} /> : <InventorySlot><ItemArt category={item.category} photo={item.photo} size="70%" alt={`${item.name} photo`} /></InventorySlot>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><StatusSeal tone={st.tone} label={st.label} live /></div>
          <p className="mt-2 text-[0.85rem] text-ink-3">{st.hint}</p>
          {openCase && <Button variant="secondary" size="sm" className="mt-3" to={`/app/cases/${openCase.id}`} iconRight={<ArrowRight className="h-4 w-4" />}>Open case {openCase.ref}</Button>}
        </div>
        <div className="flex flex-col gap-4">
          <Tile>
            <div className="flex items-start justify-between gap-3"><Eyebrow>Details</Eyebrow><button type="button" onClick={() => setEditOpen(true)} className="fb-press inline-flex items-center gap-1 rounded-sm text-[0.82rem] font-medium text-teal-700 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button></div>
            <dl className="mt-2 grid gap-2 text-[0.9rem] sm:grid-cols-2">
              <div><dt className="text-[0.75rem] text-ink-3">Owner</dt><dd className="font-medium">{owner?.firstName}{owner?.classLabel && person.role !== 'student' ? ` · ${owner.classLabel}` : ''}</dd></div>
              <div><dt className="text-[0.75rem] text-ink-3">Registered</dt><dd className="font-medium">{fmtDate(item.registeredAt, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
              <div className="sm:col-span-2"><dt className="text-[0.75rem] text-ink-3">Description</dt><dd>{item.description || <span className="text-ink-4">No description yet.</span>}</dd></div>
              {item.privateMarker && <div className="sm:col-span-2"><dt className="text-[0.75rem] text-ink-3">Private detail (only shown to you and verifying staff)</dt><dd>{item.privateMarker}</dd></div>}
            </dl>
          </Tile>
          <Tile className="flex items-center gap-4">
            <QRCodeView tagCode={item.tagCode} size={88} label={false} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><Eyebrow>Tag</Eyebrow><span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2 py-0.5 text-[0.68rem] font-medium text-ink-2">{item.tagType === 'nfc' ? <><Nfc className="h-3 w-3" /> NFC</> : <><QrCode className="h-3 w-3" /> QR</>}</span></div>
              <p className="font-mono text-lg font-semibold tracking-wider text-teal-800">{item.tagCode}</p>
              <p className="text-[0.78rem] text-ink-3">{item.labelCondition === 'worn' ? 'Flagged as worn. Replace it to keep the item findable.' : 'Encodes only this token. No personal data.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => setTagOpen(true)}>Print / share tag</Button>
                {item.labelCondition === 'worn' && <Button size="sm" icon={<Tag className="h-4 w-4" />} onClick={() => setRelabelOpen(true)}>Replace label</Button>}
              </div>
            </div>
          </Tile>
          <Tile>
            <Eyebrow>History</Eyebrow>
            {lastCase ? <Timeline className="mt-3" events={[{ id: 'reg', at: item.registeredAt, type: 'registered', actorId: item.guardianId ?? item.ownerId, visibility: 'owner' }, ...lastCase.events]} people={state.people} highlightLast={!!openCase} /> : <Timeline className="mt-3" events={[{ id: 'reg', at: item.registeredAt, type: 'registered', actorId: item.guardianId ?? item.ownerId, visibility: 'owner' }]} people={state.people} />}
          </Tile>
        </div>
      </div>

      <Sheet open={tagOpen} onClose={() => setTagOpen(false)} title="Tag card" description="Print at any size; the code stays readable down to 20 mm." footer={<div className="flex gap-2"><Button variant="secondary" full icon={<Share2 className="h-4 w-4" />} onClick={share}>Share link</Button><Button full icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button></div>}>
        <div className="mx-auto flex max-w-xs flex-col items-center rounded-lg border-2 border-dashed border-line-strong p-5 text-center print:border-solid">
          <QRCodeView tagCode={item.tagCode} size={180} />
          <p className="mt-2 text-[0.85rem] font-medium text-ink">If found, please hand to the school office.</p>
          <p className="text-[0.75rem] text-ink-3">FindBox · {state.school.name}</p>
        </div>
        <Note tone="demo" className="mt-4">The QR contains only the unique item reference. No personal details are printed on it.</Note>
      </Sheet>

      <Sheet open={relabelOpen} onClose={() => setRelabelOpen(false)} title="Replace the label" description="A new tag code is generated. Print the new sticker and remove the old one." footer={<Button full icon={<Tag className="h-4 w-4" />} onClick={() => tryAction(() => { const t = newTag(); state.refreshLabel(item.id, t); setRelabelOpen(false); setTagOpen(true); state.toast({ title: 'Label replaced', body: owner?.role === 'student' ? `New code ${t}. Your fresh label is ready.` : `New code ${t}.`, tone: owner?.role === 'student' ? 'reward' : 'success' }) })}>Generate new tag</Button>}>
        <p className="text-[0.9rem] text-ink-2">The old code <span className="font-mono font-semibold">{item.tagCode}</span> will stop resolving. Any open case keeps its history.</p>
      </Sheet>

      <EditSheet open={editOpen} onClose={() => setEditOpen(false)} item={item} onSave={(patch) => tryAction(() => { state.updateItemDetails(item.id, patch); setEditOpen(false); state.toast({ title: 'Saved', tone: 'success' }) })} />
      {person.role === 'student' && <p className="mt-4 text-[0.75rem] text-ink-4">Need help? Ask a grown-up or the Lost Property Office. <button type="button" className="fb-link" onClick={() => nav('/app/inbox')}>Inbox</button></p>}
    </div>
  )
}

function EditSheet({ open, onClose, item, onSave }: { open: boolean; onClose: () => void; item: { name: string; description: string; category: ItemCategory; photo: string; privateMarker?: string }; onSave: (p: { name: string; description: string; category: ItemCategory; photo: string; privateMarker?: string }) => void }) {
  const [f, setF] = useState({ name: item.name, description: item.description, category: item.category, privateMarker: item.privateMarker ?? '' })
  const [err, setErr] = useState<string>()
  return (
    <Sheet open={open} onClose={onClose} title="Edit details" footer={<div className="flex gap-2"><Button variant="secondary" full onClick={onClose}>Cancel</Button><Button full onClick={() => { if (f.name.trim().length < 2) { setErr('Give the item a name.'); return } onSave({ ...f, photo: f.category === item.category ? item.photo : `art:${f.category}`, privateMarker: f.privateMarker || undefined }) }}>Save</Button></div>}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err} required />
        <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ItemCategory })} options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY[c].label }))} />
        <Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} hint="Colour, size, anything visible." />
        <Input label="Private detail" value={f.privateMarker} onChange={(e) => setF({ ...f, privateMarker: e.target.value })} hint="Something only the owner would know. Used by staff at pickup, never shown in the gallery." />
      </div>
    </Sheet>
  )
}
