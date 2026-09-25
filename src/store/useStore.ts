import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppState, Person, Role, SchoolConfig } from '@/domain/types'
import * as T from '@/domain/transitions'
import { buildSeed, SEED_VERSION, DEMO_IDS } from '@/data/seed'
import { nowIso, uid } from '@/lib/util'
import { award } from '@/domain/quest'

export interface UiToast { id: string; title: string; body?: string; tone?: 'info' | 'success' | 'danger' | 'reward' }

interface Actions {
  // session
  signIn: (personId: string, opts?: { presenter?: boolean }) => void
  signOut: () => void
  switchPersona: (role: Role) => void
  setPresenter: (on: boolean) => void
  completeOnboarding: () => void
  createLocalAccount: (input: { role: 'parent' | 'student'; name: string; email: string; childName?: string; classLabel?: string; yearGroup?: number }) => string
  // items
  registerItem: (input: T.RegisterInput) => string
  updateItemDetails: (itemId: string, patch: Parameters<typeof T.updateItemDetails>[2]) => void
  refreshLabel: (itemId: string, newTag: string) => void
  reportLost: (input: Omit<Parameters<typeof T.reportLost>[1], 'actorId'>) => string
  cancelLostReport: (caseId: string) => void
  // staff
  logFoundRegistered: (itemId: string, input: Omit<T.LogFoundInput, 'actorId'>) => string
  logFoundUnregistered: (input: Omit<T.LogFoundInput, 'actorId'>) => string
  confirmMatch: (caseId: string) => void
  rejectMatch: (caseId: string, reason: string) => void
  startClaimReview: (caseId: string) => void
  verifyClaim: (caseId: string, claimId: string, note: string) => void
  rejectClaim: (caseId: string, claimId: string, note: string) => void
  assignPickup: (caseId: string, location: string, window: string) => void
  confirmReturn: (caseId: string, verification: { method: string; note: string }) => void
  // family
  submitClaim: (input: Omit<Parameters<typeof T.submitClaim>[1], 'claimantId'>) => void
  studentReportFound: (input: { description: string; location: string }) => string
  // notifications
  markRead: (id: string) => void
  markAllRead: () => void
  // config
  updateSchool: (patch: Partial<SchoolConfig>) => void
  setScenario: (s: string | undefined) => void
  // demo
  resetDemo: (keepSession?: boolean) => void
  // ui
  toasts: UiToast[]
  toast: (t: Omit<UiToast, 'id'>) => void
  dismissToast: (id: string) => void
  celebrate: number
}

export type Store = AppState & Actions

