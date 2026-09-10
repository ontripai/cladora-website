import 'server-only';

export function getServerSupabaseSecret(): string {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sb_secret_')) {
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_DEV_FALLBACK_SECRET === 'true') {
      return 'sb_secret_test_fallback_mock_key_only_for_unit_tests';
    }
    throw new Error('SUPABASE_SECRET_KEY is missing or invalid.');
  }
  return secretKey;
}

export function getApplicationOrigin(): string {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error('APP_ORIGIN is missing.');

  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_ORIGIN must be an HTTPS origin without path, query, or fragment.');
  }
  return url.origin;
}
