import type { AppState, Case, CaseEvent, DemoAccount, Item, LedgerEntry, Notification, Person, SchoolConfig } from '@/domain/types'
import { daysAgo, hoursAgo } from '@/lib/util'

/** All people and events below are invented demo data. No real school, child or family is represented. */

export const SEED_VERSION = 7

export const DEMO_IDS = {
  parent: 'p-amina',
  student: 's-zuri',
  youngStudent: 's-kito',
  staff: 'st-daniel',
  manager: 'm-grace',
  bottle: 'item-zuri-bottle',
  atlas: 'item-fatma-atlas',
  pencilCase: 'case-pencil',
} as const

const school: SchoolConfig = {
  name: 'Riverside Academy',
  town: 'Nairobi',
  studentAccountsEnabled: true,
  studentsCanRegister: true,
  studentsCanReportLost: true,
  studentsCanClaim: false,
  youngStudentRestrictedPreview: true,
  staffCanVerifyCollection: ['st-daniel'],
  pickupLocations: ['Lost Property Office (Admin block)', 'Main reception', 'Sports pavilion desk'],
  uncollectedReminderDays: 5,
}

const people: Person[] = [
  { id: 'p-amina', role: 'parent', name: 'Amina Wekesa', firstName: 'Amina', childIds: ['s-zuri', 's-kito'], avatarHue: 186 },
  { id: 's-zuri', role: 'student', name: 'Zuri Wekesa', firstName: 'Zuri', classLabel: '5B', yearGroup: 5, guardianId: 'p-amina', avatarHue: 172 },
  { id: 's-kito', role: 'student', name: 'Kito Wekesa', firstName: 'Kito', classLabel: '2A', yearGroup: 2, guardianId: 'p-amina', avatarHue: 200 },
  { id: 'st-daniel', role: 'staff', name: 'Daniel Kimani', firstName: 'Daniel', title: 'Lost Property Office', avatarHue: 190 },
  { id: 'm-grace', role: 'manager', name: 'Grace Njoroge', firstName: 'Grace', title: 'Deputy Head', avatarHue: 180 },
  // Other families (populate queues and metrics; never presenter personas)
  { id: 'p-otieno', role: 'parent', name: 'Peter Otieno', firstName: 'Peter', childIds: ['s-neema'] },
  { id: 's-neema', role: 'student', name: 'Neema Otieno', firstName: 'Neema', classLabel: '6A', yearGroup: 6, guardianId: 'p-otieno' },
  { id: 'p-hassan', role: 'parent', name: 'Salma Hassan', firstName: 'Salma', childIds: ['s-fatma'] },
  { id: 's-fatma', role: 'student', name: 'Fatma Hassan', firstName: 'Fatma', classLabel: '5B', yearGroup: 5, guardianId: 'p-hassan' },
  { id: 'p-mwangi', role: 'parent', name: 'James Mwangi', firstName: 'James', childIds: ['s-brian'] },
  { id: 's-brian', role: 'student', name: 'Brian Mwangi', firstName: 'Brian', classLabel: '4C', yearGroup: 4, guardianId: 'p-mwangi' },
  { id: 'p-kamau', role: 'parent', name: 'Lucy Kamau', firstName: 'Lucy', childIds: ['s-wanjiru'] },
  { id: 's-wanjiru', role: 'student', name: 'Wanjiru Kamau', firstName: 'Wanjiru', classLabel: '6B', yearGroup: 6, guardianId: 'p-kamau' },
  { id: 'p-karanja', role: 'parent', name: 'Moses Karanja', firstName: 'Moses', childIds: ['s-leo'] },
  { id: 's-leo', role: 'student', name: 'Leo Karanja', firstName: 'Leo', classLabel: '3A', yearGroup: 3, guardianId: 'p-karanja' },
]

const item = (i: Partial<Item> & Pick<Item, 'id' | 'name' | 'category' | 'ownerId' | 'tagCode'>): Item => ({
  description: '', guardianId: people.find((p) => p.id === i.ownerId)?.guardianId, photo: `art:${i.category}`, tagType: 'qr',
  labelCondition: 'good', registeredAt: daysAgo(40), status: 'with_owner', ...i,
})

