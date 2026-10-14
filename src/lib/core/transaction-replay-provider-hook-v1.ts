import { createHash } from 'node:crypto';
import { z } from 'zod';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const version = z.number().int().positive().safe();
const providerCode = z.string().regex(/^[a-z][a-z0-9_.:-]{0,79}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const coreTransactionReplayPolicyV1Schema = z.enum([
  'authority_only',
  'provider_current_state_required',
]);
export type CoreTransactionReplayPolicyV1 = z.infer<typeof coreTransactionReplayPolicyV1Schema>;

/** Persisted in the existing Core receipt so a replay caller cannot remove the required hook. */
export const coreTransactionReplayRequirementV1Schema = z.strictObject({
  contract_version: z.literal('core-transaction-replay-provider-requirement.v1'),
  provider_code: providerCode,
});
export type CoreTransactionReplayRequirementV1 = z.infer<
  typeof coreTransactionReplayRequirementV1Schema
>;

const binding = z.strictObject({
  contract_version: z.literal('core-transaction-replay-provider-decision.v1'),
  decision_id: uuid,
  provider_code: providerCode,
  database_transaction_id: z.string().regex(/^[1-9][0-9]*$/),
  transaction_id: uuid,
  command_id: uuid,
  workspace_id: uuid,
  actor_id: uuid,
  context_id: uuid,
  authority_decision_id: uuid,
  authority_version: version,
  attempt: version.max(100),
  receipt_id: uuid,
  receipt_contract_version: z.enum(['core-transaction-receipt.v1', 'core-transaction-receipt.v2']),
  command_hash: sha256,
  receipt_hash: sha256,
  evaluated_at: z.string().datetime({ offset: true }),
  read_only: z.literal(true),
});

export const coreTransactionReplayProviderDecisionV1Schema = z.discriminatedUnion('decision', [
  binding.extend({
    decision: z.literal('accepted'),
    denial_reason: z.null(),
  }),
  binding.extend({
    decision: z.literal('denied'),
    denial_reason: z.enum([
      'REPLAY_STATE_CHANGED',
      'REPLAY_DISCLOSURE_DENIED',
      'STALE_PROVIDER_EVIDENCE',
      'PROVIDER_UNAVAILABLE',
    ]),
  }),
]);

export type CoreTransactionReplayProviderDecisionV1 = z.infer<
  typeof coreTransactionReplayProviderDecisionV1Schema
>;

function bindingHash(domain: 'command' | 'receipt', value: unknown) {
  return createHash('sha256')
    .update(`core-transaction-replay-provider-${domain}.v1\0`)
    .update(JSON.stringify(value))
    .digest('hex');
}

/** Exact hashes for binding a replay decision to the already parsed immutable inputs. */
export function coreTransactionReplayCommandHashV1(command: unknown) {
  return bindingHash('command', command);
}

export function coreTransactionReplayReceiptHashV1(receipt: unknown) {
  return bindingHash('receipt', receipt);
}
