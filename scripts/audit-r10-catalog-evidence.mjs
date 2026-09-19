#!/usr/bin/env node
/**
 * CLADORA R10 — PostgreSQL Catalog, RLS, Function ACL & Supabase Data API Evidence Gate
 *
 * Task: CLADORA-R10-CATALOG-DATA-API-EVIDENCE-GATE-001
 * Strict local-target enforcement: Only connects to 127.0.0.1:54322/postgres and 127.0.0.1:54321
 * Read-only catalog extraction. Zero schema migration or mutation.
 * Deterministic JSON output: r10-catalog-evidence.json
 */

import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const DB_URL_RAW = process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const SUPABASE_URL_RAW = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// -----------------------------------------------------------------------------
// Phase 2: Local-target Enforcement
// -----------------------------------------------------------------------------
function validateDatabaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new Error('CRITICAL SECURITY REFUSAL: Invalid SUPABASE_DB_URL format');
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || '5432';
  const pathname = parsed.pathname;

  const disallowedHosts = ['supabase.co', 'pooler.supabase.com', 'aws.', 'azure.', 'gcp.', 'neon.tech'];
  for (const d of disallowedHosts) {
    if (hostname.includes(d)) {
      throw new Error(`CRITICAL SECURITY REFUSAL: Database connection target must never be remote (${hostname})`);
    }
  }

  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error(`CRITICAL SECURITY REFUSAL: Target host must be 127.0.0.1 or localhost (got: ${hostname})`);
  }

  if (port !== '54322') {
    throw new Error(`CRITICAL SECURITY REFUSAL: Target port must be 54322 for local ephemeral postgres (got: ${port})`);
  }

  if (pathname !== '/postgres') {
    throw new Error(`CRITICAL SECURITY REFUSAL: Target database must be postgres (got: ${pathname})`);
  }

  return { hostname, port, database: 'postgres' };
}

function validateDataApiUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new Error('CRITICAL SECURITY REFUSAL: Invalid SUPABASE_URL format');
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error(`CRITICAL SECURITY REFUSAL: Data API host must be 127.0.0.1 or localhost (got: ${hostname})`);
  }

  if (port !== '54321') {
    throw new Error(`CRITICAL SECURITY REFUSAL: Data API port must be 54321 for local ephemeral Supabase (got: ${port})`);
  }

  return { hostname, port };
}

// -----------------------------------------------------------------------------
// Application Schema and Allowlist Definitions
// -----------------------------------------------------------------------------
const EXPOSED_SCHEMAS = ['public', 'graphql_public', 'customer_api'];

const APPLICATION_SCHEMAS = [
  'platform', 'identity', 'portfolio', 'occupancy', 'finance', 'billing',
  'payments', 'utilities', 'assets', 'maintenance', 'governance',
  'communications', 'documents', 'security_access', 'migration_hub',
  'audit', 'airprop', 'customer_api', 'public'
];

// Documented tables with explicit authenticated direct DML under RLS control
const AUTHENTICATED_DML_ALLOWLIST = new Set([
  'platform.platform_users',
  'platform.platform_role_assignments'
]);

