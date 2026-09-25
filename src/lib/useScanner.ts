import { useCallback, useEffect, useRef, useState } from 'react'

export type ScanState = 'idle' | 'requesting' | 'scanning' | 'denied' | 'unsupported' | 'error'

/** Camera QR scanning with jsQR (lazy-loaded). Always paired with a manual-entry fallback in the UI. */
export function useScanner(onResult: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [state, setState] = useState<ScanState>('idle')
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setState((s) => (s === 'scanning' || s === 'requesting' ? 'idle' : s))
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setState('unsupported'); return }
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setState('scanning')
      const { default: jsQR } = await import('jsqr')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      let last = 0
      const tick = (t: number) => {
        if (!streamRef.current) return
        if (t - last > 120 && video.readyState >= 2) {
          last = t
          const w = Math.min(640, video.videoWidth); const h = Math.round((video.videoHeight / video.videoWidth) * w) || 480
          canvas.width = w; canvas.height = h
          ctx.drawImage(video, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
          if (code?.data) { onResultRef.current(code.data); return }
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (e) {
      const name = (e as DOMException)?.name
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unsupported' : 'error')
      stop()
    }
  }, [stop])

  useEffect(() => () => stop(), [stop])
  return { videoRef, state, start, stop }
}
