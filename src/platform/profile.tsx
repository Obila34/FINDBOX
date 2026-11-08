import { useEffect, useState } from 'react'
import { api } from './api'
import { cx } from '@/lib/util'

export type Profile = { name: string; avatar: string | null; tagline: string; accent: string; emoji: string }

/** Accent rings people can pick for their avatar. Each is [light, deep]. */
export const ACCENTS: Record<string, [string, string]> = {
  sage: ['#aebe9e', '#657b56'],
  forest: ['#5fae84', '#174c39'],
  cream: ['#f3f1e4', '#b9b79c'],
  sky: ['#9cc6e4', '#3f6f94'],
  sunset: ['#f3b27a', '#b5562c'],
  lilac: ['#c4b4ee', '#6a5aa8'],
}

let cache: Profile | null = null
let pending: Promise<Profile> | null = null
const listeners = new Set<(p: Profile) => void>()
function publish(p: Profile) { cache = p; listeners.forEach(l => l(p)) }
// A different person may sign in on the same device: forget the old profile and fetch afresh.
if (typeof window !== 'undefined') window.addEventListener('findbox-auth-changed', () => { cache = null; if (listeners.size) loadProfile(true).catch(() => {}) })

export function loadProfile(force = false) {
  if (cache && !force) return Promise.resolve(cache)
  if (!pending || force) pending = api<Profile>('/account/profile').then(p => { publish(p); return p }).finally(() => { pending = null })
  return pending
}
export async function saveProfile(patch: Partial<Profile>) {
  const p = await api<Profile>('/account/profile', patch)
  publish(p)
  return p
}
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(cache)
  useEffect(() => {
    listeners.add(setProfile)
    loadProfile().catch(() => {})
    return () => { listeners.delete(setProfile) }
  }, [])
  return profile
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')

/** The person's chosen photo, emoji or initials, inside their accent ring. */
export function ProfileAvatar({ profile, name, size = 40, className, ring = true }: { profile?: Profile | null; name?: string; size?: number; className?: string; ring?: boolean }) {
  const [light, deep] = ACCENTS[profile?.accent || 'sage'] || ACCENTS.sage
  const label = profile?.name || name || 'You'
  return <span aria-hidden="true" className={cx('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-medium', className)}
    style={{ width: size, height: size, fontSize: size * (profile?.emoji && !profile.avatar ? 0.5 : 0.36), color: '#050806', background: `linear-gradient(135deg, ${light}, ${deep})`, boxShadow: ring ? `0 0 0 2px #050806, 0 0 0 ${size > 60 ? 4 : 3}px ${light}` : undefined }}>
    {profile?.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : profile?.emoji || initials(label)}
  </span>
}

/** Squares and shrinks a chosen photo in the browser so only a small WebP is uploaded. */
export async function squarePhoto(file: File, edge = 320): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = edge
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, edge, edge)
  bitmap.close()
  for (const q of [0.86, 0.75, 0.62, 0.5]) {
    const url = canvas.toDataURL('image/webp', q)
    const type = url.startsWith('data:image/webp') ? url : canvas.toDataURL('image/jpeg', q)
    if (type.length * 0.75 < 150 * 1024) return type
  }
  throw new Error('That photo is too detailed to shrink. Please try another.')
}

/** The signed-in person's own avatar; loads their profile when it first appears. */
export function MyAvatar({ name, size = 40, ring = true }: { name: string; size?: number; ring?: boolean }) {
  const profile = useProfile()
  return <ProfileAvatar profile={profile} name={name} size={size} ring={ring} />
}
