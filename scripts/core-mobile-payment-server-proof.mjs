import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// Offline checks are source regressions, never PostgreSQL/HTTP evidence.
async function sourceCheck() {
  const root = new URL('../supabase/migrations/', import.meta.url);
  const definitions = new Map();
  for (const file of (await readdir(root)).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, root), 'utf8');
    for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+((?:app_private|customer_api|payments)\.[\w]+)\s*\([\s\S]*?\bas\s+(\$\w*\$)([\s\S]*?)\2\s*;/gi)) {
      definitions.set(match[1].toLowerCase(), match[0]);
    }
  }
  const create = definitions.get('app_private.create_payment_intent_scoped_v1');
  const get = definitions.get('customer_api.get_payment_intent_v1');
  const instruction = definitions.get('payments.generate_scoped_bank_instruction_v1');
  assert.match(create, /request_identity_v1/, 'persist complete request evidence, not the outstanding-invoice projection');
  assert.match(create, /v_existing\.configuration_snapshot\s*->\s*'request_identity_v1'\s+is distinct from\s+v_request_identity/i);
  assert.match(create, /'method',\s*coalesce\(p_payment_method/i);
  assert.match(create, /jsonb_agg\(selected order by selected\)/i, 'selection order is immaterial; multiplicity and allocation amounts remain material');
  assert.match(create, /pg_advisory_xact_lock/);
  assert.ok(create.indexOf('pg_advisory_xact_lock') < create.indexOf('into v_existing'), 'serialize before looking up a possibly absent intent');
  assert.ok(create.indexOf('pg_advisory_xact_lock') < create.indexOf('m.starts_at'), 'check current authority after waiting for the key');
  assert.match(get, /security invoker/i);
  for (const body of [create, get]) {
    for (const predicate of ['m.starts_at', 'm.ends_at', 'g.starts_at', 'g.ends_at']) assert.ok(body.includes(predicate));
    assert.match(body, /assert_payments_module_entitled/);
  }
  assert.match(get, /payments\.intents\.read/);
  assert.match(get, /payment_unit_access_denied/);
  assert.match(instruction, /perform customer_api\.get_payment_intent_v1\(p_context_id, p_intent_id\)/i);
  console.log(JSON.stringify({ suite: 'core-mobile-payment-server-source-regressions', result: 'PASS',
    provenance: 'offline latest-definition checks only', connected: 'NOT_RUN_NOT_PASS' }));
}

if (process.argv.includes('--source-check')) await sourceCheck();
else if (process.argv.includes('--connected')) {
  const { runConnected } = await import('./lib/core-mobile-payment-fixture.mjs');
  await runConnected();
} else {
  throw new Error('Use --source-check or --connected (explicit disposable local opt-ins required)');
}
