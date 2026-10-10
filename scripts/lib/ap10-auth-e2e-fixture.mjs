import { createHmac, randomBytes, randomUUID } from 'node:crypto';

export const AP10_AUTH_FIXTURE_VERSION = 'ap10-auth-e2e-fixture.v1';
export const AP10_SYNTHETIC_MARKER = 'cladora_ap10_synthetic_fixture';

const SAFE_TARGETS = new Set(['local', 'test', 'preview']);
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name}_required`);
  }
  return value.trim();
}

function normalizeProjectRef(value, name) {
  const ref = requiredText(value, name).toLowerCase();
  if (!/^[a-z0-9-]{6,80}$/.test(ref)) throw new Error(`${name}_invalid`);
  return ref;
}

export function assertDisposableNonProductionTarget({
  target,
  supabaseUrl,
  projectRef,
  productionProjectRef,
  disposableDatabase,
}) {
  const normalizedTarget = requiredText(target, 'target').toLowerCase();
  if (!SAFE_TARGETS.has(normalizedTarget)) throw new Error('production_target_prohibited');
  if (disposableDatabase !== true) throw new Error('ephemeral_database_required');

  let url;
  try {
    url = new URL(requiredText(supabaseUrl, 'supabase_url'));
  } catch {
    throw new Error('supabase_url_invalid');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('supabase_url_invalid');

  if (normalizedTarget === 'local') {
    if (!LOCAL_HOSTS.has(url.hostname)) throw new Error('local_target_must_use_loopback');
    return Object.freeze({ target: normalizedTarget, targetRef: 'local', teardownRequired: true });
  }

  if (LOCAL_HOSTS.has(url.hostname)) throw new Error('remote_target_must_not_use_loopback');
  const targetRef = normalizeProjectRef(projectRef, 'project_ref');
  const productionRef = normalizeProjectRef(productionProjectRef, 'production_project_ref');
  if (targetRef === productionRef) throw new Error('production_project_prohibited');
  if (!url.hostname.startsWith(`${targetRef}.`)) throw new Error('project_ref_url_mismatch');
  return Object.freeze({ target: normalizedTarget, targetRef, teardownRequired: true });
}

function decodeBase32(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = requiredText(input, 'totp_secret').toUpperCase().replaceAll('=', '').replaceAll(' ', '');
  let bits = '';
  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('totp_secret_invalid');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotp(secret, timestamp = Date.now(), { digits = 6, periodSeconds = 30 } = {}) {
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('totp_timestamp_invalid');
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) throw new Error('totp_digits_invalid');
  if (!Number.isInteger(periodSeconds) || periodSeconds < 1) throw new Error('totp_period_invalid');
  const counter = Math.floor(timestamp / 1000 / periodSeconds);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** digits)).padStart(digits, '0');
}

function syntheticEmail(runId) {
  const safe = runId.toLowerCase().replaceAll(/[^a-z0-9]/g, '').slice(0, 40);
  return `ap10-${safe}@fixture.invalid`;
}

function syntheticPassword() {
  return `Ap10!${randomBytes(32).toString('base64url')}`;
}

async function must(result, operation) {
  if (result?.error) throw new Error(`${operation}_failed`, { cause: result.error });
  return result?.data;
}

function cleanupError(errors) {
  if (errors.length === 0) return null;
  return new AggregateError(errors, 'ap10_fixture_cleanup_failed');
}

export async function runAp10AuthE2EFixture({
  target,
  supabaseUrl,
  projectRef,
  productionProjectRef,
  disposableDatabase,
  adminClient,
  actorClient,
  authorityDriver,
  execute,
  runId = randomUUID(),
  now = () => Date.now(),
}) {
  const environment = assertDisposableNonProductionTarget({
    target,
    supabaseUrl,
    projectRef,
    productionProjectRef,
    disposableDatabase,
  });
  if (!adminClient?.auth?.admin || !actorClient?.auth?.mfa) throw new Error('supabase_clients_invalid');
  if (!authorityDriver?.setup || !authorityDriver?.assertAllowed
    || !authorityDriver?.revoke || !authorityDriver?.verifyRevoked) {
    throw new Error('authority_driver_invalid');
  }
  if (typeof execute !== 'function') throw new Error('fixture_execute_required');

  const email = syntheticEmail(runId);
  let password = syntheticPassword();
  let userId = null;
  let factorId = null;
  let authority = null;
  let session = null;
  let primaryError = null;
  const cleanupErrors = [];

  try {
    const created = await must(await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        fixture: AP10_SYNTHETIC_MARKER,
        fixture_version: AP10_AUTH_FIXTURE_VERSION,
        fixture_run_id: runId,
        fixture_target: environment.target,
      },
      user_metadata: { synthetic: true },
    }), 'auth_user_create');
    userId = created?.user?.id;
    if (!userId) throw new Error('auth_user_id_missing');

    const signedIn = await must(await actorClient.auth.signInWithPassword({ email, password }), 'auth_sign_in');
    session = signedIn?.session;
    if (!session?.access_token || session.user?.id !== userId) throw new Error('auth_session_invalid');

    const enrolled = await must(await actorClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `CLADORA AP10 ${runId.slice(0, 8)}`,
    }), 'mfa_enroll');
    factorId = enrolled?.id;
    let totpSecret = enrolled?.totp?.secret;
    if (!factorId || !totpSecret) throw new Error('mfa_enrollment_invalid');

    const verified = await must(await actorClient.auth.mfa.challengeAndVerify({
      factorId,
      code: generateTotp(totpSecret, now()),
    }), 'mfa_verify');
    totpSecret = null;
    if (!verified?.access_token || !verified?.refresh_token) throw new Error('aal2_session_missing');
    const installed = await must(await actorClient.auth.setSession({
      access_token: verified.access_token,
      refresh_token: verified.refresh_token,
    }), 'aal2_session_install');
    session = installed?.session;
    if (!session?.access_token || session.user?.id !== userId) throw new Error('aal2_session_invalid');

    const assurance = await must(
      await actorClient.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token),
      'aal_inspect',
    );
    if (assurance?.currentLevel !== 'aal2' || assurance?.nextLevel !== 'aal2') {
      throw new Error('aal2_not_established');
    }

    authority = await authorityDriver.setup({
      userId,
      runId,
      target: environment.target,
      accessToken: session.access_token,
    });
    if (!authority?.contextId || !Array.isArray(authority.workspaceIds) || authority.workspaceIds.length < 2) {
      throw new Error('authority_fixture_invalid');
    }
    if (await authorityDriver.assertAllowed({ authority, userId, runId }) !== true) {
      throw new Error('authority_fixture_not_effective');
    }

    await execute(Object.freeze({
      client: actorClient,
      accessToken: session.access_token,
      contextId: authority.contextId,
      workspaceIds: Object.freeze([...authority.workspaceIds]),
      propertyIds: Object.freeze([...(authority.propertyIds ?? [])]),
      unitIds: Object.freeze([...(authority.unitIds ?? [])]),
    }));
  } catch (error) {
    primaryError = error;
  } finally {
    if (authority) {
      try {
        await authorityDriver.revoke({ authority, userId, runId });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (factorId) {
      try {
        await must(await actorClient.auth.mfa.unenroll({ factorId }), 'mfa_unenroll');
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (session?.access_token) {
      try {
        await must(await adminClient.auth.admin.signOut(session.access_token, 'global'), 'auth_global_sign_out');
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await must(await actorClient.auth.signOut({ scope: 'local' }), 'auth_local_sign_out');
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (userId) {
      try {
        await must(await adminClient.auth.admin.deleteUser(userId, true), 'auth_user_soft_delete');
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (authority) {
      try {
        const revoked = await authorityDriver.verifyRevoked({ authority, userId, runId });
        if (revoked !== true) throw new Error('authority_cleanup_not_verified');
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    password = null;
    session = null;
  }

  const finalCleanupError = cleanupError(cleanupErrors);
  if (primaryError && finalCleanupError) {
    throw new AggregateError([primaryError, ...cleanupErrors], 'ap10_fixture_execution_and_cleanup_failed');
  }
  if (primaryError) throw primaryError;
  if (finalCleanupError) throw finalCleanupError;

  return Object.freeze({
    fixtureVersion: AP10_AUTH_FIXTURE_VERSION,
    target: environment.target,
    aal2: 'verified',
    authority: 'tested_then_revoked',
    authUser: 'soft_deleted',
    database: 'ephemeral_teardown_required',
    cleanup: 'verified',
    consumer: 'passed',
  });
}
