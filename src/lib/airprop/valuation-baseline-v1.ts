import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  resourceValuationInputV1Schema, marketObservationV1Schema,
  valuationRequestReceiptV1Schema, resourceValuationResultV1Schema,
} from './valuation-contract-v1';
import { evaluateValuationObservationQualityV1, valuationQualityPolicyV1Schema } from './valuation-quality-v1';
import { evaluateValuationSourceReadinessV1, valuationSourceInventoryV1Schema } from './valuation-source-readiness-v1';
import {
  coreResourceAuthorityRequestV1Schema, coreResourceAuthorityEvidenceV1Schema,
  evaluateCoreResourceAuthorityV1,
} from '../core/resource-authority-contract-v1';
import {
  valuationBaselinePolicyV1Schema, decimalRatio, addRatio, multiplyRatio,
  divideRatio, compareRatio, renderRatio, type Ratio,
} from './valuation-baseline-policy-v1';
import { explainValuationBaselineV1, valuationComparableTraceV2Schema, valuationBaselineResultV1Schema,
  projectValuationComparableV2, type ValuationComparableTraceV1 } from './valuation-baseline-explanation-v1';

const inputSchema = z.strictObject({
  resource: resourceValuationInputV1Schema,
  request: valuationRequestReceiptV1Schema,
  as_of: z.string().datetime({ offset: true }),
  computed_at: z.string().datetime({ offset: true }),
  policy: valuationBaselinePolicyV1Schema,
  quality_policy: valuationQualityPolicyV1Schema,
  observations: z.array(marketObservationV1Schema).max(500),
  sources: z.array(valuationSourceInventoryV1Schema).max(100),
  // Independently curated, workspace-scoped unit grouping; no address/asking-price
  // heuristic invents a canonical unit or a confidence/verification decision.
  unit_links: z.array(z.strictObject({ observation_id: z.string().uuid(), workspace_id: z.string().uuid(),
    unit_id: z.string().min(1).max(160), review_ref: z.string().min(1).max(240), reviewed_at: z.string().datetime({ offset: true }) })).max(500),
  core_request: coreResourceAuthorityRequestV1Schema,
  core_evidence: coreResourceAuthorityEvidenceV1Schema,
});
type Input = z.infer<typeof inputSchema>;
type Result = z.infer<typeof resourceValuationResultV1Schema>;
const digest = z.string().regex(/^[0-9a-f]{64}$/);
export const valuationBaselinePreparedInputV2Schema = z.strictObject({
  contract: z.literal('valuation-baseline-prepared-input.v2'), input: inputSchema,
});
export const valuationBaselineRunV2Schema = z.strictObject({
  contract:z.literal('valuation-baseline-run.v2'),
  stage:z.enum(['insufficient_data','review_required','calculated']),
  prepared_commitment:digest, result_commitment:digest, run_version:digest,
  valuation:valuationBaselineResultV1Schema,
  internal:z.strictObject({
    source_ids:z.array(z.string().min(1).max(240)).max(100),
    trace:z.array(valuationComparableTraceV2Schema).max(500),
    exclusions:z.array(z.strictObject({observation_id:z.string().uuid(),reason:z.string().regex(/^[a-z_]+$/)})).max(500),
  }),
});
export type ValuationBaselineRunV1 = z.infer<typeof valuationBaselineRunV2Schema>;
export type ValuationBaselineDiagnosticV2 = 'PREPARED_INVALID' | 'COMPUTATION_UNAVAILABLE' | 'INDEX_PRODUCER_NOT_READY' |
  'PROJECT_INVALID' | 'RUN_INVALID' | 'RUN_BINDING_MISMATCH' | 'RECOMPUTATION_UNAVAILABLE' | 'CURRENT_READ_DENIED' | 'SOURCE_USE_DENIED';
