import http from 'http';
import assert from 'assert';

const PORT = process.env.PORT || 3000;

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log(`=== VERIFYING HUMANIZED COPY ON LOCAL SERVER (PORT ${PORT}) ===\n`);

  let allPassed = true;

  // 1. /ro
  const ro = await fetchPage('/ro');
  console.log(`[RO] /ro Status: ${ro.statusCode}`);
  const roHero = ro.body.includes('Administreaz\u0103 cl\u0103diri');
  const roTruth = ro.body.includes('Vezi de unde vine fiecare sum\u0103');
  const roCta = ro.body.includes('Solicit\u0103 acces \u00een pilot');
  console.log(`  - Contains "Administrează clădiri": ${roHero}`);
  console.log(`  - Contains "Vezi de unde vine fiecare sumă": ${roTruth}`);
  console.log(`  - Contains "Solicită acces în pilot": ${roCta}`);
  if (ro.statusCode !== 200 || !roHero || !roTruth || !roCta) allPassed = false;

  // 2. /en
  const en = await fetchPage('/en');
  console.log(`\n[EN] /en Status: ${en.statusCode}`);
  const enHero = en.body.includes('Manage buildings and residential properties');
  const enTruth = en.body.includes('See Where Every Charge Comes From');
  const enCta = en.body.includes('Apply for Pilot Access');
  console.log(`  - Contains "Manage buildings and residential properties": ${enHero}`);
  console.log(`  - Contains "See Where Every Charge Comes From": ${enTruth}`);
  console.log(`  - Contains "Apply for Pilot Access": ${enCta}`);
  if (en.statusCode !== 200 || !enHero || !enTruth || !enCta) allPassed = false;

  // 3. /fa
  const fa = await fetchPage('/fa');
  console.log(`\n[FA] /fa Status: ${fa.statusCode}`);
  const faHero = fa.body.includes('ساختمان‌ها و املاک خود را');
  const faTruth = fa.body.includes('منشأ هر مبلغ را روشن ببینید');
  const faCta = fa.body.includes('درخواست حضور در پایلوت');
  console.log(`  - Contains "ساختمان‌ها و املاک خود را": ${faHero}`);
  console.log(`  - Contains "منشأ هر مبلغ را روشن ببینید": ${faTruth}`);
  console.log(`  - Contains "درخواست حضور در پایلوت": ${faCta}`);
  if (fa.statusCode !== 200 || !faHero || !faTruth || !faCta) allPassed = false;

  // 4. /fa/solutions/associations
  const faAssoc = await fetchPage('/fa/solutions/associations');
  console.log(`\n[FA] /fa/solutions/associations Status: ${faAssoc.statusCode}`);
  const faAssoc1 = faAssoc.body.includes('مدیریت شفاف، حسابداری دقیق');
  const faAssoc2 = faAssoc.body.includes('ورود به نسخه نمایشی مدیر ساختمان');
  console.log(`  - Contains "مدیریت شفاف، حسابداری دقیق": ${faAssoc1}`);
  console.log(`  - Contains "ورود به نسخه نمایشی مدیر ساختمان": ${faAssoc2}`);
  if (faAssoc.statusCode !== 200 || !faAssoc1 || !faAssoc2) allPassed = false;

  // 5. /fa/app/accounting/month-close
  const faClose = await fetchPage('/fa/app/accounting/month-close');
  console.log(`\n[FA] /fa/app/accounting/month-close Status: ${faClose.statusCode}`);
  const faClose1 = faClose.body.includes('بستن دوره حسابداری');
  console.log(`  - Contains "بستن دوره حسابداری": ${faClose1}`);
  if (faClose.statusCode !== 200 || !faClose1) allPassed = false;

  // 6. Task 007 Hotfix Assertions
  // RO: Migrare Controlată & administrare imobiliară (no Migrare Sigură, no property management)
  const roMigrare = ro.body.includes('Migrare Controlat\u0103');
  const roNoSigura = !ro.body.includes('Migrare Sigur\u0103');
  const roAdmin = ro.body.includes('administrare imobiliar\u0103');
  const roNoPropMgmt = !ro.body.includes('property management');
  console.log(`\n[RO Polish] Contains "Migrare Controlată": ${roMigrare}, No "Migrare Sigură": ${roNoSigura}`);
  console.log(`[RO Polish] Contains "administrare imobiliară": ${roAdmin}, No "property management": ${roNoPropMgmt}`);
  if (!roMigrare || !roNoSigura || !roAdmin || !roNoPropMgmt) allPassed = false;

  // EN: Aviației 12B Homeowners Association (no Asociația Aviației 12B)
  const enAssoc = en.body.includes('Avia\u021biei 12B Homeowners Association');
  const enNoAsoc = !en.body.includes('Asocia\u021bia Avia\u021biei 12B');
  console.log(`\n[EN Polish] Contains "Aviației 12B Homeowners Association": ${enAssoc}, No "Asociația Aviației 12B": ${enNoAsoc}`);
  if (!enAssoc || !enNoAsoc) allPassed = false;

  // FA: تراز تطبیق‌یافته (no تراز کاملاً همتراز / کاملاً همتراز)
  const faBalance = fa.body.includes('تراز تطبیق\u200cیافته') || fa.body.includes('تراز تطبیقیافته');
  const faNoKamelan = !fa.body.includes('کاملاً هم‌تراز') && !fa.body.includes('کاملاً همتراز');
  console.log(`\n[FA Polish] Contains "تراز تطبیق‌یافته": ${faBalance}, No "کاملاً همتراز": ${faNoKamelan}`);
  if (!faBalance || !faNoKamelan) allPassed = false;

  // 7. Task 008 Production Hardening Assertions
  // Canonical & Reciprocal hreflang on /ro/migration
  const roMigration = await fetchPage('/ro/migration');
  console.log(`\n[RO Migration] Status: ${roMigration.statusCode}`);
  const hasSelfCanonical = roMigration.body.includes('rel="canonical" href="https://cladora.ro/ro/migration"');
  const hasHreflangRo = /hreflang="ro"/i.test(roMigration.body);
  const hasHreflangEn = /hreflang="en"/i.test(roMigration.body);
  const hasHreflangFa = /hreflang="fa"/i.test(roMigration.body);
  const hasHreflangDef = /hreflang="x-default"/i.test(roMigration.body);
  const noDupBrand = !roMigration.body.includes('CLADORA | CLADORA');

  console.log(`  - Has self-referencing canonical: ${hasSelfCanonical}`);
  console.log(`  - Has hreflang="ro": ${hasHreflangRo}, "en": ${hasHreflangEn}, "fa": ${hasHreflangFa}, "x-default": ${hasHreflangDef}`);
  console.log(`  - No duplicate brand suffix: ${noDupBrand}`);
  if (!hasSelfCanonical || !hasHreflangRo || !hasHreflangEn || !hasHreflangFa || !hasHreflangDef || !noDupBrand) allPassed = false;

  // No absolute claims on home /ro
  const noAbsPercent = !ro.body.includes('-45%') && !ro.body.includes('85%+');
  const noAbs100 = !ro.body.includes('Conformitate 100%') && !ro.body.includes('Algoritmi aprobați');
  console.log(`  - No prohibited marketing claims (-45%, 85%+, Conformitate 100%, Algoritmi aprobați): ${noAbsPercent && noAbs100}`);
  if (!noAbsPercent || !noAbs100) allPassed = false;

  if (!allPassed) {
    console.error('\n❌ ERROR: Some copy verification checks failed.');
    process.exit(1);
  }

  console.log('\n=== ALL COPY CHECKS VERIFIED SUCCESSFULLY ===');
}

verify();

