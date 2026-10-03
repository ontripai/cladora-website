import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function index(rows, label) {
  if (!Array.isArray(rows)) throw new Error('invalid_' + label);
  const map = new Map();
  for (const row of rows) {
    if (!row || !uuid.test(row.id ?? '') || map.has(row.id)) throw new Error('invalid_or_duplicate_' + label + '_id');
    map.set(row.id, row);
  }
  return map;
}
function instant(value) {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)) return NaN;
  return Date.parse(value);
}

// Review only: source exports must come from an independently authorized read path.
// This function does not establish source authenticity, approve a mapping or write data.
export function buildResolutionPlan(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.proposals)
      || !input.source || !/^[a-f0-9]{40}$/.test(input.source.repository_commit ?? '')
      || !Number.isFinite(instant(input.source.captured_at))) throw new Error('invalid_source_manifest');
  const opportunities = index(input.opportunities, 'opportunities');
  const workspaces = index(input.workspaces, 'workspaces');
  const properties = index(input.properties, 'properties');
  const bindings = index(input.bindings, 'bindings');
  const proposals = new Map();
  for (const proposal of input.proposals) {
    if (!uuid.test(proposal?.opportunity_id ?? '') || proposals.has(proposal.opportunity_id)) throw new Error('invalid_or_duplicate_proposal');
    if (!opportunities.has(proposal.opportunity_id)) throw new Error('unknown_proposal_opportunity');
    proposals.set(proposal.opportunity_id, proposal);
  }
  const entries = [];
  for (const opportunity of [...opportunities.values()].sort((a,b) => a.id.localeCompare(b.id))) {
    const proposal = proposals.get(opportunity.id);
    const entry = {
      opportunity_id: opportunity.id,
      expected_source_hash: fingerprint(opportunity),
      status: 'blocked',
      reasons: [],
    };
    if (opportunity.workspace_id != null) {
      entry.status = 'already_scoped';
      entries.push(entry);
      continue;
    }
    if (!proposal) entry.reasons.push('explicit_mapping_required');
    else {
      if (!uuid.test(proposal.workspace_id ?? '')) entry.reasons.push('invalid_workspace_id');
      const workspace = workspaces.get(proposal.workspace_id);
      if (!workspace || workspace.tenant_id !== opportunity.tenant_id) entry.reasons.push('workspace_tenant_mismatch');
      if (workspace && !['PROVISIONING','ACTIVE'].includes(workspace.lifecycle_status)) entry.reasons.push('workspace_inactive');
      if (!uuid.test(proposal.requester_id ?? '') || !uuid.test(proposal.reviewer_id ?? '')
          || proposal.requester_id === proposal.reviewer_id) entry.reasons.push('independent_review_required');
      if (!uuid.test(proposal.evidence_document_version_id ?? '')
          || typeof proposal.reason !== 'string' || proposal.reason.trim().length < 20) entry.reasons.push('evidence_and_reason_required');
      if (!opportunity.property_id) entry.reasons.push('workspace_native_resolution_contract_required');
      else {
        const property = properties.get(opportunity.property_id);
        if (!property || property.tenant_id !== opportunity.tenant_id) entry.reasons.push('subject_tenant_mismatch');
        const created = instant(opportunity.created_at);
        if (!Number.isFinite(created)) entry.reasons.push('invalid_opportunity_time');
        const historical = [...bindings.values()].filter(binding => {
          const from = instant(binding.valid_from);
          const to = binding.valid_to == null ? Infinity : instant(binding.valid_to);
          return binding.property_id === opportunity.property_id
            && Number.isFinite(from) && !Number.isNaN(to) && to > from
            && from <= created && created < to;
        });
        if (historical.length !== 1) entry.reasons.push('historical_binding_missing_or_ambiguous');
        else if (historical[0].tenant_id !== opportunity.tenant_id
          || historical[0].customer_workspace_id !== proposal.workspace_id) entry.reasons.push('historical_workspace_mismatch');
      }
      if (entry.reasons.length === 0) {
        entry.status = 'review_candidate';
        entry.proposed_workspace_id = proposal.workspace_id;
        entry.review = {
          requester_id: proposal.requester_id, reviewer_id: proposal.reviewer_id,
          evidence_document_version_id: proposal.evidence_document_version_id,
          reason: proposal.reason.trim(),
        };
      }
    }
    entries.push(entry);
  }
  const plan = {
    version: 1,
    mode: 'review_only',
    source: input.source,
    input_hash: fingerprint(input),
    entries,
    application_requirements: [
      'revalidate_live_record_hash_and_identity',
      'authorize_distinct_requester_and_reviewer',
      'verify_authorized_document_version_and_historical_provenance',
      'lock_record_and_revalidate_scope_before_write',
      'write_scope_resolution_and_audit_atomically',
      'no_commercial_or_financial_events_from_resolution',
    ],
  };
  return { ...plan, plan_hash: fingerprint(plan) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: node scripts/plan-airprop-legacy-workspace-resolution.mjs <authorized-export.json>');
    const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(buildResolutionPlan(input), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
