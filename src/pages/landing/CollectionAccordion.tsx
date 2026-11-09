import {imagery} from '@/data/imagery';
import {useEffect,useId,useRef,useState} from 'react';
import {motion,useInView} from 'motion/react';
import {MapPin,Plus,ArrowRight} from 'lucide-react';
import './collection-accordion.css';
const locations=[
 {name:'Main reception',image:imagery.collectionPoints.reception.src,alt:imagery.collectionPoints.reception.alt,tag:'EVERYDAY BELONGINGS',copy:'A familiar first stop for found bags, bottles and the little things left behind.',hours:'During school office hours',tone:'#121a15'},
 {name:'Library desk',image:imagery.collectionPoints.library.src,alt:imagery.collectionPoints.library.alt,tag:'BOOKS & CLASSROOM FINDS',copy:'A supervised place for recovered books, pencil cases and classroom belongings.',hours:'During staffed library hours',tone:'#16141d'},
 {name:'Sports office',image:imagery.collectionPoints.sports.src,alt:imagery.collectionPoints.sports.alt,tag:'KIT & AFTER-PRACTICE FINDS',copy:'Keep sports bags, uniforms and after-practice finds in the care of your school team.',hours:'During staffed sports sessions',tone:'#1a1813'}
];
// Interaction and spring reveal inspired by the user-supplied ApertureAccordion reference.
export function CollectionAccordion(){
 const [active,setActive]=useState(0),[hover,setHover]=useState(false),[focused,setFocused]=useState(false),[hidden,setHidden]=useState(document.hidden),[reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const ref=useRef<HTMLDivElement>(null),buttons=useRef<(HTMLButtonElement|null)[]>([]),visible=useInView(ref,{amount:.35}),id=useId();
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change)},[]);
 useEffect(()=>{const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[]);
 useEffect(()=>{if(!visible||hidden||hover||focused||reduced)return;const t=setTimeout(()=>setActive(i=>(i+1)%locations.length),7000);return()=>clearTimeout(t)},[active,visible,hidden,hover,focused,reduced]);
 function key(e:React.KeyboardEvent,index:number){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?locations.length-1:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?2:1))%locations.length;setActive(n);buttons.current[n]?.focus()}
 return <div className="cc-collection" ref={ref} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFocused(false)}} aria-label="Explore school collection locations">
 <div className="cc-panels">{locations.map((p,i)=>{const open=active===i;return <motion.article key={p.name} className={'cc-panel '+(open?'is-active':'')} style={{backgroundColor:p.tone}} animate={{flexGrow:open?4.6:1}} transition={reduced?{duration:0}:{type:'spring',stiffness:260,damping:34,mass:1}}>
 <button className="cc-trigger" ref={el=>{buttons.current[i]=el}} id={id+'-trigger-'+i} aria-expanded={open} aria-controls={id+'-content-'+i} onClick={()=>setActive(i)} onKeyDown={e=>key(e,i)}><span className="cc-index">0{i+1}</span><span className="cc-title">{p.name}</span><span className="cc-mark"><Plus size={20}/></span></button>
 <div className="cc-art"><img src={p.image} alt={p.alt} loading="lazy" width={1536} height={1024} aria-hidden={!open}/><span className="cc-image-caption" aria-hidden={!open}><MapPin size={14}/>{p.name}</span></div>
 <div className="cc-copy" id={id+'-content-'+i} role="region" aria-labelledby={id+'-trigger-'+i} hidden={!open}><p className="cc-eyebrow">{p.tag}</p><p className="cc-description">{p.copy}</p><span className="cc-hours">{p.hours}<ArrowRight size={15}/></span></div>
 </motion.article>})}</div><p className="cc-school-note">Your school sets its collection locations and opening hours. Follow your private return update for the right collection point.</p></div>
}
