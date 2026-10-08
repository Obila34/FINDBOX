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
]
export function HeroExperience(){return <div className="fs-service-hero">
 <div className="fs-service-intro"><p className="fb-kicker">LABEL IT. CONNECT IT. HELP IT HOME.</p><h1>Your things.<br/><em>A way back.</em></h1><p>We supply the right labels for your everyday belongings.<br/>Connect them in FindBox, so a finder can help get them back.</p><div className="fs-service-actions"><Button to="/shop/catalog" size="lg" arrow>Choose your labels</Button><Link to="/app/sign-in">Already labelled? Open the app <ArrowUpRight size={16}/></Link></div></div>
 <div className="fs-service-examples" aria-label="How we label your belongings">{options.map(p=><Link key={p.id} to={'/shop/products/'+(server?p.serverId:p.id)}><img src={'/media/catalog/'+p.image+'-960.webp'} srcSet={'/media/catalog/'+p.image+'-480.webp 480w, /media/catalog/'+p.image+'-960.webp 960w'} sizes="(max-width:700px) 45vw, 300px" alt={p.title+' with '+p.finish.toLowerCase()}/><div><h2>{p.title}</h2><p>{p.finish}</p><ArrowUpRight size={18}/></div></Link>)}</div>
 <div className="fs-service-bottom"><p><span>01 Choose labels</span><span>02 Connect in the app</span><span>03 Scan to help return</span></p><Link to={'/shop/products/'+(server?'tap-3':'tap')}>Prefer a tap? Explore NFC <ArrowUpRight size={15}/></Link></div>
 </div>}
export function PremiumFinder(){return <section className="fs-premium-finder" id="premium-finder"><img src="/media/catalog/finder-960.webp" alt="Findable Key Card concept shown with a wallet and keys" loading="lazy"/><div><p className="fb-kicker">THE PREMIUM COLLECTION · COMING SOON</p><h2>For the things<br/><em>you can’t leave behind.</em></h2><h3>Findable Key Card</h3><p>A dedicated item finder for your wallet, bag or keys. Our premium addition to a life with a little less lost.</p><Link className="fs-finder-link" to={'/shop/products/'+(server?'finder-1':'finder')}>Discover the Key Card <ArrowUpRight size={18}/></Link><small>Target price KSh 3,499. Hardware and phone compatibility will be confirmed before orders open. Sold separately from label kits.</small></div></section>}
