import {type ReactNode} from 'react'
import {Link,useLocation} from 'react-router-dom'
import {SignIn1} from '@/components/ui/modern-stunning-sign-in'

/** Every family and school sign-in screen, plus account security, shares the cinematic sign-in card. */
export function AuthFrame({children,title,lede,back,tone='family',width='sm',kicker}:{children:ReactNode;title:string;lede?:string;back?:{to:string;label:string};tone?:'family'|'school';width?:'sm'|'md';kicker?:string}){
 const {pathname,state}=useLocation()
 const signup=pathname.endsWith('sign-up')
 const switchable=['/app/sign-in','/app/sign-up'].includes(pathname)
 return <SignIn1
  title={title}
  lede={lede}
  kicker={kicker??(tone==='school'?'School portal':undefined)}
  tabs={switchable?{mode:signup?'sign-up':'sign-in',signIn:'/app/sign-in',signUp:'/app/sign-up',state}:undefined}
  screen={pathname}
  back={back}
  image={tone==='school'?'/media/editorial/staff.webp':signup?'/media/editorial/auth-signup.webp':'/media/editorial/auth-signin.webp'}
  wide={width==='md'}
  footer={<nav aria-label="Account help" className="flex gap-6 text-xs text-gray-400"><Link to="/contact" className="cinema-link">Need a hand?</Link><Link to="/privacy" className="cinema-link">Your privacy</Link></nav>}
 >{children}</SignIn1>
}
export function DemoAccountNote({className}:{className?:string}){return <p className={className}/>}
