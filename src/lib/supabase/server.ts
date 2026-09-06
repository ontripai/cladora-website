import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers.js';
import type { Database } from '../../types/database.generated.ts';
import { getPublicSupabaseEnv } from './env.ts';

export async function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Middleware refreshes them.
        }
      },
    },
  });
}
