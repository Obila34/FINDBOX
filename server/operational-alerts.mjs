import {sendMail,mailReady} from './mail.mjs';
import {statfs} from 'node:fs/promises';
export async function operationalAlerts(pool,cfg){
 if(!mailReady(cfg))return;
 const q=(await pool.query("SELECT count(*)::int n FROM outbox WHERE sent_at IS NULL AND attempts>=8")).rows[0];
 const checks=[['mail_queue',Number(q.n)>0,`${q.n} messages have exhausted delivery retries. Review Developer > Mail delivery.`]];
 const backup=(await pool.query("SELECT last_ok FROM runtime_heartbeat WHERE name='offsite_backup'")).rows[0];
 checks.push(['offsite_backup',!backup||Date.now()-new Date(backup.last_ok).getTime()>36*3600000,'No confirmed off-site backup in the last 36 hours. The laptop must be awake, signed in and online.']);
 try{const disk=await statfs('/app');checks.push(['disk_space',disk.bavail*disk.bsize<1024**3,'Available application filesystem space is below 1 GiB.']);}catch{}
 for(const [name,problem,message]of checks){const state=problem?'attention':'healthy';const previous=(await pool.query('SELECT state FROM runtime_alerts WHERE name=$1',[name])).rows[0];if(previous?.state===state)continue;if(problem||previous){await sendMail(cfg,{to:'hello@findbox.africa',subject:`FindBox ${problem?'needs attention':'recovered'}: ${name.replaceAll('_',' ')}`,text:problem?message:`The ${name.replaceAll('_',' ')} check has recovered. Review the operational dashboard for current details.`,key:'monitor-'+name+'-'+Date.now()});}await pool.query('INSERT INTO runtime_alerts(name,state) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET state=EXCLUDED.state,notified_at=now()',[name,state]);}
}
