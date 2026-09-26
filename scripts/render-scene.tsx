import React from 'react'
import { createRoot } from 'react-dom/client'
import { ExperienceCanvas } from '../src/components/scene/ExperienceCanvas'
import { ProductModel, type ProductKind } from '../src/components/scene/ProductModels'
import { BelongingModel } from '../src/components/scene/BelongingModels'
import type { ItemCategory } from '../src/domain/types'
const kind = new URLSearchParams(location.search).get('kind') ?? 'bottle'
createRoot(document.getElementById('root')!).render(<ExperienceCanvas><group scale={kind === 'bottle' ? 1.2 : 1.5}>{['bottle','nfc','airtag'].includes(kind) ? <ProductModel kind={kind as ProductKind} /> : <BelongingModel category={kind as ItemCategory} />}</group></ExperienceCanvas>)
