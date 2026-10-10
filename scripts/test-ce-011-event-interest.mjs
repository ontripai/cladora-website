import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { applyEventCommand, canonicalIdempotencyKey, emptyCe011State } from '../src/lib/community/event-interest-domain.ts';
import { authoritySnapshotSchema, eventCommandSchema, timezoneSchema } from '../src/lib/community/event-interest-schema.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = {
  tenant: '00000000-0000-0000-0000-000000000001', context: '00000000-0000-0000-0000-000000000002', audiencePolicy: '00000000-0000-0000-0000-000000000003',
  workspace: '10000000-0000-0000-0000-000000000001', otherWorkspace: '10000000-0000-0000-0000-000000000002',
  manager: '20000000-0000-0000-0000-000000000001', member: '20000000-0000-0000-0000-000000000002', otherMember: '20000000-0000-0000-0000-000000000003',
  actor: '30000000-0000-0000-0000-000000000001', otherActor: '30000000-0000-0000-0000-000000000002',
  event: '40000000-0000-0000-0000-000000000001', draftEvent: '40000000-0000-0000-0000-000000000002',
  occurrence: '50000000-0000-0000-0000-000000000001', draftOccurrence: '50000000-0000-0000-0000-000000000002',
};
let serial = 1;
const commandId = () => `60000000-0000-0000-0000-${String(serial++).padStart(12, '0')}`;
const base = (type, expected_version, extra = {}) => eventCommandSchema.parse({ type, command_id: commandId(), idempotency_key: `ce011.test.${serial}.key`, context_id: ids.context, workspace_id: ids.workspace, expected_version, reason: 'CE-011 executable acceptance test', ...extra });
const authority = (overrides = {}) => authoritySnapshotSchema.parse({ tenant_id: ids.tenant, context_id: ids.context, actor_user_id: ids.actor, membership_id: ids.manager, represented_party_id: null, workspace_id: ids.workspace, membership_active: true, capability_active: true, capability_code: 'ce.event.basic', module_code: 'community_events', audience_policy_id: ids.audiencePolicy, audience_policy_version: 1, audience_result: 'eligible', assurance_level: 'aal1', evaluated_at: now, role_codes: ['event_manager'], permissions: ['events.event.read', 'events.event.publish', 'events.event.cancel', 'events.interest.manage_self', 'events.attendance.record', 'events.attendance.correct'], ...overrides });
const target = (membership_id, role_codes = ['resident']) => ({ membership_id, workspace_id: ids.workspace, membership_active: true, role_codes });
const now = '2026-10-08T08:00:00.000Z';

function ok(result) { assert.equal(result.ok, true); return result.state; }
function rejectedUnchanged(state, result, code) { assert.equal(result.ok, false); assert.equal(result.code, code); assert.strictEqual(result.state, state); assert.equal(result.state.audits.length, state.audits.length); assert.equal(Object.keys(result.state.receipts).length, Object.keys(state.receipts).length); }
function createEvent(event_id, occurrence_id) { return base('create_event', 0, { event_id, occurrence_id, title: 'Community briefing', starts_at: '2026-10-10T15:00:00+03:00', ends_at: '2026-10-10T16:00:00+03:00', timezone: 'Europe/Bucharest', community_ref: null, audience: { kind: 'roles', role_codes: ['resident'] } }); }

assert.equal(timezoneSchema.safeParse('Europe/Bucharest').success, true);
assert.equal(timezoneSchema.safeParse('Europe/Not-A-Zone').success, false);

let state = emptyCe011State();
const create = createEvent(ids.event, ids.occurrence);
rejectedUnchanged(state, applyEventCommand(state, create, authority({ capability_active: false }), now), 'CAPABILITY_INACTIVE');
rejectedUnchanged(state, applyEventCommand(state, create, authority({ permissions: ['events.event.cancel'] }), now), 'AUTHORITY_DENIED');
state = ok(applyEventCommand(state, create, authority(), now));
assert.equal(state.events[ids.event].community_ref, null);
assert.equal('capacity' in state.events[ids.event], false);
const publish = base('publish_event', 1, { event_id: ids.event });
rejectedUnchanged(state, applyEventCommand(state, publish, authority({ permissions: ['events.event.cancel'] }), now), 'AUTHORITY_DENIED');
state = ok(applyEventCommand(state, publish, authority(), now));

const crossWorkspace = { ...base('register_interest', 2, { event_id: ids.event, expected_interest_version: 0 }), workspace_id: ids.otherWorkspace };
rejectedUnchanged(state, applyEventCommand(state, crossWorkspace, authority(), now), 'WORKSPACE_MISMATCH');

