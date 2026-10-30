import { z } from 'zod';
import { hash, id, secret, requireThat } from './security.mjs';

// Sandbox is deliberately isolated from commercial orders and fulfillment.
export const darajaConfigured = cfg => !!(cfg.darajaKey && cfg.darajaSecret && cfg.darajaPasskey && cfg.darajaShortcode);
export function darajaSandbox(cfg, request = fetch) {
  const base = 'https://sandbox.safaricom.co.ke';
  let token, expires = 0;
  async function json(path, options) {
    let r;
    try { r = await request(base + path, { ...options, signal: AbortSignal.timeout(15000) }); }
    catch { throw Object.assign(new Error('Daraja did not respond. Check this attempt before starting another.'), {statusCode:503}); }
    requireThat(r.ok, 503, 'Daraja sandbox request failed. Check credentials and provider availability.');
    const d = await r.json();
    requireThat(d && typeof d === 'object',503,'Invalid Daraja response');
    return d;
  }
  async function authorize() {
    requireThat(darajaConfigured(cfg),503,'Daraja sandbox credentials are not configured');
    if (!token || expires < Date.now()) {
      const d=await json('/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+Buffer.from(cfg.darajaKey+':'+cfg.darajaSecret).toString('base64')}});
      requireThat(typeof d.access_token==='string',503,'Daraja authorization failed');
      token=d.access_token;expires=Date.now()+Math.max(0,Math.min(3600,Number(d.expires_in)||0)-60)*1000;
    }
    return token;
  }
  async function post(path,body) {
    const auth=await authorize();
    return json(path,{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  function password() {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const value=t=>parts.find(p=>p.type===t).value;
    const timestamp=['year','month','day','hour','minute','second'].map(value).join('');
    return {BusinessShortCode:cfg.darajaShortcode,Timestamp:timestamp,Password:Buffer.from(cfg.darajaShortcode+cfg.darajaPasskey+timestamp).toString('base64')};
  }
  return {
    async start({phone,amount,callback,reference}) {
      const d=await post('/mpesa/stkpush/v1/processrequest',{...password(),TransactionType:'CustomerPayBillOnline',Amount:amount,PartyA:phone,PartyB:cfg.darajaShortcode,PhoneNumber:phone,CallBackURL:callback,AccountReference:reference,TransactionDesc:'FindBox sandbox test'});
      requireThat(String(d.ResponseCode)==='0' && typeof d.CheckoutRequestID==='string' && d.CheckoutRequestID.length<=200,503,'Daraja did not accept the sandbox request');
      return d.CheckoutRequestID;
    },
    async query(checkoutId) {
      const d=await post('/mpesa/stkpushquery/v1/query',{...password(),CheckoutRequestID:checkoutId});
      if (d.CheckoutRequestID)requireThat(d.CheckoutRequestID===checkoutId,503,'Daraja reference mismatch');
      // Missing status is pending, never success (Number(undefined) must not be accepted).
      return d.ResultCode===0 || d.ResultCode==='0' ? 'confirmed' : d.ResultCode===undefined ? 'pending' : 'failed';
    }
  };
}

export async function darajaRoutes(app,{pool,cfg,operator,daraja}) {
  const provider=daraja||darajaSandbox(cfg);
  app.get('/api/company/daraja',async req=>{
    await operator(req,['developer']);
    return {mode:'sandbox',configured:darajaConfigured(cfg),attempts:(await pool.query('SELECT id,amount_kes,phone_suffix,status,created_at FROM daraja_sandbox_attempts ORDER BY created_at DESC LIMIT 30')).rows};
  });
  app.post('/api/company/daraja/start',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async req=>{
    const u=await operator(req,['developer']);
    requireThat(Date.now()-new Date(u.session_created_at).getTime()<600000,403,'Sign in again before initiating a payment test');
    requireThat(darajaConfigured(cfg),503,'Daraja sandbox credentials are not configured');
    const d=z.object({phone:z.string().regex(/^254[17]\d{8}$/),amount:z.number().int().min(1).max(1000),requestKey:z.string().uuid()}).strict().parse(req.body);
    const attemptId=id(), nonce=secret();
    const inserted=await pool.query("INSERT INTO daraja_sandbox_attempts(id,user_id,request_key,callback_hash,amount_kes,phone_suffix,status) VALUES($1,$2,$3,$4,$5,$6,'starting') ON CONFLICT(user_id,request_key) DO NOTHING RETURNING id",[attemptId,u.id,d.requestKey,hash(nonce),d.amount,d.phone.slice(-4)]);
    if(!inserted.rowCount){const old=(await pool.query('SELECT id,status FROM daraja_sandbox_attempts WHERE user_id=$1 AND request_key=$2',[u.id,d.requestKey])).rows[0];return old;}
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)',[id(),u.id,'daraja_sandbox_started']);
    try {
      const checkout=await provider.start({phone:d.phone,amount:d.amount,callback:cfg.origin+'/api/payments/daraja/callback?token='+nonce,reference:attemptId.replaceAll('-','').slice(0,12)});
      await pool.query("UPDATE daraja_sandbox_attempts SET checkout_id=$1,status='pending' WHERE id=$2",[checkout,attemptId]);
      return {id:attemptId,status:'pending'};
    }catch(e){await pool.query("UPDATE daraja_sandbox_attempts SET status='uncertain' WHERE id=$1",[attemptId]);throw e;}
  });
  async function reconcile(attempt) {
    requireThat(attempt.checkout_id,409,'No provider reference available. Do not repeat this attempt automatically.');
    const status=await provider.query(attempt.checkout_id);
    await pool.query("UPDATE daraja_sandbox_attempts SET status=$1 WHERE id=$2 AND status<>'confirmed'",[status,attempt.id]);
    return {id:attempt.id,status:attempt.status==='confirmed'?'confirmed':status};
  }
  app.post('/api/company/daraja/query',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async req=>{
    await operator(req,['developer']);
    const {attemptId}=z.object({attemptId:z.string().uuid()}).parse(req.body);
    const attempt=(await pool.query('SELECT id,status,checkout_id FROM daraja_sandbox_attempts WHERE id=$1',[attemptId])).rows[0];
    requireThat(attempt,404,'Sandbox attempt not found');
    return reconcile(attempt);
  });
  app.post('/api/payments/daraja/callback',{config:{rateLimit:{max:30,timeWindow:'1 minute'}}},async req=>{
    const token=typeof req.query.token==='string'?req.query.token:'';
    requireThat(token.length>=20 && token.length<=200,403,'Callback verification failed');
    const checkout=req.body?.Body?.stkCallback?.CheckoutRequestID;
    requireThat(typeof checkout==='string' && checkout.length<=200,400,'Invalid callback');
    const attempt=(await pool.query('SELECT id,status,checkout_id FROM daraja_sandbox_attempts WHERE callback_hash=$1 AND checkout_id=$2',[hash(token),checkout])).rows[0];
    requireThat(attempt,403,'Callback verification failed');
    // Callback values never mark commercial orders paid. Only query the stored reference.
    if(attempt.status!=='confirmed')await reconcile(attempt);
    return {ResultCode:0,ResultDesc:'Accepted'};
  });
}
