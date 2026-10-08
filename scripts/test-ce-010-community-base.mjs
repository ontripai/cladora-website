import assert from 'node:assert/strict';
import { applyCommunityCommand, emptyCe010State } from '../src/lib/community/community-base-domain.ts';
import { ce010AuthoritySchema, ce010CommandSchema } from '../src/lib/community/community-base-schema.ts';

const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { tenant: id(1), context: id(2), workspace: id(3), otherWorkspace: id(4), actor: id(5), otherActor: id(6), manager: id(7), member: id(8), community: id(9), announcement: id(10), report: id(11) };
let serial = 20;
const authority = (overrides = {}) => ce010AuthoritySchema.parse({ tenant_id: ids.tenant, context_id: ids.context, workspace_id: ids.workspace, actor_user_id: ids.actor, membership_id: ids.manager, membership_active: true, capability_active: true, audience_result: 'eligible', role_codes: ['manager'], permissions: ['community.community.manage', 'community.announcement.publish', 'community.report.create', 'community.report.decide'], ...overrides });
const command = (type, expected_version, extra) => ce010CommandSchema.parse({ type, command_id: id(serial++), idempotency_key: `ce010.test.${serial}.key`, context_id: ids.context, workspace_id: ids.workspace, expected_version, reason: 'CE-010 executable acceptance', ...extra });
const ok = (result) => { assert.equal(result.ok, true); return result.state; };
const rejected = (state, result, code) => { assert.equal(result.ok, false); assert.equal(result.code, code); assert.strictEqual(result.state, state); assert.equal(result.state.audits.length, state.audits.length); };

let state = emptyCe010State();
const createCommunity = command('create_community', 0, { community_id: ids.community, name: 'Workspace community', audience: { kind: 'roles', role_codes: ['member'] } });
rejected(state, applyCommunityCommand(state, createCommunity, authority({ capability_active: false }), '2026-10-08T12:00:00Z'), 'CAPABILITY_INACTIVE');
state = ok(applyCommunityCommand(state, createCommunity, authority(), '2026-10-08T12:00:00Z'));
const draft = command('create_announcement', 1, { community_id: ids.community, announcement_id: ids.announcement, body: 'Community notice', audience: { kind: 'roles', role_codes: ['member'] } });
state = ok(applyCommunityCommand(state, draft, authority(), '2026-10-08T12:01:00Z'));
const publish = command('publish_announcement', 1, { community_id: ids.community, announcement_id: ids.announcement });
rejected(state, applyCommunityCommand(state, publish, authority({ permissions: ['community.report.decide'] }), '2026-10-08T12:02:00Z'), 'AUTHORITY_DENIED');
state = ok(applyCommunityCommand(state, publish, authority(), '2026-10-08T12:02:00Z'));

const member = authority({ membership_id: ids.member, role_codes: ['member'], permissions: ['community.report.create'] });
const report = command('report_content', 0, { community_id: ids.community, report_id: ids.report, target_type: 'announcement', target_id: ids.announcement, report_reason: 'Content needs moderator review' });
state = ok(applyCommunityCommand(state, report, member, '2026-10-08T12:03:00Z'));
rejected(state, applyCommunityCommand(state, command('report_content', 0, { community_id: ids.community, report_id: id(30), target_type: 'announcement', target_id: ids.announcement, report_reason: 'Repeated active report' }), member, '2026-10-08T12:04:00Z'), 'DUPLICATE_REPORT');
rejected(state, applyCommunityCommand(state, report, authority({ membership_id: ids.member, role_codes: ['guest'], permissions: ['community.report.create'] }), '2026-10-08T12:05:00Z'), 'AUTHORITY_DENIED');
rejected(state, applyCommunityCommand(state, report, authority({ actor_user_id: ids.otherActor, membership_id: ids.member, role_codes: ['member'], permissions: ['community.report.create'] }), '2026-10-08T12:05:00Z'), 'IDEMPOTENCY_CONFLICT');
const replay = applyCommunityCommand(state, report, member, '2026-10-08T12:05:00Z'); assert.equal(replay.ok, true); assert.equal(replay.replayed, true); assert.strictEqual(replay.state, state);
const decide = command('decide_content_report', 1, { community_id: ids.community, report_id: ids.report, decision: 'action_required', decision_reason: 'Moderator confirmed policy breach' });
rejected(state, applyCommunityCommand(state, { ...decide, workspace_id: ids.otherWorkspace }, authority(), '2026-10-08T12:06:00Z'), 'WORKSPACE_MISMATCH');
state = ok(applyCommunityCommand(state, decide, authority(), '2026-10-08T12:06:00Z'));
assert.equal(state.reports[ids.report].version, 2); assert.equal(state.reports[ids.report].decision_reason, 'Moderator confirmed policy breach');

console.log('CE-010 acceptance passed: independent capability, audience/workspace boundary, announcement lifecycle, duplicate report prevention, scoped replay, versioned moderation and rejected-command immutability.');
