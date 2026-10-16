import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { uuidSchema } from '../customer/workspace-composition-schema.ts';
import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1';
import {
  calculateJurisdictionDomainArtifactSha256V1,
  coreJurisdictionDomainArtifactHashInputV1Schema,
  coreJurisdictionDomainArtifactV1Schema,
  type CoreJurisdictionDomainArtifactV1,
} from './jurisdiction-domain-artifact-v1.ts';
import {
  CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1,
  selectCurrentPropertyJurisdictionProfileV1,
} from './jurisdiction-profile-selector-v1.ts';
import {
  CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMIT_CANDIDATE_V1,
  coreJurisdictionDomainArtifactCommitCandidateV1Schema,
  type CoreJurisdictionDomainArtifactCommitCandidateV1,
} from './jurisdiction-domain-artifact-transaction-evidence-v1.ts';
import {
  coreTransactionCommandV1Schema,
  coreTransactionCommandV2Schema,
  type CoreTransactionCommandV1,
  type CoreTransactionCommandV2,
  type CoreTransactionScopeV1,
} from './postgres-transaction-host-v1';

export const CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1 =
  'core-jurisdiction-domain-artifact-resolver-request.v1' as const;
export const CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_DECISION_V1 =
  'core-jurisdiction-domain-artifact-resolver-decision.v1' as const;
export const CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMITTED_EVIDENCE_V1 =
  'core-jurisdiction-domain-artifact-committed-evidence.v1' as const;

const timestamp = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,159}$/);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const authorityVersion = z.number().int().positive().safe();
const commandAttempt = z.number().int().positive().max(100).safe();
const commandSchema = z.discriminatedUnion('contract_version', [
  coreTransactionCommandV1Schema,
  coreTransactionCommandV2Schema,
]);
type CoreCommand = CoreTransactionCommandV1 | CoreTransactionCommandV2;

export const immutableJurisdictionDomainArtifactReferenceV1Schema = z.strictObject({
  profile_id: uuidSchema,
  profile_code: code,
  profile_version: z.number().int().positive().safe(),
  country_code: countryCode,
  profile_manifest_sha256: sha256,
  domain_code: code,
  domain_version: code,
  artifact_sha256: sha256,
  effective_at: timestamp,
});

export const currentJurisdictionDomainArtifactResolverRequestV1Schema = z.strictObject({
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1),
  mode: z.literal('current'),
  transaction_id: uuidSchema,
  command_id: uuidSchema,
  attempt: commandAttempt,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_id: uuidSchema,
  authority_version: authorityVersion,
  provider_source_ids: z.array(uuidSchema).max(32)
    .refine(values => new Set(values).size === values.length, 'Source locks must be unique'),
  lock: z.strictObject({
    kind: z.literal('command_aggregate'),
    aggregate_type: code,
    aggregate_id: uuidSchema,
  }),
  property_id: uuidSchema,
  expected_country_code: countryCode.optional(),
  domain_code: code,
  domain_version: code,
});

export const committedJurisdictionDomainArtifactEvidenceReferenceV1Schema = z.strictObject({
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMITTED_EVIDENCE_V1),
  receipt_id: uuidSchema,
  source_workspace_id: uuidSchema,
  source_property_id: uuidSchema,
  source_actor_id: uuidSchema,
  source_transaction_id: uuidSchema,
  source_command_id: uuidSchema,
  source_attempt: commandAttempt,
  reference: immutableJurisdictionDomainArtifactReferenceV1Schema,
});

export const historicalJurisdictionDomainArtifactResolverRequestV1Schema = z.strictObject({
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1),
  mode: z.literal('historical'),
  transaction_id: uuidSchema,
  command_id: uuidSchema,
  attempt: commandAttempt,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_id: uuidSchema,
  authority_version: authorityVersion,
  provider_source_ids: z.array(uuidSchema).max(32)
    .refine(values => new Set(values).size === values.length, 'Source locks must be unique'),
  lock: z.strictObject({
    kind: z.literal('command_aggregate'),
    aggregate_type: code,
    aggregate_id: uuidSchema,
  }),
  committed_evidence: committedJurisdictionDomainArtifactEvidenceReferenceV1Schema,
});

export const jurisdictionDomainArtifactResolverRequestV1Schema = z.discriminatedUnion('mode', [
  currentJurisdictionDomainArtifactResolverRequestV1Schema,
  historicalJurisdictionDomainArtifactResolverRequestV1Schema,
]);

