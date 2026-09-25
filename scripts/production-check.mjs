import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
mkdirSync('shots/production', { recursive: true })
const browser = await chromium.launch({channel:'chrome'})
const errors=[]; const failures=[]; let checked=0
const roles=[['Student','Zuri','/app/home'],['Parent','Amina','/app/home'],['Teacher','Daniel','/manage'],['School admin','Grace','/manage/dashboard']]
for(const width of [390,1440]) {
 const page=await browser.newPage({viewport:{width,height:920},reducedMotion:'reduce',serviceWorkers:'block'})
 page.on('pageerror',e=>errors.push(e.message))
 async function inspect(path,name) {
  await page.goto('http://127.0.0.1:4175'+path,{waitUntil:'networkidle'})
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().catch(()=>{})})))
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),demo:/\bdemo\b|\bprototype\b|Quest Board/i.test(document.body.innerText)}))
  if(state.overflow||state.broken.length||state.demo)failures.push({width,path,...state})
  checked++; if(name)await page.screenshot({path:'shots/production/'+name+'-'+width+'.png',fullPage:true})
 }
 await inspect('/','landing'); await inspect('/app/sign-in','signin');await inspect('/t/FB-7K2M-Q4','tag')
 for(const [role,name,home] of roles){
  await page.goto('http://127.0.0.1:4175/app/sign-in');await page.getByRole('button',{name:role,exact:true}).click();await page.getByRole('button',{name:new RegExp(name)}).click();await page.waitForURL('**'+home)
  await inspect(home,role.toLowerCase().replace(' ','-'))
  const paths=role==='Student'?['/app/items','/app/items/item-zuri-bottle','/app/register','/app/streaks','/app/found','/app/inbox','/app/account']:role==='Parent'?['/app/items','/app/report','/app/gallery','/app/account']:role==='Teacher'?['/manage/scan','/manage/log','/manage/gallery','/manage/cases/case-cardigan','/manage/activity']:['/manage/settings']
  for(const path of paths)await inspect(path,path.endsWith('streaks')?'streaks':undefined)
  if(role==='Student'){
   await page.goto('http://127.0.0.1:4175/app/streaks');await page.getByRole('button',{name:'I checked my belongings today'}).click();assert.equal(await page.getByRole('button',{name:'You showed up today'}).isDisabled(),true)
   await page.reload();assert.equal(await page.getByRole('button',{name:'You showed up today'}).isDisabled(),true)
   await page.getByRole('button',{name:/Noah ·/}).click();await page.reload();assert.equal(await page.getByRole('button',{name:/Noah ·/}).getAttribute('aria-pressed'),'true')
   await page.screenshot({path:'shots/production/streak-checked-'+width+'.png',fullPage:true})
  }
 }
 await page.close()
}
await browser.close();const result={checked,failures,errors:[...new Set(errors)]};writeFileSync('shots/production/checks.json',JSON.stringify(result,null,2));console.log(result);assert.equal(failures.length,0);assert.equal(errors.length,0)
