import { createClient } from '@/lib/supabase/server';
import { createListingFlowApi } from '@/lib/airprop/listing-flow-api-v1';
import { resolveListingRuntimeForRequest } from '@/lib/airprop/listing-runtime-binding-v1';
import type { NextRequest } from 'next/server';

// Per-request composition; unconfigured deployment stays fail-closed.
// No service-role/legacy fallback or caller-supplied authority/connection.
const api = createListingFlowApi({ read: null, control: null, resolveRuntime: resolveListingRuntimeForRequest, async session() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return error || !data?.claims?.sub ? null : { actor_id: data.claims.sub, aal: String(data.claims.aal ?? '') };
} });
export function GET(request: NextRequest) { return api.GET(request); }
export function POST(request: NextRequest) { return api.POST(request); }
