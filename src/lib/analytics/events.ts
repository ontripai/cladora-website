'use client';

export type AnalyticsEventName =
  | 'cta_pilot_clicked'
  | 'demo_started'
  | 'contact_form_started'
  | 'contact_form_submitted'
  | 'contact_form_failed'
  | 'pilot_form_started'
  | 'pilot_form_submitted'
  | 'pilot_form_failed'
  | 'pricing_calculated'
  | 'language_changed';

export interface AnalyticsEventProps {
  locale?: 'ro' | 'en' | 'fa';
  sourcePage?: string;
  formType?: 'contact' | 'pilot';
  selectedRole?: string;
  unitsBucket?: '1-20' | '21-50' | '51-100' | '101-250' | '250+';
  errorCategory?: 'validation' | 'rate_limit' | 'network' | 'captcha' | 'duplicate';
  targetLocale?: string;
  calculatedTier?: string;
}

export function getUnitsBucket(units: number): AnalyticsEventProps['unitsBucket'] {
  if (units <= 20) return '1-20';
  if (units <= 50) return '21-50';
  if (units <= 100) return '51-100';
  if (units <= 250) return '101-250';
  return '250+';
}

/**
 * Dispatches privacy-safe analytics events without any PII.
 * Never throws if no third-party analytics provider is loaded.
 */
export function trackEvent(name: AnalyticsEventName, props: AnalyticsEventProps = {}): void {
  if (typeof window === 'undefined') return;

  // Scrub any accidental PII
  const safeProps: Record<string, string | undefined> = {
    locale: props.locale,
    source_page: props.sourcePage,
    form_type: props.formType,
    selected_role: props.selectedRole,
    units_bucket: props.unitsBucket,
    error_category: props.errorCategory,
    target_locale: props.targetLocale,
    calculated_tier: props.calculatedTier,
  };

  // Remove undefined values
  Object.keys(safeProps).forEach((key) => {
    if (safeProps[key] === undefined) delete safeProps[key];
  });

  // 1. dataLayer support (Google Tag Manager / standard event stream)
  try {
    const dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push({ event: name, ...safeProps });
    }
  } catch {
    // Ignore error
  }

  // 2. Plausible / Umami custom event support
  try {
    const plausible = (window as unknown as { plausible?: (event: string, opts?: { props: unknown }) => void }).plausible;
    if (typeof plausible === 'function') {
      plausible(name, { props: safeProps });
    }
  } catch {
    // Ignore error
  }

  // Development debug logging
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[ANALYTICS] ${name}:`, safeProps);
  }
}
