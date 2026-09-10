import crypto from 'node:crypto';

if (typeof window !== 'undefined') {
  throw new Error('This module can only be loaded on the server.');
}

export const RECOVERY_COOKIE_NAME = 'cladora_recovery_session';
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes

interface RecoveryTokenPayload {
  userId: string;
  sessionId?: string;
  purpose: 'password_recovery';
  iat: number;
  exp: number;
}

function getServerSecret(): string {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sb_secret_')) {
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_DEV_FALLBACK_SECRET === 'true') {
      return 'sb_secret_test_fallback_mock_key_only_for_unit_tests';
    }
    throw new Error('SUPABASE_SECRET_KEY is missing or invalid.');
  }
  return secretKey;
}

function getDerivedKey(): Buffer {
  const secret = getServerSecret();
  return crypto.createHmac('sha256', secret).update('cladora_password_recovery_cookie_signer_v1').digest();
}

export function createRecoverySessionToken(userId: string, sessionId?: string): string {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required to issue a recovery session token.');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: RecoveryTokenPayload = {
    userId: userId.trim(),
    sessionId: sessionId?.trim() || undefined,
    purpose: 'password_recovery',
    iat: now,
    exp: now + RECOVERY_COOKIE_MAX_AGE_SECONDS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getDerivedKey()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyRecoverySessionToken(rawToken: string | undefined | null): { userId: string; sessionId?: string } | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const parts = rawToken.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  try {
    const expectedSignature = crypto.createHmac('sha256', getDerivedKey()).update(payloadB64).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as Partial<RecoveryTokenPayload>;

    if (payload.purpose !== 'password_recovery') return null;
    if (!payload.userId || typeof payload.userId !== 'string') return null;
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null;

    const now = Math.floor(Date.now() / 1000);
    // 30 seconds clock skew tolerance for iat
    if (payload.iat > now + 30) return null;
    if (payload.exp <= now) return null;

    return {
      userId: payload.userId,
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : undefined,
    };
  } catch {
    return null;
  }
}

export function getRecoveryCookieOptions(secure: boolean = true) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getClearRecoveryCookieOptions(secure: boolean = true) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}
