// Controlled Chromium model: real compiled components/Provider/CSS; synthetic transport.
// Reuses frozen PROCEDURE host, adding the actual API's actor response-header projection.
// --assets must be built from this source, with its identity recorded externally.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const loadBrowser = createRequire(import.meta.url);
const { chromium } = loadBrowser(process.env.CLADORA_PLAYWRIGHT_MODULE || 'playwright');
const option = key => process.argv[process.argv.indexOf(key) + 1];
if (!process.argv.includes('--assets') || !process.argv.includes('--out')) throw Error('REQUIRE_LOCAL_ASSETS_AND_OUTPUT');
const assets = path.resolve(option('--assets')), output = path.resolve(option('--out'));
fs.mkdirSync(output, { recursive: true });
const origin = 'https://cladora-listing-recovery.invalid';
const labels = {
  ro: { title: 'Anunțuri pentru proprietăți', workspace: 'Alege spațiul de lucru', edit: 'Salvează perioada', reason: 'Motivul modificării (minimum 8 caractere)', retry: 'Reîncearcă aceeași cerere', refresh: 'Verifică din nou' },
  en: { title: 'Property listings', workspace: 'Choose a workspace', edit: 'Save availability', reason: 'Reason for change (at least 8 characters)', retry: 'Retry the same request', refresh: 'Check again' },
  fa: { title: 'آگهی‌های ملک', workspace: 'انتخاب فضای کاری', edit: 'ذخیره بازه', reason: 'دلیل تغییر (حداقل ۸ نویسه)', retry: 'تکرار همان درخواست', refresh: 'بررسی دوباره' },
};
const results = [], blocked = [], errors = [];
const only = process.argv.includes('--only') ? option('--only') : '';
const locales = process.argv.includes('--locales') ? option('--locales').split(',') : ['ro', 'en', 'fa'];
const save = () => fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ task: 'AIRPROP-LISTING-PENDING-RECOVERY-07', evidence: 'CONTROLLED_CHROMIUM_NOT_NATIVE_AUTH_C03_DB', results, blocked, errors }, null, 2));
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--disable-background-networking'] });
  try {
    for (const [lang, t] of Object.entries(labels)) {
      if (!locales.includes(lang)) continue;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === origin && request.method() === 'GET' && ['/', '/bundle.js', '/style.css'].includes(url.pathname)) {
          const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
          return route.fulfill({ body: fs.readFileSync(path.join(assets, name)), contentType: name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
        }
        blocked.push({ url: url.origin + url.pathname, method: request.method() }); return route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(7000); page.on('pageerror', e => errors.push(e.message));
      const region = () => page.getByRole('region', { name: t.title, exact: true });
      const select = () => region().getByRole('combobox');
      const button = key => region().getByRole('button', { name: t[key], exact: true });
      const snapshot = () => page.evaluate(() => window.listing.snapshot());
      const posts = async () => (await snapshot()).requests.filter(r => r.method === 'POST');
      async function settled() { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
      async function enter({ reload = false, higher = false } = {}) {
        if (reload) await page.reload(); else { await page.goto(origin + '/?lang=' + lang); await page.evaluate(() => sessionStorage.clear()); }
        await page.getByRole('combobox', { name: t.workspace, exact: true }).waitFor();
        if (higher) await page.evaluate(() => window.listing.configure({ drift: 'listing_version' }));
        await page.getByRole('combobox', { name: t.workspace, exact: true }).selectOption({ index: 1 });
        await select().waitFor(); await settled(); if (!await select().isDisabled()) await select().selectOption({ index: 1 }); await settled();
      }
      async function lose() {
        await region().getByRole('textbox', { name: t.reason, exact: true }).fill('SYNTHETIC recovery reason');
        await page.evaluate(() => window.listing.plan({ kind: 'listing', method: 'POST', throw: true }));
        await button('edit').click(); await button('retry').waitFor(); await settled();
        const p = (await posts())[0], storage = (await snapshot()).storage;
        const key = Object.keys(storage).find(k => k.startsWith('cladora.airprop-listing.v1:'));
        return { wire: p.wire, key, raw: storage[key] };
      }
      async function check(name, fn) {
        if (only && !name.includes(only)) return;
        const row = { lang, name, status: 'PASS' };
        try { await fn(row); } catch (error) { row.status = 'FAIL'; row.error = error.message; }
        row.protocol = await snapshot(); results.push(row); save(); console.log(lang, name, row.status);
      }
      await check('lost-reply-reload-higher-GET-explicit-same-wire', async row => {
        await enter(); const original = await lose(); assert.ok(original.wire && original.raw);
        const record = JSON.parse(original.raw); assert.equal(record.recovery_version, 2); assert.equal(record.endpoint, '/api/customer/v2/airprop/listings');
        await enter({ reload: true, higher: true }); await button('retry').waitFor();
        assert.equal((await posts()).length, 0); assert.equal((await snapshot()).storage[original.key], original.raw);
        await button('refresh').click(); await settled(); assert.equal((await snapshot()).storage[original.key], original.raw);
        await button('retry').click(); await settled();
        assert.equal((await posts()).length, 1); assert.equal((await posts())[0].wire, original.wire);
        assert.equal((await snapshot()).storage[original.key], undefined); row.original = original;
      });
      await check('missing-custody-does-not-recreate-and-post', async () => {
        await enter(); const original = await lose(); await page.evaluate(key => sessionStorage.removeItem(key), original.key);
        await button('retry').click(); await settled(); assert.equal((await posts()).length, 1);
        assert.equal((await snapshot()).storage[original.key], undefined);
      });
      await check('foreign-actor-and-legacy-record-remain-unconsumed', async () => {
        await enter(); const original = await lose();
        const foreign = JSON.parse(original.raw); foreign.owner.actor_id = '30500000-0000-4000-8000-000000000901';
        const raw = JSON.stringify(foreign); await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key: original.key, raw });
        await enter({ reload: true }); assert.equal((await posts()).length, 0); assert.equal(await button('retry').count(), 0); assert.equal(await select().isDisabled(), true);
        assert.equal((await snapshot()).storage[original.key], raw);
        const legacy = JSON.stringify({ recovery_version: 1, state: 'uncertain', wire: original.wire });
        await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key: original.key, raw: legacy });
        await enter({ reload: true }); assert.equal((await snapshot()).storage[original.key], legacy); assert.equal(await button('retry').count(), 0); assert.equal((await posts()).length, 0);
      });
      await check('quota-corruption-preserve-independent-read', async () => {
        await enter(); await region().getByRole('textbox', { name: t.reason, exact: true }).fill('SYNTHETIC quota reason');
        await page.evaluate(() => { window.originalStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if(k.startsWith('cladora.airprop-listing.v1:')) throw new DOMException('Quota', 'QuotaExceededError'); return window.originalStorageSet.call(this,k,v); }; });
        await button('edit').click(); await settled(); assert.equal((await posts()).length, 0); assert.equal(await region().locator('h3').count(), 1);
        await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSet; const s=window.listing.scopes.A; sessionStorage.setItem(`cladora.airprop-listing.v1:${s.membership}:${s.context}:${s.workspace}`, '{corrupt'); });
        await enter({ reload: true }); assert.equal(await select().isDisabled(), true); assert.equal(await select().isVisible(), true); assert.equal((await posts()).length, 0);
      });
      await check('late-old-context-receipt-cannot-clear-current-draft-or-journal', async () => {
        await enter(); await region().getByRole('textbox', { name: t.reason, exact: true }).fill('SYNTHETIC A pending');
        await page.evaluate(() => window.listing.plan({ kind: 'listing', method: 'POST', hold: 'json' })); await button('edit').click();
        await page.waitForFunction(() => window.listing.snapshot().pending.some(k => k.endsWith(':json')));
        const before = await snapshot(), held = before.pending.find(k => k.endsWith(':json')), key = Object.keys(before.storage).find(k => k.startsWith('cladora.airprop-listing.v1:'));
        assert.equal(await select().isDisabled(), true);
        await page.evaluate(() => window.listing.selectContext('B')); await settled();
        await page.evaluate(() => window.listing.confirmContext());
        await page.waitForFunction(() => window.listing.context.active?.context_id === window.listing.scopes.B.context);
        await page.getByRole('combobox', { name: t.workspace, exact: true }).selectOption({ index: 1 });
        await select().waitFor(); await select().selectOption({ index: 1 });
        await region().getByRole('textbox', { name: t.reason, exact: true }).fill('SYNTHETIC B retained');
        await page.evaluate(key => window.listing.release(key), held); await settled();
        assert.equal(await region().getByRole('textbox', { name: t.reason, exact: true }).inputValue(), 'SYNTHETIC B retained');
        assert.equal((await snapshot()).storage[key], before.storage[key]); assert.equal((await posts()).length, 1);
      });
      await page.screenshot({ path: path.join(output, lang + '-targeted.png') });
      await context.close();
    }
    assert.equal(blocked.length, 0); assert.equal(errors.length, 0);
    if (results.some(r => r.status !== 'PASS')) process.exitCode = 1;
  } finally { await browser.close(); save(); }
})();
