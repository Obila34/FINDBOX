import { renderEmail, codeBlock } from './email-template.mjs';
import { randomInt, createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { transaction } from './db.mjs';
import { passwordMatches, passwordHash, secret, hash, id, requireThat } from './security.mjs';

export const emailReady = cfg => !!(cfg.mailFrom && ((cfg.smtpHost && cfg.smtpUser && cfg.smtpPassword) || cfg.resendKey));
export function companyMailer(cfg) {
  const transport=cfg.smtpHost ? nodemailer.createTransport({host:cfg.smtpHost,port:cfg.smtpPort||465,secure:(cfg.smtpPort||465)===465,requireTLS:true,auth:{user:cfg.smtpUser,pass:cfg.smtpPassword},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true}) : null;
  return async (to,code) => {
    requireThat(emailReady(cfg),503,'Email sign-in delivery is not configured');
    const text=`Your FindBox company sign-in code is ${code}. It expires after 60 seconds and can be used once. Never share it. If you did not request this, ignore this email.`;
    const html=renderEmail({subject:'Your FindBox sign-in code',text:'Use this code to finish signing in to the FindBox company workspace. It expires after 60 seconds and can be used once. Never share it. If you did not request this, ignore this email.',origin:cfg.origin,extraHtml:codeBlock(code)});
    try {
      if(transport){const result=await transport.sendMail({from:cfg.mailFrom,to,subject:'Your FindBox sign-in code',text,html});requireThat(result.accepted?.length===1,503,'Email was not accepted');}
      else {const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+cfg.resendKey,'Content-Type':'application/json'},body:JSON.stringify({from:cfg.mailFrom,to,subject:'Your FindBox sign-in code',text,html}),signal:AbortSignal.timeout(15000)});requireThat(r.ok,503,'Email was not accepted');}
    }catch{throw Object.assign(new Error('Could not send your code. Try again after one minute.'),{statusCode:503});}
  };
}

