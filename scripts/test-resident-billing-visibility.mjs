import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/customer/billing-visibility.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { restrictResidentBilling } = await import(`data:text/javascript,${encodeURIComponent(js)}`);

for (const role_code of ['owner', 'tenant_resident', 'OWNER']) {
  const response = {
    context: { role_code },
    invoices: [{ id: 'invoice-70', journal_id: 'private-id', journal_no: 159, total: 1 }],
    journal: { id: 'private-id', entries: [{ account: '4111' }] },
  };
  const result = restrictResidentBilling(response);
  assert.deepEqual(result.invoices, [{ id: 'invoice-70', total: 1 }]);
  assert.equal(result.journal, null);
  assert.ok(response.journal, 'the source object remains unchanged');
}

const manager = { context: { role_code: 'property_manager' }, invoices: [{ journal_id: 'visible' }], journal: { id: 'visible' } };
assert.equal(restrictResidentBilling(manager), manager);

const migration = await readFile(new URL('../supabase/migrations/20260929113908_resident_billing_ledger_redaction.sql', import.meta.url), 'utf8');
assert.match(migration, /item - 'journal_id' - 'journal_no'/);
assert.match(migration, /'journal', case when v_is_resident then null else v_journal end/);
console.log('PASS resident billing ledger redaction for owner and tenant; manager proof retained');
