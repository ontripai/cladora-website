import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createAirpropUnderwritingV2Schema } from './underwriting-contract-v2';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const scopeSchema = z.strictObject({ tenant_id: uuid, workspace_id: uuid, actor_id: uuid });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

/** Pure descriptor; never look up a retry until canonical current authority and
 * exact opportunity tenant/workspace/subject have been checked by the gateway.
 * The future RPC must claim this shared key atomically with version/audit/outbox. */
export function describeAirpropUnderwritingIdempotencyV2(untrustedRequest: unknown, resolvedScope: unknown) {
  const request = createAirpropUnderwritingV2Schema.parse(untrustedRequest);
  const scope = scopeSchema.parse(resolvedScope);
  if (request.workspace_id !== scope.workspace_id) throw new Error('airprop_workspace_target_mismatch');
  const a = request.assumptions;
  const assumptions = {
    acquisition_cost: a.acquisition_cost, annual_rent: a.annual_rent,
    annual_opex: a.annual_opex, currency: a.currency,
  };
  return {
    namespace: 'airprop.underwriting.create.v2' as const,
    tenant_id: scope.tenant_id,
    workspace_id: scope.workspace_id,
    actor_id: scope.actor_id,
    persistence_key: `airprop.underwriting.create.v2/${scope.workspace_id}/${request.opportunity_id}/${request.idempotency_key}`,
    request_hash: hash({ version: 2, workspace_id: scope.workspace_id, opportunity_id: request.opportunity_id,
      actor_id: scope.actor_id, expected_version: request.expected_version, assumptions }),
    // Existing immutable version store has a per-case input_hash uniqueness key.
    // Keep content identity distinct from retry identity and stale-version checks.
    input_hash: hash({ version: 2, assumptions }),
  };
}
