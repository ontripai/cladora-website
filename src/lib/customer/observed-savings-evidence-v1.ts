import { z } from 'zod';

const money=z.number().finite();const date=z.string().date();const period=z.strictObject({starts_on:date,ends_on:date,expense_total:money});
export const observedSavingsEvidenceV1Schema=z.strictObject({
 contract_version:z.literal('observed-savings-evidence.v1'),workspace_id:z.string().uuid(),currency:z.string().regex(/^[A-Z]{3}$/),
 current_period:period,baseline_period:period,observed_savings:money,observed_added_cost:money,net_savings:money,
 categories:z.array(z.strictObject({account_code:z.string().min(1).max(120),account_name:z.string().min(1).max(240),previous_amount:money,current_amount:money,observed_savings:money,observed_added_cost:money,classification:z.enum(['observed_saving','increased_cost','unchanged'])})).max(500),
 evidence_basis:z.strictObject({contract_version:z.literal('workspace-cost-benchmark.v1'),comparison_kind:z.literal('workspace_prior_period'),source:z.strictObject({system:z.literal('finance.journals'),account_type:z.literal('expense'),journal_states:z.tuple([z.literal('posted'),z.literal('reversed')])}),generated_at:z.string().datetime({offset:true})}),
 causal_attribution:z.strictObject({status:z.literal('withheld'),reason_code:z.literal('causal_savings_evidence_unavailable')}),
 asset_value_claim:z.strictObject({status:z.literal('withheld'),reason_code:z.literal('approved_valuation_evidence_unavailable')}),
 generated_at:z.string().datetime({offset:true}),read_only_projection:z.literal(true),
});
export type ObservedSavingsEvidenceV1=z.infer<typeof observedSavingsEvidenceV1Schema>;
