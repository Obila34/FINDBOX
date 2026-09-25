import { describe, it, expect } from 'vitest'
import { buildSeed, DEMO_IDS } from '@/data/seed'
import * as T from './transitions'
import { pointsFor } from './quest'

const record = (locationFound: string) => ({ photo: 'art:bottle', category: 'bottle' as const, description: '', locationFound, dateFound: '2026-09-24' })

describe('Story 1: registered water bottle', () => {
  it('runs lost -> scan -> confirm -> pickup -> verified return', () => {
    let s = buildSeed()
    const r1 = T.reportLost(s, { itemId: DEMO_IDS.bottle, lastSeen: 'Sports pavilion', approxDate: '2026-09-23', notes: '', actorId: DEMO_IDS.parent })
    s = r1.state
    expect(s.items.find((i) => i.id === DEMO_IDS.bottle)!.status).toBe('reported_lost')
    expect(s.notifications.some((n) => n.toPersonId === DEMO_IDS.staff && n.title === 'New lost report')).toBe(true)

    const r2 = T.logFoundRegistered(s, DEMO_IDS.bottle, { record: record('Pavilion crate'), actorId: DEMO_IDS.staff })
    s = r2.state
    expect(r2.caseId).toBe(r1.caseId) // advances the existing lost case
    expect(s.cases.find((c) => c.id === r1.caseId)!.status).toBe('potential_match')

    // A scan never releases: return is impossible before confirm + pickup
    expect(() => T.confirmReturn(s, r1.caseId, DEMO_IDS.staff, { method: 'x', note: '' })).toThrow()

    s = T.confirmMatch(s, r1.caseId, DEMO_IDS.staff)
    expect(s.notifications.some((n) => n.toPersonId === DEMO_IDS.parent && /found/.test(n.title))).toBe(true)
    s = T.assignPickup(s, r1.caseId, 'Main reception', 'Weekdays', DEMO_IDS.staff)
    expect(s.cases.find((c) => c.id === r1.caseId)!.status).toBe('awaiting_collection')

    // Unauthorised account cannot record a release
    expect(() => T.confirmReturn(s, r1.caseId, DEMO_IDS.parent, { method: 'ID', note: '' })).toThrow(/not authorised/)
    s = T.confirmReturn(s, r1.caseId, DEMO_IDS.staff, { method: 'Guardian ID and tag scan', note: '' })
    expect(s.cases.find((c) => c.id === r1.caseId)!.status).toBe('returned')
    expect(s.items.find((i) => i.id === DEMO_IDS.bottle)!.status).toBe('returned')
  })
})

describe('Story 2: unregistered pencil case', () => {
  it('claim -> review -> reject relists; claim -> verify -> return', () => {
    let s = buildSeed()
    expect(() => T.submitClaim(s, { caseId: DEMO_IDS.pencilCase, claimantId: DEMO_IDS.parent, evidence: 'short' })).toThrow()
    s = T.submitClaim(s, { caseId: DEMO_IDS.pencilCase, claimantId: DEMO_IDS.parent, onBehalfOf: DEMO_IDS.youngStudent, evidence: 'Grey zip case with an ink stain inside the lid.' })
    expect(s.cases.find((c) => c.id === DEMO_IDS.pencilCase)!.status).toBe('claim_submitted')
    // Gallery claim cannot skip to pickup
    expect(() => T.assignPickup(s, DEMO_IDS.pencilCase, 'Main reception', '', DEMO_IDS.staff)).toThrow()
    s = T.startClaimReview(s, DEMO_IDS.pencilCase, DEMO_IDS.staff)
    const claimId = s.cases.find((c) => c.id === DEMO_IDS.pencilCase)!.claims[0].id
    const rejected = T.rejectClaim(s, DEMO_IDS.pencilCase, claimId, DEMO_IDS.staff, 'Different colour')
    expect(rejected.cases.find((c) => c.id === DEMO_IDS.pencilCase)!.status).toBe('found_unregistered')
    expect(rejected.notifications.some((n) => n.toPersonId === DEMO_IDS.parent && n.title === 'Claim not verified')).toBe(true)

    s = T.verifyClaim(s, DEMO_IDS.pencilCase, claimId, DEMO_IDS.staff, 'Ink stain confirmed')
    s = T.assignPickup(s, DEMO_IDS.pencilCase, 'Main reception', '', DEMO_IDS.staff)
    s = T.confirmReturn(s, DEMO_IDS.pencilCase, DEMO_IDS.manager, { method: 'Claimant matched claim details in person', note: '' })
    expect(s.cases.find((c) => c.id === DEMO_IDS.pencilCase)!.status).toBe('returned')
  })
})

describe('Story 3: helpful finder and the idempotent ledger', () => {
  it('credits the finder only after staff confirm, exactly once', () => {
    let s = buildSeed()
    const before = pointsFor(s.ledger, DEMO_IDS.student)
    const h = T.studentReportFound(s, { studentId: DEMO_IDS.student, description: 'Hardback atlas', location: 'Library' })
    s = h.state
    expect(pointsFor(s.ledger, DEMO_IDS.student)).toBe(before) // no points for an unconfirmed report
    const logged = T.logFoundRegistered(s, DEMO_IDS.atlas, { record: { ...record('Library'), category: 'book' }, actorId: DEMO_IDS.staff, handoverCaseId: h.caseId })
    s = logged.state
    expect(pointsFor(s.ledger, DEMO_IDS.student)).toBe(before + 25)
    expect(s.cases.find((c) => c.id === h.caseId)!.status).toBe('closed')
    // The same handover cannot be confirmed twice
    expect(() => T.logFoundUnregistered(s, { record: record('Library'), actorId: DEMO_IDS.staff, handoverCaseId: h.caseId })).toThrow()
    s = T.confirmMatch(s, logged.caseId, DEMO_IDS.staff)
    s = T.assignPickup(s, logged.caseId, 'Main reception', '', DEMO_IDS.staff)
    s = T.confirmReturn(s, logged.caseId, DEMO_IDS.staff, { method: 'Guardian ID and tag scan', note: '' })
    expect(pointsFor(s.ledger, DEMO_IDS.student)).toBe(before + 40)
    // Finder never receives owner identity in their notifications
    const finderNotes = s.notifications.filter((n) => n.toPersonId === DEMO_IDS.student)
    expect(finderNotes.some((n) => /Fatma|Hassan/.test(n.body))).toBe(false)
  })

  it('registration points are awarded once per item', () => {
    let s = buildSeed()
    const before = pointsFor(s.ledger, DEMO_IDS.student)
    const r = T.registerItem(s, { name: 'Recorder', category: 'other', description: '', ownerId: DEMO_IDS.student, photo: 'art:other', tagCode: 'FB-TEST-01', tagType: 'qr', actorId: DEMO_IDS.student })
    s = r.state
    expect(pointsFor(s.ledger, DEMO_IDS.student)).toBe(before + 10)
    expect(() => T.registerItem(s, { name: 'Dup', category: 'other', description: '', ownerId: DEMO_IDS.student, photo: 'art:other', tagCode: 'FB-TEST-01', tagType: 'qr', actorId: DEMO_IDS.student })).toThrow(/already in use/)
  })
})
