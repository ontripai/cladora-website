import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.CORE_JURISDICTION_SELECTOR_TEST_DATABASE_URL;
if(!connectionString||process.env.CORE_JURISDICTION_SELECTOR_EPHEMERAL!=='1'){
  throw new Error('Explicit disposable target required');
}
const target=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/postgres'){
  throw new Error('Local disposable PostgreSQL only');
}

const require=createRequire(import.meta.url),cache=new Map();
function load(url){
  if(cache.has(url.href))return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }});
  const mod={exports:{}};cache.set(url.href,mod.exports);
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  return mod.exports;
}

const selector=load(new URL('../src/lib/core/jurisdiction-profile-selector-v1.ts',import.meta.url));
const authorityPort=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const authorityProvider=load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const pool=new pg.Pool({connectionString,max:12});
const actor=randomUUID(),driver=createAp10CoreAuthorityDriver(pool);
const domains=['accounting.invoice','payments.local_rails','tax.vat'];
let ids,profileId,assignmentId,countryCode,checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const revision=async client=>Number((await client.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);
const effectDigest=async()=>{
  const result=await pool.query(`select
    (select count(*)::text from platform.idempotency_keys) as idempotency,
    (select count(*)::text from audit.events) as audit,
    (select count(*)::text from platform.outbox_events) as outbox`);
  return createHash('sha256').update(JSON.stringify(result.rows[0])).digest('hex');
};

async function beginScope({propertyId=ids.propertyIds[0],attempt=1,resolve=true,
  client:providedClient=null}={}){
  const client=providedClient??await pool.connect();
  try{
    if(!providedClient)await client.query('begin isolation level serializable');
    await client.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,
    [JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
    const transaction=(await client.query(`select txid_current()::text as id,
      clock_timestamp()::text as acquired_at`)).rows[0];
    const transactionId=randomUUID(),commandId=randomUUID();
    const scope=Object.freeze({transaction_id:transactionId,database_transaction_id:transaction.id,
      workspace_id:ids.workspaceIds[0],tenant_id:ids.tenantId,actor_id:actor,attempt,
      async query(text,values=[]){return client.query(text,values);}});
    const authorityVersion=await revision(client);
    const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
      decision_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],
      actor_id:actor,authority_version:authorityVersion,permission_code:'airprop.asset.read',
      module_code:'airprop_commercial',evaluation_purpose:'airprop.country-pack.select',
      transaction_context:{transaction_id:transactionId,command_id:commandId,attempt,
        isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:ids.workspaceIds[0],
          aggregate_type:'portfolio.property',aggregate_id:propertyId,
          acquired_at:new Date(transaction.acquired_at).toISOString()}}};
    let authority;
    if(resolve){
      const observation=await authorityProvider.resolveAuthority(scope,authorityRequest);
      authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,observation);
    }
    const command={contract_version:'core-transaction-command.v1',transaction_id:transactionId,
      command_id:commandId,context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,
      authority_version:authorityVersion,permission_code:authorityRequest.permission_code,
      module_code:authorityRequest.module_code,evaluation_purpose:authorityRequest.evaluation_purpose,
      aggregate_type:'portfolio.property',aggregate_id:propertyId,aggregate_version:1,
      provider_source_ids:[propertyId],idempotency_key:`country-pack-${commandId}`,
      input_fingerprint:`sha256:${createHash('sha256').update(commandId).digest('hex')}`};
    const request={contract_version:selector.CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1,
      property_id:propertyId,expected_country_code:countryCode,required_domain_codes:domains};
    return{client,scope,authority,authorityRequest,command,request,owned:!providedClient};
  }catch(error){
    if(!providedClient){await client.query('rollback').catch(()=>{});client.release();}
    throw error;
  }
}

async function finish(tx,operation='rollback'){
  if(tx.owned){await tx.client.query(operation);tx.client.release();}
}

async function selectOnce(options={}){
  const tx=await beginScope(options);
  try{
    const decision=await selector.selectCurrentPropertyJurisdictionProfileV1(
      tx.scope,tx.command,tx.authority,tx.request);
    await finish(tx,'commit');return decision;
  }catch(error){await finish(tx);throw error;}
}