type Diagnostic = (reason: ValuationBaselineDiagnosticV2) => void;
const notReady = () => ({stage:'not_ready' as const,reason:'valuation_unavailable' as const});
const blocked = () => ({ stage: 'blocked' as const, reason: 'valuation_unavailable' as const });
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  }
  const encoded=JSON.stringify(value);
  if(encoded===undefined)throw new Error('non_JSON_prepared_value');
  return encoded;
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const at = (s: string) => Date.parse(s);
function canonicalPreparedInput(unparsed: unknown): {contract:'valuation-baseline-prepared-input.v2';input:Input} {
  const envelope = valuationBaselinePreparedInputV2Schema.parse(unparsed);
  // Reject explicitly undefined optional values; missing and null remain distinct.
  // Zod has already rejected nonfinite numbers and non-contract value types.
  canonical(envelope);
  const i = envelope.input;
  const set = (items:string[]) => {
    if(new Set(items).size!==items.length)throw new Error('duplicate_prepared_set_member');
    return [...items].sort(order);
  };
  i.request.purposes=set(i.request.purposes) as Input['request']['purposes'];
  i.core_request.relationship.required_scope_codes=set(i.core_request.relationship.required_scope_codes);
  if(i.core_evidence.relationship)i.core_evidence.relationship.scope_codes=set(i.core_evidence.relationship.scope_codes);
  i.observations.sort((a,b)=>order(a.observation_id,b.observation_id));
  i.sources.sort((a,b)=>order(a.source_id,b.source_id));
  i.unit_links.sort((a,b)=>order(a.observation_id,b.observation_id));
  i.policy.source_weights.sort((a,b)=>order(a.source_id,b.source_id));
  i.policy.time_adjustments.sort((a,b)=>order(a.observation_id,b.observation_id));
  i.quality_policy.fx_rates.sort((a,b)=>order(canonical(a),canonical(b)));
  for(const source of i.sources){
    source.evidence_kinds=set(source.evidence_kinds) as typeof source.evidence_kinds;
    if(source.rights)source.rights.permitted_uses=set(source.rights.permitted_uses) as typeof source.rights.permitted_uses;
  }
  return envelope;
}
function currentReadBinding(i: Pick<Input, 'core_request' | 'core_evidence' | 'computed_at' | 'resource'>) {
  const d = evaluateCoreResourceAuthorityV1(i.core_request, i.core_evidence);
  return d.decision === 'allowed' && at(d.evaluated_at) === at(i.computed_at) &&
    d.resource_identity.resource_id === i.resource.resource_id && d.resource_identity.resource_version === i.resource.resource_version &&
    d.resource_identity.resource_type === i.resource.resource_type && d.workspace_id === i.resource.workspace_id &&
    i.core_request.resource.resource_id === i.resource.resource_id;
}
function sourceReady(source: Input['sources'][number], workspace: string, time: string, use: 'quality_evaluation' | 'result_display' | 'comparable_display') {
  // Authority is derived only after canonical evaluator binding, never a client bool.
  return evaluateValuationSourceReadinessV1({ source, workspace_id: workspace, as_of: time,
    intended_use: use, has_current_workspace_authority: true }).readiness === 'evidence_ready';
}

/** Trusted server-side preparation, not an HTTP command or an authority producer.
 * Existing Core evaluator verifies the resource READ evidence, not a new valuation
 * action. A live entry must obtain current, accepted action permission independently.
 * Synthetic/curated inputs here prove calculation, never authenticity or live rights.
 */
