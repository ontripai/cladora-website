import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  createPf01DatabaseFixture, snapshotPf01ReadState,
} from './pf01-owner-portfolio-local-fixture.mjs';

export class BrowserProofDeadline extends Error {
  constructor(stage) { super('bounded_browser_proof_deadline'); this.name = 'BrowserProofDeadline'; this.stage = stage; }
}
export async function bounded(operation, { ms = 10_000, stage = 'operation', signal, emit = () => {} } = {}) {
  let timer; let abort;
  try {
    if (signal?.aborted) throw new BrowserProofDeadline(stage);
    const stopped = new Promise((_, reject) => {
      timer = setTimeout(() => { emit({ stage: 'reader_deadline', operation: stage }); reject(new BrowserProofDeadline(stage)); }, ms);
      abort = () => { emit({ stage: 'reader_cancelled', operation: stage }); reject(new BrowserProofDeadline(stage)); };
      signal?.addEventListener('abort', abort, { once: true });
    });
    // The underlying task is rejection-observed even if the deadline wins.
    return await Promise.race([Promise.resolve().then(operation), stopped]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export async function createCeAirpropLocalFixture(pool, users) {
  // Caller must run the accepted verified local identity gate before this setup.
  const fixture = await createPf01DatabaseFixture(pool, users);
  const foreignWorkspace = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const expired = await client.query(`update platform.workspace_member_roles a
      set valid_to=a.valid_from+interval '1 second',lock_version=a.lock_version+1,
        reason='CE disposable native assignment expiry control'
      from identity.context_grants g
      where g.id=$1 and a.membership_id=g.membership_id and a.customer_workspace_id=$2
        and a.valid_to is null and a.valid_from < statement_timestamp()-interval '1 minute'
      returning a.id`, [fixture.context, fixture.expiredWorkspace]);
    assert.equal(expired.rowCount, 1, 'expire exactly the third native assignment, respecting immutable valid_from/version');
    const foreign = await client.query(`insert into platform.customer_workspaces
      (id,tenant_id,workspace_type,commercial_owner,lifecycle_status)
      select $1,p.tenant_id,'ASSOCIATION','CE disposable foreign control','ACTIVE'
      from portfolio.units u join portfolio.buildings b on b.id=u.building_id
      join portfolio.properties p on p.id=b.property_id
      join identity.context_grants g on g.id=$2
      where u.id=$3 and p.tenant_id<>g.tenant_id returning id`, [foreignWorkspace, fixture.context, fixture.crossTenantUnit]);
    assert.equal(foreign.rowCount, 1, 'foreign control is a real active Workspace in an existing different tenant');
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  return Object.freeze({ ...fixture, foreignWorkspace });
}

export async function verifyCeNativeFixture(pool, fixture, inputs, owner) {
  const result = await pool.query(`select w.id,w.tenant_id=g.tenant_id as same_tenant,w.lifecycle_status='ACTIVE' as active,
    exists(select 1 from platform.workspace_member_roles a join platform.workspace_roles wr on wr.id=a.workspace_role_id
      where a.membership_id=g.membership_id and a.customer_workspace_id=w.id
        and a.tenant_id=w.tenant_id and wr.tenant_id=w.tenant_id and wr.customer_workspace_id=w.id
        and a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null
        and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
        and wr.lifecycle_status='published' and wr.scope_ceiling='workspace'
        and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp())) as current_assignment,
    exists(select 1 from platform.workspace_member_roles a where a.membership_id=g.membership_id
      and a.customer_workspace_id=w.id and a.valid_to>a.valid_from and a.valid_to<=statement_timestamp()) as expired_assignment,
    (select count(*)::int from platform.workspace_member_roles a where a.customer_workspace_id=w.id
      and a.membership_id in (select id from identity.memberships where user_id=$2)) as actor_assignments
    from identity.context_grants g cross join platform.customer_workspaces w
    where g.id=$1 and w.id=any($3::uuid[])`, [fixture.context, owner.userId,
    [fixture.workspaceOne, fixture.workspaceTwo, fixture.expiredWorkspace, fixture.foreignWorkspace]]);
  assert.equal(result.rowCount, 4);
  const rows = new Map(result.rows.map(row => [row.id, row]));
  for (const id of [fixture.workspaceOne, fixture.workspaceTwo]) {
    assert.equal(rows.get(id).same_tenant && rows.get(id).active && rows.get(id).current_assignment, true);
  }
  assert.equal(rows.get(fixture.expiredWorkspace).expired_assignment, true);
  assert.equal(rows.get(fixture.expiredWorkspace).current_assignment, false);
  assert.equal(rows.get(fixture.foreignWorkspace).active, true);
  assert.equal(rows.get(fixture.foreignWorkspace).same_tenant, false);
  assert.equal(rows.get(fixture.foreignWorkspace).actor_assignments, 0);
  const actor = createClient(inputs.supabaseUrl, inputs.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${owner.accessToken}` } },
  });
  const { data, error } = await bounded(() => actor.schema('customer_api').rpc('list_workspace_targets_v2', { p_context_id: fixture.context }), { stage: 'pre_browser_native_rpc', ms: 15_000 });
  assert.equal(error, null);
  const expected = result.rows.filter(row => row.same_tenant && row.active && row.current_assignment).map(row => row.id).sort();
  assert.deepEqual(expected, [fixture.workspaceOne, fixture.workspaceTwo].sort());
  assert.deepEqual(data.map(row => row.workspace_id).sort(), expected);
  return Object.freeze({ expected, controls: { current_native_targets: 2, genuinely_expired_native_assignment: true,
    foreign_workspace_active: true, foreign_actor_assignment_count: 0, canonical_actor_rpc_exact: true } });
}

export async function ceReadState(pool) {
  const state = { ...await snapshotPf01ReadState(pool) };
  for (const table of ['airprop.investment_opportunities', 'platform.tenants', 'communications.unit_invitations']) {
    const { rows } = await pool.query(`select count(*)::int as count,
      coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'') as canonical from ${table} t`);
    state[table] = { count: rows[0].count, sha256: createHash('sha256').update(rows[0].canonical).digest('hex') };
  }
  return state;
}
export const ceFingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function verifyCeControlCleanup(pool, fixture, ownerId) {
  const { rows } = await pool.query(`select
    (select count(*)::int from platform.workspace_member_roles a join identity.memberships m on m.id=a.membership_id
      where m.user_id=$1 and (a.valid_to is null or a.valid_to>statement_timestamp())) as assignments,
    (select count(*)::int from auth.sessions where user_id=$1) as sessions,
    (select count(*)::int from platform.workspace_member_roles a where a.customer_workspace_id=$2) as foreign_assignments`, [ownerId, fixture.foreignWorkspace]);
  assert.deepEqual(rows[0], { assignments: 0, sessions: 0, foreign_assignments: 0 });
}

// Independent CE test lifecycle; the accepted PF01 helper/fixture is unchanged.
// launchServer supplies the exact spawned process handle for verified kill fallback.
export async function launchOwnedCeBrowser(chromium) {
  const server = await chromium.launchServer({ headless: true, host: '127.0.0.1' });
  try {
    const browser = await chromium.connect(server.wsEndpoint(), { timeout: 15_000 });
    return { browser, server, process: server.process() };
  } catch (error) { await bounded(() => server.kill(), { ms: 5_000, stage: 'failed_launch_owned_kill' }); throw error; }
}
export async function closeOwnedCeBrowser(owned, contexts, { emit = () => {}, ms = 3_000 } = {}) {
  if (!owned) return { mode: 'NOT_CREATED', errors: [], process_gone: true };
  const errors = [];
  // Start all context closes together; a hung context cannot starve its peers.
  await Promise.all([...contexts].map(async context => {
    try { await bounded(() => context.close(), { ms, stage: 'context_close', emit }); contexts.delete(context); }
    catch { errors.push('CONTEXT_CLOSE_FAILED'); }
  }));
  emit({ stage: 'cleanup_browser', contexts_remaining: contexts.size });
  try { await bounded(() => owned.browser.close(), { ms, stage: 'browser_close', emit }); }
  catch { errors.push('BROWSER_GRACEFUL_CLOSE_FAILED'); }
  try { await bounded(() => owned.server.close(), { ms, stage: 'browser_server_close', emit }); }
  catch { errors.push('SERVER_GRACEFUL_CLOSE_FAILED'); }
  let forced = false;
  if (owned.process.exitCode === null && owned.process.signalCode === null) {
    forced = true;
    emit({ stage: 'cleanup_force_owned_browser' });
    await bounded(() => owned.server.kill(), { ms: 5_000, stage: 'owned_browser_kill', emit });
  }
  const gone = owned.process.exitCode !== null || owned.process.signalCode !== null;
  assert.equal(gone, true, 'exact owned Chromium process must have exited');
  assert.equal(owned.browser.isConnected(), false);
  contexts.clear(); // Process exit invalidates every remaining owned context.
  emit({ stage: 'cleanup_browser_finished', forced, graceful_errors: errors.length, process_gone: gone });
  return { mode: forced ? 'FORCED_OWNED_TERMINATION_VERIFIED' : errors.length ? 'GRACEFUL_WITH_CONTEXT_ERRORS_PROCESS_EXIT_VERIFIED' : 'GRACEFUL_VERIFIED', errors, process_gone: gone };
}

// Only lifecycle metadata is observed in the background. Bodies are read solely
// for the exact selected UI request, after requestfinished, with a bounded reader.
export function observeCeRequests(context, origin, emit = () => {}, { bodyMs = 5_000 } = {}) {
  let sequence = 0;
  const records = new Map(); const waiters = new Set(); const pending = new Set();
  const cancellation = new AbortController();
  const kind = url => url.pathname.endsWith('/opportunities') ? 'opportunity'
    : url.pathname.endsWith('/artifact-b2') ? 'b2' : url.pathname.endsWith('/targets') ? 'targets' : 'other_api';
  const notify = () => { for (const waiter of waiters) waiter(); };
  const request = req => {
    const url = new URL(req.url());
    if (url.origin !== origin || !url.pathname.startsWith('/api/')) return;
    const row = { request: req, sequence: ++sequence, kind: kind(url), context: url.searchParams.get('context_id'),
      workspace: url.searchParams.get('workspace_id'), method: req.method(), response: null, state: 'started' };
    records.set(req, row); emit({ stage: 'request_started', request: row.sequence, endpoint: row.kind });
  };
  const response = res => {
    const row = records.get(res.request()); if (!row) return;
    row.response = res; emit({ stage: 'headers_received', request: row.sequence, endpoint: row.kind, status: res.status() });
  };
  const finished = req => {
    const row = records.get(req); if (!row) return;
    row.state = 'finished'; emit({ stage: 'body_finished', request: row.sequence, endpoint: row.kind }); notify();
  };
  const failed = req => {
    const row = records.get(req); if (!row) return;
    row.state = /abort|cancel/i.test(req.failure()?.errorText ?? '') ? 'cancelled' : 'failed';
    emit({ stage: 'request_failed_or_cancelled', request: row.sequence, endpoint: row.kind, classification: row.state }); notify();
  };
  context.on('request', request); context.on('response', response);
  context.on('requestfinished', finished); context.on('requestfailed', failed);
  const read = async row => {
    emit({ stage: 'reader_started', request: row.sequence, endpoint: row.kind, status: row.response.status() });
    const task = row.response.body(); pending.add(task);
    task.then(() => pending.delete(task), () => pending.delete(task));
    const bytes = await bounded(() => task, { ms: bodyMs, stage: 'selected_response_body', emit, signal: cancellation.signal });
    if (bytes.length > 256 * 1024) throw new Error('ce_response_size_exceeded');
    const body = JSON.parse(bytes.toString('utf8'));
    emit({ stage: 'reader_finished', request: row.sequence, endpoint: row.kind, status: row.response.status() });
    return { status: row.response.status(), body };
  };
  return {
    checkpoint: () => sequence,
    async selected({ after, endpoint, contextId, workspaceId, signal, ms = 60_000 }) {
      let changed;
      const found = new Promise(resolve => {
        changed = () => {
          const row = [...records.values()].find(row => row.sequence > after && row.kind === endpoint
            && row.method === 'GET' && row.context === contextId && row.workspace === workspaceId && row.state === 'finished' && row.response);
          if (row) resolve(row);
        };
        waiters.add(changed); changed();
      });
      try {
        const row = await bounded(() => found, { ms, stage: 'current_ui_request_completion', emit, signal: signal ?? cancellation.signal });
        emit({ stage: 'current_scope_exact_match', request: row.sequence, endpoint: row.kind });
        return await read(row);
      } finally { waiters.delete(changed); }
    },
    stop() {
      emit({ stage: 'observer_stopped', pending_readers: pending.size, unfinished_requests: [...records.values()].filter(row => row.state === 'started').length });
      cancellation.abort();
      context.off('request', request); context.off('response', response);
      context.off('requestfinished', finished); context.off('requestfailed', failed);
      waiters.clear();
    },
    async drain() {
      await bounded(() => Promise.allSettled([...pending]), { ms: 2_000, stage: 'pending_reader_drain', emit });
      emit({ stage: 'reader_drain_finished', pending: pending.size });
      assert.equal(pending.size, 0);
    },
  };
}
