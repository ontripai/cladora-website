import { z } from 'zod';
import { buildingSetupIdSchema, buildingSetupPayloadSchema, buildingSetupReadSchema, buildingSetupUnitsSchema, createBuildingSetupSchema, buildingSetupCommandLookupSchema, buildingSetupCommandLookupResponseSchema, type BuildingSetupCommandLookup, type BuildingSetupCommandLookupResponse } from './building-setup-schema';
export type SetupRecord = z.infer<typeof buildingSetupReadSchema>;
export type SetupPayload = z.infer<typeof buildingSetupPayloadSchema>;
export type SetupAction = 'save' | 'rehearse' | 'submit' | 'provision';
const knownAttempt = z.object({
  action: z.enum(['save', 'rehearse', 'submit', 'provision']), run_id: buildingSetupIdSchema,
  context_id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema,
  command_key: z.string().min(8).max(128), before: buildingSetupReadSchema,
  units: buildingSetupUnitsSchema.optional(),
}).strict().superRefine((a, ctx) => {
  if (a.run_id !== a.before.run_id || a.workspace_id !== a.before.workspace_id || (a.action === 'save') !== !!a.units
    || !a.command_key.startsWith(`setup-${a.run_id}-r${a.before.revision}-`)) ctx.addIssue({ code: 'custom', message: 'invalid_attempt' });
});
export const setupAttemptSchema = z.union([
  z.object({ action: z.literal('create'), command: createBuildingSetupSchema, receipt_hash: z.string().regex(/^[0-9a-f]{64}$/).optional() }).strict(), knownAttempt,
]);
export type SetupAttempt = z.infer<typeof setupAttemptSchema>;
export const setupSessionSchema = z.object({
  version: z.literal(2), context_id: buildingSetupIdSchema, membership_id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema,
  run_id: buildingSetupIdSchema.nullable(), pending: setupAttemptSchema.nullable(),
}).strict().superRefine((s, ctx) => {
  const a = s.pending, command = a?.action === 'create' ? a.command : a;
  if ((command && (command.context_id !== s.context_id || command.workspace_id !== s.workspace_id))
    || (a && a.action !== 'create' && a.run_id !== s.run_id)) ctx.addIssue({ code: 'custom', message: 'foreign_attempt' });
});
export type SetupSession = z.infer<typeof setupSessionSchema>;
export function setupStorageKey(context: string, member: string, workspace: string) { return `cladora.building-setup.attempt.v2:${member}:${context}:${workspace}`; }
export function sameSetupUnits(a: SetupPayload['units'], b: SetupPayload['units']) {
  const sorted = (units: SetupPayload['units']) => units.map(u => [u.code, u.floor, u.area_m2]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}
export function sameSetupPayload(a: SetupPayload, b: SetupPayload) {
  return a.association.name === b.association.name && a.building.name === b.building.name && a.building.code === b.building.code && a.building.floors === b.building.floors
    && a.currency === b.currency && a.period_start === b.period_start && a.period_end === b.period_end && sameSetupUnits(a.units, b.units) && JSON.stringify(a.opening_balances) === JSON.stringify(b.opening_balances);
}
// Only a bound, exact recorded receipt can establish completion. Equal data is insufficient.
export function reconcileSetupAttempt(a: SetupAttempt, record: SetupRecord): 'done' | 'retry' | 'conflict' {
  const workspace = a.action === 'create' ? a.command.workspace_id : a.workspace_id;
  if (record.workspace_id !== workspace) return 'conflict';
  if (a.action === 'create') return a.receipt_hash && record.creation_request_hash === a.receipt_hash ? 'done' : 'retry';
  if (record.run_id !== a.run_id) return 'conflict';
  const receipt = record.last_command_receipt;
  if (record.last_command_key === a.command_key && receipt?.command_key === a.command_key
    && receipt.run_id === a.run_id && receipt.workspace_id === a.workspace_id && receipt.revision === record.revision
    && receipt.expected_revision === a.before.revision && receipt.operation === (a.action === 'save' ? 'update' : a.action)) return 'done';
  return record.revision === a.before.revision && record.payload_hash === a.before.payload_hash && sameSetupPayload(record.payload,a.before.payload) && record.status === a.before.status ? 'retry' : 'conflict';
}
// Preserve the established Error message and helper signature for existing callers.
export class SetupReadError extends Error {
  constructor(readonly status: number, message = 'setup_read_denied') { super(message); }
}
export async function readSetupRecord(context: string, workspace: string, run: string) {
  const response = await fetch(`/api/customer/v1/onboarding/building-setup/${run}?${new URLSearchParams({ context_id: context, workspace_id: workspace })}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new SetupReadError(response.status);
  const record = buildingSetupReadSchema.parse(await response.json());
  if (record.run_id !== run || record.workspace_id !== workspace) throw Error('setup_read_mismatch');
  return record;
}
export async function readSetupAttempt(context: string, workspace: string, key: string) {
  const response = await fetch(`/api/customer/v1/onboarding/building-setup?${new URLSearchParams({ context_id: context, workspace_id: workspace, idempotency_key: key })}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new SetupReadError(response.status, 'setup_recovery_denied');
  const result = await response.json();
  if (!Object.hasOwn(result, 'attempt')) throw Error('setup_recovery_invalid');
  if (result.attempt === null) return null;
  const record = buildingSetupReadSchema.parse(result.attempt);
  if (record.workspace_id !== workspace) throw Error('setup_recovery_mismatch');
  return record;
}

// Actor identity is checked by the canonical SSR route against verified claims;
// this consumer additionally binds the response to its saved scope and intent.
export async function readSetupCommandReceipt(query: BuildingSetupCommandLookup, before: {revision:number;status:string;payload_hash:string}, units: SetupPayload['units']|null = null, expectedHash: string|null = null, membership?: string) {
  const q = buildingSetupCommandLookupSchema.parse(query);
  const response = await fetch(`/api/customer/v1/onboarding/building-setup/${q.run_id}/commands/${encodeURIComponent(q.command_key)}?${new URLSearchParams({context_id:q.context_id,workspace_id:q.workspace_id,operation:q.operation,expected_revision:String(q.expected_revision)})}`, {cache:'no-store',signal:AbortSignal.timeout(20_000)});
  if (!response.ok) throw new SetupReadError(response.status, 'setup_command_lookup_failed');
  const result = buildingSetupCommandLookupResponseSchema.parse(await response.json());
  if (result.scope.context_id!==q.context_id||result.scope.workspace_id!==q.workspace_id||result.scope.run_id!==q.run_id
    ||(membership!==undefined&&result.scope.membership_id!==membership)||result.command.command_key!==q.command_key
    ||result.command.operation!==q.operation||result.command.expected_revision!==q.expected_revision) throw Error('setup_command_binding');
  if (result.outcome==='complete') {
    const e=result.evidence, input=e.input_descriptor;
    // Value comparison is NOT a recreation of the PostgreSQL request hash.
    const ordered=(a:SetupPayload['units']|null,b:SetupPayload['units']|null)=>a===null?b===null:b!==null&&a.length===b.length&&a.every((u,i)=>u.code===b[i].code&&u.floor===b[i].floor&&u.area_m2===b[i].area_m2);
    if(e.before_record.revision!==before.revision||e.before_record.status!==before.status||e.before_record.payload_hash!==before.payload_hash
      ||!ordered(input.units,units)||input.expected_payload_hash!==expectedHash)throw Error('setup_command_intent');
  }
  return result;
}
export function setupCommandMatchesCurrent(result: Extract<BuildingSetupCommandLookupResponse,{outcome:'complete'}>, record:SetupRecord) {
  const receipt=result.evidence.receipt;
  return record.workspace_id===receipt.workspace_id&&record.run_id===receipt.run_id&&record.revision>=receipt.revision
    &&(record.revision>receipt.revision||(record.last_command_key===receipt.command_key&&record.status===receipt.status&&record.payload_hash===receipt.payload_hash
      &&(record.property_id??null)===receipt.property_id
      &&(receipt.operation!=='update'||sameSetupUnits(record.payload.units,result.evidence.input_descriptor.units!))));
}
export async function recoverSetupCommand(attempt: Exclude<SetupAttempt,{action:'create'}>, record:SetupRecord, membership:string, current:()=>boolean) {
  if(reconcileSetupAttempt(attempt,record)==='done')return {resolution:'done' as const,record};
  const result=await readSetupCommandReceipt({context_id:attempt.context_id,workspace_id:attempt.workspace_id,run_id:attempt.run_id,command_key:attempt.command_key,operation:attempt.action==='save'?'update':attempt.action,expected_revision:attempt.before.revision},attempt.before,attempt.units??null,null,membership);
  if(!current())throw Error('setup_stale');
  if(result.outcome==='unknown')throw Error('setup_lookup_unknown');
  if(result.outcome==='conflict')return {resolution:'conflict' as const,record};
  const fresh=await readSetupRecord(attempt.context_id,attempt.workspace_id,attempt.run_id);
  if(!current())throw Error('setup_stale');
  if(result.outcome==='complete')return {resolution:setupCommandMatchesCurrent(result,fresh)?'done' as const:'conflict' as const,record:fresh};
  // A concurrent original COMMIT can become the fresh exact last-slot proof
  // after the point-in-time absence. Completion comes from that read, not absence.
  return {resolution:reconcileSetupAttempt(attempt,fresh),record:fresh};
}
