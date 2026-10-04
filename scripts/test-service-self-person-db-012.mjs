import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
let db,connect;
if(process.env.CLADORA_SERVICE_REQUEST_TEST_DATABASE_URL){const pg=await import('pg');connect=async()=>{const c=new pg.Client({connectionString:process.env.CLADORA_SERVICE_REQUEST_TEST_DATABASE_URL});await c.connect();return c;};db=await connect();db.exec=sql=>db.query(sql);db.close=()=>db.end();}
else{const {PGlite}=await import(process.env.CLADORA_PGLITE_PACKAGE||'@electric-sql/pglite');db=new PGlite();}
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const [actor,tenant,workspace,context,member]=[1,2,3,4,5].map(id);
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
const reject=async(fn,code)=>assert.rejects(fn,e=>e.code===code);
const changed=async(sql,fn)=>{await db.exec('begin');try{await db.exec(sql);await fn();}finally{await db.exec('rollback');}};
try{
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema customer_api;create schema auth;create schema platform;create schema identity;create schema portfolio;create schema audit;create schema app_private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
create table platform.customer_workspaces(id uuid primary key,tenant_id uuid,environment text,lifecycle_status text);
create table identity.memberships(id uuid primary key,tenant_id uuid,user_id uuid,status text);
create table portfolio.parties(id uuid primary key default gen_random_uuid(),tenant_id uuid,type text,legal_name text,archived_at timestamptz);
create table identity.membership_parties(membership_id uuid primary key,tenant_id uuid,party_id uuid,valid_from timestamptz,valid_until timestamptz);
create table platform.idempotency_keys(tenant_id uuid,actor_id uuid,key text,request_hash text,expires_at timestamptz,response_ref jsonb,status_code int,primary key(tenant_id,key));
create table audit.events(tenant_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,after_snapshot jsonb,reason text);
create table platform.outbox_events(tenant_id uuid,aggregate_type text,aggregate_id uuid,aggregate_version bigint,event_type text,payload jsonb);
create table app_private.authority(permission text primary key);
insert into app_private.authority values('services.orders.read'),('services.orders.request');
create function app_private.service_request_authorize_v1(c uuid,w uuid,p text) returns table(tenant_id uuid,membership_id uuid) language plpgsql as $$begin
if auth.uid() is distinct from '${actor}'::uuid or c is distinct from '${context}'::uuid or w is distinct from '${workspace}'::uuid or not exists(select 1 from app_private.authority where permission=p)then raise exception 'denied' using errcode='42501';end if;
return query select '${tenant}'::uuid,'${member}'::uuid;end;$$;
insert into auth.users values('${actor}',clock_timestamp(),false);insert into identity.memberships values('${member}','${tenant}','${actor}','active');
insert into platform.customer_workspaces values('${workspace}','${tenant}','PILOT','ACTIVE');
select set_config('request.jwt.claim.sub','${actor}',false),set_config('request.jwt.claim.aal','aal2',false);`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261004200732_service_request_self_person_v1.sql',import.meta.url),'utf8'));
const command={context_id:context,workspace_id:workspace,name:'Mahmoud synthetic acceptance',valid_until:new Date(Date.now()+3600000).toISOString(),confirm_self:true,idempotency_key:'self-person-012-first'};
const send=async(body=command)=>(await q('select customer_api.register_service_self_person_v1($1::jsonb) result',[JSON.stringify(body)]))[0].result;
for(const [name,sql] of [['MFA required',"select set_config('request.jwt.claim.aal','aal1',false)"],['verified email required','update auth.users set email_confirmed_at=null'],['anonymous account denied','update auth.users set is_anonymous=true'],['own active membership required',"update identity.memberships set user_id='"+id(9)+"'"],['inactive membership denied',"update identity.memberships set status='revoked'"],['pilot required',"update platform.customer_workspaces set environment='PRODUCTION'"],['active workspace required',"update platform.customer_workspaces set lifecycle_status='SUSPENDED'"],['current request permission required',"delete from app_private.authority where permission='services.orders.request'"]])await test(name,()=>changed(sql,()=>reject(()=>send(),'42501')));
for(const field of ['actor_id','tenant_id','party_id','membership_id'])await test('reject injected '+field,()=>reject(()=>send({...command,[field]:id(9)}),'22023'));
await test('self declaration required',()=>reject(()=>send({...command,confirm_self:false}),'22023'));
for(const until of [new Date(Date.now()-3600000).toISOString(),new Date(Date.now()+73*3600000).toISOString(),'infinity'])await test('reject unbounded/past expiry',()=>reject(()=>send({...command,valid_until:until}),'22023'));
await test('foreign context denied',()=>reject(()=>send({...command,context_id:id(9)}),'42501'));
await test('atomic audit failure leaves zero identity writes',()=>changed("create function audit.fail_write() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end;$$; create trigger fail before insert on audit.events for each row execute function audit.fail_write();",async()=>{await reject(()=>send(),'P0001');}));
let result;
await test('own synthetic person, exact expiry, audit/outbox and replay',async()=>{result=await send();assert.deepEqual(await send(),result);assert.equal(Date.parse(result.valid_until),Date.parse(command.valid_until));const p=(await q('select * from portfolio.parties'))[0];assert.equal(p.legal_name,'PILOT TEST — '+command.name);assert.equal(p.tenant_id,tenant);assert.equal((await q('select * from identity.membership_parties'))[0].membership_id,member);for(const table of ['portfolio.parties','identity.membership_parties','audit.events','platform.outbox_events'])assert.equal((await q(`select count(*)::int n from ${table}`))[0].n,1);});
await test('different key cannot replace existing mapping',()=>reject(()=>send({...command,idempotency_key:'self-person-012-other'}),'23505'));
await test('changed command conflicts',()=>reject(()=>send({...command,name:'Another person'}),'23505'));
await test('revoked mapping denies replay',()=>changed('update identity.membership_parties set valid_until=clock_timestamp()-interval \'1 second\'',()=>reject(()=>send(),'42501')));
await test('revoked permission denies replay',()=>changed("delete from app_private.authority where permission='services.orders.request'",()=>reject(()=>send(),'42501')));
await test('archived person denies replay',()=>changed('update portfolio.parties set archived_at=clock_timestamp()',()=>reject(()=>send(),'42501')));
await test('function ACL excludes anonymous callers',async()=>{assert.equal((await q("select has_function_privilege('anon','customer_api.register_service_self_person_v1(jsonb)','execute') ok"))[0].ok,false);assert.equal((await q("select has_function_privilege('authenticated','customer_api.register_service_self_person_v1(jsonb)','execute') ok"))[0].ok,true);});
if(connect){
await db.exec('delete from identity.membership_parties;delete from portfolio.parties;delete from audit.events;delete from platform.outbox_events;delete from platform.idempotency_keys');
const connections=await Promise.all([connect(),connect()]);
try{for(const c of connections)await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal','aal2',false)",[actor]);
await test('separate connections: different keys produce one person',async()=>{const outcomes=await Promise.allSettled(connections.map((c,i)=>c.query('select customer_api.register_service_self_person_v1($1::jsonb)',[JSON.stringify({...command,idempotency_key:'parallel-self-person-'+i})])));assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(outcomes.find(o=>o.status==='rejected').reason.code,'23505');assert.equal((await q('select count(*)::int n from portfolio.parties'))[0].n,1);
const winner=outcomes.findIndex(o=>o.status==='fulfilled');const same={...command,idempotency_key:'parallel-self-person-'+winner};
const replays=await Promise.all(connections.map(c=>c.query('select customer_api.register_service_self_person_v1($1::jsonb) result',[JSON.stringify(same)])));assert.deepEqual(replays[0].rows[0].result,replays[1].rows[0].result);assert.equal((await q('select count(*)::int n from audit.events'))[0].n,1);});
}finally{await Promise.all(connections.map(c=>c.end()));}
}
console.log(`${count} self-person database cases passed`);
}finally{await db.close();}
