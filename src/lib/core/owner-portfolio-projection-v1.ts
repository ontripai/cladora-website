import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import {
  canonicalResourceReferenceV1Schema,
  resourceRelationshipV1Schema,
} from '@/lib/core/resource-contracts-v1';

const timestampSchema = z.string().datetime({ offset: true });
const dateSchema = z.string().date();
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
const moneySchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/);

export const ownerPortfolioProjectionRequestV1Schema = z.strictObject({
  contract_version: z.literal('owner-portfolio-projection.v1'),
  context_id: uuidSchema,
  portfolio_workspace_id: uuidSchema,
  as_of: timestampSchema,
  permission_code: codeSchema,
  cursor: z.string().min(1).max(512).nullable(),
  limit: z.number().int().min(1).max(100),
});

export const ownerPortfolioSourceClassV1Schema = z.enum([
  'private_owner_record',
  'official_workspace_record',
  'domain_owned_record',
]);

const ownerPortfolioSourceScopeV1Schema = z.strictObject({
  source_class: ownerPortfolioSourceClassV1Schema,
  source_reference: z.string().min(1).max(240),
  source_workspace_id: uuidSchema.nullable(),
  source_context_id: uuidSchema.nullable(),
});

export const ownerPortfolioPrivateResourceV1Schema = z.strictObject({
  item_kind: z.literal('private_resource'),
  private_resource_id: uuidSchema,
  display_label: z.string().min(1).max(240),
  source: ownerPortfolioSourceScopeV1Schema.extend({
    source_class: z.literal('private_owner_record'),
    source_workspace_id: z.null(),
    source_context_id: z.null(),
  }),
  link_status: z.enum(['private_only', 'requested', 'verified', 'revoked']),
  canonical_reference: canonicalResourceReferenceV1Schema.nullable(),
  relationship: resourceRelationshipV1Schema.nullable(),
}).superRefine((value, ctx) => {
  const linked = value.link_status === 'verified';
  if (linked !== (value.canonical_reference !== null && value.relationship !== null)) {
    ctx.addIssue({ code: 'custom', path: ['link_status'], message: 'verified_link_requires_canonical_reference_and_relationship' });
  }
  if (value.canonical_reference?.reference_status === 'not_found' || value.canonical_reference?.reference_status === 'withheld') {
    ctx.addIssue({ code: 'custom', path: ['canonical_reference'], message: 'visible_item_requires_disclosed_canonical_reference' });
  }
});

export const ownerPortfolioCanonicalResourceV1Schema = z.strictObject({
  item_kind: z.literal('canonical_resource'),
  source: ownerPortfolioSourceScopeV1Schema.extend({
    source_class: z.literal('official_workspace_record'),
    source_workspace_id: uuidSchema,
    source_context_id: uuidSchema,
  }),
  canonical_reference: canonicalResourceReferenceV1Schema,
  relationship: resourceRelationshipV1Schema,
}).superRefine((value, ctx) => {
  const reference = value.canonical_reference;
  const relationship = value.relationship;
  if (reference.reference_status === 'not_found' || reference.reference_status === 'withheld') {
    ctx.addIssue({ code: 'custom', path: ['canonical_reference'], message: 'visible_item_requires_disclosed_canonical_reference' });
    return;
  }
  if (
    reference.workspace_id !== value.source.source_workspace_id
    || relationship.workspace_id !== value.source.source_workspace_id
    || reference.resource_type !== relationship.resource_type
    || reference.resource_id !== relationship.resource_id
  ) {
    ctx.addIssue({ code: 'custom', path: ['relationship'], message: 'source_reference_relationship_mismatch' });
  }
});

export const ownerPortfolioResourceV1Schema = z.union([
  ownerPortfolioPrivateResourceV1Schema,
  ownerPortfolioCanonicalResourceV1Schema,
]);

