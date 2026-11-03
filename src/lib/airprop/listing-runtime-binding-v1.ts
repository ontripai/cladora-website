import 'server-only';
import type { Pool } from 'pg';
import { createCoreAirpropReadHostV1 } from '../core/airprop-read-host-v1';
import { createListingNativeReadV1, type ListingCanonicalProducerV1 } from './listing-native-read-v1';
import { listingScopeSchema, sameId } from './listing-flow-contract-v1';
import type { ListingControlBridge, ListingRuntimeResolver } from './listing-flow-api-v1';

/** AIRPROP consumer requirements, not an accepted/new Core15 or Platform12 ABI.
 * Pool/profile must be role-scoped and admitted by Platform. Canonical producer
 * needs Core's READ-compatible selector/closed query admission successor; the
 * current minimum read host alone is insufficient. Command bridge must use real
 * existing C03/session/full selection/current authority and durable native receipts.
 * No process-global actor, request scope, authenticated checkout or mutable registry. */
export type ListingFunctionalDependenciesV1 = Readonly<{
  pool: Pick<Pool, 'connect'>;
  principal: Readonly<{ executor: string; runtime: string }>;
  canonical: ListingCanonicalProducerV1;
  control: ListingControlBridge | null;
}>;

/** Compose real existing native read implementation and Core host. This does not
 * admit missing selector SQL, synthesize canonical evidence or enable a deployment.
 * Absent action evidence remains unavailable through the existing read mapper.
 * Call once per validated request with the SAME independently verified identity. */
export function createListingRequestRuntimeResolverV1(
  resolveDependencies: (session: Parameters<ListingRuntimeResolver>[0], scope: Parameters<ListingRuntimeResolver>[1])
    => Promise<ListingFunctionalDependenciesV1 | null>,
): ListingRuntimeResolver {
  return async (session, requested) => {
    const scope = listingScopeSchema.parse(requested);
    const identity = Object.freeze({ actor_id: session.actor_id, aal: session.aal });
    const dependencies = await resolveDependencies(identity, Object.freeze({ ...scope }));
    if (!dependencies) return null;
    const host = createCoreAirpropReadHostV1({ pool: dependencies.pool, principal: dependencies.principal });
    const read = createListingNativeReadV1(host, dependencies.canonical);
    const control = dependencies.control;
    return {
      read: async (actorId, selected) => {
        if (!sameId(actorId, identity.actor_id) || !sameId(selected.context_id, scope.context_id)
          || !sameId(selected.workspace_id, scope.workspace_id)) throw Error('LISTING_RUNTIME_SCOPE_DENIED');
        return read(actorId, selected);
      },
      control: control === null ? null : async (actorId, request) => {
        if (!sameId(actorId, identity.actor_id) || !sameId(request.command.context_id, scope.context_id)
          || !sameId(request.command.workspace_id, scope.workspace_id)) return { status: 'denied' };
        return control(actorId, request);
      },
    };
  };
}

/** No official configured Core15 canonical/selector/C03 and Platform12 role-scoped
 * development target is delivered in this Base. Installation goes at THIS private
 * boundary after actual delivery; never use env guesses or legacy/service_role.
 * This null is an OPEN functional dependency, not completion of a configured flow. */
export const resolveListingRuntimeForRequest: ListingRuntimeResolver =
  createListingRequestRuntimeResolverV1(async () => null);
