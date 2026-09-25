export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dayOffset(key: string, offset: number) {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export function streakStats(input: string[], today = dayKey()) {
  const days = [...new Set(input.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today))].sort()
  const active = new Set(days); let current = 0; let best = 0; let run = 0
  days.forEach((day, i) => { run = i && dayOffset(days[i - 1], 1) === day ? run + 1 : 1; best = Math.max(best, run) })
  let cursor = active.has(today) ? today : dayOffset(today, -1)
  while (active.has(cursor)) { current++; cursor = dayOffset(cursor, -1) }
  return { current, best, total: days.length, started: days[0], checked: active.has(today), days }
}
