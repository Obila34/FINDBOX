import { useId, useMemo, type ComponentProps, type ReactNode } from 'react'
import { cx } from '@/lib/util'

export type StreamImage = { src: string; alt?: string }
export type CorridorPath = {
  perspective?: number
  cardWidth?: number
  cardHeight?: number
  cardRadius?: number
  birthHeight?: number
  exitHeight?: number
  railBirth?: number
  railExit?: number
  fan?: number
  turnBirth?: number
  turnExit?: number
  stops?: number
}

const pathDefaults: Required<CorridorPath> = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 1.15,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24,
}

function corridorKeyframes(direction: 1 | -1, name: string, path: Required<CorridorPath>) {
  const frames: string[] = []
  for (let index = 0; index <= path.stops; index += 1) {
    const progress = index / path.stops
    const scale = (path.birthHeight / path.cardHeight) * Math.pow(path.exitHeight / path.birthHeight, progress)
    const z = path.perspective * (1 - 1 / scale)
    const rail = path.railExit - (path.railExit - path.railBirth) * Math.pow(1 - progress, path.fan)
    const turn = path.turnBirth + (path.turnExit - path.turnBirth) * progress
    frames.push(`${(progress * 100).toFixed(2)}%{transform:translate3d(${(direction * rail).toFixed(2)}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-direction * turn).toFixed(2)}deg)}`)
  }
  return `@keyframes ${name}{${frames.join('')}}`
}

export function ImageStreamHero({ images, cards = 10, speed = 34, axis = 55, path, children, className, ...props }:
  ComponentProps<'div'> & { images: StreamImage[]; cards?: number; speed?: number; axis?: number; path?: CorridorPath; children?: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const right = `fb-stream-r-${id}`, left = `fb-stream-l-${id}`, cardClass = `fb-stream-card-${id}`
  const geometry = useMemo(() => ({ ...pathDefaults, ...path }), [path])
  const animationCss = useMemo(() => `${corridorKeyframes(1, right, geometry)}${corridorKeyframes(-1, left, geometry)}@media(prefers-reduced-motion:reduce){.${cardClass}{animation-play-state:paused!important}}`, [right, left, cardClass, geometry])

  return <div className={cx('fb-image-stream-hero', className)} {...props} style={{ containerType: 'inline-size', ...props.style }}>
    <style>{animationCss}</style>
    <div className="fb-stream-perspective" aria-hidden="true" style={{ perspective: `${geometry.perspective}cqw`, perspectiveOrigin: `50% ${axis}%` }}>
      <div className="fb-stream-world">
        {[right, left].map(animation => Array.from({ length: cards }, (_, index) => {
          const image = images[index % Math.max(images.length, 1)]
          return <div key={`${animation}-${index}`} className={cx(cardClass, 'fb-stream-card')} style={{
            left: '50%', top: `${axis}%`, width: `${geometry.cardWidth}cqw`, height: `${geometry.cardHeight}cqw`,
            marginLeft: `${-geometry.cardWidth / 2}cqw`, marginTop: `${-geometry.cardHeight / 2}cqw`, borderRadius: `${geometry.cardRadius}cqw`,
            animation: `${animation} ${speed}s linear infinite`, animationDelay: `${-(index * speed) / cards}s`,
          }}>{image && <img src={image.src} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" draggable={false} />}</div>
        }))}
      </div>
    </div>
    {children}
  </div>
}
