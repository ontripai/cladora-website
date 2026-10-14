import 'server-only';

import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  createCorePostgresTransactionHostV1,
  type CoreTransactionCommandV2,
  type CoreTransactionProvidersV2,
  type CoreTransactionResultV2,
} from '../core/postgres-transaction-host-v1';
import { hasTrustedMutationOrigin } from '../security/same-origin';
import { createClient } from '../supabase/server';
import {
  experienceGuideLifecycleProviderCodeV1,
  experienceGuideLifecycleReplayPolicyV1,
  mutateExperienceGuideLifecycleV1,
  validateExperienceGuideLifecycleReplayV1,
  validateExperienceGuideLifecycleV1,
} from './experience-guide-lifecycle-provider-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const safeVersion = z.number().int().positive().safe();
const idempotencyKey = z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);

export const experienceGuideLifecycleHttpRequestV1Schema = z.strictObject({
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  expected_version: safeVersion,
  operation: z.enum(['publish', 'unpublish']),
  idempotency_key: idempotencyKey,
});

export type ExperienceGuideLifecycleHttpRequestV1 = z.infer<
  typeof experienceGuideLifecycleHttpRequestV1Schema
>;

const verifiedSessionSchema = z.strictObject({
  source: z.literal('supabase_verified_session'),
  actor_id: uuid,
  assurance_level: z.enum(['aal1', 'aal2']),
  expires_at: z.number().int().positive().safe(),
});

export type ExperienceGuideLifecycleVerifiedSessionV1 = z.infer<typeof verifiedSessionSchema>;
export type ExperienceGuideLifecycleAuthenticationV1 = (
  request: Request,
) => Promise<ExperienceGuideLifecycleVerifiedSessionV1 | null>;

type CorePool = Pick<Pool, 'connect'>;

export interface ExperienceGuideLifecycleHttpDependenciesV1 {
  readonly pool: CorePool;
  readonly authenticate: ExperienceGuideLifecycleAuthenticationV1;
  readonly now?: () => number;
}

type SourceLockCandidate = Readonly<{
  authority_version: number;
  provider_source_ids: string[];
}>;

