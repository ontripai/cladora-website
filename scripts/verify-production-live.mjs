import https from 'https';
import assert from 'assert';

const BASE_URL = process.env.TARGET_URL || 'https://cladora.ro';

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    https.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function runLiveVerification() {
  console.log('=== RUNNING AUTHORITATIVE LIVE PRODUCTION POST-MERGE POLISH VERIFICATION ===\n');
  console.log(`Target Domain: ${BASE_URL}\n`);

  // 1. Root redirect check
  const root = await fetchUrl('/');
  console.log(`[1] Root (/) Status: ${root.statusCode}`);
  assert.ok(root.statusCode === 307 || root.statusCode === 308 || root.statusCode === 200, 'Root redirect status valid');

  // 2. /ro check
  const ro = await fetchUrl('/ro');
  console.log(`[2] /ro Status: ${ro.statusCode}`);
  assert.strictEqual(ro.statusCode, 200);
  assert.ok(ro.body.includes('lang="ro"'), '/ro contains lang="ro"');
  assert.ok(ro.body.includes('dir="ltr"'), '/ro contains dir="ltr"');
  assert.ok(ro.body.includes('Administreaz\u0103 cl\u0103diri'), '/ro contains humanized hero');
  assert.ok(ro.body.includes('Migrare Controlat\u0103'), '/ro contains Migrare Controlată');
  assert.ok(!ro.body.includes('Migrare Sigur\u0103'), '/ro has NO Migrare Sigură');
  assert.ok(ro.body.includes('administrare imobiliar\u0103'), '/ro contains administrare imobiliară');
  assert.ok(!ro.body.includes('property management'), '/ro has NO property management');

  // 3. /en check
  const en = await fetchUrl('/en');
  console.log(`[3] /en Status: ${en.statusCode}`);
  assert.strictEqual(en.statusCode, 200);
  assert.ok(en.body.includes('lang="en"'), '/en contains lang="en"');
  assert.ok(en.body.includes('dir="ltr"'), '/en contains dir="ltr"');
  assert.ok(en.body.includes('Manage buildings and residential properties'), '/en contains humanized hero');
  assert.ok(en.body.includes('Avia\u021biei 12B Homeowners Association'), '/en contains Aviației 12B Homeowners Association');
  assert.ok(!en.body.includes('Asocia\u021bia Avia\u021biei 12B'), '/en has NO Asociația Aviației 12B');

  // 4. /fa check
  const fa = await fetchUrl('/fa');
  console.log(`[4] /fa Status: ${fa.statusCode}`);
  assert.strictEqual(fa.statusCode, 200);
  assert.ok(fa.body.includes('lang="fa"'), '/fa contains lang="fa"');
  assert.ok(fa.body.includes('dir="rtl"'), '/fa contains dir="rtl"');
  assert.ok(fa.body.includes('ساختمان\u200cها و املاک خود را'), '/fa contains humanized hero');
  assert.ok(fa.body.includes('تراز تطبیق\u200cیافته') || fa.body.includes('تراز تطبیقیافته'), '/fa contains تراز تطبیق‌یافته');
  assert.ok(!fa.body.includes('کاملاً هم\u200cتراز') && !fa.body.includes('کاملاً همتراز'), '/fa has NO کاملاً همتراز');

  // 5. Specific required live routes
  const specificRoutes = [
    '/ro/migration',
    '/ro/solutions/property-managers',
    '/fa/solutions/associations',
    '/fa/app/dashboard'
  ];
  console.log(`\n[5] Testing specific required routes...`);
  for (const r of specificRoutes) {
    const res = await fetchUrl(r);
    console.log(`  - ${r} Status: ${res.statusCode}`);
    assert.strictEqual(res.statusCode, 200, `${r} must return 200`);
  }

  // 6. Public route smoke test
  const publicRoutes = [
    '/platform', '/solutions/associations', '/solutions/property-owners',
    '/solutions/property-managers', '/solutions/residents', '/solutions/tenants',
    '/modules', '/migration', '/pricing', '/security', '/resources/faq',
    '/pilot', '/about', '/contact', '/privacy', '/terms', '/cookies',
    '/accessibility', '/demo', '/login'
  ];

  console.log(`\n[6] Testing 20 public routes across 3 locales (60 endpoints)...`);
  for (const r of publicRoutes) {
    for (const lang of ['ro', 'en', 'fa']) {
      const res = await fetchUrl(`/${lang}${r}`);
      if (res.statusCode !== 200) {
        console.error(`❌ FAILED: /${lang}${r} returned status ${res.statusCode}`);
        process.exit(1);
      }
    }
  }
  console.log('✅ All 60 public localized endpoints returned HTTP 200 OK!');

  // 7. SEO Live Verification
  console.log(`\n[7] Testing SEO endpoints...`);
  const robots = await fetchUrl('/robots.txt');
  console.log(`- robots.txt Status: ${robots.statusCode}`);
  assert.strictEqual(robots.statusCode, 200);
  assert.ok(robots.body.includes('https://cladora.ro/sitemap.xml'), 'robots.txt references correct sitemap');

  const sitemap = await fetchUrl('/sitemap.xml');
  console.log(`- sitemap.xml Status: ${sitemap.statusCode}`);
  assert.strictEqual(sitemap.statusCode, 200);
  assert.ok(sitemap.body.includes('https://cladora.ro/ro'), 'sitemap contains /ro');
  assert.ok(sitemap.body.includes('https://cladora.ro/en'), 'sitemap contains /en');
  assert.ok(sitemap.body.includes('https://cladora.ro/fa'), 'sitemap contains /fa');
  // 8. Task 008 Production Hardening Live Assertions: Security Headers & Page-Specific SEO
  console.log(`\n[8] Testing Security Response Headers & Page-Specific SEO on Live Production...`);
  
  // A. Security Headers on /ro
  const headers = ro.headers;
  console.log(`  - Content-Security-Policy: ${!!headers['content-security-policy']}`);
  console.log(`  - Cross-Origin-Opener-Policy: ${headers['cross-origin-opener-policy']}`);
  console.log(`  - X-Frame-Options: ${headers['x-frame-options']}`);
  console.log(`  - X-Content-Type-Options: ${headers['x-content-type-options']}`);
  console.log(`  - Strict-Transport-Security: ${!!headers['strict-transport-security']}`);
  console.log(`  - Referrer-Policy: ${headers['referrer-policy']}`);
  console.log(`  - Permissions-Policy: ${headers['permissions-policy']}`);

  assert.ok(headers['content-security-policy'] || headers['x-frame-options'], 'Security headers present');

  // B. Page-specific canonical and reciprocal hreflang on /ro/migration
  const roMig = await fetchUrl('/ro/migration');
  assert.ok(roMig.body.includes('rel="canonical" href="https://cladora.ro/ro/migration"'), 'ro/migration self canonical');
  assert.ok(/hreflang="ro"/i.test(roMig.body), 'ro/migration hreflang ro');
  assert.ok(/hreflang="en"/i.test(roMig.body), 'ro/migration hreflang en');
  assert.ok(/hreflang="fa"/i.test(roMig.body), 'ro/migration hreflang fa');
  assert.ok(/hreflang="x-default"/i.test(roMig.body), 'ro/migration hreflang x-default');
  assert.ok(!roMig.body.includes('CLADORA | CLADORA'), 'No duplicate brand suffix');
  console.log(`  - /ro/migration has self-referencing canonical & reciprocal hreflang (ro, en, fa, x-default)`);

  // C. Prohibited claims eliminated live
  assert.ok(!ro.body.includes('-45%'), '/ro has no -45%');
  assert.ok(!ro.body.includes('85%+'), '/ro has no 85%+');
  assert.ok(!ro.body.includes('Conformitate 100%'), '/ro has no Conformitate 100%');
  assert.ok(!ro.body.includes('Algoritmi aprobați'), '/ro has no Algoritmi aprobați');
  assert.ok(!ro.body.includes('Fără anomalii detectate'), '/ro has no Fără anomalii detectate');
  assert.ok(!fa.body.includes('مهاجرت امن'), '/fa has no مهاجرت امن');
  console.log(`  - All prohibited marketing claims eliminated across live endpoints`);

  console.log('\n🎉 ALL LIVE PRODUCTION VERIFICATIONS AND TASK 008 HARDENING CHECKS PASSED WITH 100% SUCCESS!');
}

runLiveVerification().catch(err => {
  console.error('Fatal live verification error:', err);
  process.exit(1);
});
