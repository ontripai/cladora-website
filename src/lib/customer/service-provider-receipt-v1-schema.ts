import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const serviceReceiptVersionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const serviceReceiptCodeSchema = z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,95}$/);
export const serviceReceiptFingerprintSchema = z.string().regex(/^svc1:[0-9a-f]{16}$/);

export const serviceProviderReceiptEnvelopeShape = {
  contract: z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{2,127}\.v[1-9][0-9]*$/),
  version: z.literal(1),
  receipt_id: uuidSchema,
  source_identity: z.strictObject({
    kind: z.string().trim().regex(/^[a-z][a-z0-9_.:-]{1,95}$/),
    id: uuidSchema,
    version: serviceReceiptVersionSchema,
  }),
  workspace_id: uuidSchema,
  authority: z.strictObject({
    actor_reference_id: uuidSchema,
    authority_version: serviceReceiptVersionSchema,
    outcome: z.enum(['verified', 'denied']),
  }),
  decision_status: z.enum(['verified', 'denied', 'conflict', 'unknown']),
  result_code: serviceReceiptCodeSchema,
  reason_code: serviceReceiptCodeSchema.nullable(),
  evaluated_at: z.iso.datetime({ offset: true }),
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  idempotency_binding_id: uuidSchema,
} as const;

export const serviceProviderReceiptEnvelopeV1Schema = z.strictObject(serviceProviderReceiptEnvelopeShape);
export type ServiceProviderReceiptEnvelopeV1 = z.infer<typeof serviceProviderReceiptEnvelopeV1Schema>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

/** Stable consumer-side binding only. Providers remain canonical owners and mint receipts. */
export function fingerprintServiceProviderInput(value: unknown): string {
  const input = canonicalize(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `svc1:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

export type ReceiptBindingExpectation = {
  contract: string;
  workspaceId: string;
  sourceKind: string;
  sourceId: string;
  sourceVersion: number;
  idempotencyKey: string;
  inputFingerprint: string;
};

/** Rejects tamper, stale source, authority denial and replay mismatch; performs no write. */
export function receiptEnvelopeMatches(
  receipt: ServiceProviderReceiptEnvelopeV1,
  expected: ReceiptBindingExpectation,
): boolean {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  return receipt.contract === expected.contract
    && receipt.version === 1
    && same(receipt.workspace_id, expected.workspaceId)
    && receipt.source_identity.kind === expected.sourceKind
    && same(receipt.source_identity.id, expected.sourceId)
    && receipt.source_identity.version === expected.sourceVersion
    && receipt.authority.outcome === 'verified'
    && receipt.decision_status === 'verified'
    && receipt.result_code === 'OK'
    && receipt.reason_code === null
    && receipt.idempotency_key === expected.idempotencyKey
    && receipt.input_fingerprint === expected.inputFingerprint;
}
