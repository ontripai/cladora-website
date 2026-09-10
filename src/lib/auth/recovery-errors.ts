export type RecoveryErrorCode =
  | 'recovery_session_missing'
  | 'recovery_link_expired'
  | 'recovery_link_already_used'
  | 'password_policy_failed'
  | 'same_password_rejected'
  | 'rate_limited'
  | 'unexpected_update_failure';

export function mapUpdateUserError(err: unknown): RecoveryErrorCode {
  if (!err || typeof err !== 'object') return 'unexpected_update_failure';
  const e = err as { name?: string; code?: string; status?: number; message?: string };

  if (e.name === 'AuthSessionMissingError' || e.code === 'session_missing' || e.status === 401) {
    return 'recovery_session_missing';
  }

  if (
    e.code === 'same_password' ||
    e.code === 'current_password_required' ||
    (e.status === 422 &&
      typeof e.message === 'string' &&
      (e.message.toLowerCase().includes('same') || e.message.toLowerCase().includes('different')))
  ) {
    return 'same_password_rejected';
  }

  if (
    e.name === 'AuthWeakPasswordError' ||
    e.code === 'weak_password' ||
    e.code === 'password_policy_violation' ||
    (e.status === 422 && typeof e.message === 'string' && e.message.toLowerCase().includes('character'))
  ) {
    return 'password_policy_failed';
  }

  if (e.code === 'over_request_rate_limit' || e.code === 'rate_limit' || e.status === 429) {
    return 'rate_limited';
  }

  if (e.code === 'session_expired' || e.code === 'otp_expired') {
    return 'recovery_link_expired';
  }

  if (
    e.code === 'token_already_used' ||
    e.code === 'code_challenge_failed' ||
    e.code === 'flow_state_expired' ||
    e.code === 'flow_state_not_found'
  ) {
    return 'recovery_link_already_used';
  }

  return 'unexpected_update_failure';
}

export const recoveryErrorCopy = {
  ro: {
    recovery_session_missing: 'Sesiunea de recuperare lipsește sau a expirat. Solicită din nou un link de recuperare.',
    recovery_link_expired: 'Linkul de recuperare a expirat. Te rugăm să trimiți o nouă solicitare.',
    recovery_link_already_used: 'Acest link de recuperare a fost deja utilizat și nu mai este valabil.',
    password_policy_failed: 'Parola nu respectă cerințele de securitate (minimum 8 caractere, o literă și o cifră).',
    same_password_rejected: 'Parola nouă nu poate fi identică cu parola anterioară.',
    rate_limited: 'Prea multe încercări. Te rugăm să aștepți câteva minute înainte de a reîncerca.',
    unexpected_update_failure: 'Actualizarea parolei a eșuat. Te rugăm să încerci mai târziu sau să contactezi suportul.',
  },
  en: {
    recovery_session_missing: 'The recovery session is missing or expired. Please request a new recovery link.',
    recovery_link_expired: 'The recovery link has expired. Please submit a new request.',
    recovery_link_already_used: 'This recovery link has already been used and is no longer valid.',
    password_policy_failed: 'The password does not meet the security policy (at least 8 characters, one letter, and one number).',
    same_password_rejected: 'The new password cannot be the same as the previous password.',
    rate_limited: 'Too many attempts. Please wait a few minutes before trying again.',
    unexpected_update_failure: 'Password update could not be completed. Please try again later or contact support.',
  },
  fa: {
    recovery_session_missing: 'نشست بازیابی رمز عبور یافت نشد یا منقضی شده است. لطفاً پیوند جدیدی درخواست کنید.',
    recovery_link_expired: 'پیوند بازیابی رمز عبور منقضی شده است. لطفاً درخواست جدیدی ثبت کنید.',
    recovery_link_already_used: 'این پیوند بازیابی پیش‌تر استفاده شده و دیگر معتبر نیست.',
    password_policy_failed: 'رمز عبور با خط‌مشی امنیتی مطابقت ندارد (حداقل ۸ نویسه، شامل حرف و عدد).',
    same_password_rejected: 'رمز عبور جدید نمی‌تواند همانند رمز عبور قبلی باشد.',
    rate_limited: 'تعداد تلاش‌های مجاز بیش از حد بوده است. لطفاً دقایقی دیگر دوباره امتحان کنید.',
    unexpected_update_failure: 'به‌روزرسانی رمز عبور انجام نشد. لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید.',
  },
} as const;