const responseHeaders = Object.freeze({
  'cache-control': 'no-store, private',
  'content-type': 'application/json; charset=utf-8',
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function bounded(status: number, code: string) {
  return json(status, { outcome: 'denied', code });
}

/** Existing Supabase SSR boundary; no request body or header can supply actor/AAL. */
export async function authenticateExperienceGuideLifecycleServerSessionV1(
  _request: Request,
): Promise<ExperienceGuideLifecycleVerifiedSessionV1 | null> {
  const supabase = await createClient();
  const [{ data: userData, error: userError },
    { data: sessionData, error: sessionError },
    { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const expiresAt = sessionData.session?.expires_at;
  const currentLevel = assurance?.currentLevel;
  if (userError || sessionError || assuranceError || !userData.user || !sessionData.session
    || sessionData.session.user.id !== userData.user.id
    || !Number.isSafeInteger(expiresAt) || expiresAt! <= Math.floor(Date.now() / 1000)
    || (currentLevel !== 'aal1' && currentLevel !== 'aal2')) return null;
  return verifiedSessionSchema.parse({
    source: 'supabase_verified_session',
    actor_id: userData.user.id,
    assurance_level: currentLevel,
    expires_at: expiresAt,
  });
}

const identitySettingsSql = `select
  set_config('request.jwt.claims',$1,true) as claims,
  set_config('request.jwt.claim.sub',$2,true) as subject,
  set_config('request.jwt.claim.aal',$3,true) as assurance,
  set_config('request.jwt.claim.role',$4,true) as role`;
const clearIdentitySettingsSql = `select
  set_config('request.jwt.claims','',false),
  set_config('request.jwt.claim.sub','',false),
  set_config('request.jwt.claim.aal','',false),
  set_config('request.jwt.claim.role','',false)`;

async function scrubConnectionIdentity(client: PoolClient) {
  await client.query('reset role');
  await client.query(clearIdentitySettingsSql);
}

function claimsFor(session: ExperienceGuideLifecycleVerifiedSessionV1) {
  return JSON.stringify({ sub: session.actor_id, role: 'authenticated', aal: session.assurance_level });
}

/**
 * Request-owned Core pool. The existing non-login cladora_rpc_owner role is
 * selected only inside a transaction; production grants remain a separate gate.
 */
export function createExperienceGuideLifecycleRequestPoolV1(
  pool: CorePool,
  sessionValue: ExperienceGuideLifecycleVerifiedSessionV1,
): CorePool {
  const session = verifiedSessionSchema.parse(sessionValue);
  return {
    async connect() {
      const client = await pool.connect();
      let released = false;
      let transactionOpen = false;
      try {
        // A healthy pool never returns an open transaction. ROLLBACK is still
        // intentionally idempotent here so a contaminated checkout is clean
        // before any server-owned identity is attached.
        await client.query('rollback');
        await scrubConnectionIdentity(client);
      } catch (error) {
        client.release(true);
        throw error;
      }

      const wrapped = Object.create(client) as PoolClient;
      wrapped.query = (async (text: unknown, values?: unknown[]) => {
        if (typeof text !== 'string') throw new Error('ce_guide_lifecycle_text_query_required');
        const normalized = text.trim().toLowerCase();
        const result = await client.query(text, values);
        if (normalized.startsWith('begin')) {
          transactionOpen = true;
          await client.query('set local role cladora_rpc_owner');
          await client.query(identitySettingsSql, [
            claimsFor(session), session.actor_id, session.assurance_level, 'authenticated',
          ]);
        } else if (normalized === 'commit' || normalized === 'rollback') {
          transactionOpen = false;
          await scrubConnectionIdentity(client);
        }
        return result;
      }) as PoolClient['query'];
      wrapped.release = (error?: Error | boolean) => {
        if (released) return;
        released = true;
        client.release(error || transactionOpen ? true : undefined);
      };
      return wrapped;
    },
  } as CorePool;
}

function stableUuid(label: 'transaction' | 'command', request: ExperienceGuideLifecycleHttpRequestV1,
  actorId: string) {
  const bytes = createHash('sha256').update([
    'ce-guide-lifecycle-http.v1', label, request.context_id, request.workspace_id,
    request.guide_id, request.operation, actorId, request.idempotency_key,
  ].join(':')).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableFingerprint(request: ExperienceGuideLifecycleHttpRequestV1, actorId: string,
  authorityVersion: number, sourceIds: string[]) {
  return `ceg1:${createHash('sha256').update(JSON.stringify({
    ...request, actor_id: actorId, authority_version: authorityVersion,
    provider_source_ids: sourceIds,
  })).digest('hex')}`;
}

export function buildExperienceGuideLifecycleCoreCommandV1(
  requestValue: unknown,
  trusted: Readonly<{
    actor_id: string;
    authority_version: number;
    provider_source_ids: string[];
  }>,
): CoreTransactionCommandV2 {
  const request = experienceGuideLifecycleHttpRequestV1Schema.parse(requestValue);
  const actorId = uuid.parse(trusted.actor_id);
  const authorityVersion = safeVersion.parse(trusted.authority_version);
  if (request.expected_version >= Number.MAX_SAFE_INTEGER) {
    throw new Error('ce_guide_lifecycle_version_overflow');
  }
  const candidates = z.array(uuid).max(32).parse(trusted.provider_source_ids);
  const referenceIds = Array.from(new Set(candidates.filter(value => value !== request.guide_id))).sort();
  const providerSourceIds = [request.guide_id, ...referenceIds];
  if (request.operation === 'unpublish' && providerSourceIds.length !== 1) {
    throw new Error('ce_guide_unpublish_must_be_target_free');
  }
  const purpose = `experience.guide.${request.operation}`;
  return {
    contract_version: 'core-transaction-command.v2',
    transaction_id: stableUuid('transaction', request, actorId),
    command_id: stableUuid('command', request, actorId),
    context_id: request.context_id,
    workspace_id: request.workspace_id,
    actor_id: actorId,
    authority_version: authorityVersion,
    permission_code: 'experience.guide.manage',
    module_code: 'experience_guides',
    evaluation_purpose: purpose,
    aggregate_type: 'experience_guide',
    aggregate_id: request.guide_id,
    aggregate_version: request.expected_version + 1,
    provider_source_ids: providerSourceIds,
    idempotency_key: request.idempotency_key,
    input_fingerprint: stableFingerprint(
      request, actorId, authorityVersion, providerSourceIds,
    ),
    subject_reference: {
      kind: 'experience.guide',
      id: request.guide_id,
      version: request.expected_version,
      relation: request.operation,
      request_version: 1,
    },
  };
}

/** Direct composition only; every durable effect still belongs to Core. */
export function createExperienceGuideLifecycleCoreProvidersV1(): CoreTransactionProvidersV2 {
  return {
    provider_code: experienceGuideLifecycleProviderCodeV1,
    replay_policy: experienceGuideLifecycleReplayPolicyV1,
    resolveAuthority,
    validateProviders: validateExperienceGuideLifecycleV1,
    validateReplay: validateExperienceGuideLifecycleReplayV1,
    mutate: mutateExperienceGuideLifecycleV1,
  };
}

export function experienceGuideLifecycleHttpResponseV1(
  result: CoreTransactionResultV2,
): Response {
  if (result.status === 'committed' || result.status === 'exact_replay') {
    return json(200, {
      outcome: result.status,
      receipt_id: result.receipt.receipt_id,
      guide_version: result.receipt.aggregate_version,
    });
  }
  if (result.status === 'unknown_commit') {
    return json(202, { outcome: 'pending', code: 'READBACK_REQUIRED' });
  }
  if ('code' in result && result.code === 'REPLAY_CONFLICT') {
    return bounded(409, 'IDEMPOTENCY_CONFLICT');
  }
  if ('code' in result && result.code === 'INVALID_COMMAND') {
    return bounded(400, 'INVALID_REQUEST');
  }
  if ('code' in result && result.code === 'TRANSACTION_FAILED') {
    return bounded(503, 'TRANSACTION_FAILED');
  }
  return bounded(403, 'GUIDE_LIFECYCLE_DENIED');
}

async function readSourceLockCandidate(
  pool: CorePool,
  session: ExperienceGuideLifecycleVerifiedSessionV1,
  request: ExperienceGuideLifecycleHttpRequestV1,
): Promise<SourceLockCandidate | null> {
  const client = await createExperienceGuideLifecycleRequestPoolV1(pool, session).connect();
  let ended = false;
  try {
    await client.query('begin isolation level serializable read only');
    const guide = await client.query<{
      content_version: string;
      authority_version: string;
      actor_bound: boolean;
      aal2: boolean;
    }>(`select g.content_version::text,r.revision::text as authority_version,
        auth.uid()=$4::uuid as actor_bound,auth.jwt()->>'aal'='aal2' as aal2
      from experience.guides g
      join platform.customer_workspaces w
        on w.id=g.workspace_id and w.tenant_id=g.tenant_id
        and w.archived_at is null and w.lifecycle_status='ACTIVE'
      cross join app_private.canonical_authority_revision_v1 r
      where g.id=$1 and g.workspace_id=$2
        and exists(select 1 from identity.context_grants c
          join identity.memberships m on m.id=c.membership_id and m.tenant_id=c.tenant_id
          where c.id=$3 and m.user_id=$4 and m.tenant_id=g.tenant_id)
      for share of g`, [request.guide_id, request.workspace_id, request.context_id, session.actor_id]);
    const row = guide.rows[0];
    const authorityVersion = Number(row?.authority_version);
    const contentVersion = Number(row?.content_version);
    if (guide.rowCount !== 1 || row.actor_bound !== true || row.aal2 !== true
      || !Number.isSafeInteger(authorityVersion) || authorityVersion < 1
      || !Number.isSafeInteger(contentVersion) || contentVersion < 1) {
      await client.query('rollback');
      ended = true;
      return null;
    }

    let sourceIds = [request.guide_id];
    if (request.operation === 'publish') {
      const references = await client.query<{ document_id: string; document_version_id: string }>(
        `select r.target_id::text as document_id,r.document_version_id::text
          from experience.guide_references r
          join experience.guide_steps s
            on s.id=r.step_id and s.tenant_id=r.tenant_id
            and s.workspace_id=r.workspace_id and s.guide_id=r.guide_id
            and s.guide_version=r.guide_version
          where r.guide_id=$1 and r.workspace_id=$2 and r.guide_version=$3
          order by s.position,r.position,r.id`,
        [request.guide_id, request.workspace_id, contentVersion],
      );
      const targetIds = references.rows.flatMap(reference => [
        reference.document_id, reference.document_version_id,
      ]);
      sourceIds = [request.guide_id, ...Array.from(new Set(targetIds)).sort()];
    }
    await client.query('rollback');
    ended = true;
    if (sourceIds.length > 32) return null;
    return { authority_version: authorityVersion, provider_source_ids: sourceIds };
  } catch (error) {
    if (!ended) await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release(ended ? undefined : true);
  }
}

async function strictBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 16_384)) return null;
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return null;
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > 16_384) return null;
  try {
    return experienceGuideLifecycleHttpRequestV1Schema.safeParse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Inactive server-only handler. No production route imports this module. */
export async function handleExperienceGuideLifecycleHttpV1(
  request: Request,
  dependencies: ExperienceGuideLifecycleHttpDependenciesV1,
): Promise<Response> {
  if (request.method !== 'POST') return bounded(405, 'METHOD_NOT_ALLOWED');
  if (!hasTrustedMutationOrigin(request)) return bounded(403, 'ORIGIN_DENIED');
  if (new URL(request.url).search !== '') return bounded(400, 'INVALID_REQUEST');
  const parsedBody = await strictBody(request);
  if (!parsedBody?.success) return bounded(400, 'INVALID_REQUEST');

  const sessionResult = verifiedSessionSchema.safeParse(await dependencies.authenticate(request));
  if (!sessionResult.success || sessionResult.data.expires_at <= Math.floor(
    (dependencies.now?.() ?? Date.now()) / 1000,
  )) return bounded(401, 'AUTHENTICATION_REQUIRED');
  const session = sessionResult.data;
  if (session.assurance_level !== 'aal2') return bounded(403, 'AAL2_REQUIRED');

  let candidate: SourceLockCandidate | null;
  try {
    candidate = await readSourceLockCandidate(dependencies.pool, session, parsedBody.data);
  } catch {
    return bounded(503, 'GUIDE_RUNTIME_UNAVAILABLE');
  }
  if (candidate === null) return bounded(403, 'GUIDE_LIFECYCLE_DENIED');

  let command: CoreTransactionCommandV2;
  try {
    command = buildExperienceGuideLifecycleCoreCommandV1(parsedBody.data, {
      actor_id: session.actor_id,
      authority_version: candidate.authority_version,
      provider_source_ids: candidate.provider_source_ids,
    });
  } catch {
    return bounded(503, 'GUIDE_RUNTIME_UNAVAILABLE');
  }

  const host = createCorePostgresTransactionHostV1(
    createExperienceGuideLifecycleRequestPoolV1(dependencies.pool, session),
  );
  const result = await host.execute(command, createExperienceGuideLifecycleCoreProvidersV1());
  return experienceGuideLifecycleHttpResponseV1(result);
}
