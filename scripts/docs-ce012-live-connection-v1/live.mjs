import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Gate, must, localUrl, sha256, canonical } from './admission.mjs';
import { preflight, snapshot, measure, sharedLockProbe, createSerializationConflict } from './measure.mjs';

function productLoader(root, inventory, ts) {
  const require = createRequire(path.join(root, 'package.json'));
  const pins = new Map(inventory.files.map(f => [f.path, f]));
  const cache = new Map();
  return function load(relative) {
    const pin = pins.get(relative);
    must(pin, 'UNPINNED_PRODUCT_IMPORT');
    const file = path.join(root, relative), bytes = readFileSync(file);
    must(sha256(bytes) === pin.sha256, 'PRODUCT_IMPORT_CHANGED');
    if (cache.has(relative)) return cache.get(relative).exports;
    const mod = { exports: {} }; cache.set(relative, mod);
    const compiled = ts.transpileModule(bytes.toString(), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    new Function('require', 'module', 'exports', compiled.outputText)(name => {
      // Build-time server-only marker only. No product/Auth/evaluator substitute.
      if (name === 'server-only') return {};
      if (!name.startsWith('.')) return require(name);
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
      return load(next.endsWith('.ts') ? next : `${next}.ts`);
    }, mod, mod.exports);
    return mod.exports;
  };
}
export async function verifySession(target, token, observer) {
  must(typeof token === 'string' && token.length > 20, 'ISSUED_AAL2_SESSION_MISSING');
  // A successful local Auth /user verifies this very token; decoding by itself
  // never establishes signature/current-user authority. No sign-in/MFA fixture
  // or session creation is performed by this consumer.
  const response = await fetch(`${target.auth_origin}${target.auth_user_path}`, {
    headers: { authorization: `Bearer ${token}` }, redirect: 'error',
    signal: AbortSignal.timeout(3000),
  });
  must(response.ok, 'AUTH_TOKEN_NOT_VERIFIED');
  const user = await response.json();
  let claims; try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); }
  catch { throw new Gate('AUTH_CLAIMS_MALFORMED'); }
  must(user.id === claims.sub && claims.aal === 'aal2' && claims.role === 'authenticated'
    && claims.iss === target.auth_issuer && Number.isSafeInteger(claims.exp)
    && claims.exp > Date.now() / 1000 && typeof claims.session_id === 'string', 'CURRENT_AAL2_REQUIRED');
  const session = await observer.query(`select id::text,user_id::text,
    (not_after is null or not_after>clock_timestamp()) as current
    from auth.sessions where id=$1 and user_id=$2`, [claims.session_id, claims.sub]);
  must(session.rowCount === 1 && session.rows[0].current === true, 'AUTH_SESSION_NOT_CURRENT');
  return { source: 'supabase_verified_session', actor_id: claims.sub, assurance_level: 'aal2', expires_at: claims.exp };
}
const expected = {
  current_positive: 'current_authorized', documents_denied: 'denied', replaced_fresh: 'stale',
  historical_disclosure: 'historical_authorized', historical_revoked: 'denied',
  cross_workspace: 'denied', quarantined: 'denied', shared_lock: 'current_authorized', serialization_retry: 'current_authorized',
};
const historical = name => name === 'historical_disclosure' || name === 'historical_revoked';

