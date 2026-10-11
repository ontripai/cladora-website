import { z } from 'zod';
import { idempotencyKeySchema } from './workspace-composition-schema';

export const SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT =
  'service-experience-coordination-receipt.v1' as const;
export const SERVICE_EXPERIENCE_COORDINATION_PROVIDER_SHA =
  '2a6a52ffbb97ace228daf9221404f308aa05668c' as const;

const providerUuidSchema = z.string().uuid();
const safeVersionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const opaqueStateSchema = z.string().trim().min(1).max(64);

export const serviceExperienceActionV1Schema = z.enum([
  'acknowledge_component_status',
  'request_cancellation',
  'request_compensation',
  'accept_compensation',
]);

export const serviceExperienceReasonCodeV1Schema = z.enum([
  'CUSTOMER_REQUEST',
  'SERVICE_FAILURE',
  'QUALITY_ISSUE',
  'DELIVERY_FAILURE',
  'OTHER',
]);

const base = {
  contract: z.literal(SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT),
  version: z.literal(1),
  context_id: providerUuidSchema,
  workspace_id: providerUuidSchema,
  service_order_id: providerUuidSchema,
  expected_order_version: safeVersionSchema,
  actor_reference_id: providerUuidSchema,
  participant_reference_id: providerUuidSchema,
  coordination_source_id: providerUuidSchema,
  expected_coordination_source_version: safeVersionSchema,
  idempotency_key: idempotencyKeySchema,
};

export const serviceExperienceIntentV1Schema = z.discriminatedUnion('action', [
  z.strictObject({ ...base, action: z.literal('acknowledge_component_status'), component_id: providerUuidSchema,
    expected_component_version: safeVersionSchema, status_reference_id: providerUuidSchema }),
  z.strictObject({ ...base, action: z.literal('request_cancellation'),
    reason_code: serviceExperienceReasonCodeV1Schema }),
  z.strictObject({ ...base, action: z.literal('request_compensation'), component_id: providerUuidSchema,
    expected_component_version: safeVersionSchema, reason_code: serviceExperienceReasonCodeV1Schema }),
  z.strictObject({ ...base, action: z.literal('accept_compensation'), compensation_reference_id: providerUuidSchema,
    expected_compensation_version: safeVersionSchema }),
]);

export const serviceExperienceResultCodeV1Schema = z.enum([
  'OK',
  'AUTHORITY_DENIED',
  'PARTICIPANT_DENIED',
  'ORDER_UNAVAILABLE',
  'STALE_ORDER',
  'SUBJECT_UNAVAILABLE',
  'STALE_SUBJECT',
  'SOURCE_UNAVAILABLE',
  'STALE_SOURCE',
  'WORKSPACE_MISMATCH',
  'ACTION_NOT_ALLOWED',
  'REPLAY_CONFLICT',
  'UNKNOWN_RESULT',
]);

const expectedDecisionStatus = (code: z.infer<typeof serviceExperienceResultCodeV1Schema>) => {
  if (code === 'OK') return 'verified' as const;
  if (['STALE_ORDER', 'STALE_SUBJECT', 'STALE_SOURCE', 'REPLAY_CONFLICT'].includes(code)) return 'conflict' as const;
  if (code === 'UNKNOWN_RESULT') return 'unknown' as const;
  return 'denied' as const;
};

