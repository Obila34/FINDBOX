import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
const TAU=Math.PI*2
export function HaloReel({titles,renderItem}:{titles:string[];renderItem:(index:number,active:boolean)=>ReactNode}) {
 const stage=useRef<HTMLDivElement>(null),rotation=useMotionValue(0),reduced=useReducedMotion(),visible=useInView(stage)
 const [width,setWidth]=useState(560),[active,setActive]=useState(0),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[focused,setFocused]=useState(false),[hidden,setHidden]=useState(document.hidden)
 const controls=useRef<ReturnType<typeof animate>|null>(null),drag=useRef<{x:number;start:number;id:number;moved:boolean}|null>(null),suppressClick=useRef(false)
 const step=TAU/titles.length
 useEffect(()=>{const el=stage.current;if(!el)return;const observer=new ResizeObserver(([e])=>setWidth(e.contentRect.width));observer.observe(el);return()=>observer.disconnect()},[])
 useEffect(()=>{const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);return()=>{document.removeEventListener('visibilitychange',change);controls.current?.stop()}},[])
 useMotionValueEvent(rotation,'change',r=>setActive(((Math.round(-r/step)%titles.length)+titles.length)%titles.length))
 function move(target:number){controls.current?.stop();if(reduced)rotation.set(target);else controls.current=animate(rotation,target,{duration:.75,ease:[.4,0,.2,1]})}
 function go(index:number){setPaused(true);const delta=((index-active+titles.length+titles.length/2)%titles.length)-titles.length/2;move(Math.round(rotation.get()/step)*step-delta*step)}
 useEffect(()=>{if(paused||hover||focused||hidden||!visible||reduced)return;const timer=setTimeout(()=>move(Math.round(rotation.get()/step)*step-step),4300);return()=>clearTimeout(timer)},[active,paused,hover,focused,hidden,visible,reduced,step])
 const cardW=Math.min(310,width*.62),cardH=cardW/1.22+112,height=width<420?440:550
 return <section className="fs-service-carousel" aria-label="Labelling options" aria-roledescription="carousel" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false)}}>
 <div className="fs-carousel-eyebrow"><span>MADE FOR YOUR EVERYDAY</span><span aria-hidden="true">{String(active+1).padStart(2,'0')} / {String(titles.length).padStart(2,'0')}</span></div>
 <div ref={stage} className="fs-halo-stage" style={{height}} tabIndex={0} aria-label="Drag or use arrow keys to explore products" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(active+(e.key==='ArrowRight'?1:-1))}}}
 onPointerDown={e=>{if(e.button!==0)return;controls.current?.stop();suppressClick.current=false;drag.current={x:e.clientX,start:rotation.get(),id:e.pointerId,moved:false}}}
 onPointerMove={e=>{const d=drag.current;if(!d)return;const distance=e.clientX-d.x;if(Math.abs(distance)>8){d.moved=true;suppressClick.current=true;setPaused(true);e.currentTarget.setPointerCapture(e.pointerId)}if(d.moved)rotation.set(d.start+distance/width*TAU)}}
 onPointerUp={e=>{const d=drag.current;if(!d)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.moved)move(Math.round(rotation.get()/step)*step)}}
 onPointerCancel={()=>{drag.current=null;move(Math.round(rotation.get()/step)*step)}} onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false}}}>
 <div className="fs-halo-ring" aria-hidden="true"/>
 {titles.map((title,i)=><ReelCard key={title} rotation={rotation} angle={i*step} width={cardW} height={cardH} stageWidth={width} stageHeight={height} active={active===i} onSelect={()=>go(i)} title={title}>{renderItem(i,active===i)}</ReelCard>)}
 </div>
 <div className="fs-carousel-controls"><button type="button" onClick={()=>go(active-1)} aria-label="Previous product"><ArrowLeft size={18}/></button><div role="group" aria-label="Choose a product slide">{titles.map((title,i)=><button type="button" key={title} aria-label={'Show '+title} aria-pressed={i===active} onClick={()=>go(i)}><span/></button>)}</div><button type="button" onClick={()=>go(active+1)} aria-label="Next product"><ArrowRight size={18}/></button></div>
 <div className="fs-halo-footer"><span>Drag to explore</span><button onClick={()=>setPaused(!paused)} disabled={!!reduced} aria-label={paused||reduced?'Play carousel':'Pause carousel'}>{paused||reduced?<Play size={13}/>:<Pause size={13}/>} {reduced?'Motion reduced':paused?'Play':'Pause'}</button></div>
 <span className="fs-carousel-status" aria-live={paused?'polite':'off'} aria-atomic="true">{titles[active]}, slide {active+1} of {titles.length}</span>
 </section>
}
function ReelCard({rotation,angle,width,height,stageWidth,stageHeight,active,onSelect,title,children}:{rotation:MotionValue<number>;angle:number;width:number;height:number;stageWidth:number;stageHeight:number;active:boolean;onSelect:()=>void;title:string;children:ReactNode}){
 const cos=useTransform(rotation,r=>Math.cos(angle+r)),sin=useTransform(rotation,r=>Math.sin(angle+r))
 const x=useTransform(cos,c=>c*stageWidth*.25),y=useTransform(sin,s=>s*stageHeight*.28),scale=useTransform(cos,c=>.48+.52*(c+1)/2),zIndex=useTransform(cos,c=>Math.round((c+1)*100))
 return <motion.div className="fs-halo-card" role="group" aria-roledescription="slide" aria-label={title} aria-hidden={!active} style={{x,y,scale,zIndex,width,height,left:'38%',top:'50%',marginLeft:-width/2,marginTop:-height/2}} onClickCapture={e=>{if(!active){e.preventDefault();e.stopPropagation();onSelect()}}}>{children}</motion.div>
}
