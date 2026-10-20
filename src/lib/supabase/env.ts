const SUPABASE_URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

function readPublicEnv(): Partial<PublicSupabaseEnv> {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, publishableKey } = readPublicEnv();
  return Boolean(url && publishableKey);
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const { url, publishableKey } = readPublicEnv();

  if (!url || !publishableKey || !publishableKey.trim()) {
    throw new Error(
      `Missing ${SUPABASE_URL_KEY} or ${SUPABASE_PUBLISHABLE_KEY}. ` +
        'Add the browser-safe Supabase project values to the environment.',
    );
  }

  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error(`${SUPABASE_URL_KEY} is invalid.`); }

  const hosted = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)
    && !parsed.username && !parsed.password;
  // Literal accesses are required: Next replaces these values in browser bundles.
  // This public marker is a disposable-development configuration, never authority.
  const localMode = process.env.NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE === '1'
    && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
    && !process.env.VERCEL && !process.env.VERCEL_ENV
    && !process.env.NEXT_PUBLIC_VERCEL_ENV
    && (typeof window === 'undefined'
      || ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname));
  const localOrigin = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]):([1-9][0-9]{0,4})$/.exec(url);
  const local = localMode && localOrigin !== null
    && Number(localOrigin[2]) <= 65535;
  if (!hosted && !local) {
    throw new Error(`${SUPABASE_URL_KEY} must be an HTTPS Supabase project URL or explicitly opted-in disposable local origin.`);
  }
  if (publishableKey.startsWith('sb_secret_')) {
    throw new Error(`${SUPABASE_PUBLISHABLE_KEY} must be browser-safe.`);
  }
  // Legacy local anon JWTs are browser-safe; privileged JWTs are not.
  if (publishableKey.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(publishableKey.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
      if (payload.role !== 'anon') throw new Error('unsafe_public_key');
    } catch { throw new Error(`${SUPABASE_PUBLISHABLE_KEY} must be browser-safe.`); }
  }

  return { url, publishableKey };
}