function computePreparedValuationBaselineV1(envelope: ReturnType<typeof canonicalPreparedInput>, diagnose?:Diagnostic): ValuationBaselineRunV1 | ReturnType<typeof blocked> | ReturnType<typeof notReady> {
  const i=envelope.input, p=i.policy, r=i.resource;
  if (!currentReadBinding(i) || i.request.workspace_id !== r.workspace_id || i.request.resource_id !== r.resource_id ||
    i.request.resource_version !== r.resource_version || at(i.computed_at) < at(i.as_of) || at(r.snapshot_as_of) > at(i.as_of) ||
    at(i.request.requested_at) > at(i.request.accepted_at) || at(i.request.accepted_at) > at(i.computed_at) ||
    at(i.as_of) !== at(i.quality_policy.as_of) || i.quality_policy.policy_version !== p.policy_version ||
    r.country_code !== p.market.country_code || r.location.locality !== p.market.locality || r.resource_type !== p.resource_type) return blocked();
  const purposes = p.transaction_kind === 'sale' ? ['sale_estimate', 'listing_price_suggestion', 'sale_scenario', 'portfolio_report'] : ['rental_recommendation', 'rent_scenario', 'portfolio_report'];
  if (!i.request.purposes.some(x => purposes.includes(x))) return blocked();
  if (new Set(i.observations.map(o => o.observation_id)).size !== i.observations.length ||
    new Set(i.sources.map(s => s.source_id)).size !== i.sources.length ||
    new Set(i.unit_links.map(l => l.observation_id)).size !== i.unit_links.length) return blocked();
  const sourceMap = new Map(i.sources.map(s => [s.source_id, s]));
  const linkMap = new Map(i.unit_links.map(l => [l.observation_id, l]));
  // Refuse the entire projection on a foreign/private/unauthorized observation;
  // no denied count, source identity, validation issue or existence is disclosed.
  for (const o of i.observations) {
    const s = sourceMap.get(o.source.source_id);
    if (o.workspace_id !== r.workspace_id || !s || !s.evidence_kinds.includes(o.evidence_kind) ||
      !sourceReady(s, r.workspace_id, i.as_of, 'quality_evaluation') ||
      !sourceReady(s, r.workspace_id, i.computed_at, 'quality_evaluation') ||
      !sourceReady(s, r.workspace_id, i.computed_at, 'result_display')) return blocked();
  }
  // No accepted time-index producer/rights/market/current-authority artifact exists.
  // Schema-valid arbitrary factors are NOT sufficient evidence. No service is invented.
  if(p.time_adjustments.some(a=>compareRatio(decimalRatio(a.factor),decimalRatio('1'))!==0)){
    diagnose?.('INDEX_PRODUCER_NOT_READY'); return notReady();
  }
  // Quality normalization/freshness/future/FX/exact-source dedup is REUSED, not ported.
  const quality = evaluateValuationObservationQualityV1({ policy: i.quality_policy, observations: i.observations });
  const qMap = new Map(quality.observations.map(q => [q.observation_id, q]));
  const exclusions: ValuationBaselineRunV1['internal']['exclusions'] = [];
  const missing: string[] = [];
  if (r.attributes[p.location_key_attribute] !== p.market.location_key) missing.push('subject_location_basis');
  const area = r.attributes[p.area_attribute], areaUnit = r.attributes[p.area_unit_attribute];
  let subjectArea: Ratio | null = null;
  if (typeof area === 'string' && /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$/.test(area) && Number(area) > 0 && ['sqm', 'sqft'].includes(String(areaUnit))) {
    subjectArea = decimalRatio(area);
    if (areaUnit === 'sqft') subjectArea = multiplyRatio(subjectArea, decimalRatio('0.09290304'));
  } else missing.push('positive_subject_area_and_unit');
  if (p.match_attributes.some(k => r.attributes[k] === null || r.attributes[k] === undefined)) missing.push('subject_comparison_attributes');
  type Candidate = { price: Ratio; trace: ValuationComparableTraceV1 };
  const candidates: Candidate[] = [];
  const weights = new Map(p.source_weights.map(w => [w.source_id, w.weight]));
  const adjustments = new Map(p.time_adjustments.map(a => [a.observation_id, a]));
  for (const o of [...i.observations].sort((a, b) => order(a.observation_id, b.observation_id))) {
    const q = qMap.get(o.observation_id)!, source = sourceMap.get(o.source.source_id)!, link = linkMap.get(o.observation_id);
    const exclude = (reason: string) => exclusions.push({ observation_id: o.observation_id, reason });
    if (q.status !== 'eligible') { exclude(q.status); continue; }
    if (o.resource_type !== r.resource_type || o.transaction_kind !== p.transaction_kind || o.evidence_kind !== p.evidence_kind || o.location_key !== p.market.location_key) { exclude('market_type_or_evidence_basis'); continue; }
    if (p.transaction_kind === 'rent' && o.attributes.rental_period !== p.rental_period) { exclude('rental_period'); continue; }
    if (p.match_attributes.some(k => o.attributes[k] === undefined || o.attributes[k] === null || o.attributes[k] !== r.attributes[k])) { exclude('unit_attributes'); continue; }
    if (!link || link.workspace_id !== r.workspace_id || at(link.reviewed_at) > at(i.as_of)) { exclude('unit_identity_unresolved'); continue; }
    if (!q.normalized_area_sqm || !q.normalized_amount || !weights.has(source.source_id) || !subjectArea) { exclude('area_weight_or_subject_missing'); continue; }
    if (at(i.as_of) - at(o.observed_at) > source.freshness_days * 86400000) { exclude('source_freshness'); continue; }
    const sizeRatio = divideRatio(decimalRatio(q.normalized_area_sqm), subjectArea);
    if (compareRatio(sizeRatio, decimalRatio(p.min_area_ratio)) < 0 || compareRatio(sizeRatio, decimalRatio(p.max_area_ratio)) > 0) { exclude('area_comparability'); continue; }
    if (o.attributes.time_adjusted !== false) { exclude('time_adjustment_state_unknown_or_already_applied'); continue; }
    let price = divideRatio(decimalRatio(q.normalized_amount), decimalRatio(q.normalized_area_sqm));
    const adjustment = adjustments.get(o.observation_id);
    if (adjustment) {
      if (at(adjustment.published_at) > at(i.as_of) || at(adjustment.from) !== at(o.observed_at) || at(adjustment.to) !== at(i.as_of)) { exclude('time_index_future_or_interval'); continue; }
      price = multiplyRatio(price, decimalRatio(adjustment.factor));
    }
    candidates.push({ price, trace: { observation_id: o.observation_id, unit_id: link.unit_id, source_id: source.source_id,
      source_version: source.source_version, source_record_id: o.source.source_record_id, unit_review_ref: link.review_ref,
      weight: weights.get(source.source_id)!, normalized_amount: q.normalized_amount, normalized_area_sqm: q.normalized_area_sqm,
      adjusted_unit_price: renderRatio(price, 8, 'half_up'), fx_source_ref: q.fx_source_ref, index_ref: null, observed_at: o.observed_at,
      time_factor: adjustment?.factor ?? '1', index_version: null,
      weight_policy_ref: p.source_weights.find(w => w.source_id === source.source_id)!.rationale_ref } });
  }
  // Curated cross-site identity, one deterministic observation per canonical unit.
  // Choose latest observation, then stable ID, before outlier filtering. Different
  // units in the same building retain distinct attributes and identities.
  const units = new Map<string, Candidate>();
  for (const c of candidates.sort((a, b) => at(i.observations.find(o => o.observation_id === b.trace.observation_id)!.observed_at) - at(i.observations.find(o => o.observation_id === a.trace.observation_id)!.observed_at) || order(a.trace.observation_id, b.trace.observation_id))) {
    if (units.has(c.trace.unit_id)) exclusions.push({ observation_id: c.trace.observation_id, reason: 'cross_site_same_unit' });
    else units.set(c.trace.unit_id, c);
  }
  const distinct = Array.from(units.values()).sort((a, b) => compareRatio(a.price, b.price) || order(a.trace.observation_id, b.trace.observation_id));
  const n = distinct.length;
  const median = n === 0 ? null : n % 2 ? distinct[Math.floor(n / 2)].price : divideRatio(addRatio(distinct[n / 2 - 1].price, distinct[n / 2].price), decimalRatio('2'));
  const selected = distinct.filter(c => {
    const extreme = median !== null && (compareRatio(c.price, multiplyRatio(median, decimalRatio(p.outlier_ratio))) > 0 || compareRatio(multiplyRatio(c.price, decimalRatio(p.outlier_ratio)), median) < 0);
    if (extreme) exclusions.push({ observation_id: c.trace.observation_id, reason: 'outlier_unit_price' });
    return !extreme;
  });
  if (selected.length < p.min_comparables) missing.push('enough_distinct_eligible_comparables');
  if (selected.length > 0 && subjectArea) {
    // Avoid returning an invalid zero/overflow numeric range at the existing boundary.
    const extremes = selected.map(c => multiplyRatio(c.price, subjectArea!));
    if (Number(renderRatio(selected[0].price, 4, 'half_up')) <= 0 || Number(renderRatio(extremes[0], 2, 'floor')) <= 0 || renderRatio(extremes[extremes.length - 1], 2, 'ceil').split('.')[0].length > 16) missing.push('representable_positive_range');
  }
  // Future quarantined data is not counted as an as-of-known observation window.
  const known = i.observations.filter(o => at(o.observed_at) <= at(i.as_of) && at(o.source.collected_at) <= at(i.as_of));
  const knownTimes = known.map(o => at(o.observed_at)).sort((a, b) => a - b);
  const usedSources = Array.from(new Set(i.observations.map(o => o.source.source_id))).sort();
  const datasetVersion = hash({ quality: quality.dataset_version, observations: [...i.observations].sort((a, b) => order(a.observation_id, b.observation_id)),
    source_versions: [...i.sources].sort((a, b) => order(a.source_id, b.source_id)), unit_links: [...i.unit_links].sort((a, b) => order(a.observation_id, b.observation_id)) });
  let range: { low: string; high: string; central: string } | null = null, basis: Result['price_per_area_basis'] = null;
  if (!missing.length && subjectArea) {
    const weightSum = selected.reduce((sum, c) => sum + c.trace.weight, 0);
    const weighted = selected.reduce((sum, c) => addRatio(sum, multiplyRatio(c.price, decimalRatio(String(c.trace.weight)))), decimalRatio('0'));
    const central = divideRatio(weighted, decimalRatio(String(weightSum)));
    range = { low: renderRatio(multiplyRatio(selected[0].price, subjectArea), 2, 'floor'), high: renderRatio(multiplyRatio(selected[selected.length - 1].price, subjectArea), 2, 'ceil'), central: renderRatio(multiplyRatio(central, subjectArea), 2, 'half_up') };
    basis = { amount: renderRatio(central, 4, 'half_up'), area_unit: 'sqm' };
  }
  const result = resourceValuationResultV1Schema.parse({
    contract: 'resource-valuation-result.v1', valuation_id: i.request.valuation_id, resource_id: r.resource_id,
    resource_version: r.resource_version, workspace_id: r.workspace_id, as_of: i.as_of, computed_at: i.computed_at,
    outcome: range ? 'sufficient' : 'insufficient_data', currency: i.quality_policy.target_currency,
    sale_range: p.transaction_kind === 'sale' ? range : null, rent_range: p.transaction_kind === 'rent' ? range : null, price_per_area_basis: basis,
    evidence: { asking_count: known.filter(o => o.evidence_kind === 'asking').length, verified_transaction_count: known.filter(o => o.evidence_kind === 'verified_transaction').length,
      external_estimate_count: known.filter(o => o.evidence_kind === 'external_estimate').length, quarantined_count: known.filter(o => qMap.get(o.observation_id)!.status === 'quarantined').length,
      oldest_observed_at: known.length ? new Date(knownTimes[0]).toISOString() : null, newest_observed_at: known.length ? new Date(knownTimes[knownTimes.length - 1]).toISOString() : null,
      freshness_days: known.length ? Math.floor((at(i.as_of) - knownTimes[0]) / 86400000) : null },
    explanations: explainValuationBaselineV1(p, selected.length, exclusions.length),
    assumptions: ['Curated evidence and unit links require independent authenticity review; no statistical confidence is claimed.', `Dataset kind=${p.dataset_kind}; no real-market accuracy acceptance.`, 'Nonidentity time adjustment is NOT_READY without an accepted index producer and current rights/market/authority evidence; identity entries assert no index provenance.'],
    missing_inputs: Array.from(new Set(missing)).sort(), quality_score: known.length ? selected.length / Math.max(known.length, selected.length) : 0,
    model_version: p.model_version, dataset_version: datasetVersion, policy_version: p.policy_version,
    review_status: 'not_reviewed', scope_disclaimer: 'Unvalidated decision support, not an official appraisal, price commitment, credit decision or permission to publish. Current Core and source-use authority must be rechecked before display.',
  });
  const stage = !range ? 'insufficient_data' : p.evidence_kind !== 'verified_transaction' || exclusions.length ? 'review_required' : 'calculated';
  const trace = selected.map(c => c.trace).sort((a, b) => order(a.observation_id, b.observation_id));
  const excluded = exclusions.sort((a, b) => order(a.observation_id, b.observation_id) || order(a.reason, b.reason));
  const valuation=valuationBaselineResultV1Schema.parse({
    contract:'valuation-baseline-result.v1',transaction_kind:p.transaction_kind,rental_period:p.rental_period,
    currency:result.currency,area_unit:'sqm',amount_basis:'subject_total',result,
  });
  const internal={source_ids:usedSources,trace,exclusions:excluded};
  const prepared_commitment=hash(envelope);
  const result_commitment=hash({contract:'valuation-baseline-result-content.v2',valuation,internal});
  const content={contract:'valuation-baseline-run.v2' as const,stage,prepared_commitment,result_commitment,valuation,internal};
  const run_version=hash({contract:'valuation-baseline-computation.v2',computation:content});
  return valuationBaselineRunV2Schema.parse({...content,run_version});
}

