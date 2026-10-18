import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { load } from './test-documents-reference-authority-v1.mjs';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.DOC_REFERENCE_TEST_DATABASE_URL;
if(!connectionString || process.env.DOC_REFERENCE_EPHEMERAL!=='1') throw new Error('Explicit disposable target required');
const target=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/postgres') {
  throw new Error('Local disposable PostgreSQL only');
}
const pool=new pg.Pool({connectionString,max:12});
const documents=load(new URL('../src/lib/customer/documents-reference-authority-v1.ts',import.meta.url));
const selector=load(new URL('../src/lib/customer/documents-reference-tx-selector-v1.ts',import.meta.url));
const {resolveAuthority}=load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const {createCorePostgresTransactionHostV1}=load(new URL('../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const evidenceContract=load(new URL('../src/lib/core/transaction-provider-evidence-v1.ts',import.meta.url));
const actor=randomUUID(); let ids,doc,versionId; let checks=0;
const host=createCorePostgresTransactionHostV1(pool);
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const revision=async()=>Number((await pool.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);
const stateTables=['documents.documents','documents.document_versions','documents.document_permissions',
  'documents.document_scan_attestations','documents.access_events','documents.lifecycle_events',
  'documents.document_links','documents.document_audit_links','documents.upload_intents',
  'platform.idempotency_keys','audit.events','platform.outbox_events','app_private.canonical_authority_revision_v1'];
const digest=async()=>{
  const rows=[];
  for(const table of stateTables) {
    const result=await pool.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text value from ${table} t`);
    rows.push(result.rows[0].value);
  }
  return createHash('sha256').update(rows.join('\n')).digest('hex');
};
async function command(extra={}) {
  const documentId=extra.document_id||doc, immutableVersionId=extra.document_version_id||versionId;
  const version=extra.document_version||1;
  const {document_id:_documentId,document_version_id:_versionId,document_version:_version,...overrides}=extra;
  const base={contract_version:'core-transaction-command.v2',transaction_id:randomUUID(),command_id:randomUUID(),
    context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,authority_version:await revision(),
    permission_code:'documents.vault.read',module_code:'documents',evaluation_purpose:'documents.reference.read',
    aggregate_type:'documents.document',aggregate_id:documentId,aggregate_version:version,
    provider_source_ids:[documentId,immutableVersionId],idempotency_key:randomUUID(),input_fingerprint:'doc2:0123456789abcdef',
    subject_reference:{kind:'documents.document_version',id:immutableVersionId,version,relation:'read',request_version:1}};
  return {...base,...overrides};
}
async function selectorCommand(source={},extra={}) {
  const target={document_id:source.document_id||doc,
    document_version_id:source.document_version_id||versionId,
    document_version:source.document_version||1};
  const aggregateId=extra.aggregate_id||randomUUID();
  return {contract_version:'core-transaction-command.v2',transaction_id:randomUUID(),command_id:randomUUID(),
    context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,authority_version:await revision(),
    permission_code:'airprop.asset.manage',module_code:'airprop_commercial',
    evaluation_purpose:'documents.reference.selector.test',aggregate_type:'selector.consumer',
    aggregate_id:aggregateId,aggregate_version:1,
    provider_source_ids:[aggregateId,target.document_id,target.document_version_id],
    idempotency_key:randomUUID(),
    input_fingerprint:`docsel1:${createHash('sha256').update(JSON.stringify(target)).digest('hex')}`,
    subject_reference:{kind:'selector.consumer',id:aggregateId,version:1,relation:'validate',request_version:1},
    ...extra};
}
const providers=(options={})=>({
  provider_code:documents.documentsReferenceAuthorityProviderCodeV1,
  async resolveAuthority(scope,request) {
    const boundActor=options.actor||actor,boundAal=options.aal||'aal2';
    await scope.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal',$3,true)`,
    [JSON.stringify({sub:boundActor,role:'authenticated',aal:boundAal}),boundActor,boundAal]);
    return resolveAuthority(scope,request);
  },
  validateProviders:documents.validateDocumentsReferenceAuthorityV1,
  async mutate(_scope,cmd) { return {mutation_id:cmd.aggregate_id}; },
});
const selectorProviders=(target,options={})=>({
  provider_code:documents.documentsReferenceAuthorityProviderCodeV1,
  async resolveAuthority(scope,request) {
    const boundActor=options.actor||actor,boundAal=options.aal||'aal2';
    await scope.query(`select set_config('request.jwt.claims',$1,true),
      set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal',$3,true)`,
    [JSON.stringify({sub:boundActor,role:'authenticated',aal:boundAal}),boundActor,boundAal]);
    return resolveAuthority(scope,request);
  },
  async validateProviders(scope,cmd,authority) {
    options.attempts?.push(scope.attempt);
    let selected;
    try {
      selected=await selector.selectDocumentsReferenceInCoreTransactionV1(scope,cmd,authority,target);
    } catch(error) {
      if(error?.code) options.errorCodes?.push(error.code);
      throw error;
    }
    options.decisions?.push(selected);
    const denial=selected.decision==='accepted'?null
      :selected.denial_reason==='STALE_REFERENCE'?'STALE_SUBJECT'
        :selected.denial_reason==='BINDING_MISMATCH'?'RELATION_MISMATCH'
          :selected.denial_reason==='PROVIDER_UNAVAILABLE'?'PROVIDER_UNAVAILABLE':'SUBJECT_DENIED';
    return evidenceContract.coreTransactionProviderEvidenceV1Schema.parse({
      contract_version:'core-transaction-provider-evidence.v1',evidence_id:randomUUID(),
      provider_code:documents.documentsReferenceAuthorityProviderCodeV1,
      transaction_id:cmd.transaction_id,command_id:cmd.command_id,workspace_id:cmd.workspace_id,
      actor_id:cmd.actor_id,context_id:cmd.context_id,authority_decision_id:authority.decision_id,
      authority_version:authority.authority_version,attempt:scope.attempt,
      subject_reference:cmd.subject_reference,evaluated_at:selected.evaluated_at,
      source_disclosure:'status_only',source_reference:null,
      decision:selected.decision,denial_reason:denial,
      ...(selected.decision==='accepted'?{reference_state:'available',current_actor_can_read:true}:{}),
    });
  },
  async mutate(_scope,cmd) { return {mutation_id:cmd.aggregate_id}; },
});
async function denied(cmd,options={},code) {
  const before=await digest();const result=await host.execute(cmd,providers(options));
  assert.equal(result.status,'denied');if(code)assert.equal(result.code,code);
  assert.equal('receipt' in result,false);assert.equal(await digest(),before,'denial must be zero-write');
  return result;
}
async function selectorDenied(source,options={}) {
  const target={document_id:source.document_id||doc,
    document_version_id:source.document_version_id||versionId,
    document_version:source.document_version||1};
  const before=await digest();
  const result=await host.execute(await selectorCommand(target),selectorProviders(target,options));
  assert.equal(result.status,'denied');assert.equal(result.code,'PROVIDER_UNAVAILABLE');
  assert.equal('receipt' in result,false);assert.equal(await digest(),before,'selector denial must be zero-write');
  return result;
}
async function addDocument(extra={}) {
  const documentId=randomUUID(),vid=randomUUID();const sha=createHash('sha256').update(vid).digest('hex');
  const state={workspace:ids.workspaceIds[0],property:ids.propertyIds[0],classification:'internal',
    scan:'clean',attested:true,checksum:'verified',...extra};
  await pool.query('alter table documents.documents disable trigger document_workspace_creation_guard_v1');
  try {
    await pool.query(`insert into documents.documents(id,tenant_id,workspace_id,property_id,title,document_type,classification)
      values($1,$2,$3,$4,'Confidential title never projected','financial-test',$5)`,
    [documentId,ids.tenantId,state.workspace,state.property,state.classification]);
  } finally {
    await pool.query('alter table documents.documents enable trigger document_workspace_creation_guard_v1');
  }
  await pool.query(`insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,scanning_status,checksum_status)
    values($1,$2,$3,1,$4,$5,'application/pdf',$6,$7)`,
    [vid,ids.tenantId,documentId,`${ids.tenantId}/secret-${vid}.pdf`,sha,state.scan,state.checksum]);
  if(state.attested) await pool.query(`insert into documents.document_scan_attestations
    (tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
    values($1,$2,'clamav',$3,$4,$5,'synthetic-clamav',statement_timestamp())`,
    [ids.tenantId,vid,randomUUID(),state.scan==='quarantined'?'quarantined':'clean',sha]);
  return {document_id:documentId,document_version_id:vid};
}

try {
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
    [actor,`doc-reference-${randomUUID()}@example.invalid`]);
  ids=await createAp10CoreAuthorityDriver(pool).setup({userId:actor,runId:randomUUID(),target:'local'});
  const role=(await pool.query("select id from identity.roles where code='association_admin' and tenant_id is null and is_system")).rows[0];
  assert.ok(role);await pool.query('update identity.memberships set role_id=$2 where id=$1',[ids.membershipId,role.id]);
  const mod=(await pool.query("select id,entitlement_key from platform.module_definitions where code='documents' and is_active")).rows[0];
  const permission=(await pool.query("select id from identity.permissions where code='documents.vault.read'")).rows[0];
  for(let i=0;i<2;i++) {
    const wr=randomUUID();
    await pool.query(`insert into platform.workspace_modules
      (tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,activated_at,activated_by,reason)
      values($1,$2,$3,'documents','active',statement_timestamp()-interval '1 second',statement_timestamp(),$4,'Disposable reference test')`,
      [ids.tenantId,ids.workspaceIds[i],mod.id,actor]);
    await pool.query(`insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
      values($1,$2,'boolean',true,statement_timestamp()-interval '1 second')`,[ids.workspaceIds[i],mod.entitlement_key]);
    await pool.query(`insert into platform.workspace_roles
      (id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,lifecycle_status,created_by,valid_from)
      values($1,$2,$3,$4,'Disposable Documents reader',$5,'workspace','draft',$6,statement_timestamp()-interval '1 second')`,
      [wr,ids.tenantId,ids.workspaceIds[i],`docs_${wr.slice(0,8)}`,role.id,actor]);
    await pool.query('insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id) values($1,$2,$3)',[ids.tenantId,wr,mod.id]);
    await pool.query("insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect) values($1,$2,$3,'allow')",[ids.tenantId,wr,permission.id]);
    await pool.query("update platform.workspace_roles set lifecycle_status='published',lock_version=lock_version+1 where id=$1",[wr]);
    await pool.query(`insert into platform.workspace_member_roles
      (id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
      values($1,$2,$3,$4,$5,'workspace',$6,$4,'Disposable Documents reader',statement_timestamp()-interval '1 second')`,
      [randomUUID(),ids.tenantId,ids.workspaceIds[i],ids.membershipId,wr,actor]);
  }
  ({document_id:doc,document_version_id:versionId}=await addDocument());

  await check('Core v2 consumes exact Workspace, document and immutable version evidence after authority',async()=>{
    const result=await host.execute(await command(),providers());
    assert.equal(result.status,'committed',JSON.stringify(result));
    const evidence=result.receipt.provider_evidence;
    assert.equal(evidenceContract.coreTransactionProviderEvidenceV1Schema.safeParse(evidence).success,true);
    assert.equal(evidence.workspace_id,ids.workspaceIds[0]);assert.equal(result.receipt.aggregate_id,doc);
    assert.equal(evidence.subject_reference.id,versionId);assert.equal(evidence.subject_reference.version,1);
    assert.equal(evidence.authority_decision_id,result.receipt.authority.decision_id);
    for(const field of ['content','title','sha256','mime_type','object_path','bucket_id','tenant_id','permissions','entitlement','role']) {
      assert.ok(!(field in evidence));
    }
  });
  await check('inactive selector rechecks Documents access inside a non-Documents Core transaction',async()=>{
    const target={document_id:doc,document_version_id:versionId,document_version:1};
    const decisions=[];const accessBefore=(await pool.query(
      'select count(*)::int n from documents.access_events where document_id=$1',[doc])).rows[0].n;
    const result=await host.execute(await selectorCommand(target),selectorProviders(target,{decisions}));
    assert.equal(result.status,'committed');assert.equal(decisions.length,1);
    assert.equal(decisions[0].decision,'accepted');assert.deepEqual(decisions[0].target,target);
    assert.equal(selector.documentsReferenceTxSelectorDecisionV1Schema.safeParse(decisions[0]).success,true);
    assert.equal((await pool.query(
      'select count(*)::int n from documents.access_events where document_id=$1',[doc])).rows[0].n,accessBefore);
    for(const field of ['content','title','body','sha256','mime_type','object_path','bucket_id','tenant_id',
      'permissions','entitlement','role']) assert.ok(!(field in decisions[0]));
    assert.equal(result.receipt.provider_evidence.source_disclosure,'status_only');
    assert.equal(result.receipt.provider_evidence.source_reference,null);
    assert.notEqual(result.receipt.provider_evidence.subject_reference.id,doc);
    assert.notEqual(result.receipt.provider_evidence.subject_reference.id,versionId);
  });
  await check('selector denies cross-Workspace, NULL and missing mappings with zero writes',async()=>{
    for(const source of [await addDocument({workspace:ids.workspaceIds[1],property:ids.propertyIds[1]}),
      await addDocument({workspace:null}),{document_id:randomUUID(),document_version_id:randomUUID()}]) {
      const decisions=[];await selectorDenied(source,{decisions});
      assert.equal(decisions.at(-1).decision,'denied');
      assert.equal(decisions.at(-1).denial_reason,'REFERENCE_DENIED');
    }
  });
  await check('selector denies stale immutable version identities and parent mappings with zero writes',async()=>{
    for(const source of [{document_id:doc,document_version_id:versionId,document_version:2},
      {document_id:doc,document_version_id:randomUUID(),document_version:1},
      {document_id:doc,document_version_id:(await addDocument()).document_version_id,document_version:1}]) {
      const decisions=[];await selectorDenied(source,{decisions});
      assert.equal(decisions.at(-1).decision,'denied');
      assert.ok(['STALE_REFERENCE','REFERENCE_DENIED'].includes(decisions.at(-1).denial_reason));
    }
    assert.equal((await pool.query(
      'select current_version from documents.documents where id=$1',[doc])).rows[0].current_version,1);
  });
  await check('selector denies unsafe scan and inactive lifecycle with zero writes',async()=>{
    for(const source of [await addDocument({scan:'scanning_pending'}),
      await addDocument({scan:'quarantined'}),await addDocument({attested:false}),
      await addDocument({checksum:'failed'})]) {
      const decisions=[];await selectorDenied(source,{decisions});
      assert.equal(decisions.at(-1).denial_reason,'REFERENCE_DENIED');
    }
    for(const mutation of ["deleted_at=statement_timestamp()","archived_at=statement_timestamp()",
      "status='archived'","disposition_status='disposition_approved'"]) {
      const source=await addDocument();
      await pool.query(`update documents.documents set ${mutation} where id=$1`,[source.document_id]);
      const decisions=[];await selectorDenied(source,{decisions});
      assert.equal(decisions.at(-1).denial_reason,'REFERENCE_DENIED');
    }
  });
  await check('selector denies revoked Documents authority while primary Core authority remains current',async()=>{
    await pool.query("update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=$1 and entitlement_key='module.documents'",[ids.workspaceIds[0]]);
    try {
      const decisions=[];await selectorDenied({}, {decisions});
      assert.equal(decisions.length,1);assert.equal(decisions[0].denial_reason,'AUTHORITY_DENIED');
    } finally {
      await pool.query("update platform.workspace_entitlements set boolean_value=true where customer_workspace_id=$1 and entitlement_key='module.documents'",[ids.workspaceIds[0]]);
    }
  });
  await check('upgrade preserves populated rows, keeps NULL legacy bindings and infers no backfill',async()=>{
    const c=await pool.connect();const migration=readFileSync(
      new URL('../supabase/migrations/20261013063739_document_reference_exact_workspace_v1.sql',import.meta.url),'utf8');
    try {
      await c.query('begin');
      await c.query('drop trigger document_workspace_creation_guard_v1 on documents.documents');
      await c.query('drop function documents.require_workspace_bound_document_insert_v1()');
      await c.query('drop trigger document_workspace_binding_immutable_v1 on documents.documents');
      await c.query('drop function documents.reject_document_workspace_rebind_v1()');
      // Downstream inactive executor policies legitimately bind the final
      // Workspace column. Remove only those policies inside this rolled-back
      // historical-upgrade simulation before recreating the earlier state.
      await c.query('drop policy core_platform_ce_documents_read_v1 on documents.documents');
      await c.query('drop policy core_platform_ce_documents_lock_v1 on documents.documents');
      await c.query('alter table documents.documents drop column workspace_id');
      const snapshot=(await c.query('select to_jsonb(d) row from documents.documents d where id=$1',[doc])).rows[0].row;
      const security=async()=>(await c.query(`select relacl::text,relrowsecurity,relforcerowsecurity
        from pg_class where oid='documents.documents'::regclass`)).rows[0];
      const before=await security();await c.query(migration.replace(/^begin;\s*/m,'').replace(/^commit;\s*/m,''));
      assert.deepEqual((await c.query("select to_jsonb(d)-'workspace_id' row from documents.documents d where id=$1",[doc])).rows[0].row,snapshot);
      assert.deepEqual(await security(),before);assert.equal((await c.query(
        'select workspace_id from documents.documents where id=$1',[doc])).rows[0].workspace_id,null);
      await c.query(`insert into documents.documents(tenant_id,title,document_type) values($1,'Legacy insert','test')`,[ids.tenantId]);
      assert.equal((await c.query("select count(*)::int n from documents.documents where title='Legacy insert' and workspace_id is null")).rows[0].n,1);
    } finally {await c.query('rollback');c.release();}
  });
  await check('RLS and ACL remain closed for document, version and scan tables',async()=>{
    const metadata=await pool.query(`select c.relname,c.relrowsecurity,c.relforcerowsecurity,
      has_table_privilege('authenticated',c.oid,'SELECT') authenticated,
      has_table_privilege('anon',c.oid,'SELECT') anonymous
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='documents' and c.relname in ('documents','document_versions','document_scan_attestations')`);
    assert.equal(metadata.rowCount,3);
    for(const row of metadata.rows){assert.equal(row.relrowsecurity,true);assert.equal(row.authenticated,false);assert.equal(row.anonymous,false);}
  });
  await check('cross-Workspace and NULL Workspace bindings fail closed with zero writes',async()=>{
    for(const source of [await addDocument({workspace:ids.workspaceIds[1],property:ids.propertyIds[1]}),
      await addDocument({workspace:null})]) await denied(await command(source),{},'PROVIDER_UNAVAILABLE');
  });
  await check('stale numeric version, wrong immutable ID and wrong parent pairing are zero-write denials',async()=>{
    await denied(await command({document_version:2}),{},'PROVIDER_UNAVAILABLE');
    await denied(await command({document_version_id:randomUUID()}),{},'PROVIDER_UNAVAILABLE');
    await denied(await command({document_version_id:(await addDocument()).document_version_id}),{},'PROVIDER_UNAVAILABLE');
    await pool.query('update documents.documents set current_version=2 where id=$1',[doc]);
    await denied(await command(),{},'PROVIDER_UNAVAILABLE');
    await pool.query('update documents.documents set current_version=1 where id=$1',[doc]);
  });
  await check('quarantined, pending, deferred, unattested and checksum-unsafe versions deny with zero writes',async()=>{
    for(const extra of [{scan:'scanning_pending'},{scan:'deferred'},{scan:'quarantined'},
      {attested:false},{checksum:'mismatch'},{checksum:'failed'}]) {
      await denied(await command(await addDocument(extra)),{},'PROVIDER_UNAVAILABLE');
    }
  });
  await check('deleted, archived and disposal-approved lifecycle states deny with zero writes',async()=>{
    for(const mutation of ["deleted_at=statement_timestamp()","archived_at=statement_timestamp()",
      "status='archived'","disposition_status='disposition_approved'"]) {
      const source=await addDocument();await pool.query(`update documents.documents set ${mutation} where id=$1`,[source.document_id]);
      await denied(await command(source),{},'PROVIDER_UNAVAILABLE');
    }
  });
  await check('revoked current Core read authority never reaches accepted provider evidence',async()=>{
    await pool.query("update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=$1 and entitlement_key='module.documents'",[ids.workspaceIds[0]]);
    await denied(await command(),{},'AUTHORITY_DENIED');
    await pool.query("update platform.workspace_entitlements set boolean_value=true where customer_workspace_id=$1 and entitlement_key='module.documents'",[ids.workspaceIds[0]]);
    await pool.query("update identity.memberships set status='revoked',ends_at=statement_timestamp() where id=$1",[ids.membershipId]);
    await denied(await command());
    await pool.query("update identity.memberships set status='active',ends_at=null where id=$1",[ids.membershipId]);
  });
  await check('unknown Context and actor-session mismatch deny with zero writes',async()=>{
    await denied(await command({context_id:randomUUID()}));
    await denied(await command(),{actor:randomUUID()});
  });
  await check('relation and source-lock mismatches fail before canonical writes',async()=>{
    await denied(await command({subject_reference:{kind:'documents.document_version',id:versionId,version:1,relation:'write',request_version:1}}),{},'PROVIDER_UNAVAILABLE');
    await denied(await command({provider_source_ids:[versionId]}),{},'PROVIDER_UNAVAILABLE');
  });
  await check('selector propagates real 40001 and rechecks deletion in a fresh Core attempt',async()=>{
    const source=await addDocument(),blocker=await pool.connect();let pending;
    const target={...source,document_version:1},attempts=[],errorCodes=[],decisions=[];
    try {
      await blocker.query('begin');await blocker.query('select id from documents.documents where id=$1 for update',[source.document_id]);
      const beforeEffects=await pool.query(`select
        (select count(*)::int from platform.idempotency_keys) idempotency,
        (select count(*)::int from audit.events) audit,
        (select count(*)::int from platform.outbox_events) outbox`);
      pending=host.execute(await selectorCommand(target),
        selectorProviders(target,{attempts,errorCodes,decisions}));
      await waitForQueryLock('from documents.documents d where d.id=$1');
      await blocker.query('update documents.documents set deleted_at=statement_timestamp() where id=$1',[source.document_id]);
      await blocker.query('commit');const result=await pending;
      assert.equal(result.status,'denied');assert.equal(result.code,'PROVIDER_UNAVAILABLE');
      assert.deepEqual(errorCodes,['40001']);assert.deepEqual(attempts,[1,2]);
      assert.equal(decisions.length,1);assert.equal(decisions[0].denial_reason,'REFERENCE_DENIED');
      const afterEffects=await pool.query(`select
        (select count(*)::int from platform.idempotency_keys) idempotency,
        (select count(*)::int from audit.events) audit,
        (select count(*)::int from platform.outbox_events) outbox`);
      assert.deepEqual(afterEffects.rows[0],beforeEffects.rows[0],'host denial adds no canonical effect rows');
    } finally {await blocker.query('rollback');blocker.release();if(pending)await pending;}
  });
} finally {await pool.end();}
console.log(`Documents reference PostgreSQL: ${checks}/${checks} PASS; no Remote apply or activation`);

async function waitForQueryLock(fragment) {
  for(let i=0;i<300;i++){
    const r=await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0",[fragment]);
    if(r.rows[0].n>0)return;await new Promise(r=>setTimeout(r,10));
  }throw new Error('expected document row lock wait');
}
