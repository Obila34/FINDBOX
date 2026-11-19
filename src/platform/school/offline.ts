import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'

// The staff app keeps working without a connection:
//  - the last Home and Items lists loaded on this phone are shown, clearly marked as saved copies;
//  - an item logged without a QR is kept on the phone and sent once the connection is back.
// Each queued log carries its own key, so sending it twice never creates two items.

const PREFIX = 'fb.staff.', QUEUE = PREFIX + 'queue', CHANGED = 'findbox-offline-queue', MAX_QUEUE = 15
export type Cached<T> = { data: T; at: number; stale: boolean }
export type Pending = { key: string; at: number; title: string; body: Record<string, unknown>; error?: string; noPhoto?: boolean }

function read<T>(key: string): T | null { try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) as T : null } catch { return null } }
function write(key: string, value: unknown): boolean { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true } catch { return false } }
export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0

/** Loads from the server and keeps a copy; with no connection, returns the copy and says so. */
export async function cached<T>(key: string, path: string): Promise<Cached<T>> {
  try {
    const data = await api<T>(path), at = Date.now()
    write(key, { at, data })
    return { data, at, stale: false }
  } catch (e) {
    const copy = isOffline(e) ? read<{ at: number; data: T }>(key) : null
    if (copy) return { ...copy, stale: true }
    throw e
  }
}

export const pending = (): Pending[] => { try { return JSON.parse(localStorage.getItem(QUEUE) || '[]') as Pending[] } catch { return [] } }
function save(list: Pending[]): boolean { try { localStorage.setItem(QUEUE, JSON.stringify(list)); window.dispatchEvent(new Event(CHANGED)); return true } catch { return false } }

/** Keeps a found-item log on this phone. Returns false if the phone has no room left for it. */
export function queueFound(body: Record<string, unknown>, title: string, key: string): 'saved' | 'saved-without-photo' | 'full' {
  const list = pending().filter((p) => p.key !== key)
  if (list.length >= MAX_QUEUE) return 'full'
  const entry: Pending = { key, at: Date.now(), title, body }
  if (save([...list, entry])) return 'saved'
  // Photos are the large part; the description alone is still worth keeping.
  return save([...list, { ...entry, body: { ...body, photo: null }, noPhoto: true }]) ? 'saved-without-photo' : 'full'
}
export function discard(key: string) { save(pending().filter((p) => p.key !== key)) }

let flushing = false
/** Sends everything that is waiting. Stops quietly if the connection drops again. */
export async function flush(): Promise<{ sent: number; failed: number }> {
  if (flushing) return { sent: 0, failed: 0 }
  flushing = true
  let sent = 0, failed = 0
  try {
    for (const p of pending()) {
      try {
        await api('/staff/unclaimed', { ...p.body, clientKey: p.key })
        discard(p.key); sent++
      } catch (e) {
        if (isOffline(e)) break
        // The server refused it (for example the box was removed). Keep it so the person can see and decide.
        save(pending().map((x) => x.key === p.key ? { ...x, error: (e as Error).message } : x)); failed++
      }
    }
  } finally { flushing = false }
  return { sent, failed }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}
export function usePending(): Pending[] {
  const [list, setList] = useState<Pending[]>(pending)
  useEffect(() => { const on = () => setList(pending()); window.addEventListener(CHANGED, on); window.addEventListener('storage', on); return () => { window.removeEventListener(CHANGED, on); window.removeEventListener('storage', on) } }, [])
  return list
}
