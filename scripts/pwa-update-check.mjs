import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
let revision=1;
const mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const target=pathname==='/'||!extname(pathname)?'/index.html':pathname;let body=await readFile(resolve('dist','.'+target));if(target==='/sw.js')body=Buffer.concat([body,Buffer.from('\n// update test '+revision)]);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(5178,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5178/shop/catalog');await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:25000});
 let before=await page.evaluate(()=>performance.timeOrigin);revision++;await page.evaluate(async()=>{await(await navigator.serviceWorker.ready).update()});
 await page.waitForFunction(t=>performance.timeOrigin!==t,before,{timeout:25000});assert.equal(await page.locator('.fb-pwa-status').count(),0);
 await page.goto('http://127.0.0.1:5178/app/sign-in');await page.locator('input[type=email]').fill('unfinished@example.com');before=await page.evaluate(()=>performance.timeOrigin);revision++;await page.evaluate(async()=>{await(await navigator.serviceWorker.ready).update()});
 await page.waitForTimeout(1800);assert.equal(await page.locator('.fb-pwa-status').count(),0);assert.equal(await page.locator('input[type=email]').inputValue(),'unfinished@example.com');assert.equal(await page.evaluate(()=>performance.timeOrigin),before);
 console.log('Silent automatic PWA refresh and protection of unsaved form input passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
