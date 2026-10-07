import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { diligenceReviewCommandV1Schema, diligenceReviewQueryV1Schema } from '@/lib/airprop/diligence-review-command-v1';
import { diligenceHeaders, diligenceFailure, diligenceDatabaseFailure } from '@/lib/airprop/diligence-route-response';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
export async function POST(request:NextRequest) {
 if(!hasTrustedMutationOrigin(request))return diligenceFailure('BAD_ORIGIN',403);
 if(!isApplicationJson(request.headers.get('content-type')))return diligenceFailure('UNSUPPORTED_MEDIA_TYPE',415);
 const {data:body,errorResponse}=await parseJsonWithLimit(request,512*1024);
 if(errorResponse){for(const [k,v]of Object.entries(diligenceHeaders))errorResponse.headers.set(k,v);return errorResponse;}
 const parsed=diligenceReviewCommandV1Schema.safeParse(body);if(!parsed.success)return diligenceFailure('INVALID_REQUEST',400);
 const supabase=await createClient();const {data:claims,error:authError}=await supabase.auth.getClaims();
 if(authError||!claims?.claims?.sub)return diligenceFailure('UNAUTHORIZED',401);
 const p=parsed.data;const args={p_context_id:p.context_id,p_workspace_id:p.workspace_id,p_opportunity_id:p.opportunity_id,p_diligence_case_id:p.diligence_case_id,p_document_context_id:p.document_context_id,p_expected_revision:p.expected_revision,p_idempotency_key:p.idempotency_key};
 const {data,error}=await supabase.schema('customer_api').rpc((p.action==='save'?'save_airprop_diligence_revision_v1':'submit_airprop_diligence_review_v1') as never,
 (p.action==='save'?{...args,p_snapshot:p.snapshot}:{...args,p_expected_underwriting_version:p.expected_underwriting_version,p_expected_policy_version:p.expected_policy_version}) as never);
 if(error)return diligenceDatabaseFailure(error);
 if(!data||typeof data!=='object'||!('idempotent'in data)||typeof (data as {idempotent?:unknown}).idempotent!=='boolean')return diligenceFailure('AIRPROP_REQUEST_FAILED',500);
 return NextResponse.json(data,{status:(data as {idempotent:boolean}).idempotent?200:201,headers:diligenceHeaders});
}
export async function GET(request:NextRequest) {
 const entries=Array.from(request.nextUrl.searchParams.entries());if(new Set(entries.map(([k])=>k)).size!==entries.length)return diligenceFailure('INVALID_REQUEST',400);
 const parsed=diligenceReviewQueryV1Schema.safeParse(Object.fromEntries(entries));if(!parsed.success)return diligenceFailure('INVALID_REQUEST',400);
 const supabase=await createClient();const {data:claims,error:authError}=await supabase.auth.getClaims();if(authError||!claims?.claims?.sub)return diligenceFailure('UNAUTHORIZED',401);
 const p=parsed.data;const {data,error}=await supabase.schema('customer_api').rpc('get_airprop_diligence_review_v1' as never,{p_context_id:p.context_id,p_workspace_id:p.workspace_id,p_opportunity_id:p.opportunity_id,p_diligence_case_id:p.diligence_case_id,p_document_context_id:p.document_context_id??null} as never);
 if(error)return diligenceDatabaseFailure(error);if(!data)return diligenceFailure('AIRPROP_REQUEST_FAILED',500);return NextResponse.json(data,{headers:diligenceHeaders});
}