const fingerprintSchema = immutableJurisdictionDomainArtifactReferenceV1Schema
  .omit({ effective_at: true }).extend({
  effective_from: timestamp,
  effective_to: timestamp.nullable(),
  lifecycle_status: z.enum(['draft', 'validated', 'active', 'suspended', 'retired']),
  canonical_bytes_sha256: sha256,
  canonical_byte_length: z.number().int().positive().max(1_048_576).safe(),
});

const decisionBase = {
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_DECISION_V1),
  resolver_version: z.literal(1),
  decision_id: uuidSchema,
  mode: z.enum(['current', 'historical']),
  evaluated_at: timestamp,
  source_disclosure: z.literal('bounded_artifact'),
  source_reference: z.null(),
  reusable_as_command_authority: z.literal(false),
} as const;

export const jurisdictionDomainArtifactResolverDecisionV1Schema = z.discriminatedUnion(
  'decision',
  [
    z.strictObject({
      ...decisionBase,
      decision: z.literal('accepted'),
      denial_reason: z.null(),
      artifact: coreJurisdictionDomainArtifactV1Schema,
      fingerprint: fingerprintSchema,
    }),
    z.strictObject({
      ...decisionBase,
      decision: z.literal('denied'),
      denial_reason: z.enum([
        'BINDING_MISMATCH',
        'AUTHORITY_DENIED',
        'STALE_AUTHORITY',
        'PROFILE_SELECTION_UNAVAILABLE',
        'ARTIFACT_UNAVAILABLE',
        'ARTIFACT_AMBIGUOUS',
        'ARTIFACT_BYTES_MISSING',
        'ARTIFACT_HASH_MISMATCH',
        'ARTIFACT_SCHEMA_UNSUPPORTED',
        'ARTIFACT_INACTIVE',
        'ARTIFACT_NOT_EFFECTIVE',
        'REVIEW_UNAVAILABLE',
        'HISTORICAL_RECEIPT_UNAVAILABLE',
        'PROVIDER_UNAVAILABLE',
      ]),
      artifact: z.null(),
      fingerprint: z.null(),
    }),
  ],
);

export type JurisdictionDomainArtifactResolverDecisionV1 = z.infer<
  typeof jurisdictionDomainArtifactResolverDecisionV1Schema
>;
export type ImmutableJurisdictionDomainArtifactReferenceV1 = z.infer<
  typeof immutableJurisdictionDomainArtifactReferenceV1Schema
>;
export type CurrentJurisdictionDomainArtifactResolverRequestV1 = z.infer<
  typeof currentJurisdictionDomainArtifactResolverRequestV1Schema
>;
export type HistoricalJurisdictionDomainArtifactResolverRequestV1 = z.infer<
  typeof historicalJurisdictionDomainArtifactResolverRequestV1Schema
>;

/**
 * Narrows an accepted current decision to the only artifact fields the Core
 * host may commit. Host-owned receipt and transaction identity are deliberately
 * absent and cannot be supplied by the resolver or consumer.
 */
export function toCoreJurisdictionDomainArtifactCommitCandidateV1(
  decisionValue: unknown,
  propertyId: string,
): CoreJurisdictionDomainArtifactCommitCandidateV1 {
  const decision = jurisdictionDomainArtifactResolverDecisionV1Schema.parse(decisionValue);
  if (decision.decision !== 'accepted' || decision.mode !== 'current') {
    throw new Error('current_artifact_decision_required');
  }
  return coreJurisdictionDomainArtifactCommitCandidateV1Schema.parse({
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMIT_CANDIDATE_V1,
    source_resolver_contract_version: decision.contract_version,
    resolver_version: decision.resolver_version,
    resolver_decision_id: decision.decision_id,
    mode: decision.mode,
    evaluated_at: decision.evaluated_at,
    property_id: propertyId,
    fingerprint: decision.fingerprint,
    reusable_as_command_authority: decision.reusable_as_command_authority,
  });
}
type DenialReason = Extract<JurisdictionDomainArtifactResolverDecisionV1,
  { decision: 'denied' }>['denial_reason'];
type ResolverMode = JurisdictionDomainArtifactResolverDecisionV1['mode'];

