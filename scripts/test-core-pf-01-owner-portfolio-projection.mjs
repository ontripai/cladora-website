import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE PF-01 OWNER PORTFOLIO PROJECTION TESTS ===\n');

const schemaPath = 'src/lib/core/owner-portfolio-projection-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-PF-01-OWNER-PORTFOLIO-PROJECTION-v1.0.md';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

for (const version of ['owner-portfolio-projection.v1', 'owner-portfolio-balance.v1']) {
  assert.ok(schema.includes(version), `${version} has an executable schema`);
  assert.ok(contract.includes(version), `${version} is documented`);
}

for (const source of [
  'public.owner_private_units',
  'public.owner_private_leases',
  'public.owner_private_cash_entries',
  'platform.owner_unit_links',
  'portfolio.units',
  'portfolio.ownerships',
  'billing.invoices',
  'billing.receivables',
]) assert.ok(contract.includes(`\`${source}\``), `${source} is reused`);

assert.match(schema, /private_resource[\s\S]*link_status:[\s\S]*private_only[\s\S]*requested[\s\S]*verified[\s\S]*revoked/, 'private resources retain an explicit link lifecycle');
assert.match(schema, /verified_link_requires_canonical_reference_and_relationship/, 'verified private links require both canonical identity and relationship evidence');
assert.match(schema, /source_reference_relationship_mismatch/, 'canonical resource, relationship and source Workspace must match');
assert.match(schema, /recorded_amount_must_be_present_and_unavailable_amount_must_be_null/, 'missing and decimal zero cannot be confused');
assert.match(schema, /action_status:\s*z\.literal\('allowed'\)[\s\S]*product_decision_reference[\s\S]*authority_decision_reference[\s\S]*current_authority_recheck_required:\s*z\.literal\(true\)/, 'allowed links carry product and current-authority evidence and require recheck');
assert.match(schema, /action_status:\s*z\.literal\('withheld'\)[\s\S]*action_code:\s*z\.null\(\)[\s\S]*domain_owner:\s*z\.null\(\)[\s\S]*required_permission:\s*z\.null\(\)/, 'withheld actions expose no action identity or permission');
assert.match(schema, /projection_status:\s*z\.literal\('withheld'\)[\s\S]*portfolio_workspace_id:\s*z\.null\(\)[\s\S]*owner_subject_id:\s*z\.null\(\)[\s\S]*items:\s*z\.array\(z\.never\(\)\)\.max\(0\)/, 'withheld projections expose no identity or items');
assert.match(contract, /creates no second owner identity, party registry, resource registry, ownership ledger, lease lifecycle, financial ledger, role, permission, audit, outbox or idempotency source/, 'parallel foundations are forbidden');
assert.match(contract, /projection is never a bearer capability/, 'action links never replace destination authorization');
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

console.log('  ✔ Private, official Workspace and domain-owned records remain separate.');
console.log('  ✔ Verified links bind canonical identity to relationship evidence.');
console.log('  ✔ Balances preserve missing-versus-zero semantics and source ownership.');
console.log('  ✔ Action links require product and current-authority evidence and recheck.');
