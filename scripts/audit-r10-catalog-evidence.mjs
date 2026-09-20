#!/usr/bin/env node
/**
 * CLADORA R10 — PostgreSQL Catalog, RLS, Function ACL & Supabase Data API Evidence Gate
 *
 * Tasks:
 *   - CLADORA-R10-CATALOG-DATA-API-EVIDENCE-GATE-001
 *   - CLADORA-R10-CATALOG-EVIDENCE-CLASSIFICATION-REMEDIATION-001
 *
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
  } catch {
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
  } catch {
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
// Dynamic Schema Extraction & Definitions
// -----------------------------------------------------------------------------
function extractExposedSchemas() {
  const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/schemas\s*=\s*\[([^\]]+)\]/);
    if (match) {
      return match[1]
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }
  return ['public', 'graphql_public', 'customer_api'];
}

const EXPOSED_SCHEMAS = extractExposedSchemas();

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
// Search Path Security Evaluation Helper
// -----------------------------------------------------------------------------
function evaluateSearchPathSecurity(searchPathStr, callerRole, schemaCreatePrivileges) {
  if (!searchPathStr || searchPathStr.trim() === '') {
    return { isSafe: false, reason: 'Empty or unset search_path on security definer function' };
  }

  const parts = searchPathStr.split(',').map(s => s.trim().toLowerCase());

  for (const part of parts) {
    if (part === '$user') {
      return { isSafe: false, reason: 'search_path contains insecure $user variable' };
    }
    // Check if caller has CREATE privilege on this schema
    const roleCanCreate = schemaCreatePrivileges?.[part]?.[callerRole] || false;
    if (roleCanCreate) {
      return { isSafe: false, reason: `Caller ${callerRole} has CREATE privilege on search_path schema ${part}` };
    }
  }

  return { isSafe: true, reason: 'search_path contains only safe/non-caller-writable schemas' };
}

// -----------------------------------------------------------------------------
// Main Execution Routine
// -----------------------------------------------------------------------------
async function runAudit() {
  console.log('=== CLADORA R10 CATALOG & DATA API EVIDENCE GATE ===');
  console.log('Task: CLADORA-R10-CATALOG-EVIDENCE-CLASSIFICATION-REMEDIATION-001\n');

  // Enforce local targets
  const dbTarget = validateDatabaseUrl(DB_URL_RAW);
  const apiTarget = validateDataApiUrl(SUPABASE_URL_RAW);

  console.log(`[Target Enforcement] PostgreSQL: ${dbTarget.hostname}:${dbTarget.port}/${dbTarget.database}`);
  console.log(`[Target Enforcement] Supabase API: ${apiTarget.hostname}:${apiTarget.port}`);
  console.log(`[Exposed Schemas (config.toml)]: ${EXPOSED_SCHEMAS.join(', ')}`);

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
  const highFindings = [];
  const hardeningFindings = [];
  const infoFindings = [];

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
  const schemaUsageMap = {};
  const schemaCreateMap = {};

  const tableRlsSummary = {
    total_tables: 0,
    tables_with_rls: 0,
    tables_without_rls: 0,
    tables_with_force_rls: 0,
    tables: []
  };

  const policyFindings = {
    total_policies: 0,
    flagged_policies: [],
    policies: []
  };

  const allFunctionRecords = [];
  const schemaUsageIntersectionMatrix = {};

  let appPrivateAudit = {};
  let customerApiGatewayClassification = {
    intended_authenticated_gateways: 0,
    unintended_anon_callable_gateways: 0,
    service_role_only_functions: 0,
    functions_requiring_manual_review: 0,
    internal_non_exposed_functions: 0,
    gateways: []
  };

  let viewFindings = {
    total_views: 0,
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
      infoFindings.push({
        rule: 'MIGRATION_TABLE_ACCESS',
        message: 'Could not query supabase_migrations.schema_migrations directly'
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
      if (r.role === 'service_role' && r.rolbypassrls) {
        infoFindings.push({ rule: 'ROLE_SERVICE_ROLE_BYPASSRLS', message: 'service_role has rolbypassrls as expected in Supabase architecture', role: r.role });
      }
    }
    console.log(` - Verified ${roleMatrix.length} core roles.`);

    // -------------------------------------------------------------------------
    // Phase 3.C: Schema Exposure & USAGE Mapping
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3.C] Auditing Schema Exposure & USAGE Grants...');
    const allQuerySchemas = [...new Set([...APPLICATION_SCHEMAS, 'app_private', ...EXPOSED_SCHEMAS])];
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
    `, [allQuerySchemas]);

    schemaMatrix = schemaRows;
    for (const s of schemaMatrix) {
      schemaUsageMap[s.schema_name] = {
        public: s.public_usage,
        anon: s.anon_usage,
        authenticated: s.authenticated_usage,
        service_role: s.service_role_usage
      };

      schemaCreateMap[s.schema_name] = {
        public: s.public_create,
        anon: s.anon_create,
        authenticated: s.authenticated_create,
        service_role: s.service_role_create
      };

      const isExposed = EXPOSED_SCHEMAS.includes(s.schema_name);
      if (isExposed) {
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
    }
    console.log(` - Audited ${schemaMatrix.length} schemas. Exposed: [${EXPOSED_SCHEMAS.join(', ')}]`);

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

      // Record INFO for lack of force RLS on non-exposed tables
      if (!t.force_rls && !isExposed) {
        infoFindings.push({
          rule: 'TABLE_FORCE_RLS_ABSENCE_NON_EXPOSED',
          message: `Table ${fullTableName} has standard RLS without FORCE RLS (non-exposed schema, owner-only bypass)`,
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
    // Phase 2, 3.F, 4, 5, 7, 8: Function Effective Callability & Risk Evaluation
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2 & 3.F] Auditing Functions Effective Callability & ACL...');
    const funcSchemas = [...new Set([...APPLICATION_SCHEMAS, 'app_private'])];
    const { rows: fnRows } = await client.query(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS function_name,
        pg_get_function_identity_arguments(p.oid) AS identity_arguments,
        r.rolname AS owner_name,
        p.prokind AS prokind,
        pg_get_function_result(p.oid) AS return_type,
        p.prosecdef AS is_security_definer,
        p.proacl::text AS explicit_acl,
        has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
        p.provolatile AS volatility,
        p.proparallel AS parallel_safety,
        p.proconfig AS proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      LEFT JOIN pg_roles r ON p.proowner = r.oid
      WHERE n.nspname = ANY($1)
      ORDER BY schema_name, function_name, identity_arguments;
    `, [funcSchemas]);

    // Initialize Schema-USAGE Intersection Matrix
    for (const s of funcSchemas) {
      schemaUsageIntersectionMatrix[s] = {
        total_functions: 0,
        execute_only: 0,
        execute_and_schema_usage: 0,
        execute_usage_and_exposed: 0,
        trigger_only: 0,
        effective_anon_callable: 0,
        effective_authenticated_callable: 0,
        effective_data_api_callable: 0
      };
    }

    const appPrivateCallableList = [];

    for (const fn of fnRows) {
      const funcSignature = `${fn.schema_name}.${fn.function_name}(${fn.identity_arguments})`;
      const schemaName = fn.schema_name;
      const isExposed = EXPOSED_SCHEMAS.includes(schemaName);
      const isTrigger = fn.return_type?.toLowerCase() === 'trigger';
      const isEventTrigger = fn.return_type?.toLowerCase() === 'event_trigger';
      const isNotTrigger = !isTrigger && !isEventTrigger;

      // Extract search_path
      let searchPathConfig = null;
      if (fn.proconfig && Array.isArray(fn.proconfig)) {
        for (const cfg of fn.proconfig) {
          if (cfg.startsWith('search_path=')) {
            searchPathConfig = cfg.substring('search_path='.length).trim();
          }
        }
      }

      // Schema usage per role
      const schemaUsage = {
        anon: schemaUsageMap[schemaName]?.anon || false,
        authenticated: schemaUsageMap[schemaName]?.authenticated || false,
        service_role: schemaUsageMap[schemaName]?.service_role || false,
        public: schemaUsageMap[schemaName]?.public || false
      };

      // Execution privileges per role
      const roleHasExecute = {
        anon: fn.anon_execute,
        authenticated: fn.authenticated_execute,
        service_role: fn.service_role_execute
      };

      // Effective SQL callable = role_has_execute AND role_has_schema_usage
      const effectiveSqlCallable = {
        anon: roleHasExecute.anon && schemaUsage.anon,
        authenticated: roleHasExecute.authenticated && schemaUsage.authenticated,
        service_role: roleHasExecute.service_role && schemaUsage.service_role
      };

      // Effective Data API callable = effectiveSqlCallable AND isExposed AND isNotTrigger
      const effectiveDataApiCallable = {
        anon: effectiveSqlCallable.anon && isExposed && isNotTrigger,
        authenticated: effectiveSqlCallable.authenticated && isExposed && isNotTrigger,
        service_role: effectiveSqlCallable.service_role && isExposed && isNotTrigger
      };

      // Inherited public execute: public has execute and no restrictive proacl
      const inheritedPublicExecute = fn.public_execute && (!fn.explicit_acl || !fn.explicit_acl.includes('='));

      // Search path security evaluation
      const searchPathAnonSec = evaluateSearchPathSecurity(searchPathConfig, 'anon', schemaCreateMap);
      const searchPathAuthSec = evaluateSearchPathSecurity(searchPathConfig, 'authenticated', schemaCreateMap);
      const searchPathIsSafe = searchPathAnonSec.isSafe && searchPathAuthSec.isSafe;

      // Update Schema-USAGE intersection matrix
      const matrixEntry = schemaUsageIntersectionMatrix[schemaName];
      if (matrixEntry) {
        matrixEntry.total_functions++;
        if (isTrigger || isEventTrigger) matrixEntry.trigger_only++;

        if (fn.public_execute && !schemaUsage.anon && !schemaUsage.public) {
          matrixEntry.execute_only++;
        }
        if (effectiveSqlCallable.authenticated || effectiveSqlCallable.anon) {
          matrixEntry.execute_and_schema_usage++;
        }
        if (effectiveDataApiCallable.authenticated || effectiveDataApiCallable.anon) {
          matrixEntry.execute_usage_and_exposed++;
        }
        if (effectiveSqlCallable.anon) matrixEntry.effective_anon_callable++;
        if (effectiveSqlCallable.authenticated) matrixEntry.effective_authenticated_callable++;
        if (effectiveDataApiCallable.authenticated || effectiveDataApiCallable.anon) matrixEntry.effective_data_api_callable++;
      }

      // Determine classification according to Phase 3
      let classification = 'INFO';
      let classificationReason = 'Standard internal function / service_role accessible';

      // 1. Check CRITICAL rules
      if (fn.is_security_definer && effectiveDataApiCallable.anon) {
        classification = 'CRITICAL';
        classificationReason = 'SECURITY DEFINER is effective_data_api_callable for anon without allowlist';
        criticalFindings.push({ rule: 'SECURITY_DEFINER_ANON_DATA_API_CALLABLE', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (fn.is_security_definer && effectiveSqlCallable.anon && isExposed) {
        classification = 'CRITICAL';
        classificationReason = 'SECURITY DEFINER is effective_sql_callable by anon in exposed schema with USAGE';
        criticalFindings.push({ rule: 'SECURITY_DEFINER_ANON_SQL_CALLABLE_EXPOSED', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (schemaName === 'app_private' && effectiveSqlCallable.anon) {
        classification = 'CRITICAL';
        classificationReason = 'Internal function in app_private is effective_sql_callable by anon';
        criticalFindings.push({ rule: 'APP_PRIVATE_ANON_CALLABLE', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (fn.is_security_definer && (effectiveDataApiCallable.anon || effectiveDataApiCallable.authenticated) && !searchPathIsSafe) {
        classification = 'CRITICAL';
        classificationReason = `Callable SECURITY DEFINER has unsafe search_path: ${searchPathAnonSec.reason}`;
        criticalFindings.push({ rule: 'SECURITY_DEFINER_CALLABLE_UNSAFE_SEARCH_PATH', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      }
      // 2. Check HIGH rules
      else if (fn.is_security_definer && effectiveDataApiCallable.authenticated && schemaName !== 'customer_api') {
        classification = 'HIGH';
        classificationReason = 'SECURITY DEFINER in non-customer_api schema is effective_data_api_callable for authenticated';
        highFindings.push({ rule: 'SECURITY_DEFINER_NON_GATEWAY_AUTHENTICATED_CALLABLE', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (schemaName === 'app_private' && effectiveSqlCallable.authenticated) {
        classification = 'HIGH';
        classificationReason = 'Internal function in app_private has effective SQL callability for authenticated';
        highFindings.push({ rule: 'APP_PRIVATE_AUTHENTICATED_CALLABLE', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if ((effectiveSqlCallable.anon || effectiveSqlCallable.authenticated) && fn.is_security_definer && !searchPathConfig) {
        classification = 'HIGH';
        classificationReason = 'Callable SECURITY DEFINER function lacks explicit search_path config';
        highFindings.push({ rule: 'CALLABLE_SECURITY_DEFINER_NO_SEARCH_PATH', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      }
      // 3. Check HARDENING rules
      else if (fn.public_execute && !schemaUsage.anon && !schemaUsage.public) {
        classification = 'HARDENING';
        classificationReason = 'Catalog contains PUBLIC EXECUTE, but schema USAGE is denied to anon/public (call path closed)';
        hardeningFindings.push({ rule: 'PUBLIC_EXECUTE_WITHOUT_SCHEMA_USAGE', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (!isExposed && (fn.public_execute || fn.anon_execute)) {
        classification = 'HARDENING';
        classificationReason = 'Non-exposed internal function has catalog execute privilege, but schema is not exposed to Data API';
        hardeningFindings.push({ rule: 'INTERNAL_FUNCTION_CATALOG_EXECUTE_UNEXPOSED', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (isTrigger || isEventTrigger) {
        classification = 'HARDENING';
        classificationReason = 'Function is a trigger / event trigger; direct invocation is prevented by PostgreSQL engine';
        hardeningFindings.push({ rule: 'TRIGGER_FUNCTION_CATALOG_ACL', message: `${funcSignature}: ${classificationReason}`, function: funcSignature });
      } else if (schemaName === 'customer_api' && effectiveDataApiCallable.authenticated) {
        classification = 'INFO';
        classificationReason = 'Intended customer_api gateway wrapper callable by authenticated under tenant session';
      }

      // Customer API gateway tracking
      if (schemaName === 'customer_api') {
        if (effectiveDataApiCallable.anon) {
          customerApiGatewayClassification.unintended_anon_callable_gateways++;
        } else if (effectiveDataApiCallable.authenticated) {
          customerApiGatewayClassification.intended_authenticated_gateways++;
        } else if (roleHasExecute.service_role && !roleHasExecute.authenticated) {
          customerApiGatewayClassification.service_role_only_functions++;
        } else {
          customerApiGatewayClassification.functions_requiring_manual_review++;
        }
        customerApiGatewayClassification.gateways.push({
          function: funcSignature,
          is_security_definer: fn.is_security_definer,
          anon_data_api: effectiveDataApiCallable.anon,
          auth_data_api: effectiveDataApiCallable.authenticated,
          search_path: searchPathConfig
        });
      } else {
        customerApiGatewayClassification.internal_non_exposed_functions++;
      }

      // app_private specific tracking
      if (schemaName === 'app_private') {
        if (effectiveSqlCallable.anon || effectiveSqlCallable.authenticated) {
          appPrivateCallableList.push({
            signature: funcSignature,
            is_security_definer: fn.is_security_definer,
            callable_by_anon: effectiveSqlCallable.anon,
            callable_by_authenticated: effectiveSqlCallable.authenticated,
            search_path: searchPathConfig,
            classification,
            classificationReason
          });
        }
      }

      allFunctionRecords.push({
        schema_name: fn.schema_name,
        function_name: fn.function_name,
        identity_arguments: fn.identity_arguments,
        owner: fn.owner_name,
        prokind: fn.prokind,
        return_type: fn.return_type,
        security_definer: fn.is_security_definer,
        explicit_acl: fn.explicit_acl || null,
        inherited_public_execute: inheritedPublicExecute,
        role_has_execute: roleHasExecute,
        role_has_schema_usage: schemaUsage,
        schema_is_data_api_exposed: isExposed,
        function_is_trigger: isTrigger,
        function_is_event_trigger: isEventTrigger,
        effective_sql_callable: effectiveSqlCallable,
        effective_data_api_callable: effectiveDataApiCallable,
        search_path: searchPathConfig,
        search_path_is_safe: searchPathIsSafe,
        classification,
        classification_reason: classificationReason
      });
    }

    // Populate app_private audit
    appPrivateAudit = {
      schema_usage: {
        public: schemaUsageMap['app_private']?.public || false,
        anon: schemaUsageMap['app_private']?.anon || false,
        authenticated: schemaUsageMap['app_private']?.authenticated || false,
        service_role: schemaUsageMap['app_private']?.service_role || false
      },
      callable_security_definer_count: appPrivateCallableList.filter(f => f.is_security_definer).length,
      callable_functions_count: appPrivateCallableList.length,
      callable_functions: appPrivateCallableList
    };

    console.log(` - Audited ${allFunctionRecords.length} functions.`);
    console.log(` - Functions Critical: ${criticalFindings.length}, High: ${highFindings.length}, Hardening: ${hardeningFindings.length}`);

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
  // Phase 4 & Phase 6: Data API Evidence & No-Key Classification
  // ---------------------------------------------------------------------------
  console.log('\n[Phase 4 & 6] Auditing Supabase Data API Boundaries...');
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
      // Check 1: Root /rest/v1/ behavior classification
      console.log(' - Testing Root /rest/v1/ without API key...');
      const rootRes = await fetch(`${restUrl}/`, { method: 'GET' });
      const rootContentType = rootRes.headers.get('content-type') || '';
      let rootBodyCategory = 'UNKNOWN';
      let rowDataExists = false;
      let rootText = '';
      try {
        rootText = await rootRes.text();
        const rootJson = JSON.parse(rootText);
        if (rootJson.openapi || rootJson.swagger || rootJson.paths) {
          rootBodyCategory = 'OPENAPI_DOCUMENT';
        } else if (Array.isArray(rootJson) && rootJson.length > 0) {
          rootBodyCategory = 'ROW_DATA';
          rowDataExists = true;
        }
      } catch {
        rootBodyCategory = 'NON_JSON_RESPONSE';
      }

      dataApiResultMatrix.results.push({
        check: 'OPENAPI_ROOT_NO_KEY',
        http_status: rootRes.status,
        content_type: rootContentType,
        body_category: rootBodyCategory,
        row_data_exists: rowDataExists,
        protected_operation_succeeded: false,
        classification: 'INFO',
        passed: !rowDataExists
      });
      console.log(`   Status: HTTP ${rootRes.status}, Body: ${rootBodyCategory}, Row Data Exists: ${rowDataExists} (Classification: INFO)`);

      if (rowDataExists) {
        criticalFindings.push({ rule: 'DATA_API_ROOT_LEAKED_ROWS', message: 'Root /rest/v1/ without API key returned table/customer rows' });
      }

      // Check 2: No API key call to customer_api.list_contexts_v1()
      console.log(' - Testing protected RPC without API key...');
      const noKeyRpcRes = await fetch(`${restUrl}/rpc/list_contexts_v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Profile': 'customer_api',
          'Content-Profile': 'customer_api'
        },
        body: JSON.stringify({})
      });
      const noKeyRpcRejected = noKeyRpcRes.status === 401 || noKeyRpcRes.status === 403 || noKeyRpcRes.status === 404;
      dataApiResultMatrix.results.push({
        check: 'NO_KEY_PROTECTED_RPC_REJECTED',
        expected: '401, 403 or 404',
        actual_status: noKeyRpcRes.status,
        passed: noKeyRpcRejected
      });
      console.log(`   Status: HTTP ${noKeyRpcRes.status} (Passed: ${noKeyRpcRejected})`);
      if (!noKeyRpcRejected) {
        criticalFindings.push({ rule: 'NO_KEY_RPC_SUCCEEDED', message: `Protected RPC customer_api.list_contexts_v1() succeeded without API key (HTTP ${noKeyRpcRes.status})` });
      }

      // Check 3: No-key direct internal table endpoint
      console.log(' - Testing internal table endpoint without API key...');
      const noKeyInternalTableRes = await fetch(`${restUrl}/tenants`, { method: 'GET' });
      const noKeyTableRejected = noKeyInternalTableRes.status === 401 || noKeyInternalTableRes.status === 404;
      dataApiResultMatrix.results.push({
        check: 'NO_KEY_INTERNAL_TABLE_REJECTED',
        expected: '401 or 404',
        actual_status: noKeyInternalTableRes.status,
        passed: noKeyTableRejected
      });
      console.log(`   Status: HTTP ${noKeyInternalTableRes.status} (Passed: ${noKeyTableRejected})`);
      if (!noKeyTableRejected) {
        criticalFindings.push({ rule: 'NO_KEY_INTERNAL_TABLE_EXPOSED', message: `Internal table accessed without API key (HTTP ${noKeyInternalTableRes.status})` });
      }

      // Check 4: anon request to customer_api.list_contexts_v1() (with apikey only, no Bearer)
      console.log(' - Testing protected RPC with anon key (no Authorization)...');
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
        check: 'ANON_KEY_RPC_REJECTED',
        expected: '401, 403 or 404',
        actual_status: anonRpcRes.status,
        passed: anonRpcRejected
      });
      console.log(`   Status: HTTP ${anonRpcRes.status} (Passed: ${anonRpcRejected})`);
      if (!anonRpcRejected) {
        criticalFindings.push({ rule: 'DATA_API_ANON_RPC_NOT_REJECTED', message: `anon successfully invoked customer_api.list_contexts_v1() (status: ${anonRpcRes.status})` });
      }

      // Check 5: Create completely synthetic user in Supabase Local
      console.log(' - Creating synthetic user in local Auth...');
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
      console.log('   OK: Synthetic user created.');

      // Check 6: Obtain local access token
      console.log(' - Authenticating synthetic user...');
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
      console.log('   OK: Synthetic user authenticated.');

      // Check 7 & 8: Authenticated call to customer_api.list_contexts_v1() & tenant isolation
      console.log(' - Testing authenticated RPC invocation and tenant isolation...');
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
      console.log(`   Status: HTTP ${authRpcRes.status}, items returned: ${Array.isArray(authRpcData) ? authRpcData.length : 'N/A'} (Zero Tenant Leaked: ${zeroTenantLeaked})`);
      if (!authRpcStatusOk) {
        criticalFindings.push({ rule: 'AUTHENTICATED_RPC_FAILED', message: `Authenticated customer_api.list_contexts_v1() call returned HTTP ${authRpcRes.status}` });
      }
      if (!zeroTenantLeaked) {
        criticalFindings.push({ rule: 'TENANT_DATA_LEAK_TO_NON_MEMBER', message: `Synthetic user without membership observed contexts: ${JSON.stringify(authRpcData)}` });
      }

      // Check 9: Direct table endpoint for internal tables rejected
      console.log(' - Testing internal table endpoint protection...');
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
      console.log(`   Default HTTP ${internalTableRes.status}, Override HTTP ${internalSchemaOverrideRes.status} (Passed: ${internalTableRejected && internalOverrideRejected})`);
      if (!internalTableRejected || !internalOverrideRejected) {
        criticalFindings.push({ rule: 'DATA_API_INTERNAL_TABLE_EXPOSED', message: 'Internal table in platform schema accessible via Data API' });
      }

    } finally {
      // Cleanup synthetic user
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
  // Phase 9: Output and Exit Rules
  // ---------------------------------------------------------------------------
  const effectiveAnonCallableCount = allFunctionRecords.filter(f => f.effective_sql_callable.anon).length;
  const effectiveAuthenticatedCallableCount = allFunctionRecords.filter(f => f.effective_sql_callable.authenticated).length;
  const effectiveDataApiCallableCount = allFunctionRecords.filter(f => f.effective_data_api_callable.authenticated || f.effective_data_api_callable.anon).length;
  const nonExposedPublicExecuteCount = allFunctionRecords.filter(f => !f.schema_is_data_api_exposed && f.inherited_public_execute).length;
  const triggerExecuteCount = allFunctionRecords.filter(f => f.function_is_trigger || f.function_is_event_trigger).length;
  const appPrivateEffectiveCallableCount = appPrivateAudit.callable_functions_count || 0;

  let finalVerdict;
  if (criticalFindings.length === 0 && highFindings.length === 0) {
    finalVerdict = 'COMPLETE';
  } else if (criticalFindings.length === 0 && highFindings.length > 0) {
    finalVerdict = 'COMPLETE-WITH-HIGH-FINDINGS';
  } else {
    finalVerdict = 'BLOCKED';
  }

  const evidenceReport = {
    timestamp: new Date().toISOString(),
    commit_sha: commitSha,
    cli_version: cliVersion,
    counters: {
      critical_count: criticalFindings.length,
      high_count: highFindings.length,
      hardening_count: hardeningFindings.length,
      info_count: infoFindings.length,
      effective_anon_callable_count: effectiveAnonCallableCount,
      effective_authenticated_callable_count: effectiveAuthenticatedCallableCount,
      effective_data_api_callable_count: effectiveDataApiCallableCount,
      non_exposed_public_execute_count: nonExposedPublicExecuteCount,
      trigger_execute_count: triggerExecuteCount,
      app_private_effective_callable_count: appPrivateEffectiveCallableCount
    },
    database_identity: databaseIdentity,
    role_matrix: roleMatrix,
    schema_matrix: schemaMatrix,
    schema_usage_intersection_matrix: schemaUsageIntersectionMatrix,
    app_private_audit: appPrivateAudit,
    customer_api_gateway_classification: customerApiGatewayClassification,
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
    function_callability_matrix: allFunctionRecords,
    view_findings: {
      total_views: viewFindings.total_views,
      views: viewFindings.views
    },
    data_api_result_matrix: dataApiResultMatrix,
    critical_findings: criticalFindings,
    high_findings: highFindings,
    hardening_findings: hardeningFindings,
    info_findings: infoFindings,
    cleanup_result: cleanupResult,
    final_verdict: finalVerdict
  };

  const outputPath = path.join(process.cwd(), 'r10-catalog-evidence.json');
  fs.writeFileSync(outputPath, JSON.stringify(evidenceReport, null, 2), 'utf8');
  console.log(`\n[Output] Sanitized JSON written to: ${outputPath}`);
  console.log(`[Summary] Total Tables: ${tableRlsSummary.total_tables}`);
  console.log(`[Summary] Total Policies: ${policyFindings.total_policies}`);
  console.log(`[Summary] Total Functions: ${allFunctionRecords.length}`);
  console.log(`[Summary] Critical Count: ${criticalFindings.length}`);
  console.log(`[Summary] High Count: ${highFindings.length}`);
  console.log(`[Summary] Hardening Count: ${hardeningFindings.length}`);
  console.log(`[Summary] Info Count: ${infoFindings.length}`);
  console.log(`[Summary] Effective Anon Callable Functions: ${effectiveAnonCallableCount}`);
  console.log(`[Summary] Effective Authenticated Callable Functions: ${effectiveAuthenticatedCallableCount}`);
  console.log(`[Summary] Effective Data API Callable Functions: ${effectiveDataApiCallableCount}`);
  console.log(`[Summary] App Private Effective Callable Functions: ${appPrivateEffectiveCallableCount}`);
  console.log(`[Summary] Final Verdict: ${finalVerdict}\n`);

  if (criticalFindings.length > 0) {
    console.error('=== CRITICAL FINDINGS ENCOUNTERED (EXIT CODE 1) ===');
    for (const f of criticalFindings) {
      console.error(` [CRITICAL] ${f.rule}: ${f.message}`);
    }
    process.exit(1);
  } else {
    console.log('=== EVIDENCE GATE PASSED: ZERO CRITICAL FINDINGS (EXIT CODE 0) ===');
    if (highFindings.length > 0) {
      console.log(`=== NOTE: ${highFindings.length} HIGH FINDINGS RECORDED FOR ARCHITECTURAL DECISION ===`);
    }
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('\n[FATAL AUDIT FAILURE]:', err.message);
  process.exit(1);
});
