import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, MapPin, ShieldCheck, PackageCheck, Eye, ScanLine, PackagePlus } from 'lucide-react'
import { usePerson, useStore, tryAction } from '@/store/useStore'
import { capabilities } from '@/domain/permissions'
import { CASE_STATUS, CLAIM_STATUS, CATEGORY, ROLE_LABEL } from '@/domain/labels'
import type { Case, Claim } from '@/domain/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile, Eyebrow, InventorySlot, Note } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { StatusSeal } from '@/components/ui/StatusSeal'
import { Timeline } from '@/components/ui/Timeline'
import { ItemArt } from '@/components/ui/ItemArt'
import { Sheet } from '@/components/ui/Sheet'
import { Input, Textarea, Select, Checkbox } from '@/components/ui/Field'
import { NotFound } from '@/pages/NotFound'
import { fmtDate, fmtDateTime, daysBetween, cx } from '@/lib/util'

export function CaseDetail() {
  const { id } = useParams()
  const person = usePerson()!
  const state = useStore()
  const nav = useNavigate()
  const c = state.cases.find((x) => x.id === id)
  const [sheet, setSheet] = useState<null | 'reject' | 'verify' | 'rejectClaim' | 'pickup' | 'return'>(null)
  if (!c) return <NotFound />
  const caps = capabilities(person, state.school)
  const item = c.itemId ? state.items.find((i) => i.id === c.itemId) : undefined
  const owner = item && state.people.find((p) => p.id === item.ownerId)
  const guardian = owner && state.people.find((p) => p.id === owner.guardianId)
  const r = c.foundRecord
  const st = CASE_STATUS[c.status]
  const activeClaim = c.claims.find((cl) => cl.status !== 'rejected')
  const claimant = activeClaim && state.people.find((p) => p.id === activeClaim.claimantId)
  const onBehalf = activeClaim?.onBehalfOf && state.people.find((p) => p.id === activeClaim.onBehalfOf)
  const finder = r?.finderId && state.people.find((p) => p.id === r.finderId)
  const stale = c.status === 'awaiting_collection' && daysBetween(c.updatedAt, new Date().toISOString()) >= state.school.uncollectedReminderDays
  const canVerify = caps.has('verify_collection')
  const title = item?.name ?? r?.description ?? c.handover?.description ?? 'Case'

  const done = (msg: string, tone: 'success' | 'reward' | 'info' = 'success') => { setSheet(null); state.toast({ title: msg, tone }) }

  return (
    <div>
      <PageHeader back="/manage" backLabel="Queue" eyebrow={`Case ${c.ref} · ${c.kind.replace('_', ' ')}`} title={title} compact
        lede={<span className="inline-flex flex-wrap items-center gap-2"><StatusSeal tone={stale ? 'lost' : st.tone} label={stale ? `Uncollected ${Math.floor(daysBetween(c.updatedAt, new Date().toISOString()))} d` : st.label} live /><span>{st.next}</span></span>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* Comparison panel */}
          {(c.status === 'potential_match' || (item && r)) && item && r && (
            <Tile>
              <Eyebrow><Eye className="mr-1 inline h-3.5 w-3.5" />Compare</Eyebrow>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ComparePane heading="Found item" category={r.category} photo={r.photo} rows={[['Description', r.description || '—'], ['Found at', r.locationFound], ['Date', fmtDate(r.dateFound)], ['Logged by', state.people.find((p) => p.id === r.loggedBy)?.name ?? 'Staff'], ...(finder ? [['Handed in by', `${finder.name} (${finder.classLabel})`] as [string, string]] : [])]} />
                <ComparePane heading="Registered record" category={item.category} photo={item.photo} accent rows={[['Item', item.name], ['Category', CATEGORY[item.category].label], ['Description', item.description || '—'], ['Tag', item.tagCode], ['Private detail', item.privateMarker ?? '—'], ['Owner', `${owner?.name ?? ''}${owner?.classLabel ? ` (${owner.classLabel})` : ''}`]]} />
              </div>
              {c.lostReport && <p className="mt-3 text-[0.85rem] text-ink-2"><span className="font-medium">Lost report:</span> last seen {c.lostReport.lastSeen}, {c.lostReport.approxDate}{c.lostReport.notes ? `. “${c.lostReport.notes}”` : ''}</p>}
            </Tile>
          )}

          {/* Claim panel */}
          {c.kind === 'found_unregistered' && r && (
            <Tile>
              <Eyebrow>Found item</Eyebrow>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ComparePane heading="In gallery" category={r.category} photo={r.photo} rows={[['Description', r.description], ['Found at', r.locationFound], ['Date', fmtDate(r.dateFound)], ...(finder ? [['Handed in by', `${finder.name} (${finder.classLabel})`] as [string, string]] : [])]} />
                {activeClaim ? (
                  <div className="rounded-md border border-[#cfc8ea] bg-[#efedf8]/40 p-3">
                    <div className="flex items-center justify-between"><p className="text-[0.72rem] font-semibold uppercase tracking-wider text-status-review">Claim</p><StatusSeal tone={CLAIM_STATUS[activeClaim.status].tone} label={CLAIM_STATUS[activeClaim.status].label} size="sm" /></div>
                    <p className="mt-2 text-[0.9rem] text-ink">“{activeClaim.evidence}”</p>
                    <dl className="mt-2 text-[0.8rem] text-ink-3"><div><dt className="inline">By: </dt><dd className="inline font-medium text-ink-2">{claimant?.name} ({claimant ? ROLE_LABEL[claimant.role] : ''}){onBehalf ? ` for ${onBehalf.name} (${onBehalf.classLabel})` : ''}</dd></div><div><dt className="inline">Submitted: </dt><dd className="inline">{fmtDateTime(activeClaim.submittedAt)}</dd></div></dl>
                    <p className="mt-2 text-[0.75rem] text-ink-3">Does the description name something not visible in the gallery card?</p>
                  </div>
                ) : <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line-strong p-4 text-center text-[0.85rem] text-ink-3"><p>No open claim.</p>{c.claims.length > 0 && <p className="mt-1 text-[0.75rem]">{c.claims.length} earlier claim{c.claims.length > 1 ? 's' : ''} not verified.</p>}</div>}
              </div>
            </Tile>
          )}

          {/* Handover */}
          {c.kind === 'handover' && c.handover && (
            <Tile>
              <Eyebrow>Student handover</Eyebrow>
              <p className="mt-2 text-[0.95rem] text-ink">“{c.handover.description}” · found at {c.handover.location}</p>
              <p className="text-[0.8rem] text-ink-3">Reported by {state.people.find((p) => p.id === c.handover!.reportedBy)?.name} ({state.people.find((p) => p.id === c.handover!.reportedBy)?.classLabel}), {fmtDateTime(c.handover.reportedAt)}</p>
              {c.status === 'handover_pending' ? (
                <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" to={`/manage/scan?handover=${c.id}`} icon={<ScanLine className="h-4 w-4" />}>Scan its tag</Button><Button size="sm" variant="secondary" to={`/manage/log?handover=${c.id}`} icon={<PackagePlus className="h-4 w-4" />}>Log as unregistered</Button></div>
              ) : <p className="mt-2 text-[0.85rem] text-status-done"><Check className="mr-1 inline h-4 w-4" />Confirmed. Linked case: <button type="button" className="fb-link" onClick={() => nav(`/manage/cases/${c.handover!.linkedCaseId}`)}>open</button></p>}
              <Note tone="info" className="mt-3">Confirming custody credits the student. The owner is never revealed to the finder.</Note>
            </Tile>
          )}

          {c.status === 'reported_lost' && item && (
            <Tile><Eyebrow>Lost report</Eyebrow><p className="mt-2 text-[0.95rem]">Last seen {c.lostReport?.lastSeen}, {c.lostReport?.approxDate}.{c.lostReport?.notes ? ` “${c.lostReport.notes}”` : ''}</p><p className="mt-1 text-[0.8rem] text-ink-3">Tag {item.tagCode} · {CATEGORY[item.category].label}{item.privateMarker ? ` · private detail on record` : ''}</p><Button size="sm" className="mt-3" to="/manage/scan" icon={<ScanLine className="h-4 w-4" />}>Scan when it turns up</Button></Tile>
          )}

          <Tile><Eyebrow>History (staff view)</Eyebrow><Timeline className="mt-3" events={c.events} people={state.people} staffView highlightLast={!['returned', 'closed'].includes(c.status)} /></Tile>
        </div>

        {/* Actions */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--nav-h)+16px)] lg:self-start">
          <Tile className={cx(c.status === 'awaiting_collection' && '!border-teal-500')}>
            <Eyebrow>Decision</Eyebrow>
            <div className="mt-3 flex flex-col gap-2">
              {c.status === 'potential_match' && caps.has('review_matches') && <>
                <Button full icon={<Check className="h-4 w-4" />} onClick={() => tryAction(() => { state.confirmMatch(c.id); done('Match confirmed. Family notified.') })}>Confirm match</Button>
                <Button full variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setSheet('reject')}>Not the same item</Button>
                <p className="text-[0.75rem] text-ink-3">Confirming tells the family it has been found. It does not release anything.</p>
              </>}
              {c.status === 'claim_submitted' && caps.has('review_claims') && <Button full icon={<Eye className="h-4 w-4" />} onClick={() => tryAction(() => { state.startClaimReview(c.id); done('Review started', 'info') })}>Start review</Button>}
              {c.status === 'claim_under_review' && caps.has('review_claims') && <>
                <Button full icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setSheet('verify')}>Verify claim</Button>
                <Button full variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setSheet('rejectClaim')}>Reject claim</Button>
              </>}
              {['match_confirmed', 'claim_verified'].includes(c.status) && caps.has('assign_pickup') && <Button full icon={<MapPin className="h-4 w-4" />} onClick={() => setSheet('pickup')}>Arrange pickup</Button>}
              {['match_confirmed', 'claim_verified'].includes(c.status) && !caps.has('assign_pickup') && <p className="text-[0.85rem] text-ink-3">Staff arrange the pickup.</p>}
              {c.status === 'awaiting_collection' && (canVerify ? <Button full icon={<PackageCheck className="h-4 w-4" />} onClick={() => setSheet('return')}>Verify and record return</Button> : <Note tone="warn">Your account is not authorised to record a release. Ask an authorised colleague ({state.people.filter((p) => state.school.staffCanVerifyCollection.includes(p.id)).map((p) => p.name).join(', ')}).</Note>)}
              {c.status === 'found_unregistered' && <p className="text-[0.85rem] text-ink-3">Waiting for a claim. The item is visible in the gallery.</p>}
              {c.status === 'reported_lost' && <p className="text-[0.85rem] text-ink-3">Nothing to decide until a found item is scanned or matched.</p>}
              {['returned', 'closed'].includes(c.status) && <p className="flex items-center gap-2 text-[0.9rem] font-medium text-status-done"><Check className="h-4 w-4" />{c.status === 'returned' ? `Returned ${c.returnedAt ? fmtDateTime(c.returnedAt) : ''}` : 'Closed'}</p>}
            </div>
          </Tile>

          {c.pickupLocation && <Tile pad="sm"><Eyebrow>Pickup</Eyebrow><p className="mt-1 font-medium">{c.pickupLocation}</p>{c.pickupWindow && <p className="text-[0.85rem] text-ink-3">{c.pickupWindow}</p>}</Tile>}

          {caps.has('view_owner_identity') && (owner || claimant) && (
            <Tile pad="sm">
              <Eyebrow>Family (staff only)</Eyebrow>
              {owner && <p className="mt-1 text-[0.9rem]"><span className="font-medium">{owner.name}</span> {owner.classLabel && `· ${owner.classLabel}`}{guardian && <span className="block text-[0.8rem] text-ink-3">Guardian: {guardian.name}</span>}</p>}
              {claimant && !owner && <p className="mt-1 text-[0.9rem]"><span className="font-medium">{claimant.name}</span> <span className="text-ink-3">· {ROLE_LABEL[claimant.role]}</span></p>}
              <p className="mt-1 text-[0.72rem] text-ink-4">Never shown in the gallery or to other families.</p>
            </Tile>
          )}
        </aside>
      </div>

      <RejectMatchSheet open={sheet === 'reject'} onClose={() => setSheet(null)} onConfirm={(reason) => tryAction(() => { state.rejectMatch(c.id, reason); done('Moved to the gallery as unregistered', 'info'); nav('/manage') })} />
      <ClaimSheet open={sheet === 'verify'} mode="verify" onClose={() => setSheet(null)} claim={activeClaim} onConfirm={(note) => tryAction(() => { state.verifyClaim(c.id, activeClaim!.id, note); done('Claim verified. Claimant notified.') })} />
      <ClaimSheet open={sheet === 'rejectClaim'} mode="reject" onClose={() => setSheet(null)} claim={activeClaim} onConfirm={(note) => tryAction(() => { state.rejectClaim(c.id, activeClaim!.id, note); done('Claim not verified. Item relisted.', 'info') })} />
      <PickupSheet open={sheet === 'pickup'} onClose={() => setSheet(null)} locations={state.school.pickupLocations} onConfirm={(loc, win) => tryAction(() => { state.assignPickup(c.id, loc, win); done('Pickup arranged. Family notified.') })} />
      <ReturnSheet open={sheet === 'return'} onClose={() => setSheet(null)} c={c} hasFinder={!!finder} privateMarker={item?.privateMarker} onConfirm={(method, note) => tryAction(() => { state.confirmReturn(c.id, { method, note }); done('Returned. Case closed.', finder ? 'reward' : 'success') })} />
    </div>
  )
}

