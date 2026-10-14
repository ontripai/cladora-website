import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { createCorePostgresTransactionHostV1 } from '../core/postgres-transaction-host-v1';
import { hasTrustedMutationOrigin } from '../security/same-origin';
import { createClient } from '../supabase/server';
import { serviceCollaborationIntentV1Schema } from './service-collaboration-v14-schema';
import {
  buildServiceSubjectLinkCoreCommandV1,
  createServiceSubjectLinkCoreProvidersV1,
} from './service-request-subject-link-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const verifiedSessionSchema = z.strictObject({
  source: z.literal('supabase_verified_session'),
  actor_id: uuid,
  assurance_level: z.enum(['aal1', 'aal2']),
  expires_at: z.number().int().positive().safe(),
});

export type ServiceSubjectLinkVerifiedSessionV1 = z.infer<typeof verifiedSessionSchema>;
export type ServiceSubjectLinkAuthenticationV1 = (
  request: Request,
) => Promise<ServiceSubjectLinkVerifiedSessionV1 | null>;

type CorePool = Pick<Pool, 'connect'>;

export interface ServiceSubjectLinkHttpDependenciesV1 {
  readonly pool: CorePool;
  readonly authenticate: ServiceSubjectLinkAuthenticationV1;
  readonly now?: () => number;
}

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

/**
 * Existing Supabase SSR authentication boundary. getUser verifies the token;
 * user metadata and request-provided actor/AAL values are never consulted.
 */