type ArtifactRow = {
  profile_id: string;
  profile_code: string;
  profile_version: number;
  country_code: string;
  profile_manifest_sha256: string;
  artifact_contract_version: string;
  artifact_version: number;
  domain_code: string;
  domain_version: string;
  artifact_sha256: string;
  canonical_bytes: Uint8Array | null;
  canonical_bytes_sha256: string;
  effective_from: string;
  effective_to: string | null;
  lifecycle_status: 'draft' | 'validated' | 'active' | 'suspended' | 'retired';
  profile_status: string;
  profile_valid_from: string;
  profile_valid_to: string | null;
  domain_status: string;
  domain_valid_from: string;
  domain_valid_to: string | null;
};

type CommittedEvidenceRow = ArtifactRow & {
  receipt_id: string;
  receipt_workspace_id: string;
  source_property_id: string;
  source_transaction_id: string;
  source_command_id: string;
  source_attempt: number;
};

function denied(mode: ResolverMode, evaluatedAt: string,
  reason: DenialReason): JurisdictionDomainArtifactResolverDecisionV1 {
  return jurisdictionDomainArtifactResolverDecisionV1Schema.parse({
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_DECISION_V1,
    resolver_version: 1,
    decision_id: randomUUID(),
    mode,
    evaluated_at: evaluatedAt,
    decision: 'denied',
    denial_reason: reason,
    artifact: null,
    fingerprint: null,
    source_disclosure: 'bounded_artifact',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function currentAuthorityBindingMatches(
  scope: CoreTransactionScopeV1,
  command: CoreCommand,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  request: z.infer<typeof currentJurisdictionDomainArtifactResolverRequestV1Schema>
    | z.infer<typeof historicalJurisdictionDomainArtifactResolverRequestV1Schema>,
) {
  return authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.reusable_as_command_authority === false
    && scope.transaction_id === request.transaction_id
    && scope.transaction_id === command.transaction_id
    && scope.workspace_id === request.workspace_id
    && scope.workspace_id === command.workspace_id
    && scope.actor_id === request.actor_id
    && scope.actor_id === command.actor_id
    && scope.attempt === request.attempt
    && request.transaction_id === authority.transaction_context.transaction_id
    && request.command_id === command.command_id
    && request.command_id === authority.transaction_context.command_id
    && request.context_id === command.context_id
    && request.context_id === authority.context_id
    && request.workspace_id === authority.workspace_id
    && request.actor_id === authority.actor_id
    && request.authority_version === command.authority_version
    && request.authority_version === authority.authority_version
    && request.attempt === authority.transaction_context.attempt
    && authority.transaction_context.isolation_level === 'serializable'
    && request.lock.kind === authority.transaction_context.lock.kind
    && request.lock.aggregate_type === command.aggregate_type
    && request.lock.aggregate_type === authority.transaction_context.lock.aggregate_type
    && request.lock.aggregate_id === command.aggregate_id
    && request.lock.aggregate_id === authority.transaction_context.lock.aggregate_id
    && authority.transaction_context.lock.workspace_id === request.workspace_id
    && command.permission_code === authority.permission_code
    && command.module_code === authority.module_code
    && command.evaluation_purpose === authority.evaluation_purpose
    && sameValues(request.provider_source_ids, command.provider_source_ids)
    && authority.entitlement !== undefined
    && authority.entitlement.workspace_id === request.workspace_id
    && authority.entitlement.authority_revision === request.authority_version
    && authority.entitlement.module_code === command.module_code
    && Number.isFinite(Date.parse(authority.evaluated_at))
    && Date.parse(authority.evaluated_at)
      >= Date.parse(authority.transaction_context.lock.acquired_at);
}

async function currentTransactionTime(scope: CoreTransactionScopeV1) {
  const execution = await scope.query<{
    transaction_id: string;
    actor_id: string | null;
    isolation: string;
    evaluated_at: string;
  }>(`select txid_current()::text as transaction_id,auth.uid()::text as actor_id,
    current_setting('transaction_isolation') as isolation,
    clock_timestamp()::text as evaluated_at`);
  const current = execution.rows[0];
  if (execution.rowCount !== 1 || current?.transaction_id !== scope.database_transaction_id
    || current.actor_id !== scope.actor_id || current.isolation !== 'serializable') return null;
  return new Date(current.evaluated_at).toISOString();
}

async function selectArtifactRows(
  scope: CoreTransactionScopeV1,
  identity: ImmutableJurisdictionDomainArtifactReferenceV1,
) {
  return scope.query<ArtifactRow>(`select
    a.jurisdiction_profile_id::text as profile_id,a.profile_code,
    a.profile_version,btrim(a.country_code::text) as country_code,
    a.profile_manifest_sha256,a.artifact_contract_version,a.artifact_version,
    a.domain_code,a.domain_version,a.artifact_sha256,a.canonical_bytes,
    a.canonical_bytes_sha256,a.effective_from::text,a.effective_to::text,
    a.lifecycle_status,p.status::text as profile_status,p.valid_from::text as profile_valid_from,
    p.valid_to::text as profile_valid_to,d.status::text as domain_status,
    d.valid_from::text as domain_valid_from,d.valid_to::text as domain_valid_to
    from platform.jurisdiction_domain_artifacts a
    join platform.jurisdiction_profiles p on p.id=a.jurisdiction_profile_id
    join platform.jurisdiction_profile_domains d
      on d.jurisdiction_profile_id=a.jurisdiction_profile_id and d.domain_code=a.domain_code
    where a.jurisdiction_profile_id=$1 and a.profile_code=$2 and a.profile_version=$3
      and a.country_code=$4 and a.profile_manifest_sha256=$5
      and a.domain_code=$6 and a.domain_version=$7 and a.artifact_sha256=$8
      and a.effective_from<=$9::timestamptz
      and (a.effective_to is null or a.effective_to>$9::timestamptz)
    for share of a,p,d`, [
    identity.profile_id,
    identity.profile_code,
    identity.profile_version,
    identity.country_code,
    identity.profile_manifest_sha256,
    identity.domain_code,
    identity.domain_version,
    identity.artifact_sha256,
    identity.effective_at,
  ]);
}

async function selectCommittedEvidenceRows(
  scope: CoreTransactionScopeV1,
  request: HistoricalJurisdictionDomainArtifactResolverRequestV1,
) {
  const evidence = request.committed_evidence;
  const identity = evidence.reference;
  return scope.query<CommittedEvidenceRow>(`select
    e.receipt_id::text,e.workspace_id::text as receipt_workspace_id,
    e.source_property_id::text,e.source_transaction_id::text,e.source_command_id::text,
    e.source_attempt,
    a.jurisdiction_profile_id::text as profile_id,a.profile_code,
    a.profile_version,btrim(a.country_code::text) as country_code,
    a.profile_manifest_sha256,a.artifact_contract_version,a.artifact_version,
    a.domain_code,a.domain_version,a.artifact_sha256,a.canonical_bytes,
    a.canonical_bytes_sha256,a.effective_from::text,a.effective_to::text,
    a.lifecycle_status,p.status::text as profile_status,p.valid_from::text as profile_valid_from,
    p.valid_to::text as profile_valid_to,d.status::text as domain_status,
    d.valid_from::text as domain_valid_from,d.valid_to::text as domain_valid_to
    from platform.jurisdiction_domain_artifact_receipt_evidence e
    join platform.jurisdiction_domain_artifacts a on a.id=e.artifact_id
    join platform.jurisdiction_profiles p on p.id=a.jurisdiction_profile_id
    join platform.jurisdiction_profile_domains d
      on d.jurisdiction_profile_id=a.jurisdiction_profile_id and d.domain_code=a.domain_code
    where e.receipt_id=$1 and e.tenant_id=$2 and e.workspace_id=$3
      and e.evidence_contract_version=
        'core-jurisdiction-domain-artifact-committed-evidence.v1'
      and e.source_property_id=$4 and e.source_actor_id=$5
      and e.source_transaction_id=$6 and e.source_command_id=$7 and e.source_attempt=$8
      and e.jurisdiction_profile_id=$9 and e.profile_code=$10 and e.profile_version=$11
      and e.country_code=$12 and e.profile_manifest_sha256=$13
      and e.domain_code=$14 and e.domain_version=$15 and e.artifact_sha256=$16
      and e.effective_at=$17::timestamptz
      and a.id=e.artifact_id and a.jurisdiction_profile_id=e.jurisdiction_profile_id
      and a.profile_code=e.profile_code and a.profile_version=e.profile_version
      and a.country_code=e.country_code
      and a.profile_manifest_sha256=e.profile_manifest_sha256
      and a.domain_code=e.domain_code and a.domain_version=e.domain_version
      and a.artifact_sha256=e.artifact_sha256
      and a.effective_from<=e.effective_at
      and (a.effective_to is null or a.effective_to>e.effective_at)
    for share of e,a,p,d`, [
    evidence.receipt_id,
    scope.tenant_id,
    evidence.source_workspace_id,
    evidence.source_property_id,
    evidence.source_actor_id,
    evidence.source_transaction_id,
    evidence.source_command_id,
    evidence.source_attempt,
    identity.profile_id,
    identity.profile_code,
    identity.profile_version,
    identity.country_code,
    identity.profile_manifest_sha256,
    identity.domain_code,
    identity.domain_version,
    identity.artifact_sha256,
    identity.effective_at,
  ]);
}

function instantWithin(effectiveAt: string, from: string, to: string | null) {
  const instant = Date.parse(effectiveAt);
  return Number.isFinite(instant) && instant >= Date.parse(from)
    && (to === null || instant < Date.parse(to));
}

function dateWithin(effectiveAt: string, from: string, to: string | null) {
  const date = effectiveAt.slice(0, 10);
  return date >= from && (to === null || date < to);
}

function parseArtifactRow(row: ArtifactRow): {
  artifact?: CoreJurisdictionDomainArtifactV1;
  reason?: DenialReason;
  byteLength?: number;
} {
  if (!(row.canonical_bytes instanceof Uint8Array) || row.canonical_bytes.byteLength === 0) {
    return { reason: 'ARTIFACT_BYTES_MISSING' };
  }
  const bytes = row.canonical_bytes;
  const rawHash = createHash('sha256').update(bytes).digest('hex');
  if (rawHash !== row.canonical_bytes_sha256 || rawHash !== row.artifact_sha256) {
    return { reason: 'ARTIFACT_HASH_MISMATCH' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { reason: 'ARTIFACT_SCHEMA_UNSUPPORTED' };
  }
  const hashInput = coreJurisdictionDomainArtifactHashInputV1Schema.safeParse(parsed);
  if (!hashInput.success) return { reason: 'ARTIFACT_SCHEMA_UNSUPPORTED' };
  if (calculateJurisdictionDomainArtifactSha256V1(hashInput.data) !== rawHash) {
    return { reason: 'ARTIFACT_HASH_MISMATCH' };
  }
  const artifact = coreJurisdictionDomainArtifactV1Schema.safeParse({
    ...hashInput.data,
    artifact_sha256: rawHash,
  });
  if (!artifact.success) return { reason: 'ARTIFACT_SCHEMA_UNSUPPORTED' };
  const value = artifact.data;
  if (value.profile.profile_id !== row.profile_id
    || value.profile.profile_code !== row.profile_code
    || value.profile.profile_version !== row.profile_version
    || value.profile.country_code !== row.country_code
    || value.profile.manifest_sha256 !== row.profile_manifest_sha256
    || value.domain.domain_code !== row.domain_code
    || value.domain.domain_version !== row.domain_version
    || Date.parse(value.effective_from) !== Date.parse(row.effective_from)
    || (value.effective_to === null) !== (row.effective_to === null)
    || value.effective_to !== null && row.effective_to !== null
      && Date.parse(value.effective_to) !== Date.parse(row.effective_to)
    || value.status !== row.lifecycle_status) {
    return { reason: 'ARTIFACT_HASH_MISMATCH' };
  }
  return { artifact: value, byteLength: bytes.byteLength };
}

function accepted(
  mode: ResolverMode,
  evaluatedAt: string,
  artifact: CoreJurisdictionDomainArtifactV1,
  row: ArtifactRow,
  byteLength: number,
): JurisdictionDomainArtifactResolverDecisionV1 {
  return jurisdictionDomainArtifactResolverDecisionV1Schema.parse({
    contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_DECISION_V1,
    resolver_version: 1,
    decision_id: randomUUID(),
    mode,
    evaluated_at: evaluatedAt,
    decision: 'accepted',
    denial_reason: null,
    artifact,
    fingerprint: {
      profile_id: row.profile_id,
      profile_code: row.profile_code,
      profile_version: row.profile_version,
      country_code: row.country_code,
      profile_manifest_sha256: row.profile_manifest_sha256,
      domain_code: row.domain_code,
      domain_version: row.domain_version,
      artifact_sha256: row.artifact_sha256,
      effective_from: new Date(row.effective_from).toISOString(),
      effective_to: row.effective_to === null ? null : new Date(row.effective_to).toISOString(),
      lifecycle_status: row.lifecycle_status,
      canonical_bytes_sha256: row.canonical_bytes_sha256,
      canonical_byte_length: byteLength,
    },
    source_disclosure: 'bounded_artifact',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}

/**
 * Resolves the one immutable artifact selected by the current Country Pack.
 * The caller supplies only the host command, post-lock authority receipt and
 * requested property/domain identity. The canonical profile selector is called
 * here so its locks and the artifact read share this transaction and attempt.
 */
export async function resolveCurrentJurisdictionDomainArtifactV1(
  scope: CoreTransactionScopeV1,
  commandValue: CoreCommand,
  authorityValue: CurrentAuthorityTransactionDecisionReceiptV1,
  requestValue: unknown,
): Promise<JurisdictionDomainArtifactResolverDecisionV1> {
  const command = commandSchema.safeParse(commandValue);
  const authority = currentAuthorityTransactionDecisionReceiptV1Schema.safeParse(authorityValue);
  const request = currentJurisdictionDomainArtifactResolverRequestV1Schema.safeParse(requestValue);
  const fallbackTime = authority.success && Number.isFinite(Date.parse(authority.data.evaluated_at))
    ? authority.data.evaluated_at : new Date().toISOString();
  if (!command.success || !authority.success || !request.success
    || !currentAuthorityBindingMatches(scope, command.data, authority.data, request.data)) {
    return denied('current', fallbackTime, 'BINDING_MISMATCH');
  }
  if (authority.data.decision !== 'allowed') {
    return denied('current', fallbackTime, 'AUTHORITY_DENIED');
  }
  try {
    const evaluatedAt = await currentTransactionTime(scope);
    if (evaluatedAt === null) return denied('current', fallbackTime, 'BINDING_MISMATCH');
    const revision = await scope.query<{ revision: string }>(`select revision::text
      from app_private.canonical_authority_revision_v1 where singleton for share`);
    if (revision.rowCount !== 1 || Number(revision.rows[0]?.revision)
      !== request.data.authority_version) {
      return denied('current', evaluatedAt, 'STALE_AUTHORITY');
    }
    const selection = await selectCurrentPropertyJurisdictionProfileV1(
      scope,
      command.data,
      authority.data,
      {
        contract_version: CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1,
        property_id: request.data.property_id,
        ...(request.data.expected_country_code === undefined
          ? {} : { expected_country_code: request.data.expected_country_code }),
        required_domain_codes: [request.data.domain_code],
      },
    );
    if (selection.decision !== 'accepted') {
      return denied('current', evaluatedAt, 'PROFILE_SELECTION_UNAVAILABLE');
    }
    const binding = selection.binding;
    const domains = binding.domains.filter(value => value.domain_code === request.data.domain_code);
    if (binding.context_id !== request.data.context_id
      || binding.workspace_id !== request.data.workspace_id
      || binding.actor_id !== request.data.actor_id
      || binding.authority_version !== request.data.authority_version
      || binding.property_id !== request.data.property_id
      || !request.data.provider_source_ids.includes(binding.property_id)
      || domains.length !== 1
      || domains[0].contract_version !== request.data.domain_version) {
      return denied('current', evaluatedAt, 'BINDING_MISMATCH');
    }
    const identity = immutableJurisdictionDomainArtifactReferenceV1Schema.parse({
      profile_id: binding.profile_id,
      profile_code: binding.profile_code,
      profile_version: binding.profile_version,
      country_code: binding.country_code,
      profile_manifest_sha256: binding.profile_manifest_sha256,
      domain_code: request.data.domain_code,
      domain_version: request.data.domain_version,
      artifact_sha256: domains[0].artifact_sha256,
      effective_at: selection.evaluated_at,
    });
    const rows = await selectArtifactRows(scope, identity);
    if (rows.rowCount === 0) return denied('current', evaluatedAt, 'ARTIFACT_UNAVAILABLE');
    if (rows.rowCount !== 1) return denied('current', evaluatedAt, 'ARTIFACT_AMBIGUOUS');
    const row = rows.rows[0];
    const parsed = parseArtifactRow(row);
    if (parsed.reason !== undefined || parsed.artifact === undefined
      || parsed.byteLength === undefined) {
      return denied('current', evaluatedAt, parsed.reason ?? 'ARTIFACT_SCHEMA_UNSUPPORTED');
    }
    if (row.profile_status !== 'active' || row.domain_status !== 'active'
      || row.lifecycle_status !== 'active') {
      return denied('current', evaluatedAt, 'ARTIFACT_INACTIVE');
    }
    if (!instantWithin(identity.effective_at, row.effective_from, row.effective_to)
      || !dateWithin(identity.effective_at, row.profile_valid_from, row.profile_valid_to)
      || !dateWithin(identity.effective_at, row.domain_valid_from, row.domain_valid_to)) {
      return denied('current', evaluatedAt, 'ARTIFACT_NOT_EFFECTIVE');
    }
    const artifact = parsed.artifact;
    if (artifact.legal_review.status !== 'approved'
      || artifact.legal_review.reviewed_at === null
      || artifact.legal_review.evidence_sha256 === null
      || Date.parse(artifact.legal_review.reviewed_at) > Date.parse(identity.effective_at)
      || artifact.accounting_review.status !== 'approved'
      || artifact.accounting_review.reviewed_at === null
      || artifact.accounting_review.evidence_sha256 === null
      || Date.parse(artifact.accounting_review.reviewed_at)
        > Date.parse(identity.effective_at)) {
      return denied('current', evaluatedAt, 'REVIEW_UNAVAILABLE');
    }
    return accepted('current', evaluatedAt, artifact, row, parsed.byteLength);
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return denied('current', fallbackTime, 'PROVIDER_UNAVAILABLE');
  }
}

/**
 * Resolves only the exact immutable artifact recorded by a prior receipt. It
 * never selects a newer artifact and never turns historical data into command
 * authority.
 */
export async function resolveHistoricalJurisdictionDomainArtifactV1(
  scope: CoreTransactionScopeV1,
  commandValue: CoreCommand,
  authorityValue: CurrentAuthorityTransactionDecisionReceiptV1,
  requestValue: unknown,
): Promise<JurisdictionDomainArtifactResolverDecisionV1> {
  const command = commandSchema.safeParse(commandValue);
  const authority = currentAuthorityTransactionDecisionReceiptV1Schema.safeParse(authorityValue);
  const request = historicalJurisdictionDomainArtifactResolverRequestV1Schema.safeParse(
    requestValue,
  );
  const fallbackTime = authority.success && Number.isFinite(Date.parse(authority.data.evaluated_at))
    ? authority.data.evaluated_at : new Date().toISOString();
  if (!command.success || !authority.success || !request.success
    || !currentAuthorityBindingMatches(scope, command.data, authority.data, request.data)
    || request.data.committed_evidence.source_workspace_id !== request.data.workspace_id
    || !request.data.provider_source_ids.includes(
      request.data.committed_evidence.source_property_id)) {
    return denied('historical', fallbackTime, 'BINDING_MISMATCH');
  }
  if (authority.data.decision !== 'allowed') {
    return denied('historical', fallbackTime, 'AUTHORITY_DENIED');
  }
  try {
    const evaluatedAt = await currentTransactionTime(scope);
    if (evaluatedAt === null) return denied('historical', fallbackTime, 'BINDING_MISMATCH');
    const revision = await scope.query<{ revision: string }>(`select revision::text
      from app_private.canonical_authority_revision_v1 where singleton for share`);
    if (revision.rowCount !== 1 || Number(revision.rows[0]?.revision)
      !== request.data.authority_version) {
      return denied('historical', evaluatedAt, 'STALE_AUTHORITY');
    }
    const rows = await selectCommittedEvidenceRows(scope, request.data);
    if (rows.rowCount === 0) {
      return denied('historical', evaluatedAt, 'HISTORICAL_RECEIPT_UNAVAILABLE');
    }
    if (rows.rowCount !== 1) {
      return denied('historical', evaluatedAt, 'ARTIFACT_AMBIGUOUS');
    }
    const row = rows.rows[0];
    const parsed = parseArtifactRow(row);
    if (parsed.reason !== undefined || parsed.artifact === undefined
      || parsed.byteLength === undefined) {
      return denied('historical', evaluatedAt,
        parsed.reason ?? 'ARTIFACT_SCHEMA_UNSUPPORTED');
    }
    if (!instantWithin(request.data.committed_evidence.reference.effective_at,
      row.effective_from, row.effective_to)) {
      return denied('historical', evaluatedAt, 'ARTIFACT_NOT_EFFECTIVE');
    }
    return accepted('historical', evaluatedAt, parsed.artifact, row, parsed.byteLength);
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return denied('historical', fallbackTime, 'PROVIDER_UNAVAILABLE');
  }
}
