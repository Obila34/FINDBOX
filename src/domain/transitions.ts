import type {
  AppState, Case, CaseEvent, CaseStatus, EventType, FoundRecord, Item, ItemCategory, ItemStatus, Notification, Person,
} from './types'
import { award } from './quest'
import { nowIso, uid } from '@/lib/util'

/** Pure state transitions. Every action returns a new AppState and never mutates. Guards throw with a human message. */

export class TransitionError extends Error {}

const guard = (cond: unknown, msg: string) => { if (!cond) throw new TransitionError(msg) }

function ev(type: EventType, actorId: string | 'system', visibility: 'owner' | 'staff', note?: string): CaseEvent {
  return { id: uid('ev'), at: nowIso(), type, actorId, note, visibility }
}

function note(toPersonId: string, kind: Notification['kind'], title: string, body: string, caseId?: string, itemId?: string): Notification {
  return { id: uid('n'), toPersonId, at: nowIso(), title, body, caseId, itemId, read: false, kind }
}

function nextRef(state: AppState): string {
  const max = state.cases.reduce((m, c) => Math.max(m, parseInt(c.ref.replace(/\D/g, ''), 10) || 0), 0)
  return `FB-${String(max + 1).padStart(4, '0')}`
}

function updateCase(state: AppState, caseId: string, fn: (c: Case) => Case): AppState {
  return { ...state, cases: state.cases.map((c) => (c.id === caseId ? { ...fn(c), updatedAt: nowIso() } : c)) }
}
function updateItem(state: AppState, itemId: string, patch: Partial<Item>): AppState {
  return { ...state, items: state.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
}
function push(state: AppState, ...ns: Notification[]): AppState {
  return { ...state, notifications: [...ns, ...state.notifications] }
}
function staffIds(state: AppState): string[] {
  return state.people.filter((p) => p.role === 'staff').map((p) => p.id)
}
/** Guardian first, then the student (if the school allows student accounts). */
function ownerRecipients(state: AppState, item: Item): string[] {
  const ids = new Set<string>()
  if (item.guardianId) ids.add(item.guardianId)
  const owner = state.people.find((p) => p.id === item.ownerId)
  if (owner?.guardianId) ids.add(owner.guardianId)
  if (state.school.studentAccountsEnabled) ids.add(item.ownerId)
  return [...ids]
}
export function openCaseForItem(state: AppState, itemId: string): Case | undefined {
  return state.cases.find((c) => c.itemId === itemId && !['returned', 'closed'].includes(c.status))
}

// ---------- Registration ----------

export interface RegisterInput {
  name: string; category: ItemCategory; description: string; ownerId: string; guardianId?: string
  photo: string; tagCode: string; tagType: 'qr' | 'nfc'; privateMarker?: string; actorId: string
}
export function registerItem(state: AppState, input: RegisterInput): { state: AppState; item: Item } {
  guard(input.name.trim().length >= 2, 'Give the item a name.')
  guard(!state.items.some((i) => i.tagCode === input.tagCode), 'That tag is already in use.')
  const item: Item = {
    id: uid('item'), name: input.name.trim(), category: input.category, description: input.description.trim(),
    ownerId: input.ownerId, guardianId: input.guardianId, photo: input.photo, tagCode: input.tagCode, tagType: input.tagType,
    labelCondition: 'good', registeredAt: nowIso(), status: 'with_owner', privateMarker: input.privateMarker?.trim() || undefined,
  }
  let next: AppState = { ...state, items: [item, ...state.items] }
  const owner = state.people.find((p) => p.id === item.ownerId)
  if (owner?.role === 'student') {
    next = { ...next, ledger: award(next.ledger, { key: `register:${item.id}`, studentId: owner.id, action: 'register_item', at: nowIso(), itemId: item.id }) }
    if (state.school.studentAccountsEnabled) {
      next = push(next, note(owner.id, 'reward', 'Belonging tagged', `${item.name} is registered. Attach its label to help it home.`, undefined, item.id))
    }
  }
  return { state: next, item }
}

export function refreshLabel(state: AppState, itemId: string, newTag: string, actorId: string): AppState {
  const item = state.items.find((i) => i.id === itemId)
  guard(item, 'Item not found.')
  guard(!state.items.some((i) => i.tagCode === newTag), 'That tag is already in use.')
  let next = updateItem(state, itemId, { tagCode: newTag, labelCondition: 'good' })
  const owner = state.people.find((p) => p.id === item!.ownerId)
  if (owner?.role === 'student' && item!.labelCondition === 'worn') {
    next = { ...next, ledger: award(next.ledger, { key: `relabel:${itemId}`, studentId: owner.id, action: 'label_refreshed', at: nowIso(), itemId }) }
  }
  void actorId
  return next
}

export function updateItemDetails(state: AppState, itemId: string, patch: Pick<Item, 'name' | 'description' | 'category' | 'photo' | 'privateMarker'>): AppState {
  guard(patch.name.trim().length >= 2, 'Give the item a name.')
  return updateItem(state, itemId, { ...patch, name: patch.name.trim() })
}

// ---------- Lost route ----------

export function reportLost(state: AppState, input: { itemId: string; lastSeen: string; approxDate: string; notes: string; actorId: string }): { state: AppState; caseId: string } {
  const item = state.items.find((i) => i.id === input.itemId)
  guard(item, 'Item not found.')
  guard(['with_owner', 'returned'].includes(item!.status), 'This item already has an open case.')
  guard(input.lastSeen.trim(), 'Tell staff where it was last seen.')
  const c: Case = {
    id: uid('case'), ref: nextRef(state), kind: 'lost', status: 'reported_lost', itemId: item!.id, claims: [],
    lostReport: { lastSeen: input.lastSeen.trim(), approxDate: input.approxDate, notes: input.notes.trim(), reportedBy: input.actorId, reportedAt: nowIso() },
    events: [ev('reported_lost', input.actorId, 'owner', `Last seen: ${input.lastSeen.trim()}`)], createdAt: nowIso(), updatedAt: nowIso(),
  }
  let next: AppState = { ...state, cases: [c, ...state.cases] }
  next = updateItem(next, item!.id, { status: 'reported_lost' })
  next = push(next, ...staffIds(state).map((id) => note(id, 'action', 'New lost report', `${item!.name} (${item!.tagCode}) reported lost. Last seen: ${c.lostReport!.lastSeen}.`, c.id, item!.id)))
  return { state: next, caseId: c.id }
}

export function cancelLostReport(state: AppState, caseId: string, actorId: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && c.status === 'reported_lost', 'Only an open lost report can be cancelled.')
  let next = updateCase(state, caseId, (x) => ({ ...x, status: 'closed', events: [...x.events, ev('report_cancelled', actorId, 'owner', 'Found it ourselves.')] }))
  next = updateItem(next, c!.itemId!, { status: 'with_owner' })
  return next
}

