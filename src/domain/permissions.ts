import type { Person, Role, SchoolConfig } from './types'

export type Capability =
  | 'view_own_items' | 'register_item' | 'report_lost' | 'view_gallery' | 'submit_claim' | 'report_found'
  | 'view_quest' | 'view_inbox'
  | 'view_queue' | 'scan_tags' | 'log_found' | 'review_matches' | 'review_claims' | 'assign_pickup'
  | 'verify_collection' | 'view_owner_identity' | 'view_dashboard' | 'view_config' | 'edit_config'

const BASE: Record<Role, Capability[]> = {
  parent: ['view_own_items', 'register_item', 'report_lost', 'view_gallery', 'submit_claim', 'view_inbox'],
  student: ['view_own_items', 'view_gallery', 'report_found', 'view_quest', 'view_inbox'],
  staff: ['view_queue', 'scan_tags', 'log_found', 'review_matches', 'review_claims', 'assign_pickup', 'view_owner_identity', 'view_gallery', 'view_inbox'],
  manager: ['view_queue', 'view_dashboard', 'view_config', 'edit_config', 'review_matches', 'review_claims', 'view_owner_identity', 'view_gallery', 'view_inbox'],
}

/** Role capabilities, adjusted by school configuration and the person. */
export function capabilities(person: Person | null, school: SchoolConfig): Set<Capability> {
  if (!person) return new Set()
  const caps = new Set(BASE[person.role])
  if (person.role === 'student') {
    if (school.studentsCanRegister) caps.add('register_item')
    if (school.studentsCanReportLost) caps.add('report_lost')
    if (school.studentsCanClaim) caps.add('submit_claim')
    if (school.youngStudentRestrictedPreview && (person.yearGroup ?? 9) <= 3) {
      caps.delete('register_item'); caps.delete('report_lost'); caps.delete('submit_claim'); caps.delete('report_found')
    }
  }
  if (person.role === 'staff' && school.staffCanVerifyCollection.includes(person.id)) caps.add('verify_collection')
  if (person.role === 'manager') caps.add('verify_collection')
  return caps
}

export const can = (caps: Set<Capability>, c: Capability) => caps.has(c)

/** The permission matrix rendered in the README and demo guide. */
export const MATRIX: { capability: Capability; label: string; parent: string; student: string; staff: string; manager: string }[] = [
  { capability: 'view_own_items', label: 'View own / child belongings', parent: 'Yes', student: 'Yes', staff: 'Case-scoped', manager: 'Case-scoped' },
  { capability: 'register_item', label: 'Register a belonging', parent: 'Yes', student: 'If enabled', staff: 'No', manager: 'No' },
  { capability: 'report_lost', label: 'Report an item lost', parent: 'Yes', student: 'If enabled', staff: 'No', manager: 'No' },
  { capability: 'view_gallery', label: 'Browse Found Items Gallery', parent: 'Safe view', student: 'Safe view', staff: 'Full', manager: 'Full' },
  { capability: 'submit_claim', label: 'Submit a gallery claim', parent: 'Yes', student: 'If enabled', staff: 'No', manager: 'No' },
  { capability: 'report_found', label: 'Report a helpful find', parent: 'No', student: 'Yes', staff: 'No', manager: 'No' },
  { capability: 'scan_tags', label: 'Scan tags into owner records', parent: 'No', student: 'No', staff: 'Yes', manager: 'No' },
  { capability: 'log_found', label: 'Log found property', parent: 'No', student: 'No', staff: 'Yes', manager: 'No' },
  { capability: 'review_matches', label: 'Confirm or reject matches', parent: 'No', student: 'No', staff: 'Yes', manager: 'Yes' },
  { capability: 'review_claims', label: 'Verify or reject claims', parent: 'No', student: 'No', staff: 'Yes', manager: 'Yes' },
  { capability: 'verify_collection', label: 'Verify ownership and record return', parent: 'No', student: 'No', staff: 'Authorised staff', manager: 'Yes' },
  { capability: 'view_owner_identity', label: 'See owner identity', parent: 'Own family', student: 'Self only', staff: 'Yes', manager: 'Yes' },
  { capability: 'view_dashboard', label: 'Management dashboard', parent: 'No', student: 'No', staff: 'No', manager: 'Yes' },
  { capability: 'edit_config', label: 'Change school configuration (demo)', parent: 'No', student: 'No', staff: 'No', manager: 'Yes' },
]
