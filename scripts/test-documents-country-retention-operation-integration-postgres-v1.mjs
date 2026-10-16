import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.DOCUMENTS_COUNTRY_RETENTION_OPERATION_TEST_DATABASE_URL;
if(!connectionString||process.env.DOCUMENTS_COUNTRY_RETENTION_OPERATION_EPHEMERAL!=='1'){
  throw new Error('Explicit disposable target required');
}
const targetDatabase=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(targetDatabase.hostname)
  ||targetDatabase.pathname!=='/postgres')throw new Error('Local disposable PostgreSQL only');
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
const integration=load(new URL(
  '../src/lib/customer/documents-country-retention-operation-integration-v1.ts',import.meta.url));
const resolver=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts',import.meta.url));
const artifactContract=load(new URL(
  '../src/lib/core/jurisdiction-domain-artifact-v1.ts',import.meta.url));
const authorityProvider=load(new URL(
  '../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const authorityPort=load(new URL(
  '../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
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
let ids,countryCode,profileV1,profileV2,v1,v2,v1Assignment,committedV1,doc,versionId;
let aggregateVersion=3000,checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const revision=async client=>Number((await client.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton'
)).rows[0].revision);
const counts=async()=>{
  const result=await pool.query(`select
    (select count(*)::int from platform.idempotency_keys) idempotency,
    (select count(*)::int from audit.events) audit,
    (select count(*)::int from platform.outbox_events) outbox,
    (select count(*)::int from platform.jurisdiction_domain_artifact_receipt_evidence) evidence,
    (select count(*)::int from documents.access_events) access_events,
    (select count(*)::int from documents.lifecycle_events) lifecycle_events,
    (select count(*)::int from documents.retention_records) retention_records`);
  return result.rows[0];
};
const documentDigest=async documentId=>hash(JSON.stringify((await pool.query(`select
    to_jsonb(d) document,
    (select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') from documents.document_versions v
      where v.document_id=d.id) versions,
    (select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]') from documents.legal_holds h
      where h.document_id=d.id) holds
    from documents.documents d where d.id=$1`,[documentId])).rows[0]));
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
        immutable_version_required:true,evidence_codes:['synthetic.retention']}],
      disposal_requires_review:true,residency_rule_code:'synthetic_residency'}},
    effective_from:effectiveFrom,effective_to:null,status:'active',
    legal_review:review(`${profile.code}:legal`),
    accounting_review:review(`${profile.code}:accounting`),
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
    profile.id,profile.code,profile.version,countryCode,`Retention operation ${profile.version}`,
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
  await pool.query("update platform.jurisdiction_profiles set status='validated' where id=$1",[
    profile.id]);
  await pool.query("update platform.jurisdiction_profiles set status='active' where id=$1",[
    profile.id]);
  return{artifactSha};
}
async function assign(profile,version){
  const assignment=randomUUID();
  await pool.query(`insert into platform.property_jurisdiction_assignments(id,tenant_id,
    customer_workspace_id,property_id,jurisdiction_profile_id,assignment_version,country_code,
    profile_manifest_sha256,status,binding_source,reason,created_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,'active','platform_verified',
      'documents retention operation disposable evidence',$9)`,[
    assignment,ids.tenantId,ids.workspaceIds[0],ids.propertyIds[0],profile.id,version,
    countryCode,profile.manifest,actor]);
  return assignment;
}
async function installDocumentsAuthority(){
  const role=(await pool.query("select id from identity.roles where code='association_admin' and tenant_id is null and is_system")).rows[0];
  assert.ok(role);await pool.query('update identity.memberships set role_id=$2 where id=$1',[
    ids.membershipId,role.id]);
  const mod=(await pool.query(`select id,entitlement_key from platform.module_definitions
    where code='documents' and is_active and lifecycle_status in ('active','published')`)).rows[0];
  const permission=(await pool.query(
    "select id from identity.permissions where code='documents.vault.read'")).rows[0];
  assert.equal(mod.entitlement_key,'module.documents');assert.ok(permission);
  for(let index=0;index<ids.workspaceIds.length;index+=1){
    const workspaceRole=randomUUID();
    await pool.query(`insert into platform.workspace_modules(
      tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,
      activated_at,activated_by,reason)
      values($1,$2,$3,'documents','active',statement_timestamp()-interval '1 second',
        statement_timestamp(),$4,'Retention operation fixture')`,[
      ids.tenantId,ids.workspaceIds[index],mod.id,actor]);
    await pool.query(`insert into platform.workspace_entitlements(
      customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
      values($1,'module.documents','boolean',true,statement_timestamp()-interval '1 second')`,[
      ids.workspaceIds[index]]);
    await pool.query(`insert into platform.workspace_roles(
      id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
      lifecycle_status,created_by,valid_from)
      values($1,$2,$3,$4,'Retention operation reader',$5,'workspace','draft',$6,
        statement_timestamp()-interval '1 second')`,[
      workspaceRole,ids.tenantId,ids.workspaceIds[index],
      `retention_operation_${workspaceRole.slice(0,8)}`,role.id,actor]);
    await pool.query(`insert into platform.workspace_role_modules(
      tenant_id,workspace_role_id,module_definition_id) values($1,$2,$3)`,[
      ids.tenantId,workspaceRole,mod.id]);
    await pool.query(`insert into platform.workspace_role_permissions(
      tenant_id,workspace_role_id,permission_id,effect) values($1,$2,$3,'allow')`,[
      ids.tenantId,workspaceRole,permission.id]);
    await pool.query(`update platform.workspace_roles
      set lifecycle_status='published',lock_version=lock_version+1 where id=$1`,[workspaceRole]);
    await pool.query(`insert into platform.workspace_member_roles(
      id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
      assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
      values($1,$2,$3,$4,$5,'workspace',$6,$4,'Retention operation fixture',
        statement_timestamp()-interval '1 second')`,[
      randomUUID(),ids.tenantId,ids.workspaceIds[index],ids.membershipId,workspaceRole,actor]);
  }
}
async function addDocument(extra={}){
  const documentId=randomUUID(),immutableVersionId=randomUUID();
  const state={workspace:ids.workspaceIds[0],property:ids.propertyIds[0],type:'invoice',
    version:1,scan:'clean',checksum:'verified',attested:true,...extra};
  const sha=hash(immutableVersionId);
  await pool.query('alter table documents.documents disable trigger document_workspace_creation_guard_v1');
  try{
    await pool.query(`insert into documents.documents(
      id,tenant_id,workspace_id,property_id,title,document_type,classification,current_version)
      values($1,$2,$3,$4,'Private fixture title',$5,'internal',$6)`,[
      documentId,ids.tenantId,state.workspace,state.property,state.type,state.version]);
  }finally{
    await pool.query('alter table documents.documents enable trigger document_workspace_creation_guard_v1');
  }
  await pool.query(`insert into documents.document_versions(
    id,tenant_id,document_id,version,object_path,sha256,mime_type,scanning_status,checksum_status)
    values($1,$2,$3,$4,$5,$6,'application/pdf',$7,$8)`,[
    immutableVersionId,ids.tenantId,documentId,state.version,
    `${ids.tenantId}/private-${immutableVersionId}.pdf`,sha,state.scan,state.checksum]);
  if(state.attested)await pool.query(`insert into documents.document_scan_attestations(
    tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
    values($1,$2,'clamav',$3,'clean',$4,'synthetic',statement_timestamp())`,[
    ids.tenantId,immutableVersionId,randomUUID(),sha]);
  return{document_id:documentId,document_version_id:immutableVersionId,
    document_version:state.version};
}
function currentRequest(source={document_id:doc,document_version_id:versionId,document_version:1},
  operation='read-policy'){
  return{contract_version:integration.DOCUMENTS_COUNTRY_RETENTION_OPERATION_REQUEST_V1,
    mode:'current',target:source,requested_operation:operation};
}
function historicalRequest(source={document_id:doc,document_version_id:versionId,
  document_version:1}){
  const commitment=committedV1.commitments.find(value=>
    value.fingerprint.domain_code==='documents.retention');
  assert.ok(commitment);
  return{contract_version:integration.DOCUMENTS_COUNTRY_RETENTION_OPERATION_REQUEST_V1,
    mode:'historical',target:source,requested_operation:'retain',committed_evidence:{
      contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMITTED_EVIDENCE_V1,
      receipt_id:committedV1.receiptId,source_workspace_id:ids.workspaceIds[0],
      source_property_id:ids.propertyIds[0],source_actor_id:actor,
      source_transaction_id:committedV1.sourceTransactionId,
      source_command_id:committedV1.sourceCommandId,source_attempt:committedV1.sourceAttempt,
      reference:{profile_id:profileV1.id,profile_code:profileV1.code,profile_version:1,
        country_code:countryCode,profile_manifest_sha256:profileV1.manifest,
        domain_code:'documents.retention',domain_version:'documents-retention.v1',
        artifact_sha256:v1.artifactSha,effective_at:commitment.evaluated_at}}};
}
async function operationCommand(request,overrides={}){
  const command={contract_version:'core-transaction-command.v2',transaction_id:randomUUID(),
    command_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],
    actor_id:actor,authority_version:await revision(pool),permission_code:'documents.vault.read',
    module_code:'documents',evaluation_purpose:'documents.country-retention.resolve',
    aggregate_type:'portfolio.property',aggregate_id:ids.propertyIds[0],
    aggregate_version:++aggregateVersion,
    provider_source_ids:[ids.propertyIds[0],request.target.document_id,
      request.target.document_version_id],idempotency_key:`retention-operation-${randomUUID()}`,
    input_fingerprint:integration.documentsCountryRetentionOperationInputFingerprintV1(request),
    subject_reference:{kind:'documents.document_version',id:request.target.document_version_id,
      version:request.target.document_version,relation:request.requested_operation,request_version:1}};
  return{...command,...overrides};
}
function operationProviders(request,telemetry={}){
  const providers=integration.createDocumentsCountryRetentionOperationProvidersV1(request);
  const validate=providers.validateProviders.bind(providers);
  const replay=providers.validateReplay.bind(providers);
  return{...providers,
    async resolveAuthority(scope,authorityRequest){
      await scope.query(`select set_config('request.jwt.claims',$1,true),
        set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,[
        JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
      return authorityProvider.resolveAuthority(scope,authorityRequest);
    },
    async validateProviders(scope,command,authority){
      telemetry.attempts?.push(scope.attempt);
      try{return await validate(scope,command,authority);}catch(error){
        if(error?.code)telemetry.errorCodes?.push(error.code);throw error;
      }
    },
    async validateReplay(scope,command,authority,receipt){
      telemetry.replayCalls?.push(scope.attempt);
      return replay(scope,command,authority,receipt);
    }};
}
async function executeDenied(request,commandOverrides={},expectedCode='PROVIDER_UNAVAILABLE'){
  const before=await counts(),documentBefore=await documentDigest(request.target.document_id);
  const result=await host.execute(await operationCommand(request,commandOverrides),
    operationProviders(request));
  assert.equal(result.status,'denied',JSON.stringify(result));assert.equal(result.code,expectedCode);
  assert.deepEqual(await counts(),before,'denial must not add durable rows');
  assert.equal(await documentDigest(request.target.document_id),documentBefore,
    'denial must not mutate document/version/hold metadata');
  return result;
}
function artifactEvidenceProviders(){
  return{jurisdiction_artifact_projection:'core-jurisdiction-domain-artifact-host-projection.v1',
    async resolveAuthority(scope,request){
      await scope.query(`select set_config('request.jwt.claims',$1,true),
        set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,[
        JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
      return authorityProvider.resolveAuthority(scope,request);
    },async validateProviders(){return true;},
    async resolveJurisdictionArtifacts(scope,command,authority){
      const decision=await resolver.resolveCurrentJurisdictionDomainArtifactV1(
        scope,command,authority,{contract_version:resolver.CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
          mode:'current',transaction_id:command.transaction_id,command_id:command.command_id,
          attempt:scope.attempt,context_id:command.context_id,workspace_id:command.workspace_id,
          actor_id:command.actor_id,authority_version:command.authority_version,
          provider_source_ids:command.provider_source_ids,lock:{kind:'command_aggregate',
            aggregate_type:command.aggregate_type,aggregate_id:command.aggregate_id},
          property_id:ids.propertyIds[0],domain_code:'documents.retention',
          domain_version:'documents-retention.v1'});
      assert.equal(decision.decision,'accepted',JSON.stringify(decision));
      return[resolver.toCoreJurisdictionDomainArtifactCommitCandidateV1(
        decision,ids.propertyIds[0])];
    },async mutate(_scope,command){return{mutation_id:command.command_id}}};
}
async function commitHistoricalEvidence(){
  const command={contract_version:'core-transaction-command.v1',transaction_id:randomUUID(),
    command_id:randomUUID(),context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,
    authority_version:await revision(pool),permission_code:'documents.vault.read',module_code:'documents',
    evaluation_purpose:'documents.country-retention.resolve',aggregate_type:'portfolio.property',
    aggregate_id:ids.propertyIds[0],aggregate_version:++aggregateVersion,
    provider_source_ids:[ids.propertyIds[0]],idempotency_key:`retention-source-${randomUUID()}`,
    input_fingerprint:`sha256:${hash(randomUUID())}`};
  const result=await host.execute(command,artifactEvidenceProviders());
  assert.equal(result.status,'committed',JSON.stringify(result));
  return{receiptId:result.receipt.receipt_id,sourceTransactionId:result.receipt.transaction_id,
    sourceCommandId:result.receipt.command_id,
    sourceAttempt:result.receipt.authority.transaction_context.attempt,
    commitments:result.receipt.jurisdiction_artifacts};
}
async function directScope(request){
  const client=await pool.connect();
  try{
    await client.query('begin isolation level serializable');
    await client.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true)`,[
      JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'}),actor]);
    const database=(await client.query(`select txid_current()::text id,
      clock_timestamp()::text acquired_at`)).rows[0];
    const command=await operationCommand(request);
    const scope=Object.freeze({transaction_id:command.transaction_id,
      database_transaction_id:database.id,workspace_id:command.workspace_id,
      tenant_id:ids.tenantId,actor_id:actor,attempt:1,
      async query(text,values=[]){return client.query(text,values);}});
    const authorityRequest={contract_version:'core-current-authority-transaction-port-request.v1',
      decision_id:randomUUID(),context_id:command.context_id,workspace_id:command.workspace_id,
      actor_id:command.actor_id,authority_version:command.authority_version,
      permission_code:command.permission_code,module_code:command.module_code,
      evaluation_purpose:command.evaluation_purpose,transaction_context:{
        transaction_id:command.transaction_id,command_id:command.command_id,attempt:1,
        isolation_level:'serializable',lock:{kind:'command_aggregate',
          workspace_id:command.workspace_id,aggregate_type:command.aggregate_type,
          aggregate_id:command.aggregate_id,acquired_at:new Date(database.acquired_at).toISOString()}}};
    const observation=await authorityProvider.resolveAuthority(scope,authorityRequest);
    const authority=authorityPort.bindCanonicalCurrentAuthorityObservationV1(
      authorityRequest,observation);
    return{client,scope,command,authority};
  }catch(error){await client.query('rollback').catch(()=>{});client.release();throw error;}
}
async function finishDirect(tx){await tx.client.query('rollback');tx.client.release();}

try{
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,[
    actor,`retention-operation-${randomUUID()}@example.invalid`]);
  ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});
  await installDocumentsAuthority();
  const address=randomUUID();
  await pool.query(`insert into portfolio.addresses(
    id,tenant_id,country_code,county,city,street,building_no,postal_code)
    values($1,$2,'DE','Berlin','Berlin','Teststrasse','1','10115')`,[address,ids.tenantId]);
  await pool.query('update portfolio.properties set address_id=$2 where id=$1',[
    ids.propertyIds[0],address]);
  countryCode='DE';const profileCode=`de.retention.${randomUUID().slice(0,8)}`;
  profileV1={id:randomUUID(),code:profileCode,version:1,manifest:hash(`${profileCode}:v1`),
    validFrom:'2025-01-01'};
  profileV2={id:randomUUID(),code:profileCode,version:2,manifest:hash(`${profileCode}:v2`),
    validFrom:'2026-01-01'};
  v1=await installProfile(profileV1,artifactInput(
    profileV1,'historical_rule','P10Y','2025-01-01T00:00:00.000Z'));
  v1Assignment=await assign(profileV1,1);committedV1=await commitHistoricalEvidence();
  await pool.query(`update platform.property_jurisdiction_assignments
    set status='superseded',valid_to=statement_timestamp() where id=$1`,[v1Assignment]);
  await pool.query("update platform.jurisdiction_profiles set status='retired' where id=$1",[
    profileV1.id]);
  v2=await installProfile(profileV2,artifactInput(
    profileV2,'current_rule','P12Y','2026-01-01T00:00:00.000Z'));
  await assign(profileV2,2);
  ({document_id:doc,document_version_id:versionId}=await addDocument());

  await check('current preflight commits bounded Core evidence without document mutation',async()=>{
    const request=currentRequest(),before=await documentDigest(doc);
    const result=await host.execute(await operationCommand(request),operationProviders(request));
    assert.equal(result.status,'committed',JSON.stringify(result));
    assert.equal(result.receipt.provider_evidence.provider_code,
      integration.documentsCountryRetentionOperationProviderCodeV1);
    assert.equal(result.receipt.provider_evidence.source_disclosure,'status_only');
    assert.equal(result.receipt.provider_evidence.source_reference,null);
    assert.equal(await documentDigest(doc),before);
    assert.equal(result.receipt.jurisdiction_artifacts,undefined);
  });

  await check('exact replay returns the same receipt and creates no duplicate evidence',async()=>{
    const request=currentRequest(),command=await operationCommand(request),replayCalls=[];
    const first=await host.execute(command,operationProviders(request,{replayCalls}));
    assert.equal(first.status,'committed');const before=await counts();
    const replay=await host.execute(command,operationProviders(request,{replayCalls}));
    assert.equal(replay.status,'exact_replay',JSON.stringify(replay));
    assert.equal(replay.receipt.receipt_id,first.receipt.receipt_id);
    assert.deepEqual(await counts(),before);assert.deepEqual(replayCalls,[1]);
  });

  await check('historical evaluation stays pinned to committed receipt evidence',async()=>{
    const request=historicalRequest(),before=await counts(),tx=await directScope(request);
    try{
      const result=await integration.resolveDocumentsCountryRetentionOperationV1(
        tx.scope,tx.command,tx.authority,request);
      assert.equal(result.decision,'accepted',JSON.stringify(result));
      assert.equal(result.retention.mode,'historical');
      assert.equal(result.retention.evaluation.resolution.retention_rule_code,'historical_rule');
      assert.equal(result.retention.evaluation.artifact_fingerprint.profile_version,1);
    }finally{await finishDirect(tx);}
    assert.deepEqual(await counts(),before);
    const documentBefore=await documentDigest(doc);
    const committed=await host.execute(await operationCommand(request),operationProviders(request));
    assert.equal(committed.status,'committed',JSON.stringify(committed));
    assert.equal(committed.receipt.provider_evidence.source_disclosure,'status_only');
    assert.equal(await documentDigest(doc),documentBefore);
  });

  await check('active legal hold blocks disposal with zero durable write',async()=>{
    const held=await addDocument();
    await pool.query(`insert into documents.legal_holds(
      tenant_id,document_id,reason,status) values($1,$2,'Synthetic active hold','active')`,[
      ids.tenantId,held.document_id]);
    await executeDenied(currentRequest(held,'dispose'));
  });

  await check('stale, cross-Workspace and missing retention rule deny with zero write',async()=>{
    await executeDenied(currentRequest({document_id:doc,document_version_id:versionId,
      document_version:2}));
    const cross=await addDocument({workspace:ids.workspaceIds[1],property:ids.propertyIds[1]});
    await executeDenied(currentRequest(cross));
    const missing=await addDocument({type:'synthetic-unmapped'});
    await executeDenied(currentRequest(missing));
  });

  await check('revoked entitlement denies before provider acceptance with zero write',async()=>{
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.documents'`,[
      ids.workspaceIds[0]]);
    try{await executeDenied(currentRequest(),{},'AUTHORITY_DENIED');}
    finally{await pool.query(`update platform.workspace_entitlements set boolean_value=true
      where customer_workspace_id=$1 and entitlement_key='module.documents'`,[
      ids.workspaceIds[0]]);}
  });

  await check('real 40001 retries and observes a newly active hold with zero write',async()=>{
    const source=await addDocument(),request=currentRequest(source,'dispose');
    const command=await operationCommand(request),attempts=[],errorCodes=[];
    const blocker=await pool.connect();let pending;
    const before=await counts();
    try{
      await blocker.query('begin');
      await blocker.query('select id from documents.documents where id=$1 for update',[
        source.document_id]);
      pending=host.execute(command,operationProviders(request,{attempts,errorCodes}));
      await waitForLock('from documents.documents d');
      await blocker.query('update documents.documents set legal_hold=true where id=$1',[
        source.document_id]);
      await blocker.query('commit');
      const result=await pending;
      assert.equal(result.status,'denied',JSON.stringify(result));
      assert.equal(result.code,'PROVIDER_UNAVAILABLE');
      assert.deepEqual(errorCodes,['40001']);assert.deepEqual(attempts,[1,2]);
      assert.deepEqual(await counts(),before);
    }finally{
      await blocker.query('rollback').catch(()=>{});blocker.release();if(pending)await pending;
    }
  });
}finally{
  if(ids){await driver.revoke({authority:ids});
    assert.equal(await driver.verifyRevoked({authority:ids}),true);}
  await pool.end();
}

console.log(`Documents country retention operation PostgreSQL: ${checks}/${checks} PASS; Remote untouched`);

async function waitForLock(fragment){
  for(let index=0;index<300;index+=1){
    const result=await pool.query(`select count(*)::int n from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0`,[
      fragment]);
    if(result.rows[0].n>0)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error('expected document lock wait');
}
