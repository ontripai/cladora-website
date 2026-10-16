import { createHash } from 'node:crypto';
import { z } from 'zod';

export const CE_GUIDE_TRANSLATION_PROVENANCE_CONTRACT =
  'ce-guide-translation-provenance.v1' as const;

const uuid = z.string().uuid();
const positiveVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonNegativeVersion = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const timestamp = z.string().datetime({ offset: true });
const locale = z.string().trim().min(2).max(35);

export const guideTranslationMethodV1Schema = z.enum([
  'source_authored',
  'human_reviewed',
  'machine_assisted',
]);

export const guideTranslationAttributionPolicyV1Schema = z.enum([
  'source_authored',
  'human_reviewed',
  'machine_assisted_human_reviewed',
]);

export const guideTranslationSourceBindingV1Schema = z.strictObject({
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  guide_version: positiveVersion,
  source_content_version_id: uuid,
  source_content_version: positiveVersion,
  source_content_hash: digest,
  source_locale: locale,
});

export const currentGuideTranslationSourceV1Schema = z.strictObject({
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  guide_version: positiveVersion,
  source_content_version_id: uuid,
  source_content_version: positiveVersion,
  source_content_hash: digest,
  source_locale: locale,
  lifecycle: z.enum(['draft', 'published', 'unpublished']),
});

export const guideTranslationReviewV1Schema = z.strictObject({
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewer_identity_id: uuid.nullable(),
  reviewer_authority_revision: positiveVersion.nullable(),
  reviewed_at: timestamp.nullable(),
});

export const guideTranslationPrivateProvenanceV1Schema = z.strictObject({
  provenance_id: uuid,
  producer_identity_id: uuid,
  produced_at: timestamp,
  review: guideTranslationReviewV1Schema,
  attribution_policy: guideTranslationAttributionPolicyV1Schema,
});

export const guideTranslationCandidateV1Schema = z.strictObject({
  translation_series_id: uuid,
  translation_version_id: uuid,
  translation_version: positiveVersion,
  expected_previous_translation_version: nonNegativeVersion,
  expected_previous_record_fingerprint: digest.nullable(),
  target_locale: locale,
  translation_content_hash: digest,
  method: guideTranslationMethodV1Schema,
  provenance: guideTranslationPrivateProvenanceV1Schema,
});

export const guideTranslationHeadV1Schema = z.strictObject({
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  source_content_version_id: uuid,
  source_content_version: positiveVersion,
  source_content_hash: digest,
  translation_series_id: uuid,
  translation_version_id: uuid,
  translation_version: positiveVersion,
  target_locale: locale,
  record_fingerprint: digest,
});

export const evaluateGuideTranslationProvenanceV1InputSchema = z.strictObject({
  contract: z.literal(CE_GUIDE_TRANSLATION_PROVENANCE_CONTRACT),
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  source: guideTranslationSourceBindingV1Schema,
  current_source: currentGuideTranslationSourceV1Schema,
  translation_head: guideTranslationHeadV1Schema.nullable(),
  candidate: guideTranslationCandidateV1Schema,
});

export const guideTranslationProvenanceResultCodeV1Schema = z.enum([
  'OK',
  'MALFORMED_INPUT',
  'CONTEXT_MISMATCH',
  'WORKSPACE_MISMATCH',
  'GUIDE_MISMATCH',
  'SOURCE_UNPUBLISHED',
  'SOURCE_STALE',
  'SOURCE_HASH_MISMATCH',
  'LOCALE_AMBIGUOUS',
  'REVIEW_REQUIRED',
  'REVIEW_REJECTED',
  'REVIEW_TIME_INVALID',
  'ATTRIBUTION_POLICY_MISMATCH',
  'IMMUTABLE_BINDING_CONFLICT',
  'TRANSLATION_VERSION_CONFLICT',
]);

export type GuideTranslationMethodV1 = z.infer<typeof guideTranslationMethodV1Schema>;
export type GuideTranslationAttributionPolicyV1 = z.infer<
  typeof guideTranslationAttributionPolicyV1Schema
>;
export type GuideTranslationSourceBindingV1 = z.infer<
  typeof guideTranslationSourceBindingV1Schema
>;
export type GuideTranslationCandidateV1 = z.infer<typeof guideTranslationCandidateV1Schema>;
export type GuideTranslationHeadV1 = z.infer<typeof guideTranslationHeadV1Schema>;
export type EvaluateGuideTranslationProvenanceV1Input = z.infer<
  typeof evaluateGuideTranslationProvenanceV1InputSchema
>;
export type GuideTranslationProvenanceResultCodeV1 = z.infer<
  typeof guideTranslationProvenanceResultCodeV1Schema
>;

export type GuideTranslationAppendPlanV1 = {
  contract: typeof CE_GUIDE_TRANSLATION_PROVENANCE_CONTRACT;
  version: 1;
  context_id: string;
  workspace_id: string;
  guide_id: string;
  source: GuideTranslationSourceBindingV1;
  translation: GuideTranslationCandidateV1;
  record_fingerprint: string;
};

export type GuideTranslationPublicAttributionV1 = {
  target_locale: 'ro' | 'en' | 'fa';
  translation_version: number;
  method: GuideTranslationMethodV1;
  attribution_policy: GuideTranslationAttributionPolicyV1;
};

export type GuideTranslationProvenanceEvaluationV1 =
  | {
      decision_status: 'accepted';
      result_code: 'OK';
      append_plan: GuideTranslationAppendPlanV1;
    }
  | {
      decision_status: 'denied' | 'conflict';
      result_code: Exclude<GuideTranslationProvenanceResultCodeV1, 'OK'>;
      append_plan: null;
    };

