import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, PackagePlus, X } from 'lucide-react'
import { useStore, tryAction } from '@/store/useStore'
import { CATEGORY, CATEGORY_ORDER } from '@/domain/labels'
import type { ItemCategory } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, FieldWrap } from '@/components/ui/Field'
import { ItemArt } from '@/components/ui/ItemArt'
import { fileToDataUrl } from '@/lib/hooks'
import { cx } from '@/lib/util'

/** Log an unregistered find: short, task-based fields with a photo preview. Goes straight to the gallery. */
export function LogFound() {
  const state = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const handovers = state.cases.filter((c) => c.kind === 'handover' && c.status === 'handover_pending')
  const [handoverId, setHandoverId] = useState(params.get('handover') ?? '')
  const h = handovers.find((c) => c.id === handoverId)
  const [f, setF] = useState({ category: 'other' as ItemCategory, description: h?.handover?.description ?? '', locationFound: h?.handover?.location ?? '', dateFound: new Date().toISOString().slice(0, 10) })
  const [photo, setPhoto] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file?: File) => { if (!file) return; try { setPhoto(await fileToDataUrl(file)) } catch { setErr((e) => ({ ...e, photo: 'Could not read that image.' })) } }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (f.description.trim().length < 3) errs.description = 'A short description helps families recognise it.'
    if (!f.locationFound.trim()) errs.locationFound = 'Where was it found?'
    setErr(errs)
    if (Object.keys(errs).length) return
    tryAction(() => {
      const id = state.logFoundUnregistered({ record: { photo: photo ?? `art:${f.category}`, category: f.category, description: f.description.trim(), locationFound: f.locationFound.trim(), dateFound: f.dateFound }, handoverCaseId: handoverId || undefined })
      state.toast({ title: 'Listed in the Found Items Gallery', body: handoverId ? 'Handover confirmed and the finder credited.' : 'Families can now recognise and claim it.', tone: handoverId ? 'reward' : 'success' })
      nav(`/manage/cases/${id}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/manage" backLabel="Queue" title="Log a found item" lede="For items without a readable tag. It goes to the gallery; ownership is verified on claim." compact />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {!!handovers.length && <Select label="Receiving from a student handover?" value={handoverId} onChange={(e) => { setHandoverId(e.target.value); const hh = handovers.find((c) => c.id === e.target.value); if (hh) setF((s) => ({ ...s, description: s.description || hh.handover!.description, locationFound: s.locationFound || hh.handover!.location })) }} options={[{ value: '', label: 'No, walked in / found by staff' }, ...handovers.map((c) => ({ value: c.id, label: `${c.ref} · ${c.handover!.description} (${state.people.find((p) => p.id === c.handover!.reportedBy)?.firstName})` }))]} hint="Confirms custody and credits the finder." />}
        <Tile pad="sm" className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <div>
            <InventorySlot>{photo ? <img src={photo} alt="Found item" className="h-full w-full object-cover" /> : <ItemArt category={f.category} size="66%" />}</InventorySlot>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Add a photo" />
            <div className="mt-2 flex gap-2"><Button type="button" size="sm" variant="secondary" full icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{photo ? 'Retake' : 'Photo'}</Button>{photo && <Button type="button" size="sm" variant="ghost" onClick={() => setPhoto(null)} aria-label="Remove photo"><X className="h-4 w-4" /></Button>}</div>
            {err.photo && <p role="alert" className="mt-1 text-[0.78rem] text-status-danger">{err.photo}</p>}
          </div>
          <div className="flex flex-col gap-3">
            <FieldWrap label="Category" required>{() => (
              <div role="radiogroup" aria-label="Category" className="grid grid-cols-3 gap-1.5">
                {CATEGORY_ORDER.map((c) => <button key={c} type="button" role="radio" aria-checked={f.category === c} onClick={() => setF({ ...f, category: c })} className={cx('fb-press flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[0.72rem] font-medium', f.category === c ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-line bg-paper text-ink-3 hover:bg-paper-2')}><ItemArt category={c} size={22} /><span className="truncate">{CATEGORY[c].label}</span></button>)}
              </div>
            )}</FieldWrap>
            <Textarea label="Description (shown in the gallery)" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} error={err.description} placeholder="Grey fabric pencil case, zip, pencils inside" required />
          </div>
        </Tile>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Where found" value={f.locationFound} onChange={(e) => setF({ ...f, locationFound: e.target.value })} error={err.locationFound} placeholder="Art room, back bench" required />
          <Input label="Date found" type="date" value={f.dateFound} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, dateFound: e.target.value })} />
        </div>
        <Note tone="info">Only the photo, category, description, place and date are shown in the gallery. Do not include names you may find on the item.</Note>
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => nav('/manage')}>Cancel</Button><Button type="submit" full icon={<PackagePlus className="h-4 w-4" />}>Add to gallery</Button></div>
      </form>
    </div>
  )
}
