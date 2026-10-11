import { z } from 'zod';
import {
  SERVICE_SUBJECT_LINK_ADAPTER_RECEIPT_CONTRACT,
  serviceCollaborationIntentV1Schema,
  serviceSubjectLinkAdapterReceiptV1Schema,
  type ServiceCollaborationIntentV1,
} from './service-collaboration-v14-schema';
import {
  SERVICE_DELIVERY_EVIDENCE_RECEIPT_CONTRACT,
  serviceDeliveryEvidenceReceiptV1Schema,
  serviceDeliveryIntentV1Schema,
  type ServiceDeliveryIntentV1,
} from './service-delivery-v14-schema';
import {
  PORTFOLIO_SERVICE_ACTION_PROJECTION_RECEIPT_CONTRACT,
  portfolioServiceActionProjectionReceiptV1Schema,
  servicePortfolioActionIntentV1Schema,
  type ServicePortfolioActionIntentV1,
} from './service-portfolio-v14-schema';
import {
  fingerprintServiceProviderInput,
  serviceProviderReceiptEnvelopeShape,
  serviceReceiptVersionSchema,
  type ServiceProviderReceiptEnvelopeV1,
} from './service-provider-receipt-v1-schema';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const SERVICE_STAGE_WORK_ORDER_ADAPTER_RECEIPT_CONTRACT =
  'service-order-stage-work-order-adapter.v1' as const;

export const serviceProviderAdapterAuthorityV1Schema = z.strictObject({
  actor_reference_id: uuidSchema,
  authority_version: serviceReceiptVersionSchema,
  outcome: z.enum(['allowed', 'denied']),
});

export type ServiceProviderAdapterAuthorityV1 = z.infer<typeof serviceProviderAdapterAuthorityV1Schema>;

export const serviceStageWorkOrderAdapterIntentV1Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  service_order_id: uuidSchema,
  expected_order_version: serviceReceiptVersionSchema,
  service_stage_id: uuidSchema,
  expected_stage_version: serviceReceiptVersionSchema,
  execution_kind: z.literal('technical'),
  work_order_id: uuidSchema,
  expected_work_order_version: serviceReceiptVersionSchema,
  idempotency_key: idempotencyKeySchema,
});

export type ServiceStageWorkOrderAdapterIntentV1 = z.infer<typeof serviceStageWorkOrderAdapterIntentV1Schema>;

export const serviceStageWorkOrderAdapterReceiptV1Schema = z.strictObject({
  ...serviceProviderReceiptEnvelopeShape,
  contract: z.literal(SERVICE_STAGE_WORK_ORDER_ADAPTER_RECEIPT_CONTRACT),
  result_code: z.enum([
    'OK',
    'WORK_ORDER_UNAVAILABLE',
    'STALE_WORK_ORDER',
    'WORK_ORDER_ACCESS_DENIED',
    'STAGE_BINDING_CONFLICT',
  ]),
  order_id: uuidSchema,
  order_version: serviceReceiptVersionSchema,
  stage_id: uuidSchema,
  stage_version: serviceReceiptVersionSchema,
  work_order_id: uuidSchema,
  work_order_version: serviceReceiptVersionSchema,
  work_order_status: z.enum([
    'draft',
    'approved',
    'issued',
    'in_progress',
    'on_hold',
    'completed',
    'verified',
    'closed',
    'cancelled',
  ]),
  current_actor_can_read: z.boolean(),
});

export type ServiceStageWorkOrderAdapterReceiptV1 = z.infer<typeof serviceStageWorkOrderAdapterReceiptV1Schema>;

export type ServiceProviderAdapterCode =
  | 'OK'
  | 'AUTHORITY_DENIED'
  | 'AUTHORITY_STALE'
  | 'PROVIDER_RECEIPT_REQUIRED'
  | 'PROVIDER_DENIED'
  | 'PROVIDER_CONFLICT'
  | 'PROVIDER_UNKNOWN'
  | 'PROVIDER_BINDING_MISMATCH'
  | 'STALE_PROVIDER_SOURCE'
  | 'REPLAY_CONFLICT';

