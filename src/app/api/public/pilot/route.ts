import { NextRequest, NextResponse } from 'next/server.js';
import { z } from 'zod';
import { validateRequestOrigin } from '../../../../lib/security/origin.ts';
import { getClientIp, hashClientIp } from '../../../../lib/security/ip-hash.ts';
import { generateReferenceId } from '../../../../lib/security/reference-id.ts';
import { computeSubmissionFingerprint } from '../../../../lib/security/fingerprint.ts';
import { checkRateLimit } from '../../../../lib/security/rate-limiter.ts';
import { verifyTurnstileToken } from '../../../../lib/security/turnstile-server.ts';
import { notifyNewLead } from '../../../../lib/notifications/lead-notifier.ts';
import { isSupabaseConfigured } from '../../../../lib/supabase/env.ts';
import { isApplicationJson, parseJsonWithLimit } from '../../../../lib/security/request-body.ts';
import { validateLeadServiceConfiguration } from '../../../../lib/security/lead-security-config.ts';

// Enforce dynamic server execution
export const dynamic = 'force-dynamic';

export const PILOT_ROLES = ['admin', 'president', 'cenzor', 'owner'] as const;
export const PILOT_BUILDING_TYPES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] as const;

const PilotPayloadSchema = z
  .object({
    fullName: z
      .string({ message: 'Full name is required.' })
      .trim()
      .min(2, { message: 'Full name must be at least 2 characters.' })
      .max(255, { message: 'Full name cannot exceed 255 characters.' }),
    email: z
      .string({ message: 'Email address is required.' })
      .trim()
      .email({ message: 'Please enter a valid email address.' })
      .max(255, { message: 'Email address cannot exceed 255 characters.' }),
    phone: z
      .string({ message: 'Phone number is required for pilot verification.' })
      .trim()
      .min(5, { message: 'Phone number must be at least 5 characters.' })
      .max(50, { message: 'Phone number cannot exceed 50 characters.' }),
    role: z.enum(PILOT_ROLES, { message: 'Please select a valid role.' }).optional().nullable(),
    buildingType: z.enum(PILOT_BUILDING_TYPES, { message: 'Please select a valid building type.' }).optional().nullable(),
    unitsCount: z
      .number({ message: 'Units count must be a number.' })
      .int({ message: 'Units count must be a whole integer.' })
      .min(1, { message: 'Units count must be at least 1 unit.' })
      .max(10000, { message: 'Units count cannot exceed 10,000 units.' }),
    currentSoftware: z
      .string()
      .trim()
      .max(100, { message: 'Current software cannot exceed 100 characters.' })
      .optional()
      .nullable(),
    city: z
      .string()
      .trim()
      .max(100, { message: 'City cannot exceed 100 characters.' })
      .optional()
      .nullable(),
    county: z
      .string()
      .trim()
      .max(100, { message: 'County cannot exceed 100 characters.' })
      .optional()
      .nullable(),
    message: z
      .string()
      .trim()
      .max(5000, { message: 'Message cannot exceed 5000 characters.' })
      .optional()
      .nullable(),
    locale: z.enum(['ro', 'en', 'fa'], { message: 'Unsupported language.' }),
    sourcePage: z
      .string()
      .trim()
      .max(255)
      .optional()
      .nullable(),
    utm_source: z.string().trim().max(100).optional().nullable(),
    utm_medium: z.string().trim().max(100).optional().nullable(),
    utm_campaign: z.string().trim().max(100).optional().nullable(),
    utm_content: z.string().trim().max(100).optional().nullable(),
    utm_term: z.string().trim().max(100).optional().nullable(),
    consentPrivacy: z.literal(true, {
      message: 'You must accept the privacy policy to submit a pilot application.',
    }),
    honeypot: z.string().optional(),
    turnstileToken: z.string().optional().nullable(),
  })
  .strict();

