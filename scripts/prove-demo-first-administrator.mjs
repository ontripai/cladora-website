import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { generateTotp } from './lib/ap10-auth-e2e-fixture.mjs';

// Dedicated ephemeral CI only. Credentials come exclusively from the inspected
// candidate's local CLI status, never caller-supplied URLs, keys or DB strings.
const project = 'cladora-demo-candidate';
const database = `supabase_db_${project}`;
const receipt = { kind: 'LOCAL_REAL_AUTH_FIRST_ADMINISTRATOR', result: 'NOT_RUN_NOT_PASS',
  hosted_execution: false, browser_execution: false, customer_onboarding: 'NOT_PROVED',
  s3_s4_g2: 'NOT_INSTALLED_NOT_PROVED', checks: [] };
let receiptPath;
function check(value, name) { assert.ok(value, name); receipt.checks.push(name); }
function command(program, args, input) {
  const env = {...process.env, DOCKER_HOST:'unix:///var/run/docker.sock'};
  for(const name of ['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[name];
  const parameters = program === 'docker' ? ['--host=unix:///var/run/docker.sock',...args] : args;
  const result = spawnSync(program, parameters, { input, env, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  // Never include child stdout/stderr (CLI status contains secrets) in errors.
  if (result.error || result.status !== 0) throw Error('local_command_failed');
  return result.stdout.trim();
}
function sql(input) {
  return command('docker', ['exec', '-i', database, 'psql', '-X', '-q', '-A', '-t',
    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input);
}
function success(result, name) {
  if (result.error || !result.data) throw Error(name);
  return result.data;
}
try {
  check(process.env.GITHUB_ACTIONS === 'true', 'CI-only execution');
  check(process.env.CLADORA_DEMO_FIRST_ADMINISTRATOR_PROOF === '1', 'explicit disposable Auth opt-in');
  check(/^[a-f0-9]{40}$/.test(process.env.CANDIDATE_SOURCE_SHA ?? ''), 'candidate source identity provided');
  check(command('git', ['rev-parse', 'HEAD']) === process.env.CANDIDATE_SOURCE_SHA, 'exact candidate checkout');
  receipt.commit = process.env.CANDIDATE_SOURCE_SHA;
  check(!!process.env.RUNNER_TEMP, 'CI temporary directory provided');
  const runner = realpathSync(process.env.RUNNER_TEMP);
  const directory = realpathSync(join(runner, 'demo-candidate-project'));
  check(directory.startsWith(runner + '/'), 'candidate remains inside CI temporary directory');
  check(/^project_id = "cladora-demo-candidate"$/m.test(readFileSync(join(directory, 'supabase/config.toml'), 'utf8')),
    'exact candidate CLI project');
  receiptPath = join(runner, 'cladora-demo-first-administrator.receipt.json');
  const containers = JSON.parse(command('docker', ['inspect', database, `supabase_auth_${project}`, `supabase_kong_${project}`]));
  check(containers.length === 3 && containers.every(info => info.State.Running
    && info.Config.Labels['com.supabase.cli.project'] === project), 'database Auth and gateway have exact running project label');
  check(containers[0].Name === '/' + database && containers[1].Name === `/supabase_auth_${project}`
    && containers[2].Name === `/supabase_kong_${project}`, 'exact owned container names');
  const status = JSON.parse(command('supabase', ['status', '--workdir', directory, '--output', 'json']));
  const api = new URL(status.API_URL);
  check(api.protocol === 'http:' && api.hostname === '127.0.0.1' && /^\d+$/.test(api.port)
    && api.pathname === '/' && !api.username && !api.password && !api.search && !api.hash, 'CLI Auth URL is strict loopback');
  const bindings = containers[2].NetworkSettings.Ports?.['8000/tcp'] ?? [];
  check(bindings.some(binding => binding.HostPort === api.port
    && ['127.0.0.1', '0.0.0.0'].includes(binding.HostIp)), 'CLI URL port belongs to inspected gateway');
  check(typeof status.ANON_KEY === 'string' && !!status.ANON_KEY
    && typeof status.SERVICE_ROLE_KEY === 'string' && !!status.SERVICE_ROLE_KEY, 'local CLI credentials available');
  const manifest = JSON.parse(readFileSync('supabase/local-profiles/baseline-v14.manifest.json', 'utf8'));
  const held = new Set(['20261018163000', '20261018170000', '20261025214155']);
  const expected = manifest.source_migrations.map(row => row.name.slice(0, 14)).filter(version => !held.has(version));
  const installed = JSON.parse(sql('select jsonb_agg(version order by version) from supabase_migrations.schema_migrations;'));
  check(expected.length === 297 && JSON.stringify(installed) === JSON.stringify(expected), 'exact reduced 297 history with holds absent');
  const localFetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== api.origin) throw Error('nonlocal_auth_request_refused');
    return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  };
  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }, global: { fetch: localFetch } };
  const admin = createClient(api.origin, status.SERVICE_ROLE_KEY, options);
  const actor = createClient(api.origin, status.ANON_KEY, options);
  const run = randomUUID();
  const email = `first-admin-${run}@example.invalid`;
  const password = randomBytes(32).toString('base64url') + 'aA1!';
  const created = success(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    app_metadata: { cladora_disposable_first_admin: true } }), 'local_auth_creation_failed');
  const id = created.user?.id;
  check(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id ?? ''), 'real GoTrue-created UUID');
  const verified = success(await admin.auth.admin.getUserById(id), 'local_auth_readback_failed');
  check(verified.user.email === email && !!verified.user.email_confirmed_at, 'managed Auth verified synthetic identity');
  const signed = success(await actor.auth.signInWithPassword({ email, password }), 'local_password_signin_failed');
  check(signed.user.id === id && !!signed.session, 'real password session');
  check(success(await actor.auth.mfa.getAuthenticatorAssuranceLevel(), 'aal1_read_failed').currentLevel === 'aal1', 'password session starts at AAL1');
  // UUID and run are generated/validated locally, not arbitrary SQL inputs.
  // Only the two application control-plane rows are owner fixtures. Auth,
  // identity membership/Context, lifecycle and access-basis are not seeded.
  sql(`begin;
    lock table platform.platform_users, platform.platform_role_assignments in exclusive mode;
    do $fixture$ begin
      if exists(select 1 from platform.platform_users) then raise exception 'first_admin_fixture_requires_empty_platform'; end if;
      if not exists(select 1 from auth.users where id='${id}'::uuid and email='${email}' and email_confirmed_at is not null)
        then raise exception 'verified_managed_identity_required'; end if;
    end $fixture$;
    with operator as (
      insert into platform.platform_users(auth_user_id,employee_ref,display_name,status)
      values('${id}'::uuid,'DEMO-CI-${run}','Disposable CI first administrator','active') returning id
    ) insert into platform.platform_role_assignments(platform_user_id,role,granted_by,grant_reason)
      select id,'PLATFORM_SUPER_ADMIN','${id}'::uuid,'Explicit one-time owner fixture in isolated demo candidate CI' from operator;
    commit;`);
  check(sql(`select count(*) from platform.platform_users u join platform.platform_role_assignments r
    on r.platform_user_id=u.id where u.auth_user_id='${id}'::uuid and u.status='active'
    and r.role='PLATFORM_SUPER_ADMIN' and r.status='active';`) === '1', 'narrow owner fixture linked to real verified Auth UUID');
  const denied = await actor.schema('customer_api').rpc('get_my_platform_auth_context_v1');
  check(denied.error?.code === '42501', 'canonical platform context denies real AAL1 token');
  const pilotArgs = { p_legal_name: `Disposable CI pilot ${run}`, p_registration_number: '',
    p_default_locale: 'en', p_commercial_owner: 'Disposable CI owner' };
  check((await actor.schema('customer_api').rpc('create_pilot_workspace_v1', pilotArgs)).error?.code === '42501',
    'canonical pilot mutation denies real AAL1 token');
  const factor = success(await actor.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Disposable CI TOTP' }), 'totp_enrollment_failed');
  check(factor.type === 'totp' && !!factor.totp?.secret, 'real GoTrue TOTP enrollment');
  success(await actor.auth.mfa.challengeAndVerify({ factorId: factor.id, code: generateTotp(factor.totp.secret) }), 'totp_challenge_failed');
  check(success(await actor.auth.mfa.getAuthenticatorAssuranceLevel(), 'aal2_read_failed').currentLevel === 'aal2', 'GoTrue issues AAL2 session');
  check(success(await actor.auth.getUser(), 'aal2_user_read_failed').user.id === id, 'AAL2 user validated by managed Auth');
  const context = success(await actor.schema('customer_api').rpc('get_my_platform_auth_context_v1'), 'aal2_platform_context_failed');
  check(context.is_authorized === true && context.platform_user.auth_user_id === id
    && context.roles.some(role => role.role === 'PLATFORM_SUPER_ADMIN'), 'canonical current platform context accepts real AAL2');
  const pilot = success(await actor.schema('customer_api').rpc('create_pilot_workspace_v1', pilotArgs), 'canonical_pilot_creation_failed');
  check(pilot.workspace?.tenant_id === pilot.tenant_id && pilot.workspace.environment === 'PILOT'
    && pilot.workspace.lifecycle_status === 'LEAD', 'canonical pilot RPC creates LEAD workspace without lifecycle bypass');
  check(sql(`select count(*) from audit.events where actor_id='${id}'::uuid and action='TENANT_CREATED';`) === '1',
    'canonical pilot creation records audit');
  check(sql(`select count(*) from identity.memberships where user_id='${id}'::uuid;`) === '0',
    'platform fixture does not grant customer membership');
  receipt.result = 'PASS';
  receipt.scope = 'Real local managed Auth/password/TOTP/AAL2, owner platform fixture, canonical platform context and pilot LEAD creation only';
  receipt.next = 'Canonical bounded pilot access preparation and lifecycle, customer acceptance, onboarding and native workspace authority remain unproved';
  receipt.teardown = 'Owned CI Supabase project must be destroyed; synthetic fixture deliberately retained until teardown';
  console.log('PASS: disposable real Auth first administrator and canonical pilot LEAD creation; no browser, hosted or customer onboarding claim.');
} catch {
  receipt.result = 'FAIL';
  // Neither raw SDK errors nor assertion values are safe credential diagnostics.
  console.error('FAIL: disposable first-administrator proof; inspect credential-free receipt check names.');
  process.exitCode = 1;
} finally {
  if (receiptPath) writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
}