/** Internal fixed diagnostic codes only; public denial never includes private values. */
export function computeValuationBaselineV1(input:unknown,diagnose?:Diagnostic):ValuationBaselineRunV1|ReturnType<typeof blocked>|ReturnType<typeof notReady>{
  let prepared:ReturnType<typeof canonicalPreparedInput>;
  try{prepared=canonicalPreparedInput(input);}catch{diagnose?.('PREPARED_INVALID');return blocked();}
  try{
    const result=computePreparedValuationBaselineV1(prepared,diagnose);
    if(result.stage==='blocked')diagnose?.('COMPUTATION_UNAVAILABLE');
    return result;
  }catch{diagnose?.('COMPUTATION_UNAVAILABLE');return blocked();}
}

const projectionSchema=z.strictObject({
  // This reference must be supplied independently by the trusted server preparation
  // boundary, NEVER copied from an incoming run or authenticated by a caller bool.
  trusted_preparation:valuationBaselinePreparedInputV2Schema,
  run:valuationBaselineRunV2Schema,
  resource:resourceValuationInputV1Schema,
  core_request:coreResourceAuthorityRequestV1Schema,core_evidence:coreResourceAuthorityEvidenceV1Schema,
  sources:z.array(valuationSourceInventoryV1Schema).max(100),
  read_at:z.string().datetime({offset:true}),detail:z.enum(['result_display','comparable_display']),
});
const publicProjectionSchema=z.strictObject({
  valuation:valuationBaselineResultV1Schema,comparables:z.array(valuationComparableTraceV2Schema).max(500).optional(),
});
export type ValuationBaselineProjectionV2=z.infer<typeof publicProjectionSchema>;

