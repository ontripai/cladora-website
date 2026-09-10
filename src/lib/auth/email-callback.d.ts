export const AUTH_EMAIL_TYPES: readonly [
  'email',
  'invite',
  'magiclink',
  'recovery',
  'signup',
  'email_change',
];

export type AuthEmailType = (typeof AUTH_EMAIL_TYPES)[number];

export function isSupportedLocale(value: unknown): value is 'ro' | 'en' | 'fa';
export function isSupportedAuthEmailType(value: unknown): value is AuthEmailType;
export function hasForbiddenAuthQuery(searchParams: URLSearchParams): boolean;
export function hasDuplicateCallbackParameters(searchParams: URLSearchParams): boolean;
export function hasUnexpectedCallbackQuery(searchParams: URLSearchParams): boolean;
export const hasUnexpectedQuery: (searchParams: URLSearchParams) => boolean;

export type CallbackContract =
  | { valid: true; kind: 'pkce'; code: string; next: string | null }
  | { valid: true; kind: 'otp'; tokenHash: string; type: AuthEmailType; next: string | null }
  | { valid: false; reason: string };

export function parseCallbackContract(searchParams: URLSearchParams): CallbackContract;
export function resolveAuthEmailDestination(lang: string, type: string, rawNext: string | null): string | null;
export function resolvePkceDestination(lang: string, rawNext: string | null): string | null;
export function mapOtpErrorStatus(code: string | undefined): 'expired' | 'invalid';
