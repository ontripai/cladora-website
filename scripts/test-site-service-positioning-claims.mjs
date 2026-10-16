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
  assert.match(page, /Servicii și beneficii pe care membrii le pot/);
  assert.match(page, /Services and benefits Workspace members can/);
  assert.match(page, /خدمات و مزایایی که اعضای Workspace می‌توانند/);
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
  assert.match(page, /Fiecare Workspace activează propriul catalog/);
  assert.match(page, /Each Workspace activates its own catalog/);
  assert.match(page, /هر Workspace کاتالوگ خودش را فعال می‌کند/);
  assert.match(page, /No individual service is mandatory across all Workspaces/);
  assert.match(page, /Niciun serviciu nu este obligatoriu în toate Workspace-urile/);
  assert.match(page, /هیچ خدمت مشخصی برای همهٔ Workspaceها اجباری نیست/);
});

check('all six commercial paths are described without quote-only positioning', () => {
  for (const phrase of [
    'fixed pricing', 'included in an active benefit', 'subscription', 'booking',
    'usage-based', 'quotation',
  ]) assert.ok(page.includes(phrase), `missing commercial path: ${phrase}`);
  assert.match(page, /not the default for every service/);
});

check('asset history is limited to technical-condition changes', () => {
  assert.match(page, /Only a service that changes an asset’s technical condition/);
  assert.match(page, /Numai serviciile care modifică starea tehnică a unui activ/);
  assert.match(page, /فقط خدمتی که وضعیت فنی یک asset را تغییر می‌دهد/);
  assert.match(page, /own order, receipt, and service history/);
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
  assert.match(metadata, /SERVICE — Member Services, Bookings & Benefits/);
  assert.match(metadata, /Each Workspace activates its own service and benefit catalog/);
  assert.match(metadata, /records kept distinct from mandatory maintenance/);
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