/** Reproduce the exact computation from INDEPENDENT trusted prepared input, then
 * compare the entire strict run. No self-hash/TypeScript type is authentication.
 * Current read rights are independently rechecked AFTER historical reproduction.
 */
export function projectValuationBaselineV1(unparsed:unknown,diagnose?:Diagnostic):ValuationBaselineProjectionV2|ReturnType<typeof blocked>{
  try{
  if(!unparsed||typeof unparsed!=='object'||Array.isArray(unparsed)){
    diagnose?.('PROJECT_INVALID');return blocked();
  }
  const raw=unparsed as Record<string,unknown>;
  const incoming=valuationBaselineRunV2Schema.safeParse(raw.run);
  if(!incoming.success){diagnose?.('RUN_INVALID');return blocked();}
  // Existing shared schemas normalize some strings. Incoming run must already be
  // exactly its validated wire representation, not silently repaired at this edge.
  if(canonical(raw.run)!==canonical(incoming.data)){diagnose?.('RUN_INVALID');return blocked();}
  const parsed=projectionSchema.safeParse(unparsed);
  if(!parsed.success){diagnose?.('PROJECT_INVALID');return blocked();}
  try{
    const input=parsed.data;
    const expected=computeValuationBaselineV1(input.trusted_preparation);
    if(expected.stage==='blocked'||expected.stage==='not_ready'){
      diagnose?.('RECOMPUTATION_UNAVAILABLE');return blocked();
    }
    if(canonical(incoming.data)!==canonical(expected)){
      diagnose?.('RUN_BINDING_MISMATCH');return blocked();
    }
    const result=expected.valuation.result;
    if(at(input.read_at)<at(result.computed_at)||result.resource_id!==input.resource.resource_id||
      result.resource_version!==input.resource.resource_version||result.workspace_id!==input.resource.workspace_id||
      !currentReadBinding({resource:input.resource,core_request:input.core_request,core_evidence:input.core_evidence,computed_at:input.read_at})){
      diagnose?.('CURRENT_READ_DENIED');return blocked();
    }
    if(new Set(input.sources.map(s=>s.source_id)).size!==input.sources.length){diagnose?.('SOURCE_USE_DENIED');return blocked();}
    const referenceInput=canonicalPreparedInput(input.trusted_preparation).input;
    for(const id of expected.internal.source_ids){
      const source=input.sources.find(s=>s.source_id===id);
      if(!source||source.source_version!==referenceInput.sources.find(s=>s.source_id===id)?.source_version||
        !sourceReady(source,result.workspace_id,input.read_at,'result_display')||
        !sourceReady(source,result.workspace_id,input.read_at,input.detail)){
        diagnose?.('SOURCE_USE_DENIED');return blocked();
      }
    }
    // Build output only from the reproduced computation. No caller trace clone,
    // no prepared/Core/private envelope or commitment crosses this projection.
    const v=expected.valuation;
    const valuation=valuationBaselineResultV1Schema.parse({
      contract:v.contract,transaction_kind:v.transaction_kind,rental_period:v.rental_period,
      currency:v.currency,area_unit:v.area_unit,amount_basis:v.amount_basis,result:v.result,
    });
    return publicProjectionSchema.parse(input.detail==='result_display'?{valuation}:
      {valuation,comparables:expected.internal.trace.map(projectValuationComparableV2)});
  }catch{diagnose?.('PROJECT_INVALID');return blocked();}
  }catch{
    try{diagnose?.('PROJECT_INVALID');}catch{/* Diagnostic sinks cannot expose private exceptions. */}
    return blocked();
  }
}
