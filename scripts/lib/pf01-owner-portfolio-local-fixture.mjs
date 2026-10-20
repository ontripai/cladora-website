import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import {
  assertDisposableNonProductionTarget,
  generateTotp,
} from './ap10-auth-e2e-fixture.mjs';
import {
  assertMatchingDisposableIdentity,
  inspectLocalDisposableStack,
  readLocalProjectRef,
  targetUrlIdentity,
} from './ap10-target-identity.mjs';

export const PF01_LOCAL_FIXTURE_VERSION = 'pf01-owner-portfolio-local-http-fixture.v1';
export const PF01_PRODUCTION_PROJECT_REF_HASH = '4bcbe70e4d2cef78506e6317e7fc90adb62b94ea18a17b0e8e866eacdd69da03';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const OWNER_ONE_PLACEHOLDER = 'f1010000-0000-4000-8000-000000000001';
const OWNER_TWO_PLACEHOLDER = 'f1010000-0000-4000-8000-000000000002';
const FIXTURE_IDS = Object.freeze({
  workspaceOne: 'f1010000-0000-4000-8000-000000000061',
  workspaceTwo: 'f1010000-0000-4000-8000-000000000062',
  expiredWorkspace: 'f1010000-0000-4000-8000-000000000063',
  context: 'f1010000-0000-4000-8000-000000000092',
  unitOne: 'f1010000-0000-4000-8000-000000000051',
  unitTwo: 'f1010000-0000-4000-8000-000000000052',
  crossTenantUnit: 'f1010000-0000-4000-8000-000000000054',
  privateUnitOne: 'f1010000-0000-4000-8000-0000000000b1',
  privateUnitOther: 'f1010000-0000-4000-8000-0000000000b4',
  managementAuthorityOne: 'f1010000-0000-4000-8000-0000000000e1',
});

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name}_required`);
  return value.trim();
}

function parsedUrl(value, name, protocols) {
  let url;
  try { url = new URL(required(value, name)); }
  catch { throw new Error(`${name}_invalid`); }
  if (!protocols.has(url.protocol) || url.search || url.hash) throw new Error(`${name}_invalid`);
  return url;
}

function assertLoopback(value, name, protocols) {
  const url = parsedUrl(value, name, protocols);
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error(`${name}_must_be_loopback`);
  return url;
}

function keyHashProof(value) {
  // The canonical AP10 identity verifier owns key hashing. A fake proof should
  // never be manufactured here; this function only documents non-disclosure.
  if (typeof value !== 'string' || value.length < 16) throw new Error('local_key_invalid');
  return true;
}

const sha256 = value => createHash('sha256').update(value).digest('hex');

export function assertPf01LocalExecutionInputs({
  target,
  ephemeralOptIn,
  realAuthOptIn,
  appOrigin,
  supabaseUrl,
  databaseUrl,
  projectRef,
  productionProjectRefHash = PF01_PRODUCTION_PROJECT_REF_HASH,
  anonKey,
  serviceRoleKey,
}) {
  if (ephemeralOptIn !== '1') throw new Error('pf01_ephemeral_opt_in_required');
  if (realAuthOptIn !== '1') throw new Error('pf01_real_auth_opt_in_required');
  if (target !== 'local') throw new Error('pf01_local_target_required');

  const normalizedProjectRef = required(projectRef, 'project_ref').toLowerCase();
  const forbiddenProjectHash = required(productionProjectRefHash, 'production_project_ref_hash').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(forbiddenProjectHash)) throw new Error('production_project_ref_hash_invalid');
  if (sha256(normalizedProjectRef) === forbiddenProjectHash) throw new Error('production_project_prohibited');

  const app = assertLoopback(appOrigin, 'app_origin', new Set(['http:']));
  const api = assertLoopback(supabaseUrl, 'supabase_url', new Set(['http:', 'https:']));
  const database = assertLoopback(databaseUrl, 'database_url', new Set(['postgres:', 'postgresql:']));
  if (api.username || api.password || database.search || database.hash) {
    throw new Error('local_target_url_invalid');
  }
  keyHashProof(anonKey);
  keyHashProof(serviceRoleKey);

  assertDisposableNonProductionTarget({
    target,
    supabaseUrl,
    projectRef: normalizedProjectRef,
    productionProjectRef: 'production-reference-withheld',
    disposableDatabase: true,
  });

  return Object.freeze({
    target,
    appOrigin: app.origin,
    authTarget: `${api.origin}${api.pathname.replace(/\/$/, '')}`,
    databaseTarget: targetUrlIdentity(databaseUrl, 'database'),
    projectRef: normalizedProjectRef,
  });
}

async function inspectConnectedDatabase(pool) {
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    const result = await client.query(`select current_database() as database_name,
      current_setting('transaction_read_only') as transaction_read_only`);
    if (result.rowCount !== 1) throw new Error('database_identity_unavailable');
    return Object.freeze({
      connectedDatabase: result.rows[0].database_name,
      transactionReadOnly: result.rows[0].transaction_read_only,
    });
  } catch {
    throw new Error('database_identity_unavailable');
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

export async function verifyPf01LocalTarget({
  pool,
  adminClient,
  actorClient,
  inspectStack = inspectLocalDisposableStack,
  ...inputs
}) {
  if (!pool?.connect) throw new Error('postgres_pool_required');
  const staticIdentity = assertPf01LocalExecutionInputs(inputs);
  const stackProof = await inspectStack(staticIdentity.target);
  if (stackProof.projectRef !== staticIdentity.projectRef) {
    throw new Error('local_project_identity_mismatch');
  }
  if (sha256(stackProof.projectRef) === PF01_PRODUCTION_PROJECT_REF_HASH) {
    throw new Error('production_project_prohibited');
  }
  const databaseProof = await inspectConnectedDatabase(pool);
  const proof = Object.freeze({ ...stackProof, ...databaseProof });
  assertMatchingDisposableIdentity({
    target: staticIdentity.target,
    projectRef: staticIdentity.projectRef,
    supabaseUrl: inputs.supabaseUrl,
    databaseUrl: inputs.databaseUrl,
    adminClient,
    actorClient,
    proof,
  });
  return Object.freeze({
    source: proof.source,
    environment: proof.environment,
    projectRef: proof.projectRef,
    appOrigin: staticIdentity.appOrigin,
    authTarget: proof.authTarget,
    databaseTarget: proof.databaseTarget,
    connectedDatabase: proof.connectedDatabase,
    transactionReadOnly: proof.transactionReadOnly,
  });
}

export async function withVerifiedPf01LocalTarget(options, execute) {
  if (typeof execute !== 'function') throw new Error('verified_execution_callback_required');
  const identity = await verifyPf01LocalTarget(options);
  return execute(identity);
}

async function must(result, operation) {
  if (result?.error) throw new Error(`${operation}_failed`, { cause: result.error });
  return result?.data;
}

async function sessionCookie(supabaseUrl, anonKey, accessToken, refreshToken) {
  const jar = new Map();
  const client = createServerClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await must(await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }), 'cookie_session_install');
  if (jar.size === 0) throw new Error('session_cookie_missing');
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function createPf01Aal2User({ adminClient, supabaseUrl, anonKey, label }) {
  const safeLabel = required(label, 'fixture_label').toLowerCase().replaceAll(/[^a-z0-9]/g, '').slice(0, 24);
  const email = `pf01-${safeLabel}-${randomUUID()}@fixture.invalid`;
  let password = `Pf01!${randomBytes(32).toString('base64url')}`;
  let userId = null;
  let factorId = null;
  let accessToken = null;
  let sessionRevoked = false;
  const actorClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  try {
    const created = await must(await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        fixture: PF01_LOCAL_FIXTURE_VERSION,
        disposable: true,
      },
    }), 'fixture_user_create');
    userId = created.user?.id ?? null;
    if (!userId) throw new Error('fixture_user_id_missing');

    const signedIn = await must(await actorClient.auth.signInWithPassword({ email, password }), 'fixture_sign_in');
    if (!signedIn.session?.access_token) throw new Error('fixture_aal1_session_missing');
    const enrolled = await must(await actorClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `PF01 ${safeLabel}`,
    }), 'fixture_mfa_enroll');
    factorId = enrolled.id;
    let totpSecret = enrolled.totp?.secret;
    if (!factorId || !totpSecret) throw new Error('fixture_totp_missing');
    const verified = await must(await actorClient.auth.mfa.challengeAndVerify({
      factorId,
      code: generateTotp(totpSecret),
    }), 'fixture_mfa_verify');
    totpSecret = null;
    accessToken = verified.access_token;
    if (!accessToken || !verified.refresh_token) throw new Error('fixture_aal2_session_missing');
    const assurance = await must(
      await actorClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken),
      'fixture_aal_inspect',
    );
    assert.equal(assurance.currentLevel, 'aal2');
    const cookie = await sessionCookie(supabaseUrl, anonKey, accessToken, verified.refresh_token);

    return Object.freeze({
      userId,
      email,
      accessToken,
      cookie,
      async revokeSession() {
        if (factorId) {
          await must(await actorClient.auth.mfa.unenroll({ factorId }), 'fixture_mfa_unenroll');
          factorId = null;
        }
        if (accessToken && !sessionRevoked) {
          await must(await adminClient.auth.admin.signOut(accessToken, 'global'), 'fixture_global_sign_out');
          sessionRevoked = true;
        }
      },
      async cleanup() {
        const errors = [];
        if (factorId) {
          try { await must(await actorClient.auth.mfa.unenroll({ factorId }), 'fixture_mfa_unenroll'); }
          catch (error) { errors.push(error); }
        }
        if (accessToken && !sessionRevoked) {
          try {
            await must(await adminClient.auth.admin.signOut(accessToken, 'global'), 'fixture_global_sign_out');
            sessionRevoked = true;
          }
          catch (error) { errors.push(error); }
        }
        try { await actorClient.auth.signOut({ scope: 'local' }); }
        catch (error) { errors.push(error); }
        if (userId) {
          try { await must(await adminClient.auth.admin.deleteUser(userId, true), 'fixture_user_soft_delete'); }
          catch (error) { errors.push(error); }
        }
        password = null;
        accessToken = null;
        if (errors.length) throw new AggregateError(errors, 'pf01_auth_cleanup_failed');
      },
    });
  } catch (error) {
    if (userId) await adminClient.auth.admin.deleteUser(userId, true).catch(() => {});
    password = null;
    accessToken = null;
    throw error;
  }
}

async function canonicalFixtureSql(ownerUserId, otherUserId, ownerEmail, otherEmail) {
  const source = await readFile(
    new URL('../../supabase/tests/204_pf01_owner_portfolio_projection_v1.test.sql', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('insert into platform.tenants');
  const end = source.indexOf('select throws_ok(', start);
  if (start < 0 || end < 0 || end <= start) throw new Error('canonical_pf01_fixture_boundary_missing');
  return source.slice(start, end)
    .replaceAll(OWNER_ONE_PLACEHOLDER, ownerUserId)
    .replaceAll(OWNER_TWO_PLACEHOLDER, otherUserId)
    .replaceAll('pf01-owner@cladora.test', ownerEmail)
    .replaceAll('pf01-other@cladora.test', otherEmail);
}

export async function createPf01DatabaseFixture(pool, {
  ownerUserId,
  otherUserId,
  ownerEmail,
  otherEmail,
}) {
  const sql = await canonicalFixtureSql(ownerUserId, otherUserId, ownerEmail, otherEmail);
  const otherTenantId = randomUUID();
  const otherMembershipId = randomUUID();
  const otherInvitationId = randomUUID();
  const leaseId = randomUUID();
  const cashId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(`insert into platform.tenants(id,legal_name,registration_number,status)
      values($1,'PF01 other owner personal','PF01-OTHER-' || left($1::text,8),'active')`, [otherTenantId]);
    await client.query(`insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
      select $1,$2,$3,r.id,'active',statement_timestamp()-interval '1 day'
      from identity.roles r where r.tenant_id is null and r.code='multi_unit_owner'`, [
      otherMembershipId, otherTenantId, otherUserId,
    ]);
    await client.query(`insert into communications.unit_invitations(
      id,tenant_id,workspace_id,unit_id,party_id,normalized_email,role_code,status,
      invited_by,inviter_context_id,accepted_by,accepted_at,owner_portfolio_requested
    ) values($1,$2,$3,$4,$5,$6,'owner','accepted',$7,$8,$9,statement_timestamp(),true)`, [
      otherInvitationId,
      'f1010000-0000-4000-8000-000000000020',
      FIXTURE_IDS.workspaceOne,
      FIXTURE_IDS.unitOne,
      'f1010000-0000-4000-8000-000000000071',
      otherEmail,
      ownerUserId,
      FIXTURE_IDS.context,
      otherUserId,
    ]);
    await client.query(`insert into platform.invited_owner_portfolios(owner_user_id,tenant_id,membership_id)
      values($1,$2,$3)`, [otherUserId, otherTenantId, otherMembershipId]);
    await client.query(`insert into platform.invited_owner_units(
      invitation_id,owner_user_id,private_unit_id,canonical_unit_id,ownership_party_id
    ) values($1,$2,$3,$4,$5)`, [
      otherInvitationId,
      otherUserId,
      FIXTURE_IDS.privateUnitOther,
      FIXTURE_IDS.unitOne,
      'f1010000-0000-4000-8000-000000000071',
    ]);
    await client.query(`insert into public.owner_private_leases(
      id,owner_user_id,unit_id,tenant_label,starts_on,monthly_rent,currency,status
    ) values($1,$2,$3,'PF01 private lease must not leak',current_date-30,1234.56,'EUR','active')`, [
      leaseId, ownerUserId, FIXTURE_IDS.privateUnitOne,
    ]);
    await client.query(`insert into public.owner_private_cash_entries(
      id,owner_user_id,unit_id,kind,direction,amount,currency,due_on,memo
    ) values($1,$2,$3,'rent','income',1234.56,'EUR',current_date,'PF01 private cash must not leak')`, [
      cashId, ownerUserId, FIXTURE_IDS.privateUnitOne,
    ]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return Object.freeze({
    ...FIXTURE_IDS,
    otherTenantId,
    otherMembershipId,
    otherInvitationId,
    leaseId,
    cashId,
  });
}

export async function snapshotPf01ReadState(pool) {
  const result = await pool.query(`select
    (select count(*)::int from platform.owner_unit_links) as owner_unit_links,
    (select count(*)::int from portfolio.ownerships) as ownerships,
    (select count(*)::int from public.owner_private_units) as private_units,
    (select count(*)::int from public.owner_private_leases) as private_leases,
    (select count(*)::int from public.owner_private_cash_entries) as private_cash,
    (select count(*)::int from platform.idempotency_keys) as idempotency_keys,
    (select count(*)::int from audit.events) as audit_events,
    (select count(*)::int from platform.outbox_events) as outbox_events`);
  if (result.rowCount !== 1) throw new Error('pf01_state_snapshot_unavailable');
  return Object.freeze(result.rows[0]);
}

export async function revokePf01ManagementAuthority(pool, ownerUserId) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const revoked = await client.query(`update platform.workspace_property_authorities
      set status='revoked',revoked_at=statement_timestamp(),valid_to=statement_timestamp(),
        revocation_reason='PF01 local HTTP management revoke'
      where id=$1 and status='active'`, [FIXTURE_IDS.managementAuthorityOne]);
    if (revoked.rowCount !== 1) throw new Error('pf01_management_authority_not_revoked');
    const preserved = await client.query(`select
      (select count(*)::int from portfolio.ownerships where party_id=$1 and valid_to is null) as ownerships,
      (select count(*)::int from public.owner_private_units where owner_user_id=$2) as private_units`, [
      'f1010000-0000-4000-8000-000000000071', ownerUserId,
    ]);
    await client.query('commit');
    return Object.freeze(preserved.rows[0]);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function revokePf01CurrentAuthority(pool, ownerUserId) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`update identity.context_grants set ends_at=statement_timestamp()
      where membership_id in (select id from identity.memberships where user_id=$1)
        and (ends_at is null or ends_at>statement_timestamp())`, [ownerUserId]);
    await client.query(`update identity.memberships set status='revoked',ends_at=statement_timestamp()
      where user_id=$1 and status='active'`, [ownerUserId]);
    await client.query(`update platform.owner_unit_links
      set status='revoked',revoked_by=$1,revoked_at=statement_timestamp(),
        revoke_reason='PF01 local HTTP cleanup revoke'
      where owner_user_id=$1 and status='linked'`, [ownerUserId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function localProjectRef() {
  return readLocalProjectRef();
}
