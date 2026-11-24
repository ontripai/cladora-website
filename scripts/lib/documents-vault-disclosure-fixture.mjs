import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

export async function installCoreVaultSessionFixture(pool) {
  await pool.query(`
    create table auth.vault_fixture_sessions(id uuid primary key, actor_id uuid not null, revoked boolean not null default false);
    create function app_private.require_request_session_current_at_v1(observed_at timestamptz)
    returns void language plpgsql as $$
    begin
      if observed_at is null or not exists (
        select 1 from auth.vault_fixture_sessions s where s.id::text=auth.jwt()->>'session_id'
          and s.actor_id=auth.uid() and not s.revoked and auth.jwt()->>'aal'='aal2'
      ) then raise exception using errcode='42501', message='fixture session unavailable';
      end if;
    end $$;
  `);
}

// Only the Auth/transport binder is a fixture. Providers, receipt locks,
// current permission, scan/version checks and replay settlement use PostgreSQL.
function syntheticSessionPool(pool, claims) {
  return { async connect() {
    const client = await pool.connect();
    return {
      async query(text, values) {
        const result = await client.query(text, values);
        if (text === 'begin isolation level serializable') {
          await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]);
        }
        return result;
      },
      release(destroy) { client.release(destroy); },
    };
  } };
}

async function withVaultReplayFixture({ pool, load, actor }, check) {
  const session = randomUUID();
  await pool.query('insert into auth.vault_fixture_sessions(id,actor_id) values($1,$2)', [session, actor]);
  const host = load(new URL('../../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url))
    .createCorePostgresTransactionHostV1(syntheticSessionPool(pool, {
      sub: actor, session_id: session, aal: 'aal2', role: 'authenticated',
    }));
  const binding = load(new URL('../../src/lib/core/documents-command-binding-v1.ts', import.meta.url));
  const originalBinding = binding.createCoreDocumentsCommandBindingV1;
  const boundRequests = [];
  let replays = 0;
  binding.createCoreDocumentsCommandBindingV1 = options => ({
    async bind(actualRequest) {
      assert.equal(actualRequest, options.request);
      assert.equal(options.pool, pool);
      boundRequests.push(actualRequest);
      return { replayHost: { async execute(command, providers) {
        replays += 1;
        return host.executeDocumentsReplayOnly(command, providers);
      } } };
    },
  });
  try {
    return await check({ session, boundRequests, replayCount: () => replays });
  } finally {
    binding.createCoreDocumentsCommandBindingV1 = originalBinding;
  }
}

export async function checkCoreVaultDisclosure({
  pool, load, ids, actor, digest, check, byteAdapter, rawTarget, bytes, exactSelection, downloadContext, prepared,
}) {
  await withVaultReplayFixture({ pool, load, actor }, async ({ session, boundRequests, replayCount }) => {
    const controller = new AbortController();
    const request = new Request('https://vault.test/private', { signal: controller.signal });
    const { createCoreDocumentsDownloadRecheckV1 } = load(
      new URL('../../src/lib/core/documents-download-recheck-v1.ts', import.meta.url));
    const guard = await createCoreDocumentsDownloadRecheckV1({ pool, request });
    assert.ok(guard);
    assert.deepEqual(boundRequests, [request]);
    const pin = original => guard.bindPreparedDownload(exactSelection, downloadContext, original);
    const before = await digest();
    const releaseForFixture = async (observation, retained) => {
      const rechecked = await retained.recheckAfterStorage();
      assert.equal(rechecked.outward_projection, null);
      assert.equal(rechecked.current_authority_reusable, false);
      if (rechecked.status !== 'current_match') {
        assert.equal(rechecked.private_candidate, null);
        return null;
      }
      const candidate = rechecked.private_candidate;
      for (const field of ['bucket_id', 'object_path', 'storage_object_id', 'storage_generation',
        'storage_etag', 'sha256', 'size_bytes']) {
        assert.equal(candidate[field], observation[field]);
      }
      assert.equal(candidate.mime_type, observation.detected_mime_type);
      assert.equal(observation.sha256, createHash('sha256').update(bytes).digest('hex'));
      return bytes; // Test-local release; no product HTTP response is mounted.
    };
    await check('same request releases fixture bytes only after exact receipt and object recheck', async () => {
      const retained = pin(prepared);
      assert.ok(retained);
      const measured = await byteAdapter.readback(rawTarget);
      assert.deepEqual(await releaseForFixture(measured, retained), bytes);
      const legacy = await guard.recheckAfterStorage(exactSelection, downloadContext);
      assert.equal(legacy.result.status, 'exact_replay');
      assert.deepEqual(legacy.result.receipt, prepared.result.receipt);
      assert.deepEqual(legacy.private_candidate, prepared.private_candidate);
      assert.equal(legacy.outward_projection, null);
      assert.equal(await digest(), before);
    });
    await check('session, permission and current target changes after Storage withhold all bytes', async () => {
      const toggles = [
        ['update auth.vault_fixture_sessions set revoked=$2 where id=$1', session, true, false],
        ['update platform.workspace_entitlements set boolean_value=$2 where customer_workspace_id=$1',
          ids.workspaceIds[0], false, true],
        ['update documents.documents set disposition_status=$2 where id=$1',
          exactSelection.document_id, 'expired', 'retained'],
      ];
      for (const [sql, key, changed, restored] of toggles) {
        const retained = pin(prepared);
        const measured = await byteAdapter.readback(rawTarget);
        await pool.query(sql, [key, changed]);
        try { assert.equal(await releaseForFixture(measured, retained), null); }
        finally { await pool.query(sql, [key, restored]); }
      }
      assert.equal(await digest(), before);
    });
    await check('a substituted receipt or object generation is withheld even with current authority', async () => {
      const retained = pin(prepared);
      const measured = await byteAdapter.readback(rawTarget);
      const key = `core-tx.v1:${ids.workspaceIds[0]}:${exactSelection.idempotency_key}`;
      const sql = "update platform.idempotency_keys set response_ref=jsonb_set(response_ref,'{receipt_id}',to_jsonb($2::text)) where key=$1";
      await pool.query(sql, [key, randomUUID()]);
      try { assert.equal(await releaseForFixture(measured, retained), null); }
      finally { await pool.query(sql, [key, prepared.result.receipt.receipt_id]); }
      const other = pin({ ...prepared, private_candidate: {
        ...prepared.private_candidate, storage_generation: 'unrelated-generation',
      } });
      assert.ok(other);
      assert.equal(await releaseForFixture(measured, other), null);
      assert.equal(await digest(), before);
    });
    await check('aborted request withholds all bytes before any new replay', async () => {
      const retained = pin(prepared);
      const measured = await byteAdapter.readback(rawTarget);
      const prior = replayCount();
      controller.abort();
      assert.equal(await releaseForFixture(measured, retained), null);
      assert.equal(replayCount(), prior);
      assert.equal(await digest(), before);
    });
  });
}

export async function checkAppVaultDisclosure({
  pool, load, ids, actor, digest, check, byteAdapter, bytes, request, commands, selection, commandContext, scratchFile,
}) {
  await withVaultReplayFixture({ pool, load, actor }, async ({ session, boundRequests, replayCount }) => {
    const { createDocumentsPrivateDownloadPostV1 } = load(
      new URL('../../src/lib/app/documents-private-download-v1.ts', import.meta.url));
    const database = new URL(pool.options.connectionString);
    const { rows: [db] } = await pool.query('select oid::int from pg_database where datname=current_database()');
    const target = {
      contract: 'core-functional-development-target.v1', backend_id: 'disposable-vault',
      purpose: 'owned-isolated-persistent-development', host: database.hostname, port: Number(database.port),
      database_name: database.pathname.slice(1), database_oid: db.oid,
      runtime_role: database.username, auth_origin: 'http://127.0.0.1:1',
    };
    const input = { ...selection, idempotency_key: 'vault-private-app-download' };
    const seen = [];
    const admissionCount = new WeakMap();
    let storageReads = 0;
    let duringStorage;
    let changeReboundBinding;
    const storage = { async readbackWithBytes(targetValue) {
      storageReads++;
      const read = await byteAdapter.readbackWithBytes(targetValue);
      await duringStorage?.();
      return read;
    } };
    const binding = {
      sessionId: session, tenantId: ids.tenantId, contextId: ids.contextId, workspaceId: ids.workspaceIds[0],
      custodyId: 'disposable-vault', commandContext, commands, storage, core: { pool, target },
    };
    const post = createDocumentsPrivateDownloadPostV1(async original => {
      seen.push(original);
      const count = (admissionCount.get(original) ?? 0) + 1;
      admissionCount.set(original, count);
      return count === 2 && changeReboundBinding ? changeReboundBinding(binding) : binding;
    });
    async function withheld(response, status = 403) {
      assert.equal(response.status, status, await response.clone().text());
      assert.equal(response.headers.get('content-disposition'), null);
      assert.equal(response.headers.get('location'), null);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.deepEqual(await response.json(), { error: { code: status === 403
        ? 'DOCUMENT_DOWNLOAD_DENIED' : 'DOCUMENT_DOWNLOAD_UNAVAILABLE' } });
    }
    await check('private APP handler releases the measured attachment with one same-request Core replay', async () => {
      const allowed = request(input);
      const result = await post(allowed);
      assert.equal(result.status, 200, await result.clone().text());
      assert.equal(result.headers.get('content-disposition'), 'attachment');
      assert.deepEqual(seen, [allowed, allowed]);
      assert.deepEqual(boundRequests, [allowed]);
      assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
      assert.equal(storageReads, 1);
      assert.equal(replayCount(), 1);
      const { rows: [events] } = await pool.query(`
        select count(*)::int as count from documents.access_events where document_id=$1
          and version_id=$2 and action='authorized_download'
      `, [selection.document_id, selection.version_id]);
      assert.equal(events.count, 2, 'one access event per separate original download command');
    });
    const before = await digest();
    await check('private APP handler denies wrong Workspace before reading and rejects altered measured bytes', async () => {
      const prior = storageReads;
      const replays = replayCount();
      await withheld(await post(request({ ...input, workspace_id: ids.workspaceIds[1] })));
      assert.equal(storageReads, prior);
      const altered = Buffer.from(bytes);
      altered[altered.length - 1] ^= 1;
      await writeFile(scratchFile, altered);
      try { await withheld(await post(request(input)), 503); }
      finally { await writeFile(scratchFile, bytes); }
      assert.equal(storageReads, prior + 1);
      assert.equal(replayCount(), replays);
      assert.equal(await digest(), before);
    });
    await check('private APP handler withholds bytes when session, entitlement, target or receipt expiry changes during Storage', async () => {
      const key = `core-tx.v1:${ids.workspaceIds[0]}:${input.idempotency_key}`;
      const { rows: [receipt] } = await pool.query('select expires_at::text from platform.idempotency_keys where key=$1', [key]);
      const { rows: [clock] } = await pool.query("select (clock_timestamp()-interval '1 second')::text expired");
      const toggles = [
        ['update auth.vault_fixture_sessions set revoked=$2 where id=$1', session, true, false],
        ['update platform.workspace_entitlements set boolean_value=$2 where customer_workspace_id=$1',
          ids.workspaceIds[0], false, true],
        ['update documents.documents set disposition_status=$2 where id=$1',
          selection.document_id, 'expired', 'retained'],
        ['update platform.idempotency_keys set expires_at=$2::timestamptz where key=$1',
          key, clock.expired, receipt.expires_at],
      ];
      const replays = replayCount();
      for (const [sql, row, changed, restored] of toggles) {
        duringStorage = () => pool.query(sql, [row, changed]);
        try { await withheld(await post(request(input))); }
        finally {
          duringStorage = undefined;
          await pool.query(sql, [row, restored]);
        }
        assert.equal(await digest(), before);
      }
      assert.equal(replayCount(), replays + toggles.length);
    });
    await check('private APP handler denies changed custody, Core target and transport before a replay decision', async () => {
      const replays = replayCount();
      for (const change of [
        original => ({ ...original, custodyId: 'changed-custody' }),
        original => ({ ...original, core: { pool, target: { ...target, backend_id: 'changed-target' } } }),
        original => ({ ...original, storage: { ...storage } }),
        original => ({ ...original, core: { ...original.core, pool: { ...pool } } }),
      ]) {
        changeReboundBinding = change;
        await withheld(await post(request(input)));
      }
      assert.equal(replayCount(), replays);
      assert.equal(await digest(), before);
    });
  });
}
