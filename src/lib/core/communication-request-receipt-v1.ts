import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { canonicalResourceReferenceV1InputSchema } from '@/lib/core/resource-contracts-v1';

const timestampSchema = z.string().datetime({ offset: true });
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

export const communicationChannelV1Schema = z.enum([
  'in_app',
  'email',
  'sms',
  'push',
  'postal',
  'noticeboard',
]);

export const communicationAudienceV1Schema = z.discriminatedUnion('audience_kind', [
  z.strictObject({
    audience_kind: z.literal('actor_self'),
    policy_code: z.literal('actor.self'),
  }),
  z.strictObject({
    audience_kind: z.literal('workspace_policy'),
    policy_code: codeSchema,
  }),
  z.strictObject({
    audience_kind: z.literal('canonical_relationship'),
    policy_code: codeSchema,
    resource: canonicalResourceReferenceV1InputSchema,
    relationship_kinds: z.array(z.enum([
      'ownership',
      'management',
      'operation',
      'occupancy',
      'representation',
      'provider',
      'access',
    ])).min(1).max(16),
  }),
]);

export const communicationRequestV1Schema = z.strictObject({
  contract_version: z.literal('communication-request-receipt.v1'),
  request_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  source_domain: z.enum(['core', 'airprop', 'service', 'community', 'operations', 'finance']),
  source_entity_type: codeSchema,
  source_entity_id: uuidSchema,
  source_version: z.number().int().positive(),
  purpose_code: codeSchema,
  audience: communicationAudienceV1Schema,
  channel_preferences: z.array(communicationChannelV1Schema).min(1).max(6),
  template_code: codeSchema,
  template_version: z.number().int().positive(),
  locale: z.enum(['ro', 'en', 'fa']),
  content_reference: z.string().min(1).max(240),
  delivery_class: z.enum(['informational', 'transactional', 'statutory']),
  requested_at: timestampSchema,
  current_authority_recheck_required: z.literal(true),
});

const communicationDeliveryEvidenceV1Schema = z.strictObject({
  channel: communicationChannelV1Schema,
  delivery_status: z.enum(['queued', 'attempted', 'delivered', 'failed', 'suppressed', 'statutory_evidence_required']),
  delivery_reference: z.string().min(1).max(240).nullable(),
  attempt_version: z.number().int().positive().nullable(),
  occurred_at: timestampSchema,
  recipient_disclosure: z.literal('withheld'),
});

const communicationReceiptBaseV1Schema = z.strictObject({
  contract_version: z.literal('communication-request-receipt.v1'),
  request_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  workspace_id: uuidSchema,
  source_domain: z.enum(['core', 'airprop', 'service', 'community', 'operations', 'finance']),
  source_entity_type: codeSchema,
  source_entity_id: uuidSchema,
  source_version: z.number().int().positive(),
  receipt_id: uuidSchema,
  receipt_version: z.number().int().positive(),
  recorded_at: timestampSchema,
  action_authorization: z.literal('not_evaluated'),
  delivery_authorization: z.literal('not_implied'),
});

const communicationAcceptedReceiptV1Schema = communicationReceiptBaseV1Schema.extend({
  request_status: z.literal('accepted'),
  resolved_audience_policy: codeSchema,
  selected_channels: z.array(communicationChannelV1Schema).min(1).max(6),
  delivery_evidence: z.array(communicationDeliveryEvidenceV1Schema).max(64),
  reason_codes: z.tuple([z.literal('communication_request_accepted')]),
});

const communicationRejectedReceiptV1Schema = communicationReceiptBaseV1Schema.extend({
  request_status: z.literal('rejected'),
  resolved_audience_policy: z.null(),
  selected_channels: z.array(z.never()).max(0),
  delivery_evidence: z.array(z.never()).max(0),
  reason_codes: z.array(codeSchema).min(1).max(32),
});

export const communicationRequestReceiptV1Schema = z.discriminatedUnion('request_status', [
  communicationAcceptedReceiptV1Schema,
  communicationRejectedReceiptV1Schema,
]);

export type CommunicationRequestV1 = z.infer<typeof communicationRequestV1Schema>;
export type CommunicationRequestReceiptV1 = z.infer<typeof communicationRequestReceiptV1Schema>;
