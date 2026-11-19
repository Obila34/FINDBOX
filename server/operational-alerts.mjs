import {sendMail,mailReady} from './mail.mjs';
import {statfs,readFile} from 'node:fs/promises';
import {id} from './security.mjs';

// Checked every five minutes by whichever API instance holds the worker lock.
// A change of state sends one email and, for a problem, opens a system issue for the developer.
// The site being completely down is caught from outside the server (.github/workflows/uptime.yml).
const HOUR=3600000;
export async function operationalChecks(pool,cfg={}){
 const out=[];
 const beat=new Map((await pool.query('SELECT name,last_ok FROM runtime_heartbeat')).rows.map(r=>[r.name,new Date(r.last_ok).getTime()]));
 const older=(name,hours)=>!beat.has(name)||Date.now()-beat.get(name)>hours*HOUR;
 const q=(await pool.query("SELECT count(*)::int n FROM outbox WHERE sent_at IS NULL AND attempts>=8")).rows[0];
 out.push(['mail_queue',q.n>0,`${q.n} messages have exhausted delivery retries. Review Developer > Mail delivery.`,'s2']);
 out.push(['local_backup',older('local_backup',26),'No database backup has been written on the server in the last 26 hours. Check the findbox-backup timer.','s1']);
 out.push(['backup_restore_test',older('backup_restore_test',50),'The latest backup has not passed a restore test in the last two days. A backup that cannot be restored is not a backup.','s2']);
 out.push(['offsite_backup',older('offsite_backup',36),'No confirmed off-site backup in the last 36 hours. If the server disk fails, recent data would be lost.','s2']);
 try{const disk=await statfs('/app');const free=disk.bavail*disk.bsize;out.push(['disk_space',free<5*1024**3||disk.bavail/disk.blocks<0.1,`Only ${(free/1024**3).toFixed(1)} GiB of disk space is free.`,'s2']);}catch{}
 try{const kb=Number((/MemAvailable:\s+(\d+)/.exec(await readFile('/proc/meminfo','utf8'))||[])[1]);if(kb)out.push(['memory',kb<400*1024,`Only ${Math.round(kb/1024)} MB of memory is available. The AI model is the first thing to stop if this continues.`,'s2']);}catch{}
 const e=(await pool.query("SELECT count(*)::int n,(SELECT route FROM runtime_errors ORDER BY at DESC LIMIT 1) AS route FROM runtime_errors WHERE at>now()-interval '15 minutes'")).rows[0];
 out.push(['server_errors',e.n>=10,`${e.n} requests failed with a server error in the last 15 minutes. Most recent: ${e.route||'unknown'}.`,'s1']);
 const expected=cfg.apiInstances||1;const live=[...beat].filter(([n,t])=>n.startsWith('api:')&&Date.now()-t<3*60000).length;
 out.push(['api_instances',live<expected,`Only ${live} of ${expected} API instances are running. The site stays up on one, but there is no spare.`,'s2']);
 const c=(await pool.query("SELECT (SELECT count(*)::int FROM pg_stat_activity) used,current_setting('max_connections')::int max")).rows[0];
 out.push(['database_connections',c.used>c.max*0.8,`${c.used} of ${c.max} database connections are in use.`,'s2']);
 return out;
}
export async function operationalAlerts(pool,cfg){
 for(const [name,problem,message,severity]of await operationalChecks(pool,cfg)){
  const state=problem?'attention':'healthy',label=name.replaceAll('_',' ');
  const previous=(await pool.query('SELECT state FROM runtime_alerts WHERE name=$1',[name])).rows[0];
  if(previous?.state===state)continue;
  if((problem||previous)&&mailReady(cfg))await sendMail(cfg,{to:cfg.alertEmail||'hello@findbox.africa',subject:`FindBox ${problem?'needs attention':'recovered'}: ${label}`,text:problem?message:`The ${label} check has recovered. Review the operational dashboard for current details.`,key:'monitor-'+name+'-'+Date.now()}).catch(()=>{});
  if(problem){
   // The developer's issue board is where problems are worked, so monitoring files its own issue once.
   const dev=(await pool.query("SELECT user_id FROM company_access WHERE role='developer' ORDER BY user_id LIMIT 1")).rows[0],title='Monitoring: '+label;
   if(dev&&!(await pool.query("SELECT 1 FROM crm_issues WHERE source='monitor' AND title=$1 AND status NOT IN ('fixed','closed')",[title])).rowCount)
    await pool.query("INSERT INTO crm_issues(id,title,description,steps,severity,area,source,created_by,status,triaged_at) VALUES($1,$2,$3,'',$4,'other','monitor',$5,'triaged',now())",[id(),title,message,severity,dev.user_id]);
  }
  await pool.query('INSERT INTO runtime_alerts(name,state) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET state=EXCLUDED.state,notified_at=now()',[name,state]);
 }
}