export async function companyEmailRoutes(app,{pool,cfg,mailer}) {
  const send=mailer||companyMailer(cfg);
  const active=()=>cfg.companyEmailEnabled && emailReady(cfg);
  const digest=(uid,token,code)=>createHmac('sha256',Buffer.from(cfg.encryptionKey||'','base64')).update('company-email:'+uid+':'+token+':'+code).digest('hex');
  const dummy=await passwordHash(secret());
  app.get('/api/company/auth/options',async()=>({emailCodeEnabled:!!active()}));
  async function issue(uid,reply) {
    requireThat(active(),503,'Email sign-in is not enabled');
    const token=secret(),tokenHash=hash(token),code=String(randomInt(1000000)).padStart(6,'0');
    const row=await transaction(pool,async db=>{
      // Serialize all browsers and retries for an account, not just one tab.
      const u=(await db.query('SELECT u.id,u.email,u.verified,u.disabled_at FROM users u JOIN company_access c ON c.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u',[uid])).rows[0];
      requireThat(u?.verified && !u.disabled_at,403,'Company access required');
      const old=(await db.query('SELECT sent_at FROM company_email_challenges WHERE user_id=$1',[uid])).rows[0];
      requireThat(!old || Date.now()-new Date(old.sent_at).getTime()>=60000,429,'Wait one minute before requesting another code');
      const bucket=(await db.query("INSERT INTO throttle_buckets(key,hits,expires_at) VALUES($1,1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET hits=throttle_buckets.hits+1 RETURNING hits",['company-email:'+uid+':'+Math.floor(Date.now()/3600000)])).rows[0];
      requireThat(bucket.hits<=10,429,'Too many code requests. Try again later.');
      await db.query("INSERT INTO company_email_challenges(user_id,token_hash,code_hash,sent_at,expires_at,attempts,delivered) VALUES($1,$2,$3,now(),now()+interval '60 seconds',0,false) ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,code_hash=EXCLUDED.code_hash,sent_at=EXCLUDED.sent_at,expires_at=EXCLUDED.expires_at,attempts=0,delivered=false",[uid,tokenHash,digest(uid,tokenHash,code)]);
      return u;
    });
    reply.setCookie('findbox_company_challenge',token,{path:'/api/company/auth',httpOnly:true,secure:cfg.production,sameSite:'strict',maxAge:600});
    try{await send(row.email,code);}catch{await pool.query("UPDATE company_email_challenges SET code_hash='',delivered=false WHERE user_id=$1 AND token_hash=$2",[uid,tokenHash]);throw Object.assign(new Error('Could not send your code. Try again after one minute.'),{statusCode:503});}
    // Start validity after the provider accepts delivery, not while connecting to SMTP.
    const updated=(await pool.query("UPDATE company_email_challenges SET delivered=true,sent_at=now(),expires_at=now()+interval '60 seconds' WHERE user_id=$1 AND token_hash=$2 RETURNING expires_at,sent_at",[uid,tokenHash])).rows[0];
    requireThat(updated,409,'A newer sign-in request replaced this code');
    return {emailChallenge:true,expiresAt:updated.expires_at,resendAt:updated.expires_at,serverNow:new Date().toISOString()};
  }
  app.post('/api/company/auth/start',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async(req,reply)=>{
    requireThat(active(),503,'Email sign-in is not enabled');
    const d=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(1).max(128)}).strict().parse(req.body);
    const u=(await pool.query('SELECT u.id,u.password_hash,u.verified,u.disabled_at FROM users u JOIN company_access c ON c.user_id=u.id WHERE email=$1',[d.email])).rows[0];
    const valid=await passwordMatches(d.password,u?.password_hash||dummy);
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)',[id(),valid&&u?.verified?u.id:null,valid&&u?.verified?'login_success':'login_failed']);
    requireThat(u?.verified && !u.disabled_at && valid,401,'Email or password is incorrect');
    return issue(u.id,reply);
  });
  app.post('/api/company/auth/resend',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async(req,reply)=>{
    requireThat(active(),503,'Email sign-in is not enabled');
    const token=req.cookies.findbox_company_challenge;
    requireThat(token,401,'Sign in again to request a code');
    const row=(await pool.query("SELECT user_id FROM company_email_challenges WHERE token_hash=$1 AND sent_at>now()-interval '10 minutes'",[hash(token)])).rows[0];
    requireThat(row,401,'Sign in again to request a code');
    return issue(row.user_id,reply);
  });
  app.post('/api/company/auth/verify',{config:{rateLimit:{max:15,timeWindow:'15 minutes'}}},async(req,reply)=>{
    requireThat(active(),503,'Email sign-in is not enabled');
    const {code}=z.object({code:z.string().regex(/^\d{6}$/)}).strict().parse(req.body);
    const token=req.cookies.findbox_company_challenge;requireThat(token,401,'Sign in again');
    const sessionToken=secret();
    const outcome=await transaction(pool,async db=>{
      const row=(await db.query('SELECT c.*,u.verified,u.disabled_at FROM company_email_challenges c JOIN users u ON u.id=c.user_id JOIN company_access a ON a.user_id=u.id WHERE c.token_hash=$1 FOR UPDATE OF c,u',[hash(token)])).rows[0];
      if(!row || row.disabled_at || !row.verified || !row.delivered || row.attempts>=5 || new Date(row.expires_at).getTime()<=Date.now())return false;
      const expected=Buffer.from(row.code_hash,'hex'),actual=Buffer.from(digest(row.user_id,hash(token),code),'hex');
      if(expected.length!==actual.length || !timingSafeEqual(expected,actual)){
        await db.query('UPDATE company_email_challenges SET attempts=attempts+1 WHERE user_id=$1',[row.user_id]);return false;
      }
      // Keep the row/cooldown after consuming a code so a fresh login cannot bypass resend limits.
      await db.query("UPDATE company_email_challenges SET code_hash='',delivered=false WHERE user_id=$1",[row.user_id]);
      await db.query("INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified,company_email_verified,portal,user_agent) VALUES($1,$2,now()+interval '8 hours',false,true,'ops',$3)",[hash(sessionToken),row.user_id,String(req.headers['user-agent']||'').slice(0,300)]);
      await db.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)',[id(),row.user_id,'company_email_verified']);
      return true;
    });
    requireThat(outcome,401,'Code is incorrect, expired or already used. Request a new code after the timer ends.');
    reply.clearCookie('findbox_company_challenge',{path:'/api/company/auth'});
    reply.setCookie('findbox_ops_session',sessionToken,{path:'/',httpOnly:true,secure:cfg.production,sameSite:'lax',maxAge:28800});
    return {ok:true};
  });
}
