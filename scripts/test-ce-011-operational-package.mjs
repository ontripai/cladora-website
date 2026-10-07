import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/proposals/ce_011_event_interest_operational_v1.sql', 'utf8');
const route = fs.readFileSync('src/app/api/customer/v1/community/events/route.ts', 'utf8');

for (const table of ['events', 'event_occurrences', 'event_audience_roles', 'event_audience_members', 'event_interests', 'event_attendance', 'event_command_receipts']) {
  assert.match(sql, new RegExp(`create table community\\.${table}\\(`));
}
for (const permission of ['events.event.read', 'events.event.publish', 'events.event.cancel', 'events.interest.manage_self', 'events.attendance.record', 'events.attendance.correct']) {
  assert.match(sql, new RegExp(permission.replaceAll('.', '\\.')));
}
for (const command of ['create_event', 'publish_event', 'cancel_event', 'register_interest', 'withdraw_interest', 'record_attendance', 'correct_attendance']) {
  assert.match(sql, new RegExp(command));
}
assert.match(sql, /app_private\.resolve_workspace_native_context_v2/);
assert.match(sql, /app_private\.check_workspace_native_permission_v2/);
assert.match(sql, /insert into platform\.idempotency_keys/);
assert.match(sql, /insert into audit\.events/);
assert.match(sql, /insert into platform\.outbox_events/);
assert.match(sql, /alter table community\.%I enable row level security/);
assert.match(sql, /ce_receipt_immutable_v1/);
assert.match(sql, /v_receipt\.context_id<>v_context/);
assert.match(sql, /v_receipt\.membership_id<>v_scope\.membership_id/);
assert.match(sql, /v_receipt\.represented_party_id is distinct from v_scope\.represented_party_id/);
assert.match(sql, /response_json\|\|jsonb_build_object\('replayed',true\)/);
assert.match(sql, /app_private\.ce_event_audience_eligible_v1\(v_event_id,am\.membership_id\)/);
assert.match(sql, /foreign key\(tenant_id,workspace_id,event_id,occurrence_id\)/);
assert.doesNotMatch(sql, /create table (?:community\.)?(?:idempotency|audit|outbox)/i);
assert.match(route, /getClaims\(\)/);
assert.match(route, /hasTrustedMutationOrigin/);
assert.match(route, /parseJsonWithLimit<unknown>\(request, 16 \* 1024\)/);
assert.match(route, /eventCommandSchema\.safeParse/);
assert.match(route, /schema\('customer_api'\)/);
assert.match(route, /command_ce_event_v1/);
assert.match(route, /read_ce_events_v1/);
assert.doesNotMatch(route, /service_role|createAdminClient|supabase\/admin/);

console.log('CE-011 operational package static acceptance passed: domain tables, RLS lock, official permissions, seven commands, shared idempotency/audit/outbox reuse, authenticated server API and no service-role path.');
