import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';

/** Only called by the TLS/file-database guarded release suite. No real accounts. */
export async function runLivingWorldChecks({ context, check, visit, layout, settle, observe, session, origin }) {
  assert.equal(origin, 'https://127.0.0.1:3443');
  assert(process.env.DATABASE_URL?.startsWith('file:') && !process.env.DATABASE_AUTH_TOKEN && !process.env.VERCEL);
  const touch = await context({ viewport: {width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'no-preference' });
  const entry = await touch.newPage();
  observe(entry, 'living-entry');
  await check('touch-living-entry', entry, async () => {
    await visit(entry, '/login');
    assert(await entry.evaluate(() => matchMedia('(pointer: coarse)').matches));
    await entry.locator('[data-entry-atmosphere="live"] canvas').waitFor();
    await entry.getByTestId('entry-identity-input').fill('jordandev');
    await entry.waitForFunction(() => {
      const canvas = document.querySelector('.mesh-gate-canvas');
      return canvas && canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((v,i) => i%4===3 && v>0);
    });
    assert.equal(await entry.locator('.entry-studio-story').count(), 0, 'Marketing column displaced the entry scene');
    await layout(entry);
  });
  await check('touch-motion-preference-preserved', entry, async () => {
    await entry.emulateMedia({reducedMotion:'reduce'});
    await entry.locator('[data-entry-atmosphere="still"]').waitFor();
    assert.equal(await entry.locator('.mesh-gate-canvas').count(), 0);
    assert(await entry.locator('.entry-still-web').isVisible());
    assert.equal(await entry.getByTestId('entry-identity-input').inputValue(), 'jordandev');
  });
  await check('canonical-signup-url', entry, async () => {
    await visit(entry, '/sign-up');
    await entry.getByTestId('entry-signup-form').waitFor();
    await layout(entry);
  });
  await check('canonical-recovery-url', entry, async () => {
    await visit(entry, '/forgot-password');
    await entry.getByRole('heading', {name:'Reset password',exact:true}).waitFor();
    await entry.locator('[data-entry-ready="true"]').waitFor();
    await layout(entry);
  });
  await touch.close();

  const saver = await context({ viewport: {width:390,height:844}, hasTouch:true, reducedMotion:'no-preference' });
  await saver.addInitScript(() => Object.defineProperty(navigator,'connection',{configurable:true,value:Object.assign(new EventTarget(),{saveData:true})}));
  const still = await saver.newPage();
  observe(still, 'data-saver');
  await check('data-saver-keeps-static-world', still, async () => {
    await visit(still, '/login');
    await still.waitForTimeout(1500);
    assert.equal(await still.locator('.mesh-gate-canvas').count(), 0);
    assert(await still.locator('.entry-still-web').isVisible());
    await still.getByTestId('entry-identity-input').fill('jordandev');
    assert(!(await still.getByTestId('entry-continue-button').isDisabled()));
  });
  await saver.close();

  const missingContext = await context({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const missing = await missingContext.newPage();
  const errors = [];
  missing.on('pageerror', e => errors.push(e.message));
  missing.on('console', m => { if(m.type()==='error' && /Content Security Policy|content-security-policy|Refused to|violates|Hydration|hydration/.test(m.text())) errors.push(m.text()); });
  await check('missing-page-has-working-csp-and-recovery', missing, async () => {
    const response = await missing.goto(origin+'/__mesh_missing_page_fixture__', {waitUntil:'domcontentloaded'});
    // Next sends 200 when its loading boundary has already begun streaming.
    // Require the actual not-found body, noindex and valid nonces instead of
    // treating a streamed status as proof that a real page exists.
    assert([200,404].includes(response.status()));
    await missing.getByRole('heading',{name:'A little off the map.'}).waitFor();
    await settle(missing);
    assert(await missing.locator('meta[name="robots"][content*="noindex"]').count()>0);
    assert.equal(errors.length,0,errors.join('\n'));
    const policy = response.headers()['content-security-policy'];
    const nonce = policy?.match(/'nonce-([^']+)'/)?.[1];
    assert(nonce && policy.includes("'strict-dynamic'"), 'Strict nonce policy was weakened');
    // strict-dynamic permits child scripts created by trusted runtime code.
    // Check server-emitted scripts, not later chunks injected after hydration.
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag.match(/\bnonce="([^"]+)"/)?.[1]);
    assert(scripts.length>0 && scripts.every(n=>n===nonce),'Error-page scripts lack their request nonce');
    await missing.getByRole('link',{name:'Home',exact:true}).click();
    await missing.getByTestId('entry-identity-input').waitFor();
  });
  await missingContext.close();

  const retryContext = await context({viewport:{width:390,height:844},reducedMotion:'reduce',storageState:session});
  await retryContext.addInitScript(() => {
    const original = window.fetch;
    let interrupted = false;
    window.fetch = (input, init) => {
      const req = input instanceof Request ? input : null;
      const url = new URL(req ? req.url : String(input), location.href);
      if (!interrupted && url.origin === location.origin && url.pathname === '/api/mesh') {
        interrupted = true;
        return Promise.reject(new TypeError('Isolated first-world request interruption'));
      }
      return original.call(window, input, init);
    };
  });
  const retryPage = await retryContext.newPage();
  observe(retryPage, 'mesh-retry');
  try {
    await check('mesh-retry-fetches-the-world-again', retryPage, async () => {
      await visit(retryPage, '/mesh', true);
      const error = retryPage.getByText("Your mesh couldn't be reached.", {exact:true});
      await error.waitFor();
      const retried = retryPage.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/mesh' && url.searchParams.get('refresh') === '1';
      });
      await retryPage.getByRole('button', {name:'Try again',exact:true}).click();
      assert.equal((await retried).status(),200);
      await error.waitFor({state:'hidden'});
      await retryPage.getByTestId('mesh-list').locator('li').first().waitFor({state:'attached'});
      await layout(retryPage);
    });
  } finally { await retryContext.close(); }

  const signed = await context({viewport:{width:390,height:844},reducedMotion:'reduce',storageState:session});
  const page = await signed.newPage();
  observe(page, 'social-write');
  const db = createClient({url:process.env.DATABASE_URL});
  const text = `Private browser journey ${process.env.MESH_BROWSER} ${Date.now()}`;
  try {
    await check('explicit-mesh-refresh-sees-out-of-worker-writes', page, async () => {
      await visit(page, '/feed', true);
      const read = (fresh) => page.evaluate(async fresh => {
        const response = await fetch(`/api/mesh${fresh ? '?refresh=1' : ''}`, {cache:'no-store'});
        if (!response.ok) throw new Error(`Mesh read failed: ${response.status}`);
        return response.json();
      }, fresh);
      const before = await read(false);
      const original = before.posts?.[0];
      assert(original?.id && typeof original.content === 'string', 'Expected an isolated native seed post');
      const saved = await db.execute({sql:'SELECT content FROM Post WHERE id=? AND authorId=?',args:[original.id,before.user.id]});
      assert.equal(saved.rows.length,1);
      const changed = `Independent-worker fixture ${Date.now()}`;
      try {
        // A direct fixture write simulates a mutation on another worker: the
        // API worker's in-memory cache is deliberately NOT invalidated here.
        const updated = await db.execute({sql:'UPDATE Post SET content=? WHERE id=? AND authorId=?',args:[changed,original.id,before.user.id]});
        assert.equal(updated.rowsAffected,1);
        const after = await read(true);
        assert.equal(after.posts.find(post=>post.id===original.id)?.content,changed);
      } finally {
        await db.execute({sql:'UPDATE Post SET content=? WHERE id=? AND authorId=?',args:[saved.rows[0].content,original.id,before.user.id]});
        await read(true);
      }
      return {freshReadObservedIndependentWrite:true};
    });
    await check('private-post-persists-through-reload', page, async () => {
      await visit(page, '/feed', true);
      await page.locator("#mesh-main-content").getByRole('link',{name:"Create post",exact:true}).click();
      await page.waitForURL(url=>url.pathname==='/feed' && url.searchParams.get('compose')==='true');
      await page.locator('[data-composer-ready="true"]').waitFor();
      await settle(page);
      const body = page.getByRole('textbox',{name:'Post text',exact:true});
      await body.fill(text);
      assert.equal(await body.inputValue(),text);
      await page.getByRole('button',{name:/^Audience:.*Change audience$/}).click();
      await page.getByRole('button',{name:/Only me.*Private to your account/}).click();
      assert.equal(await body.inputValue(),text,'Changing the audience erased the draft');
      const fieldset=page.getByRole('group',{name:'Create a post',exact:true});
      await fieldset.getByRole('button',{name:'Post',exact:true}).click();
      // Mobile closes its composer after publishing. The persisted post,
      // rather than a transient status inside that hidden composer, is proof.
      await page.locator('article').filter({hasText:text}).waitFor({timeout:30000});
      const result = await db.execute({sql:'SELECT id, visibility FROM Post WHERE content = ?',args:[text]});
      assert.equal(result.rows.length,1,'Publish did not create exactly one persisted post');
      assert.equal(result.rows[0].visibility,'private');
      await settle(page);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('article').filter({hasText:text}).waitFor();
      await settle(page);
      const guest = await context({viewport:{width:390,height:844},reducedMotion:'reduce'});
      try {
        const denied=await guest.request.get(`${origin}/feed/${result.rows[0].id}`);
        assert(!((await denied.text()).includes(text)),'Private content leaked to a guest');
      } finally { await guest.close(); }
      return {audience:'private',rows:result.rows.length};
    });
    const recipients = await db.execute("SELECT id FROM User WHERE username = 'alexcreates'");
    assert.equal(recipients.rows.length,1,'Expected the isolated seed recipient');
    const thread = await page.evaluate(async (id) => {
      const res=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberIds:[id]})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Thread creation failed');
      return data.thread.id;
    },recipients.rows[0].id);
    await check('message-send-is-single-and-keeps-next-draft', page, async () => {
      await visit(page, `/messages/${thread}`, true);
      const draft=page.getByRole('textbox',{name:'Message',exact:true});
      const sent=`Send-once fixture ${Date.now()}`;
      const next='This is the next unsent thought.';
      await draft.fill(sent);
      // Hold the real write BEFORE it leaves the browser. No API success is mocked.
      await page.evaluate((thread) => {
        const original=window.fetch;
        let release;
        const gate=new Promise(resolve=>{release=resolve;});
        window.__meshSendFixture={calls:0,release,restore:()=>{window.fetch=original;}};
        window.fetch=async(input,init)=>{
          const req=input instanceof Request?input:null;
          const url=new URL(req?req.url:String(input),location.href);
          if(url.origin===location.origin && url.pathname===`/api/messages/${thread}` && (init?.method||req?.method||'GET').toUpperCase()==='POST'){
            window.__meshSendFixture.calls++;
            await gate;
          }
          return original.call(window,input,init);
        };
      },thread);
      try {
        await page.getByTestId('mechat-composer').evaluate(form=>{
          form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
          form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        });
        await page.waitForFunction(()=>window.__meshSendFixture.calls>0);
        assert.equal(await page.evaluate(()=>window.__meshSendFixture.calls),1,'Concurrent submit sent twice');
        await draft.fill(next);
        await page.evaluate(()=>window.__meshSendFixture.release());
        await page.waitForFunction(()=>!document.querySelector('[aria-label="Send message"]').disabled);
        await settle(page);
        assert.equal(await draft.inputValue(),next,'Server acknowledgement erased the next draft');
        const rows=await db.execute({sql:'SELECT id FROM Message WHERE threadId=? AND content=?',args:[thread,sent]});
        assert.equal(rows.rows.length,1);
        await page.reload({waitUntil:'domcontentloaded'});
        await page.getByTestId('mechat-message-bubble').filter({hasText:sent}).waitFor();
        await page.waitForFunction(value=>document.querySelector('[aria-label="Message"]')?.value===value,next);
        return {persistedMessages:rows.rows.length,nextDraftRetained:true};
      } finally { await page.evaluate(()=>{window.__meshSendFixture?.release();window.__meshSendFixture?.restore();delete window.__meshSendFixture;}); }
    });
  } finally { db.close(); await signed.close(); }
}