async function waitForBlockedUpdate(fragment){
  for(let index=0;index<300;index+=1){
    const result=await pool.query(`select count(*)::int as n from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0`,[fragment]);
    if(result.rows[0].n>0)return;await sleep(10);
  }
  throw new Error('expected concurrent profile update to block');
}

try{
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
  [actor,`core-country-pack-${randomUUID()}@example.invalid`]);
  ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});
  const addressId=randomUUID();
  await pool.query(`insert into portfolio.addresses(
    id,tenant_id,country_code,county,city,street,building_no,postal_code)
    values($1,$2,'DE','Berlin','Berlin','Teststrasse','1','10115')`,
  [addressId,ids.tenantId]);
  await pool.query('update portfolio.properties set address_id=$2 where id=$1',
    [ids.propertyIds[0],addressId]);
  countryCode=(await pool.query(`select btrim(a.country_code::text) as country_code
    from portfolio.properties p join portfolio.addresses a on a.id=p.address_id where p.id=$1`,
  [ids.propertyIds[0]])).rows[0].country_code;
  profileId=randomUUID();assignmentId=randomUUID();
  const manifest='a'.repeat(64),profileCode=`test.${countryCode.toLowerCase()}.${randomUUID().slice(0,8)}`;
  await pool.query(`insert into platform.jurisdiction_profiles(id,code,version,country_code,name,
    default_currency_code,default_timezone,calendar_code,manifest_sha256,status,valid_from,
    legal_signoff_reference,legal_signed_at,accounting_signoff_reference,accounting_signed_at)
    values($1,$2,1,$3,$4,'EUR','UTC','gregorian',$5,'draft',current_date,
      'legal:test',now(),'accounting:test',now())`,
  [profileId,profileCode,countryCode,`Test ${countryCode} Country Pack`,manifest]);
  for(const [index,domain] of domains.entries()){
    await pool.query(`insert into platform.jurisdiction_profile_domains(
      jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from)
      values($1,$2,$3,$4,true,'active',current_date)`,
    [profileId,domain,`${countryCode.toLowerCase()}.${domain}.v1`,String(index+1).repeat(64)]);
  }
  await pool.query("update platform.jurisdiction_profiles set status='validated' where id=$1",[profileId]);
  await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",[profileId]);
  await pool.query(`insert into platform.property_jurisdiction_assignments(id,tenant_id,
    customer_workspace_id,property_id,jurisdiction_profile_id,assignment_version,country_code,
    profile_manifest_sha256,status,binding_source,reason,created_by)
    values($1,$2,$3,$4,$5,1,$6,$7,'active','platform_verified','disposable selector evidence',$8)`,
  [assignmentId,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],profileId,
    countryCode,manifest,actor]);

  await check('current property selects its signed Country Pack and exact payment/compliance domains',async()=>{
    const before=await effectDigest(),result=await selectOnce();
    assert.equal(result.decision,'accepted',JSON.stringify(result));
    assert.equal(result.binding.property_id,ids.propertyIds[0]);
    assert.equal(result.binding.country_code,countryCode);
    assert.equal(result.binding.profile_id,profileId);
    assert.deepEqual(result.binding.domains.map(value=>value.domain_code),domains);
    assert.equal(result.source_disclosure,'status_only');
    assert.equal(result.reusable_as_command_authority,false);
    assert.equal(await effectDigest(),before,'selector must not create durable writes');
  });

  await check('wrong country, property or required payment domain fail closed with zero writes',async()=>{
    const before=await effectDigest();
    const tx=await beginScope();
    try{
      const wrongCountry=await selector.selectCurrentPropertyJurisdictionProfileV1(
        tx.scope,tx.command,tx.authority,{...tx.request,
          expected_country_code:countryCode==='DE'?'IR':'DE'});
      assert.equal(wrongCountry.decision,'denied');
      assert.equal(wrongCountry.denial_reason,'CURRENT_PROPERTY_DENIED');
      const missingDomain=await selector.selectCurrentPropertyJurisdictionProfileV1(
        tx.scope,tx.command,tx.authority,{...tx.request,
          required_domain_codes:[...domains,'tax.withholding']});
      assert.equal(missingDomain.decision,'denied');
      assert.equal(missingDomain.denial_reason,'REQUIRED_DOMAIN_UNAVAILABLE');
      const wrongSource=await selector.selectCurrentPropertyJurisdictionProfileV1(
        tx.scope,{...tx.command,provider_source_ids:[]},tx.authority,tx.request);
      assert.equal(wrongSource.decision,'denied');
      assert.equal(wrongSource.denial_reason,'BINDING_MISMATCH');
    }finally{await finish(tx);}
    assert.equal(await effectDigest(),before);
  });

  await check('shared profile lock serializes suspension and subsequent selection observes it',async()=>{
    const tx=await beginScope();let pending;let closed=false;
    try{
      const decision=await selector.selectCurrentPropertyJurisdictionProfileV1(
        tx.scope,tx.command,tx.authority,tx.request);
      assert.equal(decision.decision,'accepted');
      pending=pool.query(`update platform.jurisdiction_profiles set status='suspended'
        where id=$1 /* jurisdiction-selector-concurrent-suspend */`,[profileId]);
      await waitForBlockedUpdate('jurisdiction-selector-concurrent-suspend');
      await finish(tx,'commit');closed=true;await pending;
      const denied=await selectOnce();
      assert.equal(denied.decision,'denied');
      assert.equal(denied.denial_reason,'JURISDICTION_UNAVAILABLE');
    }catch(error){if(!closed)await finish(tx).catch(()=>{});throw error;}
    finally{
      if(pending)await pending.catch(()=>{});
      await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",[profileId]);
    }
  });

  await check('revoked Workspace binding and current authority are zero-write denials',async()=>{
    const binding=(await pool.query(`select id from platform.workspace_property_bindings
      where customer_workspace_id=$1 and property_id=$2 and status='active'`,
    [ids.workspaceIds[0],ids.propertyIds[0]])).rows[0];
    await pool.query(`update platform.workspace_property_bindings
      set status='archived',valid_to=statement_timestamp() where id=$1`,[binding.id]);
    try{
      const before=await effectDigest(),result=await selectOnce();
      assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'CURRENT_PROPERTY_DENIED');
      assert.equal(await effectDigest(),before);
    }finally{
      await pool.query(`update platform.workspace_property_bindings
        set status='active',valid_to=null where id=$1`,[binding.id]);
    }
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.airprop_commercial'`,
    [ids.workspaceIds[0]]);
    try{
      const before=await effectDigest(),result=await selectOnce();
      assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'AUTHORITY_DENIED');
      assert.equal(await effectDigest(),before);
    }finally{
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.airprop_commercial'`,
      [ids.workspaceIds[0]]);
    }
  });

  await check('historical authority receipt cannot select a Country Pack in a later transaction',async()=>{
    const old=await beginScope();await finish(old,'commit');
    const current=await beginScope({resolve:false});
    try{
      const before=await effectDigest();
      const result=await selector.selectCurrentPropertyJurisdictionProfileV1(
        current.scope,current.command,old.authority,current.request);
      assert.equal(result.decision,'denied');assert.equal(result.denial_reason,'BINDING_MISMATCH');
      assert.equal(await effectDigest(),before);
    }finally{await finish(current);}
  });

  await check('a real PostgreSQL 40001 propagates and a fresh attempt sees current profile state',async()=>{
    const first=await pool.connect();let code=null;
    try{
      await first.query('begin isolation level serializable');
      await first.query('select count(*) from platform.jurisdiction_profiles');
      await pool.query("update platform.jurisdiction_profiles set status='suspended' where id=$1",[profileId]);
      const tx=await beginScope({attempt:1,client:first});
      await selector.selectCurrentPropertyJurisdictionProfileV1(
        tx.scope,tx.command,tx.authority,tx.request);
      assert.fail('expected PostgreSQL serialization failure');
    }catch(error){code=error?.code;assert.equal(code,'40001');}
    finally{await first.query('rollback').catch(()=>{});first.release();}
    try{
      const result=await selectOnce({attempt:2});
      assert.equal(result.decision,'denied');
      assert.equal(result.denial_reason,'JURISDICTION_UNAVAILABLE');
    }finally{
      await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",[profileId]);
    }
  });
}finally{
  if(ids){
    await driver.revoke({authority:ids});
    assert.equal(await driver.verifyRevoked({authority:ids}),true,'fixture authority cleanup');
  }
  await pool.end();
}

console.log(`Core jurisdiction profile selector PostgreSQL: ${checks}/${checks} PASS; no migration, Remote apply or activation`);
