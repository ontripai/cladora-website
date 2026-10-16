import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_TEST_DATABASE_URL;
if(!connectionString||process.env.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_EPHEMERAL!=='1'){
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
const composition=load(new URL(
  '../src/lib/customer/documents-country-retention-resolution-v1.ts',import.meta.url));
const resolver=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts',import.meta.url));
const artifactContract=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-v1.ts',import.meta.url));
const authorityPort=load(new URL(
  '../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const authorityProvider=load(new URL(
  '../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const transactionHost=load(new URL(
  '../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const pool=new pg.Pool({connectionString,max:10});
const host=transactionHost.createCorePostgresTransactionHostV1(pool);
const actor=randomUUID(),driver=createAp10CoreAuthorityDriver(pool);
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`
  :value!==null&&typeof value==='object'
    ?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,child])=>`${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
    :JSON.stringify(value);
let ids,countryCode,profileV1,profileV2,v1,v2,v1Assignment,v2Assignment;
let committedV1,hostV1Command,hostV1Result,hostAggregateVersion=900,checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const revision=async client=>Number((await client.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton'
)).rows[0].revision);
const effectDigest=async()=>{
  const result=await pool.query(`select
    (select count(*)::text from platform.idempotency_keys) idempotency,
    (select count(*)::text from audit.events) audit,
    (select count(*)::text from platform.outbox_events) outbox,
    (select count(*)::text from platform.jurisdiction_domain_artifact_receipt_evidence) evidence,
    (select count(*)::text from platform.jurisdiction_domain_artifacts) artifacts`);
  return hash(JSON.stringify(result.rows[0]));
};
const review=seed=>({status:'approved',review_version:1,
  reviewed_at:'2025-01-01T00:00:00.000Z',evidence_sha256:hash(seed)});
function artifactInput(profile,ruleCode,period,effectiveFrom){
  return artifactContract.coreJurisdictionDomainArtifactHashInputV1Schema.parse({
    contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
    profile:{profile_id:profile.id,profile_code:profile.code,profile_version:profile.version,
      country_code:countryCode,manifest_sha256:profile.manifest},
    domain:{domain_code:'documents.retention',domain_version:'documents-retention.v1',policy:{
      document_types:[{document_type_code:'invoice',retention_rule_code:ruleCode,
        retention_period:period,legal_hold_overrides_disposal:true,
        immutable_version_required:true,evidence_codes:['retention.proof']}],
      disposal_requires_review:true,residency_rule_code:'country_storage'}},
    effective_from:effectiveFrom,effective_to:null,status:'active',
    legal_review:review(`${profile.code}:documents:legal`),
    accounting_review:review(`${profile.code}:documents:accounting`),
    reusable_as_command_authority:false,
  });
}
async function installProfile(profile,input){
  const bytes=Buffer.from(canonical(input));
  const artifactSha=artifactContract.calculateJurisdictionDomainArtifactSha256V1(input);
  assert.equal(hash(bytes),artifactSha);
  await pool.query(`insert into platform.jurisdiction_profiles(id,code,version,country_code,name,
    default_currency_code,default_timezone,calendar_code,manifest_sha256,status,valid_from,
    legal_signoff_reference,legal_signed_at,accounting_signoff_reference,accounting_signed_at)
    values($1,$2,$3,$4,$5,'EUR','UTC','gregorian',$6,'draft',$7,
      'legal:disposable',now(),'accounting:disposable',now())`,[
    profile.id,profile.code,profile.version,countryCode,`Documents disposable ${profile.version}`,
    profile.manifest,profile.validFrom]);
  await pool.query(`insert into platform.jurisdiction_profile_domains(
    jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,valid_from)
    values($1,'documents.retention','documents-retention.v1',$2,true,'active',$3)`,[
    profile.id,artifactSha,profile.validFrom]);
  await pool.query(`insert into platform.jurisdiction_domain_artifacts(
    jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
    artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
    canonical_bytes,effective_from,lifecycle_status)
    values($1,$2,$3,$4,$5,'core-jurisdiction-domain-artifact.v1',1,
      'documents.retention','documents-retention.v1',$6,$7,$8,'active')`,[
    profile.id,profile.code,profile.version,countryCode,profile.manifest,artifactSha,bytes,
    input.effective_from]);
  await pool.query("update platform.jurisdiction_profiles set status='validated' where id=$1",
    [profile.id]);
  await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",
    [profile.id]);
  return{input,bytes,artifactSha};
}
async function assign(profile,version){
  const assignment=randomUUID();
  await pool.query(`insert into platform.property_jurisdiction_assignments(id,tenant_id,
    customer_workspace_id,property_id,jurisdiction_profile_id,assignment_version,country_code,
    profile_manifest_sha256,status,binding_source,reason,created_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,'active','platform_verified',
      'documents retention resolution disposable evidence',$9)`,[
    assignment,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],profile.id,version,
    countryCode,profile.manifest,actor]);
  return assignment;
}
async function beginScope({attempt=1,client:provided=null}={}){
  const client=provided??await pool.connect();
  try{
    if(!provided)await client.query('begin isolation level serializable');
    await client.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,[
      JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
    const database=(await client.query(`select txid_current()::text id,
      clock_timestamp()::text acquired_at`)).rows[0];
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
          aggregate_id:ids.propertyIds[0],acquired_at:new Date(database.acquired_at).toISOString()}}};
    const observation=await authorityProvider.resolveAuthority(scope,authorityRequest);
    const authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(
      authorityRequest,observation);
    const command={contract_version:'core-transaction-command.v1',transaction_id:transactionId,
      command_id:commandId,context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,
      authority_version:authorityVersion,permission_code:authorityRequest.permission_code,
      module_code:authorityRequest.module_code,evaluation_purpose:authorityRequest.evaluation_purpose,
      aggregate_type:'portfolio.property',aggregate_id:ids.propertyIds[0],aggregate_version:1,
      provider_source_ids:[ids.propertyIds[0]],idempotency_key:`documents-retention-${commandId}`,
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
function currentRequest(){
  return{contract_version:composition.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
    mode:'current',property_id:ids.propertyIds[0],expected_country_code:countryCode,
    document_type_code:'invoice',document_immutable_version:7,legal_hold_state:'none',
    requested_operation:'read-policy'};
}
function historicalRequest(){
  const commitment=committedV1.commitments.find(value=>
    value.fingerprint.domain_code==='documents.retention');
  assert.ok(commitment);
  return{contract_version:composition.DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
    mode:'historical',committed_evidence:{
      contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMITTED_EVIDENCE_V1,
      receipt_id:committedV1.receiptId,source_workspace_id:ids.workspaceIds[0],
      source_property_id:ids.propertyIds[0],source_actor_id:actor,
      source_transaction_id:committedV1.sourceTransactionId,
      source_command_id:committedV1.sourceCommandId,source_attempt:committedV1.sourceAttempt,
      reference:{profile_id:profileV1.id,profile_code:profileV1.code,profile_version:1,
        country_code:countryCode,profile_manifest_sha256:profileV1.manifest,
        domain_code:'documents.retention',domain_version:'documents-retention.v1',
        artifact_sha256:v1.artifactSha,effective_at:commitment.evaluated_at}},
    document_type_code:'invoice',document_immutable_version:5,legal_hold_state:'none',
    requested_operation:'retain'};
}
function hostCommand(key=randomUUID()){
  return{contract_version:'core-transaction-command.v1',transaction_id:randomUUID(),
    command_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,
    authority_version:0,permission_code:'airprop.asset.read',module_code:'airprop_commercial',
    evaluation_purpose:'airprop.country-pack.resolve',aggregate_type:'portfolio.property',
    aggregate_id:ids.propertyIds[0],aggregate_version:++hostAggregateVersion,
    provider_source_ids:[ids.propertyIds[0]],idempotency_key:`documents-retention-host-${key}`,
    input_fingerprint:`sha256:${hash(`documents-retention-host-${key}`)}`};
}
async function executableHostCommand(){
  const command=hostCommand();command.authority_version=await revision(pool);return command;
}
function hostProviders(value){
  return{jurisdiction_artifact_projection:'core-jurisdiction-domain-artifact-host-projection.v1',
    async resolveAuthority(scope,request){
      await scope.query(`select set_config('request.jwt.claims',$1,true),
        set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,[
        JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
      return authorityProvider.resolveAuthority(scope,request);
    },
    async validateProviders(){return true;},
    async resolveJurisdictionArtifacts(scope,command,authority){
      const decision=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
        scope,command,authority,{
          contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
          mode:'current',transaction_id:command.transaction_id,command_id:command.command_id,
          attempt:scope.attempt,context_id:command.context_id,workspace_id:command.workspace_id,
          actor_id:command.actor_id,authority_version:command.authority_version,
          provider_source_ids:command.provider_source_ids,lock:{kind:'command_aggregate',
            aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id},
          property_id:ids.propertyIds[0],expected_country_code:countryCode,
          domain_code:'documents.retention',domain_version:'documents-retention.v1'});
      assert.equal(decision.decision,'accepted',JSON.stringify(decision));
      return[resolver.toCoreJurisdictionDomainArtifactCommitCandidateV1(
        decision,ids.propertyIds[0])];
    },
    async mutate(scope,command){
      const result=await scope.query(`update portfolio.properties set name=$2 where id=$1
        returning id::text`,[command.aggregate_id,`Retention host ${command.command_id}`]);
      return{mutation_id:result.rows[0].id};
    }};
}
function committedEvidence(result){
  return{receiptId:result.receipt.receipt_id,sourceTransactionId:result.receipt.transaction_id,
    sourceCommandId:result.receipt.command_id,
    sourceAttempt:result.receipt.authority.transaction_context.attempt,
    commitments:result.receipt.jurisdiction_artifacts};
}

try{
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
  [actor,`documents-retention-resolution-${randomUUID()}@example.invalid`]);
  ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});
  const addressId=randomUUID();
  await pool.query(`insert into portfolio.addresses(
    id,tenant_id,country_code,county,city,street,building_no,postal_code)
    values($1,$2,'DE','Berlin','Berlin','Teststrasse','1','10115')`,[
    addressId,ids.tenantId]);
  await pool.query('update portfolio.properties set address_id=$2 where id=$1',[
    ids.propertyIds[0],addressId]);
  countryCode='DE';
  const code=`de.documents.${randomUUID().slice(0,8)}`;
  profileV1={id:randomUUID(),code,version:1,manifest:hash(`${code}:v1`),validFrom:'2025-01-01'};
  profileV2={id:randomUUID(),code,version:2,manifest:hash(`${code}:v2`),validFrom:'2026-01-01'};
  v1=await installProfile(profileV1,artifactInput(
    profileV1,'historical_statutory','P10Y','2025-01-01T00:00:00.000Z'));
  v1Assignment=await assign(profileV1,1);

  await check('Core host commits receipt evidence and exact replay does not duplicate it',async()=>{
    hostV1Command=await executableHostCommand();
    hostV1Result=await host.execute(hostV1Command,hostProviders(v1));
    assert.equal(hostV1Result.status,'committed',JSON.stringify(hostV1Result));
    committedV1=committedEvidence(hostV1Result);
    assert.equal(committedV1.commitments.length,1);
    const replay=await host.execute(hostV1Command,hostProviders(v1));
    assert.equal(replay.status,'exact_replay');
    assert.equal(replay.receipt.receipt_id,hostV1Result.receipt.receipt_id);
    const count=await pool.query(`select count(*)::int n from
      platform.jurisdiction_domain_artifact_receipt_evidence where receipt_id=$1`,[
      hostV1Result.receipt.receipt_id]);
    assert.equal(count.rows[0].n,1);
  });

  await pool.query(`update platform.property_jurisdiction_assignments
    set status='superseded',valid_to=statement_timestamp() where id=$1`,[v1Assignment]);
  await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",[
    profileV1.id]);
  v2=await installProfile(profileV2,artifactInput(
    profileV2,'current_statutory','P12Y','2026-01-01T00:00:00.000Z'));
  v2Assignment=await assign(profileV2,2);

  await check('current and historical composition remain exact after profile replacement',async()=>{
    const before=await effectDigest(),tx=await beginScope();
    try{
      const current=await composition.resolveDocumentsCountryRetentionV1(
        tx.scope,tx.command,tx.authority,currentRequest());
      assert.equal(current.decision,'accepted',JSON.stringify(current));
      assert.equal(current.evaluation.resolution.retention_rule_code,'current_statutory');
      assert.equal(current.evaluation.artifact_fingerprint.profile_version,2);
      const historical=await composition.resolveDocumentsCountryRetentionV1(
        tx.scope,tx.command,tx.authority,historicalRequest());
      assert.equal(historical.decision,'accepted',JSON.stringify(historical));
      assert.equal(historical.evaluation.resolution.retention_rule_code,'historical_statutory');
      assert.equal(historical.evaluation.artifact_fingerprint.profile_version,1);
    }finally{await finish(tx);}
    assert.equal(await effectDigest(),before);
  });

  await check('legal hold and malformed receipt evidence deny with zero write',async()=>{
    const before=await effectDigest(),tx=await beginScope();
    try{
      const held=await composition.resolveDocumentsCountryRetentionV1(tx.scope,tx.command,
        tx.authority,{...currentRequest(),requested_operation:'dispose',legal_hold_state:'active'});
      assert.equal(held.denial_reason,'EVALUATOR_DENIED');
      assert.equal(held.evaluation.denial_reason,'LEGAL_HOLD_BLOCKS_DISPOSAL');
      const request=historicalRequest();
      request.committed_evidence.reference.artifact_sha256=hash('malformed-reference');
      const malformed=await composition.resolveDocumentsCountryRetentionV1(
        tx.scope,tx.command,tx.authority,request);
      assert.equal(malformed.decision,'denied');
      assert.equal(malformed.resolver_denial_reason,'HISTORICAL_RECEIPT_UNAVAILABLE');
    }finally{await finish(tx);}
    assert.equal(await effectDigest(),before);
  });

  await check('cross-Workspace and revoked authority denial remains SELECT-only',async()=>{
    const before=await effectDigest(),tx=await beginScope();
    try{
      const request=historicalRequest();
      request.committed_evidence.source_workspace_id=randomUUID();
      const cross=await composition.resolveDocumentsCountryRetentionV1(
        tx.scope,tx.command,tx.authority,request);
      assert.equal(cross.resolver_denial_reason,'BINDING_MISMATCH');
      const revoked=await composition.resolveDocumentsCountryRetentionV1(
        tx.scope,tx.command,{...tx.authority,decision:'denied',denial_reason:'ACTOR_REVOKED'},
        currentRequest());
      assert.equal(revoked.resolver_denial_reason,'AUTHORITY_DENIED');
    }finally{await finish(tx);}
    assert.equal(await effectDigest(),before);
  });

  await check('real PostgreSQL 40001 propagates and retry reads the current artifact',async()=>{
    const first=await pool.connect(),before=await effectDigest();let errorCode=null;
    try{
      await first.query('begin isolation level serializable');
      await first.query('select count(*) from platform.jurisdiction_profiles');
      await pool.query('update platform.jurisdiction_profiles set name=name where id=$1',[
        profileV2.id]);
      const tx=await beginScope({attempt:1,client:first});
      await composition.resolveDocumentsCountryRetentionV1(
        tx.scope,tx.command,tx.authority,currentRequest());
      assert.fail('expected serialization failure');
    }catch(error){errorCode=error?.code;assert.equal(errorCode,'40001');}
    finally{await first.query('rollback').catch(()=>{});first.release();}
    const retry=await beginScope({attempt:2});
    try{
      const result=await composition.resolveDocumentsCountryRetentionV1(
        retry.scope,retry.command,retry.authority,currentRequest());
      assert.equal(result.decision,'accepted',JSON.stringify(result));
      assert.equal(result.evaluation.artifact_fingerprint.artifact_sha256,v2.artifactSha);
    }finally{await finish(retry);}
    assert.equal(await effectDigest(),before);
  });
}finally{
  if(ids){
    await driver.revoke({authority:ids});
    assert.equal(await driver.verifyRevoked({authority:ids}),true,'fixture authority cleanup');
  }
  await pool.end();
}

console.log(`Documents country retention resolution PostgreSQL: ${checks}/${checks} PASS; Remote untouched`);
