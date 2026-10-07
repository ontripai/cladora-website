import { createHash } from "node:crypto";
import { z } from "zod";
import { createAirpropOpportunityV2Schema } from "./opportunity-contract-v2";

const resolvedScopeSchema = z.strictObject({
  tenant_id: z.string().uuid().transform((value) => value.toLowerCase()),
  workspace_id: z.string().uuid().transform((value) => value.toLowerCase()),
});

/**
 * Pure persistence-key descriptor, NOT an authorization or retry gateway.
 * The future gateway must authenticate, resolve and authorize the current core
 * context/target BEFORE calling this or looking up any idempotency record.
 * resolvedScope must come from that server resolution, never from the request.
 * No lookup, database lock, insert, audit or outbox operation happens here.
 */
export function describeAirpropOpportunityIdempotencyV2(
  untrustedRequest: unknown,
  resolvedScope: unknown,
) {
  const request = createAirpropOpportunityV2Schema.parse(untrustedRequest);
  const scope = resolvedScopeSchema.parse(resolvedScope);
  if (scope.workspace_id !== request.workspace_id) {
    throw new Error("airprop_workspace_target_mismatch");
  }

  // Explicit field order: request object key order cannot alter a retry hash.
  // Context ID is intentionally excluded: reauthorization still happens on
  // every retry, but equivalent grants can address the same business command.
  const payload = request.payload;
  const canonicalPayload = JSON.stringify({
    version: 2,
    workspace_id: scope.workspace_id,
    name: payload.name,
    country_code: payload.country_code,
    city: payload.city,
    currency: payload.currency,
    asking_price: payload.asking_price,
    property_id: payload.property_id,
    source_ref: payload.source_ref,
  });

  return {
    namespace: "airprop.opportunity.create.v2" as const,
    tenant_id: scope.tenant_id,
    workspace_id: scope.workspace_id,
    idempotency_key: request.idempotency_key,
    input_hash: createHash("sha256").update(canonicalPayload, "utf8").digest("hex"),
  };
}
