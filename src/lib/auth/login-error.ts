import type { Language } from '@/types';

const messages = {
  credentials: ['Emailul sau parola nu sunt corecte.', 'The email or password is incorrect.', 'ایمیل یا رمز عبور صحیح نیست.'],
  captcha: ['Verificarea anti-abuz nu a reușit. Repetă verificarea.', 'Abuse-protection verification failed. Complete it again.', 'بررسی ضدسوءاستفاده ناموفق بود؛ آن را دوباره تکمیل کنید.'],
  rate: ['Prea multe încercări. Încearcă din nou peste câteva minute.', 'Too many attempts. Try again in a few minutes.', 'تعداد تلاش‌ها بیش از حد مجاز است؛ چند دقیقه بعد دوباره امتحان کنید.'],
  unavailable: ['Serviciul de autentificare nu este disponibil momentan. Încearcă mai târziu.', 'The sign-in service is temporarily unavailable. Try again later.', 'سرویس ورود موقتاً در دسترس نیست؛ بعداً دوباره امتحان کنید.'],
  unknown: ['Autentificarea nu a putut fi finalizată. Dacă problema persistă, contactează administratorul.', 'Sign-in could not be completed. If this continues, contact the administrator.', 'ورود تکمیل نشد؛ اگر مشکل ادامه داشت با مدیر سامانه تماس بگیرید.'],
} as const;

// Never display provider messages: they may contain account or request details.
export function loginErrorMessage(error: { code?: string; status?: number; name?: string }, lang: Language): string {
  let kind: keyof typeof messages = 'unknown';
  if (error.code === 'invalid_credentials') kind = 'credentials';
  else if (error.code === 'captcha_failed') kind = 'captcha';
  else if (error.status === 429 || error.code === 'over_request_rate_limit') kind = 'rate';
  else if ((error.status ?? 0) >= 500 || error.code === 'request_timeout' || error.name === 'AuthRetryableFetchError') kind = 'unavailable';
  return messages[kind][lang === 'ro' ? 0 : lang === 'fa' ? 2 : 1];
}
