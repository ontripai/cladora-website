import assert from 'node:assert/strict';
import { buildResolutionPlan, fingerprint } from './plan-airprop-legacy-workspace-resolution.mjs';
const id = n => '13500000-0000-0000-0000-' + String(n).padStart(12,'0');
const seed = {
 version:1,source:{repository_commit:'a'.repeat(40),captured_at:'2026-10-03T10:00:00Z'},
 opportunities:[{id:id(1),tenant_id:id(2),workspace_id:null,property_id:id(3),created_at:'2026-01-02T00:00:00Z',input_hash:'synthetic'}],
 workspaces:[{id:id(4),tenant_id:id(2),lifecycle_status:'ACTIVE'}],
 properties:[{id:id(3),tenant_id:id(2)}],
 bindings:[{id:id(5),tenant_id:id(2),property_id:id(3),customer_workspace_id:id(4),valid_from:'2026-01-01T00:00:00Z',valid_to:null}],
 proposals:[{opportunity_id:id(1),workspace_id:id(4),requester_id:id(6),reviewer_id:id(7),evidence_document_version_id:id(8),reason:'Synthetic historical binding evidence for review'}],
};
let count=0;
function check(name, modify, reason) {
 const input=structuredClone(seed);modify(input);
 const entry=buildResolutionPlan(input).entries[0];
 assert.equal(entry.status,'blocked',name);assert.ok(entry.reasons.includes(reason),name);count++;
}
const first=buildResolutionPlan(seed);
assert.equal(first.entries[0].status,'review_candidate');
assert.equal(first.mode,'review_only');
assert.deepEqual(seed.opportunities[0].workspace_id,null);count++;
assert.deepEqual(first,buildResolutionPlan(seed));count++;
check('no inferred mapping', x=>x.proposals=[], 'explicit_mapping_required');
check('wrong tenant', x=>x.workspaces[0].tenant_id=id(99), 'workspace_tenant_mismatch');
check('inactive workspace', x=>x.workspaces[0].lifecycle_status='SUSPENDED', 'workspace_inactive');
check('same reviewer', x=>x.proposals[0].reviewer_id=id(6), 'independent_review_required');
check('missing evidence', x=>delete x.proposals[0].evidence_document_version_id, 'evidence_and_reason_required');
check('unbound subject', x=>x.opportunities[0].property_id=null, 'workspace_native_resolution_contract_required');
check('wrong subject tenant', x=>x.properties[0].tenant_id=id(99), 'subject_tenant_mismatch');
check('ambiguous history', x=>x.bindings.push({...x.bindings[0],id:id(9)}), 'historical_binding_missing_or_ambiguous');
check('current binding is not historical evidence', x=>x.bindings[0].valid_from='2026-02-01T00:00:00Z', 'historical_binding_missing_or_ambiguous');
check('historical other workspace', x=>x.bindings[0].customer_workspace_id=id(99), 'historical_workspace_mismatch');
check('end date exclusive', x=>x.bindings[0].valid_to=x.opportunities[0].created_at, 'historical_binding_missing_or_ambiguous');
check('timezone required', x=>x.opportunities[0].created_at='2026-01-02', 'invalid_opportunity_time');
const changed=structuredClone(seed);changed.opportunities[0].input_hash='changed';
assert.notEqual(buildResolutionPlan(changed).entries[0].expected_source_hash,first.entries[0].expected_source_hash);count++;
assert.equal(fingerprint({b:1,a:2}),fingerprint({a:2,b:1}));count++;
const duplicate=structuredClone(seed);duplicate.proposals.push(duplicate.proposals[0]);
assert.throws(()=>buildResolutionPlan(duplicate),/duplicate_proposal/);count++;
const missing=structuredClone(seed);missing.proposals[0].opportunity_id=id(99);
assert.throws(()=>buildResolutionPlan(missing),/unknown_proposal_opportunity/);count++;
const scoped=structuredClone(seed);scoped.opportunities[0].workspace_id=id(4);
assert.equal(buildResolutionPlan(scoped).entries[0].status,'already_scoped');count++;
const historical=structuredClone(seed);
historical.bindings[0].valid_to='2026-02-01T00:00:00Z';
historical.bindings.push({...historical.bindings[0],id:id(9),customer_workspace_id:id(99),valid_from:'2026-02-01T00:00:00Z',valid_to:null});
assert.equal(buildResolutionPlan(historical).entries[0].status,'review_candidate');count++;
console.log(count+' legacy workspace resolution checks passed');
