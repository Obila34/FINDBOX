import {useEffect,useState,type RefObject} from 'react';
import './brand-film.css';
export function BrandFilm({videoRef}:{videoRef:RefObject<HTMLVideoElement|null>}){
 const [muted,setMuted]=useState(true),[reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change)},[]);
 useEffect(()=>{if(reduced)videoRef.current?.pause()},[reduced,videoRef]);
 return <div className="brand-film"><video ref={videoRef} controls autoPlay={!reduced} muted={muted} loop={muted} playsInline preload="metadata" width={1920} height={1080} poster="/media/films/findbox-explainer-v1-poster.webp" aria-label="Introducing FindBox" onVolumeChange={()=>{if(videoRef.current)setMuted(videoRef.current.muted)}}><source src="/media/films/findbox-explainer-v1.mp4" type="video/mp4"/><track kind="captions" src="/media/films/findbox-explainer-v1.vtt" srcLang="en" label="English" default/>Your browser does not support this video.</video></div>
}
