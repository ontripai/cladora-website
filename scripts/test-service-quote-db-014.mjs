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
  const submitted=await send(request);
  await db.exec('alter table platform.module_permission_bindings add requires_aal2 boolean default false');
  await db.exec(readFileSync(new URL('../supabase/migrations/20261005061344_service_quote_draft_runtime_v1.sql',import.meta.url),'utf8'));
  assert.equal((await q("select requires_aal2 from platform.module_permission_bindings b join identity.permissions p on p.id=b.permission_id where p.code='services.quotes.manage'"))[0].requires_aal2,true);
  const quote={context_id:context,workspace_id:workspace,request_id:submitted.request_id,published_revision_id:created.revision_id,scope:'Synthetic service assessment',total_minor:'9007199254740993',currency:'RON',payer_shares:[{party_id:provider,amount_minor:'9007199254740993'}],valid_until:'2099-01-01T00:00:00Z',idempotency_key:'quote-014-first'};
  const draft=async value=>(await q('select customer_api.create_service_quote_draft_v1($1::jsonb) result',[JSON.stringify(value)]))[0].result;
  const readQuotes=async(ws=workspace)=>(await q('select customer_api.read_service_quote_drafts_v1($1,$2) result',[context,ws]))[0].result;
  await check('Request permission alone cannot manage proposals',async()=>{await denied(()=>draft(quote),'42501');await denied(()=>readQuotes(),'42501');});
  await db.exec(`insert into app_private.test_authority values('${actor}','${workspace}','services.quotes.manage')`);
  let result;
  await check('Exact amounts and atomic draft/audit/outbox/replay',async()=>{
    result=await draft(quote);assert.equal(result.version,1);assert.equal(result.status,'draft');assert.deepEqual(await draft(quote),result);
    for(const [table,column] of [['service_catalog.quote_drafts','id'],['audit.events','entity_id'],['platform.outbox_events','aggregate_id']])assert.equal((await q(`select count(*)::int n from ${table} where ${column}=$1`,[result.quote_id]))[0].n,1);
    assert.equal((await readQuotes()).requests[0].quotes[0].total_minor,'9007199254740993');
  });
  await check('New version preserves original scope and total',async()=>{const second=await draft({...quote,scope:'New synthetic scope',total_minor:'0',payer_shares:[{party_id:provider,amount_minor:'0'}],idempotency_key:'quote-014-second'});assert.equal(second.version,2);const history=(await readQuotes()).requests[0].quotes;assert.equal(history.length,2);assert.equal(history[1].scope,quote.scope);assert.equal(history[1].total_minor,quote.total_minor);});
  await check('Changed payload with same key conflicts',async()=>denied(()=>draft({...quote,scope:'Changed scope'}),'23505'));
  await check('Foreign workspace cannot read or write',async()=>{await denied(()=>readQuotes(foreignWorkspace),'42501');await denied(()=>draft({...quote,workspace_id:foreignWorkspace}),'42501');});
  await check('Unrelated request is hidden',async()=>denied(()=>draft({...quote,request_id:id(99)}),'P0002'));
  await check('Historical revision cannot be replaced',async()=>denied(()=>draft({...quote,published_revision_id:id(99)}),'40001'));
  await check('Different or additional payer denied',async()=>{await denied(()=>draft({...quote,payer_shares:[{party_id:id(10),amount_minor:quote.total_minor}]}),'42501');await denied(()=>draft({...quote,payer_shares:[{party_id:provider,amount_minor:'1'},{party_id:id(10),amount_minor:'9007199254740992'}]}),'42501');});
  for(const field of ['actor_id','tenant_id','status','version','order_id','accepted_by','work_order_id'])await check(field+' injection rejected',async()=>denied(()=>draft({...quote,[field]:'injected'}),'22023'));
  for(const value of ['-1','01','1.23','1e2',123,null])await check('Noncanonical amount '+value,async()=>denied(()=>draft({...quote,total_minor:value}),'22023'));
  for(const valid_until of ['infinity','tomorrow','2000-01-01T00:00:00Z'])await check('Invalid or expired date '+valid_until,async()=>denied(()=>draft({...quote,valid_until,idempotency_key:'quote-014-expiry'}),'22023'));
  await check('Share mismatch rejected',async()=>denied(()=>draft({...quote,payer_shares:[{party_id:provider,amount_minor:'1'}]}),'22023'));
  await check('Revoked coordinator denies replay',async()=>changed("delete from app_private.test_authority where permission='services.quotes.manage'",()=>denied(()=>draft(quote),'42501')));
  await check('Expired beneficiary link denies replay',async()=>changed("update identity.membership_parties set valid_until=clock_timestamp()-interval '1 hour'",()=>denied(()=>draft(quote),'42501')));
  await check('Archived provider/beneficiary denied',async()=>changed("update portfolio.parties set archived_at=clock_timestamp()",()=>denied(()=>draft(quote),'42501')));
  await check('Stored versions cannot update or delete',async()=>{await denied(()=>q('update service_catalog.quote_drafts set scope=$1 where id=$2',['Forbidden edit',result.quote_id]),'23514');await denied(()=>q('delete from service_catalog.quote_drafts where id=$1',[result.quote_id]),'23514');});
  await check('Audit failure rolls back draft and key',async()=>{const before=(await q('select count(*)::int n from service_catalog.quote_drafts'))[0].n;await changed("alter table audit.events add constraint quote_test_audit_failure check(action<>'services.quotes.draft') not valid",()=>denied(()=>draft({...quote,idempotency_key:'quote-014-audit-fail'}),'23514'));assert.equal((await q('select count(*)::int n from service_catalog.quote_drafts'))[0].n,before);assert.equal((await q("select count(*)::int n from platform.idempotency_keys where key like '%quote-014-audit-fail'"))[0].n,0);});
  await check('Direct table and anonymous RPC access closed',async()=>{assert.equal((await q("select has_table_privilege('authenticated','service_catalog.quote_drafts','select') ok"))[0].ok,false);assert.equal((await q("select has_function_privilege('anon','customer_api.create_service_quote_draft_v1(jsonb)','execute') ok"))[0].ok,false);assert.equal((await q("select relrowsecurity ok from pg_class where oid='service_catalog.quote_drafts'::regclass"))[0].ok,true);});
  if(openConnection){
    await check('Separate connections allocate unique consecutive versions and same-key replay once',async()=>{
      const peers=await Promise.all([openConnection(),openConnection()]);
      try{for(const peer of peers)await peer.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
        const parallel=values=>Promise.all(values.map((value,i)=>peers[i].query('select customer_api.create_service_quote_draft_v1($1::jsonb) result',[JSON.stringify(value)]).then(r=>r.rows[0].result)));
        const different=await parallel([{...quote,idempotency_key:'quote-014-parallel-a'},{...quote,idempotency_key:'quote-014-parallel-b'}]);assert.deepEqual(different.map(x=>x.version).sort(),[3,4]);assert.notEqual(different[0].quote_id,different[1].quote_id);
        const same=await parallel([{...quote,idempotency_key:'quote-014-parallel-same'},{...quote,idempotency_key:'quote-014-parallel-same'}]);assert.deepEqual(same[0],same[1]);assert.equal(same[0].version,5);assert.equal((await q('select count(*)::int n from audit.events where entity_id=$1',[same[0].quote_id]))[0].n,1);
      }finally{await Promise.all(peers.map(p=>p.end()));}
    });
  }
  console.log(`${cases} actual SERVICE quote PostgreSQL scenarios passed`);
}finally{await db.close();}
