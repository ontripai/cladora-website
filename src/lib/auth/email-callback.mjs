const LANGUAGES = Object.freeze(['ro', 'en', 'fa']);
export const AUTH_EMAIL_TYPES = Object.freeze([
  'email',
  'invite',
  'magiclink',
  'recovery',
  'signup',
  'email_change',
]);

const FORBIDDEN_AUTH_QUERY_KEYS = new Set([
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'session',
  'session_id',
  'token',
]);

const DEFAULT_DESTINATIONS = {
  email: (lang) => `/${lang}/auth-result?status=confirmed`,
  invite: (lang) => `/${lang}/invitation-continuation`,
  magiclink: (lang) => `/${lang}/app/dashboard`,
  recovery: (lang) => `/${lang}/reset-password`,
  signup: (lang) => `/${lang}/auth-result?status=confirmed`,
  email_change: (lang) => `/${lang}/auth-result?status=confirmed`,
};

const ALLOWED_NEXT_PATHS = {
  email: (lang) => [`/${lang}/app/dashboard`],
  invite: (lang) => [`/${lang}/invitation-continuation`],
  magiclink: (lang) => [`/${lang}/app/dashboard`],
  recovery: (lang) => [`/${lang}/reset-password`],
  signup: (lang) => [`/${lang}/app/dashboard`],
  email_change: (lang) => [`/${lang}/app/settings`],
};

export function isSupportedLocale(value) {
  return typeof value === 'string' && LANGUAGES.includes(value);
}

export function isSupportedAuthEmailType(value) {
  return typeof value === 'string' && AUTH_EMAIL_TYPES.includes(value);
}

export function hasForbiddenAuthQuery(searchParams) {
  for (const key of searchParams.keys()) {
    if (FORBIDDEN_AUTH_QUERY_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

export function hasDuplicateCallbackParameters(searchParams) {
  return ['code', 'token_hash', 'type', 'next'].some((key) => searchParams.getAll(key).length > 1);
}

export function parseCallbackContract(searchParams) {
  const hasCode = searchParams.has('code');
  const hasTokenHash = searchParams.has('token_hash');
  const hasType = searchParams.has('type');

  // Mutual exclusivity: code and token_hash cannot coexist.
  if (hasCode && hasTokenHash) {
    return { valid: false, reason: 'unsafe' };
  }

  // If code is present, type must NOT be present
  if (hasCode && hasType) {
    return { valid: false, reason: 'unsafe' };
  }

  // Case 1: PKCE Code Flow
  if (hasCode) {
    const code = searchParams.get('code');
    if (!code || code.length < 16 || code.length > 512 || /\s/.test(code)) {
      return { valid: false, reason: 'missing' };
    }
    return {
      valid: true,
      kind: 'pkce',
      code,
      next: searchParams.get('next'),
    };
  }

  // Case 2: Token Hash OTP Flow
  if (hasTokenHash) {
    const tokenHash = searchParams.get('token_hash');
    if (!tokenHash || tokenHash.length < 16 || tokenHash.length > 256 || /\s/.test(tokenHash)) {
      return { valid: false, reason: 'missing' };
    }
    const rawType = searchParams.get('type');
    if (!isSupportedAuthEmailType(rawType)) {
      return { valid: false, reason: 'invalid_type' };
    }
    return {
      valid: true,
      kind: 'otp',
      tokenHash,
      type: rawType,
      next: searchParams.get('next'),
    };
  }

  return { valid: false, reason: 'missing' };
}

export function hasUnexpectedCallbackQuery(searchParams) {
  const isPkce = searchParams.has('code');
  const allowed = isPkce ? new Set(['code', 'next']) : new Set(['token_hash', 'type', 'next']);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) return true;
  }
  return false;
}

export const hasUnexpectedQuery = hasUnexpectedCallbackQuery;

export function resolveAuthEmailDestination(lang, type, rawNext) {
  if (!isSupportedLocale(lang) || !isSupportedAuthEmailType(type)) return null;
  if (!rawNext) return DEFAULT_DESTINATIONS[type](lang);
  if (!rawNext.startsWith('/') || rawNext.startsWith('//')) return null;

  let parsed;
  try {
    parsed = new URL(rawNext, 'https://callback.invalid');
  } catch {
    return null;
  }

  if (
    parsed.origin !== 'https://callback.invalid' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  return ALLOWED_NEXT_PATHS[type](lang).includes(parsed.pathname) ? parsed.pathname : null;
}

export function resolvePkceDestination(lang, rawNext) {
  if (!isSupportedLocale(lang)) return null;
  if (!rawNext) return `/${lang}/app/dashboard`;
  if (!rawNext.startsWith('/') || rawNext.startsWith('//')) return null;

  let parsed;
  try {
    parsed = new URL(rawNext, 'https://callback.invalid');
  } catch {
    return null;
  }

  if (
    parsed.origin !== 'https://callback.invalid' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  const allowedPaths = [
    `/${lang}/reset-password`,
    `/${lang}/app/dashboard`,
    `/${lang}/invitation-continuation`,
    `/${lang}/app/settings`,
  ];

  return allowedPaths.includes(parsed.pathname) ? parsed.pathname : null;
}

export function mapOtpErrorStatus(code) {
  return code === 'otp_expired' ? 'expired' : 'invalid';
}
