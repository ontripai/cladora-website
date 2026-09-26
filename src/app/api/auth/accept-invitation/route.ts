import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getApplicationOrigin } from '@/lib/supabase/server-env';
import { createClient } from '@/lib/supabase/server';
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';

const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, private' };
const INVITATION_COOKIE = 'cladora-invitation';
const schema = z.object({
  display_name: z.string().trim().min(2).max(120),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(128).refine(meetsPasswordPolicy),
  locale: z.enum(['ro', 'en', 'fa']),
  timezone: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== getApplicationOrigin()) {
    return NextResponse.json(
      { error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_ACCEPTANCE_PAYLOAD', message: 'Account activation fields are invalid.' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const token = (await cookies()).get(INVITATION_COOKIE)?.value;
  if (!token || token.length < 40 || token.length > 128) {
    return NextResponse.json(
      { error: { code: 'INVALID_INVITATION', message: 'Invitation is unavailable or expired.' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authenticated invitation session required.' } },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password: input.password });
  if (passwordError) {
    return NextResponse.json(
      { error: { code: 'PASSWORD_UPDATE_FAILED', message: 'Password could not be updated.' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const { data, error } = await supabase.schema('platform').rpc(
    'accept_primary_admin_invitation',
    {
      p_token: token,
      p_display_name: input.display_name,
      p_locale: input.locale,
      p_timezone: input.timezone,
    },
  );

  if (error || !data) {
    return NextResponse.json(
      { error: { code: 'INVITATION_ACCEPTANCE_FAILED', message: 'Invitation could not be accepted.' } },
      { status: 409, headers: NO_CACHE_HEADERS },
    );
  }

  const accepted = Array.isArray(data) ? data[0] : data;
  const workspaceId = accepted?.customer_workspace_id;
  let workspaceVersion: number | undefined;
  if (workspaceId) {
    const { data: onboarding, error: onboardingError } = await supabase.schema('customer_api').rpc(
      'get_my_primary_admin_onboarding_v1',
      { p_workspace_id: workspaceId },
    );
    const state = Array.isArray(onboarding) ? onboarding[0] : onboarding;
    workspaceVersion = state?.workspace_version;
    if (onboardingError || !workspaceVersion) {
      return NextResponse.json(
        { error: { code: 'ONBOARDING_STATE_UNAVAILABLE', message: 'Onboarding state could not be resolved.' } },
        { status: 409, headers: NO_CACHE_HEADERS },
      );
    }
  }
  const response = NextResponse.json(
    { accepted: true, onboarding_required: true, workspace_id: workspaceId, workspace_version: workspaceVersion },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
  response.cookies.set(INVITATION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
