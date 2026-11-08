import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getCoreServiceAppRuntimeV1 } from '../../core/private-service-development-binding-v1';
import { createCoreFunctionalRequestAuthV1 } from '../../core/functional-request-auth-v1';
import { getPublicSupabaseEnv } from '../../supabase/env';
import { SERVICE_REQUEST_CUSTODY_HEADER } from '../service-request-custody';

const claimsSchema = z.object({ sub: z.uuid(), session_id: z.uuid(), aal: z.literal('aal2'), role: z.literal('authenticated') });
export class ServiceCustodyOwnerUnavailable extends Error {
  constructor(readonly code: 'AUTHENTICATION_REQUIRED' | 'ACTOR_BINDING_MISMATCH' | 'RUNTIME_BINDING_INACTIVE') { super(code); }
}

/** Opaque continuity label, not a credential or an authorization decision. */
export async function serviceRequestCustodyOwner(request: Request): Promise<string> {
  if (process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE !== 'core-service-real-app-assembly.v1')
    throw new ServiceCustodyOwnerUnavailable('RUNTIME_BINDING_INACTIVE');
  const runtime = getCoreServiceAppRuntimeV1(request);
  if (runtime === null) throw new ServiceCustodyOwnerUnavailable('RUNTIME_BINDING_INACTIVE');
  const { url, publishableKey } = getPublicSupabaseEnv();
  const client = await createCoreFunctionalRequestAuthV1(request, new URL(url).origin, publishableKey);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const [user, claimed] = await Promise.race([
      Promise.all([client.auth.getUser(), client.auth.getClaims()]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ServiceCustodyOwnerUnavailable('RUNTIME_BINDING_INACTIVE')), 10000); }),
    ]);
    if (user.error || claimed.error || !user.data.user) throw new ServiceCustodyOwnerUnavailable('AUTHENTICATION_REQUIRED');
    const parsed = claimsSchema.safeParse(claimed.data?.claims);
    if (!parsed.success) throw new ServiceCustodyOwnerUnavailable('AUTHENTICATION_REQUIRED');
    const claims = parsed.data;
    if (claims.sub.toLowerCase() !== user.data.user.id.toLowerCase()) throw new ServiceCustodyOwnerUnavailable('ACTOR_BINDING_MISMATCH');
    await runtime.verifyServerSession();
    const binding = process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256;
    if (!binding || !/^[a-f0-9]{64}$/.test(binding)) throw new ServiceCustodyOwnerUnavailable('RUNTIME_BINDING_INACTIVE');
    return createHash('sha256').update(JSON.stringify(['service-request-custody-owner.v1',
      new URL(url).origin, binding, claims.sub.toLowerCase(), claims.session_id.toLowerCase()])).digest('hex');
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Optional continuity guard for the new UI; canonical command authority stays in Core. */
export async function assertServiceRequestCustodyOwner(request: Request) {
  const hint = request.headers.get(SERVICE_REQUEST_CUSTODY_HEADER);
  if (hint === null) return;
  if (!/^[a-f0-9]{64}$/.test(hint) || hint !== await serviceRequestCustodyOwner(request))
    throw new ServiceCustodyOwnerUnavailable('ACTOR_BINDING_MISMATCH');
}
