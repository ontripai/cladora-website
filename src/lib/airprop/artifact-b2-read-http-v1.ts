import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createAirpropB2Api } from './artifact-b2-api';
import type { AirpropB2PortfolioGateway } from './artifact-b2-portfolio';
import { managementPortfolioResponseV1Schema } from './commercial-lifecycle-v1';
import { diligenceFailure } from './diligence-route-response';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const verifiedSessionSchema = z.strictObject({
  source: z.literal('supabase_verified_bearer'),
  actor_id: uuid,
  assurance_level: z.enum(['aal1', 'aal2']),
  access_token: z.string().min(20).max(16_384),
});

export type AirpropB2ReadVerifiedSessionV1 = z.infer<typeof verifiedSessionSchema>;
export interface AirpropB2ReadHttpDependenciesV1 {
  authenticate(request: Request): Promise<AirpropB2ReadVerifiedSessionV1 | null>;
  portfolio(session: AirpropB2ReadVerifiedSessionV1, request: Request): AirpropB2PortfolioGateway;
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer ([A-Za-z0-9._~-]{20,16384})$/);
  return match?.[1] ?? null;
}

function assertLoopbackUrl(value: string, name: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name}_invalid`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || !loopbackHosts.has(url.hostname)) {
    throw new Error(`${name}_must_be_loopback`);
  }
  return url;
}

/**
 * Real local Auth verifier plus a request-scoped actor client. Both calls use
 * the same bearer JWT explicitly; no shared client session or service role is
 * an authority source.
 */
export function createAirpropB2LocalBearerDependenciesV1({
  supabaseUrl,
  anonKey,
}: {
  supabaseUrl: string;
  anonKey: string;
}): AirpropB2ReadHttpDependenciesV1 {
  const target = assertLoopbackUrl(supabaseUrl, 'supabase_url');
  if (typeof anonKey !== 'string' || anonKey.length < 20) throw new Error('anon_key_invalid');
  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };

  return {
    async authenticate(request) {
      const token = bearerToken(request);
      if (!token) return null;
      const verifier = createSupabaseClient(target.origin, anonKey, options);
      const [user, assurance] = await Promise.all([
        verifier.auth.getUser(token),
        verifier.auth.mfa.getAuthenticatorAssuranceLevel(token),
      ]);
      const currentLevel = assurance.data?.currentLevel;
      if (user.error || assurance.error || !user.data.user
        || (currentLevel !== 'aal1' && currentLevel !== 'aal2')) return null;
      return verifiedSessionSchema.parse({
        source: 'supabase_verified_bearer',
        actor_id: user.data.user.id,
        assurance_level: currentLevel,
        access_token: token,
      });
    },
    portfolio(sessionValue) {
      const session = verifiedSessionSchema.parse(sessionValue);
      const client = createSupabaseClient(target.origin, anonKey, {
        ...options,
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      });
      return {
        async rpc(name, parameters) {
          const response = await client.schema('customer_api').rpc(
            name as never,
            parameters as never,
          );
          return { data: response.data, error: response.error };
        },
      };
    },
  };
}

function closeUnresolvedUnitScope(gateway: AirpropB2PortfolioGateway): AirpropB2PortfolioGateway {
  return {
    async rpc(name, parameters) {
      const response = await gateway.rpc(name, parameters);
      if (response.error) return response;
      const parsed = managementPortfolioResponseV1Schema.safeParse(response.data);
      if (parsed.success && parsed.data.properties.some(property =>
        property.action_links.some(link => link.unit_id !== null))) {
        return { data: null, error: { code: 'AIRPROP_UNIT_SCOPE_UNRESOLVED' } };
      }
      return response;
    },
  };
}

/** Inactive handler for a disposable loopback HTTP server; no production route imports it. */
export async function handleAirpropB2ReadHttpV1(
  request: Request,
  dependencies: AirpropB2ReadHttpDependenciesV1,
) {
  let url: URL;
  try {
    url = assertLoopbackUrl(request.url, 'request_url');
  } catch {
    return diligenceFailure('LOOPBACK_REQUIRED', 403);
  }
  if (url.pathname !== '/isolated/airprop/portfolio') return diligenceFailure('NOT_FOUND', 404);
  if (request.method !== 'GET') return diligenceFailure('METHOD_NOT_ALLOWED', 405);

  let session: AirpropB2ReadVerifiedSessionV1 | null;
  try {
    const result = await dependencies.authenticate(request);
    session = result ? verifiedSessionSchema.parse(result) : null;
  } catch {
    session = null;
  }
  if (!session) return diligenceFailure('UNAUTHORIZED', 401);
  if (session.assurance_level !== 'aal2') return diligenceFailure('MFA_REQUIRED', 403);

  const api = createAirpropB2Api({
    session: async () => ({ actor_id: session.actor_id, aal: session.assurance_level }),
    runtime: null,
    portfolio: closeUnresolvedUnitScope(dependencies.portfolio(session, request)),
    bind: async () => null,
  });
  return api.GET(new NextRequest(request));
}
