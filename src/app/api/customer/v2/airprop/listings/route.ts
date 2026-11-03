import { createClient } from '@/lib/supabase/server';
import { createListingFlowApi } from '@/lib/airprop/listing-flow-api-v1';
import type { NextRequest } from 'next/server';

// No fallback resolver/mandate/privileged connection. DW02 read and native C03
// full-selection bridge require independent producer admission; neither is installed here.
const api = createListingFlowApi({ read: null, control: null, async session() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return error || !data?.claims?.sub ? null : { actor_id: data.claims.sub, aal: String(data.claims.aal ?? '') };
} });
export function GET(request: NextRequest) { return api.GET(request); }
export function POST(request: NextRequest) { return api.POST(request); }
