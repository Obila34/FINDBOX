import { useState } from 'react'
import { Shader, Swirl, ChromaFlow, FlutedGlass, FilmGrain } from 'shaders/react'

export default function StudioShader() {
  const [unavailable, setUnavailable] = useState(false)
  if (unavailable) return null
  return <Shader className="fb-shader-canvas" disableTelemetry onUnavailable={() => setUnavailable(true)}>
    <Swirl colorA="#ffffff" colorB="#f0f0f0" detail={1.7} />
    <ChromaFlow baseColor="#ffffff" downColor="#0d6166" leftColor="#0d6166" rightColor="#0d6166" upColor="#0d6166" momentum={13} radius={3.5} />
    <FlutedGlass aberration={0.61} angle={31} frequency={8} highlight={0.12} highlightSoftness={0} lightAngle={-90} refraction={4} shape="rounded" softness={1} speed={0.15} />
    <FilmGrain strength={0.05} />
  </Shader>
}