export type ServiceProviderAdapterDecision<TReceipt> =
  | { status: 'verified'; code: 'OK'; receipt: TReceipt }
  | { status: 'denied' | 'conflict' | 'unknown'; code: Exclude<ServiceProviderAdapterCode, 'OK'> };

type EnvelopeExpectation = {
  contract: string;
  workspaceId: string;
  sourceKind: string;
  sourceId: string;
  sourceVersion: number;
  idempotencyKey: string;
  inputFingerprint: string;
  authority: ServiceProviderAdapterAuthorityV1;
};

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

function reject<TReceipt>(
  status: 'denied' | 'conflict' | 'unknown',
  code: Exclude<ServiceProviderAdapterCode, 'OK'>,
): ServiceProviderAdapterDecision<TReceipt> {
  return { status, code };
}

/**
 * Checks the full common envelope against facts re-read by the SERVICE boundary.
 * It is deliberately pure: canonical owners mint receipts and persistence remains
 * outside this adapter. Every rejected result is bounded and carries no receipt.
 */
function validateEnvelope<TReceipt extends ServiceProviderReceiptEnvelopeV1>(
  receipt: TReceipt,
  expected: EnvelopeExpectation,
): ServiceProviderAdapterDecision<TReceipt> {
  if (expected.authority.outcome !== 'allowed') return reject('denied', 'AUTHORITY_DENIED');
  if (!sameId(receipt.authority.actor_reference_id, expected.authority.actor_reference_id)
    || receipt.authority.authority_version !== expected.authority.authority_version
    || receipt.authority.outcome !== 'verified') return reject('denied', 'AUTHORITY_STALE');
  if (receipt.contract !== expected.contract
    || !sameId(receipt.workspace_id, expected.workspaceId)
    || receipt.source_identity.kind !== expected.sourceKind
    || !sameId(receipt.source_identity.id, expected.sourceId)) {
    return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  }
  if (receipt.source_identity.version !== expected.sourceVersion) {
    return reject('denied', 'STALE_PROVIDER_SOURCE');
  }
  if (receipt.idempotency_key !== expected.idempotencyKey
    || receipt.input_fingerprint !== expected.inputFingerprint) return reject('conflict', 'REPLAY_CONFLICT');
  if (receipt.decision_status === 'conflict') return reject('conflict', 'PROVIDER_CONFLICT');
  if (receipt.decision_status === 'unknown') return reject('unknown', 'PROVIDER_UNKNOWN');
  if (receipt.decision_status !== 'verified' || receipt.result_code !== 'OK' || receipt.reason_code !== null) {
    return reject('denied', 'PROVIDER_DENIED');
  }
  return { status: 'verified', code: 'OK', receipt };
}

function requiredReceipt<TReceipt>(): ServiceProviderAdapterDecision<TReceipt> {
  return reject('denied', 'PROVIDER_RECEIPT_REQUIRED');
}

