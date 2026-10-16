import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CE_GUIDE_TRANSLATION_PROVENANCE_CONTRACT,
  evaluateGuideTranslationProvenanceV1,
  projectPublicGuideTranslationAttributionV1,
} from '../src/lib/community/experience-guide-translation-provenance-v1.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8');
const clone = value => structuredClone(value);
const normalized = value => value.replace(/\s+/g, ' ');

let assertions = 0;
const check = (value, message) => {
  assertions += 1;
  assert.ok(value, message);
};
const equal = (actual, expected, message) => {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
};

const ids = {
  context: '00000000-0000-4000-8000-000000000001',
  workspace: '00000000-0000-4000-8000-000000000002',
  guide: '00000000-0000-4000-8000-000000000003',
  content: '00000000-0000-4000-8000-000000000004',
  series: '00000000-0000-4000-8000-000000000005',
  translation: '00000000-0000-4000-8000-000000000006',
  provenance: '00000000-0000-4000-8000-000000000007',
  producer: '00000000-0000-4000-8000-000000000008',
  reviewer: '00000000-0000-4000-8000-000000000009',
  nextTranslation: '00000000-0000-4000-8000-000000000010',
  other: '00000000-0000-4000-8000-000000000099',
};

const sourceHash = `sha256:${'1'.repeat(64)}`;
const translationHash = `sha256:${'2'.repeat(64)}`;

const makeInput = () => ({
  contract: CE_GUIDE_TRANSLATION_PROVENANCE_CONTRACT,
  version: 1,
  context_id: ids.context,
  workspace_id: ids.workspace,
  guide_id: ids.guide,
  source: {
    context_id: ids.context,
    workspace_id: ids.workspace,
    guide_id: ids.guide,
    guide_version: 7,
    source_content_version_id: ids.content,
    source_content_version: 4,
    source_content_hash: sourceHash,
    source_locale: 'en',
  },
  current_source: {
    context_id: ids.context,
    workspace_id: ids.workspace,
    guide_id: ids.guide,
    guide_version: 7,
    source_content_version_id: ids.content,
    source_content_version: 4,
    source_content_hash: sourceHash,
    source_locale: 'en',
    lifecycle: 'published',
  },
  translation_head: null,
  candidate: {
    translation_series_id: ids.series,
    translation_version_id: ids.translation,
    translation_version: 1,
    expected_previous_translation_version: 0,
    expected_previous_record_fingerprint: null,
    target_locale: 'fa',
    translation_content_hash: translationHash,
    method: 'machine_assisted',
    provenance: {
      provenance_id: ids.provenance,
      producer_identity_id: ids.producer,
      produced_at: '2026-10-16T10:00:00.000Z',
      review: {
        status: 'approved',
        reviewer_identity_id: ids.reviewer,
        reviewer_authority_revision: 12,
        reviewed_at: '2026-10-16T10:05:00.000Z',
      },
      attribution_policy: 'machine_assisted_human_reviewed',
    },
  },
});

const expectResult = (input, code, status = 'denied') => {
  const before = JSON.stringify(input);
  const result = evaluateGuideTranslationProvenanceV1(input);
  equal(result.result_code, code, `result code must be ${code}`);
  equal(result.decision_status, status, `${code} decision status must be ${status}`);
  equal(result.append_plan, null, `${code} must authorize zero append writes`);
  equal(projectPublicGuideTranslationAttributionV1(result), null,
    `${code} must expose no public attribution`);
  equal(JSON.stringify(input), before, `${code} must not mutate its input`);
};

const policies = {
  source_authored: 'source_authored',
  human_reviewed: 'human_reviewed',
  machine_assisted: 'machine_assisted_human_reviewed',
};

for (const [method, attributionPolicy] of Object.entries(policies)) {
  const input = makeInput();
  input.candidate.method = method;
  input.candidate.provenance.attribution_policy = attributionPolicy;
  const before = JSON.stringify(input);
  const first = evaluateGuideTranslationProvenanceV1(input);
  equal(first.decision_status, 'accepted', `${method} must be accepted after approved review`);
  equal(first.result_code, 'OK', `${method} must return OK`);
  check(first.append_plan !== null, `${method} must return one append plan`);
  check(/^sha256:[0-9a-f]{64}$/.test(first.append_plan.record_fingerprint),
    `${method} must bind a deterministic record fingerprint`);
  equal(evaluateGuideTranslationProvenanceV1(input), first,
    `${method} evaluation must be deterministic`);
  equal(JSON.stringify(input), before, `${method} evaluation must be pure`);
  equal(projectPublicGuideTranslationAttributionV1(first), {
    target_locale: 'fa',
    translation_version: 1,
    method,
    attribution_policy: attributionPolicy,
  }, `${method} public attribution must be bounded and exact`);
}

