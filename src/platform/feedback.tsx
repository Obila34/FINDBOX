import { useEffect, useRef, useState } from 'react'
import { Check, Info, TriangleAlert, X } from 'lucide-react'
import './feedback.css'

export type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: ToastKind; message: string; leaving?: boolean }

/** Show a toast from anywhere in the app. */
export function notify(message: string, kind: ToastKind = 'success') {
  if (!message) return
  window.dispatchEvent(new CustomEvent('findbox-notify', { detail: { message, kind } }))
}

/** Route a page's local message state into a toast, then clear it. */
export function useToastMessage(message: string, clear: (v: string) => void, kind: ToastKind = 'success') {
  useEffect(() => { if (message) { notify(message, kind); clear('') } }, [message])
}

// Sign-in style endpoints already explain failures beside their own fields.
const quietErrors = /^\/(auth|company\/auth|account\/mfa)\//
const ARM_WINDOW = 2500

/**
 * Global feedback host. Any button that triggers a write request through `api()`
 * shows a spinner while it works, a tick when it succeeds and a shake when it fails,
 * without each form having to wire this up. Toasts stack in one consistent place.
 */
export function FeedbackHost() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const armed = useRef<{ el: HTMLElement; at: number } | null>(null)
  const active = useRef<HTMLElement | null>(null)
  const seq = useRef(0)

  function dismiss(id: number) {
    setToasts(list => list.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 220)
  }

  useEffect(() => {
    const arm = (el: Element | null | undefined) => {
      const button = el?.closest?.('button') as HTMLButtonElement | null
      if (button && !button.disabled) armed.current = { el: button, at: Date.now() }
    }
    const onClick = (e: MouseEvent) => arm(e.target as Element)
    const onSubmit = (e: SubmitEvent) => arm(e.submitter || (e.target as HTMLFormElement).querySelector('button:not([type=button])'))
    const settle = (el: HTMLElement, state: 'done' | 'error') => {
      el.dataset.action = state
      window.setTimeout(() => { if (el.dataset.action === state) delete el.dataset.action }, state === 'done' ? 1400 : 700)
    }
    const onAction = (e: Event) => {
      const { phase, path, message } = (e as CustomEvent<{ phase: string; path: string; message: string }>).detail
      if (phase === 'start') {
        const a = armed.current
        armed.current = null
        if (a && Date.now() - a.at < ARM_WINDOW && a.el.isConnected) {
          active.current = a.el
          a.el.dataset.action = 'busy'
        }
        return
      }
      const el = active.current
      active.current = null
      if (el?.isConnected) settle(el, phase === 'success' ? 'done' : 'error')
      if (phase === 'error' && el && !quietErrors.test(path)) notify(message || 'That did not work. Please try again.', 'error')
    }
    const onNotify = (e: Event) => {
      const { message, kind } = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail
      const id = ++seq.current
      setToasts(list => (list.some(t => t.message === message && !t.leaving) ? list : [...list.slice(-2), { id, kind, message }]))
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500)
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    window.addEventListener('findbox-action', onAction)
    window.addEventListener('findbox-notify', onNotify)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
      window.removeEventListener('findbox-action', onAction)
      window.removeEventListener('findbox-notify', onNotify)
    }
  }, [])

  return (
    <div className="fx-toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`fx-toast is-${t.kind}${t.leaving ? ' is-leaving' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span className="fx-toast-icon">{t.kind === 'success' ? <Check size={16} /> : t.kind === 'error' ? <TriangleAlert size={16} /> : <Info size={16} />}</span>
          <p>{t.message}</p>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}><X size={15} /></button>
          <i className="fx-toast-timer" style={{ animationDuration: t.kind === 'error' ? '7s' : '4.5s' }} />
        </div>
      ))}
    </div>
  )
}