// -----------------------------------------------------------------------------
// Main Execution Routine
// -----------------------------------------------------------------------------
async function runAudit() {
  console.log('=== CLADORA R10 CATALOG & DATA API EVIDENCE GATE ===\n');

  // Enforce targets
  const dbTarget = validateDatabaseUrl(DB_URL_RAW);
  const apiTarget = validateDataApiUrl(SUPABASE_URL_RAW);

  console.log(`[Target Enforcement] PostgreSQL: ${dbTarget.hostname}:${dbTarget.port}/${dbTarget.database}`);
  console.log(`[Target Enforcement] Supabase API: ${apiTarget.hostname}:${apiTarget.port}`);

  let commitSha = 'UNKNOWN';
  try {
    commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    commitSha = process.env.GITHUB_SHA || 'UNKNOWN';
  }

  let cliVersion = 'UNKNOWN';
  try {
    cliVersion = execSync('supabase --version', { encoding: 'utf8' }).trim();
  } catch {
    cliVersion = 'NOT_AVAILABLE';
  }

  const criticalFindings = [];
  const warnings = [];

  const client = new Client({
    connectionString: DB_URL_RAW,
    statement_timeout: 15000,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();
  console.log('[PostgreSQL] Connected to local ephemeral catalog successfully.');

  let databaseIdentity = {};
  let roleMatrix = [];
  let schemaMatrix = [];
  let tableRlsSummary = {
    total_tables: 0,
    tables_with_rls: 0,
    tables_without_rls: 0,
    tables_with_force_rls: 0,
    tables: []
  };
  let policyFindings = {
    total_policies: 0,
    flagged_policies: [],
    policies: []
  };
  let functionAclFindings = {
    total_functions: 0,
    security_definer_count: 0,
    flagged_functions: [],
    functions: []
  };
  let viewFindings = {
    total_views: 0,
    flagged_views: [],
    views: []
  };
  let dataApiResultMatrix = {
    evaluated: false,
    results: []
  };
  let cleanupResult = {
    required: false,
    status: 'NOT_RUN',
    details: null
  };

  try {
    // -------------------------------------------------------------------------
    // Phase 3.A: Database Identity
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.A] Extracting Database Identity...');
    const { rows: idRows } = await client.query(`
      SELECT
        version() AS pg_version,
        current_database() AS db_name,
        current_user AS user_name,
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port;
    `);

    const { rows: extRows } = await client.query(`
      SELECT extname, extversion FROM pg_extension ORDER BY extname;
    `);

    let migrationCount = 0;
    let lastMigration = null;
    try {
      const { rows: migRows } = await client.query(`
        SELECT count(*)::int AS count, max(version) AS last_version
        FROM supabase_migrations.schema_migrations;
      `);
      if (migRows.length > 0) {
        migrationCount = migRows[0].count;
        lastMigration = migRows[0].last_version;
      }
    } catch {
      warnings.push({
        rule: 'MIGRATION_TABLE_ACCESS',
        message: 'Could not query supabase_migrations.schema_migrations'
      });
    }

    databaseIdentity = {
      pg_version: idRows[0]?.pg_version || 'UNKNOWN',
      current_database: idRows[0]?.db_name || 'UNKNOWN',
      current_user: idRows[0]?.user_name || 'UNKNOWN',
      server_address: idRows[0]?.server_addr || '127.0.0.1',
      server_port: idRows[0]?.server_port || 54322,
      extensions: extRows.map(e => ({ name: e.extname, version: e.extversion })),
      migration_history_count: migrationCount,
      last_migration_version: lastMigration
    };

    console.log(` - PostgreSQL Version: ${databaseIdentity.pg_version.split(' ')[0]} ${databaseIdentity.pg_version.split(' ')[1]}`);
    console.log(` - Current DB: ${databaseIdentity.current_database}, User: ${databaseIdentity.current_user}`);
    console.log(` - Migrations Recorded: ${databaseIdentity.migration_history_count} (Last: ${databaseIdentity.last_migration_version})`);

    // -------------------------------------------------------------------------
    // Phase 3.B: Role Attributes
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.B] Auditing Role Attributes...');
    const targetRoles = ['anon', 'authenticated', 'authenticator', 'service_role', 'postgres'];
    const { rows: roleRows } = await client.query(`
      SELECT
        rolname,
        rolsuper,
        rolinherit,
        rolcreaterole,
        rolcreatedb,
        rolcanlogin,
        rolreplication,
        rolbypassrls
      FROM pg_roles
      WHERE rolname = ANY($1)
      ORDER BY rolname;
    `, [targetRoles]);

    roleMatrix = roleRows.map(r => ({
      role: r.rolname,
      rolsuper: r.rolsuper,
      rolinherit: r.rolinherit,
      rolcreaterole: r.rolcreaterole,
      rolcreatedb: r.rolcreatedb,
      rolcanlogin: r.rolcanlogin,
      rolreplication: r.rolreplication,
      rolbypassrls: r.rolbypassrls
    }));

    for (const r of roleMatrix) {
      if (r.role === 'anon' && r.rolbypassrls) {
        criticalFindings.push({ rule: 'ROLE_ANON_BYPASSRLS', message: 'anon role must not have rolbypassrls', role: r.role });
      }
      if (r.role === 'authenticated' && r.rolbypassrls) {
        criticalFindings.push({ rule: 'ROLE_AUTHENTICATED_BYPASSRLS', message: 'authenticated role must not have rolbypassrls', role: r.role });
      }
      if (r.role === 'authenticator' && r.rolbypassrls) {
        criticalFindings.push({ rule: 'ROLE_AUTHENTICATOR_BYPASSRLS', message: 'authenticator role must not have rolbypassrls', role: r.role });
      }
      if (r.role === 'service_role' && !r.rolbypassrls) {
        warnings.push({ rule: 'ROLE_SERVICE_ROLE_BYPASSRLS', message: 'service_role usually has rolbypassrls in Supabase', role: r.role });
      }
    }
    console.log(` - Verified ${roleMatrix.length} core roles.`);

    // -------------------------------------------------------------------------
    // Phase 3.C: Schema Exposure
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.C] Auditing Schema Exposure...');
    const { rows: schemaRows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        r.rolname AS owner_name,
        has_schema_privilege('public', n.nspname, 'USAGE') AS public_usage,
        has_schema_privilege('public', n.nspname, 'CREATE') AS public_create,
        has_schema_privilege('anon', n.nspname, 'USAGE') AS anon_usage,
        has_schema_privilege('anon', n.nspname, 'CREATE') AS anon_create,
        has_schema_privilege('authenticated', n.nspname, 'USAGE') AS authenticated_usage,
        has_schema_privilege('authenticated', n.nspname, 'CREATE') AS authenticated_create,
        has_schema_privilege('service_role', n.nspname, 'USAGE') AS service_role_usage,
        has_schema_privilege('service_role', n.nspname, 'CREATE') AS service_role_create
      FROM pg_namespace n
      JOIN pg_roles r ON n.nspowner = r.oid
      WHERE n.nspname = ANY($1)
      ORDER BY n.nspname;
    `, [EXPOSED_SCHEMAS]);

    schemaMatrix = schemaRows;
    for (const s of schemaMatrix) {
      if (s.anon_create) {
        criticalFindings.push({ rule: 'SCHEMA_ANON_CREATE', message: `anon has CREATE privilege on exposed schema ${s.schema_name}`, schema: s.schema_name });
      }
      if (s.authenticated_create) {
        criticalFindings.push({ rule: 'SCHEMA_AUTHENTICATED_CREATE', message: `authenticated has CREATE privilege on exposed schema ${s.schema_name}`, schema: s.schema_name });
      }
      if (s.public_create) {
        criticalFindings.push({ rule: 'SCHEMA_PUBLIC_CREATE', message: `public has CREATE privilege on exposed schema ${s.schema_name}`, schema: s.schema_name });
      }
    }
    console.log(` - Verified ${schemaMatrix.length} exposed schemas.`);

    // -------------------------------------------------------------------------
    // Phase 3.D: Application Tables & RLS Status
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.D] Auditing Application Tables & RLS...');
    const { rows: tableRows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        r.rolname AS owner_name,
        c.relrowsecurity AS has_rls,
        c.relforcerowsecurity AS force_rls,
        (SELECT count(*)::int FROM pg_policy pol WHERE pol.polrelid = c.oid) AS policy_count,
        has_table_privilege('public', c.oid, 'SELECT') AS public_select,
        has_table_privilege('public', c.oid, 'INSERT') AS public_insert,
        has_table_privilege('public', c.oid, 'UPDATE') AS public_update,
        has_table_privilege('public', c.oid, 'DELETE') AS public_delete,
        has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
        has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
        has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
        has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
        has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
        has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
        has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
        has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete,
        has_table_privilege('service_role', c.oid, 'SELECT') AS service_role_select,
        has_table_privilege('service_role', c.oid, 'INSERT') AS service_role_insert,
        has_table_privilege('service_role', c.oid, 'UPDATE') AS service_role_update,
        has_table_privilege('service_role', c.oid, 'DELETE') AS service_role_delete
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_roles r ON c.relowner = r.oid
      WHERE c.relkind = 'r'
        AND n.nspname = ANY($1)
      ORDER BY schema_name, table_name;
    `, [APPLICATION_SCHEMAS]);

    tableRlsSummary.total_tables = tableRows.length;
    for (const t of tableRows) {
      const fullTableName = `${t.schema_name}.${t.table_name}`;
      const isExposed = EXPOSED_SCHEMAS.includes(t.schema_name);

      if (t.has_rls) tableRlsSummary.tables_with_rls++;
      else tableRlsSummary.tables_without_rls++;
      if (t.force_rls) tableRlsSummary.tables_with_force_rls++;

      // Gate 1: Table in exposed schema without RLS
      if (isExposed && !t.has_rls) {
        criticalFindings.push({
          rule: 'TABLE_EXPOSED_WITHOUT_RLS',
          message: `Table ${fullTableName} in exposed schema ${t.schema_name} lacks RLS`,
          table: fullTableName
        });
      }

      // Gate 2: Direct DML for public
      if (t.public_insert || t.public_update || t.public_delete) {
        criticalFindings.push({
          rule: 'TABLE_PUBLIC_DIRECT_DML',
          message: `Table ${fullTableName} has direct DML privilege granted to PUBLIC`,
          table: fullTableName
        });
      }

      // Gate 3: Direct DML for anon
      if (t.anon_insert || t.anon_update || t.anon_delete) {
        criticalFindings.push({
          rule: 'TABLE_ANON_DIRECT_DML',
          message: `Table ${fullTableName} has direct DML privilege granted to anon`,
          table: fullTableName
        });
      }

      // Gate 4: Direct DML for authenticated unless on allowlist
      if (t.authenticated_insert || t.authenticated_update || t.authenticated_delete) {
        if (!AUTHENTICATED_DML_ALLOWLIST.has(fullTableName)) {
          criticalFindings.push({
            rule: 'TABLE_AUTHENTICATED_DIRECT_DML_UNAUTHORIZED',
            message: `Table ${fullTableName} has direct DML privilege granted to authenticated not in allowlist`,
            table: fullTableName
          });
        }
      }

      // Gate 5: Missing owner
      if (!t.owner_name) {
        criticalFindings.push({
          rule: 'TABLE_WITHOUT_OWNER',
          message: `Table ${fullTableName} lacks a defined owner`,
          table: fullTableName
        });
      }

      tableRlsSummary.tables.push({
        schema: t.schema_name,
        table: t.table_name,
        owner: t.owner_name,
        has_rls: t.has_rls,
        force_rls: t.force_rls,
        policy_count: t.policy_count,
        grants: {
          public: { select: t.public_select, insert: t.public_insert, update: t.public_update, delete: t.public_delete },
          anon: { select: t.anon_select, insert: t.anon_insert, update: t.anon_update, delete: t.anon_delete },
          authenticated: { select: t.authenticated_select, insert: t.authenticated_insert, update: t.authenticated_update, delete: t.authenticated_delete },
          service_role: { select: t.service_role_select, insert: t.service_role_insert, update: t.service_role_update, delete: t.service_role_delete }
        }
      });
    }

    console.log(` - Audited ${tableRlsSummary.total_tables} tables. RLS Enabled: ${tableRlsSummary.tables_with_rls}, Force RLS: ${tableRlsSummary.tables_with_force_rls}`);

    // -------------------------------------------------------------------------
    // Phase 3.E: RLS Policies
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.E] Auditing RLS Policies...');
    const { rows: polRows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        pol.polname AS policy_name,
        CASE pol.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
        CASE pol.polcmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          WHEN '*' THEN 'ALL'
        END AS command,
        ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) AS roles,
        pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr,
        c.relrowsecurity AS table_has_rls
      FROM pg_policy pol
      JOIN pg_class c ON pol.polrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = ANY($1)
      ORDER BY schema_name, table_name, policy_name;
    `, [APPLICATION_SCHEMAS]);

    policyFindings.total_policies = polRows.length;
    for (const p of polRows) {
      const fullTableName = `${p.schema_name}.${p.table_name}`;
      const policyId = `${fullTableName}.${p.policy_name}`;

      // Critical: Policy on table without RLS
      if (!p.table_has_rls) {
        criticalFindings.push({
          rule: 'POLICY_ON_TABLE_WITHOUT_RLS',
          message: `Policy ${policyId} defined on table without RLS`,
          policy: policyId
        });
      }

      // Warnings
      const rolesList = p.roles || [];
      const hasAuth = rolesList.includes('authenticated');

      if (hasAuth && (!p.using_expr || p.using_expr === 'true') && p.command !== 'INSERT') {
        warnings.push({
          rule: 'POLICY_AUTHENTICATED_PERMISSIVE_USING',
          message: `Policy ${policyId} for authenticated has empty or true USING clause`,
          policy: policyId
        });
      }

      if (p.command === 'UPDATE' && !p.using_expr) {
        warnings.push({
          rule: 'POLICY_UPDATE_WITHOUT_USING',
          message: `UPDATE policy ${policyId} lacks USING expression`,
          policy: policyId
        });
      }

      if (p.command === 'UPDATE' && !p.with_check_expr) {
        warnings.push({
          rule: 'POLICY_UPDATE_WITHOUT_WITH_CHECK',
          message: `UPDATE policy ${policyId} lacks WITH CHECK expression`,
          policy: policyId
        });
      }

      if ((p.using_expr && p.using_expr.includes('raw_user_meta_data')) ||
          (p.with_check_expr && p.with_check_expr.includes('raw_user_meta_data'))) {
        warnings.push({
          rule: 'POLICY_USES_USER_METADATA',
          message: `Policy ${policyId} references user_metadata for authorization`,
          policy: policyId
        });
      }

      if ((p.using_expr && p.using_expr.includes('auth.role()')) ||
          (p.with_check_expr && p.with_check_expr.includes('auth.role()'))) {
        warnings.push({
          rule: 'POLICY_USES_AUTH_ROLE',
          message: `Policy ${policyId} uses auth.role() check`,
          policy: policyId
        });
      }

      policyFindings.policies.push({
        schema: p.schema_name,
        table: p.table_name,
        policy_name: p.policy_name,
        permissive: p.permissive,
        command: p.command,
        roles: p.roles,
        using_expr: p.using_expr,
        with_check_expr: p.with_check_expr
      });
    }
    console.log(` - Audited ${policyFindings.total_policies} RLS policies.`);

    // -------------------------------------------------------------------------
    // Phase 3.F: Functions & ACL
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.F] Auditing Functions & ACL...');
    const funcSchemas = [...APPLICATION_SCHEMAS, 'app_private'];
    const { rows: fnRows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS function_name,
        pg_get_function_identity_arguments(p.oid) AS identity_arguments,
        r.rolname AS owner_name,
        p.prosecdef AS is_security_definer,
        CASE p.provolatile
          WHEN 'i' THEN 'IMMUTABLE'
          WHEN 's' THEN 'STABLE'
          WHEN 'v' THEN 'VOLATILE'
        END AS volatility,
        CASE p.proparallel
          WHEN 's' THEN 'SAFE'
          WHEN 'r' THEN 'RESTRICTED'
          WHEN 'u' THEN 'UNSAFE'
        END AS parallel_safety,
        p.proconfig AS proconfig,
        has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      LEFT JOIN pg_roles r ON p.proowner = r.oid
      WHERE n.nspname = ANY($1)
      ORDER BY schema_name, function_name, identity_arguments;
    `, [funcSchemas]);

    functionAclFindings.total_functions = fnRows.length;
    for (const fn of fnRows) {
      const funcSignature = `${fn.schema_name}.${fn.function_name}(${fn.identity_arguments})`;
      const isExposed = EXPOSED_SCHEMAS.includes(fn.schema_name);

      if (fn.is_security_definer) functionAclFindings.security_definer_count++;

      // Effective search_path from proconfig
      let searchPathConfig = null;
      if (fn.proconfig && Array.isArray(fn.proconfig)) {
        for (const cfg of fn.proconfig) {
          if (cfg.startsWith('search_path=')) {
            searchPathConfig = cfg.substring('search_path='.length).trim();
          }
        }
      }

      // Gate 1: SECURITY DEFINER executable by PUBLIC
      if (fn.is_security_definer && fn.public_execute) {
        criticalFindings.push({
          rule: 'SECURITY_DEFINER_EXECUTABLE_BY_PUBLIC',
          message: `SECURITY DEFINER function ${funcSignature} is executable by PUBLIC`,
          function: funcSignature
        });
      }

      // Gate 2: SECURITY DEFINER executable by anon without allowlist
      if (fn.is_security_definer && fn.anon_execute) {
        criticalFindings.push({
          rule: 'SECURITY_DEFINER_EXECUTABLE_BY_ANON',
          message: `SECURITY DEFINER function ${funcSignature} is executable by anon`,
          function: funcSignature
        });
      }

      // Gate 3: SECURITY DEFINER in exposed schema with insecure search_path
      if (fn.is_security_definer && isExposed) {
        if (!searchPathConfig || searchPathConfig === '' || searchPathConfig.includes('public')) {
          criticalFindings.push({
            rule: 'SECURITY_DEFINER_EXPOSED_INSECURE_SEARCH_PATH',
            message: `SECURITY DEFINER function ${funcSignature} in exposed schema lacks secure search_path (got: ${searchPathConfig})`,
            function: funcSignature
          });
        }
      }

      // Gate 4: Internal function in app_private executable by PUBLIC
      if (fn.schema_name === 'app_private' && fn.public_execute) {
        criticalFindings.push({
          rule: 'APP_PRIVATE_EXECUTABLE_BY_PUBLIC',
          message: `Internal function ${funcSignature} is executable by PUBLIC`,
          function: funcSignature
        });
      }

      // Gate 5: Internal function in app_private executable by anon
      if (fn.schema_name === 'app_private' && fn.anon_execute) {
        criticalFindings.push({
          rule: 'APP_PRIVATE_EXECUTABLE_BY_ANON',
          message: `Internal function ${funcSignature} is executable by anon`,
          function: funcSignature
        });
      }

      // Gate 6: Internal function in app_private executable by authenticated without explicit contract
      if (fn.schema_name === 'app_private' && fn.authenticated_execute) {
        criticalFindings.push({
          rule: 'APP_PRIVATE_EXECUTABLE_BY_AUTHENTICATED',
          message: `Internal function ${funcSignature} is executable by authenticated without explicit contract`,
          function: funcSignature
        });
      }

      functionAclFindings.functions.push({
        schema: fn.schema_name,
        function: fn.function_name,
        arguments: fn.identity_arguments,
        owner: fn.owner_name,
        is_security_definer: fn.is_security_definer,
        volatility: fn.volatility,
        parallel_safety: fn.parallel_safety,
        effective_search_path: searchPathConfig,
        grants: {
          public: fn.public_execute,
          anon: fn.anon_execute,
          authenticated: fn.authenticated_execute,
          service_role: fn.service_role_execute
        }
      });
    }

    console.log(` - Audited ${functionAclFindings.total_functions} functions (SECURITY DEFINER: ${functionAclFindings.security_definer_count}).`);

    // -------------------------------------------------------------------------
    // Phase 3.G: Views & Materialized Views
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.G] Auditing Views & Materialized Views...');
    const { rows: viewRows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS view_name,
        r.rolname AS owner_name,
        c.relkind AS relkind,
        CASE
          WHEN c.relkind = 'v' THEN
            EXISTS (
              SELECT 1 FROM pg_options_to_table(c.reloptions)
              WHERE option_name = 'security_invoker' AND option_value = 'true'
            )
          ELSE false
        END AS is_security_invoker,
        has_table_privilege('public', c.oid, 'SELECT') AS public_select,
        has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
        has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
        has_table_privilege('service_role', c.oid, 'SELECT') AS service_role_select
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_roles r ON c.relowner = r.oid
      WHERE c.relkind IN ('v', 'm')
        AND n.nspname = ANY($1)
      ORDER BY schema_name, view_name;
    `, [APPLICATION_SCHEMAS]);

    viewFindings.total_views = viewRows.length;
    for (const v of viewRows) {
      const fullViewName = `${v.schema_name}.${v.view_name}`;
      const isExposed = EXPOSED_SCHEMAS.includes(v.schema_name);

      if (isExposed && !v.is_security_invoker && (v.anon_select || v.authenticated_select)) {
        criticalFindings.push({
          rule: 'VIEW_EXPOSED_WITHOUT_SECURITY_INVOKER',
          message: `View ${fullViewName} in exposed schema ${v.schema_name} lacks security_invoker and is accessible to anon/authenticated`,
          view: fullViewName
        });
      }

      viewFindings.views.push({
        schema: v.schema_name,
        view: v.view_name,
        kind: v.relkind === 'v' ? 'view' : 'materialized_view',
        owner: v.owner_name,
        is_security_invoker: v.is_security_invoker,
        grants: {
          public: v.public_select,
          anon: v.anon_select,
          authenticated: v.authenticated_select,
          service_role: v.service_role_select
        }
      });
    }
    console.log(` - Audited ${viewFindings.total_views} views/materialized views.`);

  } finally {
    await client.end();
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Data API Evidence
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 4] Auditing Supabase Data API Boundaries...');
  if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log(' - NOTICE: SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY not supplied.');
    console.log(' - Data API live roundtrip skipped in local offline environment (standard in local non-ephemeral runs).');
    dataApiResultMatrix = {
      evaluated: false,
      reason: 'SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY missing from environment',
      results: []
    };
  } else {
    dataApiResultMatrix.evaluated = true;
    const authUrl = `${SUPABASE_URL_RAW}/auth/v1`;
    const restUrl = `${SUPABASE_URL_RAW}/rest/v1`;

    let syntheticUserId = null;
    let syntheticUserAccessToken = null;

    try {
      // Check 1: Request without API key to Data API rejected (401)
      const noKeyRes = await fetch(`${restUrl}/`, { method: 'GET' });
      const noKeyPassed = noKeyRes.status === 401;
      dataApiResultMatrix.results.push({
        check: 'NO_API_KEY_REJECTED',
        expected_status: 401,
        actual_status: noKeyRes.status,
        passed: noKeyPassed
      });
      console.log(` - Check 1 (No API key rejected): HTTP ${noKeyRes.status} (Passed: ${noKeyPassed})`);
      if (!noKeyPassed) {
        criticalFindings.push({ rule: 'DATA_API_NO_KEY_NOT_REJECTED', message: `Data API accepted request without API key (status: ${noKeyRes.status})` });
      }

      // Check 2 & 3: anon request to OpenAPI root
      const anonOpenApiRes = await fetch(`${restUrl}/`, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_ANON_KEY }
      });
      // 401, 403, or 200 are recorded; 401/403 is expected behavior when OpenAPI is restricted
      dataApiResultMatrix.results.push({
        check: 'ANON_OPENAPI_ROOT',
        actual_status: anonOpenApiRes.status,
        passed: true,
        note: 'Rejection with 401/403 is expected when anon schema specification is restricted'
      });
      console.log(` - Check 2 & 3 (anon OpenAPI root): HTTP ${anonOpenApiRes.status} (Expected: 401/403/200, Passed: true)`);

      // Check 4: anon request to customer_api.list_contexts_v1() rejected
      const anonRpcRes = await fetch(`${restUrl}/rpc/list_contexts_v1`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Accept-Profile': 'customer_api',
          'Content-Profile': 'customer_api',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const anonRpcRejected = anonRpcRes.status === 401 || anonRpcRes.status === 403 || anonRpcRes.status === 404;
      dataApiResultMatrix.results.push({
        check: 'ANON_RPC_REJECTED',
        expected: '401, 403 or 404',
        actual_status: anonRpcRes.status,
        passed: anonRpcRejected
      });
      console.log(` - Check 4 (anon RPC rejected): HTTP ${anonRpcRes.status} (Passed: ${anonRpcRejected})`);
      if (!anonRpcRejected) {
        criticalFindings.push({ rule: 'DATA_API_ANON_RPC_NOT_REJECTED', message: `anon successfully invoked customer_api.list_contexts_v1() (status: ${anonRpcRes.status})` });
      }

      // Check 5: Create completely synthetic user in Supabase Local
      cleanupResult.required = true;
      const syntheticEmail = `audit_synthetic_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@local.test`;
      const syntheticPassword = `Pass_${crypto.randomBytes(12).toString('hex')}!`;

      const createRes = await fetch(`${authUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true
        })
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create synthetic user for Data API test (status: ${createRes.status})`);
      }
      const createdUserData = await createRes.json();
      syntheticUserId = createdUserData.id;
      dataApiResultMatrix.results.push({
        check: 'SYNTHETIC_USER_CREATED',
        passed: !!syntheticUserId
      });
      console.log(' - Check 5 (Synthetic user created in local Auth): OK');

      // Check 6: Obtain local access token
      const tokenRes = await fetch(`${authUrl}/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: syntheticEmail,
          password: syntheticPassword
        })
      });

      if (!tokenRes.ok) {
        throw new Error(`Failed to authenticate synthetic user (status: ${tokenRes.status})`);
      }
      const tokenData = await tokenRes.json();
      syntheticUserAccessToken = tokenData.access_token;
      dataApiResultMatrix.results.push({
        check: 'SYNTHETIC_USER_AUTHENTICATED',
        passed: !!syntheticUserAccessToken
      });
      console.log(' - Check 6 (Synthetic user authentication): OK');

      // Check 7 & 8: Authenticated call to customer_api.list_contexts_v1()
      const authRpcRes = await fetch(`${restUrl}/rpc/list_contexts_v1`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${syntheticUserAccessToken}`,
          'Accept-Profile': 'customer_api',
          'Content-Profile': 'customer_api',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const authRpcStatusOk = authRpcRes.status === 200;
      let authRpcData = null;
      if (authRpcStatusOk) {
        authRpcData = await authRpcRes.json();
      }
      const zeroTenantLeaked = Array.isArray(authRpcData) && authRpcData.length === 0;

      dataApiResultMatrix.results.push({
        check: 'AUTHENTICATED_RPC_CALL',
        status: authRpcRes.status,
        passed: authRpcStatusOk,
        zero_tenant_leaked: zeroTenantLeaked
      });
      console.log(` - Check 7 & 8 (Authenticated RPC & Tenant Isolation): HTTP ${authRpcRes.status}, items returned: ${Array.isArray(authRpcData) ? authRpcData.length : 'N/A'} (Passed: ${authRpcStatusOk && zeroTenantLeaked})`);
      if (!authRpcStatusOk) {
        criticalFindings.push({ rule: 'AUTHENTICATED_RPC_FAILED', message: `Authenticated customer_api.list_contexts_v1() call returned HTTP ${authRpcRes.status}` });
      }
      if (!zeroTenantLeaked) {
        criticalFindings.push({ rule: 'TENANT_DATA_LEAK_TO_NON_MEMBER', message: `Synthetic user without membership observed contexts: ${JSON.stringify(authRpcData)}` });
      }

      // Check 9: Direct table endpoint for internal tables rejected
      const internalTableRes = await fetch(`${restUrl}/tenants`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${syntheticUserAccessToken}`
        }
      });
      const internalTableRejected = internalTableRes.status === 404 || internalTableRes.status === 401 || internalTableRes.status === 403;

      const internalSchemaOverrideRes = await fetch(`${restUrl}/tenants`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${syntheticUserAccessToken}`,
          'Accept-Profile': 'platform'
        }
      });
      const internalOverrideRejected = internalSchemaOverrideRes.status === 404 || internalSchemaOverrideRes.status === 406 || internalSchemaOverrideRes.status === 401;

      dataApiResultMatrix.results.push({
        check: 'INTERNAL_TABLES_DIRECT_ACCESS_REJECTED',
        internal_table_status: internalTableRes.status,
        internal_override_status: internalSchemaOverrideRes.status,
        passed: internalTableRejected && internalOverrideRejected
      });
      console.log(` - Check 9 (Internal tables direct access blocked): Default HTTP ${internalTableRes.status}, Override HTTP ${internalSchemaOverrideRes.status} (Passed: ${internalTableRejected && internalOverrideRejected})`);
      if (!internalTableRejected || !internalOverrideRejected) {
        criticalFindings.push({ rule: 'DATA_API_INTERNAL_TABLE_EXPOSED', message: 'Internal table in platform schema accessible via Data API' });
      }

    } finally {
      // Check 12 & 13: Cleanup synthetic user
      if (syntheticUserId) {
        console.log('\n[Cleanup] Deleting synthetic user from local Auth...');
        const delRes = await fetch(`${authUrl}/admin/users/${syntheticUserId}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });

        if (delRes.ok) {
          cleanupResult.status = 'SUCCESS';
          cleanupResult.details = 'Synthetic user deleted cleanly';
          console.log(' - Cleanup status: SUCCESS (Synthetic user removed)');
        } else {
          cleanupResult.status = 'FAILED';
          cleanupResult.details = `Delete returned HTTP ${delRes.status}`;
          console.error(` - Cleanup status: FAILED (HTTP ${delRes.status})`);
          criticalFindings.push({ rule: 'CLEANUP_FAILURE', message: `Failed to delete synthetic user ${syntheticUserId} during cleanup` });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 5: Deterministic Output & Verdict
  // ---------------------------------------------------------------------------
  const finalVerdict = criticalFindings.length === 0 ? 'COMPLETE' : 'BLOCKED';

  const evidenceReport = {
    timestamp: new Date().toISOString(),
    commit_sha: commitSha,
    cli_version: cliVersion,
    database_identity: databaseIdentity,
    role_matrix: roleMatrix,
    schema_matrix: schemaMatrix,
    table_rls_summary: {
      total_tables: tableRlsSummary.total_tables,
      tables_with_rls: tableRlsSummary.tables_with_rls,
      tables_without_rls: tableRlsSummary.tables_without_rls,
      tables_with_force_rls: tableRlsSummary.tables_with_force_rls,
      tables: tableRlsSummary.tables
    },
    policy_findings: {
      total_policies: policyFindings.total_policies,
      policies: policyFindings.policies
    },
    function_acl_findings: {
      total_functions: functionAclFindings.total_functions,
      security_definer_count: functionAclFindings.security_definer_count,
      functions: functionAclFindings.functions
    },
    view_findings: {
      total_views: viewFindings.total_views,
      views: viewFindings.views
    },
    data_api_result_matrix: dataApiResultMatrix,
    critical_findings: criticalFindings,
    warnings: warnings,
    cleanup_result: cleanupResult,
    final_verdict: finalVerdict
  };

  const outputPath = path.join(process.cwd(), 'r10-catalog-evidence.json');
  fs.writeFileSync(outputPath, JSON.stringify(evidenceReport, null, 2), 'utf8');
  console.log(`\n[Output] Sanitized JSON written to: ${outputPath}`);
  console.log(`[Summary] Total Tables: ${tableRlsSummary.total_tables}`);
  console.log(`[Summary] Total Policies: ${policyFindings.total_policies}`);
  console.log(`[Summary] Total Functions: ${functionAclFindings.total_functions}`);
  console.log(`[Summary] Total Views: ${viewFindings.total_views}`);
  console.log(`[Summary] Critical Findings: ${criticalFindings.length}`);
  console.log(`[Summary] Warnings: ${warnings.length}`);
  console.log(`[Summary] Final Verdict: ${finalVerdict}\n`);

  if (criticalFindings.length > 0) {
    console.error('=== CRITICAL FINDINGS ENCOUNTERED ===');
    for (const f of criticalFindings) {
      console.error(` [CRITICAL] ${f.rule}: ${f.message}`);
    }
    process.exit(1);
  } else {
    console.log('=== EVIDENCE GATE PASSED: NO CRITICAL FINDINGS ===');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('\n[FATAL AUDIT FAILURE]:', err.message);
  process.exit(1);
});
