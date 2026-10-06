import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20261006080000_workspace_role_assignment_supervisor_validity_v1.sql',
  'utf8',
);
const assignmentMigration = fs.readFileSync(
  'supabase/migrations/20260918120000_workspace_local_roles_permissions.sql',
  'utf8',
);

assert.match(migration, /^begin;/m);
assert.match(migration, /^commit;/m);
assert.match(migration, /before insert on platform\.workspace_member_roles/i);
assert.match(migration, /m\.id = new\.assigned_by_membership_id[\s\S]*?m\.user_id = new\.assigned_by_user_id/i,
  'The responsible manager membership and user must match and remain active');
assert.match(migration, /select min\(x\.ends_at\)[\s\S]*?v_target_end[\s\S]*?v_manager_end[\s\S]*?v_role_end[\s\S]*?v_property_end/i,
  'Delegated validity is bounded by recipient, manager, role, and property');
assert.match(migration, /new\.valid_to := least\(new\.valid_to, v_ceiling\)/i,
  'A caller cannot extend a child role beyond the manager validity ceiling');
assert.match(migration, /after update of status, ends_at on identity\.memberships/i,
  'Ending or shortening manager membership invokes descendant validity enforcement');
assert.match(migration, /assigned_by_membership_id = old\.id[\s\S]*?WORKSPACE_ROLE_ASSIGNMENT_SUPERVISOR_CAPPED/i,
  'Only assignments made by that manager are shortened and the automatic action is audited');
assert.match(migration, /new\.valid_to >= old\.valid_to[\s\S]*?workspace_member_role_already_revoked/i,
  'Already-ended assignments can only be shortened, never extended or reopened');
assert.match(assignmentMigration, /assigned_by_user_id,[\s\S]*?assigned_by_membership_id/i,
  'The assignment retains manager accountability provenance');
assert.match(assignmentMigration, /WORKSPACE_ROLE_ASSIGNED/,
  'Role assignments produce an audit event');
const integration = fs.readFileSync('supabase/tests/135_workspace_role_assignment_airprop_flow.test.sql', 'utf8');
assert.match(integration, /delegated role ends with the assigning manager term/i,
  'Database integration test verifies parent-role validity ceiling');
console.log('Workspace role supervisor validity contract passed.');
