import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
export function PwaStatus() {
 const location=useLocation()
 const [editing,setEditing]=useState(false)
 const [registration,setRegistration]=useState<ServiceWorkerRegistration>()
 const {needRefresh:[refresh,setRefresh],updateServiceWorker}=useRegisterSW({onRegisteredSW(_url,r){setRegistration(r)}})
 useEffect(()=>{
  if(!registration)return
  let worker=registration.installing
  const waiting=()=>{if(registration.waiting&&navigator.serviceWorker.controller)setRefresh(true)}
  const found=()=>{worker?.removeEventListener('statechange',waiting);worker=registration.installing;worker?.addEventListener('statechange',waiting)}
  registration.addEventListener('updatefound',found);found();waiting()
  void registration.update().catch(()=>{})
  return()=>{registration.removeEventListener('updatefound',found);worker?.removeEventListener('statechange',waiting)}
 },[registration,setRefresh])
 useEffect(()=>{const changed=()=>setEditing(true);document.addEventListener('input',changed);return()=>document.removeEventListener('input',changed)},[])
 useEffect(()=>setEditing(false),[location.pathname])
 useEffect(()=>{
  const check=()=>{if(!document.hidden&&navigator.onLine)void registration?.update().catch(()=>{})}
  const timer=window.setInterval(check,5*60*1000)
  document.addEventListener('visibilitychange',check);window.addEventListener('online',check)
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('online',check)}
 },[registration])
 const applying=useRef(false)
 const applyUpdate=useCallback(()=>{
  if(applying.current)return
  if(!registration?.waiting){void updateServiceWorker(true);return}
  applying.current=true
  navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true})
  registration.waiting.postMessage({type:'SKIP_WAITING'})
 },[registration,updateServiceWorker])
 const sensitive=/\/(checkout|orders|sign-in|sign-up|reset|security)(\/|$)/.test(location.pathname)
 useEffect(()=>{
  if(!refresh||editing||sensitive)return
  const timer=window.setInterval(()=>{if(!document.hidden&&!document.querySelector('[role="dialog"],form :focus'))applyUpdate()},5000)
  return()=>clearInterval(timer)
 },[refresh,editing,sensitive,location.pathname,applyUpdate])
 if(!refresh)return null
 return <aside className="fb-pwa-status" role="status"><span>{editing||sensitive?'An update is ready. Finish this step; it will apply on a safe page.':'Updating FindBox automatically…'}</span>{!editing&&!sensitive&&<button onClick={applyUpdate}>Update now</button>}</aside>
}
