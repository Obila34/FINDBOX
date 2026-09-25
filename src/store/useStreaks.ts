import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dayKey } from '@/domain/streaks'
export const useStreaks = create<{ accounts: Record<string, string[]>; checkIn: (id: string) => void }>()(persist((set) => ({
  accounts: {},
  checkIn: (id) => set(state => { const days = state.accounts[id] ?? []; const day = dayKey(); return days.includes(day) ? state : { accounts: { ...state.accounts, [id]: [...days, day].sort() } } }),
}), { name: 'findbox.streaks.v1' }))
