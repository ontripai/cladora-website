import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Actual SQL migration in isolated PostgreSQL. Canonical authority is a bounded
// fixture here; its actual implementation is exercised by the native-core suite.
// PGlite covers sequential behavior locally. The optional disposable PostgreSQL
// mode also exercises concurrent claims and stale writers over separate sockets.
let db;
let openConnection;
if (process.env.CLADORA_SERVICE_REQUEST_TEST_DATABASE_URL) {
  const pg = await import(process.env.CLADORA_PG_PACKAGE || 'pg');
  const Client = pg.Client ?? pg.default.Client;
  openConnection = async () => { const client = new Client({ connectionString: process.env.CLADORA_SERVICE_REQUEST_TEST_DATABASE_URL }); await client.connect(); return client; };
  const client = await openConnection();
  db = { query: (sql, args) => client.query(sql, args), exec: sql => sql ? client.query(sql) : Promise.resolve(), close: () => client.end() };
} else {
  const { PGlite } = await import(process.env.CLADORA_PGLITE_PACKAGE || '@electric-sql/pglite');
  db = new PGlite();
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [tenant, otherTenant, workspace, foreignWorkspace, actor, approver, context, definition, provider] = Array.from({ length: 9 }, (_, i) => id(i + 1));
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
let cases = 0;
async function check(name, fn) { await fn(); cases++; console.log(`PASS ${name}`); }
const labels = { ro: 'Serviciu', en: 'Service', fa: 'خدمت' };
const revision = { labels, description: labels, acquisition_mode: 'direct', price: { kind: 'fixed', amount: '120.50', currency: 'RON', tax_display: 'included' },
  valid_from: '2026-01-01T00:00:00Z', valid_until: null, cancellation_terms: labels, acceptance_criteria: labels, document_version_ids: [] };
const command = { context_id: context, workspace_id: workspace, definition_id: definition, provider_party_id: provider, revision, idempotency_key: 'create-001' };
const setActor = sub => q("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
const mutate = async (kind, request) => (await q('select customer_api.mutate_service_catalog_v1($1,$2::jsonb) as result', [kind, JSON.stringify(request)]))[0].result;
const list = async ws => (await q('select customer_api.list_service_catalog_v1($1,$2) as result', [context, ws ?? workspace]))[0].result;
const denied = async (fn, code) => assert.rejects(fn, error => error.code === code);
async function changed(sql, fn) { await db.exec('begin'); try { await db.exec(sql); await fn(); } finally { await db.exec('rollback'); } }
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema identity; create schema platform; create schema portfolio; create schema audit; create schema app_private; create schema customer_api;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table platform.tenants(id uuid primary key);
    create table platform.customer_workspaces(id uuid primary key,tenant_id uuid references platform.tenants);
    create table portfolio.parties(id uuid primary key,tenant_id uuid references platform.tenants,archived_at timestamptz);
    create table identity.permissions(id uuid primary key default gen_random_uuid(),code text unique,resource text,action text,description text);
    create table platform.module_definitions(id uuid primary key default gen_random_uuid(),code text,version integer default 1,name text,labels_json jsonb,description text,category text,lifecycle_status text,entitlement_key text,published_at timestamptz,unique(code,version));
    create table platform.module_permission_bindings(module_definition_id uuid,permission_id uuid,binding_version integer default 1,permission_mode text,is_delegable boolean,unique(module_definition_id,permission_id,binding_version));
    create table platform.idempotency_keys(tenant_id uuid,actor_id uuid,key text,request_hash text,response_ref jsonb,status_code integer,created_at timestamptz default statement_timestamp(),expires_at timestamptz,primary key(tenant_id,key));
    create table platform.outbox_events(tenant_id uuid,aggregate_type text,aggregate_id uuid,aggregate_version bigint,event_type text,payload jsonb,unique(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type));
    create table audit.events(tenant_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,before_snapshot jsonb,after_snapshot jsonb,reason text);
    create table app_private.test_authority(actor_id uuid,workspace_id uuid,permission text);
    create function app_private.resolve_workspace_native_context_v2(p_context uuid,p_workspace uuid) returns table(tenant_id uuid,membership_id uuid) language plpgsql as $$ begin
      if p_context is distinct from '${context}'::uuid or auth.uid() is null or not exists(select 1 from app_private.test_authority a where a.actor_id=auth.uid() and a.workspace_id=p_workspace) then raise exception 'denied' using errcode='42501'; end if;
      return query select w.tenant_id,'${id(20)}'::uuid from platform.customer_workspaces w where w.id=p_workspace;
    end; $$;
    create function app_private.check_workspace_native_permission_v2(p_context uuid,p_workspace uuid,p_permission text,p_module text) returns boolean language sql as $$ select p_module in('services_catalog','services_orders') and p_context='${context}'::uuid and exists(select 1 from app_private.test_authority a where a.actor_id=auth.uid() and a.workspace_id=p_workspace and a.permission=p_permission) $$;
    insert into platform.tenants values('${tenant}'),('${otherTenant}');
    insert into platform.customer_workspaces values('${workspace}','${tenant}'),('${foreignWorkspace}','${otherTenant}');
    insert into auth.users values('${actor}'),('${approver}');
    insert into portfolio.parties values('${provider}','${tenant}',null),('${id(10)}','${otherTenant}',null);
    insert into app_private.test_authority select u.id,'${workspace}'::uuid,p from auth.users u cross join unnest(array['services.catalog.read','services.catalog.manage','services.catalog.publish']) p;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261003141918_service_catalog_persistence_v1.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261003144507_service_catalog_definition_command_v1.sql', import.meta.url), 'utf8'));
  await db.exec("alter table portfolio.parties add legal_name text not null default 'Provider'");
  await db.exec(readFileSync(new URL('../supabase/migrations/20261003151823_service_catalog_management_read_v1.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into service_catalog.definitions(id,tenant_id,workspace_id,code,labels) values('${definition}','${tenant}','${workspace}','elevator', '${JSON.stringify(labels)}')`);
  await setActor(actor);

  await db.exec(`
    create table identity.memberships(id uuid primary key);
    insert into identity.memberships values('${id(20)}');
    create table identity.membership_parties(membership_id uuid primary key,tenant_id uuid,party_id uuid,valid_from timestamptz,valid_until timestamptz);
    insert into identity.membership_parties values('${id(20)}','${tenant}','${provider}',statement_timestamp()-interval '1 day',null);
    create table platform.module_dependencies(module_definition_id uuid,required_module_definition_id uuid,unique(module_definition_id,required_module_definition_id));
    create table platform.property_profiles(id uuid);create table platform.operating_models(id uuid);
    create table platform.module_property_profile_compatibilities(module_definition_id uuid,property_profile_id uuid,compatibility_level text,reason text,unique(module_definition_id,property_profile_id));
    create table platform.module_operating_model_compatibilities(module_definition_id uuid,operating_model_id uuid,compatibility_level text,reason text,unique(module_definition_id,operating_model_id));
    insert into app_private.test_authority values('${actor}','${workspace}','services.orders.read'),('${actor}','${workspace}','services.orders.request');
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261004181358_service_request_persistence_v1.sql',import.meta.url),'utf8'));
  const created=await mutate('create',command);
  await mutate('transition',{context_id:context,workspace_id:workspace,offering_id:created.offering_id,revision_id:created.revision_id,expected_lock_version:1,action:'submit',reason:'Synthetic request test',idempotency_key:'request-test-submit'});
  await setActor(approver);
  await mutate('transition',{context_id:context,workspace_id:workspace,offering_id:created.offering_id,revision_id:created.revision_id,expected_lock_version:2,action:'publish',reason:'Independent test review',idempotency_key:'request-test-publish'});
  await setActor(actor);
  const request={context_id:context,workspace_id:workspace,offering_id:created.offering_id,published_revision_id:created.revision_id,beneficiary_party_id:provider,description:'Synthetic test request',idempotency_key:'request-010-first'};
  const send=async value=>(await q('select customer_api.create_service_request_v1($1::jsonb) result',[JSON.stringify(value)]))[0].result;
  const read=async()=>(await q('select customer_api.read_service_requests_v1($1,$2) result',[context,workspace]))[0].result;
  await check('Own verified beneficiary and no unrelated person disclosed',async()=>{assert.deepEqual((await read()).beneficiaries,[{party_id:provider,label:'Provider'}]);});
  let result;
  await check('Request, audit, outbox and exact replay are atomic',async()=>{result=await send(request);assert.deepEqual(await send(request),result);for(const [table,column] of [['service_catalog.requests','id'],['audit.events','entity_id'],['platform.outbox_events','aggregate_id']])assert.equal((await q(`select count(*)::int n from ${table} where ${column}=$1`,[result.request_id]))[0].n,1);assert.equal((await read()).requests.length,1);});
  await check('Reusing key with changed description conflicts',async()=>denied(()=>send({...request,description:'Changed description'}),'23505'));
  await check('Unrelated beneficiary is denied',async()=>denied(()=>send({...request,beneficiary_party_id:id(10),idempotency_key:'request-010-other'}),'42501'));
  await check('Expired person mapping denies saved replay',async()=>changed(`update identity.membership_parties set valid_until=statement_timestamp()-interval '1 hour'`,()=>denied(()=>send(request),'42501')));
  await check('Revoked permission denies saved replay',async()=>changed("delete from app_private.test_authority where permission='services.orders.request'",()=>denied(()=>send(request),'42501')));
  await check('Wrong workspace denied',async()=>denied(()=>send({...request,workspace_id:foreignWorkspace}),'42501'));
  for(const status of ['draft','submitted','suspended','archived'])await check(status+' is unavailable',async()=>changed(`update service_catalog.revisions set status='${status}' where id='${created.revision_id}'`,()=>denied(()=>send({...request,idempotency_key:'request-010-'+status}),'40001')));
  await check('Stale published revision denied',async()=>denied(()=>send({...request,published_revision_id:id(30),idempotency_key:'request-010-stale'}),'40001'));
  await check('Inactive definition denied',async()=>changed(`update service_catalog.definitions set active=false`,()=>denied(()=>send({...request,idempotency_key:'request-010-inactive'}),'40001')));
  await check('Archived provider denied',async()=>changed(`update portfolio.parties set archived_at=statement_timestamp() where id='${provider}'`,()=>denied(()=>send({...request,idempotency_key:'request-010-archived'}),'42501')));
  for(const field of ['actor_id','tenant_id','amount','payer_id','status','work_order_id'])await check(field+' injection rejected',async()=>denied(()=>send({...request,[field]:'injected'}),'22023'));
  for(const [mode,start,end] of [['reservation','2026-01-01T00:00:00Z',null],['pre_quote','2099-01-01T00:00:00Z',null],['pre_quote','2020-01-01T00:00:00Z','2020-02-01T00:00:00Z']])await check('Unavailable time/capacity cannot create request: '+mode+start,async()=>{
    const key='unavailable-'+mode+start.slice(0,4);
    const row=await mutate('create',{...command,idempotency_key:key,revision:{...revision,acquisition_mode:mode,price:{kind:'quote_required'},valid_from:start,valid_until:end}});
    // Expired publications cannot be created by the real publisher; the fixture
    // moves the status only to test defensive request intake independently.
    await db.exec(`update service_catalog.revisions set status='published' where id='${row.revision_id}';update service_catalog.offerings set published_revision_id='${row.revision_id}' where id='${row.offering_id}'`);
    await denied(()=>send({...request,offering_id:row.offering_id,published_revision_id:row.revision_id,idempotency_key:key+'-request'}),'40001');
  });
  await check('Audit failure rolls back request and key',async()=>{
    await db.exec(`create function app_private.reject_request_audit() returns trigger language plpgsql as $$begin if new.entity_type='service_request' then raise exception 'audit unavailable';end if;return new;end;$$;create trigger request_audit_failure before insert on audit.events for each row execute function app_private.reject_request_audit()`);
    try{await denied(()=>send({...request,idempotency_key:'request-010-audit-fail'}),'P0001');assert.equal((await q('select count(*)::int n from service_catalog.requests'))[0].n,1);assert.equal((await q("select count(*)::int n from platform.idempotency_keys where key like '%request-010-audit-fail'"))[0].n,0);}finally{await db.exec('drop trigger request_audit_failure on audit.events');}
  });
  await check('Other actor cannot read history',async()=>{await setActor(approver);try{await denied(read,'42501');}finally{await setActor(actor);}});
  if(openConnection)await check('Independent concurrent connections execute one request',async()=>{const clients=await Promise.all([openConnection(),openConnection()]);try{await Promise.all(clients.map(c=>c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor])));const responses=await Promise.all(clients.map(c=>c.query('select customer_api.create_service_request_v1($1::jsonb) result',[JSON.stringify({...request,idempotency_key:'request-010-concurrent'})])));assert.deepEqual(responses[0].rows,responses[1].rows);const requestId=responses[0].rows[0].result.request_id;for(const [table,column] of [['service_catalog.requests','id'],['audit.events','entity_id'],['platform.outbox_events','aggregate_id']])assert.equal((await q(`select count(*)::int n from ${table} where ${column}=$1`,[requestId]))[0].n,1);}finally{await Promise.all(clients.map(c=>c.end()));}});
  console.log(`${cases} SERVICE request PostgreSQL scenarios passed`);
}finally{await db.close();}