const actorOf = (s: AppState) => s.session?.personId ?? 'system'

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const apply = (fn: (s: AppState) => AppState) => set((s) => fn(s) as Store)
      const applyWithResult = <R,>(fn: (s: AppState) => { state: AppState; result: R }): R => {
        const { state, result } = fn(get())
        set(state as Store)
        return result
      }
      return {
        ...buildSeed(),
        toasts: [],
        celebrate: 0,

        signIn: (personId, opts) => set((s) => {
          const person = s.people.find((p) => p.id === personId)
          if (!person) return s
          return { session: { personId, role: person.role, presenter: opts?.presenter ?? s.session?.presenter ?? false, onboarded: true, signedInAt: nowIso() } }
        }),
        signOut: () => set({ session: null }),
        switchPersona: (role) => {
          const id = role === 'parent' ? DEMO_IDS.parent : role === 'student' ? DEMO_IDS.student : role === 'staff' ? DEMO_IDS.staff : DEMO_IDS.manager
          set((s) => ({ session: { personId: id, role, presenter: true, onboarded: true, signedInAt: s.session?.signedInAt ?? nowIso() } }))
        },
        setPresenter: (on) => set((s) => (s.session ? { session: { ...s.session, presenter: on } } : s)),
        completeOnboarding: () => set((s) => {
          if (!s.session) return s
          const person = s.people.find((p) => p.id === s.session!.personId)
          const ledger = person?.role === 'student' ? award(s.ledger, { key: `profile:${person.id}`, studentId: person.id, action: 'profile_complete', at: nowIso() }) : s.ledger
          return { session: { ...s.session, onboarded: true }, ledger }
        }),
        createLocalAccount: (input) => {
          const s = get()
          const personId = uid(input.role === 'parent' ? 'p' : 's')
          const firstName = input.name.trim().split(' ')[0]
          const people: Person[] = [...s.people]
          if (input.role === 'parent') {
            const childId = uid('s')
            const childName = (input.childName ?? 'Child').trim()
            people.push({ id: personId, role: 'parent', name: input.name.trim(), firstName, childIds: [childId], avatarHue: 178 })
            people.push({ id: childId, role: 'student', name: childName, firstName: childName.split(' ')[0], classLabel: input.classLabel, yearGroup: input.yearGroup, guardianId: personId })
          } else {
            people.push({ id: personId, role: 'student', name: input.name.trim(), firstName, classLabel: input.classLabel, yearGroup: input.yearGroup })
          }
          set({
            people,
            accounts: [...s.accounts, { id: uid('acc'), personId, email: input.email.trim().toLowerCase(), displayHint: input.role === 'parent' ? 'Parent account' : 'Student account', createdAt: nowIso() }],
            session: { personId, role: input.role, presenter: s.session?.presenter ?? false, onboarded: false, signedInAt: nowIso() },
          })
          return personId
        },

        registerItem: (input) => applyWithResult((s) => { const r = T.registerItem(s, input); return { state: r.state, result: r.item.id } }),
        updateItemDetails: (itemId, patch) => apply((s) => T.updateItemDetails(s, itemId, patch)),
        refreshLabel: (itemId, newTag) => apply((s) => T.refreshLabel(s, itemId, newTag, actorOf(s))),
        reportLost: (input) => applyWithResult((s) => { const r = T.reportLost(s, { ...input, actorId: actorOf(s) }); return { state: r.state, result: r.caseId } }),
        cancelLostReport: (caseId) => apply((s) => T.cancelLostReport(s, caseId, actorOf(s))),

        logFoundRegistered: (itemId, input) => applyWithResult((s) => { const r = T.logFoundRegistered(s, itemId, { ...input, actorId: actorOf(s) }); return { state: r.state, result: r.caseId } }),
        logFoundUnregistered: (input) => applyWithResult((s) => { const r = T.logFoundUnregistered(s, { ...input, actorId: actorOf(s) }); return { state: r.state, result: r.caseId } }),
        confirmMatch: (caseId) => apply((s) => T.confirmMatch(s, caseId, actorOf(s))),
        rejectMatch: (caseId, reason) => apply((s) => T.rejectMatch(s, caseId, actorOf(s), reason)),
        startClaimReview: (caseId) => apply((s) => T.startClaimReview(s, caseId, actorOf(s))),
        verifyClaim: (caseId, claimId, note) => apply((s) => T.verifyClaim(s, caseId, claimId, actorOf(s), note)),
        rejectClaim: (caseId, claimId, note) => apply((s) => T.rejectClaim(s, caseId, claimId, actorOf(s), note)),
        assignPickup: (caseId, location, window) => apply((s) => T.assignPickup(s, caseId, location, window, actorOf(s))),
        confirmReturn: (caseId, verification) => apply((s) => T.confirmReturn(s, caseId, actorOf(s), verification)),

        submitClaim: (input) => apply((s) => T.submitClaim(s, { ...input, claimantId: actorOf(s) })),
        studentReportFound: (input) => applyWithResult((s) => { const r = T.studentReportFound(s, { ...input, studentId: actorOf(s) }); return { state: r.state, result: r.caseId } }),

        markRead: (id) => apply((s) => T.markRead(s, id)),
        markAllRead: () => apply((s) => T.markAllRead(s, actorOf(s))),
        updateSchool: (patch) => set((s) => ({ school: { ...s.school, ...patch } })),
        setScenario: (scenario) => set({ scenario }),

        resetDemo: (keepSession = true) => set((s) => {
          const fresh = buildSeed()
          const session = keepSession && s.session && fresh.people.some((p) => p.id === s.session!.personId) ? s.session : null
          return { ...fresh, session, toasts: [], scenario: undefined }
        }),

        toast: (t) => {
          const id = uid('t')
          set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }], celebrate: t.tone === 'reward' ? s.celebrate + 1 : s.celebrate }))
          window.setTimeout(() => get().dismissToast(id), 4200)
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      }
    },
    {
      name: 'findbox.v1',
      version: SEED_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { toasts: _t, celebrate: _c, ...rest } = s
        void _t; void _c
        return rest as Store
      },
      migrate: (persisted, version) => {
        if (version !== SEED_VERSION) return { ...buildSeed(), session: (persisted as AppState)?.session ?? null } as Store
        return persisted as Store
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined
        if (!p || p.seedVersion !== SEED_VERSION) return { ...current, ...buildSeed(), session: p?.session ?? null }
        return { ...current, ...p, notifications: (p.notifications ?? current.notifications).map(n => ({ ...n, body: n.body.replace(/\s*Quest: \+\d+[^.]*\.?/g, '').replace(' (and earns +5)', '') })) }
      },
    },
  ),
)

// ---- Selectors ----
export const useSession = () => useStore((s) => s.session)
export const usePerson = (): Person | null => useStore((s) => (s.session ? s.people.find((p) => p.id === s.session!.personId) ?? null : null))
export const useUnread = (personId?: string) => useStore((s) => (personId ? s.notifications.filter((n) => n.toPersonId === personId && !n.read).length : 0))

/** Run a store action and surface guard errors as toasts. Returns true on success. */
export function tryAction(fn: () => void, onError?: (msg: string) => void): boolean {
  try { fn(); return true } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong.'
    if (onError) onError(msg); else useStore.getState().toast({ title: msg, tone: 'danger' })
    return false
  }
}
