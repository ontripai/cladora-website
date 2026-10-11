import { z } from 'zod';

export const SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT =
  'service-experience-coordination-receipt.v1' as const;

const uuid = z.string().uuid();
const safeVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const opaqueState = z.string().trim().min(1).max(64);

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

const inputBase = {
  contract: z.literal(SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT),
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  service_order_id: uuid,
  expected_order_version: safeVersion,
  actor_reference_id: uuid,
  participant_reference_id: uuid,
  coordination_source_id: uuid,
  expected_coordination_source_version: safeVersion,
  idempotency_key: idempotencyKey,
};

export const serviceExperienceCoordinationInputV1Schema = z.discriminatedUnion('action', [
  z.strictObject({
    ...inputBase,
    action: z.literal('acknowledge_component_status'),
    component_id: uuid,
    expected_component_version: safeVersion,
    status_reference_id: uuid,
  }),
  z.strictObject({
    ...inputBase,
    action: z.literal('request_cancellation'),
    reason_code: serviceExperienceReasonCodeV1Schema,
  }),
  z.strictObject({
    ...inputBase,
    action: z.literal('request_compensation'),
    component_id: uuid,
    expected_component_version: safeVersion,
    reason_code: serviceExperienceReasonCodeV1Schema,
  }),
  z.strictObject({
    ...inputBase,
    action: z.literal('accept_compensation'),
    compensation_reference_id: uuid,
    expected_compensation_version: safeVersion,
  }),
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

export const serviceExperienceCoordinationReceiptV1Schema = z.strictObject({
  contract: z.literal(SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT),
  version: z.literal(1),
  receipt_id: uuid,
  decision_status: z.enum(['verified', 'denied', 'conflict', 'unknown']),
  result_code: serviceExperienceResultCodeV1Schema,
  action: serviceExperienceActionV1Schema,
  workspace_id: uuid,
  service_order_id: uuid,
  service_order_version: safeVersion,
  subject_kind: z.enum(['component', 'compensation', 'none']),
  subject_id: uuid.nullable(),
  subject_version: safeVersion.nullable(),
  coordination_source_id: uuid,
  coordination_source_version: safeVersion,
  status_reference_id: uuid.nullable(),
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
  idempotency_binding_id: uuid,
  evaluated_at: z.string().datetime({ offset: true }),
}).superRefine((receipt, context) => {
  const expectedStatus = receipt.result_code === 'OK' ? 'verified'
    : ['STALE_ORDER', 'STALE_SUBJECT', 'STALE_SOURCE', 'REPLAY_CONFLICT'].includes(receipt.result_code) ? 'conflict'
      : receipt.result_code === 'UNKNOWN_RESULT' ? 'unknown' : 'denied';
  if (receipt.decision_status !== expectedStatus) {
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
    context.addIssue({ code: 'custom', path: ['subject_id'], message: 'Subject identity and version must be both present or both absent' });
  }
  if ((receipt.action === 'acknowledge_component_status') !== (receipt.status_reference_id !== null)) {
    context.addIssue({ code: 'custom', path: ['status_reference_id'], message: 'Status reference is exclusive to component acknowledgement' });
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
    context.addIssue({ code: 'custom', path: ['result_code'], message: 'Verified result requires current authority and an applied coordination outcome' });
  }
  if (receipt.result_code !== 'OK') {
    const expectedResultState = receipt.result_code === 'UNKNOWN_RESULT' ? 'unknown' : 'unchanged';
    if (receipt.resulting_coordination_state !== expectedResultState) {
      context.addIssue({ code: 'custom', path: ['resulting_coordination_state'], message: 'Non-success result cannot claim an applied coordination outcome' });
    }
  }
});

const authoritySnapshot = z.strictObject({
  actor_reference_id: uuid,
  workspace_id: uuid,
  result: z.enum(['allowed', 'denied']),
});

const participantSnapshot = z.strictObject({
  participant_reference_id: uuid,
  workspace_id: uuid,
  membership_state: z.enum(['active', 'inactive', 'revoked']),
});

const canonicalOrderSnapshot = z.strictObject({
  id: uuid,
  workspace_id: uuid,
  version: safeVersion,
  state: opaqueState,
});

const coordinationSubjectSnapshot = z.strictObject({
  kind: z.enum(['component', 'compensation']),
  id: uuid,
  workspace_id: uuid,
  service_order_id: uuid,
  version: safeVersion,
  state: z.enum(['available', 'closed', 'revoked', 'unknown']),
});

const coordinationSourceSnapshot = z.strictObject({
  id: uuid,
  workspace_id: uuid,
  version: safeVersion,
  state: z.enum(['available', 'closed', 'revoked', 'unknown']),
});

export const serviceExperienceCoordinationSnapshotV1Schema = z.strictObject({
  authority: authoritySnapshot,
  participant: participantSnapshot,
  order: canonicalOrderSnapshot.nullable(),
  subject: coordinationSubjectSnapshot.nullable(),
  source: coordinationSourceSnapshot.nullable(),
  allowed_actions: z.array(serviceExperienceActionV1Schema).max(4),
  resolution: z.enum(['known', 'unknown']),
  issuance: z.strictObject({
    receipt_id: uuid,
    idempotency_binding_id: uuid,
    evaluated_at: z.string().datetime({ offset: true }),
  }),
  replay: z.strictObject({
    idempotency_key: idempotencyKey,
    input_fingerprint: z.string().min(1).max(16_384),
    receipt: serviceExperienceCoordinationReceiptV1Schema,
  }).nullable(),
});

export type ServiceExperienceCoordinationInputV1 = z.infer<typeof serviceExperienceCoordinationInputV1Schema>;
export type ServiceExperienceCoordinationSnapshotV1 = z.infer<typeof serviceExperienceCoordinationSnapshotV1Schema>;
export type ServiceExperienceCoordinationReceiptV1 = z.infer<typeof serviceExperienceCoordinationReceiptV1Schema>;
export type ServiceExperienceResultCodeV1 = z.infer<typeof serviceExperienceResultCodeV1Schema>;

export type ServiceExperienceCoordinationEvaluationV1 = {
  decision_status: ServiceExperienceCoordinationReceiptV1['decision_status'];
  result_code: ServiceExperienceResultCodeV1;
  replayed: boolean;
  receipt: ServiceExperienceCoordinationReceiptV1;
};

export type ServicePr334CoordinationReceipt = {
  status: 'verified' | 'denied' | 'stale';
  action: ServiceExperienceCoordinationInputV1['action'];
  workspace_id: string;
  order_id: string;
  order_version: number;
  subject_id: string | null;
  subject_version: number | null;
  status_reference_id: string | null;
};

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

export const fingerprintServiceExperienceCoordinationInput = (
  input: ServiceExperienceCoordinationInputV1,
) => stableFingerprint(input);

const subjectBinding = (input: ServiceExperienceCoordinationInputV1) => {
  if ('component_id' in input) {
    return { kind: 'component' as const, id: input.component_id, version: input.expected_component_version };
  }
  if ('compensation_reference_id' in input) {
    return { kind: 'compensation' as const, id: input.compensation_reference_id, version: input.expected_compensation_version };
  }
  return { kind: 'none' as const, id: null, version: null };
};

const statusFor = (code: ServiceExperienceResultCodeV1): ServiceExperienceCoordinationReceiptV1['decision_status'] => {
  if (code === 'OK') return 'verified';
  if (code === 'STALE_ORDER' || code === 'STALE_SUBJECT' || code === 'STALE_SOURCE' || code === 'REPLAY_CONFLICT') return 'conflict';
  if (code === 'UNKNOWN_RESULT') return 'unknown';
  return 'denied';
};

const resultingState = (input: ServiceExperienceCoordinationInputV1, code: ServiceExperienceResultCodeV1) => {
  if (code === 'UNKNOWN_RESULT') return 'unknown' as const;
  if (code !== 'OK') return 'unchanged' as const;
  const states = {
    acknowledge_component_status: 'component_status_acknowledged',
    request_cancellation: 'cancellation_requested',
    request_compensation: 'compensation_requested',
    accept_compensation: 'compensation_accepted',
  } as const;
  return states[input.action];
};

const buildReceipt = (
  input: ServiceExperienceCoordinationInputV1,
  snapshot: ServiceExperienceCoordinationSnapshotV1,
  code: ServiceExperienceResultCodeV1,
): ServiceExperienceCoordinationReceiptV1 => {
  const subject = subjectBinding(input);
  return serviceExperienceCoordinationReceiptV1Schema.parse({
    contract: SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT,
    version: 1,
    receipt_id: snapshot.issuance.receipt_id,
    decision_status: statusFor(code),
    result_code: code,
    action: input.action,
    workspace_id: input.workspace_id,
    service_order_id: input.service_order_id,
    service_order_version: input.expected_order_version,
    subject_kind: subject.kind,
    subject_id: subject.id,
    subject_version: subject.version,
    coordination_source_id: input.coordination_source_id,
    coordination_source_version: input.expected_coordination_source_version,
    status_reference_id: input.action === 'acknowledge_component_status' ? input.status_reference_id : null,
    reason_code: 'reason_code' in input ? input.reason_code : null,
    actor_authority: snapshot.authority.result === 'allowed' ? 'verified' : 'denied',
    participant_authority: snapshot.participant.membership_state === 'active' ? 'verified' : 'denied',
    current_coordination_state: snapshot.source?.state ?? 'unknown',
    resulting_coordination_state: resultingState(input, code),
    idempotency_binding_id: snapshot.issuance.idempotency_binding_id,
    evaluated_at: snapshot.issuance.evaluated_at,
  });
};

const receiptMatchesInput = (
  receipt: ServiceExperienceCoordinationReceiptV1,
  input: ServiceExperienceCoordinationInputV1,
  snapshot: ServiceExperienceCoordinationSnapshotV1,
) => {
  const subject = subjectBinding(input);
  return receipt.contract === SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT
    && receipt.version === 1
    && receipt.decision_status === 'verified'
    && receipt.result_code === 'OK'
    && receipt.action === input.action
    && receipt.workspace_id === input.workspace_id
    && receipt.service_order_id === input.service_order_id
    && receipt.service_order_version === input.expected_order_version
    && receipt.subject_kind === subject.kind
    && receipt.subject_id === subject.id
    && receipt.subject_version === subject.version
    && receipt.coordination_source_id === input.coordination_source_id
    && receipt.coordination_source_version === input.expected_coordination_source_version
    && receipt.actor_authority === 'verified'
    && receipt.participant_authority === 'verified'
    && receipt.current_coordination_state === snapshot.source?.state
    && receipt.resulting_coordination_state === resultingState(input, 'OK')
    && receipt.status_reference_id === (input.action === 'acknowledge_component_status' ? input.status_reference_id : null)
    && receipt.reason_code === ('reason_code' in input ? input.reason_code : null);
};

export function evaluateServiceExperienceCoordination(
  rawInput: ServiceExperienceCoordinationInputV1,
  rawSnapshot: ServiceExperienceCoordinationSnapshotV1,
): ServiceExperienceCoordinationEvaluationV1 {
  const input = serviceExperienceCoordinationInputV1Schema.parse(rawInput);
  const snapshot = serviceExperienceCoordinationSnapshotV1Schema.parse(rawSnapshot);
  const decide = (resultCode: ServiceExperienceResultCodeV1): ServiceExperienceCoordinationEvaluationV1 => ({
    decision_status: statusFor(resultCode),
    result_code: resultCode,
    replayed: false,
    receipt: buildReceipt(input, snapshot, resultCode),
  });

  if (snapshot.authority.actor_reference_id !== input.actor_reference_id
    || snapshot.authority.result !== 'allowed') return decide('AUTHORITY_DENIED');
  if (snapshot.participant.participant_reference_id !== input.participant_reference_id
    || snapshot.participant.membership_state !== 'active') return decide('PARTICIPANT_DENIED');
  if (snapshot.authority.workspace_id !== input.workspace_id
    || snapshot.participant.workspace_id !== input.workspace_id) return decide('WORKSPACE_MISMATCH');
  if (!snapshot.order || snapshot.order.id !== input.service_order_id) return decide('ORDER_UNAVAILABLE');
  if (snapshot.order.workspace_id !== input.workspace_id) return decide('WORKSPACE_MISMATCH');
  if (snapshot.order.version !== input.expected_order_version) return decide('STALE_ORDER');
  if (!snapshot.source || snapshot.source.id !== input.coordination_source_id) return decide('SOURCE_UNAVAILABLE');
  if (snapshot.source.workspace_id !== input.workspace_id) return decide('WORKSPACE_MISMATCH');
  if (snapshot.source.version !== input.expected_coordination_source_version) return decide('STALE_SOURCE');
  if (snapshot.source.state === 'unknown' || snapshot.resolution === 'unknown') return decide('UNKNOWN_RESULT');
  if (snapshot.source.state !== 'available') return decide('SOURCE_UNAVAILABLE');
  if (!snapshot.allowed_actions.includes(input.action)) return decide('ACTION_NOT_ALLOWED');

  const subject = subjectBinding(input);
  if (subject.kind === 'none') {
    if (snapshot.subject !== null) return decide('ACTION_NOT_ALLOWED');
  } else {
    if (!snapshot.subject || snapshot.subject.id !== subject.id
      || snapshot.subject.service_order_id !== input.service_order_id) return decide('SUBJECT_UNAVAILABLE');
    if (snapshot.subject.workspace_id !== input.workspace_id) return decide('WORKSPACE_MISMATCH');
    if (snapshot.subject.kind !== subject.kind) return decide('ACTION_NOT_ALLOWED');
    if (snapshot.subject.state === 'unknown') return decide('UNKNOWN_RESULT');
    if (snapshot.subject.state !== 'available') return decide('SUBJECT_UNAVAILABLE');
    if (snapshot.subject.version !== subject.version) return decide('STALE_SUBJECT');
  }

  if (snapshot.replay) {
    if (snapshot.replay.idempotency_key !== input.idempotency_key
      || snapshot.replay.input_fingerprint !== fingerprintServiceExperienceCoordinationInput(input)
      || !receiptMatchesInput(snapshot.replay.receipt, input, snapshot)) return decide('REPLAY_CONFLICT');
    return {
      decision_status: 'verified',
      result_code: 'OK',
      replayed: true,
      receipt: snapshot.replay.receipt,
    };
  }

  return decide('OK');
}

export function projectServicePr334CoordinationReceipt(
  receipt: ServiceExperienceCoordinationReceiptV1,
): ServicePr334CoordinationReceipt {
  return {
    status: receipt.decision_status === 'verified' ? 'verified'
      : receipt.decision_status === 'conflict' ? 'stale' : 'denied',
    action: receipt.action,
    workspace_id: receipt.workspace_id,
    order_id: receipt.service_order_id,
    order_version: receipt.service_order_version,
    subject_id: receipt.subject_id,
    subject_version: receipt.subject_version,
    status_reference_id: receipt.status_reference_id,
  };
}
