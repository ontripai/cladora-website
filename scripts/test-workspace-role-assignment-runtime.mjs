import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export async function runWorkspaceRoleAssignmentTests(f) {
 const {db,q,check,changed,setActor,id,tenant,user,otherUser,workspace,secondWorkspace,context,otherContext,physicalContext,member}=f;
 const target=(await q('select membership_id from identity.context_grants where id=$1',[otherContext]))[0].membership_id;
 const roleId=id(401),permission=id(402),secondIssuerContext=id(403);
 await db.exec(`
 create schema extensions;
 create function extensions.digest(bytea,text) returns bytea language sql immutable as $$select sha256($1)$$;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 insert into auth.users select distinct user_id,'{}'::jsonb from identity.memberships;
 alter table audit.events add column before_snapshot jsonb,add column occurred_at timestamptz;
 alter table platform.workspace_member_roles alter column id set default gen_random_uuid();
 alter table platform.workspace_member_roles alter column valid_from set default statement_timestamp();
 alter table platform.workspace_member_roles add column assigned_by_user_id uuid,add column assigned_by_membership_id uuid,
 add column lock_version integer default 1,add column reason text,add column created_at timestamptz default statement_timestamp();
 create table platform.workspace_role_idempotency(id uuid default gen_random_uuid(),tenant_id uuid,customer_workspace_id uuid,
 idempotency_key text,action text,request_hash text,request_hash_version integer,result_entity_id uuid,response_snapshot jsonb,
 actor_id uuid,created_at timestamptz default statement_timestamp(),unique(tenant_id,idempotency_key));
 delete from platform.workspace_member_roles where membership_id='${target}';
 insert into identity.permissions values('${permission}','workspace.role.assign');
 insert into identity.role_permissions select distinct role_id,'${permission}'::uuid,'allow' from identity.memberships where user_id in ('${user}','${otherUser}');
 insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id)
 select '${secondIssuerContext}',id,tenant_id,'property',(select property_id from identity.context_grants where id='${physicalContext}') from identity.memberships where id='${target}';
 insert into platform.workspace_roles(id,tenant_id,customer_workspace_id) values('${roleId}','${tenant}','${workspace}');
 insert into platform.workspace_role_modules values('${roleId}','${id(203)}');
 insert into platform.workspace_role_permissions values('${roleId}','${id(201)}','allow'),('${roleId}','${id(202)}','allow');
 `);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261003153509_workspace_role_assignment_completion.sql',import.meta.url),'utf8'));
 await db.exec('create trigger workspace_member_role_invariants before insert or update or delete on platform.workspace_member_roles for each row execute function app_private.guard_workspace_member_role_invariants_v1()');
 const assign=async(key='role-flow-001',ctx=physicalContext,expiry='2099-01-01T00:00:00Z')=>(await q('select customer_api.assign_workspace_role_v1($1,$2,$3,$4,null,null,null,$5,$6,$7) result',[ctx,target,roleId,'workspace',expiry,'Synthetic assignment flow',key]))[0].result;
 const revoke=async(key='revoke-flow-001',ctx=physicalContext)=>(await q('select customer_api.revoke_workspace_role_assignment_v1($1,$2,1,$3,$4) result',[ctx,assignment.id,'Synthetic revocation flow',key]))[0].result;
 let assignment;
 await setActor(user);
 await check('AAL2 issuer gets exact workspace native-eligible candidates',async()=>{const result=(await q('select customer_api.list_workspace_role_assignment_candidates_v1($1) result',[physicalContext]))[0].result;assert.equal(result.workspace_id,workspace);assert.ok(result.members.some(m=>m.membership_id===target));});
 await check('AAL1 cannot enumerate or assign',async()=>{await setActor(user,'aal1');await assert.rejects(()=>assign(),e=>e.code==='42501');await assert.rejects(()=>q('select customer_api.list_workspace_role_assignment_candidates_v1($1)',[physicalContext]),e=>e.code==='42501');await setActor(user);});
 await check('native eligible role assignment and exact retry return one canonical row',async()=>{assignment=await assign();assert.deepEqual(await assign(),assignment);assert.equal(Number((await q('select count(*) n from platform.workspace_member_roles where membership_id=$1',[target]))[0].n),1);});
 await check('assignment audit and shared event are emitted once with tenant',async()=>{for(const table of ['audit.events','platform.outbox_events'])assert.equal(Number((await q(`select count(*) n from ${table} where tenant_id=$1 and ${table==='audit.events'?'entity_id':'aggregate_id'}=$2`,[tenant,assignment.id]))[0].n),1);});
 await check('current base deny blocks a stored retry',async()=>changed(`update identity.role_permissions set effect='deny' where permission_id='${permission}' and role_id=(select role_id from identity.memberships where id='${member}')`,async()=>{await assert.rejects(()=>assign(),e=>e.code==='42501');}));
 await check('expired issuer membership cannot replay a successful assignment',async()=>changed(`update identity.memberships set ends_at=now() where id='${member}'`,async()=>{await assert.rejects(()=>assign(),e=>e.code==='42501');}));
 await check('different authorized issuer cannot reuse assignment key',async()=>{await setActor(otherUser);await assert.rejects(()=>assign('role-flow-001',secondIssuerContext),e=>e.code==='22023');await setActor(user);});
 await check('past expiry is rejected',async()=>{await assert.rejects(()=>assign('role-past-001',physicalContext,'2000-01-01'),e=>e.code==='22023');});
 await check('same key with changed payload conflicts',async()=>{await assert.rejects(()=>assign('role-flow-001',physicalContext,'2098-01-01'),e=>e.code==='22023');});
 await setActor(otherUser);
 await check('assigned account discovers and exercises native AIRPROP with exact retry',async()=>{assert.equal((await q('select * from customer_api.list_workspace_targets_v2($1)',[otherContext])).length,1);const payload={name:'Synthetic assignment flow',country_code:'RO',city:'Bucuresti',currency:'EUR',asking_price:'12.34'};const command=()=>q('select customer_api.create_airprop_opportunity_v2($1,$2,$3,$4::jsonb) result',[otherContext,workspace,'assignment-airprop-001',JSON.stringify(payload)]);const first=(await command())[0].result;const retry=(await command())[0].result;assert.equal(first.opportunity_id,retry.opportunity_id);assert.equal(retry.idempotent,true);const list=(await q('select customer_api.list_airprop_opportunities_v2($1,$2,50) result',[otherContext,workspace]))[0].result;assert.ok(list.opportunities.some(o=>o.opportunity_id===first.opportunity_id));});
 await check('assigned account cannot read a second workspace',async()=>{await assert.rejects(()=>q('select customer_api.list_airprop_opportunities_v2($1,$2,50)',[otherContext,secondWorkspace]),e=>e.code==='42501');});
 await setActor(user);
 await check('future-expiring assignment can be revoked before expiry with one exact retry',async()=>{const first=await revoke();assert.deepEqual(await revoke(),first);assert.equal(first.lock_version,2);assert.ok(Date.parse(first.valid_to)<Date.now()+1000);});
 await check('revocation audit and event emitted once',async()=>{assert.equal(Number((await q("select count(*) n from platform.outbox_events where aggregate_id=$1 and event_type='workspace.role.assignment.revoked.v1'",[assignment.id]))[0].n),1);});
 await check('different authorized issuer cannot reuse revocation key',async()=>{await setActor(otherUser);await assert.rejects(()=>revoke('revoke-flow-001',secondIssuerContext),e=>e.code==='22023');});
 await check('revocation removes discovery and denies reads',async()=>{assert.equal((await q('select * from customer_api.list_workspace_targets_v2($1)',[otherContext])).length,0);await assert.rejects(()=>q('select customer_api.list_airprop_opportunities_v2($1,$2,50)',[otherContext,workspace]),e=>e.code==='42501');});
 await check('expired assignment cannot be reopened',async()=>{await assert.rejects(()=>q('update platform.workspace_member_roles set valid_to=null,lock_version=3 where id=$1',[assignment.id]),e=>e.code==='42501');});
 await check('internal assignment helper execution is revoked',async()=>{for(const role of ['anon','authenticated','service_role'])assert.equal((await q("select has_function_privilege($1,'app_private.require_workspace_role_assignment_context_v1(uuid)','execute') allowed",[role]))[0].allowed,false);});
 if(db.openConnection)await check('independent PostgreSQL sessions serialize the assignment retry key',async()=>{
  const first=await db.openConnection(),second=await db.openConnection();let running;
  try {
   const claims=JSON.stringify({sub:user,aal:'aal2'});
   for(const connection of [first,second])await connection.query("select set_config('request.jwt.claims',$1,false)",[claims]);
   const pid1=(await first.query('select pg_backend_pid() pid')).rows[0].pid,pid2=(await second.query('select pg_backend_pid() pid')).rows[0].pid;
   const args=[physicalContext,target,roleId,'workspace','2099-01-01T00:00:00Z','Synthetic concurrent assignment','role-concurrent-001'];
   const sql='select customer_api.assign_workspace_role_v1($1,$2,$3,$4,null,null,null,$5,$6,$7) result';
   await first.query('begin');const result=(await first.query(sql,args)).rows[0].result;
   running=second.query(sql,args);running.catch(()=>{});let blocked=false;
   for(let attempt=0;attempt<80;attempt++){const blockers=(await q('select pg_blocking_pids($1) blockers',[pid2]))[0].blockers;if(blockers.includes(pid1)){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}
   assert.equal(blocked,true,'second session actually waits on first');await first.query('commit');assert.deepEqual((await running).rows[0].result,result);
   assert.equal(Number((await q('select count(*) n from platform.workspace_member_roles where id=$1',[result.id]))[0].n),1);
   assert.equal(Number((await q('select count(*) n from platform.outbox_events where aggregate_id=$1',[result.id]))[0].n),1);
  }finally{await first.query('rollback').catch(()=>{});if(running)await running.catch(()=>{});await first.end();await second.end();}
 });
}
