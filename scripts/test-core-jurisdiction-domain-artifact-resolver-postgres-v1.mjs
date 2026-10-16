import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.CORE_JURISDICTION_ARTIFACT_RESOLVER_TEST_DATABASE_URL;
if(!connectionString||process.env.CORE_JURISDICTION_ARTIFACT_RESOLVER_EPHEMERAL!=='1'){
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
const resolver=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts',import.meta.url));
const artifactContract=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-v1.ts',import.meta.url));
const selector=load(new URL('../src/lib/core/jurisdiction-profile-selector-v1.ts',import.meta.url));
const authorityPort=load(new URL(
  '../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const authorityProvider=load(new URL(
  '../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const pool=new pg.Pool({connectionString,max:12});
const actor=randomUUID(),driver=createAp10CoreAuthorityDriver(pool);
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`
  :value!==null&&typeof value==='object'
    ?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,child])=>`${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
    :JSON.stringify(value);
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
let ids,checks=0,profileV1,profileV2,assignmentId,countryCode,v1Evidence;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const revision=async client=>Number((await client.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton'
)).rows[0].revision);
const effectDigest=async()=>{
  const result=await pool.query(`select
    (select count(*)::text from platform.idempotency_keys) as idempotency,
    (select count(*)::text from audit.events) as audit,
    (select count(*)::text from platform.outbox_events) as outbox,
    (select count(*)::text from platform.jurisdiction_domain_artifacts) as artifacts,
    (select count(*)::text from platform.jurisdiction_domain_artifact_receipt_evidence) as evidence`);
  return hash(JSON.stringify(result.rows[0]));
};
const review=seed=>({status:'approved',review_version:1,
  reviewed_at:'2025-01-01T00:00:00.000Z',evidence_sha256:hash(seed)});
function artifactInput(profile,{effectiveFrom,effectiveTo=null,status='active'}={}){
  return artifactContract.coreJurisdictionDomainArtifactHashInputV1Schema.parse({
    contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
    profile:{profile_id:profile.id,profile_code:profile.code,profile_version:profile.version,
      country_code:countryCode,manifest_sha256:profile.manifest},
    domain:{domain_code:'address.structure',domain_version:'address-structure.v1',policy:{
      country_source:'explicit_address_country',forbidden_country_inference_sources:[
        'currency','ip_address','language','locale','phone_number','timezone'],
      ordered_fields:[{field_code:'country_code',required:true,max_length:2},
        {field_code:'postal_code',required:true,max_length:32}],postal_code:{
        value_type:'country_text',required:true,globally_unique:false,normalization:'trim',
        validation:{kind:'country_artifact_grammar',formats:[{
          segments:[{kind:'digits',length:5}]}]}}}},effective_from:effectiveFrom,
    effective_to:effectiveTo,status,legal_review:review(`${profile.code}:legal`),
    accounting_review:review(`${profile.code}:accounting`),
    reusable_as_command_authority:false,
  });
}
async function installProfile(profile,input,status){
  const bytes=Buffer.from(canonical(input));
  const artifactSha=artifactContract.calculateJurisdictionDomainArtifactSha256V1(input);
  assert.equal(hash(bytes),artifactSha);
  await pool.query(`insert into platform.jurisdiction_profiles(id,code,version,country_code,name,
    default_currency_code,default_timezone,calendar_code,manifest_sha256,status,valid_from,valid_to,
    legal_signoff_reference,legal_signed_at,accounting_signoff_reference,accounting_signed_at)
    values($1,$2,$3,$4,$5,'EUR','UTC','gregorian',$6,'draft',$7,$8,
      'legal:disposable',now(),'accounting:disposable',now())`,
  [profile.id,profile.code,profile.version,countryCode,`Disposable ${profile.version}`,
    profile.manifest,profile.validFrom,profile.validTo]);
  await pool.query(`insert into platform.jurisdiction_profile_domains(
    jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,
    valid_from,valid_to) values($1,'address.structure','address-structure.v1',$2,true,'active',$3,$4)`,
  [profile.id,artifactSha,profile.validFrom,profile.validTo]);
  await pool.query(`insert into platform.jurisdiction_domain_artifacts(
    jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
    artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
    canonical_bytes,effective_from,effective_to,lifecycle_status)
    values($1,$2,$3,$4,$5,'core-jurisdiction-domain-artifact.v1',1,
      'address.structure','address-structure.v1',$6,$7,$8,$9,$10)`,
  [profile.id,profile.code,profile.version,countryCode,profile.manifest,artifactSha,bytes,
    input.effective_from,input.effective_to,input.status]);
  if(status==='active'){
    await pool.query("update platform.jurisdiction_profiles set status='validated' where id=$1",
      [profile.id]);
    await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",
      [profile.id]);
  }else{
    await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",
      [profile.id]);
  }
  return{input,bytes,artifactSha};
}
async function beginScope({attempt=1,client:provided=null,resolve=true}={}){
  const client=provided??await pool.connect();
  try{
    if(!provided)await client.query('begin isolation level serializable');
    await client.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,
    [JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
    const database=(await client.query(`select txid_current()::text as id,
      clock_timestamp()::text as acquired_at`)).rows[0];
    const transactionId=randomUUID(),commandId=randomUUID(),authorityVersion=await revision(client);
    const scope=Object.freeze({transaction_id:transactionId,database_transaction_id:database.id,
      workspace_id:ids.workspaceIds[0],tenant_id:ids.tenantId,actor_id:actor,attempt,
      async query(text,values=[]){return client.query(text,values);}});
    const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
      decision_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],
      actor_id:actor,authority_version:authorityVersion,permission_code:'airprop.asset.read',
      module_code:'airprop_commercial',evaluation_purpose:'airprop.country-pack.resolve',
      transaction_context:{transaction_id:transactionId,command_id:commandId,attempt,
        isolation_level:'serializable',lock:{kind:'command_aggregate',
          workspace_id:ids.workspaceIds[0],aggregate_type:'portfolio.property',
          aggregate_id:ids.propertyIds[0],
          acquired_at:new Date(database.acquired_at).toISOString()}}};
    let authority;
    if(resolve){
      const observation=await authorityProvider.resolveAuthority(scope,authorityRequest);
      authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest,observation);
    }
    const command={contract_version:'core-transaction-command.v1',transaction_id:transactionId,
      command_id:commandId,context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,
      authority_version:authorityVersion,permission_code:authorityRequest.permission_code,
      module_code:authorityRequest.module_code,evaluation_purpose:authorityRequest.evaluation_purpose,
      aggregate_type:'portfolio.property',aggregate_id:ids.propertyIds[0],aggregate_version:1,
      provider_source_ids:[ids.propertyIds[0]],idempotency_key:`artifact-${commandId}`,
      input_fingerprint:`sha256:${hash(commandId)}`};
    return{client,scope,authority,command,owned:!provided};
  }catch(error){
    if(!provided){await client.query('rollback').catch(()=>{});client.release();}
    throw error;
  }
}
async function finish(tx,operation='rollback'){
  if(tx.owned){await tx.client.query(operation);tx.client.release();}
}
async function currentRequest(tx){
  return{contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
    mode:'current',transaction_id:tx.command.transaction_id,command_id:tx.command.command_id,
    attempt:tx.scope.attempt,context_id:tx.command.context_id,workspace_id:tx.command.workspace_id,
    actor_id:tx.command.actor_id,authority_version:tx.command.authority_version,
    provider_source_ids:tx.command.provider_source_ids,lock:{kind:'command_aggregate',
      aggregate_type:tx.command.aggregate_type,aggregate_id:tx.command.aggregate_id},
    property_id:ids.propertyIds[0],expected_country_code:countryCode,
    domain_code:'address.structure',domain_version:'address-structure.v1'};
}
async function selectAndResolve(tx){
  const decision=await resolver.resolveCurrentJurisdictionDomainArtifactV1(tx.scope,tx.command,
    tx.authority,await currentRequest(tx));
  return{decision};
}
function historicalRequest(tx,profile,value,effectiveAt,evidence=v1Evidence){
  return{contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
    mode:'historical',transaction_id:tx.command.transaction_id,
    command_id:tx.command.command_id,attempt:tx.scope.attempt,context_id:tx.command.context_id,
    workspace_id:tx.command.workspace_id,actor_id:tx.command.actor_id,
    authority_version:tx.command.authority_version,provider_source_ids:tx.command.provider_source_ids,
    lock:{kind:'command_aggregate',aggregate_type:tx.command.aggregate_type,
      aggregate_id:tx.command.aggregate_id},committed_evidence:{
      contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMITTED_EVIDENCE_V1,
      receipt_id:evidence.receiptId,source_workspace_id:ids.workspaceIds[0],
      source_property_id:ids.propertyIds[0],source_actor_id:actor,
      source_transaction_id:evidence.sourceTransactionId,
      source_command_id:evidence.sourceCommandId,source_attempt:1,reference:{
        profile_id:profile.id,profile_code:profile.code,profile_version:profile.version,
        country_code:countryCode,profile_manifest_sha256:profile.manifest,
        domain_code:'address.structure',domain_version:'address-structure.v1',
        artifact_sha256:value.artifactSha,effective_at:effectiveAt}}};
}
async function recordCommittedEvidence(profile,value,effectiveAt){
  const artifact=(await pool.query(`select id::text from platform.jurisdiction_domain_artifacts
    where jurisdiction_profile_id=$1 and artifact_sha256=$2`,[profile.id,value.artifactSha])).rows[0];
  const receiptId=randomUUID(),sourceTransactionId=randomUUID(),sourceCommandId=randomUUID();
  await pool.query(`insert into platform.jurisdiction_domain_artifact_receipt_evidence(
    receipt_id,tenant_id,workspace_id,source_property_id,source_actor_id,
    source_transaction_id,source_command_id,source_attempt,artifact_id,
    jurisdiction_profile_id,profile_code,profile_version,country_code,
    profile_manifest_sha256,domain_code,domain_version,artifact_sha256,effective_at)
    values($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12,$13,
      'address.structure','address-structure.v1',$14,$15)`,[
    receiptId,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],actor,
    sourceTransactionId,sourceCommandId,artifact.id,profile.id,profile.code,profile.version,
    countryCode,profile.manifest,value.artifactSha,effectiveAt]);
  return{receiptId,sourceTransactionId,sourceCommandId};
}
async function waitForBlocked(fragment){
  for(let index=0;index<300;index+=1){
    const result=await pool.query(`select count(*)::int n from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0`,
    [fragment]);
    if(result.rows[0].n>0)return;
    await sleep(10);
  }
  throw new Error('expected concurrent profile mutation to block');
}

