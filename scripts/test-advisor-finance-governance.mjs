import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';

const root = process.cwd();
const migrationName = '20261021071420_advisor_finance_governance_sql_v1.sql';
const candidate = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const definitions = sql => new Map([...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w]+\.[\w]+)\s*\([\s\S]*?\bas\s+(\$\w*\$)([\s\S]*?)\2\s*;/gi)]
  .map(match => [match[1].toLowerCase(), match[0]]));
const actual = definitions(candidate);
assert.equal(actual.size, 3);
assert.doesNotMatch(candidate, /\b(?:grant|revoke|alter|drop)\s|create\s+(?:table|role|policy|type)\b/i);
const historical = (filename, name) => definitions(readFileSync(`supabase/migrations/${filename}`, 'utf8')).get(name);
const financeName = 'finance.get_customer_allocations';
const finance = historical('20260929085047_fix_allocation_and_scanner_observability.sql', financeName);
assert.equal(finance.split("coalesce(invoice_no,'')").length, 2);
assert.equal(actual.get(financeName), finance.replace("coalesce(invoice_no,'')", "coalesce(invoice_no::text,'')"),
  'invoice search cast is the sole Finance change; authorization, output and summary are byte-identical');
const governanceName = 'governance.get_customer_governance';
const governance = historical('20260902074312_customer_password_optional_mfa_policy.sql', governanceName);
assert.equal(governance.split('u.unit_code').length, 4);
assert.equal(actual.get(governanceName), governance.replaceAll('u.unit_code', 'u.code as unit_code'),
  'only three canonical Unit aliases change; all governance authority/views are byte-identical');

const ballotName = 'governance.open_ballot';
let ballot = historical('20260909100447_romanian_governance_legal_contract_correction.sql', ballotName);
const oldAggregate = /  select coalesce\(jsonb_object_agg\(e\.party_id, count\(distinct e\.unit_id\)\), '\{\}'::jsonb\) into v_units_per_owner[\s\S]*?  group by e\.party_id;\n\n  select coalesce\(jsonb_object_agg\(e\.party_id, sum\(e\.ownership_share\)\), '\{\}'::jsonb\) into v_shares[\s\S]*?  group by e\.party_id;/;
assert.ok(oldAggregate.test(ballot), 'regression baseline really contains both invalid nested aggregates');
const correctedAggregate = `  -- Aggregate each eligible owner first, then build one complete owner map.
  select coalesce(jsonb_object_agg(owners.party_id, owners.unit_count), '{}'::jsonb),
         coalesce(jsonb_object_agg(owners.party_id, owners.ownership_share), '{}'::jsonb)
  into v_units_per_owner, v_shares
  from (
    select e.party_id, count(distinct e.unit_id) as unit_count,
           sum(e.ownership_share) as ownership_share
    from governance.eligibility_snapshots e
    where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id and e.eligible
    group by e.party_id
  ) owners;`;
ballot = ballot.replace(oldAggregate, correctedAggregate)
  .replace("'open', case when v_rule.voting_basis", "'draft', case when v_rule.voting_basis")
  .replace('statement_timestamp(), p_secret_ballot, v_rule.version,', 'null, p_secret_ballot, v_rule.version,')
  .replace('  return v_vote;', `  -- The existing option guard permits writes only while the vote is draft.
  -- Open only after all options exist, within this same atomic transaction.
  update governance.votes
  set status = 'open', opens_at = statement_timestamp()
  where id = v_vote.id and tenant_id = v_actor.tenant_id
  returning * into v_vote;

  return v_vote;`);
assert.equal(actual.get(ballotName), ballot,
  'ballot changes only two-stage aggregation and draft/options/open ordering, not legal rules or authority');
