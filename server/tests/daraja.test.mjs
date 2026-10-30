import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darajaSandbox } from '../daraja.mjs';
const cfg={darajaKey:'key',darajaSecret:'secret',darajaShortcode:'174379',darajaPasskey:'passkey'};
test('Daraja uses only sandbox hosts, caches auth and does not interpret missing status as success',async()=>{
 const requests=[];const responses=[{access_token:'token',expires_in:3600},{ResponseCode:'0',CheckoutRequestID:'checkout-1'},{ResultCode:0,CheckoutRequestID:'checkout-1'},{ResponseCode:'0'},{ResultCode:1032}];
 const p=darajaSandbox(cfg,async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>responses.shift()}});
 assert.equal(await p.start({phone:'254708374149',amount:1,callback:'https://findbox.africa/api/payments/daraja/callback?token=test',reference:'sandbox'}),'checkout-1');
 assert.equal(await p.query('checkout-1'),'confirmed');assert.equal(await p.query('checkout-1'),'pending');assert.equal(await p.query('checkout-1'),'failed');
 assert.ok(requests.every(r=>r.url.startsWith('https://sandbox.safaricom.co.ke/')));
 assert.equal(requests.filter(r=>r.url.includes('/oauth/')).length,1);
 const payload=JSON.parse(requests[1].options.body);assert.equal(payload.Amount,1);assert.equal(payload.PartyB,'174379');assert.equal(payload.Timestamp.length,14);assert.equal(payload.Password,Buffer.from('174379passkey'+payload.Timestamp).toString('base64'));
});
test('Daraja rejects wrong checkout reference and provider failures',async()=>{
 const p=darajaSandbox(cfg,async url=>({ok:true,json:async()=>url.includes('/oauth/')?{access_token:'token',expires_in:3600}:{CheckoutRequestID:'someone-else',ResultCode:0}}));
 await assert.rejects(()=>p.query('expected'),/reference mismatch/);
 const bad=darajaSandbox(cfg,async()=>({ok:false}));await assert.rejects(()=>bad.query('id'),/request failed/);
 await assert.rejects(()=>darajaSandbox({}).query('id'),/not configured/);
});
