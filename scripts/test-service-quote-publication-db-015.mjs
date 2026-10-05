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
  const submitted=await send(request);
  await db.exec('alter table platform.module_permission_bindings add requires_aal2 boolean default false');
  await db.exec(readFileSync(new URL('../supabase/migrations/20261005061344_service_quote_draft_runtime_v1.sql',import.meta.url),'utf8'));
  assert.equal((await q("select requires_aal2 from platform.module_permission_bindings b join identity.permissions p on p.id=b.permission_id where p.code='services.quotes.manage'"))[0].requires_aal2,true);
  const quote={context_id:context,workspace_id:workspace,request_id:submitted.request_id,published_revision_id:created.revision_id,scope:'Synthetic service assessment',total_minor:'9007199254740993',currency:'RON',payer_shares:[{party_id:provider,amount_minor:'9007199254740993'}],valid_until:'2099-01-01T00:00:00Z',idempotency_key:'quote-014-first'};
  const draft=async value=>(await q('select customer_api.create_service_quote_draft_v1($1::jsonb) result',[JSON.stringify(value)]))[0].result;
  await db.exec(readFileSync(new URL('../supabase/migrations/20261005073529_service_quote_publication_v1.sql',import.meta.url),'utf8'));
  await db.exec(`insert into app_private.test_authority values('${actor}','${workspace}','services.quotes.manage'),('${approver}','${workspace}','services.orders.read')`);
  const first=await draft(quote);
  const publication={context_id:context,workspace_id:workspace,quote_id:first.quote_id,expected_version:1,idempotency_key:'publish-015-first'};
  const publish=async(value=publication)=>(await q('select customer_api.publish_service_quote_v1($1::jsonb) result',[JSON.stringify(value)]))[0].result;
  const readPublications=async(mode='recipient',ws=workspace)=>(await q('select customer_api.read_service_quote_publications_v1($1,$2,$3) result',[context,ws,mode]))[0].result;
  await check('Draft management does not grant publication',async()=>{await denied(()=>publish(),'42501');assert.equal((await readPublications('coordinator')).can_publish,false);});
  await check('Unpublished drafts are never visible to recipient',async()=>assert.equal((await readPublications()).quotes.length,0));
  await db.exec(`insert into app_private.test_authority values('${actor}','${workspace}','services.quotes.publish')`);
  await check('Publish permission requires AAL2 binding',async()=>assert.equal((await q("select requires_aal2 from platform.module_permission_bindings b join identity.permissions p on p.id=b.permission_id where p.code='services.quotes.publish'"))[0].requires_aal2,true));
  await check('Atomic publication and exact same-key replay',async()=>{const result=await publish();assert.equal(result.status,'presented');assert.deepEqual(await publish(),result);
    assert.equal((await q('select count(*)::int n from service_catalog.quote_publications where quote_id=$1',[first.quote_id]))[0].n,1);
    for(const table of ['audit.events','platform.outbox_events'])assert.equal((await q(`select count(*)::int n from ${table} where ${table==='audit.events'?'entity_type':'aggregate_type'}='service_quote_publication'`))[0].n,1);
  });
  await check('Own published version preserves exact monetary snapshot',async()=>{const result=await readPublications();assert.equal(result.can_publish,false);assert.equal(result.quotes.length,1);assert.equal(result.quotes[0].total_minor,quote.total_minor);assert.equal(result.quotes[0].state,'presented');});
  await check('Other actor cannot see requester data even sharing fixture membership',async()=>{await setActor(approver);assert.equal((await readPublications()).quotes.length,0);await setActor(actor);});
  await check('Own actor cannot read via different membership',async()=>changed(`update identity.membership_parties set membership_id='${id(99)}'`,async()=>assert.equal((await readPublications()).quotes.length,0)));
  await check('Foreign workspace and null/invalid modes fail closed',async()=>{await denied(()=>readPublications('recipient',foreignWorkspace),'42501');await denied(()=>publish({...publication,workspace_id:foreignWorkspace}),'42501');for(const mode of [null,'admin',''])await denied(()=>readPublications(mode),'22023');});
  await check('Missing quote cannot be published',async()=>denied(()=>publish({...publication,quote_id:id(99)}),'P0002'));
  await check('Wrong expected version conflicts',async()=>denied(()=>publish({...publication,expected_version:2}),'40001'));
  await check('Different key cannot publish same quote twice',async()=>denied(()=>publish({...publication,idempotency_key:'publish-015-another'}),'23505'));
  for(const field of ['actor_id','tenant_id','accepted_by','payment_id','status','total_minor'])await check(field+' injection rejected',async()=>denied(()=>publish({...publication,[field]:'injected'}),'22023'));
  for(const expected_version of [null,0,-1,1.5,'1',1000000001])await check('Invalid version '+expected_version,async()=>denied(()=>publish({...publication,expected_version}),'22023'));
  await check('Revocation blocks exact replay',async()=>changed("delete from app_private.test_authority where permission='services.quotes.publish'",()=>denied(()=>publish(),'42501')));
  await check('Expired beneficiary link closes reads and replay',async()=>changed("update identity.membership_parties set valid_until=clock_timestamp()-interval '1 hour'",async()=>{assert.equal((await readPublications()).quotes.length,0);await denied(()=>publish(),'42501');}));
  await check('Archived parties close reads and replay',async()=>changed("update portfolio.parties set archived_at=clock_timestamp()",async()=>{assert.equal((await readPublications()).quotes.length,0);await denied(()=>publish(),'42501');}));
  await check('Publication records cannot be altered',async()=>{await denied(()=>q('delete from service_catalog.quote_publications'),'23514');await denied(()=>q('update service_catalog.quote_publications set published_at=clock_timestamp()'),'23514');});
  const second=await draft({...quote,idempotency_key:'quote-015-second'});
  const secondPublication={...publication,quote_id:second.quote_id,expected_version:2,idempotency_key:'publish-015-second'};
  await check('New draft supersedes old presentation without exposing the draft',async()=>{const data=await readPublications();assert.equal(data.quotes.length,1);assert.equal(data.quotes[0].state,'superseded');await denied(()=>publish({...publication,idempotency_key:'publish-015-stale'}),'40001');assert.equal((await publish()).version,1);});
  await check('Expiry blocks new publication but does not invent acceptance',async()=>changed("alter table service_catalog.quote_drafts disable trigger service_quote_immutable; alter table service_catalog.quote_drafts drop constraint quote_drafts_check; update service_catalog.quote_drafts set valid_until='2000-01-01'",async()=>{assert.equal((await publish()).status,'presented');await denied(()=>publish(secondPublication),'40001');}));
  await check('Audit failure rolls back publication and retry key',async()=>{await changed("alter table audit.events add constraint publication_audit_fail check(action<>'services.quotes.publish') not valid",()=>denied(()=>publish(secondPublication),'23514'));assert.equal((await q('select count(*)::int n from service_catalog.quote_publications where quote_id=$1',[second.quote_id]))[0].n,0);assert.equal((await q("select count(*)::int n from platform.idempotency_keys where key like '%publish-015-second'"))[0].n,0);});
  await check('Outbox failure rolls back publication',async()=>{await changed("alter table platform.outbox_events add constraint publication_outbox_fail check(event_type<>'services.quotes.presented') not valid",()=>denied(()=>publish(secondPublication),'23514'));assert.equal((await q('select count(*)::int n from service_catalog.quote_publications where quote_id=$1',[second.quote_id]))[0].n,0);});
  await check('Closed ACL and RLS',async()=>{for(const role of ['anon','authenticated','service_role'])assert.equal((await q('select has_table_privilege($1,$2,$3) ok',[role,'service_catalog.quote_publications','select']))[0].ok,false);assert.equal((await q("select has_function_privilege('anon','customer_api.publish_service_quote_v1(jsonb)','execute') ok"))[0].ok,false);assert.equal((await q("select relrowsecurity ok from pg_class where oid='service_catalog.quote_publications'::regclass"))[0].ok,true);});
  if(openConnection)await check('Two connections publish exactly once and serialize against new versions',async()=>{
    const peers=await Promise.all([openConnection(),openConnection()]);
    try{for(const peer of peers)await peer.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
      const pair=await Promise.all(peers.map(peer=>peer.query('select customer_api.publish_service_quote_v1($1::jsonb) result',[JSON.stringify(secondPublication)])));assert.deepEqual(pair[0].rows,pair[1].rows);
      const third=await draft({...quote,idempotency_key:'quote-015-third'});
      await peers[0].query('begin');await peers[0].query('select id from service_catalog.requests where id=$1 for update',[submitted.request_id]);
      await peers[0].query('select customer_api.create_service_quote_draft_v1($1::jsonb)',[JSON.stringify({...quote,idempotency_key:'quote-015-fourth'})]);
      const waiting=peers[1].query('select customer_api.publish_service_quote_v1($1::jsonb)',[JSON.stringify({...publication,quote_id:third.quote_id,expected_version:3,idempotency_key:'publish-015-race'})]);
      const rejected=denied(()=>waiting,'40001');await peers[0].query('commit');await rejected;
    }finally{await Promise.all(peers.map(peer=>peer.end()));}
  });
  console.log(`${cases} SERVICE publication PostgreSQL scenarios passed`);
}finally{await db.close();}
