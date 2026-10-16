import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/app/[lang]/service/page.tsx', 'utf8');
const metadata = readFileSync('src/config/routes-metadata.ts', 'utf8');
const sitemap = readFileSync('src/app/sitemap.ts', 'utf8');
const seo = readFileSync('src/config/seo.ts', 'utf8');
const layout = readFileSync('src/app/[lang]/layout.tsx', 'utf8');
const publicCopy = `${page}\n${metadata}`;

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

check('canonical SERVICE definition is present in RO EN and FA', () => {
  assert.match(page, /Servicii pe care membrii le pot/);
  assert.match(page, /Services Workspace members can/);
  assert.match(page, /خدماتی که اعضای Workspace می‌توانند/);
});

check('SERVICE and mandatory Operations maintenance are separated in every language', () => {
  assert.match(page, /revizia obligatorie a liftului.*Operațiuni & Mentenanță/s);
  assert.match(page, /mandatory elevator servicing.*Operations & Maintenance/s);
  assert.match(page, /نگهداری الزامی آسانسور.*عملیات و نگهداری/s);
});

check('elevator servicing is absent while freight elevator booking is explicit', () => {
  assert.doesNotMatch(publicCopy, /elevator service|service lift|revizii lifturi|سرویس آسانسور/i);
  assert.match(page, /Rezervarea liftului de marfă/);
  assert.match(page, /freight elevator reservation/);
  assert.match(page, /رزرو آسانسور باربری/);
});

check('representative SERVICE examples exist in all three languages', () => {
  for (const phrase of [
    'unit cleaning', 'in-unit repairs', 'car wash', 'dry cleaning', 'catering',
    'daily meals', 'morning bread delivery', 'space or equipment reservations',
    'loading or unloading',
    'curățenia unității', 'reparații în interiorul unității', 'spălătorie auto',
    'curățătorie chimică', 'masa zilei', 'livrarea pâinii dimineața',
    'rezervarea spațiilor ori echipamentelor', 'descărcare și încărcare',
    'نظافت واحد', 'تعمیرات داخل واحد', 'کارواش', 'خشکشویی', 'غذای روزانه',
    'تحویل نان صبحانه', 'رزرو فضا یا تجهیزات', 'تخلیه و بارگیری',
  ]) assert.ok(page.includes(phrase), `missing example: ${phrase}`);
});

check('each Workspace owns its optional catalog in RO EN and FA', () => {
  assert.match(page, /Un Workspace își poate configura propriul catalog/);
  assert.match(page, /A Workspace can configure or choose its own service catalog/);
  assert.match(page, /هر Workspace می‌تواند کاتالوگ خدمات خودش را پیکربندی یا انتخاب کند/);
  assert.match(page, /No individual service is mandatory across all Workspaces/);
  assert.match(page, /Niciun serviciu nu este obligatoriu în toate Workspace-urile/);
  assert.match(page, /هیچ خدمت مشخصی برای همهٔ Workspaceها اجباری نیست/);
});

check('all six commercial paths are described without quote-only positioning', () => {
  for (const phrase of [
    'fixed price', 'usage-based', 'subscription', 'booking', 'quotation',
    'post-assessment',
  ]) assert.ok(page.includes(phrase), `missing commercial path: ${phrase}`);
  assert.match(page, /independent member order, booking, or purchase/);
  assert.match(page, /not the default for every service/);
});

check('included CE experience is a separate handoff rather than a SERVICE model', () => {
  for (const forbidden of [
    'included in an active benefit',
    'poate fi inclus într-un beneficiu activ',
    'در مزایای فعال Workspace گنجانده شود',
  ]) assert.ok(!page.includes(forbidden), `included benefit presented as SERVICE model: ${forbidden}`);
  assert.match(page, /included CE experience remains a separate flow with its own funding, entitlement, redemption, and receipt/);
  assert.match(page, /independent SERVICE Offering only with a new identity, price, terms, explicit consent, and separate receipt/);
  assert.match(page, /experiență inclusă prin CE rămâne un flux separat/);
  assert.match(page, /تجربه‌ای که در CE برای عضو لحاظ شده، مسیر جداگانه‌ای/);
});

