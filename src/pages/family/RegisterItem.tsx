import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Printer, ArrowRight, Nfc, QrCode, Plus, X } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { CATEGORY, CATEGORY_ORDER } from '@/domain/labels'
import type { ItemCategory } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, FieldWrap } from '@/components/ui/Field'
import { ItemArt } from '@/components/ui/ItemArt'
import { QRCodeView } from '@/components/ui/QRCodeView'
import { Segmented } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { fileToDataUrl } from '@/lib/hooks'
import { tagCode as genTag, cx } from '@/lib/util'

export function RegisterItem() {
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const caps = capabilities(person, state.school)
  const kids = state.people.filter((p) => person.childIds?.includes(p.id))
  const [f, setF] = useState({ ownerId: person.role === 'student' ? person.id : kids[0]?.id ?? '', name: '', category: 'bottle' as ItemCategory, description: '', privateMarker: '', tagType: 'qr' as 'qr' | 'nfc' })
  const [photo, setPhoto] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})
  const [done, setDone] = useState<{ id: string; tag: string } | null>(null)
  const tag = useMemo(() => genTag(), [done])
  const fileRef = useRef<HTMLInputElement>(null)

  if (!caps.has('register_item')) return <EmptyState title="Registration is handled by a guardian" body="Your school has not enabled student registration. Ask a parent or the office to add belongings." action={<Button to="/app/home">Home</Button>} />

  const onFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr((e) => ({ ...e, photo: 'Choose an image file.' })); return }
    try { setPhoto(await fileToDataUrl(file)); setErr((e) => ({ ...e, photo: '' })) } catch { setErr((e) => ({ ...e, photo: 'Could not read that image.' })) }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (f.name.trim().length < 2) errs.name = 'Give the item a name, e.g. “Blue steel water bottle”.'
    if (!f.ownerId) errs.ownerId = 'Choose whose belonging this is.'
    setErr(errs)
    if (Object.keys(errs).length) return
    tryAction(() => {
      const id = state.registerItem({ name: f.name, category: f.category, description: f.description, ownerId: f.ownerId, guardianId: person.role === 'parent' ? person.id : undefined, photo: photo ?? `art:${f.category}`, tagCode: tag, tagType: f.tagType, privateMarker: f.privateMarker, actorId: person.id })
      setDone({ id, tag })
      const ownerIsStudent = state.people.find((p) => p.id === f.ownerId)?.role === 'student'
      state.toast({ title: 'Belonging registered', body: ownerIsStudent && person.role === 'student' ? 'Your belonging is connected. Attach its label to help it home.' : `Tag ${tag} is ready to print.`, tone: person.role === 'student' ? 'reward' : 'success' })
    })
  }

  if (done) return (
    <div className="mx-auto max-w-lg">
      <div className="fb-tile fb-sheet-in flex flex-col items-center p-6 text-center">
        <span className="fb-settle flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f3ec] text-status-done"><Check className="h-7 w-7" /></span>
        <h1 className="fb-display mt-3 text-[1.8rem] text-ink">Tag ready</h1>
        <p className="mt-1 text-ink-3">Print it, stick it on, done. The record stays private to your family and the school.</p>
        <div className="mt-5 rounded-lg border-2 border-dashed border-line-strong p-4"><QRCodeView tagCode={done.tag} size={170} /><p className="mt-2 text-[0.8rem] font-medium">If found, please hand to the school office.</p></div>
        <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="secondary" full icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print tag</Button>
          <Button full onClick={() => nav(`/app/items/${done.id}`)} iconRight={<ArrowRight className="h-4 w-4" />}>View item</Button>
        </div>
        <button type="button" onClick={() => { setDone(null); setPhoto(null); setF((s) => ({ ...s, name: '', description: '', privateMarker: '' })) }} className="fb-link mt-4 text-[0.85rem]">Register another</button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/app/home" title="Register a belonging" lede="A photo, a category and a tag. Under a minute." compact />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {person.role === 'parent' && kids.length > 0 && (
          <FieldWrap label="Whose belonging?" error={err.ownerId} required>{() => (
            <Segmented ariaLabel="Child" value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={kids.map((k) => ({ value: k.id, label: `${k.firstName}${k.classLabel ? ` · ${k.classLabel}` : ''}` }))} />
          )}</FieldWrap>
        )}

        <Tile pad="sm" className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <InventorySlot>{photo ? <img src={photo} alt="Your photo" className="h-full w-full object-cover" /> : <ItemArt category={f.category} size="70%" />}</InventorySlot>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Add a photo" />
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant="secondary" full icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{photo ? 'Change' : 'Add photo'}</Button>
              {photo && <Button type="button" size="sm" variant="ghost" onClick={() => setPhoto(null)} aria-label="Remove photo"><X className="h-4 w-4" /></Button>}
            </div>
            {err.photo && <p role="alert" className="mt-1 text-[0.78rem] text-status-danger">{err.photo}</p>}
            <p className="mt-1 text-[0.72rem] text-ink-4">Optional. Photos are resized and saved on this device.</p>
          </div>
          <div className="flex flex-col gap-4">
            <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err.name} placeholder="Blue steel water bottle" autoComplete="off" required />
            <FieldWrap label="Category" required>{() => (
              <div role="radiogroup" aria-label="Category" className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {CATEGORY_ORDER.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={f.category === c} onClick={() => setF({ ...f, category: c })} className={cx('fb-press flex flex-col items-center gap-1 rounded-md border p-2 text-[0.68rem] font-medium', f.category === c ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-line bg-paper text-ink-3 hover:bg-paper-2')}>
                    <ItemArt category={c} size={34} /><span className="truncate">{CATEGORY[c].label}</span>
                  </button>
                ))}
              </div>
            )}</FieldWrap>
          </div>
        </Tile>

        <Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} hint="Colour, size, stickers. Helps staff compare a found item." />
        <Input label="Private detail" value={f.privateMarker} onChange={(e) => setF({ ...f, privateMarker: e.target.value })} hint="Something only the owner knows (a dent, a name inside). Used at pickup; never shown in the gallery." />

        <Tile pad="sm" className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <QRCodeView tagCode={tag} size={96} />
          <div>
            <Eyebrow>Identifier</Eyebrow>
            <Select label="Tag type" value={f.tagType} onChange={(e) => setF({ ...f, tagType: e.target.value as 'qr' | 'nfc' })} options={[{ value: 'qr', label: 'QR sticker (recommended)' }, { value: 'nfc', label: 'NFC sticker' }]} className="mt-1" />
            <p className="mt-1.5 flex items-center gap-1 text-[0.75rem] text-ink-3">{f.tagType === 'nfc' ? <><Nfc className="h-3.5 w-3.5" /> For water bottles, kit bags and things that get handled a lot.</> : <><QrCode className="h-3.5 w-3.5" /> Prints anywhere. Scans with any phone camera.</>}</p>
          </div>
        </Tile>

        <Note tone="demo">The tag encodes only <span className="font-mono">{tag}</span>. Nothing about the child is on the sticker.</Note>
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => nav(-1)}>Cancel</Button><Button type="submit" full icon={<Plus className="h-4 w-4" />}>Save and get tag</Button></div>
      </form>
    </div>
  )
}