export async function authenticateServiceSubjectLinkServerSessionV1(
  _request: Request,
): Promise<ServiceSubjectLinkVerifiedSessionV1 | null> {
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
    || (currentLevel !== 'aal1' && currentLevel !== 'aal2')) {
    return null;
  }
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
  set_config('request.jwt.claim.aal',$3,true) as assurance`;
const clearIdentitySettingsSql = `select
  set_config('request.jwt.claims','',false),
  set_config('request.jwt.claim.sub','',false),
  set_config('request.jwt.claim.aal','',false)`;

async function scrubConnectionIdentity(client: PoolClient) {
  await client.query('reset role');
  await client.query(clearIdentitySettingsSql);
}

function claimsFor(session: ServiceSubjectLinkVerifiedSessionV1) {
  return JSON.stringify({
    sub: session.actor_id,
    role: 'authenticated',
    aal: session.assurance_level,
  });
}

function stableCommandId(label: 'transaction' | 'command', workspaceId: string,
  actorId: string, idempotencyKey: string) {
  const bytes = createHash('sha256').update([
    'service-subject-link-http.v1', label, workspaceId, actorId, idempotencyKey,
  ].join(':')).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Request-scoped adapter for the existing Core host. It installs only verified
 * identity as SET LOCAL state after the host starts each transaction. Settings
 * are scrubbed on checkout and after every commit/rollback, so a recycled pool
 * connection cannot retain another request's actor or AAL.
 */
export function createServiceSubjectLinkRequestPoolV1(
  pool: CorePool,
  sessionValue: ServiceSubjectLinkVerifiedSessionV1,
): CorePool {
  const session = verifiedSessionSchema.parse(sessionValue);
  return {
    async connect() {
      const client = await pool.connect();
      let released = false;
      let transactionOpen = false;
      try {
        await scrubConnectionIdentity(client);
      } catch (error) {
        client.release(true);
        throw error;
      }

      const wrapped = Object.create(client) as PoolClient;
      wrapped.query = (async (text: unknown, values?: unknown[]) => {
        if (typeof text !== 'string') {
          throw new Error('service_subject_link_text_query_required');
        }
        const normalized = text.trim().toLowerCase();
        const result = await client.query(text, values);
        if (normalized.startsWith('begin')) {
          transactionOpen = true;
          await client.query(identitySettingsSql, [
            claimsFor(session), session.actor_id, session.assurance_level,
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

export async function readServiceSubjectLinkAuthorityVersionV1(
  pool: CorePool,
  sessionValue: ServiceSubjectLinkVerifiedSessionV1,
) {
  const session = verifiedSessionSchema.parse(sessionValue);
  const client = await createServiceSubjectLinkRequestPoolV1(pool, session).connect();
  let ended = false;
  try {
    await client.query('begin isolation level serializable');
    const result = await client.query<{ revision: string; actor_id: string | null }>(`select
      revision::text, auth.uid()::text as actor_id
      from app_private.canonical_authority_revision_v1 where singleton for share`);
    const authorityVersion = Number(result.rows[0]?.revision);
    if (result.rowCount !== 1 || result.rows[0]?.actor_id !== session.actor_id
      || !Number.isSafeInteger(authorityVersion) || authorityVersion < 1) {
      throw new Error('service_subject_link_authority_unavailable');
    }
    await client.query('rollback');
    ended = true;
    return authorityVersion;
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
    return serviceCollaborationIntentV1Schema.safeParse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Inactive handler: it is exported for an isolated loopback application only. */
export async function handleServiceSubjectLinkHttpV1(
  request: Request,
  pathRequestId: string,
  dependencies: ServiceSubjectLinkHttpDependenciesV1,
): Promise<Response> {
  if (request.method !== 'POST') return bounded(405, 'METHOD_NOT_ALLOWED');
  if (!hasTrustedMutationOrigin(request)) return bounded(403, 'ORIGIN_DENIED');
  const url = new URL(request.url);
  if (url.search !== '') return bounded(400, 'INVALID_REQUEST');
  const pathId = uuid.safeParse(pathRequestId);
  const parsedBody = await strictBody(request);
  if (!pathId.success || !parsedBody?.success
    || parsedBody.data.service_request_id !== pathId.data
    || parsedBody.data.reference_kind !== 'message'
    || parsedBody.data.relation !== 'conversation') {
    return bounded(400, 'INVALID_REQUEST');
  }

  const sessionResult = verifiedSessionSchema.safeParse(await dependencies.authenticate(request));
  if (!sessionResult.success || sessionResult.data.expires_at <= Math.floor((dependencies.now?.()
    ?? Date.now()) / 1000)) {
    return bounded(401, 'AUTHENTICATION_REQUIRED');
  }
  const session = sessionResult.data;
  if (session.assurance_level !== 'aal2') return bounded(403, 'AAL2_REQUIRED');

  let authorityVersion: number;
  try {
    authorityVersion = await readServiceSubjectLinkAuthorityVersionV1(dependencies.pool, session);
  } catch {
    return bounded(503, 'AUTHORITY_UNAVAILABLE');
  }

  const command = buildServiceSubjectLinkCoreCommandV1(parsedBody.data, {
    transaction_id: stableCommandId('transaction', parsedBody.data.workspace_id,
      session.actor_id, parsedBody.data.idempotency_key),
    command_id: stableCommandId('command', parsedBody.data.workspace_id,
      session.actor_id, parsedBody.data.idempotency_key),
    actor_id: session.actor_id,
    authority_version: authorityVersion,
  });
  const host = createCorePostgresTransactionHostV1(
    createServiceSubjectLinkRequestPoolV1(dependencies.pool, session),
  );
  const result = await host.execute(command, createServiceSubjectLinkCoreProvidersV1());
  if (result.status === 'committed' || result.status === 'exact_replay') {
    return json(200, {
      outcome: result.status,
      receipt_id: result.receipt.receipt_id,
      request_id: result.receipt.aggregate_id,
      request_version: result.receipt.aggregate_version,
    });
  }
  if (result.status === 'unknown_commit') {
    return json(202, { outcome: 'pending', code: 'READBACK_REQUIRED' });
  }
  if ('code' in result && result.code === 'REPLAY_CONFLICT') {
    return bounded(409, 'IDEMPOTENCY_CONFLICT');
  }
  if ('code' in result && result.code === 'INVALID_COMMAND') return bounded(400, 'INVALID_REQUEST');
  if ('code' in result && result.code === 'TRANSACTION_FAILED') {
    return bounded(503, 'TRANSACTION_FAILED');
  }
  return bounded(403, 'SUBJECT_LINK_DENIED');
}