const firstInput = makeInput();
const firstAccepted = evaluateGuideTranslationProvenanceV1(firstInput);
assert.equal(firstAccepted.decision_status, 'accepted');
const nextInput = makeInput();
nextInput.translation_head = {
  context_id: ids.context,
  workspace_id: ids.workspace,
  guide_id: ids.guide,
  source_content_version_id: ids.content,
  source_content_version: 4,
  source_content_hash: sourceHash,
  translation_series_id: ids.series,
  translation_version_id: ids.translation,
  translation_version: 1,
  target_locale: 'fa',
  record_fingerprint: firstAccepted.append_plan.record_fingerprint,
};
nextInput.candidate.translation_version_id = ids.nextTranslation;
nextInput.candidate.translation_version = 2;
nextInput.candidate.expected_previous_translation_version = 1;
nextInput.candidate.expected_previous_record_fingerprint =
  firstAccepted.append_plan.record_fingerprint;
nextInput.candidate.translation_content_hash = `sha256:${'3'.repeat(64)}`;
const nextAccepted = evaluateGuideTranslationProvenanceV1(nextInput);
equal(nextAccepted.decision_status, 'accepted', 'an exact next append must be accepted');
check(nextAccepted.append_plan?.record_fingerprint !== firstAccepted.append_plan.record_fingerprint,
  'the next immutable translation version must receive a distinct fingerprint');

for (const [mutate, code] of [
  [input => { input.source.context_id = ids.other; }, 'CONTEXT_MISMATCH'],
  [input => { input.current_source.workspace_id = ids.other; }, 'WORKSPACE_MISMATCH'],
  [input => { input.source.guide_id = ids.other; }, 'GUIDE_MISMATCH'],
  [input => { input.current_source.guide_version += 1; }, 'SOURCE_STALE'],
  [input => { input.current_source.source_content_version_id = ids.other; }, 'SOURCE_STALE'],
  [input => { input.current_source.source_content_version += 1; }, 'SOURCE_STALE'],
  [input => { input.current_source.source_content_hash = `sha256:${'9'.repeat(64)}`; }, 'SOURCE_HASH_MISMATCH'],
  [input => { input.current_source.lifecycle = 'draft'; }, 'SOURCE_UNPUBLISHED'],
  [input => { input.current_source.lifecycle = 'unpublished'; }, 'SOURCE_UNPUBLISHED'],
  [input => { input.candidate.target_locale = 'fa-IR'; }, 'LOCALE_AMBIGUOUS'],
  [input => { input.candidate.target_locale = 'en'; }, 'LOCALE_AMBIGUOUS'],
  [input => { input.source.source_locale = 'en-US'; input.current_source.source_locale = 'en-US'; }, 'LOCALE_AMBIGUOUS'],
  [input => { input.candidate.provenance.review.status = 'pending'; }, 'REVIEW_REQUIRED'],
  [input => { input.candidate.provenance.review.reviewer_identity_id = null; }, 'REVIEW_REQUIRED'],
  [input => { input.candidate.provenance.review.reviewer_authority_revision = null; }, 'REVIEW_REQUIRED'],
  [input => { input.candidate.provenance.review.reviewed_at = null; }, 'REVIEW_REQUIRED'],
  [input => { input.candidate.provenance.review.status = 'rejected'; }, 'REVIEW_REJECTED'],
  [input => {
    input.candidate.provenance.review.reviewed_at = '2026-10-16T09:59:59.999Z';
  }, 'REVIEW_TIME_INVALID'],
  [input => { input.candidate.provenance.attribution_policy = 'human_reviewed'; }, 'ATTRIBUTION_POLICY_MISMATCH'],
  [input => { input.country_code = 'IR'; }, 'MALFORMED_INPUT'],
  [input => { input.candidate.provenance.professional_title = 'Certified legal translator'; }, 'MALFORMED_INPUT'],
  [input => { delete input.candidate.provenance.review; }, 'MALFORMED_INPUT'],
]) {
  const input = makeInput();
  mutate(input);
  expectResult(input, code, code.includes('STALE') || code.includes('HASH') ? 'conflict' : 'denied');
}

for (const [mutate, code] of [
  [input => { input.translation_head.workspace_id = ids.other; }, 'IMMUTABLE_BINDING_CONFLICT'],
  [input => { input.translation_head.source_content_version_id = ids.other; }, 'IMMUTABLE_BINDING_CONFLICT'],
  [input => { input.translation_head.translation_series_id = ids.other; }, 'IMMUTABLE_BINDING_CONFLICT'],
  [input => { input.translation_head.target_locale = 'ro'; }, 'IMMUTABLE_BINDING_CONFLICT'],
  [input => { input.candidate.translation_version_id = ids.translation; }, 'IMMUTABLE_BINDING_CONFLICT'],
  [input => { input.candidate.translation_version = 3; }, 'TRANSLATION_VERSION_CONFLICT'],
  [input => { input.candidate.expected_previous_translation_version = 0; }, 'TRANSLATION_VERSION_CONFLICT'],
  [input => { input.candidate.expected_previous_record_fingerprint = `sha256:${'8'.repeat(64)}`; }, 'TRANSLATION_VERSION_CONFLICT'],
]) {
  const input = clone(nextInput);
  mutate(input);
  expectResult(input, code, 'conflict');
}

