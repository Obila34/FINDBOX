import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ImageStreamHero } from '@/components/ui/image-stream-hero'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import './service-hero.css'
const server=import.meta.env.VITE_SERVER_MODE==='true'
const streamImages=[
 {src:'/media/catalog/fabric-qr-960.webp'},
 {src:'/media/catalog/everyday-qr-960.webp'},
 {src:'/media/catalog/tech-qr-960.webp'},
 {src:'/media/catalog/engraved-qr-960.webp'},
 {src:'/media/catalog/nfc-qr-960.webp'},
 {src:'/media/catalog/complete-qr-960.webp'},
 {src:'/media/catalog/finder-960.webp'},
 {src:'/media/catalog/bottle-960.webp'},
 {src:'/media/catalog/clothing-960.webp'},
 {src:'/media/catalog/lunchbox-960.webp'},
]
export function HeroExperience(){
 const hero=useRef<HTMLDivElement>(null),reduced=useReducedMotion()
 const {scrollYProgress}=useScroll({target:hero,offset:['start start','end start']})
 const y=useTransform(scrollYProgress,[0,1],[0,74]),scale=useTransform(scrollYProgress,[0,.85],[1,.965]),opacity=useTransform(scrollYProgress,[0,.95],[1,.56])
 return <motion.div ref={hero} className="fs-service-hero fs-stream-service-hero" style={reduced?undefined:{y,scale,opacity}}>
 <span className="fs-hero-aurora fs-hero-aurora-one" aria-hidden="true"/><span className="fs-hero-aurora fs-hero-aurora-two" aria-hidden="true"/>
 <ImageStreamHero images={streamImages} speed={38} cards={10} axis={56} className="fs-findbox-stream">
  <div className="fs-stream-content">
   <motion.div className="fs-stream-heading" initial={reduced?false:{opacity:0,y:-24,filter:'blur(8px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} transition={{duration:.9,delay:.12,ease:[.2,.75,.2,1]}}><h1>Every belonging.<br/><em>A way home.</em></h1></motion.div>
   <motion.div className="fs-stream-shop" initial={reduced?false:{opacity:0,scale:.88}} animate={{opacity:1,scale:1}} transition={{duration:.7,delay:.45,ease:[.2,.75,.2,1]}}><Button to="/shop/catalog" size="lg" arrow magnetic>Shop FindBox labels</Button></motion.div>
   <div className="fs-stream-caption"><p>QR, NFC, fabric and finder tags connected to one private return system.</p></div>
  </div>
 </ImageStreamHero>
 </motion.div>}
export function PremiumFinder(){return <section className="fs-premium-finder" id="premium-finder"><img src="/media/catalog/finder-960.webp" alt="Findable Key Card concept shown with a wallet and keys" loading="lazy"/><div><p className="fb-kicker">THE PREMIUM COLLECTION · COMING SOON</p><h2>For the things<br/><em>you can’t leave behind.</em></h2><h3>Findable Key Card</h3><p>A dedicated item finder for your wallet, bag or keys. Our premium addition to a life with a little less lost.</p><Link className="fs-finder-link" to={'/shop/products/'+(server?'finder-1':'finder')}>Discover the Key Card <ArrowUpRight size={18}/></Link><small>Target price KSh 3,499. Hardware and phone compatibility will be confirmed before orders open. Sold separately from label kits.</small></div></section>}
