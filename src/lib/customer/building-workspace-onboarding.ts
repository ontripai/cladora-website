import { z } from 'zod';
import {
  buildingSetupIdSchema, buildingSetupPayloadSchema, buildingSetupReadSchema,
  buildingSetupUnitsSchema, createBuildingSetupSchema,
} from './building-setup-schema';

export type SetupRecord = z.infer<typeof buildingSetupReadSchema>;
export type SetupPayload = z.infer<typeof buildingSetupPayloadSchema>;
export type SetupAction = 'save' | 'rehearse' | 'submit' | 'provision';
const knownAttempt = z.object({
  action: z.enum(['save', 'rehearse', 'submit', 'provision']),
  run_id: buildingSetupIdSchema,
  context_id: buildingSetupIdSchema,
  before: buildingSetupReadSchema,
  units: buildingSetupUnitsSchema.optional(),
}).strict().superRefine((attempt, ctx) => {
  if (attempt.run_id !== attempt.before.run_id || (attempt.action === 'save') !== !!attempt.units) {
    ctx.addIssue({ code: 'custom', message: 'invalid_attempt' });
  }
});
export const setupAttemptSchema = z.union([
  z.object({ action: z.literal('create'), command: createBuildingSetupSchema }).strict(),
  knownAttempt,
]);
export type SetupAttempt = z.infer<typeof setupAttemptSchema>;
export const setupSessionSchema = z.object({
  version: z.literal(1), context_id: buildingSetupIdSchema, membership_id: buildingSetupIdSchema,
  run_id: buildingSetupIdSchema.nullable(), pending: setupAttemptSchema.nullable(),
}).strict().superRefine((session, ctx) => {
  const pending = session.pending;
  const context = pending?.action === 'create' ? pending.command.context_id : pending?.context_id;
  if ((context && context !== session.context_id)
    || (pending && pending.action !== 'create' && pending.run_id !== session.run_id)) {
    ctx.addIssue({ code: 'custom', message: 'foreign_attempt' });
  }
});
export type SetupSession = z.infer<typeof setupSessionSchema>;
export function setupStorageKey(contextId: string, membershipId: string) {
  return `cladora.building-setup.attempt.v1:${membershipId}:${contextId}`;
}
export function sameSetupUnits(a: SetupPayload['units'], b: SetupPayload['units']) {
  const sorted = (units: SetupPayload['units']) => units.map(u => [u.code, u.floor, u.area_m2])
    .sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}
export function sameSetupPayload(a: SetupPayload, b: SetupPayload) {
  return a.association.name === b.association.name && a.building.name === b.building.name
    && a.building.code === b.building.code && a.building.floors === b.building.floors
    && a.currency === b.currency && a.period_start === b.period_start && a.period_end === b.period_end
    && sameSetupUnits(a.units, b.units)
    && JSON.stringify(a.opening_balances) === JSON.stringify(b.opening_balances);
}

// Reconciliation describes a UI attempt, never grants authority or bypasses the RPC.
export function reconcileSetupAttempt(attempt: SetupAttempt, record: SetupRecord): 'done' | 'retry' | 'conflict' {
  if (attempt.action === 'create') {
    return sameSetupPayload(attempt.command.payload, record.payload) ? 'done' : 'conflict';
  }
  if (attempt.run_id !== record.run_id) return 'conflict';
  if (attempt.action === 'save') {
    if (sameSetupUnits(attempt.units!, record.payload.units)) return 'done';
    return record.status === 'draft' && sameSetupPayload(attempt.before.payload, record.payload) ? 'retry' : 'conflict';
  }
  const stages = ['draft', 'rehearsed', 'submitted', 'approved', 'provisioned'];
  const target = { rehearse: 'rehearsed', submit: 'submitted', provision: 'provisioned' }[attempt.action];
  if (!sameSetupPayload(attempt.before.payload, record.payload)) return 'conflict';
  if (record.status === 'cancelled') return 'conflict';
  if (stages.indexOf(record.status) >= stages.indexOf(target)) return 'done';
  return record.status === attempt.before.status ? 'retry' : 'conflict';
}

export async function readSetupRecord(contextId: string, runId: string) {
  const response = await fetch(`/api/customer/v1/onboarding/building-setup/${runId}?context_id=${encodeURIComponent(contextId)}`, {
    cache: 'no-store', signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('setup_read_denied');
  const record = buildingSetupReadSchema.parse(await response.json());
  if (record.run_id !== runId) throw new Error('setup_read_mismatch');
  return record;
}
