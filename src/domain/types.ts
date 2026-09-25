export type Role = 'parent' | 'student' | 'staff' | 'manager'

export type ItemCategory =
  | 'bottle' | 'book' | 'stationery' | 'clothing' | 'lunchbox' | 'sports' | 'electronics' | 'keys' | 'other'

export interface Person {
  id: string
  role: Role
  name: string
  /** First name used in greetings. */
  firstName: string
  /** Students only. Shown to staff, never in the gallery. */
  classLabel?: string
  /** Students only. Younger students get a restricted preview. */
  yearGroup?: number
  /** Parents only. */
  childIds?: string[]
  /** Students only. */
  guardianId?: string
  title?: string
  avatarHue?: number
}

export type ItemStatus =
  | 'with_owner' | 'reported_lost' | 'potential_match' | 'match_confirmed' | 'awaiting_collection' | 'returned'

export interface Item {
  id: string
  name: string
  category: ItemCategory
  description: string
  ownerId: string       // student
  guardianId?: string   // parent who registered it
  /** 'art:<category>' for illustrated placeholder or a data URL for a local demo upload */
  photo: string
  tagCode: string       // e.g. FB-7K2M-Q4
  tagType: 'qr' | 'nfc'
  labelCondition: 'good' | 'worn'
  registeredAt: string
  status: ItemStatus
  /** Distinguishing detail staff can ask for at pickup. Never shown in the gallery. */
  privateMarker?: string
}

export type CaseKind = 'lost' | 'found_registered' | 'found_unregistered' | 'handover'

export type CaseStatus =
  | 'reported_lost' | 'potential_match' | 'match_confirmed' | 'awaiting_collection' | 'returned'
  | 'found_unregistered' | 'claim_submitted' | 'claim_under_review' | 'claim_verified'
  | 'handover_pending' | 'closed'

export interface LostReport {
  lastSeen: string
  approxDate: string
  notes: string
  reportedBy: string
  reportedAt: string
}

export interface FoundRecord {
  photo: string
  category: ItemCategory
  description: string
  locationFound: string
  dateFound: string
  loggedBy: string
  loggedAt: string
  /** Student who handed the item in, credited after staff confirmation */
  finderId?: string
}

export type ClaimStatus = 'submitted' | 'under_review' | 'verified' | 'rejected'

export interface Claim {
  id: string
  caseId: string
  claimantId: string           // parent or student
  onBehalfOf?: string          // child id when a guardian claims
  evidence: string             // description of distinguishing details
  submittedAt: string
  status: ClaimStatus
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
}

export type EventType =
  | 'registered' | 'reported_lost' | 'report_cancelled' | 'scanned' | 'found_logged' | 'gallery_listed'
  | 'match_proposed' | 'match_confirmed' | 'match_rejected' | 'owner_notified'
  | 'claim_submitted' | 'claim_review_started' | 'claim_verified' | 'claim_rejected' | 'relisted'
  | 'pickup_assigned' | 'ownership_verified' | 'returned' | 'handover_reported' | 'handover_confirmed' | 'note'

export interface CaseEvent {
  id: string
  at: string
  type: EventType
  actorId: string | 'system'
  note?: string
  /** 'owner' events are visible to the family; 'staff' only in staff views */
  visibility: 'owner' | 'staff'
}

export interface Case {
  id: string
  ref: string                 // human ref, e.g. FB-0142
  kind: CaseKind
  status: CaseStatus
  itemId?: string
  lostReport?: LostReport
  foundRecord?: FoundRecord
  claims: Claim[]
  pickupLocation?: string
  pickupWindow?: string
  verifiedBy?: string
  returnedAt?: string
  /** For handover cases: the student's own description before staff log the item */
  handover?: { description: string; location: string; reportedBy: string; reportedAt: string; linkedCaseId?: string }
  events: CaseEvent[]
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  toPersonId: string
  at: string
  title: string
  body: string
  caseId?: string
  itemId?: string
  read: boolean
  kind: 'update' | 'action' | 'reward' | 'info'
}

export type QuestAction = 'register_item' | 'label_refreshed' | 'handover_confirmed' | 'helped_return' | 'profile_complete'

export interface LedgerEntry {
  /** Deterministic key; the ledger is idempotent on it. */
  key: string
  studentId: string
  action: QuestAction
  points: number
  at: string
  caseId?: string
  itemId?: string
}

export interface SchoolConfig {
  name: string
  town: string
  studentAccountsEnabled: boolean
  studentsCanRegister: boolean
  studentsCanReportLost: boolean
  studentsCanClaim: boolean
  youngStudentRestrictedPreview: boolean
  staffCanVerifyCollection: string[]   // staff ids allowed to record release
  pickupLocations: string[]
  uncollectedReminderDays: number
}

export interface Session {
  personId: string
  role: Role
  presenter: boolean
  onboarded: boolean
  signedInAt: string
}

export interface DemoAccount {
  id: string
  personId: string
  email: string
  /** Presentation-only. Never treated as a secret. */
  displayHint: string
  createdAt: string
}

export interface AppState {
  seedVersion: number
  school: SchoolConfig
  people: Person[]
  items: Item[]
  cases: Case[]
  notifications: Notification[]
  ledger: LedgerEntry[]
  accounts: DemoAccount[]
  session: Session | null
  /** Last presenter scenario chosen, for the guide */
  scenario?: string
}
