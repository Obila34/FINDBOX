import React from 'react'
import { createRoot } from 'react-dom/client'
import { ExperienceCanvas } from '../src/components/scene/ExperienceCanvas'
import { ProductModel, Explorer, type ProductKind } from '../src/components/scene/ProductModels'
import { BelongingModel } from '../src/components/scene/BelongingModels'
import { VoicePoweredOrb } from '../src/components/ui/voice-powered-orb'
import type { ItemCategory } from '../src/domain/types'
const kind = new URLSearchParams(location.search).get('kind') ?? 'bottle'
createRoot(document.getElementById('root')!).render(kind === 'orb' ? <div style={{ position:'absolute',inset:0,background:'#0a1a17',borderRadius:'22%' }}><VoicePoweredOrb className="asset-orb" /></div> : <ExperienceCanvas><group scale={kind.startsWith('explorer') || kind === 'bottle' ? 1.2 : 1.5}>{kind.startsWith('explorer') ? <Explorer variant={kind === 'explorer-boy' ? 1 : 0} moving={false} /> : ['bottle','nfc','airtag'].includes(kind) ? <ProductModel kind={kind as ProductKind} /> : <BelongingModel category={kind as ItemCategory} />}</group></ExperienceCanvas>)
