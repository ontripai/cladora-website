import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import ts from 'typescript';

let activeCheck = 'fixture setup';
const escape = value => String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
process.on('uncaughtExceptionMonitor', error => {
  const code = typeof error?.code === 'string' ? error.code : 'NO_SQLSTATE';
  console.error(`::error title=SERVICE subject-link HTTP PostgreSQL::${escape(`${activeCheck}: ${code}: ${error.message}`)}`);
});

const connectionString = process.env.SERVICE_SUBJECT_LINK_HTTP_TEST_DATABASE_URL;
if (!connectionString || process.env.SERVICE_SUBJECT_LINK_HTTP_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable SERVICE subject-link database required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/service_subject_link_http_test', '/postgres'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

let adminPool = null;
let isolatedDatabaseName = null;
if (target.pathname === '/postgres') {
  isolatedDatabaseName = `service_subject_link_http_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  adminPool = new pg.Pool({ connectionString, max: 1 });
  await adminPool.query(`create database "${isolatedDatabaseName}"`);
  target.pathname = `/${isolatedDatabaseName}`;
}

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name),
  loadedModule, loadedModule.exports);
  cache.set(url.href, loadedModule.exports);
  return loadedModule.exports;
}

const { createCorePostgresTransactionHostV1 } = load(new URL(
  '../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url,
));
const {
  buildServiceSubjectLinkCoreCommandV1,
  createServiceSubjectLinkCoreProvidersV1,
} = load(new URL('../src/lib/customer/service-request-subject-link-v1.ts', import.meta.url));
const { handleServiceSubjectLinkHttpV1, readServiceSubjectLinkAuthorityVersionV1 } = load(new URL(
  '../src/lib/customer/service-request-subject-link-http-v1.ts', import.meta.url,
));

const authUrl = process.env.SERVICE_SUBJECT_LINK_HTTP_SUPABASE_URL;
const anonKey = process.env.SERVICE_SUBJECT_LINK_HTTP_ANON_KEY;
const serviceRoleKey = process.env.SERVICE_SUBJECT_LINK_HTTP_SERVICE_ROLE_KEY;
const realAal2Required = process.env.SERVICE_SUBJECT_LINK_HTTP_REAL_AAL2_REQUIRED === '1';
const realAuthAvailable = Boolean(authUrl && anonKey && serviceRoleKey);
if (realAal2Required && !realAuthAvailable) {
  throw new Error('Local Supabase Auth URL, anon key and service-role test key are required');
}
const authTarget = authUrl ? new URL(authUrl) : null;
if (authTarget && !['localhost', '127.0.0.1', '[::1]'].includes(authTarget.hostname)) {
  throw new Error('Local disposable Supabase Auth only');
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replaceAll('=', '').replaceAll(' ', '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('invalid_totp_secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, at = Date.now()) {
  const counter = BigInt(Math.floor(at / 30_000));
  const input = Buffer.alloc(8);
  input.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(input).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

const authAdmin = realAuthAvailable ? createSupabaseClient(authUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
}) : null;
const createdAuthUsers = [];
async function createActualAal2Session(label) {
  const email = `subject-link-http-${label}-${randomUUID()}@example.invalid`;
  const password = `A2-${randomUUID()}-z9!`;
  const created = await authAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('auth_user_creation_failed');
  createdAuthUsers.push(created.data.user.id);
  const auth = createSupabaseClient(authUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const signedIn = await auth.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('aal1_sign_in_failed');
  const aal1 = {
    access_token: signedIn.data.session.access_token,
    refresh_token: signedIn.data.session.refresh_token,
  };
  const enrolled = await auth.auth.mfa.enroll({ factorType: 'totp', friendlyName: `subject-link-${label}` });
  if (enrolled.error || !enrolled.data) throw enrolled.error ?? new Error('totp_enrollment_failed');
  let verified = await auth.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) {
    // A code can cross a 30-second boundary between generation and verification.
    verified = await auth.auth.mfa.challengeAndVerify({
      factorId: enrolled.data.id,
      code: totp(enrolled.data.totp.secret, Date.now() + 30_000),
    });
  }
  if (verified.error || !verified.data) throw verified.error ?? new Error('totp_verification_failed');
  const assurance = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  const current = await auth.auth.getSession();
  if (assurance.error || assurance.data.currentLevel !== 'aal2'
    || current.error || !current.data.session) throw new Error('verified_aal2_session_required');
  return {
    actor_id: created.data.user.id,
    aal1,
    aal2: {
      access_token: current.data.session.access_token,
      refresh_token: current.data.session.refresh_token,
    },
  };
}

const syntheticAuth = () => {
  const actorId = randomUUID();
  return {
    actor_id: actorId,
    aal1: { synthetic: true, actor_id: actorId, assurance_level: 'aal1' },
    aal2: { synthetic: true, actor_id: actorId, assurance_level: 'aal2' },
  };
};
const primaryAuth = realAuthAvailable ? await createActualAal2Session('primary') : syntheticAuth();
const secondaryAuth = realAuthAvailable ? await createActualAal2Session('secondary') : syntheticAuth();

const pool = new pg.Pool({ connectionString: target.toString(), max: 20 });
const host = createCorePostgresTransactionHostV1(pool);
const id = () => randomUUID();
const actor = primaryAuth.actor_id;
const secondaryActor = secondaryAuth.actor_id;
const recipientUser = id();
const tenantId = id();
const workspaceId = id();
const otherWorkspaceId = id();
const propertyId = id();
const buildingId = id();
const unitId = id();
const actorMembership = id();
const recipientMembership = id();
const contextId = id();
const beneficiaryParty = id();
const providerParty = id();
const unrelatedParty = id();
const conversationId = id();
const offeringId = id();
const publishedRevisionId = id();
let passed = 0;
const check = async (name, run) => {
  activeCheck = name;
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const bootstrapSql = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
create schema auth;
create schema platform;
create schema identity;
create schema portfolio;
create schema service_catalog;
create schema communications;
create schema maintenance;
create schema app_private;
create schema audit;

create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;

create table auth.users(id uuid primary key,email text not null);
create table platform.tenants(id uuid primary key);
create table platform.customer_workspaces(
  id uuid primary key,tenant_id uuid not null references platform.tenants(id),
  lifecycle_status text not null default 'ACTIVE',archived_at timestamptz
);
create table portfolio.properties(id uuid primary key,tenant_id uuid not null,name text);
create table portfolio.buildings(
  id uuid primary key,tenant_id uuid not null,property_id uuid not null references portfolio.properties(id)
);
create table portfolio.units(
  id uuid primary key,tenant_id uuid not null,building_id uuid not null references portfolio.buildings(id)
);
create table portfolio.parties(id uuid primary key,tenant_id uuid not null,archived_at timestamptz);
create table identity.memberships(
  id uuid primary key,tenant_id uuid not null,user_id uuid not null references auth.users(id),
  status text not null,starts_at timestamptz not null,ends_at timestamptz
);
create table identity.context_grants(
  id uuid primary key,membership_id uuid not null,tenant_id uuid not null,
  starts_at timestamptz not null,ends_at timestamptz
);
create table identity.membership_parties(
  membership_id uuid not null,tenant_id uuid not null,party_id uuid not null,
  valid_from timestamptz not null,valid_until timestamptz
);
create table identity.permissions(
  id uuid primary key default gen_random_uuid(),code text not null unique,
  resource text not null,action text not null,description text not null
);
create table platform.module_definitions(
  id uuid primary key,code text not null,is_active boolean not null,
  lifecycle_status text not null,valid_from timestamptz not null,valid_to timestamptz,
  entitlement_key text,version integer not null default 1
);
create table platform.module_permission_bindings(
  id uuid primary key default gen_random_uuid(),module_definition_id uuid not null,
  permission_id uuid not null,binding_version integer not null default 1,
  permission_mode text not null,is_assignable_to_local_role boolean not null default true,
  is_delegable boolean not null default false,requires_aal2 boolean not null default false,
  lifecycle_status text not null default 'active',valid_to timestamptz,
  unique(module_definition_id,permission_id,binding_version)
);
create table platform.workspace_modules(
  tenant_id uuid not null,customer_workspace_id uuid not null,module_definition_id uuid not null,
  module_code text not null,status text not null,valid_from timestamptz not null,valid_to timestamptz
);
create table platform.workspace_entitlements(
  customer_workspace_id uuid not null,entitlement_key text not null,boolean_value boolean,
  override_value_json jsonb,override_expires_at timestamptz,
  valid_from timestamptz not null,valid_until timestamptz
);
create table platform.workspace_roles(
  id uuid primary key,tenant_id uuid not null,customer_workspace_id uuid not null,
  lifecycle_status text not null,valid_from timestamptz not null,valid_to timestamptz
);
create table platform.workspace_role_modules(workspace_role_id uuid not null,module_definition_id uuid not null);
create table platform.workspace_role_permissions(
  workspace_role_id uuid not null,permission_id uuid not null,effect text not null
);
create table platform.workspace_member_roles(
  id uuid primary key,tenant_id uuid not null,customer_workspace_id uuid not null,
  membership_id uuid not null,workspace_role_id uuid not null,scope_type text not null,
  property_id uuid,building_id uuid,unit_id uuid,valid_from timestamptz not null,valid_to timestamptz
);
create table platform.workspace_property_bindings(
  tenant_id uuid not null,customer_workspace_id uuid not null,property_id uuid not null,
  status text not null,valid_from timestamptz not null,valid_to timestamptz
);
create table app_private.canonical_authority_revision_v1(
  singleton boolean primary key default true,revision bigint not null
);
insert into app_private.canonical_authority_revision_v1(singleton,revision) values(true,1);

create table service_catalog.requests(
  id uuid primary key,tenant_id uuid not null,workspace_id uuid not null,
  offering_id uuid not null,published_revision_id uuid not null,
  requester_id uuid not null,membership_id uuid not null,beneficiary_party_id uuid not null,
  description text not null,status text not null default 'submitted',
  created_at timestamptz not null default clock_timestamp()
);
create table service_catalog.offerings(
  id uuid primary key,tenant_id uuid not null,workspace_id uuid not null,
  provider_party_id uuid not null
);
create table communications.private_conversations(
  id uuid primary key,tenant_id uuid not null,unit_id uuid not null,
  created_by uuid not null,client_request_id uuid not null,created_at timestamptz default statement_timestamp()
);
create table communications.private_participants(
  conversation_id uuid not null,membership_id uuid not null,joined_at timestamptz default statement_timestamp(),
  revoked_at timestamptz,primary key(conversation_id,membership_id)
);
create table communications.private_messages(
  id uuid primary key,conversation_id uuid not null,sender_id uuid not null,
  client_request_id uuid not null,body text not null,sent_at timestamptz default statement_timestamp()
);
create table maintenance.vendors(
  id uuid primary key,tenant_id uuid not null,party_id uuid not null,status text not null
);
create table maintenance.vendor_portal_memberships(
  membership_id uuid not null,tenant_id uuid not null,vendor_id uuid not null,
  status text not null,accepted_at timestamptz,revoked_at timestamptz
);

create table platform.idempotency_keys(
  tenant_id uuid not null,actor_id uuid not null,key text not null,request_hash text not null,
  response_ref jsonb,expires_at timestamptz not null,status_code integer,
  primary key(tenant_id,key)
);
create table audit.events(
  id bigserial primary key,tenant_id uuid not null,actor_id uuid not null,action text not null,
  entity_type text not null,entity_id uuid not null,request_id uuid,after_snapshot jsonb,reason text
);
create table platform.outbox_events(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,
  aggregate_type text not null,aggregate_id uuid not null,aggregate_version bigint not null,
  event_type text not null,payload jsonb not null,trace_id uuid
);

create function app_private.resolve_workspace_native_context_v2(p_context uuid,p_workspace uuid)
returns table(tenant_id uuid,membership_id uuid) language sql stable security definer set search_path=pg_catalog as $$
  select g.tenant_id,g.membership_id
  from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=g.tenant_id
  where g.id=p_context and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
$$;
create function app_private.check_workspace_native_permission_v2(
  p_context uuid,p_workspace uuid,p_permission text,p_module text
) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(
    select 1 from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=g.tenant_id
      and w.lifecycle_status='ACTIVE' and w.archived_at is null
    join platform.workspace_member_roles a on a.membership_id=m.id
      and a.tenant_id=m.tenant_id and a.customer_workspace_id=w.id
      and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
    join platform.workspace_roles r on r.id=a.workspace_role_id and r.lifecycle_status='published'
      and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp())
    join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id and rp.effect='allow'
    join identity.permissions permission on permission.id=rp.permission_id and permission.code=p_permission
    join platform.module_definitions d on d.code=p_module and d.is_active
      and d.lifecycle_status in ('active','published')
      and d.valid_from<=statement_timestamp() and (d.valid_to is null or d.valid_to>statement_timestamp())
    join platform.workspace_role_modules rm on rm.workspace_role_id=r.id and rm.module_definition_id=d.id
    join platform.module_permission_bindings binding on binding.module_definition_id=d.id
      and binding.permission_id=permission.id and binding.lifecycle_status='active'
      and binding.valid_to is null
    join platform.workspace_modules wm on wm.customer_workspace_id=w.id
      and wm.module_definition_id=d.id and wm.status='active'
      and wm.valid_from<=statement_timestamp() and (wm.valid_to is null or wm.valid_to>statement_timestamp())
    where g.id=p_context and m.user_id=auth.uid() and m.status='active'
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
  )
$$;
create function app_private.native_workspace_scope_for_membership_v2(
  p_context uuid,p_membership uuid,p_workspace uuid
) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from identity.context_grants g
    join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=g.tenant_id
    where g.id=p_context and g.membership_id=p_membership)
$$;
create function app_private.workspace_role_scope_contains_v1(
  p_scope text,p_property uuid,p_building uuid,p_unit uuid,
  p_target_scope text,p_target_property uuid,p_target_building uuid,p_target_unit uuid
) returns boolean language sql immutable as $$
  select p_scope='workspace' or (p_scope='unit' and p_unit=p_target_unit)
$$;
create function app_private.workspace_member_role_authority_active_v1(
  p_assignment uuid,p_permission uuid,p_module uuid,p_scope text,p_unit uuid
) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from platform.workspace_member_roles a
    join platform.workspace_roles r on r.id=a.workspace_role_id and r.lifecycle_status='published'
    join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
      and rp.permission_id=p_permission and rp.effect='allow'
    join platform.workspace_role_modules rm on rm.workspace_role_id=r.id and rm.module_definition_id=p_module
    where a.id=p_assignment and a.valid_from<=statement_timestamp()
      and (a.valid_to is null or a.valid_to>statement_timestamp())
      and (a.scope_type='workspace' or (a.scope_type=p_scope and a.unit_id=p_unit)))
$$;
create function app_private.service_request_authorize_v1(
  p_context uuid,p_workspace uuid,p_permission text
) returns table(tenant_id uuid,membership_id uuid) language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null or app_private.check_workspace_native_permission_v2(
      p_context,p_workspace,p_permission,'services_orders') is not true then
    raise exception 'service_request_access_denied' using errcode='42501';
  end if;
  return query select c.tenant_id,c.membership_id
    from app_private.resolve_workspace_native_context_v2(p_context,p_workspace) c;
end $$;
create function communications.context_membership(p_context uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select m.id from identity.context_grants g join identity.memberships m
    on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
$$;
create function communications.member_covers_unit(p_membership uuid,p_tenant uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from identity.memberships m
    join identity.context_grants g on g.membership_id=m.id and g.tenant_id=m.tenant_id
    join portfolio.units u on u.id=p_unit and u.tenant_id=m.tenant_id
    join platform.workspace_member_roles a on a.membership_id=m.id and a.tenant_id=m.tenant_id
      and a.scope_type='unit' and a.unit_id=p_unit and a.valid_from<=statement_timestamp()
      and (a.valid_to is null or a.valid_to>statement_timestamp())
    join platform.workspace_roles r on r.id=a.workspace_role_id and r.lifecycle_status='published'
    join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id and rp.effect='allow'
    join identity.permissions permission on permission.id=rp.permission_id
      and permission.code='communications.feed.read'
    where m.id=p_membership and m.tenant_id=p_tenant and m.status='active'
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp()))
$$;
`;

try {
  await pool.query(bootstrapSql);
  const serviceModuleId = id();
  await pool.query(`insert into platform.module_definitions(
    id,code,is_active,lifecycle_status,valid_from,entitlement_key,version
  ) values($1,'services_orders',true,'published',statement_timestamp()-interval '1 day',
    'module.services_orders',1)`, [serviceModuleId]);
  for (const migration of [
    '20261013062342_service_request_subject_context_v1.sql',
    '20261013120000_communications_private_message_subject_provider_v1.sql',
    '20261013150000_communications_private_message_request_audience_gate_v1.sql',
    '20261013170242_service_request_subject_link_v1.sql',
  ]) {
    await pool.query(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const subjectLinkPermission = (await pool.query(
    "select id::text from identity.permissions where code='services.orders.subject_link'",
  )).rows[0]?.id;
  assert.match(subjectLinkPermission ?? '', /^[0-9a-f-]{36}$/);

  const communicationsModuleId = id();
  const serviceReadPermission = id();
  const serviceRequestPermission = id();
  const communicationsReadPermission = id();
  const serviceRoleId = id();
  const communicationsRoleId = id();
  const fixture = await pool.connect();
  try {
    await fixture.query('begin');
    await fixture.query(`insert into auth.users(id,email)
      values($1,'actor@example.invalid'),($2,'recipient@example.invalid'),
        ($3,'secondary@example.invalid')`, [actor, recipientUser, secondaryActor]);
    await fixture.query('insert into platform.tenants(id) values($1)', [tenantId]);
    await fixture.query('insert into platform.customer_workspaces(id,tenant_id) values($1,$3),($2,$3)',
      [workspaceId, otherWorkspaceId, tenantId]);
    await fixture.query("insert into portfolio.properties(id,tenant_id,name) values($1,$2,'Property')",
      [propertyId, tenantId]);
    await fixture.query('insert into portfolio.buildings(id,tenant_id,property_id) values($1,$2,$3)',
      [buildingId, tenantId, propertyId]);
    await fixture.query('insert into portfolio.units(id,tenant_id,building_id) values($1,$2,$3)',
      [unitId, tenantId, buildingId]);
    await fixture.query(`insert into platform.workspace_property_bindings(
      tenant_id,customer_workspace_id,property_id,status,valid_from
    ) values($1,$2,$3,'active',statement_timestamp()-interval '1 day')`,
    [tenantId, workspaceId, propertyId]);
    await fixture.query(`insert into identity.memberships(id,tenant_id,user_id,status,starts_at)
      values($1,$3,$4,'active',statement_timestamp()-interval '1 day'),
        ($2,$3,$5,'active',statement_timestamp()-interval '1 day')`,
    [actorMembership, recipientMembership, tenantId, actor, recipientUser]);
    await fixture.query(`insert into identity.context_grants(id,membership_id,tenant_id,starts_at)
      values($1,$2,$3,statement_timestamp()-interval '1 day'),
        (gen_random_uuid(),$4,$3,statement_timestamp()-interval '1 day')`,
    [contextId, actorMembership, tenantId, recipientMembership]);
    await fixture.query('insert into portfolio.parties(id,tenant_id) values($1,$4),($2,$4),($3,$4)',
      [beneficiaryParty, providerParty, unrelatedParty, tenantId]);
    await fixture.query(`insert into service_catalog.offerings(
      id,tenant_id,workspace_id,provider_party_id
    ) values($1,$2,$3,$4)`, [offeringId, tenantId, workspaceId, providerParty]);
    await fixture.query(`insert into identity.membership_parties(
      membership_id,tenant_id,party_id,valid_from
    ) values($1,$3,$4,statement_timestamp()-interval '1 day'),
      ($2,$3,$5,statement_timestamp()-interval '1 day')`,
    [actorMembership, recipientMembership, tenantId, beneficiaryParty, unrelatedParty]);
    await fixture.query(`insert into identity.permissions(id,code,resource,action,description) values
      ($1,'services.orders.read','services.orders','read','read'),
      ($2,'services.orders.request','services.orders','request','request'),
      ($3,'communications.feed.read','communications.feed','read','read')`,
    [serviceReadPermission, serviceRequestPermission, communicationsReadPermission]);
    await fixture.query(`insert into platform.module_definitions(
      id,code,is_active,lifecycle_status,valid_from,entitlement_key,version
    ) values($1,'communications',true,'published',statement_timestamp()-interval '1 day',
      'module.communications',1)`, [communicationsModuleId]);
    await fixture.query(`insert into platform.workspace_modules(
      tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from
    ) values($1,$2,$3,'services_orders','active',statement_timestamp()-interval '1 day'),
      ($1,$2,$4,'communications','active',statement_timestamp()-interval '1 day')`,
    [tenantId, workspaceId, serviceModuleId, communicationsModuleId]);
    await fixture.query(`insert into platform.module_permission_bindings(
      module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2
    ) values($1,$3,'read',false,false),($1,$4,'manage',false,false),
      ($2,$5,'read',false,false)`, [
      serviceModuleId, communicationsModuleId, serviceReadPermission,
      serviceRequestPermission, communicationsReadPermission,
    ]);
    await fixture.query(`insert into platform.workspace_entitlements(
      customer_workspace_id,entitlement_key,boolean_value,valid_from
    ) values($1,'module.services_orders',true,statement_timestamp()-interval '1 day'),
      ($1,'module.communications',true,statement_timestamp()-interval '1 day')`, [workspaceId]);
    await fixture.query(`insert into platform.workspace_roles(
      id,tenant_id,customer_workspace_id,lifecycle_status,valid_from
    ) values($1,$3,$4,'published',statement_timestamp()-interval '1 day'),
      ($2,$3,$4,'published',statement_timestamp()-interval '1 day')`,
    [serviceRoleId, communicationsRoleId, tenantId, workspaceId]);
    await fixture.query(`insert into platform.workspace_role_modules(workspace_role_id,module_definition_id)
      values($1,$3),($2,$4)`, [serviceRoleId, communicationsRoleId, serviceModuleId, communicationsModuleId]);
    await fixture.query(`insert into platform.workspace_role_permissions(workspace_role_id,permission_id,effect)
      values($1,$3,'allow'),($1,$4,'allow'),($2,$5,'allow')`, [
      serviceRoleId, communicationsRoleId, serviceReadPermission,
      serviceRequestPermission, communicationsReadPermission,
    ]);
    await fixture.query(`insert into platform.workspace_member_roles(
      id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
      scope_type,property_id,building_id,unit_id,valid_from
    ) values(gen_random_uuid(),$1,$2,$3,$5,'workspace',null,null,null,statement_timestamp()-interval '1 day'),
      (gen_random_uuid(),$1,$2,$3,$6,'unit',$7,$8,$9,statement_timestamp()-interval '1 day'),
      (gen_random_uuid(),$1,$2,$4,$6,'unit',$7,$8,$9,statement_timestamp()-interval '1 day')`, [
      tenantId, workspaceId, actorMembership, recipientMembership,
      serviceRoleId, communicationsRoleId, propertyId, buildingId, unitId,
    ]);
    await fixture.query(`insert into communications.private_conversations(
      id,tenant_id,unit_id,created_by,client_request_id
    ) values($1,$2,$3,$4,gen_random_uuid())`, [conversationId, tenantId, unitId, actorMembership]);
    await fixture.query(`insert into communications.private_participants(conversation_id,membership_id)
      values($1,$2),($1,$3)`, [conversationId, actorMembership, recipientMembership]);
    await fixture.query('commit');
  } catch (error) {
    await fixture.query('rollback');
    throw error;
  } finally {
    fixture.release();
  }

  const createRequest = async () => {
    const requestId = id();
    await pool.query(`insert into service_catalog.requests(
      id,tenant_id,workspace_id,offering_id,published_revision_id,requester_id,
      membership_id,beneficiary_party_id,description
    ) values($1,$2,$3,$4,$5,$6,$7,$8,'Disposable subject-link Request')`, [
      requestId, tenantId, workspaceId, offeringId, publishedRevisionId,
      actor, actorMembership, beneficiaryParty,
    ]);
    return requestId;
  };
  const createMessage = async () => {
    const messageId = id();
    await pool.query(`insert into communications.private_messages(
      id,conversation_id,sender_id,client_request_id,body
    ) values($1,$2,$3,$4,'Private payload must stay in Communications')`, [
      messageId, conversationId, actorMembership, id(),
    ]);
    return messageId;
  };
  const commandFor = async (requestId, messageId, overrides = {}) => buildServiceSubjectLinkCoreCommandV1({
    context_id: contextId,
    workspace_id: workspaceId,
    service_request_id: requestId,
    expected_request_version: 1,
    reference_kind: 'message',
    reference_id: messageId,
    source_version: 1,
    relation: 'conversation',
    idempotency_key: id(),
    ...overrides.intent,
  }, {
    transaction_id: overrides.transaction_id ?? id(),
    command_id: overrides.command_id ?? id(),
    actor_id: actor,
    authority_version: overrides.authority_version ?? 1,
  });
  let authorityCalls = 0;
  let providerCalls = 0;
  let mutationCalls = 0;
  const providers = () => {
    const canonical = createServiceSubjectLinkCoreProvidersV1();
    return {
      ...canonical,
      async resolveAuthority(scope, request) {
        authorityCalls += 1;
        await scope.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
          sub: actor, role: 'authenticated', aal: 'aal2',
        })]);
        return canonical.resolveAuthority(scope, request);
      },
      async validateProviders(scope, command, authority) {
        providerCalls += 1;
        return canonical.validateProviders(scope, command, authority);
      },
      async mutate(scope, command) {
        mutationCalls += 1;
        return canonical.mutate(scope, command);
      },
    };
  };
  const effects = async requestId => (await pool.query(`select
    (select count(*)::int from service_catalog.request_subject_links where request_id=$1) links,
    (select version::int from service_catalog.requests where id=$1) request_version,
    (select count(*)::int from platform.idempotency_keys where response_ref->>'aggregate_id'=$1::text) idempotency,
    (select count(*)::int from audit.events where entity_id=$1 and action='core.service.request.subject_link') audit,
    (select count(*)::int from platform.outbox_events where aggregate_id=$1
      and event_type='core.service.request.subject_link.v1') outbox`, [requestId])).rows[0];

  const permissionDeniedRequest = await createRequest();
  const permissionDeniedMessage = await createMessage();
  await check('orders request/read without subject-link permission denies with zero writes', async () => {
    const before = await effects(permissionDeniedRequest);
    const beforeProviders = providerCalls;
    const beforeMutations = mutationCalls;
    const result = await host.execute(
      await commandFor(permissionDeniedRequest, permissionDeniedMessage), providers(),
    );
    assert.equal(result.status, 'denied');
    assert.equal(result.code, 'AUTHORITY_DENIED');
    assert.equal(providerCalls, beforeProviders);
    assert.equal(mutationCalls, beforeMutations);
    assert.deepEqual(await effects(permissionDeniedRequest), before);
  });
  await pool.query(`insert into platform.workspace_role_permissions(
    workspace_role_id,permission_id,effect
  ) values($1,$2,'allow')`, [serviceRoleId, subjectLinkPermission]);

  const deniedRequest = await createRequest();
  const deniedMessage = await createMessage();
  await check('unrelated participant audience denies with zero writes', async () => {
    const before = await effects(deniedRequest);
    const beforeMutations = mutationCalls;
    const result = await host.execute(await commandFor(deniedRequest, deniedMessage), providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.equal(mutationCalls, beforeMutations);
    assert.deepEqual(await effects(deniedRequest), before);
  });

  await pool.query(`update identity.membership_parties
    set valid_until=statement_timestamp()-interval '1 second'
    where membership_id=$1 and party_id=$2`, [recipientMembership, unrelatedParty]);
  await pool.query(`insert into identity.membership_parties(
    membership_id,tenant_id,party_id,valid_from
  ) values($1,$2,$3,statement_timestamp()-interval '1 second')`, [
    recipientMembership, tenantId, providerParty,
  ]);

  const requestId = await createRequest();
  const messageId = await createMessage();
  const committedCommand = await commandFor(requestId, messageId);
  let committed;
  await check('link, Request version, audit, outbox, idempotency and receipt commit together', async () => {
    const before = await effects(requestId);
    committed = await host.execute(committedCommand, providers());
    assert.equal(committed.status, 'committed');
    assert.equal(committed.receipt.aggregate_version, 2);
    assert.equal(committed.receipt.provider_evidence.provider_code,
      'communications.private_message_request_audience');
    assert.equal(committed.receipt.provider_evidence.source_reference, null);
    assert.deepEqual(await effects(requestId), {
      links: before.links + 1, request_version: before.request_version + 1,
      idempotency: before.idempotency + 1, audit: before.audit + 1, outbox: before.outbox + 1,
    });
    const link = await pool.query(`select id::text,request_version::int,message_id::text,
      message_version::int,relation from service_catalog.request_subject_links where request_id=$1`, [requestId]);
    assert.deepEqual(link.rows[0], {
      id: committed.receipt.mutation_id, request_version: 2,
      message_id: messageId, message_version: 1, relation: 'conversation',
    });
    const versions = await pool.query(`select
      r.version::int request_version,
      l.request_version::int link_version,
      (i.response_ref->>'aggregate_version')::int receipt_version,
      o.aggregate_version::int outbox_version
      from service_catalog.requests r
      join service_catalog.request_subject_links l on l.request_id=r.id
      join platform.idempotency_keys i
        on i.response_ref->>'aggregate_id'=r.id::text
      join platform.outbox_events o on o.aggregate_id=r.id
        and o.event_type='core.service.request.subject_link.v1'
      where r.id=$1`, [requestId]);
    assert.equal(versions.rowCount, 1);
    assert.deepEqual(versions.rows[0], {
      request_version: 2, link_version: 2, receipt_version: 2, outbox_version: 2,
    });
  });

  await check('exact replay rechecks authority and writes nothing', async () => {
    const before = await effects(requestId);
    const counts = { authorityCalls, providerCalls, mutationCalls };
    const replay = await host.execute(committedCommand, providers());
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, committed.receipt);
    assert.ok(authorityCalls > counts.authorityCalls);
    assert.equal(providerCalls, counts.providerCalls);
    assert.equal(mutationCalls, counts.mutationCalls);
    assert.deepEqual(await effects(requestId), before);
  });

  await check('changed replay conflicts before provider and writes nothing', async () => {
    const changed = await commandFor(requestId, messageId, {
      transaction_id: committedCommand.transaction_id,
      command_id: committedCommand.command_id,
      authority_version: committedCommand.authority_version,
      intent: { idempotency_key: committedCommand.idempotency_key, source_version: 2 },
    });
    const before = await effects(requestId);
    const beforeProviders = providerCalls;
    assert.deepEqual(await host.execute(changed, providers()), { status: 'denied', code: 'REPLAY_CONFLICT' });
    assert.equal(providerCalls, beforeProviders);
    assert.deepEqual(await effects(requestId), before);
  });

  await check('stale Request and message versions deny with zero writes', async () => {
    const staleRequest = await createRequest();
    const staleMessage = await createMessage();
    const writer = await pool.connect();
    try {
      await writer.query('begin');
      await writer.query('select app_private.lock_service_request_version_v1($1,$2,1)', [workspaceId, staleRequest]);
      await writer.query("update service_catalog.requests set description='Advanced',version=2 where id=$1", [staleRequest]);
      await writer.query('commit');
    } finally {
      await writer.query('rollback');
      writer.release();
    }
    const before = await effects(staleRequest);
    assert.deepEqual(await host.execute(await commandFor(staleRequest, staleMessage), providers()),
      { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    const messageRequest = await createRequest();
    assert.deepEqual(await host.execute(await commandFor(messageRequest, staleMessage, {
      intent: { source_version: 2 },
    }), providers()), { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.deepEqual(await effects(staleRequest), before);
    assert.deepEqual(await effects(messageRequest), {
      links: 0, request_version: 1, idempotency: 0, audit: 0, outbox: 0,
    });
  });

  const rollbackRequest = await createRequest();
  const rollbackMessage = await createMessage();
  await pool.query(`create function app_private.test_subject_link_audit_failure_v1()
    returns trigger language plpgsql as $$ begin
      if new.action='core.service.request.subject_link' and new.entity_id='${rollbackRequest}'::uuid then
        raise exception 'synthetic_audit_failure';
      end if;
      return new;
    end $$;
    create trigger test_subject_link_audit_failure before insert on audit.events
      for each row execute function app_private.test_subject_link_audit_failure_v1()`);
  await check('post-mutation audit failure rolls every effect back', async () => {
    const before = await effects(rollbackRequest);
    assert.deepEqual(await host.execute(await commandFor(rollbackRequest, rollbackMessage), providers()),
      { status: 'denied', code: 'TRANSACTION_FAILED' });
    assert.deepEqual(await effects(rollbackRequest), before);
  });
  await pool.query(`drop trigger test_subject_link_audit_failure on audit.events;
    drop function app_private.test_subject_link_audit_failure_v1()`);

  await check('two concurrent commands from the same Request version commit exactly once', async () => {
    const concurrentRequest = await createRequest();
    const concurrentMessage = await createMessage();
    const before = await effects(concurrentRequest);
    const results = await Promise.all([
      host.execute(await commandFor(concurrentRequest, concurrentMessage), providers()),
      host.execute(await commandFor(concurrentRequest, concurrentMessage), providers()),
    ]);
    assert.equal(results.filter(result => result.status === 'committed').length, 1);
    assert.equal(results.filter(result => result.status === 'denied').length, 1);
    assert.deepEqual(await effects(concurrentRequest), {
      links: before.links + 1, request_version: before.request_version + 1,
      idempotency: before.idempotency + 1, audit: before.audit + 1, outbox: before.outbox + 1,
    });
  });

  await check('cross-Workspace input fails closed with zero writes', async () => {
    const crossRequest = await createRequest();
    const crossMessage = await createMessage();
    const command = await commandFor(crossRequest, crossMessage);
    const before = await effects(crossRequest);
    const cross = { ...command, workspace_id: otherWorkspaceId };
    assert.equal((await host.execute(cross, providers())).status, 'denied');
    assert.deepEqual(await effects(crossRequest), before);
  });

  await check('RLS and ACL keep link table and callbacks private', async () => {
    const acl = await pool.query(`select
      has_table_privilege('public','service_catalog.request_subject_links','select') as public_table,
      has_table_privilege('authenticated','service_catalog.request_subject_links','select') as authenticated_table,
      has_table_privilege('service_role','service_catalog.request_subject_links','select') as service_table,
      has_function_privilege('public','communications.resolve_private_message_request_audience_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as public_audience_gate,
      has_function_privilege('authenticated','app_private.insert_service_request_message_link_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as authenticated_mutation,
      has_function_privilege('service_role','app_private.insert_service_request_message_link_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as service_mutation`);
    assert.deepEqual(acl.rows[0], {
      public_table: false, authenticated_table: false, service_table: false,
      public_audience_gate: false, authenticated_mutation: false, service_mutation: false,
    });
  });

  const sessionNonce = {
    primaryAal2: randomUUID(), primaryAal1: randomUUID(), secondaryAal2: randomUUID(),
  };
  const sessions = new Map([
    [sessionNonce.primaryAal2, primaryAuth.aal2],
    [sessionNonce.primaryAal1, primaryAuth.aal1],
    [sessionNonce.secondaryAal2, secondaryAuth.aal2],
  ]);
  const authenticate = async request => {
    const cookie = request.headers.get('cookie') ?? '';
    const nonce = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('sv_http_session='))
      ?.slice('sv_http_session='.length);
    const tokens = nonce ? sessions.get(nonce) : null;
    if (!tokens) return null;
    if (tokens.synthetic) {
      return {
        source: 'supabase_verified_session', actor_id: tokens.actor_id,
        assurance_level: tokens.assurance_level,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };
    }
    const auth = createSupabaseClient(authUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const installed = await auth.auth.setSession(tokens);
    if (installed.error || !installed.data.session) return null;
    const [user, assurance, current] = await Promise.all([
      auth.auth.getUser(), auth.auth.mfa.getAuthenticatorAssuranceLevel(), auth.auth.getSession(),
    ]);
    if (user.error || assurance.error || current.error || !user.data.user || !current.data.session
      || (assurance.data.currentLevel !== 'aal1' && assurance.data.currentLevel !== 'aal2')) return null;
    return {
      source: 'supabase_verified_session', actor_id: user.data.user.id,
      assurance_level: assurance.data.currentLevel,
      expires_at: current.data.session.expires_at,
    };
  };

  const httpPool = new pg.Pool({ connectionString: target.toString(), max: 1 });
  await check('HTTP adapter reads canonical authority revision with bound identity', async () => {
    assert.equal(await readServiceSubjectLinkAuthorityVersionV1(httpPool, {
      source: 'supabase_verified_session', actor_id: actor, assurance_level: 'aal2',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }), 1);
  });
  let activeHttpPool = httpPool;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers,
        ...(body.length ? { body } : {}),
      });
      const path = new URL(request.url).pathname;
      const match = /^\/isolated\/service-requests\/([0-9a-f-]+)\/subject-links$/.exec(path);
      const response = match
        ? await handleServiceSubjectLinkHttpV1(request, match[1], {
          pool: activeHttpPool, authenticate,
        })
        : new Response(JSON.stringify({ outcome: 'denied', code: 'NOT_FOUND' }), { status: 404 });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500, { 'content-type': 'application/json' });
      outgoing.end(JSON.stringify({ outcome: 'denied', code: 'ISOLATED_HANDLER_FAILURE' }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.equal(typeof address, 'object');
  const loopbackOrigin = `http://127.0.0.1:${address.port}`;
  const httpIntent = (requestId, messageId, overrides = {}) => ({
    context_id: contextId, workspace_id: workspaceId, service_request_id: requestId,
    expected_request_version: 1, reference_kind: 'message', reference_id: messageId,
    source_version: 1, relation: 'conversation', idempotency_key: randomUUID(), ...overrides,
  });
  const send = async (intent, nonce = sessionNonce.primaryAal2, headers = {}) => {
    const response = await fetch(
      `${loopbackOrigin}/isolated/service-requests/${intent.service_request_id}/subject-links`,
      { method: 'POST', headers: { origin: loopbackOrigin, 'content-type': 'application/json',
        cookie: `sv_http_session=${nonce}`, ...headers }, body: JSON.stringify(intent) },
    );
    return { response, body: await response.json() };
  };
  try {
    await check(`${realAuthAvailable ? 'real local Supabase AAL2 session' : 'synthetic AAL2 adapter'} commits through HTTP and Core host`, async () => {
      const httpRequest = await createRequest();
      const httpMessage = await createMessage();
      const intent = httpIntent(httpRequest, httpMessage);
      const before = await effects(httpRequest);
      const first = await send(intent);
      assert.equal(first.response.status, 200, JSON.stringify(first.body));
      assert.equal(first.body.outcome, 'committed');
      assert.equal(first.body.request_id, httpRequest);
      assert.equal(first.body.request_version, 2);
      assert.deepEqual(Object.keys(first.body).sort(), [
        'outcome', 'receipt_id', 'request_id', 'request_version',
      ]);
      assert.equal(first.response.headers.get('cache-control'), 'no-store, private');
      assert.deepEqual(await effects(httpRequest), {
        links: before.links + 1, request_version: 2,
        idempotency: before.idempotency + 1, audit: before.audit + 1, outbox: before.outbox + 1,
      });

      const replayBefore = await effects(httpRequest);
      const replay = await send(intent);
      assert.equal(replay.response.status, 200);
      assert.equal(replay.body.outcome, 'exact_replay');
      assert.equal(replay.body.receipt_id, first.body.receipt_id);
      assert.equal(replay.body.request_version, 2);
      assert.deepEqual(await effects(httpRequest), replayBefore);

      const changed = await send({ ...intent, source_version: 2 });
      assert.equal(changed.response.status, 409);
      assert.deepEqual(changed.body, { outcome: 'denied', code: 'IDEMPOTENCY_CONFLICT' });
      assert.deepEqual(await effects(httpRequest), replayBefore);
    });

    await check('real AAL1 and forged session stop before PostgreSQL writes', async () => {
      for (const nonce of [sessionNonce.primaryAal1, 'forged-session']) {
        const deniedRequest = await createRequest();
        const deniedMessage = await createMessage();
        const before = await effects(deniedRequest);
        const denied = await send(httpIntent(deniedRequest, deniedMessage), nonce);
        assert.equal(denied.response.status, nonce === sessionNonce.primaryAal1 ? 403 : 401);
        assert.deepEqual(await effects(deniedRequest), before);
      }
    });

    await check('missing subject-link permission denies HTTP with zero writes', async () => {
      const deniedRequest = await createRequest();
      const deniedMessage = await createMessage();
      const before = await effects(deniedRequest);
      await pool.query(`delete from platform.workspace_role_permissions
        where workspace_role_id=$1 and permission_id=$2`, [serviceRoleId, subjectLinkPermission]);
      try {
        const denied = await send(httpIntent(deniedRequest, deniedMessage));
        assert.equal(denied.response.status, 403);
        assert.deepEqual(denied.body, { outcome: 'denied', code: 'SUBJECT_LINK_DENIED' });
        assert.deepEqual(await effects(deniedRequest), before);
      } finally {
        await pool.query(`insert into platform.workspace_role_permissions(
          workspace_role_id,permission_id,effect) values($1,$2,'allow')`,
        [serviceRoleId, subjectLinkPermission]);
      }
    });

    await check('recycled connection does not leak secondary actor into the next request', async () => {
      const leakRequest = await createRequest();
      const leakMessage = await createMessage();
      const intent = httpIntent(leakRequest, leakMessage);
      const before = await effects(leakRequest);
      const secondary = await send(intent, sessionNonce.secondaryAal2);
      assert.equal(secondary.response.status, 503);
      assert.deepEqual(secondary.body, { outcome: 'denied', code: 'TRANSACTION_FAILED' });
      assert.deepEqual(await effects(leakRequest), before);
      const primary = await send(intent, sessionNonce.primaryAal2);
      assert.equal(primary.response.status, 200);
      assert.equal(primary.body.outcome, 'committed');
      assert.deepEqual(await effects(leakRequest), {
        links: 1, request_version: 2, idempotency: 1, audit: 1, outbox: 1,
      });
    });

    await check('genuine 40001 retries on a fresh transaction with the same verified actor', async () => {
      const retryRequest = await createRequest();
      const retryMessage = await createMessage();
      let injected = false;
      activeHttpPool = {
        async connect() {
          const client = await httpPool.connect();
          const wrapped = Object.create(client);
          wrapped.query = async (text, values) => {
            if (!injected && typeof text === 'string'
              && text.includes('select auth.uid()=$1::uuid as actor_bound')) {
              injected = true;
              throw Object.assign(new Error('synthetic_serialization_failure'), { code: '40001' });
            }
            return client.query(text, values);
          };
          wrapped.release = error => client.release(error);
          return wrapped;
        },
      };
      const result = await send(httpIntent(retryRequest, retryMessage));
      activeHttpPool = httpPool;
      assert.equal(injected, true);
      assert.equal(result.response.status, 200);
      assert.equal(result.body.outcome, 'committed');
      assert.deepEqual(await effects(retryRequest), {
        links: 1, request_version: 2, idempotency: 1, audit: 1, outbox: 1,
      });
    });

    await check('post-mutation HTTP failure rolls back every durable effect', async () => {
      const failedRequest = await createRequest();
      const failedMessage = await createMessage();
      await pool.query(`create function app_private.test_subject_link_http_audit_failure_v1()
        returns trigger language plpgsql as $$ begin
          if new.action='core.service.request.subject_link' and new.entity_id='${failedRequest}'::uuid then
            raise exception 'synthetic_http_audit_failure';
          end if;
          return new;
        end $$;
        create trigger test_subject_link_http_audit_failure before insert on audit.events
          for each row execute function app_private.test_subject_link_http_audit_failure_v1()`);
      try {
        const before = await effects(failedRequest);
        const failed = await send(httpIntent(failedRequest, failedMessage));
        assert.equal(failed.response.status, 503);
        assert.deepEqual(failed.body, { outcome: 'denied', code: 'TRANSACTION_FAILED' });
        assert.deepEqual(await effects(failedRequest), before);
      } finally {
        await pool.query(`drop trigger test_subject_link_http_audit_failure on audit.events;
          drop function app_private.test_subject_link_http_audit_failure_v1()`);
      }
    });
  } finally {
    activeHttpPool = httpPool;
    await new Promise(resolve => server.close(resolve));
    await httpPool.end();
  }

  console.log(`SERVICE subject link HTTP through verified local Auth and Core TX host: ${passed}/${passed} PASS`);
  console.log(JSON.stringify({
    aal2_evidence: realAuthAvailable ? 'REAL_LOCAL_SUPABASE_AUTH_MFA' : 'NOT_RUN_NOT_PASS',
    synthetic_claims: realAuthAvailable
      ? 'USED_ONLY_BY_LEGACY_DIRECT_HOST_REGRESSION'
      : 'USED_BY_LOCAL_HTTP_CONTRACT_AND_LEGACY_DIRECT_HOST_REGRESSION',
    http_transport: 'REAL_LOOPBACK_HTTP',
    database: 'LOCAL_DISPOSABLE_POSTGRESQL',
    production_activation: false,
  }));
} finally {
  await pool.end();
  if (adminPool && isolatedDatabaseName) {
    await adminPool.query(`drop database "${isolatedDatabaseName}"`);
    await adminPool.end();
  }
  for (const userId of createdAuthUsers) {
    await authAdmin?.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}