function ComparePane({ heading, category, photo, rows, accent }: { heading: string; category: Parameters<typeof ItemArt>[0]['category']; photo?: string; rows: [string, string][]; accent?: boolean }) {
  return (
    <div className={cx('rounded-md border p-3', accent ? 'border-teal-200 bg-teal-50/40' : 'border-line bg-paper-2/60')}>
      <p className={cx('text-[0.72rem] font-semibold uppercase tracking-wider', accent ? 'text-teal-700' : 'text-ink-3')}>{heading}</p>
      <InventorySlot className="mt-2 !aspect-[4/3]"><ItemArt category={category} photo={photo} size="60%" /></InventorySlot>
      <dl className="mt-2 space-y-1 text-[0.82rem]">{rows.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 text-ink-3">{k}</dt><dd className="min-w-0 break-words font-medium text-ink">{v}</dd></div>)}</dl>
    </div>
  )
}

function RejectMatchSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title="Not the same item" description="The found object goes to the gallery as unregistered. Any lost report stays open." footer={<div className="flex gap-2"><Button variant="secondary" full onClick={onClose}>Cancel</Button><Button variant="danger" full onClick={() => onConfirm(reason.trim() || 'Does not match the registered record')}>Reject match</Button></div>}>
      <Textarea label="Reason (for the record)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Different colour lid; tag appears to have been moved." />
    </Sheet>
  )
}

