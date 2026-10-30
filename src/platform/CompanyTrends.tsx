import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3, Table2, Users } from 'lucide-react'

export function CompanyTrends({daily,generatedAt}:{daily:{day:string;count:number}[];generatedAt:string}) {
 const [range,setRange]=useState(30),[view,setView]=useState('chart')
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(generatedAt))
 const end=Date.parse(today+'T00:00:00Z')
 const rows=Array.from({length:range},(_,i)=>{const day=new Date(end-(range-1-i)*86400000).toISOString().slice(0,10);return {day,count:daily.find(r=>r.day===day)?.count||0}})
 return <section className="co-panel co-trends"><div className="co-chart-header"><div><p className="co-eyebrow">COMMUNITY GROWTH</p><h2><Users size={18}/> Registration activity</h2><p>{rows.reduce((n,r)=>n+r.count,0)} accounts in the last {range} calendar days · Nairobi time</p></div><div className="co-chart-controls"><div role="group" aria-label="Registration date range">{[7,30].map(n=><button key={n} aria-pressed={range===n} onClick={()=>setRange(n)}>{n} days</button>)}</div><div role="group" aria-label="Registration display"><button aria-label="Show registration chart" aria-pressed={view==='chart'} onClick={()=>setView('chart')}><BarChart3 size={17}/></button><button aria-label="Show registration table" aria-pressed={view==='table'} onClick={()=>setView('table')}><Table2 size={17}/></button></div></div></div>
 {view==='chart'?<div className="co-chart" role="img" aria-label={`Daily registrations: ${rows.map(r=>r.day+': '+r.count).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{top:20,right:12,left:-24,bottom:0}}><CartesianGrid stroke="#dce8e1" vertical={false}/><XAxis dataKey="day" tickFormatter={d=>d.slice(5)} tick={{fontSize:11}} tickLine={false} axisLine={false} minTickGap={25}/><YAxis allowDecimals={false} tick={{fontSize:11}} tickLine={false} axisLine={false}/><Tooltip cursor={{fill:'#e5f4ed'}} contentStyle={{borderRadius:12,border:'1px solid #dce8e1'}}/><Bar dataKey="count" name="New accounts" fill="#13868e" radius={[5,5,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>:<div className="co-trend-table"><table><thead><tr><th>Date</th><th>Registrations</th></tr></thead><tbody>{rows.map(r=><tr key={r.day}><td>{r.day}</td><td>{r.count}</td></tr>)}</tbody></table></div>}
 </section>
}
