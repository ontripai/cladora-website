import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';
import { generateTotp, runAp10AuthE2EFixture } from './lib/ap10-auth-e2e-fixture.mjs';
import { createB2Loader } from './lib/airprop-b2-test-loader.mjs';
import { readLocalProjectRef } from './lib/ap10-target-identity.mjs';

const FUNCTION_SIGNATURE = 'customer_api.read_airprop_management_portfolio_v1(uuid,uuid)';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

function assertLoopback(value, name) {
  const url = new URL(value);
  if (!LOOPBACK.has(url.hostname)) throw new Error(`${name}_must_be_loopback`);
  return url;
}

function password() {
  return `Airprop!${randomBytes(32).toString('base64url')}`;
}

async function must(result, operation) {
  if (result?.error) throw new Error(`${operation}_failed`, { cause: result.error });
  return result?.data;
}

async function createAal2User(admin, url, anonKey, label) {
  const email = `airprop-http-${label}-${randomUUID()}@fixture.invalid`;
  let secret = password();
  let userId = null;
  let factorId = null;
  let accessToken = null;
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  try {
    const created = await must(await admin.auth.admin.createUser({
      email,
      password: secret,
      email_confirm: true,
      app_metadata: { fixture: 'airprop_gateway_read_http_v1', disposable: true },
    }), 'secondary_user_create');
    userId = created.user?.id;
    if (!userId) throw new Error('secondary_user_id_missing');
    const signedIn = await must(await client.auth.signInWithPassword({ email, password: secret }), 'secondary_sign_in');
    const aal1Token = signedIn.session?.access_token;
    if (!aal1Token) throw new Error('secondary_aal1_missing');
    const enrolled = await must(await client.auth.mfa.enroll({
      factorType: 'totp', friendlyName: `AIRPROP ${label}`,
    }), 'secondary_mfa_enroll');
    factorId = enrolled.id;
    let totpSecret = enrolled.totp?.secret;
    if (!factorId || !totpSecret) throw new Error('secondary_totp_missing');
    const verified = await must(await client.auth.mfa.challengeAndVerify({
      factorId, code: generateTotp(totpSecret),
    }), 'secondary_mfa_verify');
    totpSecret = null;
    accessToken = verified.access_token;
    if (!accessToken || !verified.refresh_token) throw new Error('secondary_aal2_missing');
    await must(await client.auth.setSession({
      access_token: accessToken, refresh_token: verified.refresh_token,
    }), 'secondary_session_install');
    const assurance = await must(
      await client.auth.mfa.getAuthenticatorAssuranceLevel(accessToken),
      'secondary_aal_inspect',
    );
    assert.equal(assurance.currentLevel, 'aal2');
    return {
      userId, client, aal1Token, accessToken,
      async cleanup() {
        const errors = [];
        if (factorId) {
          try { await must(await client.auth.mfa.unenroll({ factorId }), 'secondary_mfa_unenroll'); }
          catch (error) { errors.push(error); }
        }
        if (accessToken) {
          try { await must(await admin.auth.admin.signOut(accessToken, 'global'), 'secondary_global_sign_out'); }
          catch (error) { errors.push(error); }
        }
        try { await client.auth.signOut({ scope: 'local' }); } catch (error) { errors.push(error); }
        if (userId) {
          try { await must(await admin.auth.admin.deleteUser(userId, true), 'secondary_user_soft_delete'); }
          catch (error) { errors.push(error); }
        }
        if (errors.length) throw new AggregateError(errors, 'secondary_cleanup_failed');
      },
    };
  } catch (error) {
    if (userId) await admin.auth.admin.deleteUser(userId, true).catch(() => {});
    secret = null;
    throw error;
  } finally {
    secret = null;
  }
}

async function startGatewayServer(handler, dependencies) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server_address_unavailable');
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const request = new Request(`http://127.0.0.1:${address.port}${incoming.url ?? '/'}`, {
        method: incoming.method, headers,
      });
      const response = await handler(request, dependencies);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.statusCode = 500;
      outgoing.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server_address_unavailable');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