export const ownerPortfolioBalanceV1Schema = z.strictObject({
  contract_version: z.literal('owner-portfolio-balance.v1'),
  source: ownerPortfolioSourceScopeV1Schema,
  balance_kind: z.enum(['private_cash', 'official_charge', 'domain_summary']),
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_status: z.enum(['recorded', 'unavailable']),
  amount: moneySchema.nullable(),
  as_of_date: dateSchema,
  action_authorization: z.literal('not_evaluated'),
}).superRefine((value, ctx) => {
  if ((value.amount_status === 'recorded') !== (value.amount !== null)) {
    ctx.addIssue({ code: 'custom', path: ['amount'], message: 'recorded_amount_must_be_present_and_unavailable_amount_must_be_null' });
  }
  if (value.balance_kind === 'private_cash' && value.source.source_class !== 'private_owner_record') {
    ctx.addIssue({ code: 'custom', path: ['source'], message: 'private_cash_requires_private_owner_source' });
  }
  if (value.balance_kind === 'official_charge' && value.source.source_class !== 'official_workspace_record') {
    ctx.addIssue({ code: 'custom', path: ['source'], message: 'official_charge_requires_workspace_source' });
  }
});

const actionDomainV1Schema = z.enum([
  'core_portfolio',
  'airprop',
  'service',
  'operations',
  'finance',
  'communications',
]);

export const ownerPortfolioActionLinkV1Schema = z.discriminatedUnion('action_status', [
  z.strictObject({
    action_status: z.literal('allowed'),
    action_code: codeSchema,
    domain_owner: actionDomainV1Schema,
    href: z.string().startsWith('/').max(512),
    required_permission: codeSchema,
    product_decision_reference: z.string().min(1).max(240),
    authority_decision_reference: z.string().min(1).max(240),
    current_authority_recheck_required: z.literal(true),
    reason_codes: z.array(z.never()).max(0),
  }),
  z.strictObject({
    action_status: z.literal('unavailable'),
    action_code: codeSchema,
    domain_owner: actionDomainV1Schema,
    href: z.null(),
    required_permission: codeSchema,
    product_decision_reference: z.string().min(1).max(240).nullable(),
    authority_decision_reference: z.string().min(1).max(240).nullable(),
    current_authority_recheck_required: z.literal(true),
    reason_codes: z.array(codeSchema).min(1).max(32),
  }),
  z.strictObject({
    action_status: z.literal('withheld'),
    action_code: z.null(),
    domain_owner: z.null(),
    href: z.null(),
    required_permission: z.null(),
    product_decision_reference: z.null(),
    authority_decision_reference: z.null(),
    current_authority_recheck_required: z.literal(true),
    reason_codes: z.array(codeSchema).min(1).max(32),
  }),
]);

const ownerPortfolioProjectionItemV1Schema = z.strictObject({
  resource: ownerPortfolioResourceV1Schema,
  balances: z.array(ownerPortfolioBalanceV1Schema).max(64),
  actions: z.array(ownerPortfolioActionLinkV1Schema).max(64),
});

export const ownerPortfolioProjectionV1Schema = z.discriminatedUnion('projection_status', [
  z.strictObject({
    contract_version: z.literal('owner-portfolio-projection.v1'),
    projection_status: z.literal('available'),
    portfolio_workspace_id: uuidSchema,
    owner_subject_id: uuidSchema,
    as_of: timestampSchema,
    evaluated_at: timestampSchema,
    items: z.array(ownerPortfolioProjectionItemV1Schema).max(100),
    next_cursor: z.string().min(1).max(512).nullable(),
    action_authorization: z.literal('not_evaluated'),
  }),
  z.strictObject({
    contract_version: z.literal('owner-portfolio-projection.v1'),
    projection_status: z.literal('withheld'),
    portfolio_workspace_id: z.null(),
    owner_subject_id: z.null(),
    as_of: timestampSchema,
    evaluated_at: timestampSchema,
    items: z.array(z.never()).max(0),
    next_cursor: z.null(),
    action_authorization: z.literal('not_evaluated'),
  }),
]);

export type OwnerPortfolioProjectionRequestV1 = z.infer<typeof ownerPortfolioProjectionRequestV1Schema>;
export type OwnerPortfolioProjectionV1 = z.infer<typeof ownerPortfolioProjectionV1Schema>;
export type OwnerPortfolioResourceV1 = z.infer<typeof ownerPortfolioResourceV1Schema>;
export type OwnerPortfolioBalanceV1 = z.infer<typeof ownerPortfolioBalanceV1Schema>;
export type OwnerPortfolioActionLinkV1 = z.infer<typeof ownerPortfolioActionLinkV1Schema>;