// ---------- Found route: registered items ----------

export interface LogFoundInput {
  record: Omit<FoundRecord, 'loggedAt' | 'loggedBy'>; actorId: string; handoverCaseId?: string
}

/** Staff scanned or searched a tag and it resolved to a registered item. Creates or advances a case to potential_match. */
export function logFoundRegistered(state: AppState, itemId: string, input: LogFoundInput): { state: AppState; caseId: string } {
  const item = state.items.find((i) => i.id === itemId)
  guard(item, 'No registered item for that tag.')
  guard(!['potential_match', 'match_confirmed', 'awaiting_collection'].includes(item!.status), 'This item is already in custody.')
  const record: FoundRecord = { ...input.record, loggedBy: input.actorId, loggedAt: nowIso() }
  const existing = openCaseForItem(state, itemId)
  let next = state
  let caseId: string
  if (existing) {
    caseId = existing.id
    next = updateCase(next, caseId, (c) => ({
      ...c, status: 'potential_match', foundRecord: record,
      events: [...c.events, ev('scanned', input.actorId, 'staff', `Tag ${item!.tagCode} resolved`), ev('found_logged', input.actorId, 'owner', `Found at ${record.locationFound}`), ev('match_proposed', 'system', 'owner', 'Tag points to this record. Staff to confirm.')],
    }))
  } else {
    const c: Case = {
      id: uid('case'), ref: nextRef(state), kind: 'found_registered', status: 'potential_match', itemId, claims: [], foundRecord: record,
      events: [ev('scanned', input.actorId, 'staff', `Tag ${item!.tagCode} resolved`), ev('found_logged', input.actorId, 'owner', `Found at ${record.locationFound}`), ev('match_proposed', 'system', 'owner', 'Tag points to this record. Staff to confirm.')],
      createdAt: nowIso(), updatedAt: nowIso(),
    }
    caseId = c.id
    next = { ...next, cases: [c, ...next.cases] }
  }
  next = updateItem(next, itemId, { status: 'potential_match' })
  if (input.handoverCaseId) next = linkHandover(next, input.handoverCaseId, caseId, input.actorId)
  return { state: next, caseId }
}