assert.match(readFileSync('supabase/migrations/20260825001700_governance_meetings_voting.sql', 'utf8'), /if s<>'draft' then raise exception 'vote_options_require_draft_vote'/);
assert.ok(ballot.indexOf('insert into governance.vote_options') < ballot.indexOf("set status = 'open'"));
const pgTest = readFileSync('supabase/tests/214_advisor_finance_governance_sql_v1_test.sql', 'utf8');
assert.match(pgTest, /^begin;/m);
assert.match(pgTest, /rollback;\s*$/);
assert.doesNotMatch(pgTest, /disable trigger|session_replication_role|no_plan\(|from skip\(/i);

const requireDependency = createRequire(resolve(process.env.ADVISOR_TEST_DEPENDENCY_ROOT ?? root, 'package.json'));
const ts = requireDependency('typescript');
const { NextRequest } = requireDependency('next/server');
const actor = '21400000-0000-4000-8000-000000000001';
const context = '21400000-0000-4000-8000-000000000040';
let claims, reply, calls;
function loadRoute(domain) {
  const filename = resolve(root, `src/app/api/customer/v1/${domain}/route.ts`);
  const compiledRoute = new Module(filename);
  compiledRoute.require = specifier => {
    if (specifier !== '@/lib/supabase/server') return requireDependency(specifier);
    return { createClient: async () => ({
      auth: { getClaims: async () => { calls.push({ type: 'claims' }); return claims; } },
      schema: name => {
        assert.equal(name, 'customer_api');
        return { rpc: async (name, args) => { calls.push({ type: 'rpc', name, args }); return reply; } };
      },
    }) };
  };
  const result = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename, reportDiagnostics: true,
  });
  assert.deepEqual(result.diagnostics, []);
  compiledRoute._compile(result.outputText, filename);
  assert.deepEqual(Object.keys(compiledRoute.exports), ['GET'], 'reader cannot expose a mutation handler');
  return compiledRoute.exports.GET;
}
let checks = 0;
for (const [domain, view, rpc, denied, failed, row] of [
  ['allocations', 'lines', 'get_allocations_v1', 'ALLOCATION_ACCESS_DENIED', 'ALLOCATION_QUERY_FAILED', { source_document: 900214 }],
  ['governance', 'invitations', 'get_governance_v1', 'GOVERNANCE_ACCESS_DENIED', 'GOVERNANCE_QUERY_FAILED', { unit_code: 'واحد-214/Ș' }],
]) {
  const get = loadRoute(domain);
  const defaults = () => { calls = []; claims = { data: { claims: { sub: actor } }, error: null }; reply = { data: { view, rows: [row], total: 1, read_only: true }, error: null }; };
  const request = async (query = `context_id=${context}&view=${view}&query=900214`) => {
    const response = await get(new NextRequest(`http://127.0.0.1/api/customer/v1/${domain}?${query}`));
    assert.equal(response.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(response.headers.get('Vary'), 'Cookie');
    return { status: response.status, body: await response.json() };
  };
  defaults();
  let result = await request();
  assert.equal(result.status, 200); assert.deepEqual(result.body, reply.data);
  assert.equal(calls.at(-1).name, rpc); assert.equal(calls.at(-1).args.p_query, '900214');
  assert.equal(calls.at(-1).args.p_context_id, context); checks++;
  for (const query of ['context_id=invalid', `context_id=${context}&view=unknown`]) {
    defaults(); result = await request(query); assert.equal(result.status, 400); assert.equal(calls.length, 0); checks++;
  }
  defaults(); claims.data.claims = {};
  result = await request(); assert.equal(result.status, 401); assert.equal(calls.some(c => c.type === 'rpc'), false); checks++;
  defaults(); claims.error = { message: 'private-auth-details' };
  result = await request(); assert.equal(result.status, 401); assert.equal(calls.some(c => c.type === 'rpc'), false); checks++;
  defaults(); reply = { data: null, error: { code: '42501', message: 'private-authority-details' } };
  result = await request(); assert.equal(result.status, 403); assert.deepEqual(result.body, { error: { code: denied } }); checks++;
  defaults(); reply = { data: null, error: { code: '42703', message: 'private-database-details' } };
  result = await request(); assert.equal(result.status, 500); assert.deepEqual(result.body, { error: { code: failed } }); checks++;
  defaults(); reply.data = { view, rows: [], total: 0, read_only: true };
  result = await request(); assert.deepEqual(result.body, reply.data); checks++;
  defaults(); reply.data.rows = [Object.fromEntries(Object.keys(row).map(key => [key, null]))];
  result = await request(); assert.deepEqual(result.body.rows, reply.data.rows); checks++;
}
console.log(JSON.stringify({ suite: 'advisor-finance-governance', source_delta: 'PASS', actual_get_handler_cases: checks,
  api_boundary: 'MOCKED_AUTH_AND_RPC', postgres_pgtap: 'NOT_RUN_NOT_PASS', connected_http: 'NOT_RUN_NOT_PASS', mutations: 0 }));
