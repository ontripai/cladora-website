import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('scripts/sql/advisor-extension-context-probe.sql', 'utf8');
assert.match(sql, /^begin;$/m);
assert.match(sql, /^rollback;$/m);
assert.match(sql, /ADVISOR_CONTEXT_ROLLBACK PASS/);
assert.match(sql, /BLOCKED_UNKNOWN_CHECKER_CONTRACT/);
assert.match(sql, /anyelememttype=>element_type/);
assert.match(sql, /COLD_DIAGNOSTICS_OR_READONLY_CHECKER_BEHAVIOR_CHANGED/);
assert.match(sql, /WARM_CONTEXT_HYPOTHESIS_NOT_PROVEN/);
assert.match(sql, /TYPED_CONTEXT_HYPOTHESIS_NOT_PROVEN/);
assert.match(sql, /UPSTREAM_DEFINITION_CHANGED/);
assert.match(sql, /'global_raw_findings_resolved',0/);
assert.match(sql, /'release_accepted',false/);
assert.equal((sql.match(/^select pg_temp\.advisor_context_check\('warm-typed'/gm) ?? []).length, 2);
const statements = sql.replace(/--[^\n]*/g, '').replace(/on commit drop\b/gi, '');
assert.equal((statements.match(/create extension if not exists plpgsql_check;/gi) ?? []).length, 1);
assert.equal((statements.match(/create function pg_temp\./gi) ?? []).length, 1);
assert.doesNotMatch(statements, /create\s+(?:or replace\s+)?function\s+(?:extensions|assets|customer_api|public)\./i);
assert.doesNotMatch(statements, /\b(?:update|delete|alter|drop|grant|revoke|truncate)\s|create\s+(?:role|schema|policy)\b/i);
assert.doesNotMatch(statements, /security\s+definer|row_security\s*=\s*off|without_warnings\s*=>\s*true/i);
console.log(JSON.stringify({ suite: 'advisor-extension-context-source', observationsAuthored: 18,
  productChanges: 0, runtime: 'NOT_RUN_NOT_PASS' }));
