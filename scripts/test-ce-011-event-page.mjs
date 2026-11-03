import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyEventResponse,
  eventReadResponseSchema,
  newEventCommandIdentity,
  toEventInterestView,
} from '../src/lib/community/event-interest-client.ts';
import { eventCommandSchema } from '../src/lib/community/event-interest-schema.ts';
import { CANONICAL_ROLES, isRouteAllowedForPersona } from '../src/lib/customer/access-matrix.ts';
import { classifyCustomerRoute } from '../src/lib/customer/route-classifier.ts';

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const item = {
  event_id: id(1), occurrence_id: id(2), workspace_id: id(3), title: 'Community briefing',
  starts_at: '2026-10-10T12:00:00+00:00', ends_at: '2026-10-10T13:00:00+00:00', timezone: 'Europe/Bucharest',
  status: 'published', version: 2, audience_kind: 'roles', interest_status: null, interest_version: 0,
  can_publish: false, can_cancel: true, can_register_interest: true, can_withdraw_interest: false,
  can_record_attendance: true, eligible_attendance_members: [{ membership_id: id(4), display_name: 'Ana Popescu' }],
};
const parsed = eventReadResponseSchema.parse({ workspace_id: id(3), events: [item] });
assert.equal(parsed.events[0].eligible_attendance_members[0].display_name, 'Ana Popescu');
assert.equal(eventReadResponseSchema.safeParse({ workspace_id: id(3), events: [{ ...item, tenant_id: id(9) }] }).success, false, 'private projection fields fail closed');
assert.equal(eventReadResponseSchema.safeParse({ workspace_id: id(5), events: [{ ...item, workspace_id: id(5), version: 0 }] }).success, false, 'invalid optimistic version fails closed');

assert.equal(toEventInterestView(parsed.events[0], 'ro').audience_label, 'Roluri eligibile');
assert.equal(toEventInterestView(parsed.events[0], 'en').audience_label, 'Eligible roles');
assert.equal(toEventInterestView(parsed.events[0], 'fa').audience_label, 'نقش‌های مجاز');
assert.deepEqual([401, 403, 404, 503, 500].map(classifyEventResponse), ['session', 'denied', 'denied', 'not_ready', 'retry']);

const identity = newEventCommandIdentity(() => id(10));
assert.deepEqual(identity, { command_id: id(10), idempotency_key: `ce011.ui.${id(10)}` });
const base = { ...identity, context_id: id(11), workspace_id: id(3), event_id: id(1), expected_version: 2, reason: 'Customer event page acceptance test' };
for (const command of [
  { ...base, type: 'publish_event' },
  { ...base, type: 'cancel_event' },
  { ...base, type: 'register_interest', expected_interest_version: 0 },
  { ...base, type: 'withdraw_interest', expected_interest_version: 1 },
  { ...base, type: 'record_attendance', target_membership_id: id(4), observed_local: '2026-10-10T15:10', timezone: 'Europe/Bucharest' },
]) assert.equal(eventCommandSchema.safeParse(command).success, true, `${command.type} matches the server command contract`);

const route = classifyCustomerRoute('/app/community/events');
assert.equal(route?.status, 'permission protected');
assert.deepEqual(route?.requirement?.permissions, ['events.event.read']);
assert.deepEqual(route?.requirement?.entitlements, ['module.community_events']);
assert.deepEqual(route?.requirement?.modules, ['community_events']);
assert.equal(classifyCustomerRoute('/app/community/events/private')?.status, 'permission protected');
for (const role of CANONICAL_ROLES) assert.equal(isRouteAllowedForPersona(role, '/app/community/events'), true, `${role} may consume an authorized event audience`);

const page = fs.readFileSync('src/components/customer/CustomerEventInterestPage.tsx', 'utf8');
const shell = fs.readFileSync('src/components/customer/CustomerAppShell.tsx', 'utf8');
const sql = fs.readFileSync('supabase/proposals/ce_011_event_interest_operational_v1.sql', 'utf8');
assert.match(page, /dashboard\.workspace_id/);
assert.match(page, /credentials: 'same-origin'/);
assert.match(page, /cache: 'no-store'/);
assert.match(page, /expected_interest_version/);
assert.match(page, /target_membership_id/);
assert.match(fs.readFileSync('src/lib/community/event-interest-client.ts', 'utf8'), /response\.status === 409/);
assert.match(page, /CE|not a booking|nu crea o rezervare|بدون ایجاد رزرو/);
assert.match(shell, /hasEnt\("module\.community_events"\) && hasPerm\("events\.event\.read"\)/);
for (const field of ['workspace_id','audience_kind','can_publish','can_cancel','can_register_interest','can_withdraw_interest','can_record_attendance','eligible_attendance_members']) assert.match(sql, new RegExp(`'${field}'`));
assert.match(sql, /identity\.profiles/);
assert.match(sql, /ce_event_audience_eligible_v1\(e\.id,m\.id\)/);


const { runEventAcceptance } = await import('./test-v14-ce011-seven-commands.mjs');
console.log(JSON.stringify(await runEventAcceptance({ baselineOnly: true }), null, 2));
