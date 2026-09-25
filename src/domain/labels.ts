import type { CaseStatus, ItemCategory, ItemStatus, EventType, Role, ClaimStatus } from './types'

export type Tone = 'neutral' | 'lost' | 'match' | 'ready' | 'done' | 'review' | 'danger'

export const ITEM_STATUS: Record<ItemStatus, { label: string; short: string; tone: Tone; hint: string }> = {
  with_owner: { label: 'With owner', short: 'Safe', tone: 'neutral', hint: 'Nothing to do. The item is where it should be.' },
  reported_lost: { label: 'Reported lost', short: 'Lost', tone: 'lost', hint: 'Staff can see this report. You will be told when something is found.' },
  potential_match: { label: 'Possible match found', short: 'Match?', tone: 'match', hint: 'Staff are checking a found item against this record.' },
  match_confirmed: { label: 'Match confirmed', short: 'Found', tone: 'match', hint: 'Staff have confirmed the item. Collection details are on the way.' },
  awaiting_collection: { label: 'Ready to collect', short: 'Collect', tone: 'ready', hint: 'Bring the pickup code to the location shown.' },
  returned: { label: 'Returned', short: 'Home', tone: 'done', hint: 'Case closed. The history stays on record.' },
}

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone; next: string }> = {
  reported_lost: { label: 'Reported lost', tone: 'lost', next: 'Watch for a found item that matches.' },
  potential_match: { label: 'Possible match', tone: 'match', next: 'Staff compare the found item with the record.' },
  match_confirmed: { label: 'Match confirmed', tone: 'match', next: 'Assign a pickup location.' },
  awaiting_collection: { label: 'Awaiting collection', tone: 'ready', next: 'Verify ownership at pickup, then record the return.' },
  returned: { label: 'Returned', tone: 'done', next: 'Closed.' },
  found_unregistered: { label: 'In gallery', tone: 'neutral', next: 'Waiting for a claim or identification.' },
  claim_submitted: { label: 'Claim submitted', tone: 'review', next: 'Staff review the claim.' },
  claim_under_review: { label: 'Claim under review', tone: 'review', next: 'Verify or reject the claim.' },
  claim_verified: { label: 'Claim verified', tone: 'match', next: 'Assign a pickup location.' },
  handover_pending: { label: 'Handover pending', tone: 'review', next: 'Student hands the item to staff; staff log it.' },
  closed: { label: 'Closed', tone: 'neutral', next: 'No further action.' },
}

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  submitted: { label: 'Submitted', tone: 'review' },
  under_review: { label: 'Under review', tone: 'review' },
  verified: { label: 'Verified', tone: 'done' },
  rejected: { label: 'Not verified', tone: 'danger' },
}

export const CATEGORY: Record<ItemCategory, { label: string; plural: string }> = {
  bottle: { label: 'Water bottle', plural: 'Water bottles' },
  book: { label: 'Book', plural: 'Books' },
  stationery: { label: 'Stationery', plural: 'Stationery' },
  clothing: { label: 'Clothing', plural: 'Clothing' },
  lunchbox: { label: 'Lunch box', plural: 'Lunch boxes' },
  sports: { label: 'Sports gear', plural: 'Sports gear' },
  electronics: { label: 'Electronics', plural: 'Electronics' },
  keys: { label: 'Keys', plural: 'Keys' },
  other: { label: 'Other', plural: 'Other' },
}
export const CATEGORY_ORDER: ItemCategory[] = ['bottle', 'book', 'stationery', 'clothing', 'lunchbox', 'sports', 'electronics', 'keys', 'other']

export const EVENT_LABEL: Record<EventType, string> = {
  registered: 'Registered',
  reported_lost: 'Reported lost',
  report_cancelled: 'Report cancelled',
  scanned: 'Tag scanned',
  found_logged: 'Found item logged',
  gallery_listed: 'Listed in Found Items Gallery',
  match_proposed: 'Possible match proposed',
  match_confirmed: 'Match confirmed',
  match_rejected: 'Match rejected',
  owner_notified: 'Owner notified',
  claim_submitted: 'Claim submitted',
  claim_review_started: 'Claim review started',
  claim_verified: 'Claim verified',
  claim_rejected: 'Claim not verified',
  relisted: 'Relisted in gallery',
  pickup_assigned: 'Pickup arranged',
  ownership_verified: 'Ownership verified at pickup',
  returned: 'Returned to owner',
  handover_reported: 'Student reported a find',
  handover_confirmed: 'Handover confirmed by staff',
  note: 'Note',
}

export const ROLE_LABEL: Record<Role, string> = {
  parent: 'Parent / guardian',
  student: 'Student',
  staff: 'Teacher',
  manager: 'School Manager',
}

export const toneClasses: Record<Tone, string> = {
  neutral: 'bg-paper-3 text-ink-2 border-line-strong',
  lost: 'bg-[#fbf1e4] text-status-lost border-[#e7c9a1]',
  match: 'bg-teal-50 text-teal-700 border-teal-200',
  ready: 'bg-teal-100 text-teal-800 border-teal-300',
  done: 'bg-[#e8f3ec] text-status-done border-[#b9dcc6]',
  review: 'bg-[#efedf8] text-status-review border-[#cfc8ea]',
  danger: 'bg-[#fbe9e7] text-status-danger border-[#efbdb8]',
}
