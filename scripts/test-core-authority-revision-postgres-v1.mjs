import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString=process.env.CORE_AUTH_PROVIDER_TEST_DATABASE_URL;
if(!connectionString||process.env.CORE_AUTH_PROVIDER_EPHEMERAL!=='1') throw new Error('Explicit disposable target required');
const target=new URL(connectionString);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)
  || !['/core_auth_provider_test','/postgres'].includes(target.pathname)) throw new Error('Local disposable PostgreSQL only');
const require=createRequire(import.meta.url),cache=new Map();
function load(url){
  if(cache.has(url.href))return cache.get(url.href);
  const compiled=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const mod={exports:{}};
  new Function('require','module','exports',compiled.outputText)(name=>name.startsWith('.')
    ?load(new URL(name.endsWith('.ts')?name:`${name}.ts`,url)):require(name),mod,mod.exports);
  cache.set(url.href,mod.exports);return mod.exports;
}
const {resolveAuthority}=load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts',import.meta.url));
const {createCorePostgresTransactionHostV1}=load(new URL('../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const {bindCanonicalCurrentAuthorityObservationV1}=load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../docs/contracts/CORE-AUTHORITY-REVISION-SOURCES-v1.json',import.meta.url),'utf8'));
const pool=new pg.Pool({connectionString,max:12}),host=createCorePostgresTransactionHostV1(pool);
const actor=randomUUID(),otherActor=randomUUID(),driver=createAp10CoreAuthorityDriver(pool);
let passed=0;const check=async(name,fn)=>{await fn();passed+=1;console.log(`ok ${passed} - ${name}`);};
const revision=async(client=pool)=>Number((await client.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);
let ids;
try{
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now()),
    ($3,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$4,now(),now())`,
    [actor,`revision-${randomUUID()}@example.invalid`,otherActor,`revision-${randomUUID()}@example.invalid`]);
  ids=await driver.setup({userId:actor,runId:randomUUID(),target:'local'});
  const moduleDefinition=(await pool.query("select id,entitlement_key from platform.module_definitions where code='airprop_commercial' and is_active")).rows[0];
  const permission=(await pool.query("select id from identity.permissions where code='airprop.asset.manage'")).rows[0];
  const systemRole=(await pool.query('select role_id from identity.memberships where id=$1',[ids.membershipId])).rows[0].role_id;
  const grantee=randomUUID(),delegation=randomUUID();
  await pool.query(`insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
    values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second')`,[grantee,ids.tenantId,otherActor,systemRole]);
  await pool.query(`insert into platform.workspace_member_role_authority_sources
    (assignment_id,permission_id,module_definition_id,source_kind,source_identity_role_id,authority_depth)
    values($1,$2,$3,'identity_role',$4,0)`,[ids.assignmentIds[0],permission.id,moduleDefinition.id,systemRole]);
  await pool.query(`insert into platform.workspace_delegations
    (id,tenant_id,customer_workspace_id,delegation_code,grantor_membership_id,grantee_membership_id,
     grantor_user_id,grantee_user_id,scope_type,purpose,valid_from,valid_until,created_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,'workspace','Synthetic authority revision coverage',
      statement_timestamp()-interval '1 second',statement_timestamp()+interval '1 hour',$7)`,
    [delegation,ids.tenantId,ids.workspaceIds[0],randomUUID(),ids.membershipId,grantee,actor,otherActor]);
  const binding=(await pool.query(`select id,module_definition_id,permission_id from platform.module_permission_bindings
    where is_delegable and lifecycle_status='active' limit 1`)).rows[0];
  await pool.query(`insert into platform.workspace_delegation_permissions
    (delegation_id,module_definition_id,permission_id,module_permission_binding_id)
    values($1,$2,$3,$4)`,[delegation,binding.module_definition_id,binding.permission_id,binding.id]);

  let aggregateVersion=0;
  const command=async(extra={})=>({contract_version:'core-transaction-command.v1',transaction_id:randomUUID(),command_id:randomUUID(),
    context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,authority_version:await revision(),
    permission_code:'airprop.asset.manage',module_code:'airprop_commercial',evaluation_purpose:'auth_revision_test',
    aggregate_type:'property',aggregate_id:ids.propertyIds[0],aggregate_version:++aggregateVersion,provider_source_ids:[],
    idempotency_key:randomUUID(),input_fingerprint:'tx1:0123456789abcdef',...extra});
  let providerCode,lastObservation,lastRequest,mutations=0;
  const callbacks=(options={})=>({
    async resolveAuthority(scope,request){
      await scope.query("select set_config('request.jwt.claims',$1,true)",
        [JSON.stringify({sub:options.actor||actor,role:'authenticated',aal:options.aal||'aal2'})]);
      try{
        lastRequest=options.request?options.request(request):request;
        lastObservation=await resolveAuthority(scope,lastRequest);return lastObservation;
      }catch(error){providerCode=error.code;throw error;}
    },
    async validateProviders(scope){
      if(options.providerFailure)throw new Error('synthetic provider failure');
      if(options.pause)await options.pause(scope);
      return true;
    },
    async mutate(scope,cmd){
      mutations+=1;
      const row=await scope.query('update portfolio.properties set name=$2 where id=$1 returning id',[cmd.aggregate_id,`Revision ${cmd.command_id}`]);
      if(options.rollback)throw new Error('synthetic rollback');
      return {mutation_id:row.rows[0].id};
    },
  });
  const effects=async()=> (await pool.query(`select
    (select count(*)::int from platform.idempotency_keys where tenant_id=$1) idem,
    (select count(*)::int from audit.events where tenant_id=$1) audit,
    (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox,
    (select name from portfolio.properties where id=$2) name,
    (select revision::text from app_private.canonical_authority_revision_v1 where singleton) revision`,[ids.tenantId,ids.propertyIds[0]])).rows[0];
  const denied=async(cmd,options={},expected)=>{
    providerCode=undefined;const before=await effects(),beforeMutations=mutations;
    const result=await host.execute(cmd,callbacks(options));
    assert.equal(result.status,'denied');if(expected)assert.equal(providerCode,expected);
    assert.deepEqual(await effects(),before);assert.equal(mutations,beforeMutations);return result;
  };
  await check('transitive live evaluator dependencies exactly covered by source manifest',async()=>{
    const defs=(await pool.query(`select proname,pg_get_functiondef(p.oid) definition from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.prokind='f'`)).rows;
    const functions=new Set(['check_workspace_native_permission_v2','customer_mfa_required']),seen=new Set(),sources=new Set();
    while([...functions].some(f=>!seen.has(f))){
      for(const name of [...functions].filter(f=>!seen.has(f))){
        seen.add(name);const matches=defs.filter(d=>d.proname===name);assert.ok(matches.length);
        for(const {definition} of matches){
          for(const m of definition.matchAll(/app_private\.([a-z0-9_]+)\s*\(/g))functions.add(m[1]);
          for(const m of definition.matchAll(/\b(?:from|join)\s+((?:identity|platform|portfolio)\.[a-z0-9_]+)/gi))sources.add(m[1]);
        }
      }
    }
    assert.deepEqual([...sources].sort(),manifest.sources);assert.deepEqual([...seen].sort(),manifest.evaluator_functions);
    const definitions=defs.filter(d=>seen.has(d.proname)).map(d=>d.definition).sort().join('\n');
    assert.equal(createHash('sha256').update(definitions).digest('hex'),manifest.evaluator_definition_sha256,
      'Evaluator DDL drift requires a new dependency review; this hash is not an authority revision');
  });
  // Each populated canonical source is actually truncated, not just touched by
  // an empty UPDATE. CASCADE effects and its epoch bump then roll back together.
  for(const source of manifest.sources){
    await check(`actual populated-source mutation and rollback: ${source}`,async()=>{
      assert.match(source,/^(identity|platform|portfolio)\.[a-z0-9_]+$/);
      const c=await pool.connect();const before=await revision();
      try{
        await c.query('begin');const count=Number((await c.query(`select count(*)::text n from ${source}`)).rows[0].n);
        assert.ok(count>0,`${source}: populated fixture required`);
        await c.query(`truncate ${source} cascade`);
        assert.equal(Number((await c.query(`select count(*)::text n from ${source}`)).rows[0].n),0);
        assert.ok(await revision(c)>before);
        await c.query('rollback');assert.equal(await revision(),before);
        assert.equal(Number((await c.query(`select count(*)::text n from ${source}`)).rows[0].n),count);
      }finally{await c.query('rollback');c.release();}
    });
  }
  await check('real allow binds exact revision actor Workspace entitlement and post-lock instant',async()=>{
    const cmd=await command(),result=await host.execute(cmd,callbacks());assert.equal(result.status,'committed');
    assert.equal(result.receipt.authority.authority_version,cmd.authority_version);
    assert.equal(result.receipt.authority.actor_id,actor);assert.equal(result.receipt.authority.workspace_id,ids.workspaceIds[0]);
    assert.deepEqual(result.receipt.authority.entitlement,lastObservation.entitlement);
    assert.equal(lastObservation.entitlement.entitlement_key,moduleDefinition.entitlement_key);
    assert.equal(lastObservation.entitlement.authority_revision,cmd.authority_version);
    assert.ok(Date.parse(lastObservation.evaluated_at)>=Date.parse(lastRequest.transaction_context.lock.acquired_at));
  });
  await check('exact replay performs current recheck and does not duplicate writes',async()=>{
    const cmd=await command(),result=await host.execute(cmd,callbacks());assert.equal(result.status,'committed');
    const before=await effects(),again=await host.execute(cmd,callbacks());assert.equal(again.status,'exact_replay');
    assert.deepEqual(again.receipt,result.receipt);assert.deepEqual(await effects(),before);
  });
  await check('two concurrent host attempts commit once and replay once',async()=>{
    const cmd=await command(),before=await effects();const results=await Promise.all([host.execute(cmd,callbacks()),host.execute(cmd,callbacks())]);
    assert.deepEqual(results.map(x=>x.status).sort(),['committed','exact_replay']);
    const after=await effects();assert.equal(after.idem,before.idem+1);assert.equal(after.audit,before.audit+1);assert.equal(after.outbox,before.outbox+1);
  });
  await check('stale canonical revision is denied with no writes',async()=>{
    const result=await denied(await command({authority_version:await revision()-1}));
    assert.equal(result.authority.denial_reason,'STALE_AUTHORITY_VERSION');
  });
  await check('future revision cannot be echoed',async()=>{
    const result=await denied(await command({authority_version:await revision()+1}));assert.equal(result.authority.denial_reason,'STALE_AUTHORITY_VERSION');
  });
  await check('unknown Context',async()=>denied(await command({context_id:randomUUID()}),{},'AUTHORITY_NOT_FOUND'));
  await check('wrong actor',async()=>denied(await command(),{actor:otherActor},'ACTOR_BINDING_MISMATCH'));
  await check('cross-Workspace scope',async()=>denied(await command(),{request:r=>({...r,workspace_id:ids.workspaceIds[1]})},'CROSS_WORKSPACE'));
  await check('cross-Workspace missing assignment',async()=>denied(await command({workspace_id:randomUUID()})));
  await check('transaction binding mismatch',async()=>denied(await command(),{request:r=>({...r,transaction_context:{...r.transaction_context,transaction_id:randomUUID()}})},'INVALID_TRANSACTION_BINDING'));
  await check('AAL1 denial remains zero-write',async()=>denied(await command(),{aal:'aal1'}));
  await check('unknown module',async()=>denied(await command({module_code:'unknown_module'}),{},'AUTHORITY_UNKNOWN'));
  await check('unknown permission',async()=>denied(await command({permission_code:'unknown.permission'})));
  await check('entitlement receipt tampering cannot pass contract binding',async()=>{
    const cmd=await command();assert.equal((await host.execute(cmd,callbacks())).status,'committed');
    const receipt=bindCanonicalCurrentAuthorityObservationV1(lastRequest,{...lastObservation,
      entitlement:{...lastObservation.entitlement,workspace_id:ids.workspaceIds[1]}});
    assert.equal(receipt.decision,'denied');assert.equal(receipt.denial_reason,'AUTHORITY_BINDING_MISMATCH');
  });
  await check('provider failure is zero-write including revision',async()=>{
    const before=await effects();const result=await host.execute(await command(),callbacks({providerFailure:true}));
    assert.notEqual(result.status,'committed');assert.deepEqual(await effects(),before);
  });
  await check('domain failure rolls back every canonical ledger',async()=>{
    const before=await effects();const result=await host.execute(await command(),callbacks({rollback:true}));
    assert.notEqual(result.status,'committed');assert.deepEqual(await effects(),before);
  });
  await check('time expiry is re-evaluated without an epoch write or reusable allow',async()=>{
    await pool.query("update identity.context_grants set ends_at=clock_timestamp()+interval '200 milliseconds' where id=$1",[ids.contextId]);
    const cmd=await command(),beforeRevision=await revision();
    await new Promise(r=>setTimeout(r,250));
    await denied(cmd,{},'ACTOR_REVOKED');assert.equal(await revision(),beforeRevision);
    await pool.query('update identity.context_grants set ends_at=null where id=$1',[ids.contextId]);
  });
  await check('effective entitlement mutation bumps revision while role lock_version stays fixed',async()=>{
    const role=(await pool.query('select lock_version from platform.workspace_roles where id=$1',[ids.workspaceRoleIds[0]])).rows[0].lock_version;
    const before=await revision();await pool.query('update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=$1',[ids.workspaceIds[0]]);
    assert.ok(await revision()>before);assert.equal((await pool.query('select lock_version from platform.workspace_roles where id=$1',[ids.workspaceRoleIds[0]])).rows[0].lock_version,role);
    await denied(await command());await pool.query('update platform.workspace_entitlements set boolean_value=true where customer_workspace_id=$1',[ids.workspaceIds[0]]);
  });
  await check('two concurrent source commits monotonically increase one canonical epoch',async()=>{
    const before=await revision();await Promise.all(ids.workspaceIds.map(id=>pool.query('update platform.workspace_entitlements set boolean_value=boolean_value where customer_workspace_id=$1',[id])));
    assert.equal(await revision(),before+2);
  });
  await check('committed authority change invalidates historical replay receipt',async()=>{
    const cmd=await command();assert.equal((await host.execute(cmd,callbacks())).status,'committed');
    await pool.query('update platform.workspace_entitlements set boolean_value=boolean_value where customer_workspace_id=$1',[ids.workspaceIds[1]]);
    const deniedResult=await denied(cmd);assert.equal(deniedResult.authority.denial_reason,'STALE_AUTHORITY_VERSION');
  });
  await check('authority writer waits for held read barrier and linearizes after allowed commit',async()=>{
    let entered,release;const barrier=new Promise(r=>{entered=r;}),proceed=new Promise(r=>{release=r;});
    const cmd=await command(),pending=host.execute(cmd,callbacks({pause:async()=>{entered();await proceed;}}));
    await barrier;const writer=await pool.connect();let writing;
    try{
      await writer.query('begin');writing=writer.query('update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=$1',[ids.workspaceIds[0]]);
      let waiting=false;
      for(let n=0;n<100;n+=1){const state=await pool.query("select wait_event_type from pg_stat_activity where pid=$1",[writer.processID]);
        if(state.rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
      assert.equal(waiting,true);release();assert.equal((await pending).status,'committed');await writing;await writer.query('commit');
      await denied(await command());
    }finally{release();await pending;if(writing)await writing;await writer.query('rollback');writer.release();}
    await pool.query('update platform.workspace_entitlements set boolean_value=true where customer_workspace_id=$1',[ids.workspaceIds[0]]);
  });
  await check('revoke during host lock wait is rejected after fresh serializable retry',async()=>{
    const blocker=await pool.connect();let pending;
    try{
      await blocker.query('begin');await blocker.query('select id from platform.customer_workspaces where id=$1 for update',[ids.workspaceIds[0]]);
      const cmd=await command(),before=await effects();pending=host.execute(cmd,callbacks());let waiting=false;
      for(let n=0;n<100;n+=1){const state=await pool.query(`select count(*)::int n from pg_stat_activity
        where datname=current_database() and wait_event_type='Lock' and query like '%where id=$1 and archived_at is null%'`);
        if(state.rows[0].n>0){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
      assert.equal(waiting,true);await blocker.query("update identity.memberships set status='revoked',ends_at=statement_timestamp() where id=$1",[ids.membershipId]);
      await blocker.query('commit');assert.equal((await pending).status,'denied');assert.equal(providerCode,'ACTOR_REVOKED');
      const after=await effects();assert.equal(after.idem,before.idem);assert.equal(after.audit,before.audit);assert.equal(after.outbox,before.outbox);assert.equal(after.name,before.name);
    }finally{await blocker.query('rollback');blocker.release();if(pending)await pending;}
  });
  await check('fresh revision cannot resurrect revoked actor',async()=>denied(await command(),{},'ACTOR_REVOKED'));
}finally{await pool.end();}
console.log(`Canonical authority revision/provider PostgreSQL: ${passed}/${passed} PASS; no Remote activation`);