async function casePrestate(observer, c, guide, command, tenant, ce) {
  const t = guide.payload.document_target;
  must(t && command.actor_id && command.context_id === guide.context_id
    && command.workspace_id === guide.workspace_id && command.aggregate_id === guide.guide_id
    && command.command_id === guide.command_id && command.aggregate_type === 'experience_guide'
    && command.aggregate_version === guide.expected_guide_version + 1
    && command.subject_reference.kind === 'experience.guide'
    && command.subject_reference.id === guide.guide_id
    && command.subject_reference.version === guide.expected_guide_version
    && command.subject_reference.relation === 'save_draft' && command.subject_reference.request_version === 1
    && command.permission_code === 'experience.guide.manage' && command.module_code === 'experience_guides'
    && command.evaluation_purpose === 'experience.guide.command'
    && command.provider_source_ids.includes(t.document_id) && command.provider_source_ids.includes(t.document_version_id)
    && command.input_fingerprint === guide.payload_fingerprint
    && ce.fingerprintCe012GuideSavePayload(guide) === guide.payload_fingerprint
    && command.idempotency_key === guide.idempotency_key, 'CASE_BINDING_INCOMPLETE');
  const state = await observer.query(`select d.tenant_id::text,d.workspace_id::text,d.current_version,
    d.status::text,v.version,v.scanning_status::text,v.checksum_status::text
    from documents.documents d join documents.document_versions v
    on v.document_id=d.id and v.tenant_id=d.tenant_id where d.id=$1 and v.id=$2`, [t.document_id, t.document_version_id]);
  must(state.rowCount === 1 && state.rows[0].tenant_id === tenant
    && state.rows[0].version === t.document_version, 'FIXTURE_IMMUTABLE_TARGET_MISSING');
  const s = state.rows[0];
  if (c.name === 'cross_workspace') must(s.workspace_id !== command.workspace_id && s.workspace_id !== null, 'CROSS_WORKSPACE_FIXTURE_MISSING');
  else must(s.workspace_id === command.workspace_id, 'CASE_WORKSPACE_MISMATCH');
  if (['replaced_fresh', 'historical_disclosure', 'historical_revoked'].includes(c.name)) {
    must(s.current_version > t.document_version, 'REPLACED_VERSION_FIXTURE_MISSING');
  }
  if (c.name === 'quarantined') must(['quarantined', 'infected'].includes(s.scanning_status), 'QUARANTINE_FIXTURE_MISSING');
}

/** No installation/setup callback. Admitted fixture setup (native schema,
 * roles, genuine Auth session, committed receipt, denial states) must preexist.
 * This module owns only fixed read probes and the one no-value-change conflict.
 */
