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
  receipt.first_administrator = 'PASS';
  // Bounded PILOT is an explicit canonical access mode, requiring no invented
  // signed contract/payment evidence. The customer is a distinct GoTrue user;
  // only application RPCs may create their profile, membership and Context.
  const customer = createClient(api.origin, status.ANON_KEY, options);
  const customerEmail = `pilot-customer-${run}@example.invalid`;
  const customerPassword = randomBytes(32).toString('base64url') + 'aA1!';
  const customerCreated = success(await admin.auth.admin.createUser({ email: customerEmail,
    password: customerPassword, email_confirm: true,
    app_metadata: { cladora_disposable_pilot_customer: true } }), 'local_customer_auth_creation_failed');
  const customerId = customerCreated.user?.id;
  check(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(customerId ?? '') && customerId !== id,
    'distinct real GoTrue customer UUID');
  const customerVerified = success(await admin.auth.admin.getUserById(customerId), 'customer_auth_readback_failed');
  check(customerVerified.user.email === customerEmail && !!customerVerified.user.email_confirmed_at,
    'managed Auth verified synthetic customer');
  success(await customer.auth.signInWithPassword({ email: customerEmail, password: customerPassword }), 'customer_signin_failed');
  check(success(await customer.auth.mfa.getAuthenticatorAssuranceLevel(), 'customer_aal1_failed').currentLevel === 'aal1',
    'distinct customer password session starts AAL1');
  const roles = success(await actor.schema('customer_api').from('workspace_primary_admin_roles_v1')
    .select('id,code').eq('code', 'association_admin'), 'primary_admin_role_lookup_failed');
  check(roles.length === 1, 'canonical association primary administrator role discovered through API');
  const basis = success(await actor.schema('customer_api').rpc('prepare_workspace_access_basis_v1', {
    p_workspace_id: pilot.workspace.id, p_email: customerEmail, p_role_id: roles[0].id,
    p_mode: 'PILOT', p_duration_hours: 24, p_contract_id: null, p_payment_reference: null,
    p_payment_amount: null, p_payment_currency: null, p_paid_on: null, p_paid_through: null,
    p_evidence_note: `Explicit disposable CI technical pilot approval; 24 hours; run ${run}; no payment or contract claimed`,
  }), 'canonical_pilot_preparation_failed');
  check(basis.status === 'prepared' && basis.mode === 'PILOT' && basis.access_active === false
    && basis.email_sent === false, 'canonical 24-hour PILOT preparation grants no membership or email invitation');
  // The lifecycle API requires every intermediate state even for PILOT. These
  // names describe the state machine, not assertions that a contract was signed
  // or payment received; the sole provisioning evidence is the prepared PILOT.
  let workspace = pilot.workspace;
  for (const target of ['UNDER_REVIEW', 'APPROVED', 'CONTRACT_PENDING', 'PAYMENT_PENDING', 'PROVISIONING']) {
    const next = success(await actor.schema('customer_api').rpc('transition_workspace_lifecycle_v1', {
      p_workspace_id: workspace.id, p_target_status: target, p_expected_version: workspace.version,
      p_reason: `Disposable 24-hour PILOT technical lifecycle progression to ${target}; no contractual or payment claim`,
    }), 'canonical_pilot_lifecycle_failed');
    check(next.id === workspace.id && next.lifecycle_status === target && next.environment === 'PILOT'
      && next.version === workspace.version + 1, `canonical version-bound PILOT lifecycle ${target}`);
    workspace = next;
  }
  check((await customer.schema('customer_api').rpc('list_my_prepared_workspace_access_v1')).error?.code === '42501',
    'prepared access list denies real customer AAL1');
  check((await customer.schema('customer_api').rpc('activate_prepared_workspace_access_v1', {
    p_basis_id: basis.id, p_display_name: 'Disposable pilot customer', p_locale: 'en',
  })).error?.code === '42501', 'prepared access activation denies real customer AAL1');
  const customerFactor = success(await customer.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Disposable customer TOTP' }),
    'customer_totp_enrollment_failed');
  check(customerFactor.type === 'totp' && !!customerFactor.totp?.secret, 'real customer TOTP enrollment');
  success(await customer.auth.mfa.challengeAndVerify({ factorId: customerFactor.id,
    code: generateTotp(customerFactor.totp.secret) }), 'customer_totp_challenge_failed');
  check(success(await customer.auth.mfa.getAuthenticatorAssuranceLevel(), 'customer_aal2_failed').currentLevel === 'aal2'
    && success(await customer.auth.getUser(), 'customer_aal2_user_failed').user.id === customerId,
  'distinct customer receives real managed AAL2 session');
  const prepared = success(await customer.schema('customer_api').rpc('list_my_prepared_workspace_access_v1'), 'customer_prepared_list_failed');
  check(prepared.length === 1 && prepared[0].id === basis.id && prepared[0].workspace_id === workspace.id
    && prepared[0].duration_hours === 24 && prepared[0].mode === 'PILOT', 'customer sees exact prepared bounded PILOT basis');
  check(success(await actor.schema('customer_api').rpc('list_my_prepared_workspace_access_v1'), 'other_actor_prepared_list_failed').length === 0,
    'platform administrator cannot list another verified email prepared access');
  check((await actor.schema('customer_api').rpc('activate_prepared_workspace_access_v1', {
    p_basis_id: basis.id, p_display_name: 'Wrong verified actor', p_locale: 'en',
  })).error?.code === '42501', 'wrong AAL2 actor cannot activate customer basis');
  const activated = success(await customer.schema('customer_api').rpc('activate_prepared_workspace_access_v1', {
    p_basis_id: basis.id, p_display_name: 'Disposable pilot customer', p_locale: 'en',
  }), 'customer_pilot_activation_failed');
  check(activated.workspace_id === workspace.id && activated.mode === 'PILOT' && !!activated.membership_id,
    'canonical prepared-access activation creates customer membership');
  const contexts = success(await customer.schema('customer_api').rpc('list_contexts_v1'), 'customer_contexts_failed');
  check(contexts.length === 1 && contexts[0].membership_id === activated.membership_id
    && contexts[0].tenant_id === pilot.tenant_id && contexts[0].role_code === 'association_admin'
    && contexts[0].scope_type === 'tenant' && Number.isFinite(Date.parse(contexts[0].ends_at)),
  'real customer Context is projected from bounded canonical membership');
  const expiry = JSON.parse(sql(`select jsonb_build_object('same_bound',m.ends_at=b.expires_at and g.ends_at=b.expires_at,
    'duration',extract(epoch from (b.expires_at-b.activated_at)), 'profile',exists(select 1 from identity.profiles p where p.user_id=m.user_id),
    'no_commercial_claim',b.contract_id is null and b.payment_reference is null and b.payment_amount is null)
    from platform.workspace_access_bases b join identity.memberships m on m.id=b.membership_id
    join identity.context_grants g on g.id=b.context_grant_id where m.user_id='${customerId}'::uuid;`));
  check(expiry.same_bound && Number(expiry.duration) === 24 * 60 * 60 && expiry.profile && expiry.no_commercial_claim,
    'owner readback confirms exact 24-hour membership Context basis expiry and canonical profile without commercial claim');
  const beforeOnboarding = success(await customer.schema('customer_api').rpc('get_my_primary_admin_onboarding_v1', {
    p_workspace_id: workspace.id,
  }), 'customer_onboarding_read_failed');
  check(beforeOnboarding.length === 1 && beforeOnboarding[0].customer_workspace_id === workspace.id
    && beforeOnboarding[0].onboarding_completed === false, 'canonical primary administrator onboarding is pending');
  check((await actor.schema('customer_api').rpc('complete_primary_admin_onboarding_v1', {
    p_workspace_id: workspace.id, p_expected_version: beforeOnboarding[0].workspace_version,
    p_reason: 'Wrong verified actor must not complete customer onboarding',
  })).error?.code === '42501', 'platform administrator cannot complete another actor onboarding');
  const completed = success(await customer.schema('customer_api').rpc('complete_primary_admin_onboarding_v1', {
    p_workspace_id: workspace.id, p_expected_version: beforeOnboarding[0].workspace_version,
    p_reason: 'Disposable customer completed verified identity real TOTP and bounded PILOT access onboarding',
  }), 'customer_onboarding_completion_failed');
  check(completed.onboarding_completed === true && completed.customer_workspace_id === workspace.id
    && completed.workspace_version === beforeOnboarding[0].workspace_version + 1,
  'real AAL2 customer completes version-bound primary administrator onboarding');
  const afterOnboarding = success(await customer.schema('customer_api').rpc('get_my_primary_admin_onboarding_v1', {
    p_workspace_id: workspace.id,
  }), 'completed_onboarding_read_failed');
  check(afterOnboarding.length === 1 && afterOnboarding[0].onboarding_completed === true
    && afterOnboarding[0].workspace_version === completed.workspace_version, 'canonical onboarding readback agrees');
  check(sql(`select count(*) from audit.events where actor_id='${customerId}'::uuid
    and action in ('WORKSPACE_ACCESS_BASIS_ACTIVATED','PRIMARY_ADMIN_ONBOARDING_COMPLETED');`) === '2',
    'customer activation and onboarding both have real audit records');
  receipt.customer_onboarding = 'PASS_LOCAL_PREPARED_24_HOUR_PILOT_ONLY';
  const contextId = contexts[0].context_id;
  check((await customer.schema('customer_api').rpc('get_dashboard_v1', { p_context_id: contextId })).error?.code === '42501',
    'canonical customer dashboard denies workspace still PROVISIONING');
  const activeArgs = { p_workspace_id: workspace.id, p_target_status: 'ACTIVE',
    p_expected_version: completed.workspace_version,
    p_reason: 'Activate disposable 24-hour PILOT after real customer identity MFA and onboarding; no commercial claim' };
  check((await customer.schema('customer_api').rpc('transition_workspace_lifecycle_v1', activeArgs)).error?.code === '42501',
    'customer primary administrator cannot perform platform lifecycle transition');
  const activeWorkspace = success(await actor.schema('customer_api').rpc('transition_workspace_lifecycle_v1', activeArgs),
    'canonical_pilot_active_transition_failed');
  check(activeWorkspace.id === workspace.id && activeWorkspace.environment === 'PILOT'
    && activeWorkspace.lifecycle_status === 'ACTIVE' && activeWorkspace.version === completed.workspace_version + 1
    && activeWorkspace.primary_admin_user_id === customerId && !!activeWorkspace.onboarding_completed_at,
  'canonical platform AAL2 versioned transition activates completed bounded PILOT');
  const dashboard = success(await customer.schema('customer_api').rpc('get_dashboard_v1', { p_context_id: contextId }),
    'active_customer_dashboard_failed');
  check(dashboard.version === 1 && dashboard.persona === 'association_admin'
    && dashboard.contextId === contextId && dashboard.context?.id === contextId
    && dashboard.context.tenant_id === pilot.tenant_id && dashboard.context.role_code === dashboard.persona
    && dashboard.context.scope_type === 'tenant' && dashboard.workspace_id === workspace.id,
  'actual customer dashboard binds current Context tenant persona and ACTIVE workspace');
  check(['permissions', 'entitlements', 'modules', 'capabilities', 'sections'].every(key =>
    Array.isArray(dashboard[key]) && dashboard[key].every(value => typeof value === 'string'))
    && Number.isFinite(Date.parse(dashboard.generated_at)), 'actual versioned dashboard returns typed arrays and timestamp');
  check(dashboard.kpis?.properties === 0 && dashboard.kpis.buildings === 0 && dashboard.kpis.units === 0,
    'fresh customer dashboard reports actual empty property building and unit counts');
  check(dashboard.entitlements.length === 0 && dashboard.modules.includes('dashboard')
    && dashboard.modules.every(module => ['dashboard', 'audit'].includes(module)),
  'basic dashboard does not imply enabled commercial modules or operations entitlement');
  check((await actor.schema('customer_api').rpc('get_dashboard_v1', { p_context_id: contextId })).error?.code === '42501',
    'platform administrator cannot read customer dashboard without customer Context authority');
  const activeContexts = success(await customer.schema('customer_api').rpc('list_contexts_v1'), 'active_contexts_read_failed');
  check(activeContexts.length === 1 && activeContexts[0].context_id === contextId
    && activeContexts[0].membership_id === activated.membership_id && activeContexts[0].ends_at === contexts[0].ends_at,
  'ACTIVE transition preserves exact bounded customer Context and expiry');
  check(sql(`select count(*) from audit.events where actor_id='${id}'::uuid
    and action='WORKSPACE_LIFECYCLE_TRANSITION' and after_snapshot->>'status'='ACTIVE';`) === '1',
    'canonical ACTIVE transition has its own platform audit record');
  receipt.customer_dashboard = 'PASS_LOCAL_ACTIVE_BOUNDED_PILOT_RPC_ONLY';
  receipt.result = 'PASS';
  receipt.scope = 'Real local Auth/TOTP for two distinct users; narrow owner platform fixture; canonical 24-hour PILOT preparation, customer onboarding, versioned ACTIVE transition and actual basic customer dashboard RPC';
  receipt.next = 'Native workspace/module authority, commercial entitlements, browser/application routes, operations and building workflows remain unproved';
  receipt.teardown = 'Owned CI Supabase project must be destroyed; synthetic fixture deliberately retained until teardown';
  console.log('PASS: disposable real Auth, bounded PILOT onboarding, canonical ACTIVE transition and customer dashboard RPC; no browser, hosted, native-workspace or operations acceptance claim.');
} catch {
  receipt.result = 'FAIL';
  // Neither raw SDK errors nor assertion values are safe credential diagnostics.
  console.error('FAIL: disposable first-administrator proof; inspect credential-free receipt check names.');
  process.exitCode = 1;
} finally {
  if (receiptPath) writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
}