export function confirmMatch(state: AppState, caseId: string, actorId: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && c.status === 'potential_match' && c.itemId, 'Nothing to confirm on this case.')
  const item = state.items.find((i) => i.id === c!.itemId)!
  let next = updateCase(state, caseId, (x) => ({ ...x, status: 'match_confirmed', events: [...x.events, ev('match_confirmed', actorId, 'owner'), ev('owner_notified', 'system', 'owner')] }))
  next = updateItem(next, item.id, { status: 'match_confirmed' })
  next = push(next, ...ownerRecipients(state, item).map((id) => note(id, 'update', `${item.name} has been found`, `Staff confirmed a match with your registered record. Collection details will follow.`, caseId, item.id)))
  return next
}

/** The found object is not the registered item. It goes to the gallery; the lost report (if any) stays open. */
export function rejectMatch(state: AppState, caseId: string, actorId: string, reason: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && c.status === 'potential_match' && c.foundRecord, 'Nothing to reject on this case.')
  const record = c!.foundRecord!
  const gallery: Case = {
    id: uid('case'), ref: nextRef(state), kind: 'found_unregistered', status: 'found_unregistered', claims: [], foundRecord: record,
    events: [ev('found_logged', actorId, 'staff', `Moved from ${c!.ref}: ${reason}`), ev('gallery_listed', 'system', 'staff')], createdAt: nowIso(), updatedAt: nowIso(),
  }
  let next: AppState = { ...state, cases: [gallery, ...state.cases] }
  const hadReport = !!c!.lostReport
  next = updateCase(next, caseId, (x) => ({ ...x, status: hadReport ? 'reported_lost' : 'closed', foundRecord: undefined, events: [...x.events, ev('match_rejected', actorId, 'staff', reason)] }))
  next = updateItem(next, c!.itemId!, { status: hadReport ? 'reported_lost' : 'with_owner' })
  return next
}

// ---------- Found route: unregistered items ----------

export function logFoundUnregistered(state: AppState, input: LogFoundInput): { state: AppState; caseId: string } {
  guard(input.record.locationFound.trim(), 'Where was it found?')
  const record: FoundRecord = { ...input.record, loggedBy: input.actorId, loggedAt: nowIso() }
  const c: Case = {
    id: uid('case'), ref: nextRef(state), kind: 'found_unregistered', status: 'found_unregistered', claims: [], foundRecord: record,
    events: [ev('found_logged', input.actorId, 'staff', `Found at ${record.locationFound}`), ev('gallery_listed', 'system', 'staff')], createdAt: nowIso(), updatedAt: nowIso(),
  }
  let next: AppState = { ...state, cases: [c, ...state.cases] }
  if (input.handoverCaseId) next = linkHandover(next, input.handoverCaseId, c.id, input.actorId)
  return { state: next, caseId: c.id }
}

export function submitClaim(state: AppState, input: { caseId: string; claimantId: string; onBehalfOf?: string; evidence: string }): AppState {
  const c = state.cases.find((x) => x.id === input.caseId)
  guard(c && c.status === 'found_unregistered', 'This item is not open for claims right now.')
  guard(input.evidence.trim().length >= 12, 'Describe a detail only the owner would know (at least a short sentence).')
  guard(!c!.claims.some((cl) => cl.claimantId === input.claimantId && cl.status !== 'rejected'), 'You already have a claim on this item.')
  const claim = { id: uid('claim'), caseId: c!.id, claimantId: input.claimantId, onBehalfOf: input.onBehalfOf, evidence: input.evidence.trim(), submittedAt: nowIso(), status: 'submitted' as const }
  let next = updateCase(state, c!.id, (x) => ({ ...x, status: 'claim_submitted', claims: [...x.claims, claim], events: [...x.events, ev('claim_submitted', input.claimantId, 'staff')] }))
  next = push(next, note(input.claimantId, 'info', 'Claim received', 'Staff will compare your details with the item. You will hear back here.', c!.id))
  next = push(next, ...staffIds(state).map((id) => note(id, 'action', 'Claim to review', `A claim was submitted on ${c!.ref}.`, c!.id)))
  return next
}

export function startClaimReview(state: AppState, caseId: string, actorId: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && c.status === 'claim_submitted', 'No new claim to review.')
  return updateCase(state, caseId, (x) => ({
    ...x, status: 'claim_under_review',
    claims: x.claims.map((cl) => (cl.status === 'submitted' ? { ...cl, status: 'under_review' as const } : cl)),
    events: [...x.events, ev('claim_review_started', actorId, 'staff')],
  }))
}

