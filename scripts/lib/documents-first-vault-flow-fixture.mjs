import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server.js';
import { scanDocumentVersion } from '../document-clamav-worker.mjs';

const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function installFirstVaultFlowFixture(pool) {
  // The first flow uses the canonical queue and attestation migrations on
  // this disposable database.
  await pool.query(`
    create schema storage;
    create table storage.objects(id uuid primary key, bucket_id text not null, name text not null,
      unique(bucket_id,name));
    create table app_private.document_tombstones(tenant_id uuid, document_id uuid);
    create table app_private.disposal_purge_jobs(tenant_id uuid, document_id uuid, status text);
    create schema portfolio;
    create schema communications;
    create table portfolio.buildings(id uuid, tenant_id uuid, property_id uuid);
    create table portfolio.units(id uuid, tenant_id uuid, building_id uuid, status text);
    create table identity.roles(id uuid primary key, tenant_id uuid, code text not null);
    alter table identity.memberships add column role_id uuid;
    alter table identity.context_grants add column scope_type text not null default 'tenant',
      add column property_id uuid, add column building_id uuid, add column unit_id uuid;
    alter table documents.documents add column disposition_status text not null default 'retained';
    create table documents.document_permissions(id uuid primary key, tenant_id uuid, document_id uuid,
      membership_id uuid, permission text, valid_from timestamptz, valid_until timestamptz);
    create table documents.document_links(tenant_id uuid, document_id uuid, entity_type text, entity_id uuid);
    create table documents.document_audit_links(tenant_id uuid, document_id uuid);
    -- No unit memberships or grants are installed in this tenant-admin fixture.
    create function communications.member_covers_unit(uuid,uuid,uuid) returns boolean language sql as $$
      select false
    $$;
    create function communications.context_covers_unit(uuid,uuid) returns boolean language sql as $$
      select false
    $$;
  `);
  await pool.query(migration('20260927211439_document_vault_clamav_attestation.sql'));
  await pool.query(migration('20260927211448_document_vault_scan_queue.sql'));
  const scopeMatcher = migration('20260829005100_customer_document_vault_secure_evidence.sql')
    .match(/create or replace function documents\.customer_document_scope_matches\([\s\S]+?\$\$;/);
  assert.ok(scopeMatcher);
  await pool.query(scopeMatcher[0]);
}

function privateStorage(pool, directory, intent, bytes) {
  const object = {
    id: randomUUID(), generation: 'local-immutable-fixture-1', etag: sha256(bytes),
    bucket: 'document-vault', path: intent.object_path,
  };
  const file = join(directory, 'object.pdf');
  let posts = 0;
  const fetch = async (url, options) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.origin, 'http://127.0.0.1:1');
    const pathname = decodeURIComponent(endpoint.pathname);
    assert.ok(pathname.endsWith(`/${object.bucket}/${object.path}`));
    if (options.method === 'POST') {
      posts += 1;
      assert.equal(new Headers(options.headers).get('x-upsert'), 'false');
      try { await writeFile(file, options.body, { flag: 'wx', mode: 0o600 }); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        return Response.json({ statusCode: '409', message: 'Object exists' }, { status: 409 });
      }
      await pool.query('insert into storage.objects values($1,$2,$3)', [object.id, object.bucket, object.path]);
      return Response.json({ Id: object.id, Key: `${object.bucket}/${object.path}` });
    }
    const stored = await readFile(file);
    if (pathname.includes('/object/info/')) {
      return Response.json({
        id: object.id, bucket_id: object.bucket, name: object.path, size: stored.length,
        content_type: 'application/pdf', version: object.generation, etag: object.etag,
      });
    }
    return new Response(stored, { headers: { 'content-type': 'application/pdf' } });
  };
  return {
    client: createClient('http://127.0.0.1:1', 'disposable-storage-transport-fixture', {
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    object, file, posts: () => posts,
  };
}

async function scannerRpc(pool, statement, parameters) {
  const connection = await pool.connect();
  try {
    await connection.query('begin');
    await connection.query('set local role service_role');
    const { rows } = await connection.query(statement, parameters);
    await connection.query('commit');
    return rows[0].result;
  } catch (error) {
    await connection.query('rollback');
    throw error;
  } finally {
    connection.release();
  }
}

export async function runFirstVaultFlow({ pool, host, load, ids, actor, revision, withSyntheticAal2, check, digest }) {
  const role = (await pool.query(`
    insert into identity.roles values(gen_random_uuid(),$1,'association_admin') returning id
  `, [ids.tenantId])).rows[0].id;
  await pool.query('update identity.memberships set role_id=$1 where id=$2', [role, ids.membershipId]);
  const commands = load(new URL('../../src/lib/customer/documents-functional-commands-v1.ts', import.meta.url))
    .createDocumentsFunctionalCommandsV1({
      execute(command, providers) {
        return host.execute(command, withSyntheticAal2(providers, { authority: 0, validation: 0, replay: 0, mutation: 0 }));
      },
    });
  const writer = load(new URL('../../src/lib/customer/documents-workspace-binding-writer-v1.ts', import.meta.url));
  const storageModule = load(new URL('../../src/lib/customer/documents-storage-readback-v1.ts', import.meta.url));
  const [workspace, otherWorkspace] = ids.workspaceIds;
  const context = async () => ({
    transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor, authority_version: await revision(),
  });
  const intentId = randomUUID();
  const documentId = randomUUID();
  const versionId = randomUUID();
  const bytes = Buffer.from('%PDF-1.7\nCLADORA first private Vault fixture\n');
  const intent = {
    contract_version: 'documents-new-document-intent.v1', context_id: ids.contextId, workspace_id: workspace,
    intent_id: intentId, prospective_document_id: documentId, filename: 'vault-fixture.pdf',
    object_path: `${ids.tenantId}/${intentId}/v1.pdf`, declared_mime_type: 'application/pdf', max_size_bytes: 4096,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), idempotency_key: 'vault-first-intent',
  };
  const selection = {
    contract_version: 'documents-vault-download-exact-workspace.v2', context_id: ids.contextId,
    workspace_id: workspace, document_id: documentId, version_id: versionId, expected_current_version: 1,
    idempotency_key: 'vault-first-download',
  };
  const request = data => new NextRequest('https://vault.test/documents', {
    method: 'POST',
    headers: { origin: 'https://vault.test', 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  const directory = await mkdtemp(join(tmpdir(), 'cladora-first-vault-flow-'));
  try {
    const storage = privateStorage(pool, directory, intent, bytes);
    const byteAdapter = storageModule.createDocumentsStorageReadbackV1(storage.client);
    const rawTarget = { bucket_id: 'document-vault', object_path: intent.object_path };
    await check('canonical intent, SDK upload/readback and immutable version pin the same object and digest', async () => {
      const issued = await commands.issueNewIntent(intent, await context());
      assert.equal(issued.status, 'committed', JSON.stringify(issued));
      const uploaded = await byteAdapter.uploadNew(intent, bytes);
      assert.equal(uploaded.storage_object_id, storage.object.id);
      assert.equal(uploaded.sha256, sha256(bytes));
      assert.equal(uploaded.non_overwrite_verified, false);
      await assert.rejects(byteAdapter.uploadNew(intent, bytes), { code: 'UPLOAD_OUTCOME_UNCONFIRMED' });
      assert.deepEqual(await readFile(storage.file), bytes, 'second POST never replaces persisted bytes');
      assert.equal(storage.posts(), 2);
      const verified = await writer.verifyDocumentsStoredObjectBeforeTransactionV1(rawTarget, async target => {
        const current = await byteAdapter.readback(target);
        assert.deepEqual(current, uploaded);
        // Admission here covers only this known scratch file with an exclusive
        // writer. Never use that evidence as a hosted Storage attestation.
        const { non_overwrite_verified: _measured, scan_authority: _scan,
          reusable_as_download_authority: _release, ...observation } = current;
        return { ...observation, non_overwritable: true };
      });
      const input = {
        contract_version: 'documents-initial-version.v1', context_id: ids.contextId, workspace_id: workspace,
        intent_id: intentId, document_id: documentId, version_id: versionId, title: 'Vault fixture',
        document_type: 'general', classification: 'internal', idempotency_key: 'vault-first-finalize',
      };
      const finalized = await commands.finalizeInitial(input, await context(), verified);
      assert.equal(finalized.status, 'committed', JSON.stringify(finalized));
      assert.equal(finalized.receipt.mutation_id, versionId);
      const { rows: [row] } = await pool.query(`
        select v.storage_object_id::text, v.sha256, v.scanning_status, q.state, i.status,
          v.upload_intent_id::text, d.workspace_id::text
        from documents.document_versions v join documents.documents d on d.id=v.document_id
          join documents.upload_intents i on i.id=v.upload_intent_id
          join documents.document_scan_jobs q on q.version_id=v.id
        where v.id=$1
      `, [versionId]);
      assert.deepEqual(row, {
        storage_object_id: storage.object.id, sha256: sha256(bytes), scanning_status: 'deferred',
        state: 'pending', status: 'consumed', upload_intent_id: intentId, workspace_id: workspace,
      });
      await assert.rejects(pool.query('update documents.document_versions set sha256=$2 where id=$1',
        [versionId, '0'.repeat(64)]), /document_versions_are_immutable/);
    });
    await check('pending version has neither an access event nor a private or outward download result', async () => {
      const before = await digest();
      const pending = await commands.preparePrivateDownload(selection, await context());
      assert.equal(pending.result.status, 'denied', JSON.stringify(pending));
      assert.equal(pending.private_candidate, null);
      assert.equal(pending.outward_projection, null);
      assert.equal(await digest(), before);
    });
    await check('real scan lease SQL settles only the measured immutable version and digest', async () => {
      const job = await scannerRpc(pool, 'select public.claim_document_scan_job_v1($1,900) result', ['vault-fixture']);
      assert.equal(job.version_id, versionId);
      assert.equal(job.attempt_count, 1);
      const scanner = {
        storage: storage.client.storage,
        async rpc(name, args) {
          const data = name === 'get_document_scan_target_v1'
            ? await scannerRpc(pool, 'select public.get_document_scan_target_v1($1) result', [args.p_version_id])
            : await complete(name, args);
          return { data, error: null };
        },
      };
      async function complete(name, args) {
        assert.equal(name, 'complete_document_scan_job_v1');
        assert.equal(args.p_job_id, job.job_id);
        assert.equal(args.p_content_sha256, sha256(bytes));
        return scannerRpc(pool, 'select public.complete_document_scan_job_v1($1,$2,$3,$4,$5,$6,$7) result',
          [args.p_job_id, args.p_lease_token, args.p_scan_id, args.p_verdict, args.p_content_sha256,
            args.p_engine_version, args.p_scanned_at]);
      }
      const scanned = await scanDocumentVersion({
        client: scanner, versionId, completionJob: job, async run(binary, args) {
          if (binary === 'freshclam') return { code: 0 };
          assert.equal(binary, 'clamscan');
          if (args[0] === '--version') return { code: 0, stdout: 'Controlled scanner fixture' };
          const file = args.at(-1);
          assert.deepEqual(await readFile(file), bytes);
          return { code: 0, stdout: `${file}: OK` };
        },
      });
      assert.deepEqual(scanned, { versionId, verdict: 'clean' });
      const { rows } = await pool.query(`
        select q.state,q.attempt_count,a.content_sha256,a.verdict
        from documents.document_scan_jobs q join documents.document_scan_attestations a
          on a.version_id=q.version_id and a.tenant_id=q.tenant_id
        where q.id=$1
      `, [job.job_id]);
      assert.deepEqual(rows, [{ state: 'completed', attempt_count: 1, content_sha256: sha256(bytes), verdict: 'clean' }]);
    });
    await check('canonical download and replay return the exact private version with one access event', async () => {
      const downloadContext = await context();
      const exactSelection = {
        ...selection, workspace_id: workspace.toUpperCase(), version_id: versionId.toUpperCase(),
      };
      const prepared = await commands.preparePrivateDownload(exactSelection, downloadContext);
      assert.equal(prepared.result.status, 'committed', JSON.stringify(prepared));
      assert.equal(prepared.private_candidate?.version_id, versionId);
      assert.equal(prepared.private_candidate?.storage_object_id, storage.object.id);
      assert.equal(prepared.private_candidate?.sha256, sha256(bytes));
      assert.equal(prepared.private_candidate?.reusable_as_download_authority, false);
      assert.equal(prepared.outward_projection, null);
      const measured = await byteAdapter.readback(rawTarget);
      assert.equal(measured.sha256, prepared.private_candidate.sha256);
      assert.equal(measured.storage_generation, prepared.private_candidate.storage_generation);
      const beforeReplay = await digest();
      const replay = await commands.preparePrivateDownload(selection, downloadContext);
      assert.equal(replay.result.status, 'exact_replay', JSON.stringify(replay));
      assert.deepEqual(replay.result.receipt, prepared.result.receipt);
      assert.deepEqual(replay.private_candidate, prepared.private_candidate);
      assert.equal(await digest(), beforeReplay);
      const { rows: [events] } = await pool.query(`
        select count(*)::int as count from documents.access_events where document_id=$1
          and version_id=$2 and action='authorized_download'
      `, [documentId, versionId]);
      assert.equal(events.count, 1);
      const foreign = await commands.preparePrivateDownload({
        ...selection, workspace_id: otherWorkspace, idempotency_key: 'vault-foreign-download',
      }, await context());
      assert.equal(foreign.result.status, 'denied', JSON.stringify(foreign));
      assert.equal(foreign.private_candidate, null);
      assert.equal(await digest(), beforeReplay);
    });
    await check('existing public upload and download handlers retain their held response without releasing bytes', async () => {
      const uploadIntent = load(new URL('../../src/app/api/customer/v1/documents/upload-intent/route.ts', import.meta.url));
      const upload = load(new URL('../../src/app/api/customer/v1/documents/upload/route.ts', import.meta.url));
      const download = load(new URL('../../src/app/api/customer/v1/documents/[id]/download/route.ts', import.meta.url));
      const before = await digest();
      for (const [response, error] of [
        [await uploadIntent.POST(request({})), 'CANONICAL_DOCUMENT_WRITER_UNAVAILABLE'],
        [await upload.POST(request({})), 'CANONICAL_DOCUMENT_WRITER_UNAVAILABLE'],
        [await download.POST(request({ context_id: ids.contextId, version_id: versionId }),
          { params: Promise.resolve({ id: documentId }) }), 'CANONICAL_DOCUMENT_DOWNLOAD_UNAVAILABLE'],
      ]) {
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('content-disposition'), null);
        assert.equal((await response.json()).error.code, error);
      }
      assert.equal(await digest(), before);
    });
    console.log(JSON.stringify({
      engine: (await pool.query('show server_version')).rows[0].server_version,
      storage: 'exclusive scratch file and SDK transport', scanner: 'controlled engine, native lease SQL',
      current_disclosure: 'not_evaluated', public_routes: '503', hosted: 'NOT_RUN',
    }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
