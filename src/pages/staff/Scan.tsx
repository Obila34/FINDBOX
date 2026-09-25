import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, CameraOff, Keyboard, Nfc, Check, X, PackagePlus, AlertTriangle, RotateCcw } from 'lucide-react'
import { useStore, tryAction } from '@/store/useStore'
import { openCaseForItem } from '@/domain/transitions'
import { CATEGORY, ITEM_STATUS } from '@/domain/labels'
import type { Item } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Field'
import { ItemArt } from '@/components/ui/ItemArt'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { useScanner } from '@/lib/useScanner'
import { normaliseTag, isTagLike, fmtRelative, cx } from '@/lib/util'

type Result = { kind: 'match'; item: Item } | { kind: 'none'; code: string } | { kind: 'invalid'; raw: string } | null

/** Scan a QR with the camera, enter a code manually, or enter the reference printed on an NFC tag. A match still requires staff decisions afterwards. */
export function Scan() {
  const state = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [result, setResult] = useState<Result>(null)
  const [manual, setManual] = useState('')
  const [handoverId, setHandoverId] = useState(params.get('handover') ?? '')
  const handovers = state.cases.filter((c) => c.kind === 'handover' && c.status === 'handover_pending')
  const [form, setForm] = useState({ locationFound: '', dateFound: new Date().toISOString().slice(0, 10), description: '' })
  const [err, setErr] = useState<Record<string, string>>({})

  const resolve = (raw: string) => {
    const code = normaliseTag(raw)
    if (!isTagLike(code)) { setResult({ kind: 'invalid', raw }); return }
    const item = state.items.find((i) => i.tagCode === code)
    setResult(item ? { kind: 'match', item } : { kind: 'none', code })
  }
  const { videoRef, state: cam, start, stop } = useScanner((text) => { resolve(text); stop() })
  useEffect(() => () => stop(), [stop])
  useEffect(() => { const h = handovers.find((c) => c.id === handoverId); if (h) setForm((f) => ({ ...f, locationFound: f.locationFound || h.handover!.location })) }, [handoverId, handovers])

  const submitManual = (e: FormEvent) => { e.preventDefault(); if (!manual.trim()) return; resolve(manual) }
  const focusTag = () => { document.querySelector<HTMLInputElement>('input[placeholder="FB-7K2M-Q4"]')?.focus() }

  const logRegistered = () => {
    if (result?.kind !== 'match') return
    const errs: Record<string, string> = {}
    if (!form.locationFound.trim()) errs.locationFound = 'Where was it found?'
    setErr(errs)
    if (Object.keys(errs).length) return
    tryAction(() => {
      const caseId = state.logFoundRegistered(result.item.id, { record: { photo: result.item.photo, category: result.item.category, description: form.description, locationFound: form.locationFound, dateFound: form.dateFound }, handoverCaseId: handoverId || undefined })
      state.toast({ title: 'Found item logged', body: handoverId ? 'Handover confirmed and the finder credited. Now compare and confirm the match.' : 'Now compare with the record and confirm the match.', tone: handoverId ? 'reward' : 'success' })
      nav(`/manage/cases/${caseId}`)
    })
  }

  const reset = () => { setResult(null); setManual(''); setErr({}) }
  const existing = result?.kind === 'match' ? openCaseForItem(state, result.item.id) : undefined
  const owner = result?.kind === 'match' ? state.people.find((p) => p.id === result.item.ownerId) : undefined
  const inCustody = result?.kind === 'match' && ['potential_match', 'match_confirmed', 'awaiting_collection'].includes(result.item.status)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back="/manage" backLabel="Queue" title="Scan a tag" lede="Point the camera at a FindBox QR, type the code, or simulate an NFC tap. Scanning identifies; it never releases." compact />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Tile pad="sm">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-teal-900">
              <video ref={videoRef} className={cx('h-full w-full object-cover', cam !== 'scanning' && 'hidden')} muted playsInline aria-label="Camera preview" />
              {cam === 'scanning' && <div className="pointer-events-none absolute inset-8 rounded-md border-2 border-teal-300/90" aria-hidden="true"><span className="absolute inset-x-0 top-1/2 h-px bg-teal-300/70" /></div>}
              {cam !== 'scanning' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-teal-100">
                  {cam === 'denied' ? <><CameraOff className="h-8 w-8" /><p className="text-[0.9rem] font-medium text-white">Camera permission denied</p><p className="text-[0.8rem]">Allow the camera in your browser settings, or enter the code by hand.</p></>
                    : cam === 'unsupported' ? <><CameraOff className="h-8 w-8" /><p className="text-[0.9rem] font-medium text-white">Camera not available here</p><p className="text-[0.8rem]">Needs HTTPS and a device camera. Manual entry works everywhere.</p></>
                    : cam === 'error' ? <><AlertTriangle className="h-8 w-8" /><p className="text-[0.9rem] font-medium text-white">Could not start the camera</p></>
                    : cam === 'requesting' ? <><Camera className="h-8 w-8 animate-pulse" /><p className="text-[0.85rem]">Waiting for permission…</p></>
                    : <><Camera className="h-8 w-8" /><p className="text-[0.9rem] font-medium text-white">Camera is off</p><p className="text-[0.8rem]">You will be asked for permission.</p></>}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cam === 'scanning' ? <Button variant="secondary" onClick={stop} icon={<CameraOff className="h-4 w-4" />}>Stop camera</Button> : <Button onClick={start} icon={<Camera className="h-4 w-4" />} loading={cam === 'requesting'}>Start camera</Button>}
              <Button variant="secondary" onClick={focusTag} icon={<Nfc className="h-4 w-4" />}>Enter NFC reference</Button>
            </div>
            <p className="mt-2 text-[0.75rem] text-ink-4">For an NFC tag, enter its linked FindBox reference below. Camera scanning works with QR labels.</p>
          </Tile>
          <Tile pad="sm">
            <Eyebrow><Keyboard className="mr-1 inline h-3.5 w-3.5" />Manual entry</Eyebrow>
            <form onSubmit={submitManual} className="mt-2 flex gap-2">
              <Input label="Tag code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="FB-7K2M-Q4" autoCapitalize="characters" autoComplete="off" className="flex-1" />
              <Button type="submit" className="self-end">Look up</Button>
            </form>
            {!!handovers.length && (
              <Select className="mt-3" label="Receiving from a student handover?" value={handoverId} onChange={(e) => setHandoverId(e.target.value)} options={[{ value: '', label: 'No, walked in / found by staff' }, ...handovers.map((h) => ({ value: h.id, label: `${h.ref} · ${h.handover!.description} (${state.people.find((p) => p.id === h.handover!.reportedBy)?.firstName})` }))]} hint="Confirms custody and credits the finder once the item is logged." />
            )}
          </Tile>
        </div>

        <div>
          {!result && <Tile className="flex h-full min-h-[240px] flex-col items-center justify-center text-center"><InventorySlot empty size="sm" className="!h-16 !w-16"><span className="text-ink-4">?</span></InventorySlot><p className="mt-3 font-medium text-ink">Waiting for a tag</p><p className="max-w-xs text-[0.85rem] text-ink-3">The result appears here: a direct match, no match, or an invalid code.</p></Tile>}
          {result?.kind === 'invalid' && (
            <Tile className="fb-sheet-in !border-[#efbdb8]"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fbe9e7] text-status-danger"><X className="h-5 w-5" /></span><div><p className="font-semibold text-ink">Not a FindBox code</p><p className="text-[0.85rem] text-ink-3">“{result.raw.slice(0, 60)}” is not in the FB-XXXX-XX format. Check the sticker or try the camera again.</p><Button size="sm" variant="secondary" className="mt-3" onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>Try again</Button></div></div></Tile>
          )}
          {result?.kind === 'none' && (
            <Tile className="fb-sheet-in"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper-3 text-ink-2"><AlertTriangle className="h-5 w-5" /></span><div><p className="font-semibold text-ink">No record for {result.code}</p><p className="text-[0.85rem] text-ink-3">The code is well-formed but not registered at this school. Log it as an unregistered find so it goes to the gallery.</p><div className="mt-3 flex gap-2"><Button size="sm" to={`/manage/log${handoverId ? `?handover=${handoverId}` : ''}`} icon={<PackagePlus className="h-4 w-4" />}>Log unregistered</Button><Button size="sm" variant="secondary" onClick={reset}>Scan another</Button></div></div></div></Tile>
          )}
          {result?.kind === 'match' && (
            <Tile className="fb-sheet-in !border-teal-500">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-700 text-white"><Check className="h-4 w-4" /></span><Eyebrow>Direct match</Eyebrow></div>
              <div className="mt-3 flex gap-3">
                <InventorySlot size="sm" className="!h-20 !w-20 shrink-0"><ItemArt category={result.item.category} photo={result.item.photo} size={56} /></InventorySlot>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{result.item.name}</p>
                  <p className="text-[0.8rem] text-ink-3">{CATEGORY[result.item.category].label} · <span className="font-mono">{result.item.tagCode}</span></p>
                  <p className="text-[0.8rem] text-ink-3">Owner: {owner?.name}{owner?.classLabel ? ` (${owner.classLabel})` : ''}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5"><StatusSeal tone={ITEM_STATUS[result.item.status].tone} label={ITEM_STATUS[result.item.status].label} size="sm" />{existing && <span className="text-[0.75rem] text-ink-3">Case {existing.ref}, {fmtRelative(existing.updatedAt)}</span>}</div>
                  {result.item.description && <p className="mt-1 text-[0.8rem] text-ink-2">{result.item.description}</p>}
                </div>
              </div>
              {inCustody ? (
                <div className="mt-4"><Note tone="warn">This item is already in custody (case {existing?.ref}). Open the case instead of logging it twice.</Note><div className="mt-3 flex gap-2"><Button size="sm" to={`/manage/cases/${existing?.id}`}>Open case</Button><Button size="sm" variant="secondary" onClick={reset}>Scan another</Button></div></div>
              ) : (
                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                  <p className="text-[0.85rem] text-ink-2">{existing ? <>Reported lost {fmtRelative(existing.createdAt)}: last seen {existing.lostReport?.lastSeen}.</> : 'Never reported lost. Logging it opens a case and notifies the family after you confirm the match.'}</p>
                  <Input label="Where was it found?" value={form.locationFound} onChange={(e) => setForm({ ...form, locationFound: e.target.value })} error={err.locationFound} placeholder="Sports pavilion crate" required />
                  <div className="grid grid-cols-2 gap-3"><Input label="Date found" type="date" value={form.dateFound} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, dateFound: e.target.value })} /><Textarea label="Condition / note" rows={1} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="flex gap-2"><Button variant="secondary" onClick={reset}>Cancel</Button><Button full onClick={logRegistered} icon={<PackagePlus className="h-4 w-4" />}>Log and open case</Button></div>
                </div>
              )}
            </Tile>
          )}
        </div>
      </div>
    </div>
  )
}
