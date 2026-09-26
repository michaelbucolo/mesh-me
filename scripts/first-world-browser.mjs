#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';

// This journey CREATES an account and a post, in a disposable local database.
// Refuse hosted endpoints and credentials even when someone supplies a session.
const origin = process.env.NEXT_PUBLIC_APP_URL;
assert.equal(origin, 'https://127.0.0.1:3443');
assert.equal(process.env.MESH_BROWSER_FIXTURE, 'local-seed');
assert(process.env.DATABASE_URL?.startsWith('file:'));
assert(!process.env.DATABASE_AUTH_TOKEN && !process.env.VERCEL);
const engine = process.env.MESH_BROWSER || 'chromium';
assert(['chromium','webkit'].includes(engine));
const spki = process.env.MESH_BROWSER_CERT_SPKI;
assert(spki && /^[A-Za-z0-9+/]{43}=$/.test(spki));
const playwright = await import('playwright');
const browser = await playwright[engine].launch(engine === 'chromium' ? {args:[`--ignore-certificate-errors-spki-list=${spki}`]} : {});
const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference',ignoreHTTPSErrors:true});
context.setDefaultTimeout(20000);
const page = await context.newPage();
const db = createClient({url:process.env.DATABASE_URL});
const output = path.resolve('browser-results', `${engine}-first-world`);
await fs.mkdir(output,{recursive:true});
const results = [], runtimeErrors = [];
const username = `world_${engine[0]}${Date.now().toString(36)}`;
const password = 'First-world-fixture!42';
let userId;
page.on('pageerror', error => runtimeErrors.push({message:error.message}));
page.on('console', message => {
  if(message.type() !== 'error') return;
  const text = message.text(), source = message.location().url;
  if(/Permissions policy violation/.test(text)) return;
  if(engine === 'webkit' && text === 'Viewport argument key "interactive-widget" not recognized and ignored.') return;
  if(/Failed to load resource/.test(text) && source && !source.startsWith(origin)) return;
  runtimeErrors.push({message:text,source});
});
async function check(label, run) {
  const start = Date.now();
  try {
    const details = await run();
    results.push({label,status:'pass',durationMs:Date.now()-start,...(details?{details}:{})});
    console.log(`[PASS] ${label}`);
  } catch(error) {
    results.push({label,status:'fail',error:error.message,durationMs:Date.now()-start});
    console.error(`[FAIL] ${label}: ${error.message}`);
    throw error;
  } finally {
    await page.screenshot({path:path.join(output,`${label}.png`),animations:'disabled'}).catch(()=>{});
  }
}
async function fits() {
  assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2),'Viewport overflows');
}
try {
  await page.goto(`${origin}/sign-up`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-entry-ready="true"]').waitFor();
  await page.getByTestId('entry-signup-email').fill(`${username}@example.invalid`);
  await page.getByTestId('entry-signup-display-name').fill('First World Fixture');
  await page.getByTestId('entry-signup-username').fill(username);
  await page.getByTestId('entry-signup-password').fill(password);

  await check('signup-network-failure-is-recoverable', async()=>{
    // Fail exactly one real server-action transport BEFORE it reaches the server.
    // No successful response is mocked, and credentials never enter artifacts.
    await page.evaluate(()=>{
      const original=window.fetch;
      let release;
      const gate=new Promise(resolve=>{release=resolve;});
      window.__signupFixture={calls:0,release,restore:()=>{window.fetch=original;}};
      window.fetch=async(input,init)=>{
        const req=input instanceof Request?input:null;
        const url=new URL(req?req.url:String(input),location.href);
        const headers=new Headers(init?.headers||req?.headers);
        if(url.origin===location.origin && (init?.method||req?.method||'GET').toUpperCase()==='POST' && headers.has('next-action')) {
          window.__signupFixture.calls++;
          await gate;
          throw new TypeError('Isolated fixture transport interruption');
        }
        return original.call(window,input,init);
      };
    });
    try {
      await page.getByTestId('entry-signup-form').evaluate(form=>{
        form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      });
      await page.waitForFunction(()=>window.__signupFixture.calls>0);
      assert.equal(await page.evaluate(()=>window.__signupFixture.calls),1,'Concurrent signup escaped the submission lock');
      await page.evaluate(()=>window.__signupFixture.release());
      await page.getByRole('alert').filter({hasText:"Your details are still here"}).waitFor();
      assert.equal(await page.getByTestId('entry-signup-username').inputValue(),username);
      assert.equal(await page.getByTestId('entry-signup-password').inputValue(),password);
      assert(!(await page.getByTestId('entry-create-account-button').isDisabled()));
      const rows=await db.execute({sql:'SELECT id FROM User WHERE username=?',args:[username]});
      assert.equal(rows.rows.length,0);
    } finally {
      await page.evaluate(()=>{window.__signupFixture?.release();window.__signupFixture?.restore();delete window.__signupFixture;});
    }
  });

  await check('real-signup-creates-one-private-account',async()=>{
    await page.getByTestId('entry-create-account-button').click();
    await page.waitForURL(`${origin}/onboarding`,{timeout:45000});
    await page.getByTestId('onboarding-flow').waitFor();
    const rows=await db.execute({sql:'SELECT id,isPublic,readReceipts FROM User WHERE username=?',args:[username]});
    assert.equal(rows.rows.length,1);
    userId=rows.rows[0].id;
    assert.equal(Number(rows.rows[0].isPublic),0);
    assert.equal(Number(rows.rows[0].readReceipts),0);
    const privacy=await db.execute({sql:'SELECT meshVisibility FROM MeshPrivacy WHERE userId=?',args:[userId]});
    assert.equal(privacy.rows[0].meshVisibility,'private');
    await fits();
    return {createdAccounts:1,privateByDefault:true};
  });

  await check('onboarding-opens-a-usable-touch-world',async()=>{
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-skip-finish').click();
    await page.waitForURL(`${origin}/mesh`,{timeout:45000});
    await page.getByRole('button',{name:'Start exploring',exact:true}).click();
    await page.getByRole('button',{name:'Create on your mesh',exact:true}).waitFor();
    const canvas=page.getByTestId('mesh-canvas');
    const bounds=await canvas.boundingBox();
    assert(bounds && bounds.width>300 && bounds.height>300,'The world has no usable canvas');
    await page.getByRole('button',{name:'Recenter',exact:true}).click();
    await fits();
  });

  const text=`My first world ${username}`;
  await check('first-post-becomes-a-real-mesh-node',async()=>{
    await page.getByRole('button',{name:'Create on your mesh',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Create on your mesh',exact:true});
    await dialog.getByRole('textbox',{name:'Post text',exact:true}).fill(text);
    await dialog.getByRole('button',{name:/^Audience:.*Change audience$/}).click();
    await dialog.getByRole('button',{name:/Only me.*Private to your account/}).click();
    await dialog.getByRole('button',{name:'Post',exact:true}).click();
    await dialog.waitFor({state:'hidden',timeout:30000});
    await page.getByTestId('mesh-list').filter({hasText:text}).waitFor({state:'attached'});
    const rows=await db.execute({sql:'SELECT id,visibility FROM Post WHERE authorId=? AND content=?',args:[userId,text]});
    assert.equal(rows.rows.length,1);
    assert.equal(rows.rows[0].visibility,'private');
    await page.getByRole('button',{name:'Explore as a list',exact:true}).click();
    const list=page.getByRole('dialog',{name:'Your mesh as a list',exact:true});
    await list.getByRole('button').filter({hasText:text}).click();
    const lens=page.locator('.presence-world-lens');
    await lens.filter({hasText:text}).waitFor();
    await lens.getByRole('button',{name:'Close',exact:true}).click();
    await lens.waitFor({state:'hidden'});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('mesh-list').filter({hasText:text}).waitFor({state:'attached'});
    return {persistedPosts:1,visibleInMeshAfterReload:true};
  });
} catch(error) {
  if(!results.some(result=>result.status==='fail')) {
    results.push({label:'journey-setup',status:'fail',error:error.message});
  }
} finally {
  await context.close();
  await browser.close();
  db.close();
  const failed=results.filter(result=>result.status==='fail').length;
  const report={engine,passed:results.length-failed,failed,results,runtimeErrors};
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(failed || runtimeErrors.length || results.length!==4) process.exitCode=1;
}