check('CE and SERVICE do not share identity or receipt', () => {
  for (const forbidden of [
    /shared (?:CE\/SERVICE )?(?:identity|receipt)/i,
    /reuse (?:the )?CE receipt/i,
    /identitate comună/i,
    /document comun/i,
    /هویت مشترک/,
    /receipt مشترک/,
  ]) assert.doesNotMatch(publicCopy, forbidden);
  assert.match(page, /new identity.*separate receipt/s);
});

check('asset history is limited to technical-condition changes', () => {
  assert.match(page, /place a service in asset history only when it changes that asset’s technical condition/);
  assert.match(page, /include în istoricul unui activ numai serviciile care îi modifică starea tehnică/);
  assert.match(page, /فقط می‌تواند خدمتی را وارد asset history کند که وضعیت فنی همان دارایی را تغییر می‌دهد/);
  assert.match(page, /own order, receipt, and service history/);
});

check('titles and metadata position Member Services and Bookings without Benefits', () => {
  for (const forbidden of [
    'Workspace Member Services, Bookings & Benefits',
    'SERVICE — Member Services, Bookings & Benefits',
    'Servicii, Rezervări & Beneficii',
    'Servicii, Rezervări și Beneficii',
    'خدمات، رزروها و مزایای',
  ]) assert.ok(!publicCopy.includes(forbidden), `forbidden title or metadata phrase: ${forbidden}`);
  assert.match(page, /Workspace Member Services & Bookings/);
  assert.match(metadata, /SERVICE — Member Services & Bookings/);
});

check('copy uses capability wording and rejects active-runtime positioning', () => {
  for (const forbidden of [
    /Each Workspace activates/i,
    /Fiecare Workspace activează/i,
    /هر Workspace .*فعال می‌کند/,
    /capabilities activated for that Workspace/i,
    /funcțiilor activate pentru acel Workspace/i,
    /قابلیت‌هایی که برای آن Workspace فعال شده‌اند/,
  ]) assert.doesNotMatch(publicCopy, forbidden);
  assert.match(page, /A Workspace can configure or choose/);
  assert.match(page, /Un Workspace poate configura sau alege/);
  assert.match(page, /هر Workspace می‌تواند.*پیکربندی یا انتخاب کند/s);
});

check('unsupported runtime, payment and provider claims are absent', () => {
  for (const forbidden of [
    /furnizori acreditați/i,
    /accredited providers/i,
    /ارائه‌دهندگان معتبر/,
    /No payout/i,
    /Nicio plată eliberată/i,
    /تسویه‌حساب مشروط/,
    /post directly to the accounting ledger/i,
    /reflectate automat în jurnalul contabil/i,
    /مستقیماً در دفاتر حسابداری/,
    /Country Pack/i,
  ]) assert.doesNotMatch(publicCopy, forbidden);
});

check('route metadata carries the same optional catalog and maintenance boundary', () => {
  assert.match(metadata, /SERVICE — Member Services & Bookings/);
  assert.match(metadata, /A Workspace can configure its own member service catalog/);
  assert.match(metadata, /kept distinct from mandatory maintenance/);
});

check('sitemap canonical and reciprocal hreflang infrastructure still covers SERVICE', () => {
  assert.match(sitemap, /'\/service'/);
  assert.match(sitemap, /languages = \['ro', 'en', 'fa'\]/);
  assert.match(sitemap, /'x-default'/);
  assert.match(seo, /canonical: `\/\$\{lang\}\$\{normalizedPath\}`/);
  assert.match(seo, /fa: `\/fa\$\{normalizedPath\}`/);
});

check('existing responsive grid navigation and Persian RTL ownership remain intact', () => {
  assert.match(page, /grid-cols-1 md:grid-cols-2 lg:grid-cols-3/);
  assert.match(page, /href={`\/\$\{lang\}\/operations`}/);
  assert.match(layout, /dir={locale\.direction}/);
});

process.stdout.write(`\nSITE SERVICE positioning claims: ${passed}/${passed} PASS\n`);