export function verifyClaim(state: AppState, caseId: string, claimId: string, actorId: string, reviewNote: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && ['claim_submitted', 'claim_under_review'].includes(c.status), 'No claim under review.')
  const claim = c!.claims.find((cl) => cl.id === claimId)
  guard(claim && claim.status !== 'rejected', 'Claim not found.')
  let next = updateCase(state, caseId, (x) => ({
    ...x, status: 'claim_verified',
    claims: x.claims.map((cl) => (cl.id === claimId ? { ...cl, status: 'verified' as const, reviewNote, reviewedBy: actorId, reviewedAt: nowIso() } : cl)),
    events: [...x.events, ev('claim_verified', actorId, 'owner', reviewNote)],
  }))
  next = push(next, note(claim!.claimantId, 'update', 'Claim verified', 'Staff verified your claim. Collection details will follow.', caseId))
  return next
}

export function rejectClaim(state: AppState, caseId: string, claimId: string, actorId: string, reviewNote: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && ['claim_submitted', 'claim_under_review'].includes(c.status), 'No claim under review.')
  const claim = c!.claims.find((cl) => cl.id === claimId)
  guard(claim, 'Claim not found.')
  guard(reviewNote.trim(), 'Add a short reason for the record.')
  let next = updateCase(state, caseId, (x) => ({
    ...x, status: 'found_unregistered',
    claims: x.claims.map((cl) => (cl.id === claimId ? { ...cl, status: 'rejected' as const, reviewNote, reviewedBy: actorId, reviewedAt: nowIso() } : cl)),
    events: [...x.events, ev('claim_rejected', actorId, 'staff', reviewNote), ev('relisted', 'system', 'staff')],
  }))
  next = push(next, note(claim!.claimantId, 'info', 'Claim not verified', 'The details did not match this item. It stays in the gallery; you can look again or ask staff in person.', caseId))
  return next
}

// ---------- Shared tail: pickup and return ----------

export function assignPickup(state: AppState, caseId: string, location: string, window: string, actorId: string): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && ['match_confirmed', 'claim_verified'].includes(c.status), 'Confirm the match or claim first.')
  guard(location.trim(), 'Choose a pickup location.')
  let next = updateCase(state, caseId, (x) => ({ ...x, status: 'awaiting_collection', pickupLocation: location, pickupWindow: window, events: [...x.events, ev('pickup_assigned', actorId, 'owner', `${location}${window ? `, ${window}` : ''}`)] }))
  const recipients = recipientsForCase(state, c!)
  const itemName = c!.itemId ? state.items.find((i) => i.id === c!.itemId)?.name : c!.foundRecord?.description
  if (c!.itemId) next = updateItem(next, c!.itemId, { status: 'awaiting_collection' })
  next = push(next, ...recipients.map((id) => note(id, 'action', 'Ready to collect', `${itemName ?? 'Your item'} is ready at ${location}${window ? ` (${window})` : ''}. Bring the case code ${c!.ref}.`, caseId, c!.itemId)))
  return next
}

export function confirmReturn(state: AppState, caseId: string, actorId: string, verification: { method: string; note: string }): AppState {
  const c = state.cases.find((x) => x.id === caseId)
  guard(c && c.status === 'awaiting_collection', 'The case must be awaiting collection.')
  const actor = state.people.find((p) => p.id === actorId)
  guard(actor && (actor.role === 'manager' || state.school.staffCanVerifyCollection.includes(actorId)), 'Your account is not authorised to record a release.')
  guard(verification.method, 'Record how ownership was verified.')
  let next = updateCase(state, caseId, (x) => ({
    ...x, status: 'returned', verifiedBy: actorId, returnedAt: nowIso(),
    events: [...x.events, ev('ownership_verified', actorId, 'owner', verification.method), ev('returned', actorId, 'owner', verification.note || undefined)],
  }))
  if (c!.itemId) next = updateItem(next, c!.itemId, { status: 'returned' })
  const itemName = c!.itemId ? state.items.find((i) => i.id === c!.itemId)?.name : c!.foundRecord?.description
  next = push(next, ...recipientsForCase(state, c!).map((id) => note(id, 'update', 'Returned', `${itemName ?? 'The item'} is back with its owner. Case ${c!.ref} is closed.`, caseId, c!.itemId)))
  // Finder credit for the full circle
  const finderId = c!.foundRecord?.finderId
  if (finderId) {
    next = { ...next, ledger: award(next.ledger, { key: `return:${caseId}`, studentId: finderId, action: 'helped_return', at: nowIso(), caseId }) }
    next = push(next, note(finderId, 'reward', 'Full circle', 'The item you handed in is back with its owner. Thank you for helping it home.', caseId))
  }
  return next
}

