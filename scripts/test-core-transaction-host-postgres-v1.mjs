import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString = process.env.CORE_TX_HOST_TEST_DATABASE_URL;
if (!connectionString || process.env.CORE_TX_HOST_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable CORE_TX_HOST_TEST_DATABASE_URL and ephemeral opt-in required');
}
const target = new URL(connectionString);
if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname)
  || !['/core_tx_host_test','/postgres'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}
const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url,'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('require','module','exports',compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`,url)) : require(name), mod, mod.exports);
  cache.set(url.href,mod.exports);
  return mod.exports;
}
const { createCorePostgresTransactionHostV1 } = load(new URL('../src/lib/core/postgres-transaction-host-v1.ts',import.meta.url));
const pool = new pg.Pool({ connectionString, max: 12 });
const host = createCorePostgresTransactionHostV1(pool);
let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok ${passed} - ${name}`); };
const actor = randomUUID();
const driver = createAp10CoreAuthorityDriver(pool);
let ids;
const scopes = [];
let rechecks = 0;
try {
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
  [actor,`tx-host-${randomUUID()}@example.invalid`]);
  ids = await driver.setup({ userId:actor,runId:randomUUID(),target:'local' });
  const version = Number((await pool.query('select lock_version from platform.workspace_roles where id=$1',
    [ids.workspaceRoleIds[0]])).rows[0].lock_version);
  let aggregateVersion = 0;
  const command = (key=randomUUID(), extra={}) => ({
    contract_version:'core-transaction-command.v1',transaction_id:randomUUID(),command_id:randomUUID(),
    context_id:ids.contextId,workspace_id:ids.workspaceIds[0],actor_id:actor,authority_version:version,
    permission_code:'airprop.asset.manage',module_code:'airprop_commercial',evaluation_purpose:'tx_host_test',
    aggregate_type:'property',aggregate_id:ids.propertyIds[0],aggregate_version:++aggregateVersion,
    provider_source_ids:[ids.propertyIds[0]],idempotency_key:key,input_fingerprint:'tx1:0123456789abcdef',...extra,
  });
  const providers = (options={}) => ({
    async resolveAuthority(scope,request) {
      rechecks += 1; scopes.push(scope);
      const binding = await scope.query('select txid_current()::text as id');
      assert.equal(binding.rows[0].id,scope.database_transaction_id);
      assert.equal(scope.transaction_id,request.transaction_context.transaction_id);
      await scope.query("select set_config('request.jwt.claims',$1,true)",
        [JSON.stringify({ sub:actor,role:'authenticated',aal:options.aal||'aal2' })]);
      const state = await scope.query(`select r.lock_version,m.status from platform.workspace_roles r
        join platform.workspace_member_roles a on a.workspace_role_id=r.id
        join identity.memberships m on m.id=a.membership_id
        where r.id=$1 and r.customer_workspace_id=$2 for share of r,a,m`,[ids.workspaceRoleIds[ids.workspaceIds.indexOf(request.workspace_id)]||ids.workspaceRoleIds[0],request.workspace_id]);
      const evaluated = await scope.query(`select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed,
        clock_timestamp()::text as evaluated_at`,[request.context_id,request.workspace_id,request.permission_code,request.module_code]);
      return {
        ...request,contract_version:'core-current-authority-observation.v1',source_contract:'workspace-native-effective-authority.v2',
        evaluator:'app_private.check_workspace_native_permission_v2',source_disclosure:'status_only',source_reference:null,
        authority_version:options.stale ? version+1 : Number(state.rows[0]?.lock_version||version),
        actor_status:options.revoked ? 'revoked' : state.rows[0]?.status==='active' ? 'current':'revoked',
        decision:options.denied ? 'denied' : evaluated.rows[0].allowed ? 'allowed':'denied',
        evaluated_at:new Date(evaluated.rows[0].evaluated_at).toISOString(),
        ...(options.cross ? { workspace_id:ids.workspaceIds[1] }:{}),
        ...(options.before ? { evaluated_at:'2020-01-01T00:00:00.000Z' }:{}),
        ...(options.forgedAllow ? {decision:'allowed'}:{}),
        ...(options.wrongTx ? {transaction_context:{...request.transaction_context,transaction_id:randomUUID()}}:{}),
        evaluation_purpose:undefined,
      };
    },
    async validateProviders(scope) {
      if (options.delay) await scope.query('select pg_sleep($1)',[options.delay]);
      if (options.providerWrite) await scope.query('update portfolio.properties set name=$2 where id=$1',[ids.propertyIds[0],'forbidden']);
      if (options.providerError) throw new Error('synthetic provider unavailable');
      return !options.providerDenied;
    },
    async mutate(scope,cmd) {
      if (options.scopeEscape) await scope.query('commit');
      const row=await scope.query(`update portfolio.properties set name=$3 where id=$1 and tenant_id=$2 returning id`,
        [cmd.aggregate_id,scope.tenant_id,`TX host ${cmd.command_id}`]);
      if (options.failAfterMutation) throw new Error('synthetic mutation failure');
      if (row.rowCount!==1) throw new Error('aggregate unavailable');
      return { mutation_id:row.rows[0].id };
    },
  });
  // strict observation excludes evaluation_purpose rather than carrying request-only fields.
  const wrapped = options => {
    const p=providers(options),resolve=p.resolveAuthority;
    p.resolveAuthority=async (...args)=>{const o=await resolve(...args);delete o.evaluation_purpose;return o;};
    return p;
  };
  const counts = async cmd => (await pool.query(`select
    (select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key=$2) as idem,
    (select count(*)::int from audit.events where request_id=$3) as audit,
    (select count(*)::int from platform.outbox_events where trace_id=$3) as outbox`,
  [ids.tenantId,`core-tx.v1:${cmd.workspace_id}:${cmd.idempotency_key}`,cmd.command_id])).rows[0];
  const name = async () => (await pool.query('select name from portfolio.properties where id=$1',[ids.propertyIds[0]])).rows[0].name;
  const zero = async (cmd,options,reason) => {
    const old=await name();const result=await host.execute(cmd,wrapped(options));
    assert.equal(result.status,'denied');if(reason) assert.equal(result.authority?.denial_reason,reason);
    assert.deepEqual(await counts(cmd),{idem:0,audit:0,outbox:0});assert.equal(await name(),old);
  };
  const first=command();let committed;
  await check('one real canonical transaction commits domain, audit, outbox and idempotency',async()=>{
    committed=await host.execute(first,wrapped());assert.equal(committed.status,'committed');
    assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
    assert.equal(committed.receipt.authority.rechecked_after_lock,true);
  });
  await check('same connection and SQL transaction observed by authority and provider',async()=>{
    assert.equal(scopes[0].transaction_id,first.transaction_id);assert.ok(scopes[0].database_transaction_id);
  });
  await check('exact replay rechecks authority and returns immutable receipt with zero duplicate effects',async()=>{
    const before=rechecks,result=await host.execute(first,wrapped());assert.equal(result.status,'exact_replay');
    assert.deepEqual(result.receipt,committed.receipt);assert.equal(rechecks,before+1);
    assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
  });
  await check('changed fingerprint is bounded conflict without duplicate writes',async()=>{
    const result=await host.execute({...first,input_fingerprint:'tx1:1111111111111111'},wrapped());
    assert.equal(result.code,'REPLAY_CONFLICT');assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
  });
  await check('changed actor cannot replay',async()=>{
    const result=await host.execute({...first,actor_id:randomUUID()},wrapped({revoked:true}));assert.equal(result.status,'denied');
    assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
  });
  await check('stale authority zero-write',()=>zero(command(),{stale:true},'STALE_AUTHORITY_VERSION'));
  await check('revoked actor zero-write',()=>zero(command(),{revoked:true},'ACTOR_REVOKED'));
  await check('canonical AAL1 denial zero-write',()=>zero(command(),{aal:'aal1'},'AUTHORITY_DENIED'));
  await check('explicit denial zero-write',()=>zero(command(),{denied:true},'AUTHORITY_DENIED'));
  await check('cross-Workspace observation zero-write',()=>zero(command(),{cross:true},'CROSS_WORKSPACE'));
  await check('pre-lock observation zero-write',()=>zero(command(),{before:true},'RECHECK_BEFORE_LOCK'));
  await check('forged provider allow cannot override canonical AAL1 denial',()=>zero(command(),{aal:'aal1',forgedAllow:true},'AUTHORITY_DENIED'));
  await check('transaction context mismatch zero-write',()=>zero(command(),{wrongTx:true},'TRANSACTION_CONTEXT_MISMATCH'));
  await check('provider validation cannot stage writes',()=>zero(command(),{providerWrite:true}));
  await check('provider refusal zero-write',()=>zero(command(),{providerDenied:true}));
  await check('provider exception zero-write',()=>zero(command(),{providerError:true}));
  await check('mutation failure rolls back claim and domain before ledger effects',()=>zero(command(),{failAfterMutation:true}));
  await check('provider cannot commit independently',()=>zero(command(),{scopeEscape:true}));
  await check('unavailable Workspace zero-write',()=>zero(command(undefined,{workspace_id:randomUUID()}),{}));
  await check('invalid command performs no persistence',async()=>{
    assert.equal((await host.execute({...command(),extra:true},wrapped())).code,'INVALID_COMMAND');
  });
  await check('scope is invalid after transaction release',async()=>{
    await assert.rejects(()=>scopes[0].query('select 1'),/transaction_scope_unavailable/);
  });
  const concurrent=command();
  await check('concurrent duplicate yields one commit and one exact replay',async()=>{
    const results=await Promise.all([host.execute(concurrent,wrapped({delay:0.1})),host.execute(concurrent,wrapped())]);
    assert.deepEqual(results.map(x=>x.status).sort(),['committed','exact_replay']);
    assert.deepEqual(results[0].receipt,results[1].receipt);assert.deepEqual(await counts(concurrent),{idem:1,audit:1,outbox:1});
  });
  await check('same key in another allowed Workspace creates an independent bounded effect set',async()=>{
    const other={...first,transaction_id:randomUUID(),command_id:randomUUID(),workspace_id:ids.workspaceIds[1],aggregate_id:ids.propertyIds[1]};
    const result=await host.execute(other,wrapped());assert.equal(result.status,'committed');
    assert.notEqual(result.receipt.receipt_id,committed.receipt.receipt_id);
    assert.deepEqual(await counts(other),{idem:1,audit:1,outbox:1});
    assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
  });
  await check('outbox failure rolls back earlier domain, audit and idempotency effects',async()=>{
    const conflict=command(undefined,{aggregate_version:first.aggregate_version});const old=await name();const result=await host.execute(conflict,wrapped());
    assert.equal(result.code,'TRANSACTION_FAILED');assert.deepEqual(await counts(conflict),{idem:0,audit:0,outbox:0});
    assert.equal(await name(),old);
  });
  await check('commit acknowledgement loss returns unknown and recovers by exact replay without speculative retry',async()=>{
    const cmd=command(undefined,{aggregate_version:++aggregateVersion});
    const uncertain=createCorePostgresTransactionHostV1({async connect(){
      const db=await pool.connect();
      return {release:db.release.bind(db),async query(text,values){
        const result=await db.query(text,values);
        if(text==='commit') throw new Error('synthetic acknowledgement loss');
        return result;
      }};
    }});
    const result=await uncertain.execute(cmd,wrapped());assert.equal(result.status,'unknown_commit');
    assert.deepEqual(await counts(cmd),{idem:1,audit:1,outbox:1});
    const recovered=await host.execute(cmd,wrapped());assert.equal(recovered.status,'exact_replay');
    assert.deepEqual(await counts(cmd),{idem:1,audit:1,outbox:1});
  });
  await check('authority version change while waiting on lock aborts with zero writes',async()=>{
    const blocker=await pool.connect();const cmd=command();const old=await name();
    let pending;
    try {
      await blocker.query('begin');
      await blocker.query('select id from platform.customer_workspaces where id=$1 for update',[ids.workspaceIds[0]]);
      pending=host.execute(cmd,wrapped());
      let waiting=false;
      for(let n=0;n<100;n+=1){
        const state=await pool.query(`select count(*)::int as count from pg_stat_activity
          where datname=current_database() and wait_event_type='Lock'
          and query like '%where id=$1 and archived_at is null%'`);
        if(state.rows[0].count>0){waiting=true;break;}
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(waiting,true,'host must actually wait on workspace lock');
      await blocker.query("update platform.workspace_roles set lifecycle_status='archived',valid_to=statement_timestamp(),lock_version=lock_version+1 where id=$1",
        [ids.workspaceRoleIds[0]]);
      await blocker.query('commit');
      const result=await pending;assert.equal(result.status,'denied');
      assert.equal(result.authority.denial_reason,'STALE_AUTHORITY_VERSION');
      assert.deepEqual(await counts(cmd),{idem:0,audit:0,outbox:0});assert.equal(await name(),old);
    } finally {await blocker.query('rollback');blocker.release();if(pending) await pending;}
  });
  await check('real role version change invalidates exact replay',async()=>{
    const result=await host.execute(first,wrapped());assert.equal(result.authority.denial_reason,'STALE_AUTHORITY_VERSION');
    assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
  });
  await check('real revoke is evaluated by canonical Core engine',async()=>{
    await driver.revoke({authority:ids});const result=await host.execute(first,wrapped());
    assert.equal(result.status,'denied');assert.equal(result.authority.denial_reason,'ACTOR_REVOKED');
    assert.deepEqual(await counts(first),{idem:1,audit:1,outbox:1});
  });
} finally {
  await pool.end();
}
console.log(`Core transaction host PostgreSQL: ${passed}/${passed} PASS`);