async function readJson(response) {
  return { status: response.status, body: await response.json() };
}

async function counts(pool) {
  const result = await pool.query(`select
    (select count(*)::int from audit.events) as audit_events,
    (select count(*)::int from platform.outbox_events) as outbox_events,
    (select count(*)::int from platform.idempotency_keys) as idempotency_keys,
    (select count(*)::int from airprop.management_mandate_requests) as mandates,
    (select count(*)::int from airprop.management_action_links) as action_links`);
  return result.rows[0];
}

async function main() {
  if (process.env.AIRPROP_GATEWAY_READ_HTTP_EPHEMERAL !== '1') throw new Error('ephemeral_opt_in_required');
  if (process.env.AIRPROP_GATEWAY_READ_HTTP_REAL_AAL2_REQUIRED !== '1') throw new Error('real_aal2_opt_in_required');
  const supabaseUrl = assertLoopback(required('AIRPROP_GATEWAY_READ_HTTP_SUPABASE_URL'), 'supabase_url').origin;
  const databaseUrl = required('AIRPROP_GATEWAY_READ_HTTP_TEST_DATABASE_URL');
  assertLoopback(databaseUrl, 'database_url');
  const anonKey = required('AIRPROP_GATEWAY_READ_HTTP_ANON_KEY');
  const serviceRoleKey = required('AIRPROP_GATEWAY_READ_HTTP_SERVICE_ROLE_KEY');
  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
  const admin = createClient(supabaseUrl, serviceRoleKey, options);
  const actor = createClient(supabaseUrl, anonKey, options);
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const authorityDriver = createAp10CoreAuthorityDriver(pool, { databaseUrl, target: 'local' });
  const projectRef = await readLocalProjectRef();
  const { createAirpropB2LocalBearerDependenciesV1, handleAirpropB2ReadHttpV1 } = createB2Loader()(
    'src/lib/airprop/artifact-b2-read-http-v1.ts',
  );

  let gateInitial = null;
  let schemaInitial = null;
  let gateChanged = false;
  let schemaChanged = false;
  let server = null;
  let secondary = null;
  let receipt;
  try {
    receipt = await runAp10AuthE2EFixture({
      target: 'local', supabaseUrl, projectRef, productionProjectRef: 'production-forbidden',
      disposableDatabase: true, adminClient: admin, actorClient: actor, authorityDriver, databaseUrl,
      execute: async ({ accessToken, contextId, workspaceIds, propertyIds, unitIds }) => {
        secondary = await createAal2User(admin, supabaseUrl, anonKey, 'switch');
        const primaryUser = await must(await actor.auth.getUser(accessToken), 'primary_user_verify');
        const primaryId = primaryUser.user?.id;
        assert.ok(primaryId);

        const privileges = await pool.query(`select
          has_function_privilege('authenticated',$1,'execute') as function_execute,
          has_schema_privilege('authenticated','customer_api','usage') as schema_usage`, [FUNCTION_SIGNATURE]);
        gateInitial = privileges.rows[0].function_execute;
        schemaInitial = privileges.rows[0].schema_usage;
        assert.equal(gateInitial, false, 'product execution gate must begin closed');
        if (!schemaInitial) {
          await pool.query('grant usage on schema customer_api to authenticated');
          schemaChanged = true;
        }
        await pool.query(`grant execute on function ${FUNCTION_SIGNATURE} to authenticated`);
        gateChanged = true;

        const scope = await pool.query(`select p.tenant_id,b.id as building_id
          from portfolio.properties p join portfolio.buildings b on b.property_id=p.id
          where p.id=$1 and b.tenant_id=p.tenant_id limit 1`, [propertyIds[0]]);
        assert.equal(scope.rowCount, 1);
        const tenantId = scope.rows[0].tenant_id;
        const ownerId = randomUUID();
        const mandateId = randomUUID();
        await pool.query(`insert into portfolio.parties(id,tenant_id,type,legal_name)
          values($1,$2,'person','AIRPROP local owner')`, [ownerId, tenantId]);
        await pool.query(`insert into airprop.management_mandate_requests(
          id,tenant_id,workspace_id,property_id,owner_party_id,scope,valid_from,valid_to,
          proposal_evidence_reference,status,requested_by,request_idempotency_key,request_hash,
          accepted_by,accepted_at,acceptance_evidence_reference,acceptance_idempotency_key,acceptance_hash
        ) values($1,$2,$3,$4,$5,$6,current_date-1,current_date+30,$7,'accepted',$8,$9,$10,
          $11,statement_timestamp(),$12,$13,$14)`, [
          mandateId, tenantId, workspaceIds[0], propertyIds[0], ownerId,
          JSON.stringify({ capabilities: ['owner_reporting'] }), 'fixture://airprop/proposal',
          primaryId, `airprop-read-${randomUUID()}`, '1'.repeat(64), secondary.userId,
          'fixture://airprop/acceptance', `airprop-accept-${randomUUID()}`, '2'.repeat(64),
        ]);

        const baseDependencies = createAirpropB2LocalBearerDependenciesV1({ supabaseUrl, anonKey });
        let releaseLate;
        const lateGate = new Promise(resolve => { releaseLate = resolve; });
        const dependencies = {
          authenticate: request => baseDependencies.authenticate(request),
          portfolio(session, request) {
            const gateway = baseDependencies.portfolio(session, request);
            if (request.headers.get('x-airprop-delay') !== 'primary') return gateway;
            return { async rpc(name, parameters) { await lateGate; return gateway.rpc(name, parameters); } };
          },
        };
        server = await startGatewayServer(handleAirpropB2ReadHttpV1, dependencies);
        const endpoint = (ctx, workspace) =>
          `${server.origin}/isolated/airprop/portfolio?context_id=${ctx}&workspace_id=${workspace}`;
        const request = (token, ctx, workspace, headers = {}) => fetch(endpoint(ctx, workspace), {
          headers: token ? { authorization: `Bearer ${token}`, ...headers } : headers,
        });

        const beforeReads = await counts(pool);
        const full = await readJson(await request(accessToken, contextId, workspaceIds[0]));
        assert.equal(full.status, 200);
        assert.equal(full.body.commands, null);
        assert.equal(full.body.can_edit, false);
        assert.equal(full.body.state, 'pre_activation');
        assert.equal(full.body.view.properties.length, 1);
        assert.equal(full.body.view.properties[0].property.id, propertyIds[0]);
        assert.equal(full.body.view.properties[0].action_links.length, 0);

        const empty = await readJson(await request(accessToken, contextId, workspaceIds[1]));
        assert.equal(empty.status, 200);
        assert.deepEqual(empty.body.view.properties, []);
        const unavailable = await readJson(await request(accessToken, contextId, randomUUID()));
        assert.equal(unavailable.status, 503);
        assert.equal('view' in unavailable.body, false);
        assert.equal((await request(null, contextId, workspaceIds[0])).status, 401);
        assert.equal((await request(secondary.aal1Token, contextId, workspaceIds[0])).status, 403);
        assert.equal((await request(secondary.accessToken, contextId, workspaceIds[0])).status, 503);

        let primarySettled = false;
        const delayed = request(accessToken, contextId, workspaceIds[0], { 'x-airprop-delay': 'primary' })
          .then(response => { primarySettled = true; return readJson(response); });
        await new Promise(resolve => setTimeout(resolve, 30));
        const switched = await readJson(await request(secondary.accessToken, contextId, workspaceIds[0]));
        assert.equal(switched.status, 503);
        assert.equal(primarySettled, false, 'late primary response must remain request-scoped');
        releaseLate();
        const late = await delayed;
        assert.equal(late.status, 200);
        assert.equal(late.body.view.properties[0].property.id, propertyIds[0]);
        assert.deepEqual(await counts(pool), beforeReads, 'portfolio reads must be zero-write');

        const workOrderId = randomUUID();
        const actionId = randomUUID();
        await pool.query(`insert into maintenance.work_orders(
          id,tenant_id,property_id,building_id,unit_id,title,status,created_by
        ) values($1,$2,$3,$4,$5,'AIRPROP unit scope fixture','scheduled',$6)`, [
          workOrderId, tenantId, propertyIds[0], scope.rows[0].building_id, unitIds[0], primaryId,
        ]);
        await pool.query(`insert into airprop.management_action_links(
          id,tenant_id,workspace_id,mandate_request_id,property_id,unit_id,core_record_type,
          core_record_id,source_status_snapshot,linked_by,idempotency_key,request_hash
        ) values($1,$2,$3,$4,$5,$6,'maintenance.work_order',$7,'scheduled',$8,$9,$10)`, [
          actionId, tenantId, workspaceIds[0], mandateId, propertyIds[0], unitIds[0],
          workOrderId, primaryId, `airprop-link-${randomUUID()}`, '3'.repeat(64),
        ]);
        const beforeUnitRead = await counts(pool);
        assert.equal((await request(accessToken, contextId, workspaceIds[0])).status, 503);
        await pool.query(`update portfolio.units set building_id=$2,status='inactive' where id=$1`, [
          unitIds[0], (await pool.query('select id from portfolio.buildings where property_id=$1 limit 1', [propertyIds[1]])).rows[0].id,
        ]);
        const afterMove = await counts(pool);
        assert.deepEqual(afterMove, beforeUnitRead, 'unit move fixture must not be changed by the read');
        assert.equal((await request(accessToken, contextId, workspaceIds[0])).status, 503);
        assert.deepEqual(await counts(pool), afterMove, 'moved/revoked unit read must be zero-write');

        await pool.query(`revoke execute on function ${FUNCTION_SIGNATURE} from authenticated`);
        gateChanged = false;
        const gateClosed = await readJson(await request(accessToken, contextId, workspaceIds[1]));
        assert.equal(gateClosed.status, 503);
        assert.equal('view' in gateClosed.body, false);
      },
    });
  } finally {
    const cleanupErrors = [];
    if (server) try { await server.close(); } catch (error) { cleanupErrors.push(error); }
    if (secondary) try { await secondary.cleanup(); } catch (error) { cleanupErrors.push(error); }
    if (gateChanged) try {
      await pool.query(`revoke execute on function ${FUNCTION_SIGNATURE} from authenticated`);
    } catch (error) { cleanupErrors.push(error); }
    if (schemaChanged) try {
      await pool.query('revoke usage on schema customer_api from authenticated');
    } catch (error) { cleanupErrors.push(error); }
    try {
      if (gateInitial !== null) {
        const restored = await pool.query(`select
          has_function_privilege('authenticated',$1,'execute') as function_execute,
          has_schema_privilege('authenticated','customer_api','usage') as schema_usage`, [FUNCTION_SIGNATURE]);
        assert.equal(restored.rows[0].function_execute, gateInitial);
        assert.equal(restored.rows[0].schema_usage, schemaInitial);
      }
    } catch (error) { cleanupErrors.push(error); }
    await pool.end();
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'airprop_http_cleanup_failed');
  }

  assert.equal(receipt.aal2, 'verified');
  assert.equal(receipt.cleanup, 'verified');
  console.log(JSON.stringify({
    suite: 'AIRPROP-GATEWAY-READ-HTTP-02',
    auth: 'REAL_LOCAL_SUPABASE_AUTH_TOTP_AAL2',
    http: 'REAL_LOCAL_LOOPBACK_HTTP',
    provider: 'REAL_LOCAL_POSTGREST_ACTOR_BOUND',
    context_workspace_property_scope: 'PASS',
    authorized_empty_vs_unavailable: 'PASS',
    actor_session_switching: 'PASS',
    late_response_request_isolation: 'PASS',
    unit_move_revoke: 'FAIL_CLOSED_PENDING_CORE',
    execution_gate: 'TEMPORARY_LOCAL_EXACT_EXECUTE_REVOKED',
    read_effect: 'ZERO_WRITE',
    fixture_cleanup: 'AUTH_AUTHORITY_AND_GATE_VERIFIED_STACK_TEARDOWN_REQUIRED',
    production: 'NOT_RUN_NOT_PASS',
  }, null, 2));
}

await main();
