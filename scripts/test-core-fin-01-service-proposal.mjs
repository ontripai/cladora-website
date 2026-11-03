import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loadedModule = { exports: {} };
  const withTs = id => id.endsWith('.ts') ? id : `${id}.ts`;
  const localRequire = id => id.startsWith('@/') ? load(new URL(`../src/${withTs(id.slice(2))}`, import.meta.url))
    : id.startsWith('.') ? load(new URL(withTs(id), file)) : require(id);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}

const { financialProposalV1Schema } = load(new URL('../src/lib/core/financial-proposal-receipt-v1.ts', import.meta.url));
const proposal = {
  contract_version: 'financial-proposal-posting-receipt.v1',
  proposal_id: 'f1010000-0000-4000-8000-000000000003', proposal_version: 7,
  idempotency_key: 'fin01:service_quote:f1010000-0000-4000-8000-000000000003',
  context_id: 'f1010000-0000-4000-8000-000000000001',
  workspace_id: 'f1010000-0000-4000-8000-000000000002',
  source: { source_domain: 'service', source_entity_type: 'service_quote',
    source_entity_id: 'f1010000-0000-4000-8000-000000000003', source_version: 7,
    source_reference: 'service_catalog.quote_drafts:f1010000-0000-4000-8000-000000000003:v7' },
  resource: null, proposal_kind: 'charge',
  amounts: { currency: 'EUR', net_amount: '125.00', tax_amount: '0.00', gross_amount: '125.00',
    tax_treatment_code: 'service_quote_tax_not_separated', tax_rule_version: 1 },
  payers: [{ party_id: 'f1010000-0000-4000-8000-000000000004', payer_role: 'customer',
    allocated_amount: '125.00', approval_state: 'pending', approval_reference: null }],
  occurred_on: '2026-10-19', due_on: null, approval_state: 'pending', approval_version: 0,
  requested_at: '2026-10-19T21:05:00+00:00', posting_authorization: 'not_evaluated',
};
assert.equal(financialProposalV1Schema.safeParse(proposal).success, true);
assert.equal(financialProposalV1Schema.safeParse({ ...proposal, posting_authorization: 'allowed' }).success, false);
assert.equal(financialProposalV1Schema.safeParse({ ...proposal, approval_state: 'approved' }).success, false,
  'an approved proposal cannot retain a pending payer');

const migration = readFileSync('supabase/migrations/20261019210500_fin01_service_quote_proposal_projection_v1.sql', 'utf8');
const consumer = readFileSync('src/components/customer/CustomerServiceQuotePublications.tsx', 'utf8');
assert.match(migration, /service_request_authorize_v1/, 'consumer uses current AUTH01');
assert.match(migration, /quote_publications/, 'proposal requires a real published SERVICE quote');
assert.doesNotMatch(migration, /insert\s+into\s+finance\.journals/i, 'projection never writes the ledger');
assert.match(consumer, /financial_proposal/, 'real SERVICE UI consumes the FIN01 proposal');
console.log('PASS FIN01 SERVICE proposal projection: schema, AUTH01, zero-ledger-write and real UI consumer');