function recipientsForCase(state: AppState, c: Case): string[] {
  if (c.itemId) {
    const item = state.items.find((i) => i.id === c.itemId)
    return item ? ownerRecipients(state, item) : []
  }
  const verified = c.claims.find((cl) => cl.status === 'verified')
  return verified ? [verified.claimantId] : []
}

// ---------- Helpful finder (students) ----------

export function studentReportFound(state: AppState, input: { studentId: string; description: string; location: string }): { state: AppState; caseId: string } {
  guard(input.description.trim().length >= 3, 'Describe what you found.')
  guard(input.location.trim(), 'Where did you find it?')
  const c: Case = {
    id: uid('case'), ref: nextRef(state), kind: 'handover', status: 'handover_pending', claims: [],
    handover: { description: input.description.trim(), location: input.location.trim(), reportedBy: input.studentId, reportedAt: nowIso() },
    events: [ev('handover_reported', input.studentId, 'owner', input.description.trim())], createdAt: nowIso(), updatedAt: nowIso(),
  }
  let next: AppState = { ...state, cases: [c, ...state.cases] }
  next = push(next, note(input.studentId, 'info', 'Thanks for reporting a find', 'Please hand the item to the Lost Property Office. Staff will log it and confirm.', c.id))
  next = push(next, ...staffIds(state).map((id) => note(id, 'action', 'Student handover incoming', `A student reported finding: ${c.handover!.description}.`, c.id)))
  return { state: next, caseId: c.id }
}

/** Called from logFound* when staff receive a student's handover. Confirms custody and credits the finder. */
function linkHandover(state: AppState, handoverCaseId: string, linkedCaseId: string, actorId: string): AppState {
  const h = state.cases.find((x) => x.id === handoverCaseId)
  guard(h && h.kind === 'handover' && h.status === 'handover_pending', 'Handover already processed.')
  const finderId = h!.handover!.reportedBy
  let next = updateCase(state, handoverCaseId, (x) => ({ ...x, status: 'closed', handover: { ...x.handover!, linkedCaseId }, events: [...x.events, ev('handover_confirmed', actorId, 'owner')] }))
  next = updateCase(next, linkedCaseId, (x) => ({ ...x, foundRecord: x.foundRecord ? { ...x.foundRecord, finderId } : x.foundRecord, events: [...x.events, ev('handover_confirmed', actorId, 'staff', 'Received from a student finder')] }))
  next = { ...next, ledger: award(next.ledger, { key: `handover:${handoverCaseId}`, studentId: finderId, action: 'handover_confirmed', at: nowIso(), caseId: handoverCaseId }) }
  next = push(next, note(finderId, 'reward', 'Handover confirmed', 'Staff received the item you found. Your handover is confirmed.', handoverCaseId))
  return next
}

// ---------- Notifications ----------

export function markRead(state: AppState, id: string): AppState {
  return { ...state, notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }
}
export function markAllRead(state: AppState, personId: string): AppState {
  return { ...state, notifications: state.notifications.map((n) => (n.toPersonId === personId ? { ...n, read: true } : n)) }
}

// ---------- Queries ----------

export const itemStatusOf = (c: Case): ItemStatus | CaseStatus => c.status

export function casesFor(state: AppState, person: Person): Case[] {
  const ownedItemIds = new Set(itemsFor(state, person).map((i) => i.id))
  return state.cases.filter((c) =>
    (c.itemId && ownedItemIds.has(c.itemId)) ||
    c.claims.some((cl) => cl.claimantId === person.id) ||
    c.handover?.reportedBy === person.id,
  )
}

export function itemsFor(state: AppState, person: Person): Item[] {
  if (person.role === 'student') return state.items.filter((i) => i.ownerId === person.id)
  if (person.role === 'parent') {
    const kids = new Set(person.childIds ?? [])
    return state.items.filter((i) => kids.has(i.ownerId) || i.guardianId === person.id)
  }
  return state.items
}

export function galleryCases(state: AppState): Case[] {
  return state.cases.filter((c) => c.kind === 'found_unregistered' && ['found_unregistered', 'claim_submitted', 'claim_under_review'].includes(c.status))
}
