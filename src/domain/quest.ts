import type { LedgerEntry, QuestAction } from './types'

/** Deterministic point rules. Points are only ever written through `award`, which is idempotent on `key`. */
export const QUEST_RULES: Record<QuestAction, { points: number; label: string; explain: string; token: string }> = {
  register_item: { points: 10, label: 'Register a belonging', explain: 'Once per item, when it is added with a tag.', token: 'tag' },
  label_refreshed: { points: 5, label: 'Replace a worn label', explain: 'Once per item, when a worn tag is replaced.', token: 'label' },
  handover_confirmed: { points: 25, label: 'Hand a found item to staff', explain: 'Only after staff confirm they received it.', token: 'lantern' },
  helped_return: { points: 15, label: 'Help complete a verified return', explain: 'When an item you handed in reaches its owner.', token: 'key' },
  profile_complete: { points: 5, label: 'Finish onboarding', explain: 'Once per account.', token: 'compass' },
}

export const NO_POINTS_FOR = [
  'Losing an item',
  'Reporting your own item lost',
  'Submitting a claim',
  'Reporting a find that staff have not confirmed',
  'The value of what is found',
]

export const TIERS = [
  { name: 'Scout', min: 0 },
  { name: 'Finder', min: 25 },
  { name: 'Keeper', min: 60 },
  { name: 'Guardian', min: 120 },
]

export function tierFor(points: number) {
  let current = TIERS[0]
  for (const t of TIERS) if (points >= t.min) current = t
  const next = TIERS.find((t) => t.min > points)
  return { current, next, progress: next ? (points - current.min) / (next.min - current.min) : 1 }
}

export function pointsFor(ledger: LedgerEntry[], studentId: string): number {
  return ledger.filter((e) => e.studentId === studentId).reduce((s, e) => s + e.points, 0)
}

/** Returns a new ledger with the entry appended only if the key has never been awarded. */
export function award(ledger: LedgerEntry[], entry: Omit<LedgerEntry, 'points'>): LedgerEntry[] {
  if (ledger.some((e) => e.key === entry.key)) return ledger
  return [...ledger, { ...entry, points: QUEST_RULES[entry.action].points }]
}

export const BOARD: { action: QuestAction; title: string; how: string }[] = [
  { action: 'register_item', title: 'Tag a belonging', how: 'Add an item with a photo and a QR tag.' },
  { action: 'label_refreshed', title: 'Fresh label', how: 'Replace a tag that is worn or peeling.' },
  { action: 'handover_confirmed', title: 'Helpful finder', how: 'Found something? Hand it to the Lost Property Office.' },
  { action: 'helped_return', title: 'Full circle', how: 'An item you handed in gets back to its owner.' },
]
