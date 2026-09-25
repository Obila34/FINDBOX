import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Group } from 'three'
type Position = [number, number, number]
function Form({ at, scale = [1, 1, 1], color, roughness = .85 }: { at: Position; scale?: Position; color: string; roughness?: number }) {
  return <mesh position={at} scale={scale}><sphereGeometry args={[1, 32, 24]} /><meshPhysicalMaterial color={color} roughness={roughness} clearcoat={roughness < .3 ? 1 : .08} /></mesh>
}
function Hand({ skin }: { skin: string }) { return <group><Form at={[0,0,0]} scale={[.105,.14,.07]} color={skin} />{[-1.5,-.5,.5,1.5].map((n,i) => <mesh key={n} position={[n*.044,.18-Math.abs(n)*.017,0]} rotation={[0,0,-n*.08]}><capsuleGeometry args={[.025,.13-i*.005,6,12]} /><meshStandardMaterial color={skin} roughness={.6} /></mesh>)}<mesh position={[-.13,.015,0]} rotation={[0,0,.65]}><capsuleGeometry args={[.033,.09,6,12]} /><meshStandardMaterial color={skin} /></mesh></group> }
export function Explorer({ variant = 0, wave = 0, moving = true }: { variant?: number; wave?: number; moving?: boolean }) {
  const root = useRef<Group>(null); const left = useRef<Group>(null); const right = useRef<Group>(null)
  const girl = variant === 0; const skin = girl ? '#965335' : '#825136'; const shirt = girl ? '#167b9a' : '#443224'; const pants = girl ? '#075840' : '#626047'
  useFrame(({ clock }) => { if (!root.current || !left.current || !right.current) return; const t=clock.elapsedTime; root.current.position.y = moving ? Math.sin(t*2)*.028 : 0; root.current.rotation.y = moving ? Math.sin(t*.65)*.12 : 0; root.current.rotation.z = moving && girl ? Math.sin(t)*.025 : 0; left.current.rotation.z = girl ? .22+(moving ? Math.sin(t*(wave?6:1.6))*.1 : 0) : 2.12; right.current.rotation.z = girl ? -.22+(moving ? Math.sin(t*(wave?6:1.6)+1)*.12 : 0) : -2.12+(moving&&wave ? Math.sin(t*6)*.22 : 0) })
  return <group ref={root} position={[0,-.15,0]}>
    <Form at={[0,.36,0]} scale={[.31,.43,.18]} color={shirt} /><Form at={[0,-.02,0]} scale={[.25,.21,.16]} color={girl?skin:shirt} />
    <Form at={[0,.87,0]} scale={[.11,.23,.11]} color={skin} />
    <Form at={[0,1.2,0]} scale={[.43,.49,.35]} color={skin} />
    <Form at={[0,1.04,.2]} scale={[.31,.29,.2]} color={skin} />
    {[-1,1].map(s => <group key={s}>
      <Form at={[s*.41,1.18,0]} scale={[.084,.13,.066]} color={skin} />
      <Form at={[s*.163,1.24,.29]} scale={[.139,.16,.08]} color="#faf8ed" roughness={.2} />
      <Form at={[s*.158,1.235,.358]} scale={[.079,.098,.038]} color="#382316" roughness={.2} />
      <Form at={[s*.158,1.237,.39]} scale={[.046,.068,.018]} color="#100e0c" roughness={.12} />
      <Form at={[s*.158-.024,1.273,.407]} scale={[.021,.025,.009]} color="#ffffff" roughness={.08} />
      <mesh position={[s*.17,1.44,.28]} rotation={[0,0,Math.PI/2+s*.13]} scale={[1,.7,1]}><capsuleGeometry args={[.031,.19,8,16]} /><meshStandardMaterial color="#1e1512" /></mesh>
      <Form at={[s*.19,-.48,0]} scale={[girl?.25:.2,.53,.21]} color={pants} />
      <RoundedBox args={[.36,.22,.55]} radius={.09} position={[s*.22,-1.01,.12]}><meshPhysicalMaterial color="#f0efe7" roughness={.5} /></RoundedBox>
      <RoundedBox args={[.365,.05,.56]} radius={.022} position={[s*.22,-1.105,.12]}><meshStandardMaterial color="#dddcd5" /></RoundedBox>
      {Array.from({length:4},(_,i)=><mesh key={i} position={[s*.22,-.895-i*.015,.1+i*.066]} rotation={[Math.PI/2,0,0]}><capsuleGeometry args={[.009,.16,4,8]} /><meshStandardMaterial color="#fcfcf2" /></mesh>)}
      {girl && <mesh position={[s*.43,.97,.025]}><torusGeometry args={[.09,.012,12,48]} /><meshStandardMaterial color="#c4a253" metalness={.85} roughness={.26} /></mesh>}
      {girl && <mesh position={[s*.178,1.235,.39]}><torusGeometry args={[.192,.008,12,64]} /><meshStandardMaterial color="#c5ae83" metalness={.9} roughness={.2} /></mesh>}
    </group>)}
    <Form at={[0,1.135,.376]} scale={[.087,.064,.08]} color={skin} />
    <Form at={[0,.99,.365]} scale={[.15,.09,.027]} color="#401d18" />
    {girl && <><mesh position={[0,1.023,.399]}><boxGeometry args={[.2,.04,.012]} /><meshStandardMaterial color="#fff9e7" /></mesh><mesh position={[0,1.26,.4]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.008,.008,.08,12]} /><meshStandardMaterial color="#c5ae83" metalness={.9} /></mesh></>}
    <Form at={[0,1.52,-.065]} scale={[.424,.22,.32]} color="#1b1513" />
    {Array.from({length:girl?90:48},(_,i)=>{const a=i*2.39996;const z=1-i/(girl?90:48);const r=Math.sqrt(1-z*z);return <Form key={i} at={[Math.cos(a)*r*.42,1.45+z*.22,Math.sin(a)*r*.31-.04]} scale={[girl?.063:.04,girl?.065:.035,girl?.063:.04]} color={i%3?'#1d1715':'#2d2420'} />})}
    {girl && [-1,1].map(s=><group key={s}><Form at={[s*.49,1.59,-.04]} scale={[.3,.33,.27]} color="#211a18" />{Array.from({length:35},(_,i)=>{const a=i*2.39996;const z=1-2*i/35;const r=Math.sqrt(1-z*z);return <Form key={i} at={[s*.49+Math.cos(a)*r*.28,1.59+z*.3,-.04+Math.sin(a)*r*.25]} scale={[.085,.085,.085]} color={i%2?'#211a18':'#2b211f'} />})}<group position={[s*.33,1.64,.24]} rotation={[0,0,s*.2]}>{[-1,1].map(n=><mesh key={n} position={[n*.085,0,0]} rotation={[0,0,n*Math.PI/2]}><coneGeometry args={[.115,.16,32]} /><meshStandardMaterial color="#6d1234" roughness={.8} /></mesh>)}<Form at={[0,0,.01]} scale={[.05,.06,.04]} color="#871941" /></group></group>)}
    <group ref={left} position={[-.36,.65,0]}><Form at={[0,girl?.5:.25,0]} scale={[.085,girl?.55:.3,.085]} color={skin} /><group position={[0,girl?1.13:.59,0]}><Hand skin={skin} /></group></group>
    <group ref={right} position={[.36,.65,0]}><Form at={[0,girl?.5:.25,0]} scale={[.085,girl?.55:.3,.085]} color={skin} /><group position={[0,girl?1.13:.59,0]}><Hand skin={skin} /></group></group>
    {!girl && [-1,1].map(s=><Form key={s} at={[s*.28,.54,0]} scale={[.15,.19,.2]} color={shirt} />)}
    <mesh position={[0,.79,.1]} rotation={[Math.PI/2-.35,0,0]}><torusGeometry args={[.135,girl?.012:.006,12,48]} /><meshStandardMaterial color="#c1a05d" metalness={.8} roughness={.3} /></mesh>
  </group>
}
