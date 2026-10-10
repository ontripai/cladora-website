import { z } from 'zod';

const text = z.string().trim().min(1).max(240);
const instant = z.string().datetime({ offset: true });
const workspace = z.string().uuid().transform(value => value.toLowerCase());
export const valuationSourceUseV1Schema = z.enum([
  'quality_evaluation', 'model_training', 'result_display', 'comparable_display',
]);

// Curated evidence metadata, never an authority decision or a client command.
export const valuationSourceInventoryV1Schema = z.strictObject({
  contract: z.literal('valuation-source-inventory.v1'),
  source_id: text,
  source_version: text,
  owner_ref: text,
  acquisition_method: z.enum(['manual_import', 'api', 'feed']),
  evidence_kinds: z.array(z.enum(['asking', 'verified_transaction', 'external_estimate'])).min(1).max(3),
  freshness_days: z.number().int().positive().max(3650),
  review_state: z.enum(['pending', 'verified', 'revoked']),
  rights: z.strictObject({
    evidence_ref: text,
    reviewed_at: instant,
    effective_from: instant,
    effective_until: instant.nullable(),
    scope: z.enum(['public', 'licensed_workspace', 'workspace_private']),
    workspace_id: workspace.nullable(),
    permitted_uses: z.array(valuationSourceUseV1Schema).max(4),
    raw_retention_until: instant,
    derived_retention_until: instant,
  }).nullable(),
}).superRefine((value, ctx) => {
  const rights = value.rights;
  if (!rights) return;
  if ((rights.scope === 'public') !== (rights.workspace_id === null)) {
    ctx.addIssue({ code: 'custom', path: ['rights', 'workspace_id'], message: 'scope_requires_exact_workspace_or_public' });
  }
  if (rights.effective_until !== null
    && Date.parse(rights.effective_until) <= Date.parse(rights.effective_from)) {
    ctx.addIssue({ code: 'custom', path: ['rights', 'effective_until'], message: 'invalid_effective_interval' });
  }
  for (const key of ['raw_retention_until', 'derived_retention_until'] as const) {
    if (Date.parse(rights[key]) <= Date.parse(rights.effective_from)) {
      ctx.addIssue({ code: 'custom', path: ['rights', key], message: 'invalid_retention_interval' });
    }
  }
});

const evaluationV1Schema = z.strictObject({
  source: valuationSourceInventoryV1Schema,
  as_of: instant,
  workspace_id: workspace.nullable(),
  intended_use: valuationSourceUseV1Schema,
});

export function evaluateValuationSourceReadinessV1(input: unknown) {
  const { source, as_of, workspace_id, intended_use } = evaluationV1Schema.parse(input);
  const at = Date.parse(as_of);
  const blockers: string[] = [];
  if (source.review_state !== 'verified') blockers.push(`source_${source.review_state}`);
  const rights = source.rights;
  if (!rights) {
    blockers.push('missing_usage_evidence');
  } else {
    if (Date.parse(rights.reviewed_at) > at) blockers.push('review_after_as_of');
    if (Date.parse(rights.effective_from) > at) blockers.push('rights_not_effective');
    if (rights.effective_until !== null && at >= Date.parse(rights.effective_until)) blockers.push('rights_expired');
    if (rights.scope !== 'public' && rights.workspace_id !== workspace_id) blockers.push('workspace_mismatch');
    if (!rights.permitted_uses.includes(intended_use)) blockers.push('use_not_permitted');
    const rawUse = intended_use !== 'result_display';
    if (rawUse && at >= Date.parse(rights.raw_retention_until)) blockers.push('raw_retention_expired');
    if (at >= Date.parse(rights.derived_retention_until)) blockers.push('derived_retention_expired');
  }
  return {
    contract: 'valuation-source-readiness.v1' as const,
    source_id: source.source_id,
    source_version: source.source_version,
    as_of,
    intended_use,
    readiness: blockers.length === 0 ? 'evidence_ready' as const : 'blocked' as const,
    blockers: blockers.sort(),
    // Neither source readiness nor a public license authorizes a Core Resource.
    requires_current_core_authority: true as const,
    permits_connector_activation: false as const,
    permits_publication: false as const,
  };
}
