import { buildingSetupIdSchema } from '@/lib/customer/building-setup-schema';
import { caseWorkspaceCommandSchema, caseWorkspaceReceiptSchema } from '@/lib/customer/building-workspace-onboarding-case';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const permitted = async () => {
  const auth = await getPlatformAuthContext();
  return hasPlatformAal2(auth) && hasPlatformRole(auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS']);
};

export async function GET(request: Request) {
  if (!(await permitted())) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  const parsed = buildingSetupIdSchema.safeParse(new URL(request.url).searchParams.get('case_id'));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const key = new URL(request.url).searchParams.get('idempotency_key');
  if (key !== null) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) return NextResponse.json({error:{code:'INVALID_INPUT'}},{status:400,headers:HEADERS});
    const db = await createClient();
    const {data,error}=await db.schema('customer_api').rpc('get_case_workspace_attempt_v1' as never,{p_case_id:parsed.data,p_idempotency_key:key} as never);
    if(error)return NextResponse.json({error:{code:'RECOVERY_NOT_ALLOWED'}},{status:403,headers:HEADERS});
    const result=data===null?null:caseWorkspaceReceiptSchema.safeParse(data);
    if(result&&!result.success)return NextResponse.json({error:{code:'INVALID_RECOVERY_RESULT'}},{status:502,headers:HEADERS});
    return NextResponse.json({attempt:result?.success?result.data:null},{headers:HEADERS});
  }
  const db = await createClient();
  const [options, prepared] = await Promise.all([
    db.schema('customer_api').rpc('list_case_workspace_options_v1', { p_case_id: parsed.data }),
    db.schema('customer_api').rpc('list_case_prepared_workspaces_v1', { p_case_id: parsed.data }),
  ]);
  if (options.error || prepared.error) return NextResponse.json({ error: { code: 'CASE_UNAVAILABLE' } }, { status: 403, headers: HEADERS });
  return NextResponse.json({ options: options.data, prepared: prepared.data }, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!(await permitted())) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: HEADERS });
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:HEADERS});
  const {data:body,errorResponse}=await parseJsonWithLimit<unknown>(request,8*1024);
  if(errorResponse)return errorResponse;
  const parsed = caseWorkspaceCommandSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers: HEADERS });
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('create_case_workspace_v2' as never, {
    p_case_id: parsed.data.case_id, p_workspace_type: parsed.data.workspace_type,
    p_profile_code: parsed.data.profile_code, p_model_code: parsed.data.model_code,
    p_commercial_owner: parsed.data.commercial_owner, p_reason: parsed.data.reason, p_idempotency_key: parsed.data.idempotency_key,
  } as never);
  if (error) return NextResponse.json({ error: { code: 'CREATION_NOT_ALLOWED' } }, { status: error.code==='23505'?409:403, headers: HEADERS });
  const receipt=caseWorkspaceReceiptSchema.safeParse(data);
  if(!receipt.success)return NextResponse.json({error:{code:'INVALID_CREATION_RESULT'}},{status:502,headers:HEADERS});
  return NextResponse.json({ workspace: receipt.data }, { status: 201, headers: HEADERS });
}
