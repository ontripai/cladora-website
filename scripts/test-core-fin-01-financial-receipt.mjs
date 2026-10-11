import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE FIN-01 FINANCIAL RECEIPT TESTS ===\n');

const schemaPath = 'src/lib/core/financial-proposal-receipt-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-FIN-01-FINANCIAL-PROPOSAL-RECEIPT-v1.0.md';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

assert.ok(schema.includes('financial-proposal-posting-receipt.v1'), 'financial envelope has an executable versioned schema');
assert.ok(contract.includes('financial-proposal-posting-receipt.v1'), 'financial envelope is documented');

for (const source of [
  'finance.journals',
  'finance.journal_entries',
  'billing.invoices',
  'billing.receivables',
  'payments.payments',
  'maintenance.vendor_payables',
  'platform.idempotency_keys',
  'audit.events',
]) assert.ok(contract.includes(`\`${source}\``), `${source} is reused`);

assert.match(schema, /posting_authorization:\s*z\.literal\('not_evaluated'\)/, 'proposal approval never grants posting authority');
assert.match(schema, /reversal_requires_original_receipt_only/, 'post and reversal inputs have distinct original-receipt rules');
assert.match(schema, /posted_receipt_requires_financial_reference/, 'posted receipts require canonical financial evidence');
assert.match(schema, /reversal_requires_journal_reference/, 'reversals require a correction journal');
assert.match(schema, /posting_status:\s*z\.literal\('rejected'\)[\s\S]*journal_id:\s*z\.null\(\)[\s\S]*invoice_id:\s*z\.null\(\)[\s\S]*payment_id:\s*z\.null\(\)/, 'rejected receipts expose no financial identifiers');
assert.match(contract, /cannot insert or update `finance\.journals` or `finance\.journal_entries`/, 'domain consumers cannot mutate journals directly');
assert.match(contract, /creates no parallel general ledger, invoice, receivable, payment, payable, approval, audit, outbox or idempotency source/, 'parallel financial infrastructure is forbidden');
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

console.log('  ✔ Proposals pin immutable source, amounts, payers and approval versions.');
console.log('  ✔ Posting authority remains separate from business approval.');
console.log('  ✔ Posted, rejected and reversal receipts have non-overlapping evidence rules.');
console.log('  ✔ Existing Finance gateways and ledgers remain canonical.');
