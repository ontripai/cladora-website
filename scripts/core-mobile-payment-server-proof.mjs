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
  const reader = definitions.get('app_private.read_payment_intent_scoped_v1');
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
  assert.match(get, /select app_private\.read_payment_intent_scoped_v1\(p_context_id, p_intent_id\)/i);
  assert.doesNotMatch(get, /generate_.*instruction|from identity\.|from payments\./i);
  assert.match(reader, /security definer/i);
  assert.match(reader, /stable\s+security definer\s+set search_path = pg_catalog/i);
  assert.match(reader, /m\.user_id = auth\.uid\(\)/i);
  assert.match(reader, /customer_mfa_required/);
  assert.match(reader, /payer_user_id IS DISTINCT FROM auth\.uid\(\)/i);
  assert.match(reader, /v_intent\.property_id=property\.id/);
  assert.doesNotMatch(reader, /configuration_snapshot|request_identity|vault\.|execute\s|set_config|pg_temp|insert into|update\s|delete from/i);
  for (const scope of ['tenant', 'property', 'building', 'unit']) assert.ok(reader.includes(`v.scope_type='${scope}'`));
  for (const body of [create, reader]) {
    for (const predicate of ['m.starts_at', 'm.ends_at', 'g.starts_at', 'g.ends_at']) assert.ok(body.includes(predicate));
    assert.match(body, /assert_payments_module_entitled/);
  }
  assert.match(reader, /payments\.intents\.read/);
  assert.match(reader, /payment_unit_access_denied/);
  assert.match(instruction, /perform customer_api\.get_payment_intent_v1\(p_context_id, p_intent_id\)/i);
  const candidate = await readFile(new URL('20261021045324_core_mobile_payment_exact_replay_current_authority_v1.sql', root), 'utf8');
  assert.match(candidate, /payment_read_helper_owner_mismatch/);
  assert.match(candidate, /REVOKE EXECUTE ON FUNCTION app_private\.read_payment_intent_scoped_v1\(uuid,uuid\) FROM PUBLIC, anon, service_role, authenticated/i);
  assert.match(candidate, /GRANT EXECUTE ON FUNCTION app_private\.read_payment_intent_scoped_v1\(uuid,uuid\) TO authenticated/i);
  assert.match(candidate, /pg_catalog\.aclexplode/);
  assert.match(candidate, /has_schema_privilege\('authenticated','app_private','USAGE'\)/);
  assert.doesNotMatch(candidate, /grant\s+(?:select|usage|all)|alter\s+(?:table|role|default privileges)|create\s+policy/i);
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  const exposed = config.match(/^schemas\s*=\s*\[([^\]]+)\]/m)?.[1];
  assert.ok(exposed && !exposed.includes('app_private'), 'private reader schema must remain unexposed');
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
