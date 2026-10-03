import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  createServiceOfferingRequestSchema,
  reviseServiceOfferingRequestSchema,
  transitionServiceOfferingRequestSchema,
} from './service-catalog-schema';
import { uuidSchema } from './workspace-composition-schema';

const commandSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('create'), request: createServiceOfferingRequestSchema }),
  z.strictObject({ kind: z.literal('revise'), request: reviseServiceOfferingRequestSchema }),
  z.strictObject({ kind: z.literal('transition'), request: transitionServiceOfferingRequestSchema }),
]);
const resolvedSchema = z.strictObject({
  tenant_id: uuidSchema, actor_id: uuidSchema,
  workspace_id: uuidSchema, context_id: uuidSchema,
});

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Descriptor for the existing platform.idempotency_keys table, not persistence.
 * resolved MUST come from current canonical authentication and authorization,
 * including on retries. Never pass client-supplied resolved identity here.
 * The RPC must atomically claim (tenant_id,key), compare actor/hash, persist the
 * command, audit and outbox, and store the response in the same transaction.
 * A descriptor or stored response never substitutes for current permission.
 */
export function describeServiceCatalogRetry(command: unknown, resolved: unknown) {
  const parsed = commandSchema.parse(command);
  const identity = resolvedSchema.parse(resolved);
  const request = parsed.request;
  if (request.workspace_id.toLowerCase() !== identity.workspace_id.toLowerCase()
    || request.context_id.toLowerCase() !== identity.context_id.toLowerCase()) {
    throw new Error('SERVICE_CONTEXT_TARGET_MISMATCH');
  }
  // PostgreSQL UUID equality is case-insensitive. Normalize identifier fields
  // only; localized strings, amounts and case-sensitive retry keys stay exact.
  const payload: Record<string, JsonValue> = { ...request };
  delete payload.idempotency_key;
  for (const key of ['context_id', 'workspace_id', 'definition_id', 'provider_party_id', 'offering_id', 'revision_id']) {
    if (typeof payload[key] === 'string') payload[key] = payload[key].toLowerCase();
  }
  if ('revision' in request) {
    payload.revision = { ...request.revision, document_version_ids: request.revision.document_version_ids.map(id => id.toLowerCase()) };
  }
  const tenant_id = identity.tenant_id.toLowerCase();
  const actor_id = identity.actor_id.toLowerCase();
  const workspace_id = identity.workspace_id.toLowerCase();
  const key = `service_catalog:v1:${workspace_id}:${parsed.kind}:${request.idempotency_key}`;
  const request_hash = createHash('sha256').update(stableJson({
    contract: 'service_catalog:v1', tenant_id, actor_id, kind: parsed.kind, payload,
  }), 'utf8').digest('hex');
  return { tenant_id, actor_id, key, request_hash };
}
