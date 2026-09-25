import { useEffect, useMemo, useRef } from 'react'
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'

extend({ Line2, LineMaterial, LineGeometry })

export type GeometricOrbConfig = {
  numLines?: number
  radius?: number
  speed?: number
  lineWidth?: number
  color?: string
  background?: string
  squiggleAmount?: number
  squiggleFrequency?: number
  squiggleSpeed?: number
  pointsPerLine?: number
  enableZoom?: boolean
  enablePan?: boolean
  minDistance?: number
  maxDistance?: number
}

const defaults: Required<GeometricOrbConfig> = {
  numLines: 20,
  radius: 1.5,
  speed: 20,
  lineWidth: 2,
  color: '#eeeeee',
  background: '#0a0a0a',
  squiggleAmount: 0.04,
  squiggleFrequency: 4,
  squiggleSpeed: 2,
  pointsPerLine: 96,
  enableZoom: true,
  enablePan: false,
  minDistance: 2,
  maxDistance: 20,
}

function LatitudeLines({ config }: { config: Required<GeometricOrbConfig> }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const camDirRef = useRef(new THREE.Vector3())
  const { size } = useThree()
  const colorInt = useMemo(() => new THREE.Color(config.color).getHex(), [config.color])
  const lineConstants = useMemo(() => Array.from({ length: config.numLines }, (_, i) => ({
    longitudeRotation: (i / config.numLines) * Math.PI,
    timeOffset: (i / config.numLines) * config.speed,
    cosR: Math.cos((i / config.numLines) * Math.PI),
    sinR: Math.sin((i / config.numLines) * Math.PI),
  })), [config.numLines, config.speed])
  const materials = useMemo(() => Array.from({ length: config.numLines }, () => new LineMaterial({
    color: colorInt,
    linewidth: config.lineWidth,
    transparent: true,
    opacity: 1,
    vertexColors: true,
  })), [colorInt, config.numLines, config.lineWidth])
  const geometries = useMemo(() => Array.from({ length: config.numLines }, () => new LineGeometry()), [config.numLines])

  useEffect(() => () => {
    materials.forEach((material) => material.dispose())
    geometries.forEach((geometry) => geometry.dispose())
  }, [materials, geometries])

  useEffect(() => {
    materials.forEach((material) => material.resolution.set(size.width, size.height))
  }, [materials, size.width, size.height])

  const vertexCount = config.pointsPerLine + 1
  const positionBuffer = useMemo(() => new Float32Array(vertexCount * 3), [vertexCount])
  const colorBuffer = useMemo(() => new Float32Array(vertexCount * 3), [vertexCount])
  const baseColor = useMemo(() => new THREE.Color(config.color), [config.color])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const camDir = camDirRef.current.copy(state.camera.position).normalize()
    for (let lineIdx = 0; lineIdx < config.numLines; lineIdx++) {
      const group = groupRefs.current[lineIdx]
      const constants = lineConstants[lineIdx]
      const geometry = geometries[lineIdx]
      if (!group || !constants || !geometry) continue
      const { timeOffset, longitudeRotation, cosR, sinR } = constants
      const progress = ((time + timeOffset) % config.speed) / config.speed
      const latitude = progress * Math.PI
      const circleRadius = Math.sin(latitude) * config.radius
      const yPosition = Math.cos(latitude) * config.radius
      for (let i = 0; i < config.pointsPerLine; i++) {
        const angle = (i / config.pointsPerLine) * Math.PI * 2
        const squiggle = Math.sin(angle * config.squiggleFrequency + time * config.squiggleSpeed + lineIdx * 0.5) * config.squiggleAmount
        const radiusSquiggle = Math.cos(angle * config.squiggleFrequency * 1.3 + time * config.squiggleSpeed * 0.8) * config.squiggleAmount * 0.5
        const displacedRadius = circleRadius + (squiggle + radiusSquiggle) * circleRadius
        const ySquiggle = Math.sin(angle * config.squiggleFrequency * 0.7 + time * config.squiggleSpeed * 1.2) * config.squiggleAmount * 0.4
        const x = Math.cos(angle) * displacedRadius
        const y = yPosition + ySquiggle * circleRadius
        const z = Math.sin(angle) * displacedRadius
        const offset = i * 3
        positionBuffer[offset] = x
        positionBuffer[offset + 1] = y
        positionBuffer[offset + 2] = z
        const worldX = x * cosR + z * sinR
        const worldZ = -x * sinR + z * cosR
        const dot = worldX * camDir.x + y * camDir.y + worldZ * camDir.z
        const opacity = ((dot / config.radius + 1) / 2) * 0.85 + 0.15
        colorBuffer[offset] = baseColor.r * opacity
        colorBuffer[offset + 1] = baseColor.g * opacity
        colorBuffer[offset + 2] = baseColor.b * opacity
      }
      const last = config.pointsPerLine * 3
      positionBuffer[last] = positionBuffer[0]
      positionBuffer[last + 1] = positionBuffer[1]
      positionBuffer[last + 2] = positionBuffer[2]
      colorBuffer[last] = colorBuffer[0]
      colorBuffer[last + 1] = colorBuffer[1]
      colorBuffer[last + 2] = colorBuffer[2]
      geometry.setPositions(positionBuffer)
      geometry.setColors(colorBuffer)
      group.rotation.y = longitudeRotation
    }
  })

  return <>{geometries.map((geometry, lineIdx) => (
    <group key={lineIdx} ref={(element) => { groupRefs.current[lineIdx] = element }}>
      {/* @ts-expect-error Line2 is registered with React Three Fiber above. */}
      <line2>
        <primitive object={geometry} attach="geometry" />
        <primitive object={materials[lineIdx]} attach="material" />
      {/* @ts-expect-error Line2 is registered with React Three Fiber above. */}
      </line2>
    </group>
  ))}</>
}

export function GeometricOrb({ config: configOverrides, className = '' }: { config?: GeometricOrbConfig; className?: string }) {
  const configKey = JSON.stringify(configOverrides)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => ({ ...defaults, ...configOverrides }), [configKey])
  return <div className={`h-full w-full ${className}`} style={{ background: config.background }}>
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: true, alpha: false }} dpr={[1, 1.5]}>
      <color attach="background" args={[config.background]} />
      <LatitudeLines config={config} />
      <OrbitControls enablePan={config.enablePan} enableZoom={config.enableZoom} enableRotate={false} minDistance={config.minDistance} maxDistance={config.maxDistance} />
    </Canvas>
  </div>
}

export default GeometricOrb
