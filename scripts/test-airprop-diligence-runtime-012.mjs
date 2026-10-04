import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function runAirpropDiligenceReviewTests(f){
 const {db,q,check,changed,setActor,id,tenant,user,otherUser,workspace,secondWorkspace,context,physicalContext,localRole,member,property}=f;
 const file=name=>readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
 const extract=(source,name)=>{const start=source.indexOf(`create or replace function ${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('$$;',start)+3);};
 await db.exec(`create schema documents;create schema communications;
 create table documents.documents(id uuid primary key,tenant_id uuid,property_id uuid,title text,document_type text,classification text,current_version integer,status text,deleted_at timestamptz,is_evidence boolean,evidence_status text,verified_by uuid,verified_at timestamptz,created_by uuid);
 create table documents.document_versions(id uuid primary key,tenant_id uuid,document_id uuid,version integer,scanning_status text,checksum_status text,sha256 text,object_path text,mime_type text,size_bytes bigint,created_at timestamptz);
 create table documents.document_scan_attestations(version_id uuid,tenant_id uuid,provider text,verdict text,content_sha256 text);
 create table documents.document_links(document_id uuid,entity_type text,entity_id uuid);
 create table documents.document_audit_links(document_id uuid);
 create table documents.document_permissions(document_id uuid,tenant_id uuid,permission text,membership_id uuid,valid_from timestamptz,valid_until timestamptz);
 create table documents.access_events(tenant_id uuid,document_id uuid,version_id uuid,actor_id uuid,action text,purpose text);
 alter table portfolio.units add column status text default 'active';
 -- Unused relationship branches fail closed in this isolated admin fixture; full pgTAP exercises canonical migration chain.
 create function communications.member_covers_unit(uuid,uuid,uuid) returns boolean language sql as $$select false$$;
 create function communications.context_covers_unit(uuid,uuid) returns boolean language sql as $$select false$$;
 insert into platform.workspace_modules(customer_workspace_id,module_code) values('${workspace}','documents');
 insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,boolean_value) values('${workspace}','module.documents',true);
 insert into identity.permissions(code) values('documents.vault.read');
 insert into identity.role_permissions select role_id,p.id,'allow' from identity.memberships m cross join identity.permissions p where m.id='${member}' and p.code='documents.vault.read';
 update identity.roles set code='association_admin' where id=(select role_id from identity.memberships where id='${member}');`);
 await db.exec(extract(file('20260928083600_vault_actor_exact_membership_role.sql'),'documents.resolve_vault_actor'));
 await db.exec(extract(file('20260829005100_customer_document_vault_secure_evidence.sql'),'documents.customer_document_scope_matches'));
 await db.exec(extract(file('20260927211358_document_vault_checked_download_only.sql'),'documents.authorize_download_internal'));
 await db.exec(file('20261004123006_airprop_diligence_review_v1.sql'));
 const submissionPermission=(await q("select id from identity.permissions where code='airprop.diligence.submit'"))[0].id;
 const opportunity=(await q('select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) r',[context,workspace,'diligence-review-opp-012',JSON.stringify({name:'Diligence review 012',country_code:'RO',city:'Bucuresti',currency:'EUR',asking_price:'100000'})]))[0].r.opportunity_id;
 await q('select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,0,$5::jsonb)',[context,workspace,opportunity,'diligence-review-eval-012',JSON.stringify({acquisition_cost:'100000',annual_rent:'8000',annual_opex:'1000',currency:'EUR'})]);
 const caseId=(await q('select customer_api.create_airprop_diligence_draft_v1($1,$2,$3,1,$4) r',[context,workspace,opportunity,'diligence-review-case-012']))[0].r.diligence_case_id;
 const doc=id(701),version=id(702),hash='a'.repeat(64);
 await db.exec(`insert into documents.documents values('${doc}','${tenant}','${property}','Verified synthetic evidence','legal','internal',1,'active',null,true,'verified','${otherUser}',now(),'${user}');
 insert into documents.document_versions values('${version}','${tenant}','${doc}',1,'clean','verified','${hash}','synthetic/012.txt','text/plain',20,now()-interval '1 minute');
 insert into documents.document_scan_attestations values('${version}','${tenant}','clamav','clean','${hash}');`);
 let content={checklist:['legal','financial','technical'].map(code=>({code,status:'satisfied',evidence_version_ids:[version]})),findings:[]};
 const save=async(rev,key,snapshot=content,dc=physicalContext,ws=workspace)=>(await q('select customer_api.save_airprop_diligence_revision_v1($1,$2,$3,$4,$5,$6,$7::jsonb,$8) r',[context,ws,opportunity,caseId,dc,rev,JSON.stringify(snapshot),key]))[0].r;
 const submit=async(rev,key='diligence-submit-012',base=1)=>(await q('select customer_api.submit_airprop_diligence_review_v1($1,$2,$3,$4,$5,$6,$7,1,$8) r',[context,workspace,opportunity,caseId,physicalContext,rev,base,key]))[0].r;
 const read=async(dc=physicalContext)=>(await q('select customer_api.get_airprop_diligence_review_v1($1,$2,$3,$4,$5) r',[context,workspace,opportunity,caseId,dc]))[0].r;
 const guarded=async fn=>{let saved=false;try{await db.exec('savepoint review_expected_failure');saved=true;}catch(e){if(e.code!=='25P01')throw e;}try{return await fn();}finally{if(saved){await db.exec('rollback to savepoint review_expected_failure');await db.exec('release savepoint review_expected_failure');}}};
 const denied=fn=>assert.rejects(()=>guarded(fn),e=>e.code==='42501');
 const conflict=(fn,msg)=>assert.rejects(()=>guarded(fn),e=>e.code==='22023'&&(!msg||e.message===msg));
 const counts=async()=>Promise.all(['airprop.diligence_revisions','airprop.diligence_submissions','airprop.diligence_revision_evidence','audit.events','platform.outbox_events','platform.idempotency_keys'].map(async t=>Number((await q(`select count(*) n from ${t}`))[0].n)));
 await check('read initial draft without document refs',async()=>{assert.equal((await read(null)).revision,1);assert.equal((await read(null)).ready_for_review,false);});
 for(const [name,sql] of [
 ['scanner deferred',"update documents.document_versions set scanning_status='deferred'"],['no trusted attestation','delete from documents.document_scan_attestations'],['mismatched content attestation',"update documents.document_scan_attestations set content_sha256=repeat('b',64)"],['unverified evidence',"update documents.documents set evidence_status='none'"],['creator self-verification',`update documents.documents set verified_by='${user}'`],['version stale','update documents.documents set current_version=2'],['document removed',"update documents.documents set deleted_at=now()"],['binding expired','update platform.workspace_property_bindings set valid_to=now()'],['documents disabled',"update platform.workspace_modules set status='inactive' where module_code='documents'"],['document entitlement missing',"update platform.workspace_entitlements set boolean_value=false where entitlement_key='module.documents'"],['classification scope denial',`update identity.roles set code='property_manager' where id=(select role_id from identity.memberships where id='${member}');update documents.documents set classification='restricted'`],['vault read denied',"update identity.role_permissions set effect='deny' where permission_id=(select id from identity.permissions where code='documents.vault.read')"],
 ])await check(`${name} rejects evidence before revision persists`,()=>changed(sql,()=>denied(()=>save(1,'evidence-reject-012'))));
 await check('native context cannot replace explicit physical document access',()=>denied(()=>save(1,'native-document-012',content,context)));
 await check('other actor document context rejected',()=>denied(()=>save(1,'wrong-context-012',content,id(50))));
 await check('save links exact evidence version and append-only revision',async()=>{const before=await counts();const r=await save(1,'diligence-save-012');assert.equal(r.revision,2);assert.deepEqual(await counts(),before.map((n,i)=>n+(i===1?0:1)));assert.equal((await read()).ready_for_review,true);});
 await check('same-key replay does not repeat review side effects',async()=>{const before=await counts();assert.equal((await save(1,'diligence-save-012')).idempotent,true);assert.deepEqual(await counts(),before);});
 await check('retry still requires current document access',()=>changed("update identity.role_permissions set effect='deny' where permission_id=(select id from identity.permissions where code='documents.vault.read')",async()=>{await denied(()=>save(1,'diligence-save-012'));await denied(()=>read());}));
 await check('historical verified source remains readable but blocks readiness and retries after version change',()=>changed('update documents.documents set current_version=2',async()=>{assert.equal((await read()).revision,2);assert.equal((await read()).ready_for_review,false);await denied(()=>save(1,'diligence-save-012'));}));
 await check('stale edits and changed key payload conflict',async()=>{await conflict(()=>save(1,'stale-save-012'));await conflict(()=>save(1,'diligence-save-012',{...content,findings:[{finding_id:id(710),severity:'blocking',status:'open',summary:'Issue',evidence_version_ids:[]}]}),'airprop_idempotency_conflict');});
 await check('direct RPC strict shape rejects injected readiness and missing codes',async()=>{await conflict(()=>save(2,'bad-save-012',{...content,approved:true}));await conflict(()=>save(2,'bad-save-012',{...content,checklist:content.checklist.slice(1)}));});
 await check('submission permission is not implicitly granted by manage',()=>denied(()=>submit(2)));
 await db.exec(`insert into platform.workspace_role_permissions values('${localRole}','${submissionPermission}','allow');`);
 content={...content,findings:[{finding_id:id(710),severity:'blocking',status:'open',summary:'Synthetic blocker',evidence_version_ids:[version]}]};await save(2,'blocking-save-012');
 await check('open blocking finding prevents submission',()=>conflict(()=>submit(3),'airprop_diligence_not_ready'));
 await check('existing blocker cannot disappear or change severity',async()=>{await conflict(()=>save(3,'erase-blocker-012',{...content,findings:[]}));await conflict(()=>save(3,'downgrade-blocker-012',{...content,findings:[{...content.findings[0],severity:'advisory'}]}));});
 content.findings=[{...content.findings[0],status:'resolved',resolution:'Verified remediation'}];
 await check('resolution requires independently verified version reference',()=>conflict(()=>save(3,'bad-resolution-012',{...content,findings:[{...content.findings[0],evidence_version_ids:[]}]})));
 await save(3,'resolved-save-012');
 let submitted;
 await check('complete exact revision submitted atomically without acquisition approval',async()=>{const before=await counts();submitted=await submit(4);assert.equal(submitted.status,'submitted');assert.deepEqual(await counts(),before.map((n,i)=>n+([1,3,4,5].includes(i)?1:0)));assert.equal((await read()).status,'submitted');assert.equal((await q('select status from airprop.investment_opportunities where id=$1',[opportunity]))[0].status,'underwriting');});
 await check('exact submitted retry succeeds but edits and new submit keys rejected',async()=>{assert.deepEqual(await submit(4),{...submitted,idempotent:true});await conflict(()=>save(4,'after-submit-012'));await conflict(()=>submit(4,'new-submit-012'));});
 await check('revision and submission remain immutable',async()=>{await conflict(()=>q('delete from airprop.diligence_revisions'));await conflict(()=>q('update airprop.diligence_submissions set submitted_at=now()'));});
 await check('cross-workspace access and revoked native role reject retries',async()=>{await assert.rejects(()=>save(1,'diligence-save-012',content,physicalContext,secondWorkspace));await changed(`update platform.workspace_member_roles set valid_to=now() where membership_id='${member}'`,()=>denied(()=>submit(4)));});
 await check('evidence picker returns only authorized current verified versions without paths',async()=>{const r=(await q('select customer_api.list_airprop_diligence_evidence_v1($1,$2,$3,$4) r',[context,workspace,opportunity,physicalContext]))[0].r;assert.equal(r.evidence.length,1);assert.equal(r.evidence[0].version_id,version);assert.equal(JSON.stringify(r).includes('synthetic/'),false);});
 await check('direct clients cannot read review/evidence/submission tables or helpers',async()=>{for(const t of ['diligence_revisions','diligence_submissions','diligence_revision_evidence'])for(const role of ['anon','authenticated','service_role'])assert.equal((await q("select has_table_privilege($1,$2,'SELECT') ok",[role,`airprop.${t}`]))[0].ok,false);});
 if(db.openConnection)await check('waiting submission replay rechecks revoked document permission',async()=>{
 const a=await db.openConnection(),b=await db.openConnection();let running;
 const rpc='select customer_api.submit_airprop_diligence_review_v1($1,$2,$3,$4,$5,4,1,1,$6)',args=[context,workspace,opportunity,caseId,physicalContext,'diligence-submit-012'];
 try{for(const c of[a,b]){await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,aal:'aal2'})]);}
 const pid=Number((await b.query('select pg_backend_pid() pid')).rows[0].pid);await a.query('select 1 from airprop.investment_opportunities where id=$1 for update',[opportunity]);running=b.query(rpc,args).then(r=>({r}),e=>({e}));let blocked=false;
 for(let i=0;i<100;i++){if((await q('select cardinality(pg_blocking_pids($1)) n',[pid]))[0].n>0){blocked=true;break;}await new Promise(r=>setTimeout(r,25));}assert.ok(blocked);
 await q("update identity.role_permissions set effect='deny' where permission_id=(select id from identity.permissions where code='documents.vault.read')");await a.query('commit');assert.equal((await running).e?.code,'42501');
 }finally{await a.query('rollback');await b.query('rollback');if(running)await running;await q("update identity.role_permissions set effect='allow' where permission_id=(select id from identity.permissions where code='documents.vault.read')");await a.end();await b.end();}
 });
 console.log('AIRPROP diligence review runtime checks passed');
}