const memberAuthority = authority({ membership_id: ids.member, role_codes: ['resident'], permissions: ['events.event.read', 'events.interest.manage_self'] });
const interest = base('register_interest', 2, { event_id: ids.event, expected_interest_version: 0 });
state = ok(applyEventCommand(state, interest, memberAuthority, now));
assert.equal(state.interests[`${ids.event}:${ids.member}`].version, 1);
rejectedUnchanged(state, applyEventCommand(state, interest, authority({ membership_id: ids.member, role_codes: ['resident'], permissions: [] }), now), 'AUTHORITY_DENIED');

const changedAudienceState = { ...state, events: { ...state.events, [ids.event]: { ...state.events[ids.event], audience: { kind: 'roles', role_codes: ['guest'] } } } };
rejectedUnchanged(changedAudienceState, applyEventCommand(changedAudienceState, interest, memberAuthority, now), 'AUTHORITY_DENIED');
rejectedUnchanged(state, applyEventCommand(state, interest, authority({ actor_user_id: ids.otherActor, membership_id: ids.member, role_codes: ['resident'], permissions: ['events.interest.manage_self'] }), now), 'IDEMPOTENCY_CONTEXT_MISMATCH');
rejectedUnchanged(state, applyEventCommand(state, interest, authority({ membership_id: ids.otherMember, role_codes: ['resident'], permissions: ['events.interest.manage_self'] }), now), 'IDEMPOTENCY_CONTEXT_MISMATCH');
const replay = applyEventCommand(state, interest, memberAuthority, now);
assert.equal(replay.ok, true); assert.equal(replay.replayed, true); assert.strictEqual(replay.state, state);
assert.equal(canonicalIdempotencyKey(interest), `ce.event.register_interest.v1/${ids.workspace}/${interest.command_id}/${interest.idempotency_key}`);
assert.equal(Object.values(state.receipts).find((receipt) => receipt.command_id === interest.command_id).canonical_key, canonicalIdempotencyKey(interest));

rejectedUnchanged(state, applyEventCommand(state, base('register_interest', 2, { event_id: ids.event, expected_interest_version: 1 }), memberAuthority, now), 'DUPLICATE_INTEREST');
state = ok(applyEventCommand(state, base('withdraw_interest', 2, { event_id: ids.event, expected_interest_version: 1 }), memberAuthority, now));
assert.equal(state.interests[`${ids.event}:${ids.member}`].version, 2);
state = ok(applyEventCommand(state, base('register_interest', 2, { event_id: ids.event, expected_interest_version: 2 }), memberAuthority, now));
assert.equal(state.interests[`${ids.event}:${ids.member}`].version, 3);
rejectedUnchanged(state, applyEventCommand(state, base('withdraw_interest', 2, { event_id: ids.event, expected_interest_version: 1 }), memberAuthority, now), 'VERSION_CONFLICT');

const draftCreate = createEvent(ids.draftEvent, ids.draftOccurrence);
state = ok(applyEventCommand(state, draftCreate, authority(), now));
const draftAttendance = base('record_attendance', 1, { event_id: ids.draftEvent, target_membership_id: ids.member, observed_local: '2026-10-10T15:10', timezone: 'Europe/Bucharest' });
rejectedUnchanged(state, applyEventCommand(state, draftAttendance, authority(), now, target(ids.member)), 'INVALID_STATE');

const mismatchedTimezone = base('record_attendance', 2, { event_id: ids.event, target_membership_id: ids.member, observed_local: '2026-10-10T15:10', timezone: 'Europe/London' });
rejectedUnchanged(state, applyEventCommand(state, mismatchedTimezone, authority(), now, target(ids.member)), 'INVALID_STATE');
const attendance = base('record_attendance', 2, { event_id: ids.event, target_membership_id: ids.member, observed_local: '2026-10-10T15:10', timezone: 'Europe/Bucharest' });
rejectedUnchanged(state, applyEventCommand(state, attendance, authority({ permissions: ['events.attendance.correct'] }), now, target(ids.member)), 'AUTHORITY_DENIED');
state = ok(applyEventCommand(state, attendance, authority(), now, target(ids.member)));
const attendanceId = attendance.command_id;
assert.equal(state.attendance[attendanceId].observed_local, '2026-10-10T15:10');
assert.equal(state.attendance[attendanceId].timezone, 'Europe/Bucharest');

