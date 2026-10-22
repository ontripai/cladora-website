import assert from 'node:assert/strict';

// Real two-session proof for a disposable PostgreSQL database prepared with the
// SERVICE quote fixture and all migrations through request-version binding V2.
// This harness deliberately has no PGlite fallback: no socket means NOT RUN.
const connectionString = process.env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL;
const fixtureText = process.env.CLADORA_SERVICE_QUOTE_CONCURRENCY_FIXTURE;
if (!connectionString || !fixtureText) {
  throw new Error('CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL and CLADORA_SERVICE_QUOTE_CONCURRENCY_FIXTURE are required');
}
const fixture = JSON.parse(fixtureText);
const required = ['actorId','deniedActorId','contextId','workspaceId','foreignWorkspaceId','requestId','command'];
for (const field of required) assert.ok(fixture[field], `fixture.${field} is required`);
const pg = await import(process.env.CLADORA_PG_PACKAGE || 'pg');
const Client = pg.Client ?? pg.default.Client;
const open = async name => {
  const client = new Client({ connectionString, application_name: name });
  await client.connect();
  return client;
};
const control = await open('service-quote-v2-control');
const first = await open('service-quote-v2-first');
const second = await open('service-quote-v2-second');
const setActor = (client, actorId) => client.query("select set_config('request.jwt.claim.sub',$1,false)", [actorId]);
const rpc = (client, command) => client.query('select customer_api.create_service_quote_draft_v2($1::jsonb) result', [JSON.stringify(command)]).then(result => result.rows[0].result);
const denied = async (promise, code) => assert.rejects(promise, error => error.code === code);
const keyFor = command => `service_quote:sql_v2:${command.workspace_id}:${fixture.actorId}:${command.idempotency_key}`;
const snapshot = async command => (await control.query(`
  select
    (select count(*)::int from service_catalog.quote_drafts where request_id=$1) drafts,
    (select count(*)::int from audit.events where entity_type='service_quote_draft') audits,
    (select count(*)::int from platform.outbox_events where aggregate_type='service_quote_draft') outbox,
    (select count(*)::int from platform.idempotency_keys where key=$2) keys`,
  [fixture.requestId, keyFor(command)])).rows[0];
