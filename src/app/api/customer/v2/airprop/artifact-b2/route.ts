import { createClient } from '@/lib/supabase/server';
import { createAirpropB2Api } from '@/lib/airprop/artifact-b2-api';

// Explicitly unwired. This candidate neither creates a connection nor activates a command consumer.
const api = createAirpropB2Api({
  runtime: null,
  portfolio: null,
  bind: async () => null,
  async session() {
    const db = await createClient();
    const { data, error } = await db.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    return { actor_id: data.claims.sub, aal: String(data.claims.aal ?? '') };
  },
});
export const GET = api.GET;
export const POST = api.POST;
