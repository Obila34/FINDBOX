import { useEffect, useRef, useState, type RefObject } from 'react'

/** Adds `is-visible` once when the element enters the viewport (reduced motion: immediately). */
export function useReveal<T extends HTMLElement>(threshold = 0.15): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      el.querySelectorAll('.fb-reveal, .fb-reveal-scale').forEach((n) => n.classList.add('is-visible'))
      el.classList.add('is-visible')
      return
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        e.target.classList.add('is-visible')
        e.target.querySelectorAll('.fb-reveal, .fb-reveal-scale').forEach((n) => n.classList.add('is-visible'))
        io.unobserve(e.target)
      }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return ref
}

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/** Captures Chrome's beforeinstallprompt. iOS never fires it: the UI shows manual Share-menu steps instead. */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone)
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const install = async () => {
    if (!deferred) return 'unavailable' as const
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setDeferred(null)
    return outcome
  }
  return { canPrompt: !!deferred, install, installed, isIOS }
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

/** Toggles a class on <html> while the tab is hidden so ambient animations pause. */
export function usePauseWhenHidden() {
  useEffect(() => {
    const sync = () => document.documentElement.classList.toggle('fb-paused', document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
}

/** Simulated async step for demo sign-in/sign-up. */
export function useSimulatedWork() {
  const [busy, setBusy] = useState(false)
  const run = async (ms = 700) => { setBusy(true); await new Promise((r) => setTimeout(r, ms)); setBusy(false) }
  return { busy, run }
}

/** Reads a File into a downscaled JPEG data URL (max 640 px) for demo-only local photos. */
export async function fileToDataUrl(file: File, max = 640): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}
