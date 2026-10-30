import { useEffect,useRef } from 'react'
export function useBackgroundRefresh(refresh:()=>Promise<boolean>,active:boolean,key:string,onChange:()=>void){
 const dirty=useRef(false),fn=useRef(refresh),enabled=useRef(active),changed=useRef(onChange),pending=useRef(false),failed=useRef(false)
 fn.current=refresh;enabled.current=active;changed.current=onChange
 useEffect(()=>{dirty.current=false},[key])
 useEffect(()=>{const input=(e:Event)=>{if((e.target as Element)?.closest?.('form'))dirty.current=true};document.addEventListener('input',input);const saved=()=>{dirty.current=false};window.addEventListener('findbox-form-saved',saved);const run=async()=>{if(!enabled.current||dirty.current||pending.current||document.hidden||!navigator.onLine||document.querySelector('[role="dialog"]'))return;pending.current=true;try{if(await fn.current())changed.current();if(failed.current)window.dispatchEvent(new CustomEvent('findbox-refresh-status',{detail:'FindBox is connected again. Background refresh resumed.'}));failed.current=false}catch{if(!failed.current)window.dispatchEvent(new CustomEvent('findbox-refresh-status',{detail:'Background refresh paused. Your unsaved work is safe; FindBox will retry.'}));failed.current=true}finally{pending.current=false}};const t=setInterval(()=>void run(),30000);window.addEventListener('focus',run);return()=>{clearInterval(t);document.removeEventListener('input',input);window.removeEventListener('findbox-form-saved',saved);window.removeEventListener('focus',run)}},[])
 return ()=>{dirty.current=false;window.dispatchEvent(new Event('findbox-form-saved'))}
}