/** Consumes a canonical Communications/Documents receipt without resolving either source itself. */
export function adaptServiceSubjectLinkReceipt(
  intentInput: ServiceCollaborationIntentV1,
  authorityInput: ServiceProviderAdapterAuthorityV1,
  receiptInput: unknown,
): ServiceProviderAdapterDecision<z.infer<typeof serviceSubjectLinkAdapterReceiptV1Schema>> {
  const intent = serviceCollaborationIntentV1Schema.safeParse(intentInput);
  const authority = serviceProviderAdapterAuthorityV1Schema.safeParse(authorityInput);
  const receipt = serviceSubjectLinkAdapterReceiptV1Schema.safeParse(receiptInput);
  if (!intent.success || !authority.success || !receipt.success) return requiredReceipt();
  const common = validateEnvelope(receipt.data, {
    contract: SERVICE_SUBJECT_LINK_ADAPTER_RECEIPT_CONTRACT,
    workspaceId: intent.data.workspace_id,
    sourceKind: intent.data.reference_kind,
    sourceId: intent.data.reference_id,
    sourceVersion: intent.data.source_version,
    idempotencyKey: intent.data.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent.data),
    authority: authority.data,
  });
  if (common.status !== 'verified') return common;
  const value = common.receipt;
  if (!sameId(value.request_id, intent.data.service_request_id)
    || value.request_version !== intent.data.expected_request_version
    || value.reference_kind !== intent.data.reference_kind
    || !sameId(value.reference_id, intent.data.reference_id)
    || value.relation !== intent.data.relation) return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  if (value.reference_version !== intent.data.source_version) return reject('denied', 'STALE_PROVIDER_SOURCE');
  if (value.reference_state !== 'available' || !value.current_actor_can_read
    || !value.request_party_audience_only) return reject('denied', 'PROVIDER_DENIED');
  return common;
}

type RecordDeliveryIntent = Extract<ServiceDeliveryIntentV1, { action: 'record_delivery' }>;

/** Consumes an exact Vault/Documents evidence receipt and never reads object metadata or content. */
export function adaptServiceDeliveryEvidenceReceipt(
  intentInput: RecordDeliveryIntent,
  authorityInput: ServiceProviderAdapterAuthorityV1,
  receiptInput: unknown,
): ServiceProviderAdapterDecision<z.infer<typeof serviceDeliveryEvidenceReceiptV1Schema>> {
  const parsedIntent = serviceDeliveryIntentV1Schema.safeParse(intentInput);
  const authority = serviceProviderAdapterAuthorityV1Schema.safeParse(authorityInput);
  const receipt = serviceDeliveryEvidenceReceiptV1Schema.safeParse(receiptInput);
  if (!parsedIntent.success || parsedIntent.data.action !== 'record_delivery'
    || !authority.success || !receipt.success) return requiredReceipt();
  const intent = parsedIntent.data;
  const common = validateEnvelope(receipt.data, {
    contract: SERVICE_DELIVERY_EVIDENCE_RECEIPT_CONTRACT,
    workspaceId: intent.workspace_id,
    sourceKind: 'service_stage',
    sourceId: intent.service_stage_id,
    sourceVersion: intent.expected_stage_version,
    idempotencyKey: intent.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent),
    authority: authority.data,
  });
  if (common.status !== 'verified') return common;
  const value = common.receipt;
  if (!sameId(value.order_id, intent.service_order_id)
    || value.order_version !== intent.expected_order_version
    || !sameId(value.stage_id, intent.service_stage_id)
    || value.stage_version !== intent.expected_stage_version) return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  const expected = new Map(intent.evidence_references.map(item => [item.reference_id.toLowerCase(), item.source_version]));
  const actual = new Map(value.evidence_references.map(item => [item.reference_id.toLowerCase(), item]));
  if (expected.size !== intent.evidence_references.length || actual.size !== expected.size) {
    return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  }
  for (const reference of intent.evidence_references) {
    const evidence = actual.get(reference.reference_id.toLowerCase());
    if (!evidence || !sameId(evidence.workspace_id, intent.workspace_id)) {
      return reject('denied', 'PROVIDER_BINDING_MISMATCH');
    }
    if (evidence.source_version !== reference.source_version) return reject('denied', 'STALE_PROVIDER_SOURCE');
    if (evidence.state !== 'available' || !evidence.current_actor_can_read) {
      return reject('denied', 'PROVIDER_DENIED');
    }
  }
  return common;
}

