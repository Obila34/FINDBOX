import { Link } from 'react-router-dom'
import type { Item } from '@/domain/types'
import { CATEGORY, ITEM_STATUS } from '@/domain/labels'
import { ItemArt } from './ItemArt'
import { StatusSeal } from './StatusSeal'
import { InventorySlot } from './Tile'
import { cx } from '@/lib/util'

/** Inventory tile: art in a slot, name, category, status seal. Rises 3 px on hover, presses 1 px. */
export function ItemTile({ item, to, onClick, index = 0, dense, ownerLabel }: { item: Item; to?: string; onClick?: () => void; index?: number; dense?: boolean; ownerLabel?: string }) {
  const st = ITEM_STATUS[item.status]
  const body = (
    <>
      <InventorySlot className={dense ? '!h-16 !w-16 shrink-0' : ''} size={dense ? 'sm' : 'md'}>
        <ItemArt category={item.category} photo={item.photo} size={dense ? 48 : '72%'} muted={item.status === 'reported_lost'} />
      </InventorySlot>
      <div className={cx('min-w-0', dense ? 'flex-1' : 'mt-3')}>
        <p className="truncate font-medium text-ink">{item.name}</p>
        <p className="truncate text-[0.78rem] text-ink-3">{CATEGORY[item.category].label}{ownerLabel ? ` · ${ownerLabel}` : ''}</p>
        <StatusSeal tone={st.tone} label={st.label} size="sm" className="mt-2" />
      </div>
    </>
  )
  const cls = cx('fb-tile fb-catalog-card fb-press fb-raise fb-enter block text-left', dense ? 'flex items-center gap-3 p-3' : 'p-3 fb-catalog-large')
  const style = { ['--i' as string]: index }
  if (to) return <Link to={to} className={cls} style={style} aria-label={`${item.name}, ${st.label}`}>{body}</Link>
  return <button type="button" onClick={onClick} className={cx(cls, 'w-full')} style={style} aria-label={`${item.name}, ${st.label}`}>{body}</button>
}
