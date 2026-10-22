import { z } from 'zod';
import { buildingSetupIdSchema, buildingSetupPayloadSchema, buildingSetupReadSchema, buildingSetupUnitsSchema, createBuildingSetupSchema } from './building-setup-schema';
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
