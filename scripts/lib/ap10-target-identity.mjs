import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const keyHash = (key) => {
  if (typeof key !== 'string' || !key) throw new Error('auth_key_identity_unavailable');
  return createHash('sha256').update(key).digest('hex');
};

export async function readLocalProjectRef() {
  const config = await readFile(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
  const ref = /^project_id\s*=\s*"([a-z0-9-]{6,80})"\s*$/m.exec(config)?.[1];
  if (!ref) throw new Error('local_project_identity_unavailable');
  return ref;
}

export function targetUrlIdentity(value, kind) {
  let url;
  try { url = new URL(value); } catch { throw new Error('target_identity_url_invalid'); }
  if (url.search || url.hash) throw new Error('target_identity_url_invalid');
  if (kind === 'auth') {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('target_identity_url_invalid');
    }
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('database_target_invalid');
  // Passwords never enter the identity proof or diagnostics.
  return JSON.stringify([url.hostname, url.port || '5432', decodeURIComponent(url.pathname.slice(1)), decodeURIComponent(url.username)]);
}

export async function inspectLocalDisposableStack(target) {
  // No remote runner has a trusted provisioning identity source yet. Fail closed
  // rather than treating a target label/project ref as infrastructure proof.
  if (target !== 'local') throw new Error('disposable_target_identity_unavailable');
  const projectRef = await readLocalProjectRef();
  let status;
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '--output', 'json'], {
      cwd: new URL('../../', import.meta.url), timeout: 15_000, maxBuffer: 1024 * 1024,
    });
    status = JSON.parse(stdout);
  } catch { throw new Error('local_stack_identity_unavailable'); }
  if (!status.API_URL || !status.DB_URL) throw new Error('local_stack_identity_unavailable');
  return Object.freeze({
    source: 'supabase_local_stack_status', environment: 'local', projectRef,
    authTarget: targetUrlIdentity(status.API_URL, 'auth'),
    databaseTarget: targetUrlIdentity(status.DB_URL, 'database'),
    adminKeyHash: keyHash(status.SERVICE_ROLE_KEY), actorKeyHash: keyHash(status.ANON_KEY),
  });
}

export function assertMatchingDisposableIdentity({ target, projectRef, supabaseUrl, databaseUrl, adminClient, actorClient, proof }) {
  if (!proof || proof.environment !== target || proof.projectRef !== projectRef
    || proof.source !== 'supabase_local_stack_status' || target !== 'local') {
    throw new Error('disposable_environment_identity_mismatch');
  }
  const authTarget = targetUrlIdentity(supabaseUrl, 'auth');
  if (proof.authTarget !== authTarget) throw new Error('auth_target_identity_mismatch');
  for (const client of [adminClient, actorClient]) {
    if (targetUrlIdentity(client?.supabaseUrl, 'auth') !== authTarget
      || targetUrlIdentity(client?.auth?.url, 'auth') !== `${authTarget}/auth/v1`) {
      throw new Error('auth_client_target_mismatch');
    }
  }
  if (targetUrlIdentity(adminClient.auth.admin?.url, 'auth') !== `${authTarget}/auth/v1`) {
    throw new Error('auth_admin_target_mismatch');
  }
  if (keyHash(adminClient.supabaseKey) !== proof.adminKeyHash
    || keyHash(actorClient.supabaseKey) !== proof.actorKeyHash
    || keyHash(adminClient.auth.admin.headers?.apikey) !== proof.adminKeyHash
    || keyHash(actorClient.auth.headers?.apikey) !== proof.actorKeyHash
    || keyHash(adminClient.auth.admin.headers?.Authorization?.replace(/^Bearer /, '')) !== proof.adminKeyHash) {
    throw new Error('auth_key_target_mismatch');
  }
  if (proof.databaseTarget !== targetUrlIdentity(databaseUrl, 'database')) {
    throw new Error('database_target_identity_mismatch');
  }
  const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (proof.connectedDatabase !== database || proof.transactionReadOnly !== 'on') {
    throw new Error('connected_database_identity_mismatch');
  }
}