export async function executeLive(admitted, root, selectors) {
  const { request, inventory, review, plan } = admitted;
  const runtimeUrl = localUrl(selectors.runtime, 'db');
  const observerUrl = localUrl(selectors.observer, 'db');
  must(runtimeUrl.pathname.slice(1) === review.target.database && observerUrl.pathname === runtimeUrl.pathname
    && runtimeUrl.host === observerUrl.host && runtimeUrl.username === 'cladora_ce_guide_runtime'
    && observerUrl.username === review.target.observer_role, 'CONNECTION_IDENTITY_MISMATCH');
  must(Number(process.versions.node.split('.')[0]) >= 22, 'NODE_VERSION_UNSUPPORTED');
  const require = createRequire(path.join(root, 'package.json'));
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json')));
  for (const name of ['pg', 'typescript', 'zod', 'next', '@supabase/ssr']) {
    must(JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'))).version
      === lock.packages[`node_modules/${name}`].version, 'EXACT_TOOLCHAIN_UNAVAILABLE');
  }
  const pg = require('pg'), ts = require('typescript');
  const load = productLoader(root, inventory, ts);
  const hostApi = load('src/lib/core/postgres-transaction-host-v1.ts');
  const core = load('src/lib/core/current-authority-postgres-provider-v1.ts');
  const authPort = load('src/lib/core/current-authority-transaction-port-v1.ts');
  const poolApi = load('src/lib/core/platform-role-bound-pool-v1.ts');
  const requestPoolApi = load('src/lib/community/experience-guide-lifecycle-http-v1.ts');
  const docs = load('src/lib/customer/documents-ce012-reference-provider-v1.ts');
  const ce = load('src/lib/community/experience-guide-command-contract.ts');
  const bridgeApi = load('src/lib/community/experience-guide-provider-bridge.ts');
  const replayApi = load('src/lib/core/transaction-replay-provider-hook-v1.ts');
  const runtimePool = new pg.Pool({ connectionString: runtimeUrl.href, max: 2,
    connectionTimeoutMillis: 3000, query_timeout: 12000 });
  const observerPool = new pg.Pool({ connectionString: observerUrl.href, max: 1,
    connectionTimeoutMillis: 3000, query_timeout: 12000,
    options: '-c default_transaction_read_only=on -c statement_timeout=10000' });
  let observer, conflictPool, connectionLost = false;
  runtimePool.on('error', () => { connectionLost = true; });
  observerPool.on('error', () => { connectionLost = true; });
  try {
    observer = await observerPool.connect();
    observer.on('error', () => { connectionLost = true; });
    await preflight(observer, review);
    const session = await verifySession(review.target, selectors.token, observer);
    if (selectors.conflict && review.target.conflict_role) {
      const url = localUrl(selectors.conflict, 'db');
      must(url.host === runtimeUrl.host && url.pathname === runtimeUrl.pathname
        && url.username === review.target.conflict_role, 'CONFLICT_TARGET_IDENTITY_MISMATCH');
      conflictPool = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 3000, query_timeout: 4000 });
      conflictPool.expected_role = review.target.conflict_role;
      conflictPool.on('error', () => { connectionLost = true; });
    }
    const bound = poolApi.createCorePlatformRoleBoundPoolV1({ runtime_pool: runtimePool, connection_model: 'direct' });
    const results = [];
    const deadline = Date.now() + request.limits.total_timeout_ms;
    for (const c of plan.cases) {
      let timer;
      const activeClients = new Set();
      let caseExpired = false;
      try {
        must(!connectionLost, 'LIVE_CONNECTION_LOST');
        must(Date.now() < Date.parse(review.expires_at), 'REVIEW_EXPIRED');
        must(Date.now() < deadline, 'CONSUMER_DEADLINE');
        must(c.command && c.guide_command, 'CASE_SOURCE_BINDING_MISSING');
        if (['shared_lock', 'serialization_retry'].includes(c.name)) {
          must(conflictPool, 'ADMITTED_FIXTURE_CONFLICT_WRITER_MISSING');
        }
        const command = hostApi.coreTransactionCommandV2Schema.parse(c.command);
        const guide = ce.ce012GuideSaveCommandV1Schema.parse(c.guide_command);
        must(command.actor_id === session.actor_id, 'CASE_ACTOR_NOT_SESSION');
        if (historical(c.name)) must(typeof c.receipt_id === 'string' && /^[a-f0-9]{64}$/.test(c.receipt_hash ?? ''), 'COMMITTED_RECEIPT_BINDING_MISSING');
        else must(c.receipt_id === null && c.receipt_hash === null, 'FRESH_CASE_HAS_RECEIPT');
        await casePrestate(observer, c, guide, command, plan.tenant_id, ce);
        await verifySession(review.target, selectors.token, observer);
        timer = setTimeout(() => {
          caseExpired = true;
          // Destroy only this case's checked-out runtime sockets; Core must not
          // continue/retry dispatch after its deadline. Platform retains final
          // resource custody/cleanup; timeout itself is never cleanup proof.
          for (const client of activeClients) client.release(true);
        }, request.limits.case_timeout_ms);
        const requestPool = requestPoolApi.createExperienceGuideLifecycleRequestPoolV1(bound, session, {
          workspace_id: command.workspace_id, context_id: command.context_id,
        });
        const errors = [], attempts = [], observations = [];
        // The only 40001 witness comes from the real pg client rejection. This
        // instrumentation does not construct an error or replace any query.
        const instrumented = { async connect() {
          must(!caseExpired && !connectionLost, 'CASE_DEADLINE_OR_CONNECTION_LOSS');
          const client = await requestPool.connect(), wrapped = Object.create(client);
          activeClients.add(client);
          client.on('error', () => { connectionLost = true; });
          wrapped.query = async (...args) => {
            try {
              must(!caseExpired && !connectionLost, 'CASE_DEADLINE_OR_CONNECTION_LOSS');
              return await client.query(...args);
            }
            catch (error) {
              if (error.code === '40001') errors.push({ code: error.code,
                native: typeof error.severity === 'string' && typeof error.routine === 'string' });
              throw error;
            }
          };
          wrapped.release = (...args) => { activeClients.delete(client); return client.release(...args); };
          return wrapped;
        } };
        const before = await snapshot(observer, plan.tenant_id);
        const providerCode = docs.documentsCe012ReferenceProviderVersionV1;
        let completedFresh = false, probeFailure;
        const capture = async (scope, cmd, authority, mode) => {
          attempts.push({ attempt: scope.attempt, xid: scope.database_transaction_id });
          return measure(scope, observer, plan.tenant_id, async () => {
            if (c.name === 'serialization_retry' && scope.attempt === 1) {
              await createSerializationConflict(conflictPool, plan.tenant_id, guide.payload.document_target.document_id);
            }
            const nativeRead = await scope.query(
              'select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed',
              [cmd.context_id, cmd.workspace_id, 'documents.vault.read', 'documents']);
            must(nativeRead.rowCount === 1 && nativeRead.rows[0].allowed
              === !['documents_denied', 'historical_revoked'].includes(c.name), 'NATIVE_READ_PRESTATE_MISMATCH');
            const bridge = bridgeApi.createCe012GuideProviderBridge({
              coreCommandContext: { async evaluate(request) {
                must(authority.decision === 'allowed' && authority.entitlement?.entitlement_key === 'module.experience_guides'
                  && request.context_id === cmd.context_id && request.workspace_id === cmd.workspace_id
                  && request.guide_id === cmd.aggregate_id, 'CORE_MAP_PROJECTION_UNAVAILABLE');
                const membership = await scope.query(`select m.id::text from identity.context_grants g
                  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
                  where g.id=$1 and m.user_id=$2 and m.tenant_id=$3`, [cmd.context_id, session.actor_id, scope.tenant_id]);
                must(membership.rowCount === 1, 'CORE_MEMBERSHIP_MAPPING_UNAVAILABLE');
                return ce.coreCe012MapDecisionV1Schema.parse({ contract: 'core-ce012-map-decision.v1', version: 1,
                  decision_id: authority.decision_id, context_id: cmd.context_id, workspace_id: cmd.workspace_id,
                  guide_id: cmd.aggregate_id, actor_id: session.actor_id, membership_id: membership.rows[0].id,
                  module_code: authority.module_code, permission_code: authority.permission_code,
                  entitlement_key: authority.entitlement.entitlement_key, authority: 'allowed', entitlement: 'active',
                  evaluated_at: authority.evaluated_at });
              } },
              coreTransactionalAuthority: { async recheckAfterLock(request) {
                return authPort.bindCanonicalCurrentAuthorityObservationV1(request, await core.resolveAuthority(scope, request));
              } },
              documentsImmutableSelector: docs.createDocumentsCe012ReferenceProviderV1(scope, cmd, authority, guide, mode),
            });
            const linked = await bridge.evaluate(guide, { decision_id: authority.decision_id,
              authority_version: authority.authority_version, transaction_context: authority.transaction_context }, mode);
            const decision = linked.document_decision;
            must(decision?.decision === expected[c.name], 'PROVIDER_CASE_EXPECTATION_FAILED');
            if (!['current_authorized', 'historical_authorized'].includes(decision.decision)) {
              must(decision.safe_label === null && decision.redaction === 'none', 'DENIAL_DISCLOSURE');
            }
            if (mode === 'new_command') {
              const row = await scope.query(`select version,status::text from experience.guides
                where id=$1 and workspace_id=$2 and tenant_id=$3 for share`, [guide.guide_id, cmd.workspace_id, scope.tenant_id]);
              must(row.rowCount === 1, 'GUIDE_SOURCE_MISSING');
              const evaluated = ce.evaluateCe012GuideSaveCommand(guide, {
                guide: { guide_id: guide.guide_id, context_id: cmd.context_id, workspace_id: cmd.workspace_id,
                  current_version: row.rows[0].version, state: row.rows[0].status },
                core_decision: linked.core_decision, document_decision: decision,
                issuance: { receipt_id: randomUUID(), idempotency_binding_id: randomUUID(), evaluated_at: decision.evaluated_at },
                replay: null,
              });
              must(decision.decision === 'current_authorized'
                ? evaluated.decision_status === 'accepted'
                : evaluated.receipt === null && evaluated.mutation_plan === null, 'CE_CONNECTION_FAILED');
            }
            observations.push({ decision: decision.decision });
            return decision;
          }, c.name === 'shared_lock' ? pid => sharedLockProbe(pid, observer, conflictPool,
            plan.tenant_id, guide.payload.document_target.document_id) : undefined);
        };
        const providers = { provider_code: providerCode, replay_policy: 'provider_current_state_required',
          resolveAuthority: core.resolveAuthority,
          async validateProviders(scope, cmd, authority) {
            must(!historical(c.name), 'HISTORICAL_REQUIRES_STORED_MATCHED_RECEIPT');
            try { await capture(scope, cmd, authority, 'new_command'); }
            catch (error) { if (error.code !== '40001') probeFailure = error; throw error; }
            completedFresh = true;
            // A read probe must stop before Core stages its normal receipt,
            // idempotency, audit or outbox. This is not a successful command.
            throw new Gate('READ_PROBE_COMPLETE_BEFORE_MUTATION');
          },
          async validateReplay(scope, cmd, authority, committed) {
            must(historical(c.name), 'FRESH_COMMAND_MATCHED_UNEXPECTED_RECEIPT');
            must(committed.receipt_id === c.receipt_id
              && replayApi.coreTransactionReplayReceiptHashV1(committed) === c.receipt_hash, 'COMMITTED_RECEIPT_MISMATCH');
            let d;
            try { d = await capture(scope, cmd, authority, 'replay'); }
            catch (error) { if (error.code !== '40001') probeFailure = error; throw error; }
            return { contract_version: 'core-transaction-replay-provider-decision.v1', decision_id: randomUUID(),
              provider_code: providerCode, database_transaction_id: scope.database_transaction_id,
              transaction_id: cmd.transaction_id, command_id: cmd.command_id, workspace_id: cmd.workspace_id,
              actor_id: cmd.actor_id, context_id: cmd.context_id, authority_decision_id: authority.decision_id,
              authority_version: authority.authority_version, attempt: scope.attempt,
              receipt_id: committed.receipt_id, receipt_contract_version: committed.contract_version,
              command_hash: replayApi.coreTransactionReplayCommandHashV1(cmd),
              receipt_hash: replayApi.coreTransactionReplayReceiptHashV1(committed),
              evaluated_at: d.evaluated_at, read_only: true,
              decision: d.decision === 'historical_authorized' ? 'accepted' : 'denied',
              denial_reason: d.decision === 'historical_authorized' ? null : 'REPLAY_DISCLOSURE_DENIED' };
          },
          async mutate() { throw new Gate('MUTATION_FORBIDDEN'); },
        };
        const result = await hostApi.createCorePostgresTransactionHostV1(instrumented).execute(command, providers);
        must(!caseExpired && !connectionLost && Date.now() < deadline, 'CASE_DEADLINE_OR_CONNECTION_LOSS');
        must(canonical(await snapshot(observer, plan.tenant_id)) === canonical(before), 'POST_SETTLEMENT_DURABLE_WRITE');
        if (probeFailure) throw probeFailure;
        if (!observations.length && result.status === 'denied') {
          const reasons = { AUTHORITY_DENIED: 'GUIDE_CURRENT_AUTHORITY_DENIED_BEFORE_PROVIDER',
            REPLAY_CONFLICT: 'STORED_RECEIPT_CONFLICT', PROVIDER_UNAVAILABLE: 'MATCHED_RECEIPT_OR_PROVIDER_UNAVAILABLE' };
          throw new Gate(reasons[result.code] ?? 'CORE_READ_SCOPE_UNAVAILABLE');
        }
        must(observations.length === 1 && result.status !== 'committed' && result.status !== 'unknown_commit', 'READ_PROBE_NOT_COMPLETED');
        if (historical(c.name)) must(c.name === 'historical_disclosure'
          ? result.status === 'exact_replay' && result.receipt.receipt_id === c.receipt_id
          : result.status === 'denied' && result.code === 'REPLAY_CONFLICT', 'REPLAY_RESULT_MISMATCH');
        else must(completedFresh && result.status === 'denied' && result.code === 'TRANSACTION_FAILED', 'FRESH_READ_FENCE_MISSING');
        if (c.name === 'serialization_retry') {
          must(errors.some(e => e.native) && attempts.length === 2 && attempts[0].attempt === 1
            && attempts[1].attempt === 2 && attempts[0].xid !== attempts[1].xid, 'REAL_SERIALIZATION_RETRY_NOT_WITNESSED');
        }
        results.push({ case: c.name, status: 'PASS_LIVE_READ_PROBE',
          zero_durable_write: 'INDEPENDENT_OBSERVER_AND_XACT_COUNTERS',
          historical_receipt: historical(c.name) ? 'CORE_MATCHED_STORED_RECEIPT' : 'NOT_USED' });
      } catch (error) {
        results.push({ case: c.name, status: error instanceof Gate ? 'BLOCKED' : 'FAILED',
          code: error instanceof Gate ? error.code : 'LIVE_PROOF_FAILED_NO_PRIVATE_DETAIL' });
      } finally {
        clearTimeout(timer);
        for (const client of activeClients) client.release(true);
      }
    }
    return { contract: 'documents-ce012-live-proof-result.v1', cases: results,
      result: results.every(r => r.status === 'PASS_LIVE_READ_PROBE') ? 'PASS_LIVE_READ_PROBES' : 'INCOMPLETE',
      command_commit_or_activation: 'NONE' };
  } finally {
    observer?.release();
    await Promise.all([runtimePool.end(), observerPool.end(), conflictPool?.end()]);
  }
}
