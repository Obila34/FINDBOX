import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('shots/navigation',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173/app/sign-in');await page.getByRole('button',{name:'Student',exact:true}).click();await page.getByRole('button',{name:/Zuri Wekesa/}).click();await page.waitForURL('**/app/home');
const dock=page.getByRole('navigation',{name:'Mobile primary',exact:true});await dock.getByRole('link',{name:'Home',exact:true}).waitFor();assert.equal(await dock.getByRole('link').count(),4);assert.deepEqual(await dock.locator('small').allTextContents(),['Home','Items','Inbox','Shop']);
await page.getByRole('button',{name:'Open profile menu'}).click();await page.getByRole('dialog').waitFor();await page.screenshot({path:'shots/navigation/profile-menu.png',fullPage:true});await page.getByRole('link',{name:/Profile & settings/}).click();await page.waitForURL('**/app/account');await page.locator('.fb-profile-streak').waitFor();assert.equal(await page.getByRole('dialog').count(),0);await page.screenshot({path:'shots/navigation/profile.png',fullPage:true});
await dock.getByRole('link',{name:'Shop',exact:true}).click();await page.getByRole('heading',{name:'Shop labels',exact:true}).waitFor();assert.equal(await page.locator('.fp-shop-hero').count(),0);assert.equal(await page.locator('.fb-footer-v3').count(),0);await dock.getByRole('link',{name:'Home',exact:true}).waitFor();assert.equal(await dock.getByRole('link').count(),4);await page.screenshot({path:'shots/navigation/shop.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.getByRole('button',{name:'Open profile menu'}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);console.log('Four-tab navigation, profile toggle, embedded streak and quiet shop passed.');
}finally{await browser.close()}
