import { randomInt, timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { companyMailer } from './company-email.mjs';
const cfg={mailFrom:process.env.MAIL_FROM,smtpHost:process.env.SMTP_HOST,smtpPort:Number(process.env.SMTP_PORT||465),smtpUser:process.env.SMTP_USER,smtpPassword:Buffer.from(process.env.SMTP_PASSWORD_B64||'','base64').toString('utf8')};
const send=companyMailer(cfg),input=createInterface({input:process.stdin,output:process.stdout});
try {
 for(const address of ['admin@findbox.africa','developer@findbox.africa']){
  const code=String(randomInt(1000000)).padStart(6,'0');
  await send(address,code);
  const expires=Date.now()+60000;
  console.log('Test sent to '+address+'. Open that inbox now.');
  const answer=(await input.question('Enter its six-digit code within 60 seconds: ')).trim();
  if(Date.now()>=expires || !/^\d{6}$/.test(answer) || !timingSafeEqual(Buffer.from(answer),Buffer.from(code)))throw new Error('Delivery verification failed or timed out; email sign-in remains disabled.');
 }
 console.log('Both inbox deliveries verified.');
} catch(e){console.error(e.message);process.exitCode=1;}finally{input.close();}
