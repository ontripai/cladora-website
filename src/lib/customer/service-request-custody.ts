import { z } from 'zod';
import { SERVICE_OFFERING_REQUEST_FLOW_CONTRACT, serviceOfferingRequestPublicInputV1Schema } from './service-offering-request-flow-contract';

export const SERVICE_REQUEST_CUSTODY_KEY = 'cladora.service-request-custody.v1';
export const SERVICE_REQUEST_CUSTODY_MARKER = 'cladora.service-request-custody-marker.v1';
export const SERVICE_REQUEST_CUSTODY_HEADER = 'x-cladora-service-custody';
export const SERVICE_REQUEST_CUSTODY_ENDPOINT = '/api/customer/v1/services/command-custody';
export const SERVICE_REQUEST_COMMAND_ENDPOINT = '/api/customer/v1/services/offering-request-flow' as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const serviceRequestCustodyOwnerSchema = z.strictObject({ contract: z.literal('service-request-custody-owner.v1'), owner: hash });
export const serviceRequestCustodyScopeSchema = z.strictObject({
  context_id: z.uuid(), workspace_id: z.uuid(), selection_key: hash,
});
export type ServiceRequestCustodyScope = z.infer<typeof serviceRequestCustodyScopeSchema>;
const recordSchema = z.strictObject({
  contract: z.literal('service-request-pending-custody.v1'), owner: hash,
  scope: serviceRequestCustodyScopeSchema,
  protocol: z.literal(SERVICE_OFFERING_REQUEST_FLOW_CONTRACT),
  endpoint: z.literal(SERVICE_REQUEST_COMMAND_ENDPOINT),
  wire: z.string().min(1).max(32768), digest: hash,
});
const markerSchema = z.strictObject({ contract: z.literal('service-request-custody-marker.v1'), owner: hash, digest: hash });
export type ServiceRequestCustodyRecord = z.infer<typeof recordSchema>;
export type ServiceRequestCustodySnapshot =
  | { state: 'empty'; record: null }
  | { state: 'pending'; record: ServiceRequestCustodyRecord }
  | { state: 'blocked'; record: null };
export type CustodyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const blocked = (): ServiceRequestCustodySnapshot => ({ state: 'blocked', record: null });

