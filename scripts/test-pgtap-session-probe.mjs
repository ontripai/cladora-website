/** Offline source/package audit ONLY. Never connects to PostgreSQL or starts services.
 * Runtime command belongs to Coordinator: isolated pgTAP execution of test 216.
 * This program's PASS is not runtime/extension/finding-clearance proof.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(root, 'supabase/tests/216_pgtap_session_probe_v1_test.sql');
const sql = readFileSync(sqlPath, 'utf8');

// SQL lexical splitter: inspect executable tokens separately from comments and
// quoted SQL/data, including the nested dollar-quoted dynamic SELECT probes.
function tokens(source) {
  const out = [];
  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    let m;
    if ((m = /^\s+/.exec(rest))) { i += m[0].length; continue; }
    if (rest.startsWith('--')) {
      const end = source.indexOf('\n', i); i = end < 0 ? source.length : end + 1; continue;
    }
    if (rest.startsWith('/*')) {
      let depth = 1; i += 2;
      while (depth && i < source.length) {
        if (source.startsWith('/*', i)) { depth++; i += 2; }
        else if (source.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      assert.equal(depth, 0, 'unterminated SQL comment'); continue;
    }
    if ((m = /^(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/.exec(rest))) {
      const tag = m[0], end = source.indexOf(tag, i + tag.length);
      assert.notEqual(end, -1, 'unterminated dollar string');
      out.push({ kind: 'dollar', value: source.slice(i + tag.length, end) });
      i = end + tag.length; continue;
    }
    if (rest[0] === "'" || rest[0] === '"') {
      const quote = rest[0]; let value = ''; i++;
      let closed = false;
      while (i < source.length) {
        if (source[i] === quote) {
          if (source[i + 1] === quote) { value += quote; i += 2; }
          else { i++; closed = true; break; }
        } else value += source[i++];
      }
      assert.ok(closed, 'unterminated quoted token');
      out.push({ kind: quote === "'" ? 'string' : 'identifier', value }); continue;
    }
    if ((m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(rest))) {
      out.push({ kind: 'word', value: m[0].toLowerCase() }); i += m[0].length;
    } else { out.push({ kind: 'symbol', value: source[i++] }); }
  }
  return out;
}
function code(source) {
  return tokens(source).filter(t => !['string', 'dollar'].includes(t.kind)).map(t => t.value).join(' ');
}
function audit(source) {
  const lexical = tokens(source), outer = code(source);
  assert.match(outer, /^begin ;/);
  assert.match(outer, /rollback ;$/);
  assert.doesNotMatch(outer.replaceAll('on commit drop', ''), /\b(?:commit|grant|revoke|alter|truncate|drop|copy|call)\b/);
  assert.doesNotMatch(outer, /\bcreate (?:or replace |extension|schema|role|type)/);
  for (const match of outer.matchAll(/\bcreate (?:temporary table|function) ([^ (]+)/g)) {
    assert.ok(match[1].startsWith('ce216_') || match[1] === 'pg_temp', 'only owned temporary objects');
  }
  // Explicitly reject any application-schema references, including quoted SQL.
  assert.doesNotMatch(source, /\b(?:platform|identity|portfolio|occupancy|finance|billing|payments|utilities|assets|maintenance|governance|communications|documents|security_access|auth|storage)\s*\./i);
  assert.doesNotMatch(source, /\b(?:skip|todo)\b/i, 'no TAP skips or deferred assertions');
  for (const field of ['server_version_num','entry_search_path','entry_schemas','extension_membership',
    'identity_arguments','definition_hash','owner','proconfig','plpgsql_check','pg_depend']) {
    assert.ok(source.includes(field), `metadata records ${field}`);
  }
  assert.ok(source.indexOf("'# CE216_ENV '") < source.indexOf('create temporary table'));
  assert.ok(source.indexOf("'# CE216_CATALOG '") < source.indexOf('create temporary table'));
  assert.match(source, /md5\(pg_get_functiondef\(p\.oid\)\)/);
  assert.doesNotMatch(source, /['"]definition['"]\s*,\s*pg_get_functiondef/);
  assert.match(source, /p\.prorettype=c\.result_type/);
  assert.match(source, /p\.proretset=c\.returns_set/);
  assert.match(source, /e\.extname='pgtap'/);
  assert.match(source, /other\.pronargs-other\.pronargdefaults/);
  assert.match(source, /has_function_privilege\(current_user,p\.oid,'EXECUTE'\)/);
  const helper = lexical.find(t => t.kind === 'dollar' && t.value.includes('declare\n  observed jsonb'))?.value;
  assert.ok(helper, 'case evaluator exists');
  assert.ok(helper.indexOf('if missing is not null') < helper.indexOf('execute query'));
  assert.match(helper, /false,'BLOCKED'/);
  assert.match(helper, /return;[\s\S]*execute query/);
  assert.match(helper, /raise exception using errcode='P0216'/);
  assert.match(helper, /get stacked diagnostics code=returned_sqlstate,msg=message_text/);
  assert.match(helper, /verdict:=clean and code=expected_state/);
  assert.match(helper, /coalesce\(observed->'ok'='true'::jsonb,false\)/);
  assert.match(helper, /EXPECTED_DIAGNOSTIC_OBSERVED_FINDING_RETAINED/);
  assert.match(source, /case when good then 'ok ' else 'not ok '/);
  assert.match(source, /ALL_EIGHT_FINDINGS_RETAINED/);

  const contractSection = source.slice(source.indexOf('insert into pg_temp.ce216_contract('), source.indexOf('update pg_temp.ce216_contract'));
  const contracts = [...contractSection.matchAll(/\('(extensions\.[^']+)'/g)].map(m => m[1]);
  assert.equal(contracts.length, 11);
  const variables = new Map([...source.matchAll(/(\w+_sig) text:='([^']+)'/g)].map(m => [m[1], m[2]]));
  const cases = [...source.matchAll(/perform pg_temp\.ce216_probe\('([^']+)',\s*array\[([\s\S]*?)\],\s*(true|false),\s*\$q\$([\s\S]*?)\$q\$(?:,'([A-Z0-9]{5})')?\);/g)];
  assert.equal(cases.length, 17, 'every intended runtime case is accounted for');
  const coverage = new Set();
  for (const [, label, requirementText, warm, query, expectedState = '00000'] of cases) {
    const required = tokens(requirementText).filter(t => ['string', 'word'].includes(t.kind))
      .map(t => t.kind === 'string' ? t.value : variables.get(t.value));
    assert.ok(required.length && required.every(x => contracts.includes(x)), `${label}: no unknown required contract`);
    if (warm === 'true') assert.ok(required.includes('extensions.plan(bigint)'), `${label}: verified plan required`);
    assert.match(code(query), /^with |^select /, `${label}: only a SELECT probe`);
    assert.doesNotMatch(code(query), /\b(?:insert|update|delete|create|alter|drop|grant|revoke|copy)\b/, `${label}: no hidden writes`);
    for (const m of query.matchAll(/extensions\.(\w+)\(/g)) {
      coverage.add(m[1]);
      assert.ok(required.some(s => s.startsWith(`extensions.${m[1]}(`)), `${label}: every direct extension call is gated`);
    }
    assert.ok(['00000','42P01','42883'].includes(expectedState));
  }
  coverage.add('plan'); // Initialization is performed only by the gated evaluator.
  for (const name of ['plan','add_result','_def_is','_prokind','has_tablespace','check_test','_currtest','row_eq']) {
    assert.ok(coverage.has(name), `${name}: runtime probe present`);
  }
  return { runtimeCasesAuthored: cases.length, signatureGatesAuthored: contracts.length,
    totalTapAssertionsAuthored: cases.length + contracts.length + 2 };
}
const result = audit(sql);
// Mutation controls: ensure this audit rejects dangerous/false-green variants.
for (const [label, mutate] of [
  ['persistent commit', s => s.replace(/rollback;\s*$/, 'commit;')],
  ['unknown contract changed to green', s => s.replace("false,'BLOCKED'", "true,'PASS'")],
  ['missing extension membership', s => s.replaceAll("e.extname='pgtap'", 'true')],
  ['return type unchecked', s => s.replace('p.prorettype=c.result_type', 'true')],
  ['dynamic application read', s => s.replace('select 216::integer', 'select n from portfolio.units')],
  ['unknown direct RPC', s => s.replace('extensions._currtest())', 'extensions.unverified())')],
]) {
  assert.throws(() => audit(mutate(sql)), undefined, `negative control: ${label}`);
}
console.log(JSON.stringify({ status: 'OFFLINE_PACKAGE_AUDIT_PASS', ...result,
  mutationControls: 6, sqlSha256: createHash('sha256').update(sql).digest('hex'),
  postgresExecution: 'NOT_RUN_NOT_PASS', installedSignatures: 'UNKNOWN_UNTIL_COORDINATOR_CATALOG',
  findingClearance: 'NOT_CLAIMED', note: 'Lexical/source checks only; not a SQL or PostgreSQL runtime proof.' }, null, 2));