const cancel = base('cancel_event', 2, { event_id: ids.event });
rejectedUnchanged(state, applyEventCommand(state, cancel, authority({ permissions: ['events.event.publish'] }), now), 'AUTHORITY_DENIED');
state = ok(applyEventCommand(state, cancel, authority(), now));
const cancelledAttendance = base('record_attendance', 3, { event_id: ids.event, target_membership_id: ids.otherMember, observed_local: '2026-10-10T15:15', timezone: 'Europe/Bucharest' });
rejectedUnchanged(state, applyEventCommand(state, cancelledAttendance, authority(), now, target(ids.otherMember)), 'INVALID_STATE');
const correction = base('correct_attendance', 3, { event_id: ids.event, attendance_id: attendanceId, expected_attendance_version: 1, attended: false, observed_local: '2026-10-10T15:12', timezone: 'Europe/Bucharest', reason: 'Correct observed attendance after event cancellation' });
rejectedUnchanged(state, applyEventCommand(state, correction, authority({ permissions: ['events.attendance.record'] }), now, target(ids.member)), 'AUTHORITY_DENIED');
state = ok(applyEventCommand(state, correction, authority(), now, target(ids.member)));
assert.equal(state.attendance[attendanceId].version, 2);
assert.equal(state.audits.at(-1).policy, 'post_cancellation_attendance_correction');
assert.equal(state.audits.at(-1).reason, correction.reason);

const uiPath = path.join(root, 'src/components/customer/CustomerEventInterest.tsx');
const uiSource = fs.readFileSync(uiPath, 'utf8');
const compiledUiPath = path.join(root, 'scripts/.ce011-ui-runtime.mjs');
fs.writeFileSync(compiledUiPath, ts.transpileModule(uiSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
const { CustomerEventInterest } = await import(`./.ce011-ui-runtime.mjs?${Date.now()}`);
const view = (event_id = ids.event, workspace_id = ids.workspace) => ({ event_id, workspace_id, title: 'Briefing', starts_at: '2026-10-10T12:00:00.000Z', ends_at: '2026-10-10T13:00:00.000Z', timezone: 'Europe/Bucharest', status: 'published', audience_label: 'Residents', version: 2, interest_status: null, interest_version: 0, can_publish: false, can_cancel: true, can_register_interest: true, can_withdraw_interest: false, can_record_attendance: true });
const members = [{ membership_id: ids.member, display_name: 'Ana Popescu' }];
for (const lang of ['ro', 'en', 'fa']) {
  const html = renderToStaticMarkup(React.createElement(CustomerEventInterest, { lang, event: view(), commands: {}, eligibleAttendanceMembers: members }));
  assert.match(html, /<select/); assert.match(html, /Ana Popescu/); assert.match(html, /Europe\/Bucharest/);
  assert.doesNotMatch(html, /ID membru|Membership ID|شناسهٔ عضویت|Core|CE-011/);
  if (lang === 'fa') assert.match(html, /ثبت علاقه به معنی رزرو یا تضمین ورود نیست/);
  if (lang === 'en') assert.match(html, /Registering interest is not a booking and does not guarantee admission/);
  if (lang === 'ro') assert.match(html, /Exprimarea interesului nu reprezintă o rezervare și nu garantează accesul/);
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const container = document.getElementById('root');
const rootView = createRoot(container);
const commands = { recordAttendance: async () => { throw new Error('expected test failure'); } };
await act(async () => { rootView.render(React.createElement(CustomerEventInterest, { lang: 'fa', event: view(), commands, eligibleAttendanceMembers: members })); });
const select = container.querySelector('select'); const timeInput = container.querySelector('input');
const setValue = (element, value, prototype) => { Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
await act(async () => { setValue(select, ids.member, dom.window.HTMLSelectElement.prototype); setValue(timeInput, '2026-10-10T15:10', dom.window.HTMLInputElement.prototype); });
await act(async () => { container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
assert.equal(select.value, ids.member); assert.equal(timeInput.value, '2026-10-10T15:10');
assert.match(container.querySelector('[role="alert"]').textContent, /ورودی شما حفظ شده است/);

await act(async () => { rootView.render(React.createElement(CustomerEventInterest, { lang: 'fa', event: view(ids.draftEvent), commands, eligibleAttendanceMembers: members })); });
assert.equal(container.querySelector('select').value, ''); assert.equal(container.querySelector('input').value, '');
await act(async () => { setValue(container.querySelector('select'), ids.member, dom.window.HTMLSelectElement.prototype); setValue(container.querySelector('input'), '2026-10-10T15:20', dom.window.HTMLInputElement.prototype); });
await act(async () => { rootView.render(React.createElement(CustomerEventInterest, { lang: 'fa', event: view(ids.draftEvent, ids.otherWorkspace), commands, eligibleAttendanceMembers: members })); });
assert.equal(container.querySelector('select').value, ''); assert.equal(container.querySelector('input').value, '');
await act(async () => rootView.unmount());
fs.unlinkSync(compiledUiPath);

console.log('CE-011 domain/UI acceptance passed: scoped replay, interest concurrency, attendance policy, timezone, eligible-member selection, input preservation and context reset.');