export async function POST(request: NextRequest) {
  // 1. Same-Origin Validation
  if (!validateRequestOrigin(request)) {
    return NextResponse.json(
      {
        ok: false,
        code: 'FORBIDDEN_ORIGIN',
        message: 'Requests from this origin are not permitted.',
      },
      { status: 403 }
    );
  }

  // 2. Strict Content-Type Enforcement (must be application/json before body parse)
  if (!isApplicationJson(request.headers.get('content-type'))) {
    return NextResponse.json(
      {
        ok: false,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json.',
      },
      { status: 415 }
    );
  }

  // 3. Enforce Request Body Size Limit before parsing (32 KB max)
  const { data: rawBody, errorResponse } = await parseJsonWithLimit(request);
  if (errorResponse) {
    return errorResponse;
  }

  // 4. Honeypot check (silent discard of spam bot submissions)
  if (typeof rawBody === 'object' && rawBody !== null && 'honeypot' in rawBody) {
    const hp = (rawBody as { honeypot?: unknown }).honeypot;
    if (typeof hp === 'string' && hp.trim().length > 0) {
      return NextResponse.json(
        {
          ok: true,
          referenceId: generateReferenceId('pilot'),
          message: 'Pilot application received.',
        },
        { status: 200 }
      );
    }
  }

  // 5. Pre-execution Service Configuration Check (Fail-closed 503 before Rate Limiting)
  const configValidation = validateLeadServiceConfiguration();
  if (!configValidation.valid) {
    console.error('[LEAD_SERVICE_CONFIG_ERROR]', {
      reason: configValidation.reason,
      leadType: 'pilot',
    });
    return NextResponse.json(
      {
        ok: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is temporarily unavailable. Please try again later.',
      },
      { status: 503 }
    );
  }

  // 6. Strict Schema Validation with sanitized safe error response
  const validation = PilotPayloadSchema.safeParse(rawBody);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    const field = firstIssue?.path?.join('.') || 'unknown';
    const safeMessage = firstIssue?.message || 'Invalid pilot application submission.';
    return NextResponse.json(
      {
        ok: false,
        code: 'VALIDATION_ERROR',
        field,
        message: safeMessage,
      },
      { status: 400 }
    );
  }

  const data = validation.data;
  const clientIp = getClientIp(request);
  const nowIso = new Date().toISOString();

  // 5. Cloudflare Turnstile Verification
  const turnstile = await verifyTurnstileToken(data.turnstileToken, clientIp);
  if (!turnstile.success) {
    return NextResponse.json(
      {
        ok: false,
        code: turnstile.errorCode || 'CAPTCHA_VERIFICATION_FAILED',
        message: 'Security challenge failed. Please refresh and try again.',
      },
      { status: 400 }
    );
  }

  // 6. Persistent Database Rate Limiter (Pilot: 3 requests per 15 minutes)
  const ipHash = hashClientIp(clientIp);
  const actionKey = `pilot:${ipHash}`;
  const rateLimit = await checkRateLimit(actionKey, 'pilot');

  const responseHeaders = new Headers();
  responseHeaders.set('X-RateLimit-Limit', '3');
  responseHeaders.set('X-RateLimit-Remaining', String(Math.max(0, 3 - rateLimit.currentCount)));

  if (!rateLimit.allowed) {
    responseHeaders.set('Retry-After', String(rateLimit.retryAfterSeconds));
    return NextResponse.json(
      {
        ok: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait a few minutes before trying again.',
      },
      { status: 429, headers: responseHeaders }
    );
  }

  // 7. Atomic Deduplication via Rolling 15-Minute HMAC Fingerprint & Bucket
  const normalizedEmail = data.email.toLowerCase();
  const { fingerprint: submissionFingerprint, bucket: fingerprintBucket } = computeSubmissionFingerprint({
    leadType: 'pilot',
    normalizedEmail,
    normalizedPhone: data.phone,
    messageSnippet: data.message || undefined,
  });

  // 8. Lead Persistence to Supabase
  if (!isSupabaseConfigured()) {
    const isProductionOrPreview =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_ENV === 'preview';

    if (isProductionOrPreview || process.env.ALLOW_MOCK_LEAD_CAPTURE !== 'true') {
      console.error('[SERVICE_UNAVAILABLE] Supabase is not configured in production/preview.');
      return NextResponse.json(
        {
          ok: false,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Lead submission service is currently unavailable. Please try again later.',
        },
        { status: 503, headers: responseHeaders }
      );
    }

    // Local development mock only when explicitly allowed
    const mockReferenceId = generateReferenceId('pilot');
    return NextResponse.json(
      {
        ok: true,
        referenceId: mockReferenceId,
        message: 'Pilot application received (mock).',
      },
      { status: 200, headers: responseHeaders }
    );
  }

  const rawUserAgent = request.headers.get('user-agent') || '';
  const sanitizedUserAgent = rawUserAgent.slice(0, 250);

  const initialMetadata = {
    origin: request.headers.get('origin'),
    rateLimitCount: rateLimit.currentCount,
    submissionFingerprint,
    fingerprintBucket,
    notification: {
      status: 'pending',
      attemptedAt: nowIso,
    },
  };

  let savedReferenceId: string | null = null;
  const MAX_RETRIES = 3;

  try {
    const { createAdminClient } = await import('../../../../lib/supabase/admin.ts');
    const supabase = createAdminClient();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const candidateReferenceId = generateReferenceId('pilot');

      const { error: insertError } = await supabase.from('marketing_leads').insert({
        reference_id: candidateReferenceId,
        lead_type: 'pilot',
        full_name: data.fullName,
        email: normalizedEmail,
        phone: data.phone,
        role: data.role || null,
        building_type: data.buildingType || null,
        units_count: data.unitsCount,
        current_software: data.currentSoftware || null,
        city: data.city || null,
        county: data.county || null,
        message: data.message || null,
        locale: data.locale,
        source_page: data.sourcePage || null,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_content: data.utm_content || null,
        utm_term: data.utm_term || null,
        status: 'new',
        consent_privacy: true,
        consent_timestamp: nowIso,
        ip_hash: ipHash,
        user_agent: sanitizedUserAgent,
        metadata: initialMetadata,
        submission_fingerprint: submissionFingerprint,
        fingerprint_bucket: fingerprintBucket,
      });

      if (!insertError) {
        savedReferenceId = candidateReferenceId;
        break;
      }

      // Check duplicate fingerprint constraint (atomic 409)
      if (
        insertError.code === '23505' &&
        (insertError.message?.includes('fingerprint') || insertError.details?.includes('fingerprint'))
      ) {
        return NextResponse.json(
          {
            ok: false,
            code: 'DUPLICATE_SUBMISSION',
            message: 'A matching request was already submitted recently. Please wait a few minutes before resending.',
          },
          { status: 409, headers: responseHeaders }
        );
      }

      // If collision on reference_id, retry with new reference ID
      if (
        insertError.code === '23505' &&
        (insertError.message?.includes('reference_id') || insertError.details?.includes('reference_id'))
      ) {
        console.warn(`[REFERENCE_COLLISION] Retrying generation (attempt ${attempt + 1}/${MAX_RETRIES})`);
        continue;
      }

      console.error('[DATABASE_ERROR] Failed to save pilot lead:', insertError.message);
      return NextResponse.json(
        {
          ok: false,
          code: 'SUBMISSION_FAILED',
          message: 'Unable to save request at this time. Please try again later.',
        },
        { status: 500, headers: responseHeaders }
      );
    }

    if (!savedReferenceId) {
      return NextResponse.json(
        {
          ok: false,
          code: 'SUBMISSION_FAILED',
          message: 'Unable to allocate a unique reference. Please try again later.',
        },
        { status: 500, headers: responseHeaders }
      );
    }
  } catch (err: unknown) {
    console.error('[DATABASE_EXCEPTION] Pilot lead error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      {
        ok: false,
        code: 'SUBMISSION_FAILED',
        message: 'Unable to save request at this time. Please try again later.',
      },
      { status: 500, headers: responseHeaders }
    );
  }

  // 9. Lead Notification Dispatch (awaited, failure does NOT delete or fail saved lead)
  const notifResult = await notifyNewLead({
    referenceId: savedReferenceId,
    leadType: 'pilot',
    fullName: data.fullName,
    email: normalizedEmail,
    phone: data.phone,
    role: data.role || null,
    buildingType: data.buildingType || null,
    unitsCount: data.unitsCount,
    currentSoftware: data.currentSoftware || null,
    city: data.city || null,
    county: data.county || null,
    message: data.message || null,
    locale: data.locale,
    createdAt: nowIso,
    sourcePage: data.sourcePage,
  });

  try {
    const { createAdminClient } = await import('../../../../lib/supabase/admin.ts');
    const supabase = createAdminClient();
    const { error: metadataUpdateError } = await supabase
      .from('marketing_leads')
      .update({
        metadata: {
          ...initialMetadata,
          notification: {
            status: notifResult.status,
            attemptedAt: notifResult.attemptedAt,
            errorCode: notifResult.errorCode ?? null,
          },
        },
      })
      .eq('reference_id', savedReferenceId);

    if (metadataUpdateError) {
      console.error('[METADATA_UPDATE_ERROR] Failed to record notification status in pilot lead record:', {
        referenceId: savedReferenceId,
        code: metadataUpdateError.code,
        message: metadataUpdateError.message,
      });
    }
  } catch (updateErr: unknown) {
    console.error('[METADATA_UPDATE_EXCEPTION] Exception while recording pilot notification status:', {
      referenceId: savedReferenceId,
      errorName: updateErr instanceof Error ? updateErr.name : 'UnknownError',
    });
  }

  return NextResponse.json(
    {
      ok: true,
      referenceId: savedReferenceId,
      message: 'Thank you for your application. Our onboarding team will contact you shortly.',
    },
    { status: 200, headers: responseHeaders }
  );
}
