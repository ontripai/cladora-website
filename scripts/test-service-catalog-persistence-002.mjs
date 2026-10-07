import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Actual SQL migration in isolated PostgreSQL. Canonical authority is a bounded
// fixture here; its actual implementation is exercised by the native-core suite.
// PGlite covers sequential behavior locally. The optional disposable PostgreSQL
// mode also exercises concurrent claims and stale writers over separate sockets.
let db;
let openConnection;
if (process.env.CLADORA_SERVICE_TEST_DATABASE_URL) {
  const pg = await import(process.env.CLADORA_PG_PACKAGE || 'pg');
  const Client = pg.Client ?? pg.default.Client;
  openConnection = async () => { const client = new Client({ connectionString: process.env.CLADORA_SERVICE_TEST_DATABASE_URL }); await client.connect(); return client; };
  const client = await openConnection();
  db = { query: (sql, args) => client.query(sql, args), exec: sql => sql ? client.query(sql) : Promise.resolve(), close: () => client.end() };
} else {
  const { PGlite } = await import(process.env.CLADORA_PGLITE_PACKAGE || '@electric-sql/pglite');
  db = new PGlite();
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [tenant, otherTenant, workspace, foreignWorkspace, actor, approver, context, definition, provider] = Array.from({ length: 9 }, (_, i) => id(i + 1));
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
let cases = 0;
async function check(name, fn) { await fn(); cases++; console.log(`PASS ${name}`); }
const labels = { ro: 'Serviciu', en: 'Service', fa: 'خدمت' };
const revision = { labels, description: labels, acquisition_mode: 'direct', price: { kind: 'fixed', amount: '120.50', currency: 'RON', tax_display: 'included' },
  valid_from: '2026-01-01T00:00:00Z', valid_until: null, cancellation_terms: labels, acceptance_criteria: labels, document_version_ids: [] };
const command = { context_id: context, workspace_id: workspace, definition_id: definition, provider_party_id: provider, revision, idempotency_key: 'create-001' };
const setActor = sub => q("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
const mutate = async (kind, request) => (await q('select customer_api.mutate_service_catalog_v1($1,$2::jsonb) as result', [kind, JSON.stringify(request)]))[0].result;
const list = async ws => (await q('select customer_api.list_service_catalog_v1($1,$2) as result', [context, ws ?? workspace]))[0].result;
const denied = async (fn, code) => assert.rejects(fn, error => error.code === code);
async function changed(sql, fn) { await db.exec('begin'); try { await db.exec(sql); await fn(); } finally { await db.exec('rollback'); } }
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema identity; create schema platform; create schema portfolio; create schema audit; create schema app_private; create schema customer_api;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table platform.tenants(id uuid primary key);
    create table platform.customer_workspaces(id uuid primary key,tenant_id uuid references platform.tenants);
    create table portfolio.parties(id uuid primary key,tenant_id uuid references platform.tenants,archived_at timestamptz);
    create table identity.permissions(id uuid primary key default gen_random_uuid(),code text unique,resource text,action text,description text);
    create table platform.module_definitions(id uuid primary key default gen_random_uuid(),code text,version integer default 1,name text,labels_json jsonb,description text,category text,lifecycle_status text,entitlement_key text,published_at timestamptz,unique(code,version));
    create table platform.module_permission_bindings(module_definition_id uuid,permission_id uuid,binding_version integer default 1,permission_mode text,is_delegable boolean,unique(module_definition_id,permission_id,binding_version));
    create table platform.idempotency_keys(tenant_id uuid,actor_id uuid,key text,request_hash text,response_ref jsonb,status_code integer,created_at timestamptz default statement_timestamp(),expires_at timestamptz,primary key(tenant_id,key));
    create table platform.outbox_events(tenant_id uuid,aggregate_type text,aggregate_id uuid,aggregate_version bigint,event_type text,payload jsonb,unique(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type));
    create table audit.events(tenant_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,before_snapshot jsonb,after_snapshot jsonb,reason text);
    create table app_private.test_authority(actor_id uuid,workspace_id uuid,permission text);
    create function app_private.resolve_workspace_native_context_v2(p_context uuid,p_workspace uuid) returns table(tenant_id uuid) language plpgsql as $$ begin
      if p_context is distinct from '${context}'::uuid or auth.uid() is null or not exists(select 1 from app_private.test_authority a where a.actor_id=auth.uid() and a.workspace_id=p_workspace) then raise exception 'denied' using errcode='42501'; end if;
      return query select w.tenant_id from platform.customer_workspaces w where w.id=p_workspace;
    end; $$;
    create function app_private.check_workspace_native_permission_v2(p_context uuid,p_workspace uuid,p_permission text,p_module text) returns boolean language sql as $$ select p_module='services_catalog' and p_context='${context}'::uuid and exists(select 1 from app_private.test_authority a where a.actor_id=auth.uid() and a.workspace_id=p_workspace and a.permission=p_permission) $$;
    insert into platform.tenants values('${tenant}'),('${otherTenant}');
    insert into platform.customer_workspaces values('${workspace}','${tenant}'),('${foreignWorkspace}','${otherTenant}');
    insert into auth.users values('${actor}'),('${approver}');
    insert into portfolio.parties values('${provider}','${tenant}',null),('${id(10)}','${otherTenant}',null);
    insert into app_private.test_authority select u.id,'${workspace}'::uuid,p from auth.users u cross join unnest(array['services.catalog.read','services.catalog.manage','services.catalog.publish']) p;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261003141918_service_catalog_persistence_v1.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261003144507_service_catalog_definition_command_v1.sql', import.meta.url), 'utf8'));
  await db.exec("alter table portfolio.parties add legal_name text not null default 'Provider'");
  await db.exec(readFileSync(new URL('../supabase/migrations/20261003151823_service_catalog_management_read_v1.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into service_catalog.definitions(id,tenant_id,workspace_id,code,labels) values('${definition}','${tenant}','${workspace}','elevator', '${JSON.stringify(labels)}')`);
  await setActor(actor);
  await check('audited definition command creates and exactly replays without duplicate effects', async () => {
    await changed('', async () => {
      const request = { context_id: context, workspace_id: workspace, code: 'cleaning', labels, idempotency_key: 'definition-001' };
      const define = async value => (await q('select customer_api.create_service_definition_v1($1::jsonb) as result', [JSON.stringify(value)]))[0].result;
      const row = await define(request); assert.deepEqual(await define(request), row);
      assert.equal((await q('select count(*)::int n from audit.events where entity_id=$1', [row.definition_id]))[0].n, 1);
      assert.equal((await q('select count(*)::int n from platform.outbox_events where aggregate_id=$1', [row.definition_id]))[0].n, 1);
      assert.equal((await q('select customer_api.list_service_definitions_v1($1,$2) as result', [context, workspace]))[0].result.length, 2);
      await db.exec('savepoint conflict'); await denied(() => define({ ...request, labels: { ...labels, en: 'Changed' } }), '23505'); await db.exec('rollback to savepoint conflict');
      await db.exec('savepoint cross_workspace'); await denied(() => define({ ...request, workspace_id: foreignWorkspace }), '42501'); await db.exec('rollback to savepoint cross_workspace');
    });
  });
  await check('no offerings before publication', async () => assert.deepEqual(await list(), []));
  let created;
  await check('create persists draft with exact decimal commercial version', async () => {
    created = await mutate('create', command); assert.equal(created.status, 'draft'); assert.equal(created.lock_version, 1);
    assert.equal((await q('select commercial_terms from service_catalog.revisions'))[0].commercial_terms.price.amount, '120.50');
  });
  await check('exact retry returns same IDs and no duplicate effects', async () => {
    assert.deepEqual(await mutate('create', command), created);
    for (const table of ['service_catalog.offerings', 'service_catalog.revisions', 'audit.events', 'platform.outbox_events']) assert.equal((await q(`select count(*)::int as n from ${table}`))[0].n, 1);
  });
  const management = async after => (await q('select customer_api.read_service_catalog_management_v1($1,$2,$3) as result', [context, workspace, after ?? null]))[0].result;
  const updateDefinition = async request => (await q('select customer_api.update_service_definition_v1($1::jsonb) as result', [JSON.stringify(request)]))[0].result;
  const definitionUpdate = { context_id: context, workspace_id: workspace, definition_id: definition, expected_lock_version: 1, labels, active: false, reason: 'Suspend service availability', idempotency_key: 'definition-update-001' };
  await check('management draft projection preserves decimals without consumer exposure', async () => {
    const result = await management(); assert.equal(result.offerings[0].revisions[0].revision.price.amount, '120.50'); assert.deepEqual(await list(), []);
    assert.deepEqual(result.providers, [{ provider_party_id: provider, label: 'Provider' }]); assert.doesNotMatch(JSON.stringify(result), /tenant_id|actor_id|tax_id|contact_email/);
  });
  await check('read only cannot read management', async () => changed(`delete from app_private.test_authority where actor_id='${actor}' and permission<>'services.catalog.read'`, async () => denied(() => management(), '42501')));
  await check('publisher only has no providers or manage capability', async () => changed(`delete from app_private.test_authority where actor_id='${actor}' and permission<>'services.catalog.publish'`, async () => { const result = await management(); assert.equal(result.can_manage, false); assert.equal(result.can_publish, true); assert.deepEqual(result.providers, []); }));
  await check('management checks current workspace authority', async () => { await denied(() => q('select customer_api.read_service_catalog_management_v1($1,$2,null)', [context, foreignWorkspace]), '42501'); await changed(`delete from app_private.test_authority where actor_id='${actor}'`, async () => denied(() => management(), '42501')); });
  await check('new RPCs reject anonymous actor and service role privilege', async () => {
    for (const role of ['anon', 'service_role']) for (const signature of ['customer_api.read_service_catalog_management_v1(uuid,uuid,uuid)', 'customer_api.update_service_definition_v1(jsonb)']) assert.equal((await q("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, signature]))[0].allowed, false);
    await setActor(null); await denied(() => management(), '42501'); await denied(() => updateDefinition(definitionUpdate), '42501'); await setActor(actor);
  });
  await check('definition edit is audited idempotent scoped and version checked', async () => changed('', async () => {
    const result = await updateDefinition(definitionUpdate); assert.equal(result.lock_version, 2); assert.equal(result.active, false); assert.deepEqual(await updateDefinition(definitionUpdate), result);
    assert.equal((await q('select count(*)::int n from audit.events where entity_id=$1', [definition]))[0].n, 1); assert.equal((await q('select count(*)::int n from platform.outbox_events where aggregate_id=$1', [definition]))[0].n, 1);
    for (const [name, request, code] of [['stale', { ...definitionUpdate, idempotency_key: 'definition-stale-001' }, '40001'], ['foreign_target', { ...definitionUpdate, workspace_id: foreignWorkspace }, '42501'], ['forged', { ...definitionUpdate, actor_id: actor }, '22023']]) {
      await db.exec(`savepoint ${name}`); await denied(() => updateDefinition(request), code); await db.exec(`rollback to savepoint ${name}`);
    }
  }));
  await check('management pagination has no duplicates across 51 offerings', async () => changed('', async () => {
    for (let i = 0; i < 50; i++) await mutate('create', { ...command, idempotency_key: `page-test-${i.toString().padStart(3, '0')}` });
    const first = await management(); assert.equal(first.offerings.length, 50); assert.equal(first.next_after, first.offerings.at(-1).offering_id);
    const second = await management(first.next_after); assert.equal(second.offerings.length, 1); assert.equal(second.next_after, null); assert.equal(new Set([...first.offerings, ...second.offerings].map(row => row.offering_id)).size, 51);
  }));
  await check('same key changed content conflicts', async () => denied(() => mutate('create', { ...command, revision: { ...revision, price: { ...revision.price, amount: '121.50' } } }), '23505'));
  await check('same key different actor conflicts', async () => { await setActor(approver); await denied(() => mutate('create', command), '23505'); await setActor(actor); });
  await check('retry requires current authority', async () => changed(`delete from app_private.test_authority where actor_id='${actor}'`, async () => denied(() => mutate('create', command), '42501')));
  await check('foreign workspace cannot be inferred from tenant', async () => denied(() => list(foreignWorkspace), '42501'));
  await check('foreign provider rejected', async () => denied(() => mutate('create', { ...command, provider_party_id: id(10), idempotency_key: 'foreign-001' }), '22023'));
  await check('inactive provider rejected', async () => changed(`update portfolio.parties set archived_at=now() where id='${provider}'`, async () => denied(() => mutate('create', { ...command, idempotency_key: 'inactive-001' }), '22023')));
  await check('attachments fail closed without canonical link authorization', async () => denied(() => mutate('create', { ...command, revision: { ...revision, document_version_ids: [id(10)] }, idempotency_key: 'docs-001' }), '22023'));
  for (const value of [null, {}, { ...revision, labels: { ro: 'x', en: 'x' } }, { ...revision, price: { ...revision.price, amount: 120.50 } }, { ...revision, price: { ...revision.price, amount: '1.123' } }, { ...revision, valid_until: revision.valid_from }, { ...revision, status: 'published' }, { ...revision, valid_from: 'infinity' }]) {
    await check('SQL rejects malformed commercial revision', async () => assert.equal((await q('select app_private.service_catalog_revision_valid_v1($1) as valid', [JSON.stringify(value)]))[0].valid, false));
  }
  await check('commercial payload cannot be changed in place', async () => denied(() => q("update service_catalog.revisions set commercial_terms=jsonb_set(commercial_terms,'{price,amount}','\"0\"')"), '23514'));
  const transition = (action, version, key, extra = {}) => ({ context_id: context, workspace_id: workspace, offering_id: created.offering_id, revision_id: created.revision_id, expected_lock_version: version, action, reason: 'Reviewed commercial terms', idempotency_key: key, ...extra });
  await check('stale write rejects without consuming retry key', async () => {
    await denied(() => mutate('transition', transition('submit', 2, 'stale-001')), '40001');
    assert.equal((await q("select count(*)::int n from platform.idempotency_keys where key like '%stale-001'"))[0].n, 0);
  });
  await check('submit is atomically versioned and still hidden', async () => { assert.equal((await mutate('transition', transition('submit', 1, 'submit-001'))).lock_version, 2); assert.deepEqual(await list(), []); });
  await check('self-publication denied', async () => denied(() => mutate('transition', transition('publish', 2, 'publish-001')), '42501'));
  await check('management publication hint enforces separate actor', async () => { assert.equal((await management()).offerings[0].revisions[0].can_publish, false); await setActor(approver); assert.equal((await management()).offerings[0].revisions[0].can_publish, true); await setActor(actor); });
  await setActor(approver);
  await check('separate approver publishes selected immutable version', async () => { assert.equal((await mutate('transition', transition('publish', 2, 'publish-002'))).lock_version, 3); assert.equal((await list())[0].revision_id, created.revision_id); });
  await check('deactivation hides publication without changing commercial history', async () => changed('', async () => { const before = (await q('select commercial_terms from service_catalog.revisions where id=$1', [created.revision_id]))[0]; await updateDefinition(definitionUpdate); assert.deepEqual(await list(), []); assert.deepEqual((await q('select commercial_terms from service_catalog.revisions where id=$1', [created.revision_id]))[0], before); await updateDefinition({ ...definitionUpdate, active: true, expected_lock_version: 2, idempotency_key: 'definition-reactivate-001' }); assert.equal((await list()).length, 1); }));
  await check('read projection excludes tenant actor provider and documents', async () => { const row = (await list())[0]; for (const key of ['tenant_id', 'created_by', 'provider_party_id', 'document_version_ids', 'status']) assert.equal(Object.hasOwn(row, key), false); });
  await setActor(actor);
  let revised;
  await check('new draft preserves currently published version', async () => {
    revised = await mutate('revise', { context_id: context, workspace_id: workspace, offering_id: created.offering_id, expected_lock_version: 3, revision: { ...revision, price: { ...revision.price, amount: '130.00' } }, idempotency_key: 'revise-001' });
    assert.notEqual(revised.revision_id, created.revision_id); assert.equal((await list())[0].price.amount, '120.50');
  });
  await check('management retains current and published revision pointers', async () => { const row = (await management()).offerings[0]; assert.equal(row.current_revision_id, revised.revision_id); assert.equal(row.published_revision_id, created.revision_id); assert.equal(row.revisions.length, 2); assert.equal(row.lock_version, 4); });
  await check('old published version can be suspended while a new draft exists', async () => { await mutate('transition', transition('suspend', 4, 'suspend-001')); assert.deepEqual(await list(), []); });
  await check('suspended version cannot be resumed or published directly', async () => denied(() => mutate('transition', transition('publish', 5, 'resume-001')), '22023'));
  await check('future and expired published revisions are hidden', async () => {
    for (const [key, valid_from, valid_until] of [['future-001', '2099-01-01T00:00:00Z', null], ['expired-001', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z']]) {
      await changed('', async () => {
        const row = await mutate('create', { ...command, idempotency_key: key, revision: { ...revision, valid_from, valid_until } });
        await db.exec(`update service_catalog.offerings set published_revision_id='${row.revision_id}' where id='${row.offering_id}'; update service_catalog.revisions set status='published',submitted_by='${actor}',published_by='${approver}' where id='${row.revision_id}'`);
        assert.deepEqual(await list(), []);
      });
    }
  });
  await check('failed outbox rolls back offering revision audit and retry claim', async () => changed(`alter table platform.outbox_events add constraint injected_failure check(event_type<>'services.catalog.create') not valid`, async () => {
    const before = await q('select (select count(*) from service_catalog.offerings) as offerings,(select count(*) from service_catalog.revisions) as revisions,(select count(*) from audit.events) as audit,(select count(*) from platform.idempotency_keys) as retries');
    await db.exec('savepoint failed_write');
    await denied(() => mutate('create', { ...command, idempotency_key: 'rollback-001' }), '23514');
    await db.exec('rollback to savepoint failed_write');
    assert.deepEqual(await q('select (select count(*) from service_catalog.offerings) as offerings,(select count(*) from service_catalog.revisions) as revisions,(select count(*) from audit.events) as audit,(select count(*) from platform.idempotency_keys) as retries'), before);
  }));
  await check('raw RPC rejects unknown authority fields', async () => denied(() => mutate('create', { ...command, actor_id: approver }), '22023'));
  await check('no raw table or private helper privilege for customer/service roles', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await q("select has_table_privilege($1,'service_catalog.offerings','SELECT') as allowed", [role]))[0].allowed, false);
      assert.equal((await q("select has_function_privilege($1,'app_private.service_catalog_authorize_v1(uuid,uuid,text)','EXECUTE') as allowed", [role]))[0].allowed, false);
    }
    assert.equal((await q("select has_function_privilege('authenticated','customer_api.mutate_service_catalog_v1(text,jsonb)','EXECUTE') as allowed"))[0].allowed, true);
    assert.equal((await q("select has_function_privilege('anon','customer_api.mutate_service_catalog_v1(text,jsonb)','EXECUTE') as allowed"))[0].allowed, false);
  });
  if (openConnection) {
    const waitForDefinitionLock = async pid => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if ((await q('select wait_event_type from pg_stat_activity where pid=$1', [pid]))[0]?.wait_event_type === 'Lock') return;
        await new Promise(done => setTimeout(done, 10));
      }
      assert.fail('Definition operation did not wait on the concurrent deactivation lock');
    };
    await check('identical concurrent definition edits have one audited effect', async () => {
      const clients = await Promise.all([openConnection(), openConnection()]);
      try {
        await Promise.all(clients.map(client => client.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])));
        const responses = await Promise.all(clients.map(client => client.query('select customer_api.update_service_definition_v1($1::jsonb) as result', [JSON.stringify(definitionUpdate)])));
        assert.deepEqual(responses[0].rows, responses[1].rows); assert.equal(responses[0].rows[0].result.lock_version, 2);
        assert.equal((await q('select count(*)::int n from audit.events where entity_id=$1', [definition]))[0].n, 1);
      } finally { await Promise.all(clients.map(client => client.end())); }
    });
    await check('concurrent definition edits with same expected version have one winner', async () => {
      const clients = await Promise.all([openConnection(), openConnection()]);
      try {
        await Promise.all(clients.map(client => client.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])));
        const outcomes = await Promise.allSettled(clients.map((client, i) => client.query('select customer_api.update_service_definition_v1($1::jsonb)', [JSON.stringify({ ...definitionUpdate, active: true, expected_lock_version: 2, idempotency_key: `definition-race-${i}` })])));
        assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1); assert.equal(outcomes.find(outcome => outcome.status === 'rejected').reason.code, '40001');
      } finally { await Promise.all(clients.map(client => client.end())); }
    });
    for (const operation of ['create', 'publish']) {
      await check(`deactivation serializes with concurrent ${operation}`, async () => {
        let request = { ...command, idempotency_key: 'definition-deactivate-race' };
        let row;
        if (operation === 'publish') {
          row = await mutate('create', { ...command, idempotency_key: 'deactivation-publish-create' });
          request = { context_id: context, workspace_id: workspace, offering_id: row.offering_id, revision_id: row.revision_id, expected_lock_version: 1, action: 'submit', reason: 'Review commercial terms', idempotency_key: 'deactivation-publish-submit' };
          await mutate('transition', request); request = { ...request, expected_lock_version: 2, action: 'publish', idempotency_key: 'deactivation-publish-race' };
        }
        const clients = await Promise.all([openConnection(), openConnection()]);
        try {
          await clients[0].query('begin'); await clients[0].query('update service_catalog.definitions set active=false where id=$1', [definition]);
          await clients[1].query("select set_config('request.jwt.claim.sub',$1,false)", [operation === 'publish' ? approver : actor]);
          const pid = (await clients[1].query('select pg_backend_pid() pid')).rows[0].pid;
          const pending = clients[1].query('select customer_api.mutate_service_catalog_v1($1,$2::jsonb)', [operation === 'publish' ? 'transition' : 'create', JSON.stringify(request)]).then(() => ({ ok: true }), error => ({ ok: false, code: error.code }));
          await waitForDefinitionLock(pid); await clients[0].query('commit'); assert.deepEqual(await pending, { ok: false, code: '22023' });
          if (row) { const stored = (await q('select status from service_catalog.revisions where id=$1', [row.revision_id]))[0]; assert.equal(stored.status, 'submitted'); }
          await q('update service_catalog.definitions set active=true where id=$1', [definition]);
        } finally { await clients[0].query('rollback'); await Promise.all(clients.map(client => client.end())); }
      });
    }

    await check('two concurrent identical claims execute once and return identical responses', async () => {
      const clients = await Promise.all([openConnection(), openConnection()]);
      try {
        await Promise.all(clients.map(client => client.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])));
        const responses = await Promise.all(clients.map(client => client.query('select customer_api.mutate_service_catalog_v1($1,$2::jsonb) as result', ['create', JSON.stringify({ ...command, idempotency_key: 'concurrent-001' })])));
        assert.deepEqual(responses[0].rows, responses[1].rows);
        const offering = responses[0].rows[0].result.offering_id;
        assert.equal((await q('select count(*)::int as n from audit.events where entity_id=$1', [offering]))[0].n, 1);
        assert.equal((await q('select count(*)::int as n from platform.outbox_events where aggregate_id=$1', [offering]))[0].n, 1);
      } finally { await Promise.all(clients.map(client => client.end())); }
    });
    await check('two simultaneous writes with the same expected version have one winner', async () => {
      const clients = await Promise.all([openConnection(), openConnection()]);
      try {
        await Promise.all(clients.map(client => client.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])));
        const outcomes = await Promise.allSettled(clients.map((client, i) => client.query('select customer_api.mutate_service_catalog_v1($1,$2::jsonb) as result', ['revise', JSON.stringify({ context_id: context, workspace_id: workspace, offering_id: created.offering_id, expected_lock_version: 5, revision, idempotency_key: `concurrent-revise-${i}` })])));
        assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
        assert.equal(outcomes.find(outcome => outcome.status === 'rejected').reason.code, '40001');
        assert.equal((await q('select lock_version::int as version from service_catalog.offerings where id=$1', [created.offering_id]))[0].version, 6);
      } finally { await Promise.all(clients.map(client => client.end())); }
    });
  }
  console.log(`${cases} SERVICE persistence PostgreSQL scenarios passed`);
} finally { await db.close(); }
