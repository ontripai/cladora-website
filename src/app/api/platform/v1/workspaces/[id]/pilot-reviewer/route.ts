import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApplicationOrigin } from '@/lib/supabase/server-env';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';

const headers = { 'Cache-Control': 'no-store, private' };
const schema = z.object({ email: z.string().trim().email().max(320), reason: z.string().trim().min(10).max(500), lang: z.enum(['ro','en','fa']) });

export async function POST(request: NextRequest, props: { params: Promise<{id:string}> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({error:{code:'ORIGIN_REJECTED'}},{status:403,headers});
  const {id} = await props.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({error:{code:'INVALID_WORKSPACE'}},{status:400,headers});
  const ctx = await getPlatformAuthContext();
  if (!ctx.isAuthorized || !ctx.platformUser || !hasPlatformAal2(ctx) || !hasPlatformRole(ctx,'PLATFORM_SUPER_ADMIN') || !hasWorkspaceAssignment(ctx,id,'workspace'))
    return NextResponse.json({error:{code:'ACCESS_DENIED'}},{status:403,headers});
  const input = schema.safeParse(await request.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:{code:'INVALID_PAYLOAD'}},{status:400,headers});
  const supabase=await createClient();
  const {data,error}=await supabase.schema('customer_api').rpc('prepare_pilot_setup_reviewer_v1',{
    p_workspace_id:id,p_email:input.data.email,p_reason:input.data.reason,
  });
  if(error || !data) return NextResponse.json({error:{code:'REVIEWER_PREPARATION_FAILED'}},{status:409,headers});
  const prepared = data as {id:string;expires_at:string};
  const redirectTo=`${getApplicationOrigin()}/${input.data.lang}/auth/callback?next=/${input.data.lang}/pilot-reviewer`;
  const {error:deliveryError}=await createAdminClient().auth.admin.inviteUserByEmail(input.data.email,{redirectTo});
  if(deliveryError){
    await supabase.schema('customer_api').rpc('revoke_pilot_setup_reviewer_v1',{p_id:prepared.id,p_reason:'Auth invitation delivery failed'});
    return NextResponse.json({error:{code:'INVITATION_DELIVERY_FAILED'}},{status:502,headers});
  }
  return NextResponse.json({id:prepared.id,expires_at:prepared.expires_at,delivery:'sent'},{status:201,headers});
}
