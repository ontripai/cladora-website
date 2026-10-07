import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { diligenceEvidenceQueryV1Schema } from '@/lib/airprop/diligence-review-command-v1';
import { diligenceHeaders, diligenceFailure, diligenceDatabaseFailure } from '@/lib/airprop/diligence-route-response';
export async function GET(request:NextRequest) {
 const entries=Array.from(request.nextUrl.searchParams.entries());if(new Set(entries.map(([k])=>k)).size!==entries.length)return diligenceFailure('INVALID_REQUEST',400);
 const parsed=diligenceEvidenceQueryV1Schema.safeParse(Object.fromEntries(entries));if(!parsed.success)return diligenceFailure('INVALID_REQUEST',400);
 const supabase=await createClient();const {data:claims,error:authError}=await supabase.auth.getClaims();if(authError||!claims?.claims?.sub)return diligenceFailure('UNAUTHORIZED',401);
 const p=parsed.data;const {data,error}=await supabase.schema('customer_api').rpc('list_airprop_diligence_evidence_v1' as never,{p_context_id:p.context_id,p_workspace_id:p.workspace_id,p_opportunity_id:p.opportunity_id,p_document_context_id:p.document_context_id} as never);
 if(error)return diligenceDatabaseFailure(error);if(!data)return diligenceFailure('AIRPROP_REQUEST_FAILED',500);return NextResponse.json(data,{headers:diligenceHeaders});
}
