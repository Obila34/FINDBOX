import { describe, expect, it } from 'vitest'
import { dayKey, dayOffset, streakStats } from './streaks'
describe('daily streaks', () => {
 it('does not fabricate a streak before a first check-in', () => { expect(streakStats([], '2026-09-25')).toMatchObject({ current:0,best:0,total:0,checked:false }) })
 it('counts once per day and includes yesterday while today remains available', () => { expect(streakStats(['2026-09-23','2026-09-24','2026-09-24'], '2026-09-25')).toMatchObject({current:2,best:2,total:2,checked:false}) })
 it('resets after a missed day while retaining a personal best', () => { expect(streakStats(['2026-09-20','2026-09-21','2026-09-23'], '2026-09-25')).toMatchObject({current:0,best:2,total:3}) })
 it('handles month and year boundaries', () => { expect(dayOffset('2026-01-01',-1)).toBe('2025-12-31'); expect(streakStats(['2025-12-31','2026-01-01'],'2026-01-01').current).toBe(2) })
 it('ignores future entries', () => { expect(streakStats(['2026-09-26'], '2026-09-25').total).toBe(0) })
})

describe('Nairobi streak days',()=>{
 it('switches exactly at Nairobi midnight',()=>{expect(dayKey(new Date('2026-10-06T20:59:59Z'))).toBe('2026-10-06');expect(dayKey(new Date('2026-10-06T21:00:00Z'))).toBe('2026-10-07')})
 it('keeps yesterday active, resets after a missed day, retains best',()=>{const days=['2026-10-01','2026-10-02','2026-10-03','2026-10-03'];expect(streakStats(days,'2026-10-04')).toMatchObject({current:3,best:3,total:3,checked:false});expect(streakStats(days,'2026-10-05')).toMatchObject({current:0,best:3});expect(streakStats([...days,'2026-10-05'],'2026-10-05')).toMatchObject({current:1,best:3,checked:true})})
})
