import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'fb-theme'
const EVENT = 'findbox-theme'

export function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Switches the whole site between the forest-night (dark) and daylight (light) themes and remembers it. */
export function setTheme(theme: Theme) {
  const root = document.documentElement
  const apply = () => {
    if (theme === 'light') root.dataset.theme = 'light'; else delete root.dataset.theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'light' ? '#f5f6f0' : '#050806')
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(apply)
  else apply()
  try { localStorage.setItem(KEY, theme) } catch { /* private mode: the choice lasts this visit */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }))
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(currentTheme)
  useEffect(() => {
    const on = () => set(currentTheme())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return [theme, setTheme]
}
