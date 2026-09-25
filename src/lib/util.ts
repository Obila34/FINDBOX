let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export const nowIso = () => new Date().toISOString()

export function daysAgo(days: number, hour = 9, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString()
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  try { return new Intl.DateTimeFormat('en-GB', opts).format(new Date(iso)) } catch { return iso }
}
export function fmtDateTime(iso: string): string {
  return fmtDate(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} d ago`
  return fmtDate(iso)
}
export function daysBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400_000)
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function tagCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `FB-${pick(4)}-${pick(2)}`
}

export function normaliseTag(input: string): string {
  const raw = input.trim().toUpperCase().replace(/^https?:\/\/[^/]+\/t\//, '').replace(/[^A-Z0-9]/g, '')
  if (raw.length < 6) return raw
  const body = raw.startsWith('FB') ? raw.slice(2) : raw
  return `FB-${body.slice(0, 4)}-${body.slice(4, 6)}`
}

export const isTagLike = (s: string) => /^FB-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(s)

export function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}