/** Consumes one OPS01 Work Order binding; it does not infer delivery acceptance or settlement. */
export function adaptServiceStageWorkOrderReceipt(
  intentInput: ServiceStageWorkOrderAdapterIntentV1,
  authorityInput: ServiceProviderAdapterAuthorityV1,
  receiptInput: unknown,
): ServiceProviderAdapterDecision<ServiceStageWorkOrderAdapterReceiptV1> {
  const intent = serviceStageWorkOrderAdapterIntentV1Schema.safeParse(intentInput);
  const authority = serviceProviderAdapterAuthorityV1Schema.safeParse(authorityInput);
  const receipt = serviceStageWorkOrderAdapterReceiptV1Schema.safeParse(receiptInput);
  if (!intent.success || !authority.success || !receipt.success) return requiredReceipt();
  const common = validateEnvelope(receipt.data, {
    contract: SERVICE_STAGE_WORK_ORDER_ADAPTER_RECEIPT_CONTRACT,
    workspaceId: intent.data.workspace_id,
    sourceKind: 'service_stage',
    sourceId: intent.data.service_stage_id,
    sourceVersion: intent.data.expected_stage_version,
    idempotencyKey: intent.data.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent.data),
    authority: authority.data,
  });
  if (common.status !== 'verified') return common;
  const value = common.receipt;
  if (!sameId(value.order_id, intent.data.service_order_id)
    || value.order_version !== intent.data.expected_order_version
    || !sameId(value.stage_id, intent.data.service_stage_id)
    || value.stage_version !== intent.data.expected_stage_version
    || !sameId(value.work_order_id, intent.data.work_order_id)) {
    return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  }
  if (value.work_order_version !== intent.data.expected_work_order_version) {
    return reject('denied', 'STALE_PROVIDER_SOURCE');
  }
  if (!value.current_actor_can_read) return reject('denied', 'PROVIDER_DENIED');
  return common;
}

/** Consumes a PF01 projection receipt while SERVICE remains owner of Order state and actions. */
export function adaptPortfolioServiceActionProjectionReceipt(
  intentInput: ServicePortfolioActionIntentV1,
  authorityInput: ServiceProviderAdapterAuthorityV1,
  receiptInput: unknown,
): ServiceProviderAdapterDecision<z.infer<typeof portfolioServiceActionProjectionReceiptV1Schema>> {
  const intent = servicePortfolioActionIntentV1Schema.safeParse(intentInput);
  const authority = serviceProviderAdapterAuthorityV1Schema.safeParse(authorityInput);
  const receipt = portfolioServiceActionProjectionReceiptV1Schema.safeParse(receiptInput);
  if (!intent.success || !authority.success || !receipt.success) return requiredReceipt();
  const common = validateEnvelope(receipt.data, {
    contract: PORTFOLIO_SERVICE_ACTION_PROJECTION_RECEIPT_CONTRACT,
    workspaceId: intent.data.workspace_id,
    sourceKind: 'service_portfolio',
    sourceId: intent.data.portfolio_id,
    sourceVersion: intent.data.expected_portfolio_version,
    idempotencyKey: intent.data.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent.data),
    authority: authority.data,
  });
  if (common.status !== 'verified') return common;
  const value = common.receipt;
  if (!sameId(value.portfolio_id, intent.data.portfolio_id) || !value.current_actor_can_read) {
    return reject('denied', 'PROVIDER_DENIED');
  }
  const orderIds = value.order_references.map(item => item.service_order_id.toLowerCase());
  if (new Set(orderIds).size !== orderIds.length
    || value.order_references.some(item => new Set(item.available_actions).size !== item.available_actions.length)) {
    return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  }
  const matches = value.order_references.filter(item => sameId(item.service_order_id, intent.data.service_order_id));
  if (matches.length !== 1) return reject('denied', 'PROVIDER_BINDING_MISMATCH');
  if (matches[0].order_version !== intent.data.expected_order_version) {
    return reject('denied', 'STALE_PROVIDER_SOURCE');
  }
  if (!matches[0].available_actions.includes(intent.data.action)) return reject('denied', 'PROVIDER_DENIED');
  return common;
}
