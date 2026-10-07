import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'CDN-Cache-Control': 'no-store',
  'Surrogate-Control': 'no-store',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'Cookie',
};

const claimSchema = z.object({
  invitation_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(120),
  locale: z.enum(['ro', 'en', 'fa']),
  timezone: z.string().trim().min(1).max(100),
});

type InvitationClaimResult = {
  claim_status: 'claimed' | 'already_claimed_by_you';
  customer_workspace_id: string;
  membership_id: string;
  onboarding_required: boolean;
};

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return json({ error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' } }, 403);
  }

  let input: z.infer<typeof claimSchema>;
  try {
    input = claimSchema.parse(await request.json());
  } catch {
    return json({ error: { code: 'INVALID_CLAIM_REQUEST', message: 'Invitation selection is invalid.' } }, 400);
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    return json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'A verified invitation session is required.' } }, 401);
  }

  const { data, error } = await supabase
    .schema('customer_api')
    .rpc('claim_workspace_invitation_v1', {
      p_invitation_id: input.invitation_id,
      p_display_name: input.display_name,
      p_locale: input.locale,
      p_timezone: input.timezone,
    });

  const result = (Array.isArray(data) ? data[0] : data) as InvitationClaimResult | null;
  if (error || !result || !['claimed', 'already_claimed_by_you'].includes(result.claim_status)) {
    return json({ error: { code: 'INVITATION_UNAVAILABLE', message: 'The invitation cannot be completed.' } }, 409);
  }

  return json({ claimed: true, status: result.claim_status }, 200);
}