const nextKey = label => `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const waitUntilBlocked = async applicationName => {
  for (let attempt=0;attempt<100;attempt++) {
    const result=await control.query("select wait_event_type from pg_stat_activity where application_name=$1 and state='active'",[applicationName]);
    if (result.rows[0]?.wait_event_type==='Lock') return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error(`${applicationName} did not reach a PostgreSQL lock wait`);
};
const advanceRequest = async (client, expectedVersion) => {
  await client.query('begin');
  try {
    await client.query('select app_private.lock_service_request_version_v1($1,$2,$3)',[fixture.workspaceId,fixture.requestId,expectedVersion]);
    const result=await client.query('update service_catalog.requests set version=version+1 where id=$1 and workspace_id=$2 returning version',[fixture.requestId,fixture.workspaceId]);
    assert.equal(result.rowCount,1);
    await client.query('commit');
    return Number(result.rows[0].version);
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
};

let cases=0;
const check=async(name,fn)=>{await fn();cases++;console.log(`PASS ${name}`);};
try {
  await Promise.all([setActor(control,fixture.actorId),setActor(first,fixture.actorId),setActor(second,fixture.actorId)]);
  const initial=(await control.query('select version::int from service_catalog.requests where id=$1 and workspace_id=$2',[fixture.requestId,fixture.workspaceId])).rows[0]?.version;
  assert.equal(initial,fixture.command.expected_request_version,'fixture command must name the current Request version');

  await check('stale after read and lock returns 40001 with zero quote, audit, outbox or key writes',async()=>{
    const stale={...fixture.command,idempotency_key:nextKey('stale-after-lock')};
    const before=await snapshot(stale);
    await first.query('begin');
    await first.query('select app_private.lock_service_request_version_v1($1,$2,$3)',[fixture.workspaceId,fixture.requestId,initial]);
    const waiting=rpc(second,stale);
    await waitUntilBlocked('service-quote-v2-second');
    await first.query('update service_catalog.requests set version=version+1 where id=$1 and workspace_id=$2',[fixture.requestId,fixture.workspaceId]);
    await first.query('commit');
    await denied(waiting,'40001');
    assert.deepEqual(await snapshot(stale),before);
  });

  const current=initial+1;
  await check('authority revoked while the writer waits on the Request lock is rechecked and zero-write denied',async()=>{
    const revoked={...fixture.command,expected_request_version:current,idempotency_key:nextKey('revoked-after-lock')};
    const before=await snapshot(revoked);
    await first.query('begin');
    await first.query('select id from service_catalog.requests where id=$1 and workspace_id=$2 for update',[fixture.requestId,fixture.workspaceId]);
    const waiting=rpc(second,revoked);
    await waitUntilBlocked('service-quote-v2-second');
    const removed=await control.query("delete from app_private.test_authority where actor_id=$1 and workspace_id=$2 and permission='services.quotes.manage' returning actor_id",[fixture.actorId,fixture.workspaceId]);
    assert.equal(removed.rowCount,1,'disposable fixture must contain one quote authority row');
    await first.query('commit');
    try { await denied(waiting,'42501');assert.deepEqual(await snapshot(revoked),before); }
    finally { await control.query("insert into app_private.test_authority(actor_id,workspace_id,permission) values($1,$2,'services.quotes.manage')",[fixture.actorId,fixture.workspaceId]); }
  });

  const fresh={...fixture.command,expected_request_version:current,idempotency_key:nextKey('fresh')};
  let committed;
  await check('fresh exact Request version commits one atomic quote',async()=>{
    const before=await snapshot(fresh);committed=await rpc(control,fresh);assert.equal(committed.request_version,current);const after=await snapshot(fresh);
    assert.equal(after.drafts,before.drafts+1);assert.equal(after.audits,before.audits+1);assert.equal(after.outbox,before.outbox+1);assert.equal(after.keys,1);
  });

  await check('exact replay survives a later Request version and changed replay conflicts',async()=>{
    assert.equal(await advanceRequest(first,current),current+1);
    assert.deepEqual(await rpc(control,fresh),committed);
    await denied(rpc(control,{...fresh,scope:`${fresh.scope} changed`}),'23505');
    assert.equal((await snapshot(fresh)).keys,1);
  });

  await check('concurrent exact duplicates return one result and one durable effect set',async()=>{
    const duplicate={...fixture.command,expected_request_version:current+1,idempotency_key:nextKey('duplicate')};
    const before=await snapshot(duplicate);
    const [left,right]=await Promise.all([rpc(first,duplicate),rpc(second,duplicate)]);
    assert.deepEqual(left,right);const after=await snapshot(duplicate);
    assert.equal(after.drafts,before.drafts+1);assert.equal(after.audits,before.audits+1);assert.equal(after.outbox,before.outbox+1);assert.equal(after.keys,1);
  });

  await check('missing Request version and denied actor fail closed with zero writes',async()=>{
    const missing={...fixture.command,idempotency_key:nextKey('missing-version')};delete missing.expected_request_version;
    const beforeMissing=await snapshot(missing);await denied(rpc(control,missing),'22023');assert.deepEqual(await snapshot(missing),beforeMissing);
    const unauthorized={...fixture.command,expected_request_version:current+1,idempotency_key:nextKey('denied-actor')};
    const beforeDenied=await snapshot(unauthorized);await setActor(second,fixture.deniedActorId);await denied(rpc(second,unauthorized),'42501');assert.deepEqual(await snapshot(unauthorized),beforeDenied);await setActor(second,fixture.actorId);
  });

  await check('cross-Workspace Request binding fails closed',async()=>{
    const cross={...fixture.command,workspace_id:fixture.foreignWorkspaceId,expected_request_version:current+1,idempotency_key:nextKey('cross-workspace')};
    const before=await snapshot(cross);await denied(rpc(control,cross),'42501');assert.deepEqual(await snapshot(cross),before);
  });
  console.log(`${cases} real PostgreSQL SERVICE quote version/concurrency scenarios passed`);
} finally {
  await Promise.allSettled([first.query('rollback'),second.query('rollback')]);
  await Promise.allSettled([control.end(),first.end(),second.end()]);
}
