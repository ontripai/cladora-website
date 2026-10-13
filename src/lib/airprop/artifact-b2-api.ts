import { NextRequest, NextResponse } from 'next/server';
import { airpropB2CommandSchema, airpropB2Controls, type AirpropB2Binding, type AirpropB2Command } from './artifact-b2-contract';
import type { createAirpropB2Runtime } from './artifact-b2-runtime';
import { diligenceFailure, diligenceHeaders } from './diligence-route-response';
import { hasTrustedMutationOrigin } from '../security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '../security/request-body';
import { managementPortfolioQueryV1Schema } from './commercial-lifecycle-v1';
import { readAirpropB2Portfolio, type AirpropB2PortfolioGateway } from './artifact-b2-portfolio';

export type AirpropB2Session = { actor_id: string; aal: string };
export type AirpropB2Composition = {
  session(): Promise<AirpropB2Session | null>;
  runtime: ReturnType<typeof createAirpropB2Runtime> | null;
  portfolio: AirpropB2PortfolioGateway | null;
  /** Trusted Core/server resolution of selected context, Resource and stable command identities. */
  bind(actor: AirpropB2Session, command: AirpropB2Command): Promise<AirpropB2Binding | null>;
};
export function createAirpropB2Api(composition: AirpropB2Composition) {
  return {
    async GET(request?: NextRequest) {
      try {
        if (!await composition.session()) return diligenceFailure('UNAUTHORIZED', 401);
        if (request?.nextUrl.search) {
          const query = managementPortfolioQueryV1Schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
          if (!query.success || request.nextUrl.searchParams.size !== 2) return diligenceFailure('INVALID_REQUEST', 400);
          if (!composition.portfolio) return diligenceFailure('AIRPROP_PRE_ACTIVATION', 403);
          const result = await readAirpropB2Portfolio(composition.portfolio, query.data);
          if (result.status !== 'read') return diligenceFailure('AIRPROP_PROVIDER_UNAVAILABLE', 503);
          return NextResponse.json({ ...airpropB2Controls(), view: result.view }, { headers: diligenceHeaders });
        }
        return NextResponse.json(airpropB2Controls(), { headers: diligenceHeaders });
      } catch { return diligenceFailure('AIRPROP_PROVIDER_UNAVAILABLE', 503); }
    },
    async POST(request: NextRequest) {
      if (!hasTrustedMutationOrigin(request)) return diligenceFailure('BAD_ORIGIN', 403);
      if (!isApplicationJson(request.headers.get('content-type'))) return diligenceFailure('UNSUPPORTED_MEDIA_TYPE', 415);
      const { data, errorResponse } = await parseJsonWithLimit(request, 64 * 1024);
      if (errorResponse) {
        for (const [name, value] of Object.entries(diligenceHeaders)) errorResponse.headers.set(name, value);
        return errorResponse;
      }
      const parsed = airpropB2CommandSchema.safeParse(data);
      if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
      try {
        const actor = await composition.session();
        if (!actor) return diligenceFailure('UNAUTHORIZED', 401);
        if (actor.aal !== 'aal2') return diligenceFailure('MFA_REQUIRED', 403);
        if (!composition.runtime) return diligenceFailure('AIRPROP_PRE_ACTIVATION', 403);
        const binding = await composition.bind(actor, parsed.data);
        if (!binding || binding.actor_id !== actor.actor_id) return diligenceFailure('AIRPROP_ACCESS_DENIED', 403);
        const result = await composition.runtime.execute(binding, parsed.data);
        if (result.status === 'unknown_commit') return diligenceFailure('READBACK_REQUIRED', 409);
        if (result.status === 'denied') {
          if (result.code === 'REPLAY_CONFLICT') return diligenceFailure('COMMERCIAL_CONFLICT', 409);
          if (result.code === 'PROVIDER_UNAVAILABLE' || result.code === 'TRANSACTION_FAILED') {
            return diligenceFailure('AIRPROP_PROVIDER_UNAVAILABLE', 503);
          }
          return diligenceFailure('AIRPROP_ACCESS_DENIED', 403);
        }
        return NextResponse.json({ version: 1, status: result.status, receipt_id: result.receipt.receipt_id },
          { status: result.status === 'exact_replay' ? 200 : 201, headers: diligenceHeaders });
      } catch { return diligenceFailure('AIRPROP_PROVIDER_UNAVAILABLE', 503); }
    },
  };
}