for (const mutate of [
  input => { input.candidate.translation_version = 2; },
  input => { input.candidate.expected_previous_translation_version = 1; },
  input => { input.candidate.expected_previous_record_fingerprint = `sha256:${'8'.repeat(64)}`; },
]) {
  const input = makeInput();
  mutate(input);
  expectResult(input, 'TRANSLATION_VERSION_CONFLICT', 'conflict');
}

const privateProjectionSource = JSON.stringify(
  projectPublicGuideTranslationAttributionV1(firstAccepted),
);
for (const privateValue of [
  ids.reviewer,
  ids.producer,
  ids.provenance,
  sourceHash,
  translationHash,
  'reviewer_identity_id',
  'reviewer_authority_revision',
  'professional_title',
  'expertise',
]) {
  check(!privateProjectionSource.includes(privateValue),
    `public attribution must not expose private provenance: ${privateValue}`);
}

const evaluatorPath = 'src/lib/community/experience-guide-translation-provenance-v1.ts';
const evaluatorSource = read(evaluatorPath);
check(evaluatorSource.includes("'source_authored'"), 'source-authored method must remain distinct');
check(evaluatorSource.includes("'human_reviewed'"), 'human-reviewed method must remain distinct');
check(evaluatorSource.includes("'machine_assisted'"), 'machine-assisted method must remain distinct');
check(!/\b(?:fetch|createClient|postgres|supabase|process\.env)\b/.test(evaluatorSource),
  'the evaluator must remain pure and free of runtime/database/environment access');
for (const forbiddenField of [
  'country_code',
  'country_pack',
  'jurisdiction_profile',
  'domain_artifact',
  'legal_signoff',
  'accounting_approval',
]) {
  check(!evaluatorSource.toLowerCase().includes(forbiddenField),
    `the evaluator must not create or consume ${forbiddenField}`);
}
for (const forbiddenMapping of [/ro[^\n]{0,30}RO/, /fa[^\n]{0,30}IR/, /en[^\n]{0,50}default country/i]) {
  check(!forbiddenMapping.test(evaluatorSource),
    `the evaluator must not contain locale-to-country mapping ${forbiddenMapping}`);
}

const collectFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? collectFiles(absolute) : [absolute];
});
const runtimeConsumers = collectFiles(path.join(root, 'src'))
  .filter(file => /\.(?:ts|tsx)$/.test(file))
  .filter(file => path.relative(root, file) !== evaluatorPath)
  .filter(file => readFileSync(file, 'utf8').includes('experience-guide-translation-provenance-v1'));
equal(runtimeConsumers, [], 'the inactive evaluator must have no production runtime consumer');

const guidePage = read('src/components/customer/CustomerExperienceGuidePage.tsx');
const guideClient = read('src/lib/community/experience-guide-client.ts');
check(guidePage.includes('commands={null}'), 'the public Guide page must keep commands=null');
check(/can_edit:\s*false/.test(guideClient), 'the public Guide projection must keep can_edit=false');

const lifecycleProvider = read('src/lib/community/experience-guide-lifecycle-provider-v1.ts');
check(lifecycleProvider.includes("action === 'unpublish' && row.status !== 'published'"),
  'unpublish must remain an explicit lifecycle transition');
check(lifecycleProvider.includes("const resultingState = action === 'publish' ? 'published' : 'draft'"),
  'unpublish must remain target-free and return the Guide to draft');
check(!/unpublish[^\n]{0,180}(?:country|jurisdiction|translation)/i.test(lifecycleProvider),
  'unpublish must not gain a translation or jurisdiction dependency');

const contract = read('docs/architecture/CLADORA-CE-GUIDE-TRANSLATION-PROVENANCE-03-v1.0.md');
const contractNormalized = normalized(contract);
for (const statement of [
  'Locale remains a presentation/content attribute and is not jurisdiction evidence.',
  'The first translation version must be version `1`',
  '`source_authored`, `human_reviewed` or `machine_assisted`',
  'Reviewer/producer identities, authority revision, timestamps, hashes and provenance IDs remain private.',
  'Mappings such as `ro -> RO`, `fa -> IR` and `en -> a default country` are explicitly forbidden.',
  'Unpublish remains target-free.',
  'continues to pass `commands=null`',
  'continues to force `can_edit=false`',
  'Migration, persistence, Country Pack implementation, route exposure, remote installation, runtime activation and Production acceptance remain',
]) {
  check(contractNormalized.includes(normalized(statement)), `contract must retain: ${statement}`);
}

console.log(
  `CE Guide translation provenance passed: ${assertions} assertions; append-only evaluator pure; locale/jurisdiction separated; public reviewer data redacted; runtime inactive.`,
);
