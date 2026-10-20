type ApplicationOriginEnv = {
  readonly [key: string]: string | undefined;
  APP_ORIGIN?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

function validateConfiguredOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('APP_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

function previewOriginFromVercelUrl(value: string): string {
  const hostname = value.trim();
  if (!hostname || hostname.includes('://') || hostname.includes('/') || hostname.includes('@')) {
    throw new Error('VERCEL_URL must be a hostname without protocol, credentials, or path.');
  }

  const url = new URL(`https://${hostname}`);
  if (
    url.hostname !== hostname ||
    url.port ||
    !url.hostname.endsWith('.vercel.app')
  ) {
    throw new Error('VERCEL_URL must be an exact vercel.app deployment hostname.');
  }
  return url.origin;
}

export function getApplicationOrigin(env: ApplicationOriginEnv = process.env): string {
  const configuredOrigin = env.APP_ORIGIN?.trim();
  if (configuredOrigin) return validateConfiguredOrigin(configuredOrigin);

  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) {
    return previewOriginFromVercelUrl(env.VERCEL_URL);
  }

  throw new Error('APP_ORIGIN is missing.');
}