export const serviceExperienceCoordinationReceiptV1Schema = z.strictObject({
  contract: z.literal(SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT),
  version: z.literal(1),
  receipt_id: providerUuidSchema,
  decision_status: z.enum(['verified', 'denied', 'conflict', 'unknown']),
  result_code: serviceExperienceResultCodeV1Schema,
  action: serviceExperienceActionV1Schema,
  workspace_id: providerUuidSchema,
  service_order_id: providerUuidSchema,
  service_order_version: safeVersionSchema,
  subject_kind: z.enum(['component', 'compensation', 'none']),
  subject_id: providerUuidSchema.nullable(),
  subject_version: safeVersionSchema.nullable(),
  coordination_source_id: providerUuidSchema,
  coordination_source_version: safeVersionSchema,
  status_reference_id: providerUuidSchema.nullable(),
  reason_code: serviceExperienceReasonCodeV1Schema.nullable(),
  actor_authority: z.enum(['verified', 'denied']),
  participant_authority: z.enum(['verified', 'denied']),
  current_coordination_state: z.enum(['available', 'closed', 'revoked', 'unknown']),
  resulting_coordination_state: z.enum([
    'component_status_acknowledged',
    'cancellation_requested',
    'compensation_requested',
    'compensation_accepted',
    'unchanged',
    'unknown',
  ]),
  idempotency_binding_id: providerUuidSchema,
  evaluated_at: z.string().datetime({ offset: true }),
}).superRefine((receipt, context) => {
  if (receipt.decision_status !== expectedDecisionStatus(receipt.result_code)) {
    context.addIssue({ code: 'custom', path: ['decision_status'], message: 'Decision status does not match result code' });
  }
  const expectedSubjectKind = receipt.action === 'accept_compensation' ? 'compensation'
    : receipt.action === 'request_cancellation' ? 'none' : 'component';
  if (receipt.subject_kind !== expectedSubjectKind) {
    context.addIssue({ code: 'custom', path: ['subject_kind'], message: 'Subject kind does not match action' });
  }
  if (receipt.subject_kind === 'none'
    ? receipt.subject_id !== null || receipt.subject_version !== null
    : receipt.subject_id === null || receipt.subject_version === null) {
    context.addIssue({ code: 'custom', path: ['subject_id'], message: 'Subject identity and version must match subject kind' });
  }
  if ((receipt.action === 'acknowledge_component_status') !== (receipt.status_reference_id !== null)) {
    context.addIssue({ code: 'custom', path: ['status_reference_id'], message: 'Status reference is exclusive to acknowledgement' });
  }
  const reasonRequired = receipt.action === 'request_cancellation' || receipt.action === 'request_compensation';
  if (reasonRequired !== (receipt.reason_code !== null)) {
    context.addIssue({ code: 'custom', path: ['reason_code'], message: 'Reason code does not match action' });
  }
  if (receipt.result_code === 'OK'
    && (receipt.actor_authority !== 'verified' || receipt.participant_authority !== 'verified'
      || receipt.current_coordination_state !== 'available'
      || receipt.resulting_coordination_state === 'unchanged'
      || receipt.resulting_coordination_state === 'unknown')) {
    context.addIssue({ code: 'custom', path: ['result_code'], message: 'Verified result requires current authority and an applied outcome' });
  }
  if (receipt.result_code !== 'OK') {
    const expectedState = receipt.result_code === 'UNKNOWN_RESULT' ? 'unknown' : 'unchanged';
    if (receipt.resulting_coordination_state !== expectedState) {
      context.addIssue({ code: 'custom', path: ['resulting_coordination_state'], message: 'Non-success cannot claim an applied outcome' });
    }
  }
});

export const serviceExperienceConsumerSnapshotV1Schema = z.strictObject({
  authority: z.strictObject({ actor_reference_id: providerUuidSchema, workspace_id: providerUuidSchema,
    result: z.enum(['allowed', 'denied']) }),
  participant: z.strictObject({ participant_reference_id: providerUuidSchema, workspace_id: providerUuidSchema,
    membership_state: z.enum(['active', 'inactive', 'revoked']) }),
  order: z.strictObject({ id: providerUuidSchema, workspace_id: providerUuidSchema, version: safeVersionSchema,
    state: opaqueStateSchema }).nullable(),
  subject: z.strictObject({ kind: z.enum(['component', 'compensation']), id: providerUuidSchema,
    workspace_id: providerUuidSchema, service_order_id: providerUuidSchema, version: safeVersionSchema,
    state: z.enum(['available', 'closed', 'revoked', 'unknown']) }).nullable(),
  source: z.strictObject({ id: providerUuidSchema, workspace_id: providerUuidSchema, version: safeVersionSchema,
    state: z.enum(['available', 'closed', 'revoked', 'unknown']) }).nullable(),
  allowed_actions: z.array(serviceExperienceActionV1Schema).max(4),
  resolution: z.enum(['known', 'unknown']),
  receipt_reference: z.strictObject({ receipt_id: providerUuidSchema, idempotency_key: idempotencyKeySchema,
    input_fingerprint: z.string().min(1).max(16_384), idempotency_binding_id: providerUuidSchema,
    evaluated_at: z.string().datetime({ offset: true }) }),
  coordination_receipt: serviceExperienceCoordinationReceiptV1Schema.nullable(),
});

export type ServiceExperienceIntentV1 = z.infer<typeof serviceExperienceIntentV1Schema>;
export type ServiceExperienceCoordinationReceiptV1 = z.infer<typeof serviceExperienceCoordinationReceiptV1Schema>;
export type ServiceExperienceSnapshotV1 = z.infer<typeof serviceExperienceConsumerSnapshotV1Schema>;
export type ServiceExperienceDecisionV1 = z.infer<typeof serviceExperienceResultCodeV1Schema>
  | 'COORDINATION_RECEIPT_REQUIRED' | 'COORDINATION_RECEIPT_MISMATCH';