const items: Item[] = [
  item({ id: 'item-zuri-bottle', name: 'Blue steel water bottle', category: 'bottle', ownerId: 's-zuri', tagCode: 'FB-7K2M-Q4', description: 'Navy 750 ml bottle with a bamboo lid.', privateMarker: 'Small dent near the base, sticker of a fox inside the lid', registeredAt: daysAgo(58, 17, 20) }),
  item({ id: 'item-zuri-fleece', name: 'School fleece (age 10)', category: 'clothing', ownerId: 's-zuri', tagCode: 'FB-3H9P-D7', description: 'Teal zip fleece, name label inside collar.', labelCondition: 'worn', registeredAt: daysAgo(55, 17, 24) }),
  item({ id: 'item-zuri-maths', name: 'Maths workbook', category: 'book', ownerId: 's-zuri', tagCode: 'FB-9A4T-K1', description: 'Green cover, Year 5 term 2.', registeredAt: daysAgo(30, 8, 10) }),
  item({ id: 'item-zuri-lunch', name: 'Lunch box', category: 'lunchbox', ownerId: 's-zuri', tagCode: 'FB-5C2N-R8', description: 'Two-tier steel lunch box.', registeredAt: daysAgo(58, 17, 30) }),
  item({ id: 'item-kito-lunch', name: 'Dinosaur lunch box', category: 'lunchbox', ownerId: 's-kito', tagCode: 'FB-2R7W-M3', description: 'Green with a stegosaurus print.', registeredAt: daysAgo(58, 17, 35) }),
  item({ id: 'item-kito-cap', name: 'Sun hat', category: 'clothing', ownerId: 's-kito', tagCode: 'FB-8Q1V-B5', description: 'Wide brim, school crest.', registeredAt: daysAgo(58, 17, 38), status: 'returned' }),
  item({ id: 'item-fatma-atlas', name: 'World atlas', category: 'book', ownerId: 's-fatma', tagCode: 'FB-4R8N-A2', description: 'Hardback school atlas, blue spine.', privateMarker: 'Name written on the inside cover in pencil', registeredAt: daysAgo(44) }),
  item({ id: 'item-neema-hockey', name: 'Hockey stick', category: 'sports', ownerId: 's-neema', tagCode: 'FB-6M3K-J9', description: 'Composite, teal grip tape.', tagType: 'nfc', registeredAt: daysAgo(50), status: 'reported_lost' }),
  item({ id: 'item-neema-bottle', name: 'Clear sports bottle', category: 'bottle', ownerId: 's-neema', tagCode: 'FB-1P6S-X4', tagType: 'nfc', registeredAt: daysAgo(50), status: 'returned' }),
  item({ id: 'item-brian-jacket', name: 'Rain jacket', category: 'clothing', ownerId: 's-brian', tagCode: 'FB-7T2Q-N6', description: 'Yellow with reflective strips.', registeredAt: daysAgo(47), status: 'awaiting_collection' }),
  item({ id: 'item-brian-calc', name: 'Scientific calculator', category: 'electronics', ownerId: 's-brian', tagCode: 'FB-3W8D-P2', registeredAt: daysAgo(47), status: 'returned' }),
  item({ id: 'item-wanjiru-recorder', name: 'Recorder in case', category: 'other', ownerId: 's-wanjiru', tagCode: 'FB-9K5L-C3', registeredAt: daysAgo(35), status: 'returned' }),
  item({ id: 'item-wanjiru-keys', name: 'Locker keys', category: 'keys', ownerId: 's-wanjiru', tagCode: 'FB-2N4H-V7', registeredAt: daysAgo(35), status: 'returned' }),
  item({ id: 'item-leo-bottle', name: 'Orange bottle', category: 'bottle', ownerId: 's-leo', tagCode: 'FB-5F1G-T8', registeredAt: daysAgo(28), status: 'returned' }),
  item({ id: 'item-leo-lunch', name: 'Lunch bag', category: 'lunchbox', ownerId: 's-leo', tagCode: 'FB-8B3C-E1', registeredAt: daysAgo(28), status: 'returned' }),
  item({ id: 'item-fatma-fleece', name: 'School fleece (age 11)', category: 'clothing', ownerId: 's-fatma', tagCode: 'FB-4D7E-H5', registeredAt: daysAgo(44), status: 'returned' }),
]