const supportedLocales = new Set(['ro', 'en', 'fa']);

const attributionByMethod: Record<
  GuideTranslationMethodV1,
  GuideTranslationAttributionPolicyV1
> = {
  source_authored: 'source_authored',
  human_reviewed: 'human_reviewed',
  machine_assisted: 'machine_assisted_human_reviewed',
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const fingerprintRecord = (
  value: Omit<GuideTranslationAppendPlanV1, 'record_fingerprint'>,
): string => `sha256:${createHash('sha256').update(stableSerialize(value)).digest('hex')}`;

const stop = (
  resultCode: Exclude<GuideTranslationProvenanceResultCodeV1, 'OK'>,
  decisionStatus: 'denied' | 'conflict' = 'denied',
): GuideTranslationProvenanceEvaluationV1 => ({
  decision_status: decisionStatus,
  result_code: resultCode,
  append_plan: null,
});

const scopeMatches = (
  input: EvaluateGuideTranslationProvenanceV1Input,
  source: EvaluateGuideTranslationProvenanceV1Input['source'],
): GuideTranslationProvenanceEvaluationV1 | null => {
  if (source.context_id !== input.context_id) return stop('CONTEXT_MISMATCH');
  if (source.workspace_id !== input.workspace_id) return stop('WORKSPACE_MISMATCH');
  if (source.guide_id !== input.guide_id) return stop('GUIDE_MISMATCH');
  return null;
};

export function evaluateGuideTranslationProvenanceV1(
  value: unknown,
): GuideTranslationProvenanceEvaluationV1 {
  const parsed = evaluateGuideTranslationProvenanceV1InputSchema.safeParse(value);
  if (!parsed.success) return stop('MALFORMED_INPUT');

  const input = parsed.data;
  const sourceScopeFailure = scopeMatches(input, input.source);
  if (sourceScopeFailure) return sourceScopeFailure;
  const currentScopeFailure = scopeMatches(input, input.current_source);
  if (currentScopeFailure) return currentScopeFailure;

  if (input.current_source.lifecycle !== 'published') return stop('SOURCE_UNPUBLISHED');
  if (input.source.guide_version !== input.current_source.guide_version
    || input.source.source_content_version_id !== input.current_source.source_content_version_id
    || input.source.source_content_version !== input.current_source.source_content_version
    || input.source.source_locale !== input.current_source.source_locale) {
    return stop('SOURCE_STALE', 'conflict');
  }
  if (input.source.source_content_hash !== input.current_source.source_content_hash) {
    return stop('SOURCE_HASH_MISMATCH', 'conflict');
  }

  if (!supportedLocales.has(input.source.source_locale)
    || !supportedLocales.has(input.candidate.target_locale)
    || input.source.source_locale === input.candidate.target_locale) {
    return stop('LOCALE_AMBIGUOUS');
  }

  const review = input.candidate.provenance.review;
  if (review.status === 'rejected') return stop('REVIEW_REJECTED');
  if (review.status !== 'approved'
    || review.reviewer_identity_id === null
    || review.reviewer_authority_revision === null
    || review.reviewed_at === null) {
    return stop('REVIEW_REQUIRED');
  }
  if (Date.parse(review.reviewed_at)
    < Date.parse(input.candidate.provenance.produced_at)) {
    return stop('REVIEW_TIME_INVALID');
  }

  if (input.candidate.provenance.attribution_policy
    !== attributionByMethod[input.candidate.method]) {
    return stop('ATTRIBUTION_POLICY_MISMATCH');
  }

  const head = input.translation_head;
  if (head === null) {
    if (input.candidate.translation_version !== 1
      || input.candidate.expected_previous_translation_version !== 0
      || input.candidate.expected_previous_record_fingerprint !== null) {
      return stop('TRANSLATION_VERSION_CONFLICT', 'conflict');
    }
  } else {
    if (head.context_id !== input.context_id
      || head.workspace_id !== input.workspace_id
      || head.guide_id !== input.guide_id
      || head.source_content_version_id !== input.source.source_content_version_id
      || head.source_content_version !== input.source.source_content_version
      || head.source_content_hash !== input.source.source_content_hash
      || head.translation_series_id !== input.candidate.translation_series_id
      || head.target_locale !== input.candidate.target_locale
      || head.translation_version_id === input.candidate.translation_version_id) {
      return stop('IMMUTABLE_BINDING_CONFLICT', 'conflict');
    }
    if (input.candidate.expected_previous_translation_version !== head.translation_version
      || input.candidate.expected_previous_record_fingerprint !== head.record_fingerprint
      || input.candidate.translation_version !== head.translation_version + 1) {
      return stop('TRANSLATION_VERSION_CONFLICT', 'conflict');
    }
  }

  const appendRecord = {
    contract: CE_GUIDE_TRANSLATION_PROVENANCE_CONTRACT,
    version: 1 as const,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    guide_id: input.guide_id,
    source: structuredClone(input.source),
    translation: structuredClone(input.candidate),
  };

  return {
    decision_status: 'accepted',
    result_code: 'OK',
    append_plan: {
      ...appendRecord,
      record_fingerprint: fingerprintRecord(appendRecord),
    },
  };
}

export function projectPublicGuideTranslationAttributionV1(
  evaluation: GuideTranslationProvenanceEvaluationV1,
): GuideTranslationPublicAttributionV1 | null {
  if (evaluation.decision_status !== 'accepted') return null;
  return {
    target_locale: evaluation.append_plan.translation.target_locale as 'ro' | 'en' | 'fa',
    translation_version: evaluation.append_plan.translation.translation_version,
    method: evaluation.append_plan.translation.method,
    attribution_policy: evaluation.append_plan.translation.provenance.attribution_policy,
  };
}
