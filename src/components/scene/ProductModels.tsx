import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector2 } from 'three'
import QRCode from 'qrcode'
export type ProductKind = 'bottle' | 'nfc' | 'airtag'
export function ProductModel({ kind }: { kind: ProductKind }) {
 const textures = useMemo(() => {
   const label = document.createElement('canvas'); label.width = label.height = 4096
   const ctx = label.getContext('2d')!; ctx.fillStyle = '#f3f5ed'; ctx.fillRect(0, 0, 4096, 4096)
   const qrMap = new CanvasTexture(label); qrMap.colorSpace = SRGBColorSpace
   const qr = document.createElement('canvas')
   QRCode.toCanvas(qr, location.origin + '/t/FB-7K2M-Q4', { width: 2800, margin: 1, color: { dark: '#0d6166', light: '#f3f5ed' } }).then(() => { ctx.drawImage(qr, 648, 950, 2800, 2800); ctx.fillStyle = '#0d6166'; ctx.font = 'bold 390px Arial'; ctx.textAlign = 'center'; ctx.fillText('FINDBOX', 2048, 620); qrMap.needsUpdate = true })
   const nfc = document.createElement('canvas'); nfc.width = nfc.height = 4096
   const c = nfc.getContext('2d')!; c.fillStyle = '#f9faf6'; c.fillRect(0, 0, 4096, 4096); c.fillStyle = '#575d5b'; c.font = 'bold 1080px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('NFC', 2048, 2180)
   const nfcMap = new CanvasTexture(nfc); nfcMap.colorSpace = SRGBColorSpace
   return { qrMap, nfcMap }
 }, [])
 useEffect(() => () => { textures.qrMap.dispose(); textures.nfcMap.dispose() }, [textures])
 const shape = useMemo(() => [[0,-1.25],[.35,-1.25],[.44,-1.23],[.48,-1.17],[.49,-1.05],[.49,.4],[.48,.65],[.43,.88],[.32,1.08],[.29,1.14],[.29,1.31],[.265,1.31],[.265,1.12],[.3,1.06],[.4,.87],[.45,.64],[.46,.4],[.46,-1.08],[.43,-1.17],[.34,-1.19],[0,-1.19]].map(([x,y]) => new Vector2(x,y)), [])
 if (kind === 'bottle') return <group rotation={[0.04,-.12,-.1]}>
   <mesh><latheGeometry args={[shape,128]} /><meshPhysicalMaterial color="#d2e4e8" metalness={.1} roughness={.07} transmission={.8} transparent opacity={.3} thickness={.12} ior={1.47} clearcoat={1} envMapIntensity={1.1} /></mesh>
   <mesh position={[0,1.45,0]}><cylinderGeometry args={[.36,.36,.3,96]} /><meshPhysicalMaterial color="#111716" roughness={.32} clearcoat={.45} /></mesh>
   <mesh position={[0,1.63,0]}><cylinderGeometry args={[.15,.15,.065,64]} /><meshStandardMaterial color="#141918" roughness={.27} /></mesh>
   {[1.27,1.31,1.35].map(y => <mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.33,.02,12,96]} /><meshStandardMaterial color="#151b1b" roughness={.24} /></mesh>)}
   <mesh position={[.43,1.43,0]} scale={[1.3,.7,1]}><torusGeometry args={[.3,.045,16,80]} /><meshPhysicalMaterial color="#111716" roughness={.3} clearcoat={.6} /></mesh>
   <mesh position={[0,-.36,.495]}><planeGeometry args={[.42,.44]} /><meshStandardMaterial map={textures.qrMap} roughness={.65} /></mesh>
   <mesh position={[0,-1.2,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.4,.036,16,96]} /><meshPhysicalMaterial color="#bad1d2" metalness={.55} roughness={.14} /></mesh>
 </group>
 if(kind==='nfc')return <group rotation={[.12,-.3,.16]}><mesh scale={[.8,1,.14]}><sphereGeometry args={[.8,64,48]}/><meshPhysicalMaterial color="#214f40" roughness={.3} clearcoat={.65}/></mesh><mesh position={[0,0,.13]}><circleGeometry args={[.38,64]}/><meshStandardMaterial map={textures.qrMap}/></mesh><mesh position={[0,.74,0]}><torusGeometry args={[.16,.035,16,48]}/><meshStandardMaterial color="#c5d2c2" metalness={.8} roughness={.2}/></mesh></group>
 return <group rotation={[.1,-.2,-.16]}>
   <mesh scale={[1,1,.16]}><sphereGeometry args={[.75,96,64]} /><meshPhysicalMaterial color="#303633" roughness={.56} clearcoat={.23} /></mesh>
   <mesh position={[0,-.39,.108]}><torusGeometry args={[.16,.018,16,64]} /><meshStandardMaterial color="#acbecd" metalness={.45} roughness={.3} /></mesh>
   <mesh position={[0,.64,.028]}><torusGeometry args={[.105,.025,16,64]} /><meshStandardMaterial color="#181f1b" roughness={.45} /></mesh>
   <group position={[0,1.04,0]} rotation={[0,.45,.08]}><mesh scale={[.77,1,1]}><torusGeometry args={[.35,.031,24,96]} /><meshStandardMaterial color="#e7eae8" metalness={1} roughness={.13} /></mesh><mesh position={[.012,.008,.024]} scale={[.77,1,1]}><torusGeometry args={[.35,.017,16,96,Math.PI*1.9]} /><meshStandardMaterial color="#c3cbc5" metalness={1} roughness={.16} /></mesh></group>
 </group>
}
