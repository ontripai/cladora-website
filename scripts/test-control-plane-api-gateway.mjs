import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const migration = readFileSync(join(root, 'supabase/migrations/20260923161000_control_plane_api_gateway.sql'), 'utf8');
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
const routesRoot = join(root, 'src/app/api/platform/v1');

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const routeSource = files(routesRoot)
  .filter((path) => path.endsWith('route.ts'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

assert.match(config, /schemas\s*=\s*\[[^\]]*"customer_api"/);
assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"platform"/);
assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"audit"/);

for (const view of [
  'platform_users_v1', 'platform_role_assignments_v1', 'platform_customer_assignments_v1',
  'customer_workspaces_v1', 'subscription_plans_v1', 'provisioning_runs_v1',
  'provisioning_tasks_v1', 'workspace_contracts_v1', 'workspace_entitlements_v1',
]) {
  assert.match(migration, new RegExp(`view customer_api\\.${view}\\nwith \\(security_invoker = true\\)`));
}

for (const rpc of [
  'get_control_plane_overview_v1', 'list_support_access_v1', 'list_support_workspaces_v1',
  'list_control_plane_audit_events_v1', 'get_plan_dependency_counts_v1',
  'list_provisionable_workspaces_v1', 'create_provisioning_run_v1',
  'grant_customer_assignment_v1', 'create_customer_workspace_v1',
  'get_retention_operations_v1', 'preview_retention_workers_v1',
]) {
  assert.match(migration, new RegExp(`function customer_api\\.${rpc}\\(`));
}

assert.match(migration, /revoke all on function app_private\.assert_control_plane_gateway_access_v1\(\) from public, anon, service_role/);
assert.match(migration, /grant execute on function app_private\.assert_control_plane_gateway_access_v1\(\) to authenticated/);
assert.match(migration, /revoke all on function %s from public, anon, service_role/);
assert.match(migration, /grant execute on function %s to authenticated/);
assert.doesNotMatch(routeSource, /\.schema\(['"](?:platform|audit)['"]\)/);
assert.doesNotMatch(routeSource, /\bsupabase\.rpc\(/);

console.log('Control-plane API gateway checks passed.');
