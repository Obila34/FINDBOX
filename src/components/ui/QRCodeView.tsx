import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Mark } from '@/components/brand/Logo'
import { cx } from '@/lib/util'

/** Encodes only the opaque tag token as a demo URL (https://findbox.demo/t/FB-XXXX-XX). Never a name or contact. */
export function tagUrl(tagCode: string) { return `${window.location.origin}/t/${encodeURIComponent(tagCode)}` }

export function QRCodeView({ tagCode, size = 160, className, label = true }: { tagCode: string; size?: number; className?: string; label?: boolean }) {
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(tagUrl(tagCode), { errorCorrectionLevel: 'M', margin: 1, width: size * 2, color: { dark: '#171717', light: '#ffffff' } })
      .then((url) => { if (alive) setSrc(url) }).catch(() => setSrc(''))
    return () => { alive = false }
  }, [tagCode, size])
  return (
    <figure className={cx('inline-flex flex-col items-center gap-2', className)}>
      <div className="relative rounded-md border border-line bg-white p-2 shadow-tile" style={{ width: size + 16, height: size + 16 }}>
        {src ? <img src={src} alt={`QR code for tag ${tagCode}`} width={size} height={size} /> : <div className="fb-skeleton h-full w-full" />}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white p-0.5"><Mark size={Math.max(20, size * 0.16)} /></span>
      </div>
      {label && <figcaption className="font-mono text-[0.85rem] font-semibold tracking-wider text-teal-800">{tagCode}</figcaption>}
    </figure>
  )
}
