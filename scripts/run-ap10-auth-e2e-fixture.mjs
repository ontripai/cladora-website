import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { runAp10AuthE2EFixture } from './lib/ap10-auth-e2e-fixture.mjs';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name.toLowerCase()}_required`);
  return value;
};

function safeDiagnostic(error) {
  const parts = [];
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current.message === 'string' && /^[a-z][a-z0-9_:-]{2,100}$/i.test(current.message)) {
      parts.push(current.message);
    }
    if (typeof current.code === 'string' && /^[a-z0-9_]{2,80}$/i.test(current.code)) {
      parts.push(`code_${current.code}`);
    }
    if (typeof current.table === 'string' && /^[a-z0-9_]{2,80}$/i.test(current.table)) {
      parts.push(`table_${current.table}`);
    }
    if (typeof current.constraint === 'string' && /^[a-z0-9_]{2,120}$/i.test(current.constraint)) {
      parts.push(`constraint_${current.constraint}`);
    }
    if (Number.isInteger(current.status)) parts.push(`status_${current.status}`);
    current = current.cause;
  }
  return [...new Set(parts)].join(':') || 'ap10_fixture_failed_without_safe_diagnostic';
}

const target = required('CLADORA_AP10_TARGET').toLowerCase();
const supabaseUrl = required('SUPABASE_URL');
const anonKey = required('SUPABASE_ANON_KEY');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const databaseUrl = required('SUPABASE_DB_URL');

const options = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};
const adminClient = createClient(supabaseUrl, serviceRoleKey, options);
const actorClient = createClient(supabaseUrl, anonKey, options);
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

try {
  const receipt = await runAp10AuthE2EFixture({
    target,
    supabaseUrl,
    projectRef: process.env.CLADORA_AP10_PROJECT_REF,
    productionProjectRef: process.env.CLADORA_PRODUCTION_PROJECT_REF,
    disposableDatabase: process.env.CLADORA_AP10_EPHEMERAL_DATABASE === '1',
    adminClient,
    actorClient,
    authorityDriver: createAp10CoreAuthorityDriver(pool),
    execute: async ({ client, contextId, workspaceIds, propertyIds, unitIds }) => {
      const { data, error } = await client.schema('customer_api').rpc('list_workspace_targets_v2', {
        p_context_id: contextId,
      });
      if (error) throw new Error('workspace_target_gateway_failed', { cause: error });
      const actual = (data ?? []).map((entry) => entry.workspace_id).sort();
      const expected = [...workspaceIds].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('workspace_authority_fixture_mismatch');
      }
      if (propertyIds.length !== 2 || unitIds.length !== 3) {
        throw new Error('airprop_resource_fixture_mismatch');
      }
      return Object.freeze({
        workspaceTargets: actual.length,
        properties: propertyIds.length,
        units: unitIds.length,
      });
    },
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} catch (error) {
  process.stderr.write(`::error title=AP10 synthetic fixture::${safeDiagnostic(error)}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
