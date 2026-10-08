import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { HaloReel } from '@/components/ui/halo-reel'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import './service-hero.css'
const server=import.meta.env.VITE_SERVER_MODE==='true'
const options=[
 {title:'Clothes',finish:'Heat-transfer fabric labels',image:'fabric-qr',id:'uniform',serverId:'uniform-12'},
 {title:'Bottles & books',finish:'Peel-and-stick QR labels',image:'everyday-qr',id:'everyday',serverId:'everyday-12'},
 {title:'Cables & chargers',finish:'Cable wraps & compact stickers',image:'tech-qr',id:'cables',serverId:'cables-6'},
 {title:'Bags & keys',finish:'Laser-engraved QR tags',image:'engraved-qr',id:'adventure',serverId:'bag-2'},
 {title:'Tap & find',finish:'NFC tags with a QR fallback',image:'nfc-qr',id:'tap',serverId:'tap-3'},
 {title:'The complete kit',finish:'41 labels. Every kind of day.',image:'complete-qr',id:'complete',serverId:'complete-41'},
 {title:'Findable Key Card',finish:'Premium item finder · Coming soon',image:'finder',id:'finder',serverId:'finder-1'},
]
export function HeroExperience(){
 const hero=useRef<HTMLDivElement>(null),reduced=useReducedMotion()
 const {scrollYProgress}=useScroll({target:hero,offset:['start start','end start']})
 const y=useTransform(scrollYProgress,[0,1],[0,74]),scale=useTransform(scrollYProgress,[0,.85],[1,.965]),opacity=useTransform(scrollYProgress,[0,.95],[1,.56])
 return <motion.div ref={hero} className="fs-service-hero" style={reduced?undefined:{y,scale,opacity}}>
 <span className="fs-hero-aurora fs-hero-aurora-one" aria-hidden="true"/><span className="fs-hero-aurora fs-hero-aurora-two" aria-hidden="true"/>
 <motion.div className="fs-service-intro" initial={reduced?false:{opacity:0,x:38,filter:'blur(8px)'}} animate={{opacity:1,x:0,filter:'blur(0px)'}} transition={{duration:.9,delay:.18,ease:[.2,.75,.2,1]}}><p className="fb-kicker">LABEL IT. CONNECT IT. HELP IT HOME.</p><h1>Your things.<br/><em>A way back.</em></h1><p>We supply the right labels for your everyday belongings.<br/>Connect them in FindBox, so a finder can help get them back.</p><div className="fs-service-actions"><Button to="/shop/catalog" size="lg" arrow magnetic>Choose your labels</Button><Link to="/app/sign-in" data-magnetic>Already labelled? Open the app <ArrowUpRight size={16}/></Link></div></motion.div>
 <HaloReel titles={options.map(p=>p.title)} renderItem={(i,active)=>{const p=options[i];return <Link className="fs-halo-product" tabIndex={active?0:-1} draggable={false} to={'/shop/products/'+(server?p.serverId:p.id)}><img src={'/media/catalog/'+p.image+'-960.webp'} srcSet={'/media/catalog/'+p.image+'-480.webp 480w, /media/catalog/'+p.image+'-960.webp 960w'} sizes="310px" loading={i===0?'eager':'lazy'} draggable={false} alt={p.title+' with '+p.finish.toLowerCase()}/><div><span>THE FINDBOX COLLECTION</span><h2>{p.title}</h2><p>{p.finish}</p><ArrowUpRight size={18}/></div></Link>}}/>
 <div className="fs-service-bottom"><p><span>01 Choose labels</span><span>02 Connect in the app</span><span>03 Scan to help return</span></p><Link to={'/shop/products/'+(server?'tap-3':'tap')}>Prefer a tap? Explore NFC <ArrowUpRight size={15}/></Link></div>
 </motion.div>}
export function PremiumFinder(){return <section className="fs-premium-finder" id="premium-finder"><img src="/media/catalog/finder-960.webp" alt="Findable Key Card concept shown with a wallet and keys" loading="lazy"/><div><p className="fb-kicker">THE PREMIUM COLLECTION · COMING SOON</p><h2>For the things<br/><em>you can’t leave behind.</em></h2><h3>Findable Key Card</h3><p>A dedicated item finder for your wallet, bag or keys. Our premium addition to a life with a little less lost.</p><Link className="fs-finder-link" to={'/shop/products/'+(server?'finder-1':'finder')}>Discover the Key Card <ArrowUpRight size={18}/></Link><small>Target price KSh 3,499. Hardware and phone compatibility will be confirmed before orders open. Sold separately from label kits.</small></div></section>}