const stableFingerprint = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableFingerprint).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableFingerprint(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const fingerprintServiceExperienceIntent = (intent: ServiceExperienceIntentV1) => stableFingerprint(intent);

const subjectBinding = (intent: ServiceExperienceIntentV1) => {
  if ('component_id' in intent) return { kind: 'component' as const, id: intent.component_id,
    version: intent.expected_component_version };
  if ('compensation_reference_id' in intent) return { kind: 'compensation' as const,
    id: intent.compensation_reference_id, version: intent.expected_compensation_version };
  return { kind: 'none' as const, id: null, version: null };
};

const resultingStateFor = (action: ServiceExperienceIntentV1['action']) => ({
  acknowledge_component_status: 'component_status_acknowledged',
  request_cancellation: 'cancellation_requested',
  request_compensation: 'compensation_requested',
  accept_compensation: 'compensation_accepted',
} as const)[action];

/** Consumes the full CE receipt pinned above while SERVICE retains canonical
 * Order ownership. This pure evaluator performs no writes or side effects.
 */
export function evaluateServiceExperienceIntent(
  rawIntent: ServiceExperienceIntentV1,
  rawSnapshot: ServiceExperienceSnapshotV1,
): ServiceExperienceDecisionV1 {
  const parsedIntent = serviceExperienceIntentV1Schema.safeParse(rawIntent);
  const parsedSnapshot = serviceExperienceConsumerSnapshotV1Schema.safeParse(rawSnapshot);
  if (!parsedIntent.success || !parsedSnapshot.success) return 'COORDINATION_RECEIPT_MISMATCH';
  const intent = parsedIntent.data;
  const snapshot = parsedSnapshot.data;
  if (snapshot.authority.actor_reference_id !== intent.actor_reference_id
    || snapshot.authority.result !== 'allowed') return 'AUTHORITY_DENIED';
  if (snapshot.participant.participant_reference_id !== intent.participant_reference_id
    || snapshot.participant.membership_state !== 'active') return 'PARTICIPANT_DENIED';
  if (snapshot.authority.workspace_id !== intent.workspace_id
    || snapshot.participant.workspace_id !== intent.workspace_id) return 'WORKSPACE_MISMATCH';
  if (!snapshot.order || snapshot.order.id !== intent.service_order_id) return 'ORDER_UNAVAILABLE';
  if (snapshot.order.workspace_id !== intent.workspace_id) return 'WORKSPACE_MISMATCH';
  if (snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';
  if (!snapshot.source || snapshot.source.id !== intent.coordination_source_id) return 'SOURCE_UNAVAILABLE';
  if (snapshot.source.workspace_id !== intent.workspace_id) return 'WORKSPACE_MISMATCH';
  if (snapshot.source.version !== intent.expected_coordination_source_version) return 'STALE_SOURCE';
  if (snapshot.source.state === 'unknown' || snapshot.resolution === 'unknown') return 'UNKNOWN_RESULT';
  if (snapshot.source.state !== 'available') return 'SOURCE_UNAVAILABLE';
  if (!snapshot.allowed_actions.includes(intent.action)) return 'ACTION_NOT_ALLOWED';

  const subject = subjectBinding(intent);
  if (subject.kind === 'none') {
    if (snapshot.subject !== null) return 'ACTION_NOT_ALLOWED';
  } else {
    if (!snapshot.subject || snapshot.subject.id !== subject.id
      || snapshot.subject.service_order_id !== intent.service_order_id) return 'SUBJECT_UNAVAILABLE';
    if (snapshot.subject.workspace_id !== intent.workspace_id) return 'WORKSPACE_MISMATCH';
    if (snapshot.subject.kind !== subject.kind) return 'ACTION_NOT_ALLOWED';
    if (snapshot.subject.state === 'unknown') return 'UNKNOWN_RESULT';
    if (snapshot.subject.state !== 'available') return 'SUBJECT_UNAVAILABLE';
    if (snapshot.subject.version !== subject.version) return 'STALE_SUBJECT';
  }

  if (snapshot.receipt_reference.idempotency_key !== intent.idempotency_key
    || snapshot.receipt_reference.input_fingerprint !== fingerprintServiceExperienceIntent(intent)) {
    return 'REPLAY_CONFLICT';
  }
  const receipt = snapshot.coordination_receipt;
  if (!receipt) return 'COORDINATION_RECEIPT_REQUIRED';
  if (receipt.receipt_id !== snapshot.receipt_reference.receipt_id
    || receipt.idempotency_binding_id !== snapshot.receipt_reference.idempotency_binding_id
    || receipt.evaluated_at !== snapshot.receipt_reference.evaluated_at
    || receipt.action !== intent.action
    || receipt.workspace_id !== intent.workspace_id
    || receipt.service_order_id !== intent.service_order_id
    || receipt.service_order_version !== intent.expected_order_version
    || receipt.subject_kind !== subject.kind
    || receipt.subject_id !== subject.id
    || receipt.subject_version !== subject.version
    || receipt.coordination_source_id !== intent.coordination_source_id
    || receipt.coordination_source_version !== intent.expected_coordination_source_version
    || receipt.status_reference_id !== ('status_reference_id' in intent ? intent.status_reference_id : null)
    || receipt.reason_code !== ('reason_code' in intent ? intent.reason_code : null)
    || receipt.actor_authority !== 'verified'
    || receipt.participant_authority !== 'verified'
    || receipt.current_coordination_state !== snapshot.source.state) return 'COORDINATION_RECEIPT_MISMATCH';
  if (receipt.result_code === 'OK' && receipt.resulting_coordination_state !== resultingStateFor(intent.action)) {
    return 'COORDINATION_RECEIPT_MISMATCH';
  }
  return receipt.result_code;
}