let evCount = 0
const E = (at: string, type: CaseEvent['type'], actorId: string, visibility: CaseEvent['visibility'] = 'owner', note?: string): CaseEvent => ({ id: `sev-${++evCount}`, at, type, actorId, visibility, note })

/** A closed, registered-item case that took `days` from report to return. */
function returnedCase(ref: string, itemId: string, reporter: string, lostDays: number, days: number, lastSeen: string, location: string): Case {
  const reported = daysAgo(lostDays, 8, 30)
  const found = daysAgo(Math.max(0, lostDays - Math.floor(days * 0.5)), 12, 10)
  const returned = daysAgo(Math.max(0, lostDays - days), 15, 0)
  return {
    id: `case-${ref}`, ref, kind: 'lost', status: 'returned', itemId, claims: [],
    lostReport: { lastSeen, approxDate: reported.slice(0, 10), notes: '', reportedBy: reporter, reportedAt: reported },
    foundRecord: { photo: `art:${items.find((i) => i.id === itemId)!.category}`, category: items.find((i) => i.id === itemId)!.category, description: '', locationFound: location, dateFound: found.slice(0, 10), loggedBy: 'st-daniel', loggedAt: found },
    pickupLocation: school.pickupLocations[0], verifiedBy: 'st-daniel', returnedAt: returned,
    events: [
      E(reported, 'reported_lost', reporter, 'owner', `Last seen: ${lastSeen}`),
      E(found, 'scanned', 'st-daniel', 'staff'), E(found, 'found_logged', 'st-daniel', 'owner', `Found at ${location}`), E(found, 'match_proposed', 'system'),
      E(found, 'match_confirmed', 'st-daniel'), E(found, 'owner_notified', 'system'),
      E(found, 'pickup_assigned', 'st-daniel', 'owner', school.pickupLocations[0]),
      E(returned, 'ownership_verified', 'st-daniel', 'owner', 'Guardian ID and tag scan'), E(returned, 'returned', 'st-daniel'),
    ],
    createdAt: reported, updatedAt: returned,
  }
}