function ClaimSheet({ open, mode, onClose, claim, onConfirm }: { open: boolean; mode: 'verify' | 'reject'; onClose: () => void; claim?: Claim; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [err, setErr] = useState<string>()
  const verify = mode === 'verify'
  return (
    <Sheet open={open} onClose={onClose} title={verify ? 'Verify claim' : 'Reject claim'} description={verify ? 'Record what matched. The claimant is told the claim is verified; nothing is released yet.' : 'The item is relisted in the gallery and the claimant is told, without detail that would help a second guess.'}
      footer={<div className="flex gap-2"><Button variant="secondary" full onClick={onClose}>Cancel</Button><Button variant={verify ? 'primary' : 'danger'} full onClick={() => { if (!verify && !note.trim()) { setErr('Add a short reason.'); return } if (verify && !checked) { setErr('Confirm you compared the claim with the item.'); return } onConfirm(note.trim()) }}>{verify ? 'Verify' : 'Reject'}</Button></div>}>
      {claim && <blockquote className="mb-4 rounded-md border-l-2 border-status-review bg-paper-2 p-3 text-[0.9rem] text-ink-2">“{claim.evidence}”</blockquote>}
      <Textarea label={verify ? 'What matched' : 'Reason'} value={note} onChange={(e) => { setNote(e.target.value); setErr(undefined) }} error={!verify ? err : undefined} placeholder={verify ? 'Ink stain inside lid confirmed; sharpener present.' : 'Described a blue case; this one is grey.'} />
      {verify && <Checkbox className="mt-3" label="I compared the claim with the physical item" checked={checked} onChange={(e) => { setChecked(e.target.checked); setErr(undefined) }} />}
      {verify && err && <p role="alert" className="mt-2 text-[0.8rem] font-medium text-status-danger">{err}</p>}
    </Sheet>
  )
}

function PickupSheet({ open, onClose, locations, onConfirm }: { open: boolean; onClose: () => void; locations: string[]; onConfirm: (loc: string, win: string) => void }) {
  const [loc, setLoc] = useState(locations[0] ?? '')
  const [win, setWin] = useState('Weekdays 15:00 to 16:00')
  return (
    <Sheet open={open} onClose={onClose} title="Arrange pickup" description="The family receives the location and window with the case code." footer={<div className="flex gap-2"><Button variant="secondary" full onClick={onClose}>Cancel</Button><Button full icon={<MapPin className="h-4 w-4" />} onClick={() => onConfirm(loc, win)}>Send collection details</Button></div>}>
      <div className="flex flex-col gap-4">
        <Select label="Location" value={loc} onChange={(e) => setLoc(e.target.value)} options={locations.map((l) => ({ value: l, label: l }))} />
        <Input label="Window" value={win} onChange={(e) => setWin(e.target.value)} placeholder="Weekdays 15:00 to 16:00" />
      </div>
    </Sheet>
  )
}

function ReturnSheet({ open, onClose, c, hasFinder, privateMarker, onConfirm }: { open: boolean; onClose: () => void; c: Case; hasFinder: boolean; privateMarker?: string; onConfirm: (method: string, note: string) => void }) {
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [verified, setVerified] = useState(false)
  const [err, setErr] = useState<string>()
  const methods = ['Guardian ID and tag scan', 'Described the private detail correctly', 'Student identified by class teacher', 'Claimant matched claim details in person']
  return (
    <Sheet open={open} onClose={onClose} title="Verify ownership and record return" description={`Case ${c.ref}. Two explicit steps: verification, then release.`}
      footer={<div className="flex gap-2"><Button variant="secondary" full onClick={onClose}>Cancel</Button><Button full disabled={!verified || !method} icon={<PackageCheck className="h-4 w-4" />} onClick={() => { if (!method) { setErr('Choose how ownership was verified.'); return } onConfirm(method, note.trim()) }}>Confirm return</Button></div>}>
      <div className="flex flex-col gap-4">
        {privateMarker && <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-[0.85rem]"><p className="text-[0.72rem] font-semibold uppercase tracking-wider text-teal-700">Ask the collector</p><p className="mt-1 text-ink">Private detail on record: “{privateMarker}”</p></div>}
        <Select label="1. How was ownership verified?" value={method} onChange={(e) => { setMethod(e.target.value); setErr(undefined) }} error={err} options={[{ value: '', label: 'Choose…' }, ...methods.map((m) => ({ value: m, label: m }))]} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Collected by guardian at 15:20." />
        <Checkbox label="2. I verified ownership and am releasing the item" hint="This action is logged against your account." checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        {hasFinder && <Note tone="info">A student finder is linked to this case and will be credited for the full circle once you confirm.</Note>}
      </div>
    </Sheet>
  )
}
