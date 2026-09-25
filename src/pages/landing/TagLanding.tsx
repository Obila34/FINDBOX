import { Link, useParams } from 'react-router-dom'
import { QrCode, ShieldCheck, ArrowUpRight } from 'lucide-react'
import { StudioBrand } from '@/components/brand/StudioBrand'
export function TagLanding() {
  const { code } = useParams(); const valid = /^FB-[A-Z0-9]{4}-[A-Z0-9]{2}$/i.test(code ?? '')
  return <div className="fb-tag-public"><StudioBrand /><div><QrCode size={45} /><p className="fb-kicker">A LITTLE ACT OF KINDNESS</p><h1>{valid ? 'You found a way home.' : 'Let’s find the right tag.'}</h1><p>{valid ? 'Please hand this belonging to the school office. Staff will scan the tag, check the record, and help it back to its owner.' : 'This tag format is not recognised. Try scanning again or ask the school office for help.'}</p>{valid && <code>{code}</code>}<span><ShieldCheck size={16} /> Personal details stay private.</span><Link className="fb-black-link" to="/app/sign-in">Open FindBox <ArrowUpRight size={17} /></Link></div></div>
}