const cases: Case[] = [
  // Scenario 2: unregistered pencil case in the gallery (found in the Art room)
  {
    id: 'case-pencil', ref: 'FB-0141', kind: 'found_unregistered', status: 'found_unregistered', claims: [],
    foundRecord: { photo: 'art:stationery', category: 'stationery', description: 'Grey fabric pencil case with a zip, several pencils inside', locationFound: 'Art room, back bench', dateFound: daysAgo(1).slice(0, 10), loggedBy: 'st-daniel', loggedAt: hoursAgo(26) },
    events: [E(hoursAgo(26), 'found_logged', 'st-daniel', 'staff', 'Found at Art room, back bench'), E(hoursAgo(26), 'gallery_listed', 'system', 'staff')],
    createdAt: hoursAgo(26), updatedAt: hoursAgo(26),
  },
  // Gallery: umbrella, no claims yet
  {
    id: 'case-umbrella', ref: 'FB-0139', kind: 'found_unregistered', status: 'found_unregistered', claims: [],
    foundRecord: { photo: 'art:other', category: 'other', description: 'Compact black umbrella', locationFound: 'Bus bay shelter', dateFound: daysAgo(4).slice(0, 10), loggedBy: 'st-daniel', loggedAt: daysAgo(4, 15, 40) },
    events: [E(daysAgo(4, 15, 40), 'found_logged', 'st-daniel', 'staff'), E(daysAgo(4, 15, 40), 'gallery_listed', 'system', 'staff')],
    createdAt: daysAgo(4, 15, 40), updatedAt: daysAgo(4, 15, 40),
  },
  // Gallery: cardigan with a claim under review (from another family)
  {
    id: 'case-cardigan', ref: 'FB-0138', kind: 'found_unregistered', status: 'claim_under_review',
    claims: [{ id: 'claim-cardigan', caseId: 'case-cardigan', claimantId: 'p-kamau', onBehalfOf: 's-wanjiru', evidence: 'Grey cardigan, size 12, a small darn on the left cuff, initials W.K. on the label.', submittedAt: daysAgo(1, 19, 5), status: 'under_review' }],
    foundRecord: { photo: 'art:clothing', category: 'clothing', description: 'Grey knitted cardigan', locationFound: 'Library reading corner', dateFound: daysAgo(6).slice(0, 10), loggedBy: 'st-daniel', loggedAt: daysAgo(6, 13, 0) },
    events: [E(daysAgo(6, 13, 0), 'found_logged', 'st-daniel', 'staff'), E(daysAgo(6, 13, 0), 'gallery_listed', 'system', 'staff'), E(daysAgo(1, 19, 5), 'claim_submitted', 'p-kamau', 'staff'), E(hoursAgo(3), 'claim_review_started', 'st-daniel', 'staff')],
    createdAt: daysAgo(6, 13, 0), updatedAt: hoursAgo(3),
  },
  // Open lost report from another family (hockey stick)
  {
    id: 'case-hockey', ref: 'FB-0140', kind: 'lost', status: 'reported_lost', itemId: 'item-neema-hockey', claims: [],
    lostReport: { lastSeen: 'Sports pavilion, after Tuesday practice', approxDate: daysAgo(2).slice(0, 10), notes: 'Teal grip tape, NFC tag on the shaft.', reportedBy: 'p-otieno', reportedAt: daysAgo(2, 18, 12) },
    events: [E(daysAgo(2, 18, 12), 'reported_lost', 'p-otieno', 'owner', 'Last seen: Sports pavilion')],
    createdAt: daysAgo(2, 18, 12), updatedAt: daysAgo(2, 18, 12),
  },
  // Awaiting collection for 6 days (uncollected queue)
  {
    id: 'case-jacket', ref: 'FB-0133', kind: 'lost', status: 'awaiting_collection', itemId: 'item-brian-jacket', claims: [],
    lostReport: { lastSeen: 'Playground pegs', approxDate: daysAgo(10).slice(0, 10), notes: '', reportedBy: 'p-mwangi', reportedAt: daysAgo(10, 8, 0) },
    foundRecord: { photo: 'art:clothing', category: 'clothing', description: '', locationFound: 'Playground pegs', dateFound: daysAgo(8).slice(0, 10), loggedBy: 'st-daniel', loggedAt: daysAgo(8, 10, 0) },
    pickupLocation: school.pickupLocations[0], pickupWindow: 'Weekdays 15:00 to 16:00',
    events: [E(daysAgo(10, 8, 0), 'reported_lost', 'p-mwangi'), E(daysAgo(8, 10, 0), 'scanned', 'st-daniel', 'staff'), E(daysAgo(8, 10, 0), 'found_logged', 'st-daniel'), E(daysAgo(8, 10, 0), 'match_proposed', 'system'), E(daysAgo(8, 10, 30), 'match_confirmed', 'st-daniel'), E(daysAgo(8, 10, 30), 'owner_notified', 'system'), E(daysAgo(6, 9, 0), 'pickup_assigned', 'st-daniel', 'owner', school.pickupLocations[0])],
    createdAt: daysAgo(10, 8, 0), updatedAt: daysAgo(6, 9, 0),
  },
  // History for metrics
  returnedCase('FB-0120', 'item-kito-cap', 'p-amina', 31, 2, 'Playground', 'Playground bench'),
  returnedCase('FB-0118', 'item-neema-bottle', 'p-otieno', 36, 1, 'Sports pavilion', 'Pavilion crate'),
  returnedCase('FB-0114', 'item-brian-calc', 'p-mwangi', 41, 4, 'Science lab 2', 'Science lab 2 drawer'),
  returnedCase('FB-0110', 'item-wanjiru-recorder', 'p-kamau', 24, 3, 'Music room', 'Music room shelf'),
  returnedCase('FB-0108', 'item-wanjiru-keys', 'p-kamau', 21, 1, 'Corridor B', 'Reception'),
  returnedCase('FB-0104', 'item-leo-bottle', 'p-karanja', 18, 2, 'Dining hall', 'Dining hall trolley'),
  returnedCase('FB-0101', 'item-leo-lunch', 'p-karanja', 15, 6, 'Bus', 'Bus bay shelter'),
  returnedCase('FB-0097', 'item-fatma-fleece', 'p-hassan', 12, 3, 'Assembly hall', 'Assembly hall'),
]

