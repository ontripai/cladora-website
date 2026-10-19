import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20261018140000_communications_private_conversation_workspace_binding_v1.sql';
const routePath = 'src/app/api/customer/v1/private-conversations/route.ts';
const migration = readFileSync(migrationPath, 'utf8');
const route = readFileSync(routePath, 'utf8');

assert.match(migration, /add column workspace_id uuid;/);
assert.match(migration, /foreign key \(workspace_id,tenant_id\)[\s\S]*references platform\.customer_workspaces\(id,tenant_id\)[\s\S]*on delete restrict;/);
assert.doesNotMatch(migration, /update communications\.private_conversations[\s\S]*set workspace_id/i);
assert.doesNotMatch(migration, /default[\s\S]{0,80}workspace_id|workspace_id[\s\S]{0,80}default/i);
assert.match(migration, /private_conversation_workspace_binding_is_immutable/);
assert.match(migration, /private_conversation_workspace_binding_required/);
assert.match(migration, /trusted_private_conversation_writer_required/);
assert.match(migration, /private_conversation_workspace_not_current/);
assert.match(migration, /communications-private-conversation-workspace\.v1/);
assert.doesNotMatch(migration, /resolve_private_message_subject_v1/);
assert.doesNotMatch(migration, /resolve_private_message_request_audience_v1/);
assert.doesNotMatch(migration,
  /^\s*revoke\s+(?:all|select|insert|update|delete).*\s+on\s+(?:table\s+)?communications\.private_/im);
assert.doesNotMatch(route, /CANONICAL_PRIVATE_CONVERSATION_WRITER_UNAVAILABLE/);
assert.match(route, /create_private_conversation_v2/);

for (const fixturePath of [
  'scripts/test-service-request-subject-link-postgres-v1.mjs',
  'scripts/test-service-request-subject-link-http-postgres-v1.mjs',
  'scripts/test-communications-private-message-provider-postgres-v1.mjs',
  'scripts/test-communications-private-message-request-audience-postgres-v1.mjs',
  'scripts/test-communications-private-message-version-concurrency-v1.mjs',
]) {
  const fixture = readFileSync(fixturePath, 'utf8');
  assert.match(fixture, /private_conversations[\s\S]{0,180}workspace_id/,
    `${fixturePath}: conversation fixtures must bind Workspace explicitly`);
}

console.log('Communications private conversation Workspace binding D5: PASS', {
  migration: migrationPath,
  route_state: 'POST_MAINTENANCE',
  resolver_owner: 'S1',
  acl_owner: 'S4',
});