try{
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
  [actor,`core-artifact-resolver-${randomUUID()}@example.invalid`]);
  ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});
  const addressId=randomUUID();
  await pool.query(`insert into portfolio.addresses(
    id,tenant_id,country_code,county,city,street,building_no,postal_code)
    values($1,$2,'DE','Berlin','Berlin','Teststrasse','1','10115')`,
  [addressId,ids.tenantId]);
  await pool.query('update portfolio.properties set address_id=$2 where id=$1',
    [ids.propertyIds[0],addressId]);
  countryCode='DE';
  const code=`de.disposable.${randomUUID().slice(0,8)}`;
  profileV1={id:randomUUID(),code,version:1,manifest:hash(`${code}:v1`),
    validFrom:'2025-01-01',validTo:'2026-01-01'};
  profileV2={id:randomUUID(),code,version:2,manifest:hash(`${code}:v2`),
    validFrom:'2026-01-01',validTo:null};
  const v1=await installProfile(profileV1,artifactInput(profileV1,{
    effectiveFrom:'2025-01-01T00:00:00.000Z',effectiveTo:'2026-01-01T00:00:00.000Z'}),'active');
  v1Evidence=await recordCommittedEvidence(profileV1,v1,'2025-06-01T00:00:00.000Z');
  await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",
    [profileV1.id]);
  const v2=await installProfile(profileV2,artifactInput(profileV2,{
    effectiveFrom:'2026-01-01T00:00:00.000Z'}),'active');
  assignmentId=randomUUID();
  await pool.query(`insert into platform.property_jurisdiction_assignments(id,tenant_id,
    customer_workspace_id,property_id,jurisdiction_profile_id,assignment_version,country_code,
    profile_manifest_sha256,status,binding_source,reason,created_by)
    values($1,$2,$3,$4,$5,1,$6,$7,'active','platform_verified',
      'disposable artifact resolver evidence',$8)`,
  [assignmentId,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],profileV2.id,
    countryCode,profileV2.manifest,actor]);

  await check('current selector and resolver share one transaction, authority and locked v2 bytes',async()=>{
    const before=await effectDigest(),tx=await beginScope();
    try{
      const {decision}=await selectAndResolve(tx);
      assert.equal(decision.decision,'accepted',JSON.stringify(decision));
      assert.equal(decision.artifact.artifact_sha256,v2.artifactSha);
      assert.equal(decision.reusable_as_command_authority,false);
    }finally{await finish(tx);}
    assert.equal(await effectDigest(),before);
  });

  await check('historical v1 remains exact after v2 activation and gap never substitutes v2',async()=>{
    const tx=await beginScope();
    try{
      const exact=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(tx.scope,
        tx.command,tx.authority,historicalRequest(tx,profileV1,v1,'2025-06-01T00:00:00.000Z'));
      assert.equal(exact.decision,'accepted',JSON.stringify(exact));
      assert.equal(exact.artifact.artifact_sha256,v1.artifactSha);
      const gap=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(tx.scope,
        tx.command,tx.authority,
        historicalRequest(tx,profileV1,v1,'2026-06-01T00:00:00.000Z'));
      assert.equal(gap.decision,'denied');
      assert.equal(gap.denial_reason,'HISTORICAL_RECEIPT_UNAVAILABLE');
    }finally{await finish(tx);}
  });

  await check('cross-transaction selector decision cannot survive profile revocation',async()=>{
    const first=await beginScope();let oldSelection;
    try{
      oldSelection=await selector.selectCurrentPropertyJurisdictionProfileV1(first.scope,
        first.command,first.authority,{
          contract_version:selector.CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1,
          property_id:ids.propertyIds[0],expected_country_code:countryCode,
          required_domain_codes:['address.structure']});
      assert.equal(oldSelection.decision,'accepted');
    }finally{await finish(first,'commit');}
    await pool.query("update platform.jurisdiction_profiles set status='suspended' where id=$1",
      [profileV2.id]);
    const before=await effectDigest(),second=await beginScope();
    try{
      const injected=await resolver.resolveCurrentJurisdictionDomainArtifactV1(second.scope,
        second.command,second.authority,{...await currentRequest(second),selection:oldSelection});
      assert.equal(injected.decision,'denied');
      assert.equal(injected.denial_reason,'BINDING_MISMATCH');
      const current=await resolver.resolveCurrentJurisdictionDomainArtifactV1(second.scope,
        second.command,second.authority,await currentRequest(second));
      assert.equal(current.decision,'denied');
      assert.equal(current.denial_reason,'PROFILE_SELECTION_UNAVAILABLE');
    }finally{
      await finish(second);
      await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",
        [profileV2.id]);
    }
    assert.equal(await effectDigest(),before);
  });

  await check('canonical bytes are immutable and missing, tampered or overlapping rows are rejected',async()=>{
    await assert.rejects(pool.query(`update platform.jurisdiction_domain_artifacts
      set lifecycle_status='retired' where jurisdiction_profile_id=$1`,[profileV1.id]),
    error=>error?.code==='42501');
    await assert.rejects(pool.query(`delete from platform.jurisdiction_domain_artifacts
      where jurisdiction_profile_id=$1`,[profileV1.id]),error=>error?.code==='42501');
    await assert.rejects(pool.query(`insert into platform.jurisdiction_domain_artifacts(
      jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
      artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
      canonical_bytes,effective_from,effective_to,lifecycle_status)
      values($1,$2,1,$3,$4,'core-jurisdiction-domain-artifact.v1',1,
        'address.structure','address-structure.v1',$5,null,$6,$7,'active')`,
    [profileV1.id,profileV1.code,countryCode,profileV1.manifest,v1.artifactSha,
      v1.input.effective_from,v1.input.effective_to]),error=>['22023','23502'].includes(error?.code));
    await assert.rejects(pool.query(`insert into platform.jurisdiction_domain_artifacts(
      jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
      artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
      canonical_bytes,effective_from,effective_to,lifecycle_status)
      values($1,$2,1,$3,$4,'core-jurisdiction-domain-artifact.v1',1,
        'address.structure','address-structure.v1',$5,$6,$7,$8,'active')`,
    [profileV1.id,profileV1.code,countryCode,profileV1.manifest,v1.artifactSha,
      Buffer.from(v1.bytes.toString('utf8').replace('"active"','"draft"')),
      v1.input.effective_from,v1.input.effective_to]),
    error=>['22000','23514'].includes(error?.code));
    await assert.rejects(pool.query(`insert into platform.jurisdiction_domain_artifacts(
      jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
      artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
      canonical_bytes,effective_from,effective_to,lifecycle_status)
      select jurisdiction_profile_id,profile_code,profile_version,country_code,
        profile_manifest_sha256,artifact_contract_version,artifact_version,domain_code,
        domain_version,artifact_sha256,canonical_bytes,effective_from,effective_to,lifecycle_status
      from platform.jurisdiction_domain_artifacts where jurisdiction_profile_id=$1`,[profileV1.id]),
    error=>['23505','23P01'].includes(error?.code));
  });

  await check('never-activated artifact cannot create committed evidence and fake receipt is denied',async()=>{
    const profile={id:randomUUID(),code:`de.malformed.${randomUUID().slice(0,8)}`,version:1,
      manifest:hash('malformed-manifest'),validFrom:'2026-01-01',validTo:null};
    const malformed={contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
      profile:{profile_id:profile.id,profile_code:profile.code,profile_version:1,
        country_code:countryCode,manifest_sha256:profile.manifest},
      domain:{domain_code:'address.structure',domain_version:'address-structure.v1'},
      effective_from:'2026-01-01T00:00:00.000Z',effective_to:null,status:'active',
      reusable_as_command_authority:false};
    const bytes=Buffer.from(canonical(malformed)),artifactSha=hash(bytes);
    await pool.query(`insert into platform.jurisdiction_profiles(id,code,version,country_code,name,
      default_currency_code,default_timezone,calendar_code,manifest_sha256,status,valid_from)
      values($1,$2,1,$3,'Malformed disposable','EUR','UTC','gregorian',$4,'draft','2026-01-01')`,
    [profile.id,profile.code,countryCode,profile.manifest]);
    await pool.query(`insert into platform.jurisdiction_profile_domains(
      jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from)
      values($1,'address.structure','address-structure.v1',$2,true,'active','2026-01-01')`,
    [profile.id,artifactSha]);
    await pool.query(`insert into platform.jurisdiction_domain_artifacts(
      jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
      artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
      canonical_bytes,effective_from,lifecycle_status)
      values($1,$2,1,$3,$4,'core-jurisdiction-domain-artifact.v1',1,
        'address.structure','address-structure.v1',$5,$6,'2026-01-01','active')`,
    [profile.id,profile.code,countryCode,profile.manifest,artifactSha,bytes]);
    const artifact=(await pool.query(`select id::text from platform.jurisdiction_domain_artifacts
      where jurisdiction_profile_id=$1`,[profile.id])).rows[0];
    const fakeReceipt=randomUUID();
    await assert.rejects(pool.query(`insert into
      platform.jurisdiction_domain_artifact_receipt_evidence(
        receipt_id,tenant_id,workspace_id,source_property_id,source_actor_id,
        source_transaction_id,source_command_id,source_attempt,artifact_id,
        jurisdiction_profile_id,profile_code,profile_version,country_code,
        profile_manifest_sha256,domain_code,domain_version,artifact_sha256,effective_at)
      values($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,1,$11,$12,
        'address.structure','address-structure.v1',$13,'2026-06-01')`,[
      fakeReceipt,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],actor,
      randomUUID(),randomUUID(),artifact.id,profile.id,profile.code,countryCode,
      profile.manifest,artifactSha]),error=>error?.code==='55000');
    await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",
      [profile.id]);
    const tx=await beginScope();
    try{
      const value={artifactSha};
      const decision=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(tx.scope,
        tx.command,tx.authority,
        historicalRequest(tx,profile,value,'2026-06-01T00:00:00.000Z',{
          receiptId:fakeReceipt,sourceTransactionId:randomUUID(),sourceCommandId:randomUUID()}));
      assert.equal(decision.decision,'denied');
      assert.equal(decision.denial_reason,'HISTORICAL_RECEIPT_UNAVAILABLE');
    }finally{await finish(tx);}
  });

  await check('revoked authority, cross-Workspace and source-lock mismatches are zero-query denials',async()=>{
    const before=await effectDigest(),tx=await beginScope();
    try{
      const request=await currentRequest(tx);
      for(const [changedAuthority,changedRequest] of [
        [{...tx.authority,decision:'denied',denial_reason:'ACTOR_REVOKED'},request],
        [tx.authority,{...request,workspace_id:randomUUID()}],
        [tx.authority,{...request,provider_source_ids:[]}],
      ]){
        const noQuery={...tx.scope,query(){throw new Error('must not query');}};
        const decision=await resolver.resolveCurrentJurisdictionDomainArtifactV1(noQuery,
          tx.command,changedAuthority,changedRequest);
        assert.equal(decision.decision,'denied');
      }
    }finally{await finish(tx);}
    assert.equal(await effectDigest(),before);
  });

  await check('FOR SHARE serializes concurrent assignment move until resolution completes',async()=>{
    const tx=await beginScope();let pending,closed=false;
    try{
      const {decision}=await selectAndResolve(tx);assert.equal(decision.decision,'accepted');
      const second=await pool.connect();
      pending=(async()=>{try{await second.query('begin');await second.query(
        `update platform.property_jurisdiction_assignments set status='superseded',valid_to=now()
          where id=$1 /* artifact-resolver-concurrent-assignment-move */`,[assignmentId]);
        await second.query('rollback');}finally{second.release();}})();
      await waitForBlocked('artifact-resolver-concurrent-assignment-move');
      await finish(tx,'commit');closed=true;await pending;
      const state=await pool.query(`select status::text
        from platform.property_jurisdiction_assignments where id=$1`,[assignmentId]);
      assert.equal(state.rows[0].status,'active');
    }catch(error){if(!closed)await finish(tx).catch(()=>{});throw error;}
    finally{if(pending)await pending.catch(()=>{});}
  });

  await check('real PostgreSQL 40001 propagates and a fresh attempt observes suspension',async()=>{
    const first=await pool.connect();let code=null;
    try{
      await first.query('begin isolation level serializable');
      await first.query('select count(*) from platform.jurisdiction_profiles');
      await pool.query("update platform.jurisdiction_profiles set status='suspended' where id=$1",
        [profileV2.id]);
      const tx=await beginScope({attempt:1,client:first});
      await selectAndResolve(tx);assert.fail('expected serialization failure');
    }catch(error){code=error?.code;assert.equal(code,'40001');}
    finally{await first.query('rollback').catch(()=>{});first.release();}
    try{
      const tx=await beginScope({attempt:2});
      try{
        const {decision}=await selectAndResolve(tx);
        assert.equal(decision.decision,'denied');
        assert.equal(decision.denial_reason,'PROFILE_SELECTION_UNAVAILABLE');
      }finally{await finish(tx);}
    }finally{
      await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",
        [profileV2.id]);
    }
  });

  await check('RLS, ACL, canonical owner and recursive membership remain fail-closed',async()=>{
    const tables=await pool.query(`select c.relname,c.relrowsecurity,c.relowner::regrole::text owner,
      has_table_privilege('anon',c.oid,'SELECT') anon_select,
      has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select,
      has_table_privilege('service_role',c.oid,'SELECT') service_select
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='platform' and c.relname in
        ('jurisdiction_domain_artifacts','jurisdiction_domain_artifact_receipt_evidence')
      order by c.relname`);
    assert.equal(tables.rowCount,2);
    for(const table of tables.rows){
      assert.equal(table.relrowsecurity,true);
      assert.notEqual(table.owner,'cladora_ce_guide_executor');
      assert.equal(table.anon_select,false);assert.equal(table.authenticated_select,false);
      assert.equal(table.service_select,false);
    }
    const functions=await pool.query(`select p.proname,p.prosecdef,p.proowner::regrole::text owner,
      coalesce((select bool_or(a.privilege_type='EXECUTE')
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0),false) public_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') service_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='app_private' and p.proname in
        ('canonical_jsonb_text_v1','guard_jurisdiction_domain_artifact_v1',
          'guard_jurisdiction_domain_artifact_receipt_evidence_v1')`);
    assert.equal(functions.rowCount,3);
    for(const fn of functions.rows){
      assert.equal(fn.owner,'cladora_rpc_owner');assert.equal(fn.public_execute,false);
      assert.equal(fn.anon_execute,false);assert.equal(fn.authenticated_execute,false);
      assert.equal(fn.service_execute,false);
    }
    const owner=(await pool.query(`select rolcanlogin,rolsuper,rolbypassrls
      from pg_roles where rolname='cladora_rpc_owner'`)).rows[0];
    assert.deepEqual(owner,{rolcanlogin:false,rolsuper:false,rolbypassrls:false});
    const unsafe=await pool.query(`with recursive reachable(roleid) as(
      select oid from pg_roles where rolname='cladora_ce_guide_executor'
      union select m.roleid from pg_auth_members m join reachable r on m.member=r.roleid)
      select count(*)::int n from reachable r join pg_roles p on p.oid=r.roleid
      where p.rolname='cladora_rpc_owner' or p.rolsuper or p.rolbypassrls`);
    assert.equal(unsafe.rows[0].n,0);
  });
}finally{
  if(ids){
    await driver.revoke({authority:ids});
    assert.equal(await driver.verifyRevoked({authority:ids}),true,'fixture authority cleanup');
  }
  await pool.end();
}

console.log(`Core jurisdiction domain artifact resolver PostgreSQL: ${checks}/${checks} PASS; Remote untouched`);
