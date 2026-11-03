import { createAirpropOpportunityV2Schema, type CreateAirpropOpportunityV2 } from '@/lib/airprop/opportunity-contract-v2';

type Scope = { contextId: string; workspaceId: string };
type Command = CreateAirpropOpportunityV2;
export type AirpropOpportunityRecovery =
 | { state: 'empty' }
 | { state: 'uncertain'; command: Command }
 | { state: 'blocked'; command: Command; reason: 'IDEMPOTENCY_CONFLICT' }
 | { state: 'blocked'; command: null; reason: 'INVALID_RECOVERY' };

const invalid = (): AirpropOpportunityRecovery => ({ state: 'blocked', command: null, reason: 'INVALID_RECOVERY' });
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Decode local evidence only. This never authorizes, reconciles or discards a command. */
export function readAirpropOpportunityRecovery(raw: string | null, scope: Scope): AirpropOpportunityRecovery {
 if (raw === null) return { state: 'empty' };
 try {
  const value: unknown = JSON.parse(raw);
  if (!object(value)) return invalid();
  const wrapped = Object.hasOwn(value, 'recovery_version');
  if (wrapped) {
   const keys = value.state === 'blocked'
    ? ['recovery_version', 'state', 'command', 'error_code']
    : ['recovery_version', 'state', 'command'];
   if (value.recovery_version !== 1 || !['uncertain', 'blocked'].includes(String(value.state))
    || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))
    || (value.state === 'blocked' && value.error_code !== 'IDEMPOTENCY_CONFLICT')) return invalid();
  }
  const command = wrapped ? value.command : value;
  if (!createAirpropOpportunityV2Schema.safeParse(command).success || !object(command)
   || command.context_id !== scope.contextId || command.workspace_id !== scope.workspaceId) return invalid();
  // Validate without substituting transformed/defaulted fields into the original intent.
  const original = command as Command;
  return wrapped && value.state === 'blocked'
   ? { state: 'blocked', command: original, reason: 'IDEMPOTENCY_CONFLICT' }
   : { state: 'uncertain', command: original };
 } catch { return invalid(); }
}

/** Versioned envelope; original request version/key/body/scope remain unchanged. */
export function writeAirpropOpportunityRecovery(command: Command, state: 'uncertain' | 'blocked'): string {
 if (!createAirpropOpportunityV2Schema.safeParse(command).success || !['uncertain', 'blocked'].includes(state)) {
  throw new Error('AIRPROP_RECOVERY_INVALID');
 }
 return JSON.stringify({ recovery_version: 1, state, command,
  ...(state === 'blocked' ? { error_code: 'IDEMPOTENCY_CONFLICT' } : {}) });
}
