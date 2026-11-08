import 'server-only';
import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { createCoreAirpropReadHostV1 } from '../core/airprop-read-host-v1';
import { createCoreListingCommandBindingV1 } from '../core/listing-command-binding-v1';
import { CoreFunctionalRuntimeUnavailableV1, type CoreFunctionalDevelopmentTargetV1 } from '../core/functional-command-runtime-v1';
import type { CoreTransactionCommandV1, CoreTransactionProvidersV1 } from '../core/postgres-transaction-host-v1';
import { prepareListingControlV1 } from './listing-control-plan-v1';
import { createListingNativeReadV1, type ListingCanonicalProducerV1, type ListingSelectedBindingReaderV1 } from './listing-native-read-v1';
import { listingScopeSchema, sameId } from './listing-flow-contract-v1';
import type { ListingControlBridge, ListingRuntimeResolver } from './listing-flow-api-v1';
import type { ListingCommand } from './listing-flow-contract-v1';
type CoreListingBoundPort = NonNullable<Awaited<ReturnType<ReturnType<typeof createCoreListingCommandBindingV1>['bind']>>>;
export type ListingPreparedCoreControlV1 = Readonly<{
  command: CoreTransactionCommandV1;
  plan: ReturnType<typeof prepareListingControlV1>;
  providers: CoreTransactionProvidersV1;
}>;

/** Core R2 selector/command ports are official source dependencies. Platform
 * still admits pool/profile and selected-binding SQL. The full canonical producer
 * is missing; partial selector identity is not a Party companion. Commands use real
 * existing C03/session/full selection/current authority and durable native receipts.
 * No process-global actor, request scope, authenticated checkout or mutable registry. */
export type ListingFunctionalDependenciesV1 = Readonly<{
  pool: Pick<Pool, 'connect'>;
  principal: Readonly<{ executor: string; runtime: string }>;
  canonical: ListingCanonicalProducerV1 | null;
  command?: Readonly<{ pool: Pool; target: CoreFunctionalDevelopmentTargetV1;
    /** Actual canonical/prepared-command producer, not supplied by Core R2.
     * Recover ORIGINAL command/plan/providers; no automatic resolveIdentity/rekey
     * on UNKNOWN. Its absence blocks only commands, not independent GET. */
    prepareControl?: ((port: CoreListingBoundPort, actorId: string, request: ListingCommand)
      => Promise<ListingPreparedCoreControlV1 | null>) | null;
  }> | null;
  /** Actual domain reader only after Platform storage/RLS/SQL admission. Omitted
   * means unavailable actions, not a probe, assumed installation or new backend. */
  selectedBindingRead?: ListingSelectedBindingReaderV1 | null;
}>;

/** Compose real existing native read implementation and Core host. This does not
 * admit missing selector SQL, synthesize canonical evidence or enable a deployment.
 * Absent action evidence remains unavailable through the existing read mapper.
 * Call once per validated request with the SAME independently verified identity. */
export function createListingRequestRuntimeResolverV1(
  resolveDependencies: (session: Parameters<ListingRuntimeResolver>[0], scope: Parameters<ListingRuntimeResolver>[1])
    => Promise<ListingFunctionalDependenciesV1 | null>,
): ListingRuntimeResolver {
  return async (session, requested, originalRequest) => {
    const scope = listingScopeSchema.parse(requested);
    const identity = Object.freeze({ actor_id: session.actor_id, aal: session.aal });
    const dependencies = await resolveDependencies(identity, Object.freeze({ ...scope }));
    if (!dependencies) return null;
    const host = createCoreAirpropReadHostV1({ pool: dependencies.pool, principal: dependencies.principal });
    const read = createListingNativeReadV1(host, dependencies.canonical, dependencies.selectedBindingRead ?? null);
    const command = dependencies.command;
    const control: ListingControlBridge | null = command && (originalRequest.method === 'POST' || command.prepareControl)
      ? async (actorId, request) => {
        try {
          // Official request-local Auth/C01/C03 port; never called by GET.
          const port = await createCoreListingCommandBindingV1(command).bind(originalRequest);
          if (!port || !command.prepareControl) return { status: 'not_ready' };
          const prepared = await command.prepareControl(port, actorId, request);
          if (!prepared) return { status: 'not_ready' };
          const original = prepareListingControlV1(prepared.plan.wire, scope), c = prepared.command;
          if (JSON.stringify(original.request) !== JSON.stringify(request)
            || !sameId(c.actor_id, actorId) || !sameId(c.context_id, scope.context_id)
            || !sameId(c.workspace_id, scope.workspace_id) || c.idempotency_key !== request.command.idempotency_key
            || c.input_fingerprint !== `sha256:${createHash('sha256').update(original.wire, 'utf8').digest('hex')}`
            || prepared.providers.replay_policy !== 'provider_current_state_required') return { status: 'not_ready' };
          // Forward the EXACT prepared command/providers. Do not mint or rewrite
          // identity, body/hash/key/version or substitute a fresh identity read.
          const result = await port.host.execute(c, prepared.providers);
          if (result.status === 'unknown_commit') return { status: 'unknown_commit' };
          if (result.status === 'denied') return { status: result.code === 'REPLAY_CONFLICT' ? 'conflict'
            : result.code === 'PROVIDER_UNAVAILABLE' ? 'not_ready' : 'denied' };
          const receipt = result.receipt;
          if (!sameId(receipt.mutation_id, request.command.listing_id) || !sameId(receipt.command_id, c.command_id)
            || !sameId(receipt.transaction_id, c.transaction_id) || !sameId(receipt.actor_id, actorId)
            || !sameId(receipt.workspace_id, scope.workspace_id) || receipt.idempotency_key !== c.idempotency_key
            || receipt.input_fingerprint !== c.input_fingerprint) return { status: 'unknown_commit' };
          return { status: 'receipt', value: { version: 1, ...scope, command_key: c.idempotency_key,
            selection: request.selection, core_receipt_id: receipt.receipt_id, receipt: { version: 1,
              listing_id: receipt.mutation_id, listing_version: request.command.expected_version + 1,
              status: request.command.action === 'withdraw_listing' ? 'withdrawn' : 'published',
              idempotent: result.status === 'exact_replay' } } };
        } catch (error) {
          if (error instanceof CoreFunctionalRuntimeUnavailableV1 && error.code === 'MFA_REQUIRED') return { status: 'mfa_required' };
          if (error instanceof CoreFunctionalRuntimeUnavailableV1
            && ['AUTHENTICATION_REQUIRED', 'ACTOR_BINDING_MISMATCH'].includes(error.code)) return { status: 'unauthorized' };
          throw error; // Uncertain execution cannot become a successful GET/receipt.
        }
      } : null;
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

/** Core R2 read selector and command port are consumed above. Full canonical
 * Party/relationship/prepared-command producer and admitted target are still
 * missing. Installation goes at THIS private
 * boundary after actual delivery; never use env guesses or legacy/service_role.
 * This null is an OPEN functional dependency, not completion of a configured flow. */
export const resolveListingRuntimeForRequest: ListingRuntimeResolver =
  createListingRequestRuntimeResolverV1(async () => null);
