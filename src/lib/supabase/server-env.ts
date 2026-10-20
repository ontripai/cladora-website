import 'server-only';
export { getApplicationOrigin } from './application-origin';

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