const notifications: Notification[] = [
  { id: 'sn-1', toPersonId: 'p-amina', at: daysAgo(29, 15, 5), title: 'Returned', body: 'Sun hat is back with its owner. Case FB-0120 is closed.', caseId: 'case-FB-0120', itemId: 'item-kito-cap', read: true, kind: 'update' },
  { id: 'sn-2', toPersonId: 'p-amina', at: daysAgo(3, 8, 0), title: 'Label check', body: 'The tag on School fleece (age 10) was flagged as worn at a uniform check. Replace it from the item page.', itemId: 'item-zuri-fleece', read: false, kind: 'info' },
  { id: 'sn-3', toPersonId: 's-zuri', at: daysAgo(3, 8, 0), title: 'Fresh label needed', body: 'Your fleece tag looks worn. Replace it to keep the belonging findable.', itemId: 'item-zuri-fleece', read: false, kind: 'info' },
  { id: 'sn-4', toPersonId: 'st-daniel', at: daysAgo(2, 18, 12), title: 'New lost report', body: 'Hockey stick (FB-6M3K-J9) reported lost. Last seen: Sports pavilion.', caseId: 'case-hockey', itemId: 'item-neema-hockey', read: true, kind: 'action' },
  { id: 'sn-5', toPersonId: 'st-daniel', at: daysAgo(1, 19, 5), title: 'Claim to review', body: 'A claim was submitted on FB-0138.', caseId: 'case-cardigan', read: false, kind: 'action' },
  { id: 'sn-6', toPersonId: 'st-daniel', at: hoursAgo(1), title: 'Uncollected for 6 days', body: 'Rain jacket (FB-0133) has been awaiting collection since last week. Consider a reminder.', caseId: 'case-jacket', read: false, kind: 'info' },
  { id: 'sn-7', toPersonId: 'm-grace', at: hoursAgo(2), title: 'Weekly summary ready', body: 'Recovery rate this month is holding above 80 %. Gallery backlog: 3 items.', read: false, kind: 'info' },
]

const ledger: LedgerEntry[] = [
  { key: 'profile:s-zuri', studentId: 's-zuri', action: 'profile_complete', points: 5, at: daysAgo(58, 17, 0) },
  { key: 'register:item-zuri-bottle', studentId: 's-zuri', action: 'register_item', points: 10, at: daysAgo(58, 17, 20), itemId: 'item-zuri-bottle' },
  { key: 'register:item-zuri-fleece', studentId: 's-zuri', action: 'register_item', points: 10, at: daysAgo(55, 17, 24), itemId: 'item-zuri-fleece' },
  { key: 'register:item-zuri-maths', studentId: 's-zuri', action: 'register_item', points: 10, at: daysAgo(30, 8, 10), itemId: 'item-zuri-maths' },
  { key: 'register:item-neema-hockey', studentId: 's-neema', action: 'register_item', points: 10, at: daysAgo(50), itemId: 'item-neema-hockey' },
]

const accounts: DemoAccount[] = [
  { id: 'acc-amina', personId: 'p-amina', email: 'amina@family.demo', displayHint: 'Parent of Zuri (5B) and Kito (2A)', createdAt: daysAgo(58) },
  { id: 'acc-zuri', personId: 's-zuri', email: 'zuri@student.demo', displayHint: 'Student, Year 5', createdAt: daysAgo(58) },
  { id: 'acc-kito', personId: 's-kito', email: 'kito@student.demo', displayHint: 'Student, Year 2 (restricted preview)', createdAt: daysAgo(58) },
  { id: 'acc-daniel', personId: 'st-daniel', email: 'daniel.kimani@riverside.demo', displayHint: 'Lost Property Office (school invitation)', createdAt: daysAgo(70) },
  { id: 'acc-grace', personId: 'm-grace', email: 'grace.njoroge@riverside.demo', displayHint: 'Deputy Head (school invitation)', createdAt: daysAgo(70) },
]

export function buildSeed(): AppState {
  return { seedVersion: SEED_VERSION, school, people, items, cases, notifications, ledger, accounts, session: null }
}
