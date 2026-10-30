import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
export function PwaStatus() {
 const location=useLocation()
 const [editing,setEditing]=useState(false)
 const [registration,setRegistration]=useState<ServiceWorkerRegistration>()
 const [refresh,setRefresh]=useState(false)
 useEffect(()=>{
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return
  let disposed=false
  void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(r=>{if(!disposed)setRegistration(r)}).catch(()=>{})
  return()=>{disposed=true}
 },[])
 useEffect(()=>{
  if(!registration)return
  let worker=registration.installing
  const waiting=()=>{if(registration.waiting&&navigator.serviceWorker.controller)setRefresh(true)}
  const found=()=>{worker?.removeEventListener('statechange',waiting);worker=registration.installing;worker?.addEventListener('statechange',waiting)}
  registration.addEventListener('updatefound',found);found();waiting()
  void registration.update().catch(()=>{})
  return()=>{registration.removeEventListener('updatefound',found);worker?.removeEventListener('statechange',waiting)}
 },[registration,setRefresh])
 useEffect(()=>{const changed=()=>setEditing(true),saved=()=>setEditing(false);document.addEventListener('input',changed);window.addEventListener('findbox-form-saved',saved);return()=>{document.removeEventListener('input',changed);window.removeEventListener('findbox-form-saved',saved)}},[])
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
  if(!registration?.waiting){setRefresh(false);void registration?.update().catch(()=>{});return}
  applying.current=true
  navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true})
  registration.waiting.postMessage({type:'SKIP_WAITING'})
 },[registration])
 const sensitive=/\/(checkout|orders|sign-in|sign-up|reset|security)(\/|$)/.test(location.pathname)
 useEffect(()=>{if(refresh&&!editing&&!sensitive)applyUpdate()},[refresh,editing,sensitive,applyUpdate])
 return null
}
