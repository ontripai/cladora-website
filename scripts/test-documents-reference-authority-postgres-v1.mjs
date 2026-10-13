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
const {resolveDocumentsReferenceAuthorityV1:resolve,documentsReferenceAuthorityResultV1Schema:resultSchema}
  =load(new URL('../src/lib/customer/documents-reference-authority-v1.ts',import.meta.url));
const {resolveAuthority}=load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const {createCorePostgresTransactionHostV1}=load(new URL('../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const actor=randomUUID(); let ids,doc,versionId; let checks=0;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
const revision=async()=>Number((await pool.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);
const request=async(extra={})=>({contract_version:'documents-reference-authority.v1',context_id:ids.contextId,
  workspace_id:ids.workspaceIds[0],command_id:randomUUID(),authority_version:await revision(),document_id:doc,
  document_version_id:versionId,document_version:1,evaluation_mode:'new_command',...extra});
const stateTables=['documents.documents','documents.document_versions','documents.document_permissions',
  'documents.document_scan_attestations','documents.access_events','documents.lifecycle_events',
  'documents.document_links','documents.document_audit_links','documents.upload_intents',
  'platform.idempotency_keys','audit.events','platform.outbox_events','app_private.canonical_authority_revision_v1'];
const digest=async(client=pool)=>{
  const rows=[];
  for(const table of stateTables) {
    const result=await client.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text value from ${table} t`);
    rows.push(result.rows[0].value);
  }
  return createHash('sha256').update(rows.join('\n')).digest('hex');
};
// Disposable harness supplies the existing CoreTransactionScopeV1 capability;
// no alternative production host, pool or authority resolver is implemented.
async function evaluate(req,options={}) {
  const c=await pool.connect(); const queries=[];
  try {
    await c.query('begin isolation level serializable');
    await c.query("set local lock_timeout='3s'");await c.query("set local statement_timeout='6s'");
    await c.query("select set_config('request.jwt.claims',$1,true)",
      [JSON.stringify({sub:options.actor||actor,role:'authenticated',aal:options.aal||'aal2'})]);
    if(options.role) await c.query(`set local role ${options.role}`);
    const native=(await c.query('select txid_current()::text id')).rows[0].id;
    const scope=Object.freeze({transaction_id:randomUUID(),database_transaction_id:options.badTx?'0':native,
      workspace_id:req.workspace_id,tenant_id:ids.tenantId,actor_id:actor,attempt:options.attempt||1,
      query:async(sql,values)=>{
        assert.match(sql,/^\s*select\b/i);assert.ok(!sql.includes(';'));
        queries.push(sql);
        if(options.beforeQuery) await options.beforeQuery(sql,c);
        const r=await c.query(sql,values);
        if(options.afterQuery) await options.afterQuery(sql,c,r);
        return r;
      }});
    const result=await resolve(scope,req);
    resultSchema.parse(result);
    // COMMIT (including denies) detects serializable conflicts. No tests rely
    // on rolling back resolver writes to claim zero-write behavior.
    await c.query('commit');
    return {result,queries};
  } catch(error) {await c.query('rollback');throw error;}
  finally {c.release();}
}
async function denied(req,options={},code) {
  const before=await digest(); const {result}=await evaluate(req,options);
  assert.equal(result.decision,'denied');assert.equal(result.evidence,null);
  if(code) assert.equal(result.code,code);
  assert.equal(await digest(),before,'denial must not change any canonical document/effect/epoch row');
}
async function addDocument(extra={}) {
  const documentId=randomUUID(),vid=randomUUID();const sha=createHash('sha256').update(vid).digest('hex');
  const state={workspace:ids.workspaceIds[0],property:ids.propertyIds[0],classification:'internal',
    scan:'clean',attested:true,checksum:'verified',...extra};
  await pool.query(`insert into documents.documents(id,tenant_id,workspace_id,property_id,title,document_type,classification)
    values($1,$2,$3,$4,'Confidential title never projected','financial-test',$5)`,
    [documentId,ids.tenantId,state.workspace,state.property,state.classification]);
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
  assert.ok(role);
  await pool.query('update identity.memberships set role_id=$2 where id=$1',[ids.membershipId,role.id]);
  const mod=(await pool.query("select id,entitlement_key from platform.module_definitions where code='documents' and is_active")).rows[0];
  const permission=(await pool.query("select id from identity.permissions where code='documents.vault.read'")).rows[0];
  const docRoles=[],docAssignments=[];
  for(let i=0;i<2;i++) {
    const wr=randomUUID(),assignment=randomUUID();docRoles.push(wr);docAssignments.push(assignment);
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
      [assignment,ids.tenantId,ids.workspaceIds[i],ids.membershipId,wr,actor]);
  }
  ({document_id:doc,document_version_id:versionId}=await addDocument());
  await check('actual canonical Core provider allows exact Context/Workspace/current immutable version',async()=>{
    const before=await digest();const {result,queries}=await evaluate(await request());
    assert.equal(result.decision,'allowed');assert.equal(result.evidence.document_version_id,versionId);
    assert.equal(result.evidence.safe_label,'Document reference');assert.equal(result.evidence.workspace_id,ids.workspaceIds[0]);
    assert.equal(queries.filter(sql=>sql.includes('from app_private.canonical_authority_revision_v1')).length,2);
    assert.equal(await digest(),before,'allowed reference also writes nothing');
    for(const name of ['content','title','sha256','mime_type','object_path','bucket_id','tenant_id','permissions','entitlement','actor_id']) {
      assert.ok(!(name in result.evidence));
    }
  });
  await check('upgrade preserves populated legacy rows, existing ACL/RLS and old insert compatibility',async()=>{
    const c=await pool.connect();
    const migration=readFileSync(new URL('../supabase/migrations/20261013063739_document_reference_exact_workspace_v1.sql',import.meta.url),'utf8');
    try {
      await c.query('begin');
      await c.query('alter table documents.documents drop column workspace_id');
      const snapshot=(await c.query("select to_jsonb(d) row from documents.documents d where id=$1",[doc])).rows[0].row;
      const security=async()=>(await c.query(`select relacl::text,relrowsecurity,relforcerowsecurity from pg_class where oid='documents.documents'::regclass`)).rows[0];
      const before=await security();
      await c.query(migration.replace(/^begin;\s*/m,'').replace(/^commit;\s*/m,''));
      assert.deepEqual((await c.query("select to_jsonb(d)-'workspace_id' row from documents.documents d where id=$1",[doc])).rows[0].row,snapshot);
      assert.deepEqual(await security(),before);
      assert.equal((await c.query('select workspace_id from documents.documents where id=$1',[doc])).rows[0].workspace_id,null);
      await c.query(`insert into documents.documents(tenant_id,title,document_type) values($1,'Legacy insert','test')`,[ids.tenantId]);
      const otherTenant=randomUUID();
      await c.query("insert into platform.tenants(id,legal_name,registration_number,status) values($1,'Other synthetic',$2,'active')",[otherTenant,randomUUID()]);
      await c.query('savepoint invalid_binding');
      await assert.rejects(()=>c.query(`insert into documents.documents(tenant_id,workspace_id,title,document_type)
        values($1,$2,'Mismatch','test')`,[otherTenant,ids.workspaceIds[0]]),{code:'23503'});
      await c.query('rollback to savepoint invalid_binding');
    } finally {await c.query('rollback');c.release();}
  });
  await check('RLS and ACL deny anonymous/authenticated direct reads and Core privilege substitution',async()=>{
    for(const role of ['anon','authenticated','service_role']) await denied(await request(),{role},'PROVIDER_UNAVAILABLE');
    const metadata=await pool.query(`select c.relname,c.relrowsecurity,
      has_table_privilege('authenticated',c.oid,'SELECT') direct
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='documents' and c.relname in ('documents','document_versions','document_scan_attestations')`);
    assert.equal(metadata.rowCount,3);for(const row of metadata.rows){assert.equal(row.relrowsecurity,true);assert.equal(row.direct,false);}
  });
  await check('same-tenant other Workspace document is denied, without existence evidence',async()=>{
    await denied(await request({...await addDocument({workspace:ids.workspaceIds[1],property:ids.propertyIds[1]})}),{},'AUTHORITY_DENIED');
  });
  await check('NULL legacy binding is never inferred from tenant/property',async()=>{
    await denied(await request({...await addDocument({workspace:null})}),{},'AUTHORITY_DENIED');
  });
  await check('unknown Document, Context, actor, transaction and AAL1 all deny without writes',async()=>{
    await denied(await request({document_id:randomUUID()}),{},'AUTHORITY_DENIED');
    await denied(await request({context_id:randomUUID()}));
    await denied(await request(),{actor:randomUUID()},'AUTHORITY_DENIED');
    await denied(await request(),{badTx:true},'AUTHORITY_DENIED');
    await denied(await request(),{aal:'aal1'},'AUTHORITY_DENIED');
    await denied(await request({authority_version:await revision()-1}));
    await denied(await request({authority_version:await revision()+1}));
  });
  await check('stale/future numeric version, wrong version ID and wrong document/version pairing deny',async()=>{
    for(const extra of [{document_version:2},{document_version_id:randomUUID()},
      {document_version_id:(await addDocument()).document_version_id}]) await denied(await request(extra),{},'STALE_VERSION');
    await pool.query('update documents.documents set current_version=2 where id=$1',[doc]);
    await denied(await request(),{},'STALE_VERSION');
    await pool.query('update documents.documents set current_version=1 where id=$1',[doc]);
  });
  await check('pending, deferred, quarantined, unattested clean and checksum mismatch are unsafe',async()=>{
    for(const extra of [{scan:'scanning_pending'},{scan:'deferred'},{scan:'quarantined'},
      {attested:false},{checksum:'mismatch'},{checksum:'failed'}]) {
      await denied(await request({...await addDocument(extra)}),{},'UNSAFE_SCAN_STATE');
    }
  });
  await check('active scan attestation must match the exact version content hash',async()=>{
    const document=await addDocument({attested:false});
    await pool.query(`insert into documents.document_scan_attestations
      (tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
      values($1,$2,'clamav',$3,'clean',$4,'test-clamav',statement_timestamp())`,
      [ids.tenantId,document.document_version_id,randomUUID(),'a'.repeat(64)]);
    await denied(await request(document),{},'UNSAFE_SCAN_STATE');
  });
  await check('soft-deleted, archived and disposal-approved content is denied',async()=>{
    for(const mutation of ["deleted_at=statement_timestamp()","archived_at=statement_timestamp()","status='archived'","disposition_status='disposition_approved'"]) {
      const document=await addDocument();await pool.query(`update documents.documents set ${mutation} where id=$1`,[document.document_id]);
      await denied(await request(document),{},'INACTIVE_DOCUMENT');
    }
  });
  await check('role classification rules remain stricter than a Core module allow',async()=>{
    const manager=(await pool.query("select id from identity.roles where code='property_manager' and tenant_id is null and is_system")).rows[0];
    await pool.query('update identity.memberships set role_id=$2 where id=$1',[ids.membershipId,manager.id]);
    await denied(await request({...await addDocument({classification:'restricted'})}),{},'AUTHORITY_DENIED');
    await pool.query('update identity.memberships set role_id=$2 where id=$1',[ids.membershipId,role.id]);
  });
  await check('replay rechecks read authority and cannot reuse earlier evidence after revocation',async()=>{
    const prior=await request();assert.equal((await evaluate(prior)).result.decision,'allowed');
    await pool.query("update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=$1 and entitlement_key='module.documents'",[ids.workspaceIds[0]]);
    await denied({...prior,evaluation_mode:'replay'});
    await denied(await request({evaluation_mode:'replay'}));
    await pool.query("update platform.workspace_entitlements set boolean_value=true where customer_workspace_id=$1 and entitlement_key='module.documents'",[ids.workspaceIds[0]]);
  });
  await check('Context expiry during evaluation is caught by the final authority recheck',async()=>{
    await pool.query("update identity.context_grants set ends_at=clock_timestamp()+interval '250 milliseconds' where id=$1",[ids.contextId]);
    let paused=false;
    await denied(await request(),{beforeQuery:async sql=>{
      if(sql.includes('document_scan_attestations')&&!paused){paused=true;await new Promise(r=>setTimeout(r,300));}
    }});
    assert.equal(paused,true);await pool.query('update identity.context_grants set ends_at=null where id=$1',[ids.contextId]);
  });
  await check('read locks serialize lifecycle deletion and hold safe reference until transaction ends',async()=>{
    let entered,release;const waiting=new Promise(r=>{entered=r;}),proceed=new Promise(r=>{release=r;});
    const req=await request();
    const reader=evaluate(req,{afterQuery:async sql=>{if(sql.includes('checksum_status from documents.document_versions')){entered();await proceed;}}});
    await waiting;const writer=await pool.connect();let update;
    try{
      await writer.query('begin');update=writer.query('update documents.documents set deleted_at=statement_timestamp() where id=$1',[doc]);
      await waitForLock(writer.processID);release();assert.equal((await reader).result.decision,'allowed');
      await update;await writer.query('commit');await denied(await request(),{},'INACTIVE_DOCUMENT');
    }finally{release();await reader;if(update)await update;await writer.query('rollback');writer.release();}
    await pool.query('update documents.documents set deleted_at=null where id=$1',[doc]);
  });
  await check('revocation committed during document-lock wait forces a fresh serializable attempt',async()=>{
    const blocker=await pool.connect();let pending;
    try{
      await blocker.query('begin');await blocker.query('select id from documents.documents where id=$1 for update',[doc]);
      pending=evaluate(await request()).then(x=>({value:x}),error=>({error}));
      await waitForQueryLock('from documents.documents d where d.id=$1');
      await pool.query("update identity.memberships set status='revoked',ends_at=statement_timestamp() where id=$1",[ids.membershipId]);
      await blocker.query('commit');const result=await pending;
      assert.equal(result.error?.code,'40001');
      await denied(await request(),{attempt:2});
    }finally{await blocker.query('rollback');blocker.release();if(pending)await pending;}
    await pool.query("update identity.memberships set status='active',ends_at=null where id=$1",[ids.membershipId]);
  });
  await check('concurrent exact reference replay returns fresh transaction evidence with zero writes',async()=>{
    const before=await digest(),req=await request({evaluation_mode:'replay'});
    const results=await Promise.all([evaluate(req),evaluate(req)]);
    for(const {result} of results)assert.equal(result.decision,'allowed');
    assert.notEqual(results[0].result.evidence.transaction_id,results[1].result.evidence.transaction_id);
    assert.equal(await digest(),before);
  });
  await check('Workspace rebind during lock wait cannot reuse an earlier document snapshot',async()=>{
    const source=await addDocument(),req=await request(source),writer=await pool.connect();let pending;
    try {
      await writer.query('begin');await writer.query('select id from documents.documents where id=$1 for update',[source.document_id]);
      pending=evaluate(req).then(value=>({value}),error=>({error}));
      await waitForQueryLock('from documents.documents d where d.id=$1');
      await writer.query('update documents.documents set workspace_id=$2 where id=$1',[source.document_id,ids.workspaceIds[1]]);
      await writer.query('commit');assert.equal((await pending).error?.code,'40001');
      await denied(await request(source),{attempt:2},'AUTHORITY_DENIED');
    }finally{await writer.query('rollback');writer.release();if(pending)await pending;}
  });
  await check('scanner quarantine committed before version lock forces fresh unsafe denial',async()=>{
    const source=await addDocument({scan:'scanning_pending',attested:false}),writer=await pool.connect();let pending;
    try {
      await writer.query('begin');await writer.query('select id from documents.document_versions where id=$1 for update',[source.document_version_id]);
      pending=evaluate(await request(source)).then(value=>({value}),error=>({error}));
      await waitForQueryLock('v.checksum_status from documents.document_versions');
      const attestation=randomUUID();
      await writer.query(`insert into documents.document_scan_attestations
        (id,tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
        select $1,tenant_id,id,'clamav',$2,'quarantined',sha256,'synthetic-clamav',statement_timestamp()
        from documents.document_versions where id=$3`,[attestation,randomUUID(),source.document_version_id]);
      await writer.query("select set_config('app.document_scan_attestation_id',$1,true)",[attestation]);
      await writer.query("update documents.document_versions set scanning_status='quarantined' where id=$1",[source.document_version_id]);
      await writer.query('commit');assert.equal((await pending).error?.code,'40001');
      await denied(await request(source),{attempt:2},'UNSAFE_SCAN_STATE');
    }finally{await writer.query('rollback');writer.release();if(pending)await pending;}
  });
  await check('existing Core transaction host rejects unsafe reference before canonical ledger staging',async()=>{
    const host=createCorePostgresTransactionHostV1(pool),unsafe=await addDocument({scan:'quarantined'}),before=await digest();
    let mutations=0;const cmd={contract_version:'core-transaction-command.v1',transaction_id:randomUUID(),command_id:randomUUID(),
      context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,authority_version:await revision(),
      permission_code:'documents.vault.read',module_code:'documents',evaluation_purpose:'doc_reference_test',
      aggregate_type:'documents.document',aggregate_id:unsafe.document_id,aggregate_version:1,
      provider_source_ids:[unsafe.document_version_id],idempotency_key:randomUUID(),input_fingerprint:'doc1:0123456789abcdef'};
    const result=await host.execute(cmd,{
      resolveAuthority:async(scope,req)=>{
        await scope.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:'authenticated',aal:'aal2'})]);
        return resolveAuthority(scope,req);
      },
      validateProviders:async scope=>(await resolve(scope,await request({...unsafe,command_id:cmd.command_id,authority_version:cmd.authority_version}))).decision==='allowed',
      mutate:async()=>{mutations++;throw new Error('must not mutate');},
    });
    assert.equal(result.status,'denied');assert.equal(result.code,'PROVIDER_UNAVAILABLE');assert.equal(mutations,0);assert.equal(await digest(),before);
  });
} finally {await pool.end();}
console.log(`Documents reference PostgreSQL: ${checks}/${checks} PASS; no Remote apply or activation`);

async function waitForLock(pid) {
  for(let i=0;i<150;i++){
    if((await pool.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock') return;
    await new Promise(r=>setTimeout(r,10));
  }throw new Error('expected real PostgreSQL lock wait');
}
async function waitForQueryLock(fragment) {
  for(let i=0;i<150;i++){
    const r=await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0",[fragment]);
    if(r.rows[0].n>0)return;await new Promise(r=>setTimeout(r,10));
  }throw new Error('expected document row lock wait');
}
