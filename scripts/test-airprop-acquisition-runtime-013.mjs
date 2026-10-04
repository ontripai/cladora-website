import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function runAirpropAcquisitionTests(f){
 const {db,q,check,changed,setActor,id,tenant,user,otherUser,grantorUser,workspace,secondWorkspace,context,otherContext,grantorContext,physicalContext,localRole,emptyLocalRole,grantorLocalRole,otherMember,grantorMember,property}=f;
 await db.exec(readFileSync(new URL('../supabase/migrations/20261004181830_airprop_acquisition_decision_v1.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) values('${grantorUser}') on conflict do nothing;`);
 const c=(await q('select d.* from airprop.diligence_cases d join airprop.diligence_submissions s on s.diligence_case_id=d.id'))[0],s=(await q('select * from airprop.diligence_submissions where diligence_case_id=$1',[c.id]))[0];
 const guarded=async fn=>{let saved=false;try{await db.exec('savepoint acquisition_expected_failure');saved=true;}catch(e){if(e.code!=='25P01')throw e;}try{return await fn();}finally{if(saved){await db.exec('rollback to savepoint acquisition_expected_failure');await db.exec('release savepoint acquisition_expected_failure');}}};
 const denied=fn=>assert.rejects(()=>guarded(fn),e=>e.code==='42501');
 const conflict=(fn,msg)=>assert.rejects(()=>guarded(fn),e=>e.code==='22023'&&(!msg||e.message===msg));
 let proposal;
 const propose=async(key='acquisition-propose-013',rationale='Synthetic internal review',ctx=context,dc=physicalContext)=>(await q('select customer_api.propose_airprop_acquisition_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',[ctx,workspace,c.opportunity_id,c.id,dc,s.id,s.revision,c.underwriting_version,rationale,key]))[0].r;
 const decide=async(ctx,dc,revision,key,decision='approve',rationale='Synthetic independent review')=>(await q('select customer_api.decide_airprop_acquisition_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',[ctx,workspace,c.opportunity_id,c.id,dc,proposal.proposal_id,revision,decision,rationale,key]))[0].r;
 const read=async(ctx=context,dc=physicalContext,ws=workspace)=>(await q('select customer_api.get_airprop_acquisition_v1($1,$2,$3,$4,$5) r',[ctx,ws,c.opportunity_id,c.id,dc]))[0].r;
 const counts=async()=>Promise.all(['airprop.acquisition_proposals','airprop.acquisition_decisions','audit.events','platform.outbox_events','platform.idempotency_keys'].map(async t=>Number((await q(`select count(*) n from ${t}`))[0].n)));
 await check('new decision permissions are not implicitly assigned',async()=>{assert.equal((await read()).can_propose,false);await denied(()=>propose());});
 await db.exec(`insert into platform.workspace_role_permissions select '${localRole}',id,'allow' from identity.permissions where code in('airprop.acquisition.propose','airprop.acquisition.approve');`);
 await check('submitted baseline is eligible and proposal binds authoritative revisions',async()=>{assert.equal((await read()).eligible,true);const before=await counts();proposal=await propose();assert.equal(proposal.decision_revision,1);assert.equal(proposal.status,'pending');assert.deepEqual(await counts(),before.map((n,i)=>n+(i===1?0:1)));assert.equal((await read()).can_decide,false);});
 await check('exact proposal retry retains response with no side effects',async()=>{const before=await counts();assert.deepEqual(await propose(),{...proposal,idempotent:true});assert.deepEqual(await counts(),before);});
 await check('duplicate proposal and changed retry content conflict',async()=>{await conflict(()=>propose('acquisition-other-key-013'),'airprop_acquisition_proposal_conflict');await conflict(()=>propose('acquisition-propose-013','Changed rationale'),'airprop_idempotency_conflict');});
 await check('proposer and baseline author cannot approve themselves',()=>denied(()=>decide(context,physicalContext,1,'self-review-013')));
 // Two independent actors reuse actual memberships, explicit contexts, local permissions and Vault resolver.
 const reviewerDocs=[id(50),id(751)];
 await db.exec(`insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values('${reviewerDocs[1]}','${grantorMember}','${tenant}','property','${property}');
 update identity.roles set code='association_admin' where id in(select role_id from identity.memberships where id in('${otherMember}','${grantorMember}'));
 insert into identity.role_permissions select m.role_id,p.id,'allow' from identity.memberships m cross join identity.permissions p where m.id in('${otherMember}','${grantorMember}') and p.code='documents.vault.read';
 insert into platform.workspace_role_modules select r.id,m.id from platform.workspace_roles r cross join platform.module_definitions m where r.id in('${emptyLocalRole}','${grantorLocalRole}') and m.code='airprop_commercial';
 insert into platform.workspace_role_permissions select r.id,p.id,'allow' from platform.workspace_roles r cross join identity.permissions p where r.id in('${emptyLocalRole}','${grantorLocalRole}') and p.code in('airprop.opportunity.read','airprop.acquisition.approve');`);
 await setActor(otherUser);
 await check('missing physical document context rejects reviewer',()=>denied(()=>decide(otherContext,physicalContext,1,'other-doc-context-013')));
 await check('one independent approval remains pending',async()=>{assert.equal((await read(otherContext,reviewerDocs[0])).can_decide,true);const before=await counts();const r=await decide(otherContext,reviewerDocs[0],1,'first-review-013');assert.equal(r.status,'pending');assert.equal(r.approval_count,1);assert.equal(r.decision_revision,2);assert.deepEqual(await counts(),before.map((n,i)=>n+(i===0?0:1)));assert.equal((await read(otherContext,reviewerDocs[0])).can_decide,false);});
 await check('same person cannot cast second vote or revise first vote',async()=>{await denied(()=>decide(otherContext,reviewerDocs[0],2,'repeat-actor-013'));await conflict(()=>decide(otherContext,reviewerDocs[0],1,'first-review-013','reject'),'airprop_idempotency_conflict');assert.equal((await decide(otherContext,reviewerDocs[0],1,'first-review-013')).idempotent,true);});
 await setActor(grantorUser);
 await check('stale optimistic revision fails without partial writes',async()=>{const before=await counts();await conflict(()=>decide(grantorContext,reviewerDocs[1],1,'stale-vote-013'),'airprop_acquisition_decision_conflict');assert.deepEqual(await counts(),before);});
 for(const[name,sql]of[
 ['current document changed',"update documents.documents set current_version=2"],
 ['document no longer verified',"update documents.documents set evidence_status='none'"],
 ['newer underwriting baseline',`update airprop.underwriting_cases set current_version=current_version+1 where id='${c.underwriting_case_id}'`],
 ['review role revoked',`update platform.workspace_member_roles set valid_to=now() where membership_id='${grantorMember}'`],
 ['module disabled',"update platform.workspace_modules set status='inactive' where module_code='airprop_commercial'"],
 ])await check(`${name} prevents second approval`,()=>changed(sql,async()=>{await assert.rejects(()=>guarded(()=>decide(grantorContext,reviewerDocs[1],2,'blocked-second-013')),e=>['42501','22023'].includes(e.code));}));
 await check('historical proposal remains visible with changed baseline and actions disabled',()=>changed(`update airprop.underwriting_cases set current_version=current_version+1 where id='${c.underwriting_case_id}'`,async()=>{const r=await read(grantorContext,reviewerDocs[1]);assert.equal(r.eligible,false);assert.equal(r.can_decide,false);assert.equal(r.proposal.approval_count,1);}));
 await check('AAL1 prevents read, approval and replay',async()=>{await setActor(grantorUser,'aal1');try{await denied(()=>read(grantorContext,reviewerDocs[1]));await denied(()=>decide(grantorContext,reviewerDocs[1],2,'aal1-vote-013'));}finally{await setActor(grantorUser);}});
 await check('expired proposal blocks fresh decision but remains readable',()=>changed(`alter table airprop.acquisition_proposals disable trigger immutable_acquisition_proposal;update airprop.acquisition_proposals set proposed_at=now()-interval '8 days',expires_at=now()-interval '1 day';alter table airprop.acquisition_proposals enable trigger immutable_acquisition_proposal;`,async()=>{assert.equal((await read(grantorContext,reviewerDocs[1])).proposal.expired,true);assert.equal((await read(grantorContext,reviewerDocs[1])).can_decide,false);await conflict(()=>decide(grantorContext,reviewerDocs[1],2,'expired-vote-013'),'airprop_acquisition_decision_conflict');}));
 await check('same-tenant different workspace rejected',()=>assert.rejects(()=>read(grantorContext,reviewerDocs[1],secondWorkspace)));
 await check('independent rejection is terminal and preserves first approval',()=>changed('',async()=>{const r=await decide(grantorContext,reviewerDocs[1],2,'reject-vote-013','reject');assert.equal(r.status,'rejected');assert.equal(r.approval_count,1);assert.equal((await read(grantorContext,reviewerDocs[1])).can_decide,false);}));
 await check('two independent approvals complete internal decision without execution',async()=>{const r=await decide(grantorContext,reviewerDocs[1],2,'second-review-013');assert.equal(r.status,'internally_approved');assert.equal(r.approval_count,2);assert.equal(r.decision_revision,3);assert.equal((await read(grantorContext,reviewerDocs[1])).can_decide,false);assert.equal((await q('select status from airprop.investment_opportunities where id=$1',[c.opportunity_id]))[0].status,'underwriting');});
 await check('terminal retries are immutable and revoked permission blocks replay',async()=>{assert.equal((await decide(grantorContext,reviewerDocs[1],2,'second-review-013')).idempotent,true);await denied(()=>decide(grantorContext,reviewerDocs[1],2,'new-terminal-key-013'));await changed(`update platform.workspace_role_permissions set effect='deny' where workspace_role_id='${grantorLocalRole}' and permission_id=(select id from identity.permissions where code='airprop.acquisition.approve')`,()=>denied(()=>decide(grantorContext,reviewerDocs[1],2,'second-review-013')));});
 await check('proposal and decisions cannot be updated or deleted',async()=>{await conflict(()=>q('delete from airprop.acquisition_decisions'),'airprop_acquisition_decision_immutable');await conflict(()=>q('update airprop.acquisition_proposals set expires_at=now()'),'airprop_acquisition_decision_immutable');});
 await check('table and private helpers are closed to customers and service-role',async()=>{for(const role of['anon','authenticated','service_role'])for(const table of['acquisition_proposals','acquisition_decisions'])assert.equal((await q("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') ok",[role,`airprop.${table}`]))[0].ok,false);});
 if(db.openConnection)await check('waiting exact approval replay rechecks revoked reviewer permission',async()=>{
 const a=await db.openConnection(),b=await db.openConnection();let running;
 try{for(const connection of[a,b]){await connection.query('begin');await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:grantorUser,aal:'aal2'})]);}
 const pid=Number((await b.query('select pg_backend_pid() pid')).rows[0].pid);await a.query('select 1 from airprop.investment_opportunities where id=$1 for update',[c.opportunity_id]);
 running=b.query('select customer_api.decide_airprop_acquisition_v1($1,$2,$3,$4,$5,$6,2,$7,$8,$9)',[grantorContext,workspace,c.opportunity_id,c.id,reviewerDocs[1],proposal.proposal_id,'approve','Synthetic independent review','second-review-013']).then(r=>({r}),e=>({e}));let blocked=false;
 for(let i=0;i<100;i++){if((await q('select cardinality(pg_blocking_pids($1)) n',[pid]))[0].n>0){blocked=true;break;}await new Promise(r=>setTimeout(r,25));}assert.ok(blocked);
 await q(`update platform.workspace_role_permissions set effect='deny' where workspace_role_id=$1 and permission_id=(select id from identity.permissions where code='airprop.acquisition.approve')`,[grantorLocalRole]);await a.query('commit');assert.equal((await running).e?.code,'42501');
 }finally{await a.query('rollback');await b.query('rollback');if(running)await running;await q(`update platform.workspace_role_permissions set effect='allow' where workspace_role_id=$1 and permission_id=(select id from identity.permissions where code='airprop.acquisition.approve')`,[grantorLocalRole]);await a.end();await b.end();}
 });

 if(db.openConnection)await check('two concurrent independent votes on one expected revision serialize without double counting',async()=>{
 await setActor();
 const opportunity=(await q('select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) r',[context,workspace,'acquisition-race-opp-013',JSON.stringify({name:'Synthetic decision race',country_code:'RO',city:'Bucuresti',currency:'EUR',asking_price:'100000'})]))[0].r.opportunity_id;
 await q('select customer_api.create_airprop_underwriting_v2($1,$2,$3,$4,0,$5::jsonb)',[context,workspace,opportunity,'acquisition-race-eval-013',JSON.stringify({acquisition_cost:'100000',annual_rent:'8000',annual_opex:'1000',currency:'EUR'})]);
 const draft=(await q('select customer_api.create_airprop_diligence_draft_v1($1,$2,$3,1,$4) r',[context,workspace,opportunity,'acquisition-race-draft-013']))[0].r;
 const version=(await q("select id from documents.document_versions where object_path='synthetic/012.txt'"))[0].id;
 const snapshot={checklist:['legal','financial','technical'].map(code=>({code,status:'satisfied',evidence_version_ids:[version]})),findings:[]};
 await q('select customer_api.save_airprop_diligence_revision_v1($1,$2,$3,$4,$5,1,$6::jsonb,$7)',[context,workspace,opportunity,draft.diligence_case_id,physicalContext,JSON.stringify(snapshot),'acquisition-race-save-013']);
 const submission=(await q('select customer_api.submit_airprop_diligence_review_v1($1,$2,$3,$4,$5,2,1,1,$6) r',[context,workspace,opportunity,draft.diligence_case_id,physicalContext,'acquisition-race-submit-013']))[0].r;
 const proposal=(await q('select customer_api.propose_airprop_acquisition_v1($1,$2,$3,$4,$5,$6,2,1,$7,$8) r',[context,workspace,opportunity,draft.diligence_case_id,physicalContext,submission.submission_id,'Synthetic race proposal','acquisition-race-propose-013']))[0].r;
 const a=await db.openConnection(),b=await db.openConnection();let running;
 const sql='select customer_api.decide_airprop_acquisition_v1($1,$2,$3,$4,$5,$6,1,$7,$8,$9) r';
 try{
 await a.query('begin');await a.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:otherUser,aal:'aal2'})]);
 await b.query('begin');await b.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:grantorUser,aal:'aal2'})]);
 const first=(await a.query(sql,[otherContext,workspace,opportunity,draft.diligence_case_id,reviewerDocs[0],proposal.proposal_id,'approve','First concurrent reviewer','acquisition-race-first-013'])).rows[0].r;
 const pid=Number((await b.query('select pg_backend_pid() pid')).rows[0].pid);
 running=b.query(sql,[grantorContext,workspace,opportunity,draft.diligence_case_id,reviewerDocs[1],proposal.proposal_id,'approve','Second concurrent reviewer','acquisition-race-second-013']).then(r=>({r}),e=>({e}));let blocked=false;
 for(let i=0;i<100;i++){if((await q('select cardinality(pg_blocking_pids($1)) n',[pid]))[0].n>0){blocked=true;break;}await new Promise(r=>setTimeout(r,25));}assert.ok(blocked);assert.equal(first.approval_count,1);
 await a.query('commit');assert.equal((await running).e?.message,'airprop_acquisition_decision_conflict');
 assert.equal(Number((await q('select count(*) n from airprop.acquisition_decisions where proposal_id=$1',[proposal.proposal_id]))[0].n),1);
 }finally{await a.query('rollback');await b.query('rollback');if(running)await running;await a.end();await b.end();}
 });
 await setActor();
 console.log('AIRPROP acquisition internal decision runtime checks passed');
}
