import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let assertions = 0;
const check = (value, message) => {
  assertions += 1;
  assert.ok(value, message);
};
const matches = (source, pattern) => pattern.test(source);
const read = (file) => readFileSync(file, 'utf8');

const guideExecutableFiles = [
  'src/app/api/customer/v1/experience/guides/route.ts',
  'src/components/customer/CustomerExperienceGuide.tsx',
  'src/components/customer/CustomerExperienceGuidePage.tsx',
  'src/lib/community/experience-guide-client.ts',
  'src/lib/community/experience-guide-command-contract.ts',
  'src/lib/community/experience-guide-domain.ts',
  'src/lib/community/experience-guide-editor-adapter.ts',
  'src/lib/community/experience-guide-lifecycle-http-v1.ts',
  'src/lib/community/experience-guide-lifecycle-provider-v1.ts',
  'src/lib/community/experience-guide-provider-bridge.ts',
  'src/lib/community/experience-guide-schema.ts',
];

const browserOrRegionalSignals = [
  ['Accept-Language', /accept-language/i],
  ['Content-Language', /content-language/i],
  ['browser language', /navigator\.(?:language|languages)/i],
  ['forwarded IP', /x-forwarded-for/i],
  ['real IP', /x-real-ip/i],
  ['CDN country', /(?:cf-ipcountry|x-vercel-ip-country)/i],
  ['request geolocation', /(?:request\.geo|geo\.country)/i],
  ['timezone inference', /(?:timeZone|timezone)\s*(?:===|==|:|\?)/i],
  ['currency inference', /currency(?:Code|_code)?\s*(?:===|==|\?)/i],
];

const localeCountryMappings = [
  ['locale-to-country helper', /(?:locale|language)(?:To|_to_)(?:Country|Jurisdiction|Profile|Domain|CountryPack)/i],
  ['country-by-locale table', /(?:country|jurisdiction|profile|domain|countryPack)(?:By|_by_)(?:Locale|Language)/i],
  ['Romanian locale to Romania', /(?:['"]?ro['"]?)\s*(?:=>|:|\?|===?|,)[^\n]{0,80}['"]RO['"]/i],
  ['Persian locale to Iran', /(?:['"]?fa['"]?)\s*(?:=>|:|\?|===?|,)[^\n]{0,80}['"]IR['"]/i],
  ['English locale to default country', /(?:['"]?en['"]?)\s*(?:=>|:|\?|===?|,)[^\n]{0,80}(?:defaultCountry|country_code|countryCode)/i],
];

for (const file of guideExecutableFiles) {
  const source = read(file);
  check(source.length > 0, `${file} must remain present`);
  for (const [name, pattern] of browserOrRegionalSignals) {
    check(!matches(source, pattern), `${file} must not infer jurisdiction from ${name}`);
  }
  for (const [name, pattern] of localeCountryMappings) {
    check(!matches(source, pattern), `${file} must not contain ${name}`);
  }
}

const client = read('src/lib/community/experience-guide-client.ts');
const component = read('src/components/customer/CustomerExperienceGuide.tsx');
const page = read('src/components/customer/CustomerExperienceGuidePage.tsx');
const route = read('src/app/api/customer/v1/experience/guides/route.ts');
const presentation = `${client}\n${component}\n${page}`;

check(matches(client, /audience_label:\s*audienceLabels\[lang\]\[item\.audience\.kind\]/),
  'language may select only the presentation audience label');
check(matches(component, /const t = copy\[lang\]/), 'component language must select presentation copy');
check(matches(component, /dir=\{lang === 'fa' \? 'rtl' : 'ltr'\}/),
  'component language may select presentation direction');
check(matches(page, /const t = copy\[lang\]/), 'page language must select presentation copy');
check(matches(page, /commands=\{null\}/), 'the public Guide page must keep commands disabled');
check(matches(client, /can_edit:\s*false/), 'the public Guide projection must keep editing disabled');
check(!matches(route, /\b(?:lang|locale|country|timezone|currency)\b/i),
  'the Guide read route must not accept regional inference input');

for (const field of [
  'country_code',
  'jurisdiction_profile',
  'country_pack',
  'profile_version',
  'domain_code',
  'artifact_sha256',
  'legal_review',
  'accounting_review',
  'legal_signoff',
  'accounting_signoff',
]) {
  check(!presentation.toLowerCase().includes(field),
    `presentation and translation code must not derive or expose ${field}`);
}
check(!matches(presentation, /jurisdiction-profile|jurisdiction-domain-artifact/),
  'presentation code must not import jurisdiction selectors or artifacts');

const provider = read('src/lib/community/experience-guide-lifecycle-provider-v1.ts');
const referenceCalls = [...provider.matchAll(/validateCurrentGuideReferences\(/g)];
check(referenceCalls.length === 3,
  'reference validation must have one definition and exactly two publish-only call sites');
for (const call of referenceCalls.slice(1)) {
  const prefix = provider.slice(Math.max(0, call.index - 240), call.index);
  check(matches(prefix, /(?:actionFor\(command\)|action)\s*===\s*'publish'/),
    'every reference-validation call must be guarded by publish');
}
check(matches(provider, /action === 'unpublish' && row\.status !== 'published'/),
  'unpublish must remain an explicit lifecycle transition');
check(matches(provider, /const resultingState = action === 'publish' \? 'published' : 'draft'/),
  'unpublish must continue to remove visibility by returning to draft');
check(!matches(provider, /jurisdiction|countryPack|country_pack|profile_version|domain_code/i),
  'unpublish provider must not acquire a Country Pack dependency');

const coreArtifact = read('src/lib/core/jurisdiction-domain-artifact-v1.ts');
for (const source of ['currency', 'ip_address', 'language', 'locale', 'phone_number', 'timezone']) {
  check(coreArtifact.includes(`z.literal('${source}')`),
    `Core must keep ${source} in the forbidden country-inference tuple`);
}
check(matches(coreArtifact, /country_source:\s*z\.literal\('explicit_address_country'\)/),
  'Core country selection must remain explicit and address-owned');
check(matches(coreArtifact, /reusable_as_command_authority:\s*z\.literal\(false\)/),
  'Country artifacts must not become command authority');
for (const domain of [
  'address.structure',
  'finance.tax-accounting',
  'documents.retention',
  'payments.policy',
]) {
  check(coreArtifact.includes(`domain_code: z.literal('${domain}')`),
    `canonical Core domain ${domain} must remain explicit`);
}
check(!matches(coreArtifact, /domain_code:\s*z\.literal\(['"](?:experience|guide|content)/i),
  'CE must not invent a Guide Country Pack domain');

const findings = read('docs/architecture/CLADORA-CE-LOCALE-JURISDICTION-SEPARATION-02-v1.0.md');
for (const requiredStatement of [
  'Locale and language are presentation inputs only.',
  'A translation cannot select or change a governing country',
  'Unpublish remains independent of current Country Pack availability.',
  '`commands=null` and `can_edit=false` remain the public runtime boundary.',
  'No executable locale-to-jurisdiction inference was found',
]) {
  check(findings.includes(requiredStatement), `findings contract must state: ${requiredStatement}`);
}

console.log(`CE locale/jurisdiction separation static contract passed: ${assertions} assertions; no locale, language, translation, timezone, currency, IP or browser-header jurisdiction inference; unpublish target-independent; commands and editing closed.`);