export function sameServiceRequestCustodyScope(left: ServiceRequestCustodyScope, right: ServiceRequestCustodyScope) {
  return left.context_id.toLowerCase() === right.context_id.toLowerCase()
    && left.workspace_id.toLowerCase() === right.workspace_id.toLowerCase()
    && left.selection_key === right.selection_key;
}
function pair(storage: CustodyStorage) {
  return [storage.getItem(SERVICE_REQUEST_CUSTODY_KEY), storage.getItem(SERVICE_REQUEST_CUSTODY_MARKER)] as const;
}
function unchanged(storage: CustodyStorage, before: readonly (string | null)[]) {
  const after = pair(storage);
  if (after[0] !== before[0] || after[1] !== before[1]) throw new Error('SERVICE_CUSTODY_CHANGED');
}
async function digest(value: string) {
  const raw = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function checksum(value: Omit<ServiceRequestCustodyRecord, 'digest'>) {
  return digest(JSON.stringify(value));
}

/** Keep raw membership/tenant identity inside discovery, outside child props/DOM. */
export async function withServiceRequestCustodyScopes<T extends {
  context_id: string; workspace_id: string; membership_id: string; tenant_id: string;
}>(selections: T[]) {
  return Promise.all(selections.map(async selection => {
    const identity = z.strictObject({ context_id: z.uuid(), workspace_id: z.uuid(), membership_id: z.uuid(), tenant_id: z.uuid() }).parse({
      context_id: selection.context_id, workspace_id: selection.workspace_id,
      membership_id: selection.membership_id, tenant_id: selection.tenant_id,
    });
    const selection_key = await digest(JSON.stringify(['service-request-selection.v1',
      identity.context_id.toLowerCase(), identity.workspace_id.toLowerCase(),
      identity.membership_id.toLowerCase(), identity.tenant_id.toLowerCase()]));
    return { ...selection, custody_scope: { context_id: identity.context_id, workspace_id: identity.workspace_id, selection_key } };
  }));
}

function payload(record: ServiceRequestCustodyRecord) {
  // Explicit stable fields; do not hash/normalize a reconstructed command body.
  return { contract: record.contract, owner: record.owner, scope: record.scope,
    protocol: record.protocol, endpoint: record.endpoint, wire: record.wire };
}

/** Local custody evidence only; never authorization or a settlement receipt. */
export async function readServiceRequestCustody(storage: CustodyStorage, owner: string): Promise<ServiceRequestCustodySnapshot> {
  try {
    hash.parse(owner);
    const before = pair(storage);
    if (before[0] === null && before[1] === null) return { state: 'empty', record: null };
    if (before[0] === null || before[1] === null || before[0].length > 65536 || before[1].length > 1024) return blocked();
    const record = recordSchema.parse(JSON.parse(before[0]));
    const marker = markerSchema.parse(JSON.parse(before[1]));
    if (record.owner !== owner || marker.owner !== owner || marker.digest !== record.digest) return blocked();
    const body: unknown = JSON.parse(record.wire);
    const parsed = serviceOfferingRequestPublicInputV1Schema.safeParse(body);
    if (!parsed.success || parsed.data.context_id !== record.scope.context_id
      || parsed.data.workspace_id !== record.scope.workspace_id
      || new TextEncoder().encode(record.wire).length > 32768
      || await checksum(payload(record)) !== record.digest) return blocked();
    unchanged(storage, before);
    return { state: 'pending', record };
  } catch { return blocked(); }
}

export async function captureServiceRequestCustody(
  storage: CustodyStorage, owner: string, scope: ServiceRequestCustodyScope, wire: string,
): Promise<ServiceRequestCustodyRecord> {
  const before = pair(storage);
  const existing = await readServiceRequestCustody(storage, owner);
  if (existing.state === 'blocked') throw new Error('SERVICE_CUSTODY_BLOCKED');
  if (existing.state === 'pending') {
    if (!sameServiceRequestCustodyScope(existing.record.scope, scope) || existing.record.wire !== wire)
      throw new Error('SERVICE_CUSTODY_COMMAND_REPLACEMENT');
    return existing.record;
  }
  const body = serviceOfferingRequestPublicInputV1Schema.parse(JSON.parse(wire));
  serviceRequestCustodyScopeSchema.parse(scope); hash.parse(owner);
  if (body.context_id !== scope.context_id || body.workspace_id !== scope.workspace_id
    || new TextEncoder().encode(wire).length > 32768) throw new Error('SERVICE_CUSTODY_SCOPE');
  const value: Omit<ServiceRequestCustodyRecord, 'digest'> = {
    contract: 'service-request-pending-custody.v1', owner, scope,
    protocol: SERVICE_OFFERING_REQUEST_FLOW_CONTRACT, endpoint: SERVICE_REQUEST_COMMAND_ENDPOINT, wire,
  };
  const record = { ...value, digest: await checksum(value) };
  unchanged(storage, before);
  // The separate marker makes partial writes/deletion fail closed. A crash
  // between these writes cannot be treated as a clean new-command slot.
  const marker = JSON.stringify({ contract: 'service-request-custody-marker.v1', owner, digest: record.digest });
  storage.setItem(SERVICE_REQUEST_CUSTODY_MARKER, marker);
  if (storage.getItem(SERVICE_REQUEST_CUSTODY_MARKER) !== marker) throw new Error('SERVICE_CUSTODY_MARKER_READBACK');
  const encoded = JSON.stringify(record);
  storage.setItem(SERVICE_REQUEST_CUSTODY_KEY, encoded);
  if (storage.getItem(SERVICE_REQUEST_CUSTODY_KEY) !== encoded) throw new Error('SERVICE_CUSTODY_READBACK');
  return record;
}

export function assertServiceRequestCustodyBytes(storage: CustodyStorage, record: ServiceRequestCustodyRecord) {
  const current = pair(storage);
  if (current[0] !== JSON.stringify(record) || current[1] !== JSON.stringify({
    contract: 'service-request-custody-marker.v1', owner: record.owner, digest: record.digest,
  })) throw new Error('SERVICE_CUSTODY_CHANGED');
}

/** Call only after a valid response to this exact command and fresh owner check. */
export function releaseServiceRequestCustody(storage: CustodyStorage, record: ServiceRequestCustodyRecord) {
  assertServiceRequestCustodyBytes(storage, record);
  storage.removeItem(SERVICE_REQUEST_CUSTODY_KEY);
  if (storage.getItem(SERVICE_REQUEST_CUSTODY_KEY) !== null) throw new Error('SERVICE_CUSTODY_RELEASE_READBACK');
  storage.removeItem(SERVICE_REQUEST_CUSTODY_MARKER);
  if (storage.getItem(SERVICE_REQUEST_CUSTODY_MARKER) !== null) throw new Error('SERVICE_CUSTODY_RELEASE_READBACK');
}
