import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl'

const vertex = `attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,0.,1.);}`
// Adapted from the supplied orb shader. The brand icon intentionally has no audio input.
const fragment = `precision highp float;
uniform float iTime; uniform vec3 iResolution; varying vec2 vUv;
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yxz+19.19);return -1.+2.*fract(vec3(p.x+p.y,p.x+p.z,p.y+p.z)*p.zyx);}
float snoise3(vec3 p){const float K1=.333333333;const float K2=.166666667;vec3 i=floor(p+(p.x+p.y+p.z)*K1);vec3 d0=p-(i-(i.x+i.y+i.z)*K2);vec3 e=step(vec3(0.),d0-d0.yzx);vec3 i1=e*(1.-e.zxy);vec3 i2=1.-e.zxy*(1.-e);vec3 d1=d0-(i1-K2);vec3 d2=d0-(i2-K1);vec3 d3=d0-.5;vec4 h=max(.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.);vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.)));return dot(vec4(31.316),n);}
void main(){vec2 uv=(vUv*iResolution.xy-iResolution.xy*.5)/min(iResolution.x,iResolution.y)*2.3;float ang=atan(uv.y,uv.x);float len=length(uv);float n=snoise3(vec3(uv*.65,iTime*.5))*.5+.5;float r=mix(.76,.84,n);float d=abs(len-r);float v0=1./(1.+10.*d);v0*=1.-smoothstep(r,r*1.05,len);float cl=cos(ang+iTime*2.)*.5+.5;vec2 pos=vec2(cos(-iTime),sin(-iTime))*r;float v1=1.5/(1.+5.*pow(distance(uv,pos),2.));v1*=1./(1.+50.*d);float v2=1.-smoothstep(mix(.6,1.,n*.5),1.,len);float v3=smoothstep(.6,.8,len);vec3 col=mix(vec3(.045,.38,.34),vec3(.43,.85,.64),cl);col=mix(vec3(.01,.075,.08),col,v0);col=clamp((col+v1*.55)*v2*v3,0.,1.);float a=max(max(col.r,col.g),col.b);gl_FragColor=vec4(col/(a+.00001),a);}`
export function VoicePoweredOrb({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = host.current; if (!container) return
    let renderer: Renderer
    try { renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(devicePixelRatio || 1, 2), premultipliedAlpha: false }) } catch { return }
    const gl = renderer.gl; gl.clearColor(0, 0, 0, 0)
    const geometry = new Triangle(gl)
    const program = new Program(gl, { vertex, fragment, transparent: true, uniforms: { iTime: { value: 1 }, iResolution: { value: new Vec3(1, 1, 1) } } })
    const mesh = new Mesh(gl, { geometry, program }); container.appendChild(gl.canvas)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'); let visible = false; let frame = 0
    const draw = (time = 1000) => { program.uniforms.iTime.value = reduced.matches ? 1 : time * .001; renderer.render({ scene: mesh }); frame = visible && !document.hidden && !reduced.matches ? requestAnimationFrame(draw) : 0 }
    const sync = () => { cancelAnimationFrame(frame); draw() }
    const resize = () => { renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1)); program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, 1); sync() }
    const sizing = new ResizeObserver(resize); sizing.observe(container)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() }); observer.observe(container)
    reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); resize()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); sizing.disconnect(); reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); geometry.remove(); program.remove(); gl.canvas.remove(); gl.getExtension('WEBGL_lose_context')?.loseContext() }
  }, [])
  return <div ref={host} className={'fb-voice-orb ' + className} aria-hidden="true" />
}
