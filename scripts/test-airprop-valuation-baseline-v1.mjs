import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, Module } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), cache = new Map();
// Actual product modules, no provider/math stub. No SQL/HTTP/network/DB or file writes.
function load(path, alternate = null) {
  let filename = resolve(root, path);
  if(alternate && filename.startsWith(root+'/')){
    const candidate=resolve(alternate,filename.slice(root.length+1));if(existsSync(candidate))filename=candidate;
  }
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = id => id.startsWith('.') ? load(resolve(dirname(alternate && filename.startsWith(alternate+'/') ? resolve(root,filename.slice(alternate.length+1)) : filename), id.endsWith('.ts') ? id : id + '.ts'),alternate) : require(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const engine = load('src/lib/airprop/valuation-baseline-v1.ts');
const contracts = load('src/lib/airprop/valuation-contract-v1.ts');
const { renderRatio, decimalRatio } = load('src/lib/airprop/valuation-baseline-policy-v1.ts');
const fixture = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/airprop-valuation-baseline-v1.json'), 'utf8'));
const clone = v => structuredClone(v), input = () => clone(fixture.base);
const id = n => `${n.toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const probeAt=process.argv.indexOf('--probe-predecessor');
if(probeAt!==-1){
  const predecessor=resolve(process.argv[probeAt+1]);
  const old=load('src/lib/airprop/valuation-baseline-v1.ts',predecessor);
  const beforeInput=()=>clone(fixture.base);
  const show=(i,r,detail='result_display')=>old.projectValuationBaselineV1({run:r,resource:i.resource,core_request:i.core_request,core_evidence:i.core_evidence,sources:i.sources,read_at:i.computed_at,detail});
  const original=beforeInput(),oldRun=old.computeValuationBaselineV1(original);
  assert.equal(oldRun.result.sale_range.central,'200000.00');
  const changed=clone(oldRun);changed.run_version='not-a-hash';changed.result.sale_range.central='250001.00';
  assert.equal(show(original,changed).result.sale_range.central,'250001.00');console.log('REPRODUCED_BEFORE AIR-VAL-SR-01 tampered result/hash accepted');
  const privateTrace=clone(oldRun);privateTrace.internal.trace[0].private_payload='LEAK-ME';
  assert.equal(show(original,privateTrace,'comparable_display').comparables[0].private_payload,'LEAK-ME');console.log('REPRODUCED_BEFORE AIR-VAL-SR-01 private trace leaked');
  const authority=beforeInput();authority.core_request.authority.decision_id=authority.core_evidence.authority.decision_id=id(71);
  assert.equal(old.computeValuationBaselineV1(authority).run_version,oldRun.run_version);console.log('REPRODUCED_BEFORE AIR-VAL-SR-02 matched Core identity absent from lineage');
  const fx=beforeInput();fx.quality_policy.target_currency='RON';fx.quality_policy.fx_rates=[{from_currency:'EUR',to_currency:'RON',rate:'5',effective_at:'2026-09-01T00:00:00Z',published_at:'2026-09-01T00:00:00Z',source_ref:'synthetic://FX1'}];
  const firstFX=old.computeValuationBaselineV1(fx);fx.quality_policy.fx_rates[0].published_at='2026-09-02T00:00:00Z';
  assert.equal(old.computeValuationBaselineV1(fx).run_version,firstFX.run_version);console.log('REPRODUCED_BEFORE AIR-VAL-SR-02 full FX publication absent from lineage');
  const rent=beforeInput();rent.policy.transaction_kind='rent';rent.policy.rental_period='month';rent.request.purposes=['rental_recommendation'];
  rent.observations.forEach((o,n)=>{o.transaction_kind='rent';o.attributes.rental_period='month';o.amount=String((n+1)*500);o.area='50';});
  const projected=show(rent,old.computeValuationBaselineV1(rent));assert.ok(projected.result.rent_range);assert.equal(Object.hasOwn(projected,'rental_period'),false);assert.equal(Object.hasOwn(projected.result,'rental_period'),false);
  console.log('REPRODUCED_BEFORE AIR-VAL-SR-03 rent lacks machine period');
  const adjusted=beforeInput();adjusted.policy.time_adjustments=adjusted.observations.map(o=>({observation_id:o.observation_id,factor:'1.1',from:o.observed_at,to:adjusted.as_of,published_at:adjusted.as_of,index_version:'UNPROVEN',evidence_ref:'UNPROVEN-INDEX',basis:'target_currency_property_index'}));
  assert.equal(old.computeValuationBaselineV1(adjusted).result.sale_range.central,'220000.00');
  console.log('REPRODUCED_BEFORE AIR-VAL-SR-04 unproven nonidentity index calculated');
  console.log('5/5 SERVICE counterexamples plus1 SR04 probe reproduced;6 before witnesses; predecessor intentionally vulnerable; NOT successor acceptance.');
  process.exit(0);
}

let count = 0;
const selectedGroup=process.argv.includes('--successor')?'successor':'all';
const controls=['independent hand oracle','independent weighted oracle','VAL04 rent is independent','VAL05 no observations','VAL10 reproducibility','VAL14 compute','rounding oracle'];
const test = (name, fn) => {
  if(selectedGroup==='successor'&&!name.startsWith('SR-')&&!controls.some(prefix=>name.startsWith(prefix)))return;
  fn(); console.log(`PASS ${++count} ${name}`);
};
const prepared=i=>({contract:'valuation-baseline-prepared-input.v2',input:clone(i)});
const reference=new WeakMap();
const run = i => {const independent=prepared(i);const r=engine.computeValuationBaselineV1(independent);if(r.stage!=='blocked'&&r.stage!=='not_ready')reference.set(r,independent);return r;};
const insufficient = i => { const o = run(i); assert.equal(o.stage, 'insufficient_data'); assert.equal(o.valuation.result.outcome, 'insufficient_data'); assert.equal(o.valuation.result.sale_range, null); assert.equal(o.valuation.result.rent_range, null); assert.equal(o.valuation.result.price_per_area_basis, null); assert.ok(o.valuation.result.missing_inputs.length); return o; };
const deny = i => assert.deepEqual(run(i), { stage: 'blocked', reason: 'valuation_unavailable' });
function sourceB(i, weight = 1) { const s = clone(i.sources[0]); s.source_id = 'synthetic-b'; i.sources.push(s); i.policy.source_weights.push({ source_id: s.source_id, weight, rationale_ref: 'synthetic://weight-example-only' }); return s; }
function append(i, original, number) { const o = clone(original); o.observation_id = id(number); o.source.source_record_id = `distinct-${number}`; i.observations.push(o); const l = clone(i.unit_links[0]); l.observation_id = o.observation_id; l.unit_id = `SYNTHETIC-${number}`; i.unit_links.push(l); return o; }
function projection(i, result, detail = 'result_display') { return engine.projectValuationBaselineV1({ trusted_preparation:reference.get(result),run: result, resource: i.resource, core_request: i.core_request, core_evidence: i.core_evidence, sources: i.sources, read_at: i.computed_at, detail }); }

test('independent hand oracle:1000/2000/3000 per sqm,100sqm ->100k/200k/300k', () => {
  const o = run(input()); assert.equal(o.stage, 'calculated'); assert.deepEqual(o.valuation.result.sale_range, fixture.sale_oracle); assert.equal(o.valuation.result.rent_range, null);
  assert.equal(o.valuation.result.price_per_area_basis.amount, '2000.0000'); contracts.resourceValuationResultV1Schema.parse(o.valuation.result);
  assert.equal(o.valuation.result.review_status, 'not_reviewed'); assert.equal(o.internal.trace.length, 3); assert.equal(o.valuation.result.quality_score, 1);
});
test('independent weighted oracle: (100+200+4*300)/6=250 thousand', () => {
  const i = input(); sourceB(i, 4); i.observations[2].source.source_id = 'synthetic-b';
  assert.equal(run(i).valuation.result.sale_range.central, fixture.weighted_oracle.central);
  assert.equal(run(i).internal.trace.find(x => x.source_id === 'synthetic-b').weight, 4);
});
test('VAL01 unit-specific floor attributes, not common building average', () => {
  const i = input(); i.resource.attributes.floor = 3; insufficient(i);
  i.observations.forEach((o, n) => { o.attributes.floor = 3; o.amount = String((n + 4) * 100000); });
  assert.equal(run(i).valuation.result.sale_range.central, '500000.00');
});
test('VAL01 area-specific subject snapshot and version produce own value', () => {
  const i = input(); i.resource.attributes.area = '200'; i.resource.resource_version = 5; i.request.resource_version = 5; i.core_request.resource.resource_version = 5; i.core_evidence.resource.resource_version = 5;
  assert.equal(run(i).valuation.result.sale_range.central, '400000.00'); assert.notEqual(run(i).run_version, run(input()).run_version);
});
test('VAL02 asking remains asking, never transaction evidence or accepted appraisal', () => {
  const i = input(); i.policy.evidence_kind = 'asking'; insufficient(i);
  i.observations.forEach(o => { o.evidence_kind = 'asking'; o.verification = 'source_verified'; });
  const o = run(i); assert.equal(o.stage, 'review_required'); assert.equal(o.valuation.result.evidence.asking_count, 3); assert.equal(o.valuation.result.evidence.verified_transaction_count, 0); assert.match(o.valuation.result.explanations[0], /Asking evidence is never a verified deal/);
});
test('external estimates never silently become verified deals', () => {
  const i = input(); i.observations[0].evidence_kind = 'external_estimate'; insufficient(i);
});
test('VAL03 existing exact-source dedup reused', () => {
  const i = input(), o = append(i, i.observations[0], 99); o.source.source_record_id = i.observations[0].source.source_record_id;
  const r = run(i); assert.deepEqual(r.valuation.result.sale_range, fixture.sale_oracle); assert.equal(r.internal.trace.length, 3); assert.ok(r.internal.exclusions.some(x => x.reason === 'duplicate'));
});
test('VAL03 cross-site same unit receives one weight, latest known record selected', () => {
  const i = input(); sourceB(i); const o = append(i, i.observations[0], 99); o.source.source_id = 'synthetic-b'; o.observed_at = o.source.collected_at = '2026-09-21T00:00:00.000Z';
  i.unit_links.at(-1).unit_id = i.unit_links[0].unit_id;
  const r = run(i); assert.deepEqual(r.valuation.result.sale_range, fixture.sale_oracle); assert.equal(r.internal.trace.length, 3); assert.ok(r.internal.trace.some(t => t.observation_id === id(99))); assert.ok(r.internal.exclusions.some(x => x.reason === 'cross_site_same_unit'));
});
test('unresolved/foreign/future-reviewed unit links are not inferred from addresses', () => {
  for (const mutate of [i => i.unit_links.pop(), i => { i.unit_links[0].workspace_id = id(88); }, i => { i.unit_links[0].reviewed_at = '2026-10-02T00:00:00Z'; }]) { const i = input(); mutate(i); insufficient(i); }
});
test('VAL04 existing FX normalization:EUR->RON5, independent central1million', () => {
  const i = input(); i.quality_policy.target_currency = 'RON'; i.quality_policy.fx_rates = [{ from_currency: 'EUR', to_currency: 'RON', rate: '5', effective_at: '2026-09-01T00:00:00Z', published_at: '2026-09-01T00:00:00Z', source_ref: 'synthetic://fx' }];
  assert.equal(run(i).valuation.result.sale_range.central, '1000000.00'); assert.ok(run(i).internal.trace.every(t => t.fx_source_ref === 'synthetic://fx'));
});
test('missing FX produces insufficient, not assumed currency equivalence', () => { const i = input(); i.quality_policy.target_currency = 'USD'; insufficient(i); });
test('VAL04 sqft normalization reuses exact0.09290304, total value unchanged', () => {
  const i = input(); i.resource.attributes.area_unit = 'sqft'; i.observations.forEach(o => { o.area_unit = 'sqft'; }); assert.deepEqual(run(i).valuation.result.sale_range, fixture.sale_oracle);
});
test('VAL04 rent is independent monthly series; no sale conversion', () => {
  const i = input(); i.policy.transaction_kind = 'rent'; i.policy.rental_period = 'month'; i.request.purposes = ['rental_recommendation'];
  insufficient(i); i.observations.forEach((o, n) => { o.transaction_kind = 'rent'; o.attributes.rental_period = 'month'; o.amount = String((n + 1) * 500); o.area = '50'; });
  const o = run(i); assert.equal(o.valuation.result.sale_range, null); assert.deepEqual(o.valuation.result.rent_range, fixture.rent_oracle); assert.ok(o.valuation.result.explanations.some(x => x.includes('Rent basis=month')));
  i.observations[0].attributes.rental_period = 'year'; insufficient(i);
});
test('missing/zero/nonstring subject area never inferred as zero or coercion', () => {
  for (const value of [undefined, null, '0', 100]) { const i = input(); if (value === undefined) delete i.resource.attributes.area; else i.resource.attributes.area = value; insufficient(i); }
});
test('missing comparable area or subject condition is insufficient', () => {
  const i = input(); delete i.observations[0].area; delete i.observations[0].area_unit; insufficient(i); const j = input(); delete j.resource.attributes.condition; insufficient(j);
});
test('VAL05 no observations means valid insufficient result/null evidence window', () => {
  const i = input(); i.observations = []; i.unit_links = []; i.sources = []; const o = insufficient(i); assert.equal(o.valuation.result.evidence.oldest_observed_at, null); assert.equal(o.valuation.result.quality_score, 0);
});
test('VAL05 stale/quarantine and source-specific freshness respected', () => {
  for (const mutate of [o => { o.observed_at = o.source.collected_at = '2020-01-01T00:00:00Z'; }, o => { o.quarantined = true; o.quarantine_reasons = ['synthetic invalid']; }]) { const i = input(); mutate(i.observations[0]); insufficient(i); }
  const i = input(); i.sources[0].freshness_days = 1; insufficient(i);
});
test('VAL05 explicit median ratio policy excludes outlier without rewriting raw evidence', () => {
  const i = input(); const o = append(i, i.observations[0], 98); o.amount = '8000000'; const before = JSON.stringify(i); const r = run(i);
  assert.deepEqual(r.valuation.result.sale_range, fixture.sale_oracle); assert.ok(r.internal.exclusions.some(x => x.reason === 'outlier_unit_price')); assert.equal(JSON.stringify(i), before); assert.equal(r.stage, 'review_required');
});
test('VAL06 nonidentity index now NOT_READY; duplicate declarations remain invalid', () => {
  const i=input();i.policy.time_adjustments=i.observations.map(o=>({observation_id:o.observation_id,factor:'1.1',from:o.observed_at,to:i.as_of,published_at:i.as_of,index_version:'synthetic-index1',evidence_ref:'synthetic://price-index',basis:'target_currency_property_index'}));
  assert.deepEqual(run(i),{stage:'not_ready',reason:'valuation_unavailable'});
  i.policy.time_adjustments.push(clone(i.policy.time_adjustments[0]));deny(i);
});
test('VAL06 pre-adjusted or unknown adjustment state never double-adjusted', () => {
  for (const state of [true, undefined]) { const i = input(); if (state === undefined) delete i.observations[0].attributes.time_adjusted; else i.observations[0].attributes.time_adjusted = state; insufficient(i); }
});
test('VAL07 future index/publication and wrong interval rejected before numeric use', () => {
  for (const delta of [{ published_at: '2026-10-02T00:00:00Z' }, { from: '2026-09-01T00:00:00Z' }, { to: '2026-10-02T00:00:00Z' }]) {
    const i = input(); i.policy.time_adjustments = [{ observation_id: i.observations[0].observation_id, factor: '9', from: i.observations[0].observed_at, to: i.as_of, published_at: i.as_of, index_version: 'synthetic-1', evidence_ref: 'synthetic://future-index', basis: 'target_currency_property_index', ...delta }]; assert.deepEqual(run(i),{stage:'not_ready',reason:'valuation_unavailable'});
  }
});
test('VAL07 future observation/collection and future FX not used', () => {
  for (const field of ['observed_at', 'collected_at']) { const i = input(); if (field === 'observed_at') i.observations[0].observed_at = '2026-10-02T00:00:00Z'; else i.observations[0].source.collected_at = '2026-10-02T00:00:00Z'; insufficient(i); }
  const i = input(); i.quality_policy.target_currency = 'RON'; i.quality_policy.fx_rates = [{ from_currency: 'EUR', to_currency: 'RON', rate: '5', effective_at: '2026-09-01T00:00:00Z', published_at: '2026-10-02T00:00:00Z', source_ref: 'synthetic://future-fx' }]; insufficient(i);
});
test('VAL10 reproducibility under observation/source/link order and identical retry', () => {
  const i = input(); sourceB(i); const a = run(i); i.observations.reverse(); i.sources.reverse(); i.unit_links.reverse(); i.policy.source_weights.reverse(); assert.deepEqual(run(i), a); assert.deepEqual(run(input()), run(input()));
});
test('VAL10 changes to facts/source/model/policy versions change run lineage', () => {
  const base = run(input()); for (const mutate of [i => { i.observations[0].attributes.condition = 'fair'; }, i => { i.sources[0].source_version = 'v2'; }, i => { i.policy.model_version = 'v2'; }, i => { i.policy.policy_version = i.quality_policy.policy_version = 'policy2'; }]) { const i = input(); mutate(i); assert.notEqual(run(i).run_version, base.run_version); }
});
test('VAL12 Core denied/revoked/stale evidence -> uniform zero-disclosure denial', () => {
  for (const mutate of [i => { i.core_evidence.authority.decision = 'denied'; i.core_evidence.authority.reason_codes = ['current_effective_permission_denied']; }, i => { i.core_evidence.relationship.relationship_status = 'revoked'; }, i => { i.core_evidence.authority.evaluated_at = '2026-09-30T00:00:00Z'; }, i => { i.core_evidence.resource.resource_version++; }, i => { i.core_evidence.relationship.tenant_id = id(88); }]) { const i = input(); mutate(i); deny(i); }
});
test('VAL12 foreign observations and source rights/retention not disclosed or counted', () => {
  for (const mutate of [i => { i.observations[0].workspace_id = id(88); }, i => { i.sources[0].rights.workspace_id = id(88); }, i => { i.sources[0].review_state = 'revoked'; }, i => { i.sources[0].rights.raw_retention_until = i.computed_at; }, i => { i.sources[0].rights.derived_retention_until = i.computed_at; }, i => { i.sources[0].rights.permitted_uses = ['model_training']; }]) { const i = input(); mutate(i); deny(i); }
});
test('read projection rechecks current rights; derived result can outlive raw retention', () => {
  const i = input(), result = run(i); i.sources[0].rights.raw_retention_until = i.computed_at;
  const projected = projection(i, result); assert.deepEqual(projected, { valuation: result.valuation }); assert.equal(JSON.stringify(projected).includes('synthetic-a'), false);
  assert.deepEqual(projection(i, result, 'comparable_display'), { stage: 'blocked', reason: 'valuation_unavailable' });
});
test('read projection requires separate comparable disclosure and no revoked reuse', () => {
  const i = input(), result = run(i); assert.equal(projection(i, result, 'comparable_display').comparables.length, 3);
  i.sources[0].rights.permitted_uses = ['quality_evaluation', 'result_display']; assert.deepEqual(projection(i, result, 'comparable_display'), { stage: 'blocked', reason: 'valuation_unavailable' });
  i.sources[0].review_state = 'revoked'; assert.deepEqual(projection(i, result), { stage: 'blocked', reason: 'valuation_unavailable' });
});
test('read projection never substitutes a stale/foreign resource decision', () => {
  const i = input(), result = run(i); i.core_evidence.relationship.relationship_status = 'revoked'; assert.deepEqual(projection(i, result), { stage: 'blocked', reason: 'valuation_unavailable' });
});
test('rounding oracle:0.005 half_up ->0.01, outward envelope floor/ceil', () => {
  assert.equal(renderRatio(decimalRatio('0.005'), 2, 'half_up'), '0.01'); assert.equal(renderRatio(decimalRatio('0.005'), 2, 'floor'), '0.00'); assert.equal(renderRatio(decimalRatio('0.005'), 2, 'ceil'), '0.01');
});
test('sub-cent/oversized values never escape strict numeric contract', () => { const i = input(); i.observations.forEach(o => { o.amount = '0.0001'; o.area = '100'; }); insufficient(i); });
test('malformed/duplicate IDs/unsupported policy/mismatched tuple fail closed', () => {
  for (const mutate of [i => { i.observations[1].observation_id = i.observations[0].observation_id; }, i => { i.unit_links.push(clone(i.unit_links[0])); }, i => { i.policy.min_comparables = 0; }, i => { i.request.resource_id = id(88); }, i => { i.resource.snapshot_as_of = '2026-10-02T00:00:00Z'; }, i => { i.policy.transaction_kind = 'sale'; i.policy.rental_period = 'month'; }]) { const i = input(); mutate(i); deny(i); }
});
test('VAL14 compute does not mutate listing/journal/ownership/input or invoke transport', () => {
  const i = input(), text = JSON.stringify(i); const original = globalThis.fetch; globalThis.fetch = () => { assert.fail('no network permitted'); };
  try { run(i); assert.equal(JSON.stringify(i), text); const publicResult = projection(i, run(i)); assert.equal(JSON.stringify(publicResult).includes('source_record_id'), false); } finally { globalThis.fetch = original; }
});
test('subject location basis must match selected policy geography', () => {
  const i = input(); delete i.resource.attributes.market_location_key; insufficient(i);
  i.resource.attributes.market_location_key = 'RO/B/another-zone'; insufficient(i);
});
test('exact large decimals do not collapse to Number arithmetic', () => {
  const i = input(); i.observations.forEach(o => { o.amount = '9007199254740991.01'; });
  const o = run(i); assert.equal(o.valuation.result.sale_range.central, '9007199254740991.01');
});
test('time-index version and source corrections change deterministic lineage', () => {
  const i = input(); const base = run(i); i.observations[0].source.source_record_id = 'corrected-record'; assert.notEqual(run(i).run_version, base.run_version);
});
test('identical numerical result still changes dataset identity on attribute correction', () => {
  const i = input(); const base = run(i); i.observations[0].attributes.optional_note = 'corrected'; const next = run(i);
  assert.deepEqual(next.valuation.result.sale_range, base.valuation.result.sale_range); assert.notEqual(next.valuation.result.dataset_version, base.valuation.result.dataset_version);
});
test('future review/expired source and copied historical read evidence fail closed', () => {
  const i = input(); i.sources[0].rights.reviewed_at = '2026-10-02T00:00:00Z'; deny(i);
  const j = input(); j.sources[0].rights.effective_until = j.computed_at; deny(j);
  const k = input(), result = run(k);
  const old = engine.projectValuationBaselineV1({trusted_preparation:reference.get(result),run:result,resource:k.resource,core_request:k.core_request,core_evidence:k.core_evidence,sources:k.sources,read_at:'2026-10-02T00:00:00Z',detail:'result_display'});
  assert.deepEqual(old,{stage:'blocked',reason:'valuation_unavailable'});
});
test('incomplete internal provenance is not a public result disclosure token', () => {
  const i = input(), result = run(i); result.internal.source_ids = []; assert.deepEqual(projection(i,result),{stage:'blocked',reason:'valuation_unavailable'});
});
test('insufficient evidence counts also require source provenance on display', () => {
  const i = input(); i.observations.pop(); i.unit_links.pop(); const result = insufficient(i); result.internal.source_ids = [];
  assert.deepEqual(projection(i,result),{stage:'blocked',reason:'valuation_unavailable'});
});
test('pilot apartment comparables do not silently become an office model', () => {
  const i = input(); i.resource.attributes.unit_kind = 'office'; insufficient(i);
});
function canonical211(v){
  if(Array.isArray(v))return '['+v.map(canonical211).join(',')+']';
  if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical211(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
const sha211=v=>createHash('sha256').update(canonical211(v)).digest('hex');
// Adversary can coherently recompute every unkeyed digest. The independent server
// reference below is never derived from this altered run.
function reseal211(r){
  r.result_commitment=sha211({contract:'valuation-baseline-result-content.v2',valuation:r.valuation,internal:r.internal});
  const {run_version,...content}=r;void run_version;
  r.run_version=sha211({contract:'valuation-baseline-computation.v2',computation:content});return r;
}
function project211(i,r,trusted,detail='result_display',diagnose){
  return engine.projectValuationBaselineV1({trusted_preparation:trusted,run:r,resource:i.resource,
    core_request:i.core_request,core_evidence:i.core_evidence,sources:i.sources,read_at:i.computed_at,detail},diagnose);
}
const generic211={stage:'blocked',reason:'valuation_unavailable'};
function denied211(i,r,trusted,reason,detail='result_display'){
  const diagnostics=[];const out=project211(i,r,trusted,detail,c=>diagnostics.push(c));
  assert.deepEqual(out,generic211);assert.deepEqual(diagnostics,[reason]);
  assert.equal(JSON.stringify(out).includes('LEAK-ME'),false);
}
function rent211(period='month'){
  const i=input();i.policy.transaction_kind='rent';i.policy.rental_period=period;i.request.purposes=['rental_recommendation'];
  i.observations.forEach((o,n)=>{o.transaction_kind='rent';o.attributes.rental_period=period;o.amount=String((n+1)*500);o.area='50';});return i;
}
function index211(i,factor='2'){
  i.policy.time_adjustments=i.observations.map(o=>({observation_id:o.observation_id,factor,from:o.observed_at,to:i.as_of,
    published_at:i.as_of,index_version:'UNPROVEN',evidence_ref:'UNPROVEN-INDEX',basis:'target_currency_property_index'}));return i;
}

test('SR-01 authentic recomputed run projects strict result/comparables; insufficient positive',()=>{
  for(const sparse of [false,true]){
    const i=input();if(sparse){i.observations=[];i.unit_links=[];i.sources=[];}
    const trusted=prepared(i),r=engine.computeValuationBaselineV1(trusted);
    assert.notEqual(r.stage,'blocked');assert.notEqual(r.stage,'not_ready');
    const basic=project211(i,r,trusted);assert.deepEqual(basic,{valuation:r.valuation});
    assert.deepEqual(project211(i,r,trusted,'comparable_display'),{valuation:r.valuation,comparables:r.internal.trace});
    assert.equal(JSON.stringify(basic).includes('core_evidence'),false);assert.equal(JSON.stringify(basic).includes('prepared_commitment'),false);
  }
});
for(const detail of ['result_display','comparable_display']){
  for(const resealed of [false,true])test(`SR-01 SERVICE changed result/hash ${detail} resealed=${resealed}`,()=>{
    const i=input(),trusted=prepared(i),r=clone(engine.computeValuationBaselineV1(trusted));
    r.valuation.result.sale_range.central='250001.00';if(resealed)reseal211(r);else r.run_version='not-a-hash';
    denied211(i,r,trusted,resealed?'RUN_BINDING_MISMATCH':'RUN_INVALID',detail);
  });
  for(const hash of ['run_version','prepared_commitment','result_commitment'])for(const value of [undefined,'broken','0'.repeat(64)])test(`SR-01 ${detail} missing/invalid/different ${hash} ${String(value).slice(0,8)}`,()=>{
    const i=input(),trusted=prepared(i),r=clone(engine.computeValuationBaselineV1(trusted));
    if(value===undefined)delete r[hash];else r[hash]=value;
    denied211(i,r,trusted,value?.length===64?'RUN_BINDING_MISMATCH':'RUN_INVALID',detail);
  });
  const extraPaths=[[],['internal'],['internal','trace',0],['internal','exclusions'],['valuation'],['valuation','result'],['valuation','result','evidence']];
  for(const path of extraPaths)test(`SR-01 extra/private run keys ${detail}/${path.join('.')||'root'}`,()=>{
    const i=input(),trusted=prepared(i),r=clone(engine.computeValuationBaselineV1(trusted));
    if(path.at(-1)==='exclusions')r.internal.exclusions.push({observation_id:id(88),reason:'extra',private_payload:'LEAK-ME'});
    else{let target=r;for(const key of path)target=target[key];target.private_payload='LEAK-ME';}
    denied211(i,r,trusted,'RUN_INVALID',detail);
  });
  for(const mutate of [r=>{r.internal.trace[0].source_version='forged';},r=>{r.internal.trace[0].source_id='foreign';},r=>{r.internal.trace[0].weight=999;},r=>{r.internal.source_ids=[];},r=>{r.internal.trace=[];},r=>{r.internal.source_ids.push('another');}])test(`SR-01 coherent private binding mutation ${detail}/${mutate.toString().slice(4,52)}`,()=>{
    const i=input(),trusted=prepared(i),r=clone(engine.computeValuationBaselineV1(trusted));mutate(r);reseal211(r);denied211(i,r,trusted,'RUN_BINDING_MISMATCH',detail);
  });
  for(const member of ['internal','valuation'])test(`SR-01 incomplete ${member}/${detail}`,()=>{
    const i=input(),trusted=prepared(i),r=clone(engine.computeValuationBaselineV1(trusted));delete r[member];denied211(i,r,trusted,'RUN_INVALID',detail);
  });
}
for(const path of [[],['input'],['input','request'],['input','core_request'],['input','core_evidence','authority'],['input','quality_policy'],['input','sources',0,'rights']])test(`SR-01 prepared extra key ${path.join('.')||'root'}`,()=>{
  const i=input(),trusted=prepared(i);let t=trusted;for(const k of path)t=t[k];t.private_payload={secret:'LEAK-ME'};
  const codes=[];assert.deepEqual(engine.computeValuationBaselineV1(trusted,c=>codes.push(c)),generic211);assert.deepEqual(codes,['PREPARED_INVALID']);
});
test('SR-01 prepared version/missing/null and top-level projection extra rejected',()=>{
  for(const mutate of [p=>{delete p.contract;},p=>{p.contract='v0';},p=>{p.input=null;}]){
    const p=prepared(input());mutate(p);assert.deepEqual(engine.computeValuationBaselineV1(p),generic211);
  }
  const i=input(),p=prepared(i),r=engine.computeValuationBaselineV1(p),codes=[];
  assert.deepEqual(engine.projectValuationBaselineV1({trusted_preparation:p,run:r,resource:i.resource,core_request:i.core_request,core_evidence:i.core_evidence,sources:i.sources,read_at:i.computed_at,detail:'comparable_display',private_payload:'LEAK-ME'},c=>codes.push(c)),generic211);
  assert.deepEqual(codes,['PROJECT_INVALID']);
});
test('SR-01 immutable independent reference not modified by compute or projection',()=>{
  const i=input(),p=prepared(i);const frozen=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
  const before=JSON.stringify(p);frozen(p);const r=engine.computeValuationBaselineV1(p);assert.equal(r.stage,'calculated');project211(i,r,p,'comparable_display');assert.equal(JSON.stringify(p),before);
});
test('SR-01 current source revoke/retention and Core denial still checked after recomputation',()=>{
  const i=input(),p=prepared(i),r=engine.computeValuationBaselineV1(p);
  i.sources[0].review_state='revoked';denied211(i,r,p,'SOURCE_USE_DENIED');i.sources=input().sources;
  i.core_evidence.relationship.relationship_status='revoked';denied211(i,r,p,'CURRENT_READ_DENIED');
});
test('SR-01 derived result after raw retention still distinct from comparable disclosure',()=>{
  const i=input(),p=prepared(i),r=engine.computeValuationBaselineV1(p);i.sources[0].rights.raw_retention_until=i.computed_at;
  assert.deepEqual(project211(i,r,p),{valuation:r.valuation});denied211(i,r,p,'SOURCE_USE_DENIED','comparable_display');
});

const lineageMutations=[
 ['receipt request identity',i=>{i.request.request_id=id(70);}],
 ['receipt key',i=>{i.request.idempotency_key='synthetic-new-key';}],
 ['Core matched decision ID',i=>{i.core_request.authority.decision_id=i.core_evidence.authority.decision_id=id(71);}],
 ['Core private evidence label',i=>{i.core_evidence.resource.display_name='another trusted label';}],
 ['Core relationship version',i=>{i.core_request.relationship.relationship_version=i.core_evidence.relationship.relationship_version=3;}],
 ['source rights reference',i=>{i.sources[0].rights.evidence_ref='synthetic://different-rights';}],
 ['source version',i=>{i.sources[0].source_version='source-v2';}],
 ['full quality freshness',i=>{i.quality_policy.freshness_days.asking=89;}],
 ['snapshot optional attribute',i=>{i.resource.attributes.note='changed';}],
 ['unit review reference',i=>{i.unit_links[0].review_ref='another-reviewed-link';}],
];
for(const [name,mutate] of lineageMutations)test(`SR-02 complete prepared commitment: ${name}`,()=>{
  const i=input(),old=run(i);mutate(i);const next=run(i);assert.equal(next.stage,'calculated');
  assert.deepEqual(next.valuation.result.sale_range,old.valuation.result.sale_range);assert.notEqual(next.prepared_commitment,old.prepared_commitment);assert.notEqual(next.run_version,old.run_version);
});
function fx211(){const i=input();i.quality_policy.target_currency='RON';i.quality_policy.fx_rates=[{from_currency:'EUR',to_currency:'RON',rate:'5',effective_at:'2026-09-01T00:00:00Z',published_at:'2026-09-01T00:00:00Z',source_ref:'synthetic://FX1'}];return i;}
for(const field of ['published_at','effective_at','source_ref','rate'])test(`SR-02 full FX record ${field} binds lineage even when numerical amount is equal`,()=>{
  const i=fx211(),a=run(i);
  if(field==='published_at'||field==='effective_at')i.quality_policy.fx_rates[0][field]='2026-09-02T00:00:00Z';
  else if(field==='source_ref')i.quality_policy.fx_rates[0].source_ref='synthetic://FX2';else i.quality_policy.fx_rates[0].rate='5.0000';
  const b=run(i);assert.deepEqual(a.valuation.result.sale_range,b.valuation.result.sale_range);assert.notEqual(a.prepared_commitment,b.prepared_commitment);assert.notEqual(a.run_version,b.run_version);
});
test('SR-02 unused full FX metadata/currency pair bound; set order stable',()=>{
  const i=fx211(),a=run(i);i.quality_policy.fx_rates.push({from_currency:'GBP',to_currency:'USD',rate:'2',effective_at:i.as_of,published_at:i.as_of,source_ref:'synthetic://unused'});
  const b=run(i);assert.deepEqual(a.valuation.result.sale_range,b.valuation.result.sale_range);assert.notEqual(a.prepared_commitment,b.prepared_commitment);
  i.quality_policy.fx_rates.reverse();assert.deepEqual(run(i),b);
});
test('SR-02 set order canonical; meaningful arrays and missing/null bound',()=>{
  const i=input();i.request.purposes.push('portfolio_report');sourceB(i);const a=run(i);
  i.request.purposes.reverse();i.sources.reverse();i.observations.reverse();i.unit_links.reverse();i.policy.source_weights.reverse();i.sources.forEach(s=>{s.evidence_kinds.reverse();s.rights.permitted_uses.reverse();});assert.deepEqual(run(i),a);
  const absent=input(),explicit=input();explicit.resource.attributes.optional_note=null;
  assert.notEqual(run(absent).prepared_commitment,run(explicit).prepared_commitment);
  const ordered=input(),r=run(ordered);ordered.policy.match_attributes.reverse();assert.notEqual(run(ordered).prepared_commitment,r.prepared_commitment);
  const duplicate=prepared(input());duplicate.input.request.purposes.push(duplicate.input.request.purposes[0]);assert.deepEqual(engine.computeValuationBaselineV1(duplicate),generic211);
});
test('SR-02 independent reference change rejects an old otherwise valid run',()=>{
  const i=input(),original=prepared(i),r=engine.computeValuationBaselineV1(original),changed=clone(original);
  changed.input.core_request.authority.decision_id=changed.input.core_evidence.authority.decision_id=id(72);
  denied211(i,r,changed,'RUN_BINDING_MISMATCH');
});
for(const period of ['month','year'])test(`SR-03 machine readable ${period} rent wrapper uses existing result and purpose`,()=>{
  const i=rent211(period),p=prepared(i),r=engine.computeValuationBaselineV1(p);
  assert.equal(r.valuation.contract,'valuation-baseline-result.v1');assert.equal(r.valuation.transaction_kind,'rent');assert.equal(r.valuation.rental_period,period);
  assert.equal(r.valuation.amount_basis,'subject_total');assert.equal(r.valuation.area_unit,'sqm');assert.equal(r.valuation.currency,'EUR');assert.deepEqual(r.valuation.result.rent_range,fixture.rent_oracle);
  assert.deepEqual(project211(i,r,p),{valuation:r.valuation});
});
for(const period of ['month','year'])for(const mutate of [r=>{delete r.valuation.rental_period;},r=>{r.valuation.rental_period=r.valuation.rental_period==='month'?'year':'month';},r=>{r.valuation.transaction_kind='sale';r.valuation.rental_period=null;},r=>{r.valuation.amount_basis='per_sqm';},r=>{r.valuation.currency='USD';}])test(`SR-03 tampered/missing basis ${period}/${mutate.toString().slice(4,55)}`,()=>{
  const i=rent211(period),p=prepared(i),r=clone(engine.computeValuationBaselineV1(p));mutate(r);reseal211(r);
  const schema=engine.valuationBaselineRunV2Schema.safeParse(r);denied211(i,r,p,schema.success?'RUN_BINDING_MISMATCH':'RUN_INVALID');
});
test('SR-03 sale requires explicit null period and matching read wrapper',()=>{
  const i=input(),p=prepared(i),r=engine.computeValuationBaselineV1(p);assert.equal(r.valuation.rental_period,null);
  const altered=clone(r);altered.valuation.rental_period='month';reseal211(altered);denied211(i,altered,p,'RUN_INVALID');
});
for(const factor of ['0.5','1.1','2','999'])test(`SR-04 unsupported nonidentity factor ${factor} is NOT_READY before baseline`,()=>{
  const i=index211(input(),factor),codes=[];assert.deepEqual(engine.computeValuationBaselineV1(prepared(i),c=>codes.push(c)),{stage:'not_ready',reason:'valuation_unavailable'});assert.deepEqual(codes,['INDEX_PRODUCER_NOT_READY']);
});
for(const mutation of [i=>{i.policy.time_adjustments[0].published_at='2026-10-02T00:00:00Z';},i=>{i.policy.time_adjustments[0].evidence_ref='any-unproven-rights';},i=>{i.policy.time_adjustments[0].index_version='market-mismatch';}])test(`SR-04 future/ref/version cannot authorize multiplier ${mutation.toString().slice(4,65)}`,()=>{
  const i=index211(input());mutation(i);assert.deepEqual(run(i),{stage:'not_ready',reason:'valuation_unavailable'});
});
for(const key of ['market','source_id','source_version','currency','rental_period','rights','producer_artifact'])test(`SR-04 unaccepted producer/rights extension ${key} is not smuggled through schema`,()=>{
  const i=index211(input());i.policy.time_adjustments[0][key]=key==='rights'?{review_state:'revoked',retention_until:i.as_of}:'UNSUPPORTED';deny(i);
});
test('SR-04 identity index produces no provenance assertion and keeps accepted arithmetic',()=>{
  const i=index211(input(),'1.0000'),p=prepared(i),r=engine.computeValuationBaselineV1(p);
  assert.deepEqual(r.valuation.result.sale_range,fixture.sale_oracle);assert.ok(r.internal.trace.every(t=>t.time_factor==='1.0000'&&t.index_ref===null&&t.index_version===null));
  const basic=project211(i,r,p);assert.deepEqual(basic,{valuation:r.valuation});assert.equal(JSON.stringify(basic).includes('UNPROVEN-INDEX'),false);
});
test('SR-04 adjusted reference can never project an unadjusted/tampered result',()=>{
  const i=input(),r=run(i),adjusted=prepared(index211(input(),'2'));denied211(i,r,adjusted,'RECOMPUTATION_UNAVAILABLE');
});

test('SR-01 current inventory version cannot substitute a different prepared source version',()=>{
  const i=input(),p=prepared(i),r=engine.computeValuationBaselineV1(p);i.sources[0].source_version='another-version';
  denied211(i,r,p,'SOURCE_USE_DENIED');denied211(i,r,p,'SOURCE_USE_DENIED','comparable_display');
});
test('SR-02 undefined optional value is rejected; missing/null are never collapsed',()=>{
  const p=prepared(input());p.input.resource.location.latitude=undefined;
  const codes=[];assert.deepEqual(engine.computeValuationBaselineV1(p,c=>codes.push(c)),generic211);assert.deepEqual(codes,['PREPARED_INVALID']);
  const q=prepared(input());q.input.resource.attributes.optional_note=null;assert.notEqual(engine.computeValuationBaselineV1(q).stage,'blocked');
});
test('SR-02 numerical/result commitment is separate from complete prepared evidence',()=>{
  const i=input(),a=run(i);i.core_request.authority.decision_id=i.core_evidence.authority.decision_id=id(85);const b=run(i);
  assert.equal(a.result_commitment,b.result_commitment);assert.notEqual(a.prepared_commitment,b.prepared_commitment);assert.notEqual(a.run_version,b.run_version);
});
test('SR-01 non-JSON accessor exceptions are also denied without private message',()=>{
  const codes=[],raw={};Object.defineProperty(raw,'run',{get(){throw new Error('LEAK-ME');}});
  assert.deepEqual(engine.projectValuationBaselineV1(raw,c=>codes.push(c)),generic211);assert.deepEqual(codes,['PROJECT_INVALID']);
});
console.log(`PASS ${count} selected ${selectedGroup} offline cases. VAL08/09 real backtest, VAL11 persisted override/revocation, VAL13 DB concurrency and installed current authority: NOT_RUN_NOT_PASS.`);
