import assert from 'node:assert/strict';
import { getApplicationOrigin } from '../src/lib/supabase/application-origin.ts';

const configured = getApplicationOrigin({
  APP_ORIGIN: ' https://preview.cladora.example ',
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'ignored.vercel.app',
});
assert.equal(configured, 'https://preview.cladora.example');

const automaticPreview = getApplicationOrigin({
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'cladora-website-git-release-ontrip.vercel.app',
});
assert.equal(automaticPreview, 'https://cladora-website-git-release-ontrip.vercel.app');

for (const env of [
  { VERCEL_ENV: 'production', VERCEL_URL: 'cladora.ro' },
  { VERCEL_ENV: 'development', VERCEL_URL: 'local.vercel.app' },
  { VERCEL_ENV: 'preview' },
]) {
  assert.throws(() => getApplicationOrigin(env), /APP_ORIGIN is missing/);
}

for (const APP_ORIGIN of [
  'http://preview.example.com',
  'https://preview.example.com/path',
  'https://preview.example.com?query=1',
  'https://user:password@preview.example.com',
]) {
  assert.throws(() => getApplicationOrigin({ APP_ORIGIN }), /APP_ORIGIN must be an HTTPS origin/);
}

for (const VERCEL_URL of [
  'https://preview.vercel.app',
  'preview.vercel.app/path',
  'preview.vercel.app.evil.example',
  'vercel.app',
  'preview.vercel.app:8443',
]) {
  assert.throws(
    () => getApplicationOrigin({ VERCEL_ENV: 'preview', VERCEL_URL }),
    /VERCEL_URL must be/,
  );
}

console.log('PASS Vercel preview application origin: exact deployment fallback with production fail-closed behavior');
