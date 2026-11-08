import nodemailer from 'nodemailer';
import { requireThat } from './security.mjs';
import { renderEmail } from './email-template.mjs';
export const mailReady=c=>!!(c.mailFrom&&((c.smtpHost&&c.smtpUser&&c.smtpPassword)||c.resendKey));
export async function sendMail(cfg,{to,subject,text,attachments=[],key,html}){
 requireThat(mailReady(cfg),503,'Outgoing email is not configured');
 html=html||renderEmail({subject,text,origin:cfg.origin});
 if(cfg.smtpHost){const transport=nodemailer.createTransport({host:cfg.smtpHost,port:cfg.smtpPort||587,secure:(cfg.smtpPort||587)===465,requireTLS:true,tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},auth:{user:cfg.smtpUser,pass:cfg.smtpPassword},connectionTimeout:10000,socketTimeout:15000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
  const r=await transport.sendMail({from:cfg.mailFrom,to,subject,text,html,attachments,messageId:key?`<${key}@findbox.africa>`:undefined});requireThat(r.accepted?.length===1,503,'Email was not accepted');
 }else{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+cfg.resendKey,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify({from:cfg.mailFrom,to,subject,text,html,attachments:attachments.map(a=>({filename:a.filename,content:a.content.toString('base64')}))}),signal:AbortSignal.timeout(15000)});requireThat(r.ok,503,'Email provider did not accept the message');}
}
