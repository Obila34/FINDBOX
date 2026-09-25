import type { Person } from '@/domain/types'
import { cx, initials } from '@/lib/util'

export function Avatar({ person, size = 36, className }: { person: Person; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: '#292929' }}>
      {initials(person.name)}
    </span>
  )
}
