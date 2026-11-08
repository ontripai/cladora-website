import { NextRequest, NextResponse } from 'next/server';
import { LISTING_ACTOR_HEADER, listingCommandSchema, listingReadResponseSchema, listingScopeSchema, matchesListingReceipt, listingActions, unavailableListingActions, type ListingCommand } from './listing-flow-contract-v1';
import { readListingFlow, type ListingSourceRead } from './listing-flow-read-v1';
import { diligenceFailure, diligenceHeaders } from './diligence-route-response';
import { hasTrustedMutationOrigin } from '../security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '../security/request-body';
import type { AirpropB2Session } from './artifact-b2-api';

/** AIRPROP integration requirement, not an accepted new Core ABI.
 * Must bind full selection/current authority in the existing C03 physical transaction,
 * execute existing AP01/B2 control, and return its real immutable C03+domain receipts.
 * Replay must preserve original key/body and recheck current authority/resource/party.
 * No production bridge is provided or enabled by this source slice. */
export type ListingControlBridge = (actorId: string, request: ListingCommand) => Promise<
  { status: 'receipt'; value: unknown } | { status: 'denied' | 'conflict' | 'not_ready' | 'unknown_commit' }>;
export type ListingRuntimePorts = { read: ListingSourceRead | null; control: ListingControlBridge | null };
export type ListingRuntimeResolver = (session: AirpropB2Session, scope: { context_id: string; workspace_id: string }) => Promise<ListingRuntimePorts | null>;
export function createListingFlowApi(composition: {
  session(): Promise<AirpropB2Session | null>;
  read: ListingSourceRead | null;
  control: ListingControlBridge | null;
  resolveRuntime?: ListingRuntimeResolver;
}) {
  return {
    async GET(request: NextRequest) {
      const scope = listingScopeSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
      if (!scope.success || request.nextUrl.searchParams.size !== 2) return diligenceFailure('INVALID_REQUEST', 400);
      try {
        const session = await composition.session();
        if (!session) return diligenceFailure('UNAUTHORIZED', 401);
        const runtime = composition.resolveRuntime ? await composition.resolveRuntime(session, scope.data) : composition;
        if (!runtime?.read) return diligenceFailure('LISTING_SOURCE_NOT_READY', 503);
        const listings = await readListingFlow(runtime.read, session.actor_id, scope.data);
        const connected = runtime.control !== null && session.aal === 'aal2';
        if (!connected) for (const listing of listings) listing.actions = unavailableListingActions();
        const canEdit = listings.some(row => listingActions.some(action => row.actions[action] === 'allowed'));
        const value = listingReadResponseSchema.parse({ version: 2, ...scope.data, listings,
          can_edit: canEdit, connection: connected ? 'command_bridge' : 'read_only' });
        return NextResponse.json(value, { headers: { ...diligenceHeaders, [LISTING_ACTOR_HEADER]: session.actor_id } });
      } catch { return diligenceFailure('LISTING_READ_UNAVAILABLE', 403); }
    },
    async POST(request: NextRequest) {
      if (!hasTrustedMutationOrigin(request)) return diligenceFailure('BAD_ORIGIN', 403);
      if (!isApplicationJson(request.headers.get('content-type'))) return diligenceFailure('UNSUPPORTED_MEDIA_TYPE', 415);
      const body = await parseJsonWithLimit(request, 16 * 1024);
      if (body.errorResponse) {
        for (const [key, value] of Object.entries(diligenceHeaders)) body.errorResponse.headers.set(key, value);
        return body.errorResponse;
      }
      const parsed = listingCommandSchema.safeParse(body.data);
      if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
      try {
        const session = await composition.session();
        if (!session) return diligenceFailure('UNAUTHORIZED', 401);
        if (session.aal !== 'aal2') return diligenceFailure('MFA_REQUIRED', 403);
        const runtime = composition.resolveRuntime ? await composition.resolveRuntime(session, { context_id: parsed.data.command.context_id, workspace_id: parsed.data.command.workspace_id }) : composition;
        if (!runtime?.control) return diligenceFailure('LISTING_COMMAND_NOT_READY', 503);
        const result = await runtime.control(session.actor_id, parsed.data);
        if (result.status === 'receipt') {
          if (!matchesListingReceipt(result.value, parsed.data)) return diligenceFailure('LISTING_RESULT_UNKNOWN', 502);
          return NextResponse.json(result.value, { status: 200, headers: diligenceHeaders });
        }
        const [status, code] = result.status === 'denied' ? [403, 'LISTING_ACCESS_DENIED']
          : result.status === 'conflict' ? [409, 'LISTING_CONFLICT']
          : result.status === 'unknown_commit' ? [409, 'READBACK_REQUIRED'] : [503, 'LISTING_COMMAND_NOT_READY'];
        return diligenceFailure(String(code), Number(status));
      } catch { return diligenceFailure('LISTING_RESULT_UNKNOWN', 502); }
    },
  };
}
