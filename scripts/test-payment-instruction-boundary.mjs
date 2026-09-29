import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const route = await readFile(new URL('../src/app/api/customer/v1/payments/intents/route.ts', import.meta.url), 'utf8');
assert.match(route, /p_invoices: p\.selected_invoices/);
assert.match(route, /p_idempotency_key: idempotencyKey/);
assert.doesNotMatch(route, /p_selected_invoices:|p_provider_code:/);

const detail = await readFile(new URL('../src/components/customer/CustomerBillingDashboard.tsx', import.meta.url), 'utf8');
assert.match(detail, /intents\/\$\{intentData\.payment_intent_id\}\/bank-instruction/);

const instructionRoute = await readFile(new URL('../src/app/api/customer/v1/payments/intents/[id]/bank-instruction/route.ts', import.meta.url), 'utf8');
assert.match(instructionRoute, /PAYMENT_DESTINATION_UNAVAILABLE/);
assert.match(instructionRoute, /rawInstruction\.beneficiary_name/);

const source = await readFile(new URL('../src/lib/payments/bank-instruction.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { buildBankPaymentInstruction } = await import(`data:text/javascript,${encodeURIComponent(js)}`);
const input = { associationLegalName: 'Test Association', iban: 'RO49AAAA1B31007593840000', bankName: 'Test Bank', amount: 1, clientReference: 'TEST-1', unitCode: 'A-01' };
assert.equal(buildBankPaymentInstruction({ ...input, currency: 'RON' }).epc_qr_payload, null);
assert.match(buildBankPaymentInstruction({ ...input, currency: 'EUR' }).epc_qr_payload, /^BCD\n002\n1\nSCT\n/);
console.log('PASS payment intent RPC contract, response ID and safe bank instruction boundary');
