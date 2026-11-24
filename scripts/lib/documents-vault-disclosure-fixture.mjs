import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

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

export async function checkCoreVaultDisclosure({
  pool, load, ids, actor, digest, check, byteAdapter, rawTarget, bytes, exactSelection, downloadContext, prepared,
}) {
  const session = randomUUID();
  await pool.query('insert into auth.vault_fixture_sessions(id,actor_id) values($1,$2)', [session, actor]);
  const host = load(new URL('../../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url))
    .createCorePostgresTransactionHostV1(syntheticSessionPool(pool, {
      sub: actor, session_id: session, aal: 'aal2', role: 'authenticated',
    }));
  const binding = load(new URL('../../src/lib/core/documents-command-binding-v1.ts', import.meta.url));
  const originalBinding = binding.createCoreDocumentsCommandBindingV1;
  const controller = new AbortController();
  const request = new Request('https://vault.test/private', { signal: controller.signal });
  let replays = 0;
  binding.createCoreDocumentsCommandBindingV1 = options => ({
    async bind(actualRequest) {
      assert.equal(actualRequest, request);
      assert.equal(options.request, request);
      return { replayHost: { async execute(command, providers) {
        replays += 1;
        return host.executeDocumentsReplayOnly(command, providers);
      } } };
    },
  });
  try {
    const { createCoreDocumentsDownloadRecheckV1 } = load(
      new URL('../../src/lib/core/documents-download-recheck-v1.ts', import.meta.url));
    const guard = await createCoreDocumentsDownloadRecheckV1({ pool, request });
    assert.ok(guard);
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
      const prior = replays;
      controller.abort();
      assert.equal(await releaseForFixture(measured, retained), null);
      assert.equal(replays, prior);
      assert.equal(await digest(), before);
    });
  } finally {
    binding.createCoreDocumentsCommandBindingV1 = originalBinding;
  }
}
