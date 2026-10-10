import assert from 'node:assert/strict';
import { applyGuideCommand, emptyCe012State, readGuide } from '../src/lib/community/experience-guide-domain.ts';
import { ce012AuthoritySchema, ce012CommandSchema } from '../src/lib/community/experience-guide-schema.ts';

const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { tenant: id(1), context: id(2), workspace: id(3), otherWorkspace: id(4), actor: id(5), otherActor: id(6), manager: id(7), member: id(8), guide: id(9), step: id(10), document: id(11), service: id(12) };
let serial = 20;
const authority = (overrides = {}) => ce012AuthoritySchema.parse({ tenant_id: ids.tenant, context_id: ids.context, workspace_id: ids.workspace, actor_user_id: ids.actor, membership_id: ids.manager, membership_active: true, capability_active: true, audience_result: 'eligible', role_codes: ['manager'], permissions: ['experience.guide.manage', 'experience.guide.read'], ...overrides });
const command = (type, expected_version, extra) => ce012CommandSchema.parse({ type, command_id: id(serial++), idempotency_key: `ce012.test.${serial}.key`, context_id: ids.context, workspace_id: ids.workspace, expected_version, reason: 'CE-012 executable acceptance', ...extra });
const references = [{ target_type: 'document', target_id: ids.document, label: 'Approved document' }, { target_type: 'service', target_id: ids.service, label: 'Optional service' }];
const steps = [{ id: ids.step, title: 'Arrival', body: 'Follow the approved arrival guidance.', references }];
const allowAll = () => true; const allowDocuments = (reference) => reference.target_type === 'document';
const ok = (result) => { assert.equal(result.ok, true); return result.state; };
const rejected = (state, result, code) => { assert.equal(result.ok, false); assert.equal(result.code, code); assert.strictEqual(result.state, state); assert.equal(result.state.audits.length, state.audits.length); };

let state = emptyCe012State();
const create = command('create_guide', 0, { guide_id: ids.guide, title: 'Independent arrival guide', audience: { kind: 'roles', role_codes: ['member'] }, steps });
rejected(state, applyGuideCommand(state, create, authority({ capability_active: false }), '2026-10-08T12:00:00Z', allowAll), 'CAPABILITY_INACTIVE');
rejected(state, applyGuideCommand(state, create, authority(), '2026-10-08T12:00:00Z', allowDocuments), 'UNSAFE_REFERENCE');
state = ok(applyGuideCommand(state, create, authority(), '2026-10-08T12:00:00Z', allowAll));
const revise = command('revise_guide', 1, { guide_id: ids.guide, title: 'Revised arrival guide', audience: { kind: 'roles', role_codes: ['member'] }, steps });
state = ok(applyGuideCommand(state, revise, authority(), '2026-10-08T12:01:00Z', allowAll));
const publish = command('publish_guide', 2, { guide_id: ids.guide });
rejected(state, applyGuideCommand(state, publish, authority({ permissions: ['experience.guide.read'] }), '2026-10-08T12:02:00Z', allowAll), 'AUTHORITY_DENIED');
state = ok(applyGuideCommand(state, publish, authority(), '2026-10-08T12:02:00Z', allowAll));
const member = authority({ membership_id: ids.member, role_codes: ['member'], permissions: ['experience.guide.read'] });
const visible = readGuide(state, ids.guide, member, allowDocuments); assert.equal(visible.steps[0].references.length, 1); assert.equal(visible.steps[0].references[0].target_type, 'document');
assert.equal(readGuide(state, ids.guide, authority({ membership_id: ids.member, role_codes: ['guest'], permissions: ['experience.guide.read'] }), allowAll), null);
assert.equal(readGuide(state, ids.guide, authority({ workspace_id: ids.otherWorkspace, membership_id: ids.member, role_codes: ['member'], permissions: ['experience.guide.read'] }), allowAll), null);
rejected(state, applyGuideCommand(state, publish, authority({ actor_user_id: ids.otherActor }), '2026-10-08T12:03:00Z', allowAll), 'IDEMPOTENCY_CONFLICT');
const replay = applyGuideCommand(state, publish, authority(), '2026-10-08T12:03:00Z', allowAll); assert.equal(replay.ok, true); assert.equal(replay.replayed, true); assert.strictEqual(replay.state, state);
const cancel = command('cancel_guide', 3, { guide_id: ids.guide }); state = ok(applyGuideCommand(state, cancel, authority(), '2026-10-08T12:04:00Z', allowAll)); assert.equal(readGuide(state, ids.guide, member, allowAll), null);

console.log('CE-012 acceptance passed: independent guide lifecycle, versioning, audience/workspace boundary, safe reference filtering, scoped replay, cancellation and rejected-command immutability.');
