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
const transactionHost=load(new URL(
  '../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const pool=new pg.Pool({connectionString,max:12});
const host=transactionHost.createCorePostgresTransactionHostV1(pool);
const actor=randomUUID(),driver=createAp10CoreAuthorityDriver(pool);
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`
  :value!==null&&typeof value==='object'
    ?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,child])=>`${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
    :JSON.stringify(value);
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
let ids,checks=0,profileV1,profileV2,assignmentId,countryCode,v1Evidence,v1,v1Documents;
let v1HostCommand,v1HostResult;
let hostAggregateVersion=700;
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
function documentArtifactInput(profile,{effectiveFrom,effectiveTo=null,status='active'}={}){
  return artifactContract.coreJurisdictionDomainArtifactHashInputV1Schema.parse({
    contract_version:'core-jurisdiction-domain-artifact.v1',artifact_version:1,
    profile:{profile_id:profile.id,profile_code:profile.code,profile_version:profile.version,
      country_code:countryCode,manifest_sha256:profile.manifest},
    domain:{domain_code:'documents.retention',domain_version:'documents-retention.v1',policy:{
      document_types:[{document_type_code:'invoice',retention_rule_code:'statutory',
        retention_period:'P10Y',legal_hold_overrides_disposal:true,
        immutable_version_required:true,evidence_codes:['retention.proof']}],
      disposal_requires_review:true,residency_rule_code:'country_storage'}},
    effective_from:effectiveFrom,effective_to:effectiveTo,status,
    legal_review:review(`${profile.code}:documents:legal`),
    accounting_review:review(`${profile.code}:documents:accounting`),
    reusable_as_command_authority:false,
  });
}
async function installProfile(profile,input,status,additionalInputs=[]){
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
  const additional=[];
  for(const additionalInput of additionalInputs){
    additional.push(await installAdditionalArtifact(profile,additionalInput));
  }
  if(status==='active'){
    await pool.query("update platform.jurisdiction_profiles set status='validated' where id=$1",
      [profile.id]);
    await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",
      [profile.id]);
  }else{
    await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",
      [profile.id]);
  }
  return{input,bytes,artifactSha,additional};
}
async function installAdditionalArtifact(profile,input){
  const bytes=Buffer.from(canonical(input));
  const artifactSha=artifactContract.calculateJurisdictionDomainArtifactSha256V1(input);
  assert.equal(hash(bytes),artifactSha);
  await pool.query(`insert into platform.jurisdiction_profile_domains(
    jurisdiction_profile_id,domain_code,contract_version,artifact_sha256,required,status,
    valid_from,valid_to) values($1,$2,$3,$4,true,'active',$5,$6)`,[
    profile.id,input.domain.domain_code,input.domain.domain_version,artifactSha,
    profile.validFrom,profile.validTo]);
  await pool.query(`insert into platform.jurisdiction_domain_artifacts(
    jurisdiction_profile_id,profile_code,profile_version,country_code,profile_manifest_sha256,
    artifact_contract_version,artifact_version,domain_code,domain_version,artifact_sha256,
    canonical_bytes,effective_from,effective_to,lifecycle_status)
    values($1,$2,$3,$4,$5,'core-jurisdiction-domain-artifact.v1',1,$6,$7,$8,$9,$10,$11,$12)`,[
    profile.id,profile.code,profile.version,countryCode,profile.manifest,input.domain.domain_code,
    input.domain.domain_version,artifactSha,bytes,input.effective_from,input.effective_to,input.status]);
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
  const commitment=evidence.commitments.find(item=>
    item.fingerprint.domain_code===value.input.domain.domain_code
      && item.fingerprint.artifact_sha256===value.artifactSha);
  assert.ok(commitment,'committed artifact evidence required');
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
      source_command_id:evidence.sourceCommandId,source_attempt:evidence.sourceAttempt,reference:{
        profile_id:profile.id,profile_code:profile.code,profile_version:profile.version,
        country_code:countryCode,profile_manifest_sha256:profile.manifest,
        domain_code:value.input.domain.domain_code,domain_version:value.input.domain.domain_version,
        artifact_sha256:value.artifactSha,effective_at:effectiveAt??commitment.evaluated_at}}};
}
function hostCommand(key=randomUUID()){
  return{contract_version:'core-transaction-command.v1',transaction_id:randomUUID(),
    command_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,
    authority_version:0,permission_code:'airprop.asset.read',module_code:'airprop_commercial',
    evaluation_purpose:'airprop.country-pack.resolve',aggregate_type:'portfolio.property',
    aggregate_id:ids.propertyIds[0],aggregate_version:++hostAggregateVersion,
    provider_source_ids:[ids.propertyIds[0]],idempotency_key:`artifact-host-${key}`,
    input_fingerprint:`sha256:${hash(`artifact-host-${key}`)}`};
}
async function executableHostCommand(key){
  const command=hostCommand(key);
  command.authority_version=await revision(pool);
  return command;
}
function hostProviders(domains,{providerDenied=false,mutationFailure=false,
  beforeResolve}={}){
  return{
    jurisdiction_artifact_projection:'core-jurisdiction-domain-artifact-host-projection.v1',
    async resolveAuthority(scope,request){
      await scope.query(`select set_config('request.jwt.claims',$1,true),
        set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,
      [JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
      return authorityProvider.resolveAuthority(scope,request);
    },
    async validateProviders(){return !providerDenied;},
    async resolveJurisdictionArtifacts(scope,command,authority){
      if(beforeResolve)await beforeResolve(scope,command,authority);
      const decisions=[];
      for(const domain of domains){
        const decision=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
          scope,command,authority,{
            contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
            mode:'current',transaction_id:command.transaction_id,command_id:command.command_id,
            attempt:scope.attempt,context_id:command.context_id,workspace_id:command.workspace_id,
            actor_id:command.actor_id,authority_version:command.authority_version,
            provider_source_ids:command.provider_source_ids,lock:{kind:'command_aggregate',
              aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id},
            property_id:ids.propertyIds[0],expected_country_code:countryCode,
            domain_code:domain.input.domain.domain_code,
            domain_version:domain.input.domain.domain_version});
        assert.equal(decision.decision,'accepted',JSON.stringify(decision));
        decisions.push(resolver.toCoreJurisdictionDomainArtifactCommitCandidateV1(
          decision,ids.propertyIds[0]));
      }
      return decisions.reverse();
    },
    async mutate(scope,command){
      const mutation=await scope.query(`update portfolio.properties set name=$2
        where id=$1 returning id::text`,[command.aggregate_id,`Artifact host ${command.command_id}`]);
      if(mutationFailure)throw new Error('synthetic artifact mutation rollback');
      if(mutation.rowCount!==1)throw new Error('artifact aggregate unavailable');
      return{mutation_id:mutation.rows[0].id};
    },
  };
}
function committedEvidence(result){
  assert.ok(['committed','exact_replay'].includes(result.status));
  assert.ok(result.receipt.jurisdiction_artifacts?.length>0);
  return{receiptId:result.receipt.receipt_id,
    sourceTransactionId:result.receipt.transaction_id,
    sourceCommandId:result.receipt.command_id,
    sourceAttempt:result.receipt.authority.transaction_context.attempt,
    commitments:result.receipt.jurisdiction_artifacts};
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
    validFrom:'2025-01-01',validTo:null};
  profileV2={id:randomUUID(),code,version:2,manifest:hash(`${code}:v2`),
    validFrom:'2026-01-01',validTo:null};
  v1=await installProfile(profileV1,artifactInput(profileV1,{
    effectiveFrom:'2025-01-01T00:00:00.000Z'}),'active',[
    documentArtifactInput(profileV1,{effectiveFrom:'2025-01-01T00:00:00.000Z'})]);
  [v1Documents]=v1.additional;
  const v1Assignment=randomUUID();
  await pool.query(`insert into platform.property_jurisdiction_assignments(id,tenant_id,
    customer_workspace_id,property_id,jurisdiction_profile_id,assignment_version,country_code,
    profile_manifest_sha256,status,binding_source,reason,created_by)
    values($1,$2,$3,$4,$5,1,$6,$7,'active','platform_verified',
      'disposable host evidence source',$8)`,[
    v1Assignment,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],profileV1.id,
    countryCode,profileV1.manifest,actor]);
  await check('real Core host commit atomically projects two sorted artifact domains',async()=>{
    const command=await executableHostCommand();v1HostCommand=command;
    const result=await host.execute(command,hostProviders([v1Documents,v1]));v1HostResult=result;
    assert.equal(result.status,'committed',JSON.stringify(result));
    assert.deepEqual(result.receipt.jurisdiction_artifacts.map(value=>value.fingerprint.domain_code),
      ['address.structure','documents.retention']);
    const rows=await pool.query(`select artifact_ordinal,domain_code,receipt_id::text,
      source_transaction_id::text,source_command_id::text,source_attempt
      from platform.jurisdiction_domain_artifact_receipt_evidence
      where receipt_id=$1 order by artifact_ordinal`,[result.receipt.receipt_id]);
    assert.equal(rows.rowCount,2);assert.deepEqual(rows.rows.map(row=>row.domain_code),
      ['address.structure','documents.retention']);
    assert.ok(rows.rows.every(row=>row.receipt_id===result.receipt.receipt_id
      && row.source_transaction_id===result.receipt.transaction_id
      && row.source_command_id===result.receipt.command_id
      && row.source_attempt===result.receipt.authority.transaction_context.attempt));
    v1Evidence=committedEvidence(result);
    const tx=await beginScope();
    try{
      for(const value of [v1,v1Documents]){
        const historical=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(tx.scope,
          tx.command,tx.authority,historicalRequest(tx,profileV1,value,null));
        assert.equal(historical.decision,'accepted',JSON.stringify(historical));
      }
    }finally{await finish(tx);}
  });
  await pool.query(`update platform.property_jurisdiction_assignments
    set status='superseded',valid_to=statement_timestamp() where id=$1`,[v1Assignment]);
  await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",
    [profileV1.id]);
  const v2=await installProfile(profileV2,artifactInput(profileV2,{
    effectiveFrom:'2026-01-01T00:00:00.000Z'}),'active');
  assignmentId=randomUUID();
  await pool.query(`insert into platform.property_jurisdiction_assignments(id,tenant_id,
    customer_workspace_id,property_id,jurisdiction_profile_id,assignment_version,country_code,
    profile_manifest_sha256,status,binding_source,reason,created_by)
    values($1,$2,$3,$4,$5,2,$6,$7,'active','platform_verified',
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

  await check('exact replay returns the same receipt without duplicate artifact evidence',async()=>{
    const before=await pool.query(`select count(*)::int n from
      platform.jurisdiction_domain_artifact_receipt_evidence where receipt_id=$1`,
    [v1HostResult.receipt.receipt_id]);
    const replay=await host.execute(v1HostCommand,hostProviders([v1Documents,v1]));
    assert.equal(replay.status,'exact_replay');
    assert.deepEqual(replay.receipt,v1HostResult.receipt);
    const after=await pool.query(`select count(*)::int n from
      platform.jurisdiction_domain_artifact_receipt_evidence where receipt_id=$1`,
    [v1HostResult.receipt.receipt_id]);
    assert.equal(before.rows[0].n,2);assert.equal(after.rows[0].n,2);
  });

  await check('provider denial and mutation rollback leave zero artifact evidence',async()=>{
    for(const options of [{providerDenied:true},{mutationFailure:true}]){
      const command=await executableHostCommand();
      const before=await pool.query(`select count(*)::int n from
        platform.jurisdiction_domain_artifact_receipt_evidence`);
      const result=await host.execute(command,hostProviders([v2],options));
      assert.equal(result.status,'denied');
      const after=await pool.query(`select count(*)::int n from
        platform.jurisdiction_domain_artifact_receipt_evidence`);
      assert.equal(after.rows[0].n,before.rows[0].n);
      const sideEffects=await pool.query(`select
        (select count(*)::int from platform.idempotency_keys where key=$1) idempotency,
        (select count(*)::int from audit.events where request_id=$2) audit,
        (select count(*)::int from platform.outbox_events where trace_id=$2) outbox`,[
        `core-tx.v1:${command.workspace_id}:${command.idempotency_key}`,command.command_id]);
      assert.deepEqual(sideEffects.rows[0],{idempotency:0,audit:0,outbox:0});
    }
  });

  await check('real PostgreSQL 40001 retries and projects only the final attempt',async()=>{
    const command=await executableHostCommand();let provoked=false;
    const result=await host.execute(command,hostProviders([v2],{async beforeResolve(scope){
      if(scope.attempt!==1||provoked)return;provoked=true;
      await scope.query('select count(*) from platform.jurisdiction_profiles');
      await pool.query('update platform.jurisdiction_profiles set name=name where id=$1',
        [profileV2.id]);
    }}));
    assert.equal(provoked,true);assert.equal(result.status,'committed',JSON.stringify(result));
    assert.equal(result.receipt.authority.transaction_context.attempt,2);
    const evidence=await pool.query(`select source_attempt,count(*)::int n from
      platform.jurisdiction_domain_artifact_receipt_evidence where receipt_id=$1
      group by source_attempt`,[result.receipt.receipt_id]);
    assert.deepEqual(evidence.rows,[{source_attempt:2,n:1}]);
  });

  await check('unknown commit readback preserves the same receipt and evidence',async()=>{
    const command=await executableHostCommand();
    const uncertain=transactionHost.createCorePostgresTransactionHostV1({async connect(){
      const client=await pool.connect();
      return{release:client.release.bind(client),async query(text,values){
        const result=await client.query(text,values);
        if(text==='commit')throw new Error('synthetic commit acknowledgement loss');
        return result;
      }};
    }});
    const first=await uncertain.execute(command,hostProviders([v2]));
    assert.deepEqual(first,{status:'unknown_commit',code:'READBACK_REQUIRED'});
    const stored=await pool.query(`select receipt_id::text,count(*)::int n from
      platform.jurisdiction_domain_artifact_receipt_evidence
      where source_transaction_id=$1 and source_command_id=$2 group by receipt_id`,
    [command.transaction_id,command.command_id]);
    assert.equal(stored.rowCount,1);assert.equal(stored.rows[0].n,1);
    const replay=await host.execute(command,hostProviders([v2]));
    assert.equal(replay.status,'exact_replay');assert.equal(replay.receipt.receipt_id,
      stored.rows[0].receipt_id);
    const after=await pool.query(`select count(*)::int n from
      platform.jurisdiction_domain_artifact_receipt_evidence where receipt_id=$1`,
    [replay.receipt.receipt_id]);
    assert.equal(after.rows[0].n,1);
  });

  await check('historical v1 remains exact after v2 activation and gap never substitutes v2',async()=>{
    const tx=await beginScope();
    try{
      const exact=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(tx.scope,
        tx.command,tx.authority,historicalRequest(tx,profileV1,v1,null));
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
    const activeArtifact=(await pool.query(`select id::text,jurisdiction_profile_id::text,
      profile_code,profile_version,btrim(country_code::text) country_code,
      profile_manifest_sha256,domain_code,domain_version,artifact_sha256
      from platform.jurisdiction_domain_artifacts where jurisdiction_profile_id=$1
        and artifact_sha256=$2`,[profileV2.id,v2.artifactSha])).rows[0];
    await assert.rejects(pool.query(`insert into
      platform.jurisdiction_domain_artifact_receipt_evidence(
        receipt_id,artifact_ordinal,evidence_contract_version,tenant_id,workspace_id,
        source_property_id,source_actor_id,source_transaction_id,source_command_id,source_attempt,
        source_idempotency_key,source_receipt_contract_version,authority_decision_id,
        resolver_decision_id,artifact_id,jurisdiction_profile_id,profile_code,profile_version,
        country_code,profile_manifest_sha256,domain_code,domain_version,artifact_sha256,effective_at)
      values($1,1,'core-jurisdiction-domain-artifact-committed-evidence.v1',$2,$3,$4,$5,$6,$7,1,
        $8,'core-transaction-receipt.v1',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        clock_timestamp())`,[randomUUID(),ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],actor,
      randomUUID(),randomUUID(),`fake-${randomUUID()}`,randomUUID(),randomUUID(),activeArtifact.id,
      activeArtifact.jurisdiction_profile_id,activeArtifact.profile_code,activeArtifact.profile_version,
      activeArtifact.country_code,activeArtifact.profile_manifest_sha256,activeArtifact.domain_code,
      activeArtifact.domain_version,activeArtifact.artifact_sha256]),error=>error?.code==='55000');
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
        receipt_id,artifact_ordinal,evidence_contract_version,tenant_id,workspace_id,
        source_property_id,source_actor_id,source_transaction_id,source_command_id,source_attempt,
        source_idempotency_key,source_receipt_contract_version,authority_decision_id,
        resolver_decision_id,artifact_id,
        jurisdiction_profile_id,profile_code,profile_version,country_code,
        profile_manifest_sha256,domain_code,domain_version,artifact_sha256,effective_at)
      values($1,1,'core-jurisdiction-domain-artifact-committed-evidence.v1',$2,$3,$4,$5,$6,$7,1,
        $8,'core-transaction-receipt.v1',$9,$10,$11,$12,$13,1,$14,$15,
        'address.structure','address-structure.v1',$16,'2026-06-01')`,[
      fakeReceipt,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],actor,
      randomUUID(),randomUUID(),`fake-${randomUUID()}`,randomUUID(),randomUUID(),artifact.id,
      profile.id,profile.code,countryCode,
      profile.manifest,artifactSha]),error=>error?.code==='55000');
    await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",
      [profile.id]);
    const tx=await beginScope();
    try{
      const request=historicalRequest(tx,profileV1,v1,null);
      request.committed_evidence={...request.committed_evidence,receipt_id:fakeReceipt,
        source_transaction_id:randomUUID(),source_command_id:randomUUID(),reference:{
          profile_id:profile.id,profile_code:profile.code,profile_version:1,country_code:countryCode,
          profile_manifest_sha256:profile.manifest,domain_code:'address.structure',
          domain_version:'address-structure.v1',artifact_sha256:artifactSha,
          effective_at:'2026-06-01T00:00:00.000Z'}};
      const decision=await resolver.resolveHistoricalJurisdictionDomainArtifactV1(tx.scope,
        tx.command,tx.authority,request);
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
          'guard_jurisdiction_domain_artifact_receipt_evidence_v1',
          'assert_jurisdiction_domain_artifact_host_receipt_v1')`);
    assert.equal(functions.rowCount,4);
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
