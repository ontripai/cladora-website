import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { acquisitionCommandV1Schema, acquisitionDetailV1Schema, acquisitionQueryV1Schema, acquisitionResponseV1Schema } from '@/lib/airprop/acquisition-decision-v1';
import { diligenceHeaders, diligenceFailure } from '@/lib/airprop/diligence-route-response';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
function databaseFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') return diligenceFailure(['mfa_required', 'mfa_aal2_required'].includes(error.message ?? '') ? 'MFA_REQUIRED' : error.message === 'airprop_acquisition_independence_required' ? 'INDEPENDENT_REVIEWER_REQUIRED' : 'AIRPROP_ACCESS_DENIED', 403);
  if (error.code === 'P0002') return diligenceFailure('ACQUISITION_NOT_FOUND', 404);
  const conflicts: Record<string, string> = { airprop_idempotency_conflict: 'IDEMPOTENCY_CONFLICT', airprop_acquisition_not_ready: 'DILIGENCE_NOT_SUBMITTED', airprop_acquisition_baseline_conflict: 'BASELINE_CONFLICT', airprop_acquisition_proposal_conflict: 'PROPOSAL_CONFLICT', airprop_acquisition_decision_conflict: 'DECISION_CONFLICT' };
  if (error.code === '22023' && conflicts[error.message ?? '']) return diligenceFailure(conflicts[error.message ?? ''], 409);
  const invalid = ['22023', '22P02', '22003'].includes(error.code ?? '');
  return diligenceFailure(invalid ? 'INVALID_REQUEST' : 'AIRPROP_REQUEST_FAILED', invalid ? 400 : 500);
}
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return diligenceFailure('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return diligenceFailure('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 16 * 1024);
  if (errorResponse) { for (const [key, value] of Object.entries(diligenceHeaders)) errorResponse.headers.set(key, value); return errorResponse; }
  const parsed = acquisitionCommandV1Schema.safeParse(body);
  if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
  const db = await createClient(); const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return diligenceFailure('UNAUTHORIZED', 401);
  const p = parsed.data;
  const target = { p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_opportunity_id: p.opportunity_id, p_diligence_case_id: p.diligence_case_id,
    p_document_context_id: p.document_context_id, p_rationale: p.rationale, p_idempotency_key: p.idempotency_key };
  const { data, error } = await db.schema('customer_api').rpc((p.action === 'propose' ? 'propose_airprop_acquisition_v1' : 'decide_airprop_acquisition_v1') as never,
    (p.action === 'propose' ? { ...target, p_expected_submission_id: p.expected_submission_id, p_expected_diligence_revision: p.expected_diligence_revision, p_expected_underwriting_version: p.expected_underwriting_version }
      : { ...target, p_proposal_id: p.proposal_id, p_expected_decision_revision: p.expected_decision_revision, p_decision: p.decision }) as never);
  if (error) return databaseFailure(error);
  const response = acquisitionResponseV1Schema.safeParse(data);
  if (!response.success || response.data.workspace_id !== p.workspace_id || response.data.opportunity_id !== p.opportunity_id || response.data.diligence_case_id !== p.diligence_case_id) return diligenceFailure('AIRPROP_REQUEST_FAILED', 500);
  const expectedRevision = p.action === 'propose' ? 1 : p.expected_decision_revision + 1;
  const expectedStatus = p.action === 'propose' || (p.decision === 'approve' && expectedRevision === 2) ? 'pending' : p.decision === 'reject' ? 'rejected' : 'internally_approved';
  if (response.data.decision_revision !== expectedRevision || response.data.status !== expectedStatus || (p.action === 'decide' && response.data.proposal_id !== p.proposal_id)) return diligenceFailure('AIRPROP_REQUEST_FAILED', 500);
  return NextResponse.json(response.data, { status: response.data.idempotent ? 200 : 201, headers: diligenceHeaders });
}
export async function GET(request: NextRequest) {
  const entries = Array.from(request.nextUrl.searchParams.entries());
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return diligenceFailure('INVALID_REQUEST', 400);
  const parsed = acquisitionQueryV1Schema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
  const db = await createClient(); const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return diligenceFailure('UNAUTHORIZED', 401);
  const p = parsed.data;
  const { data, error } = await db.schema('customer_api').rpc('get_airprop_acquisition_v1' as never, { p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_opportunity_id: p.opportunity_id, p_diligence_case_id: p.diligence_case_id, p_document_context_id: p.document_context_id ?? null } as never);
  if (error) return databaseFailure(error);
  const response = acquisitionDetailV1Schema.safeParse(data);
  if (!response.success || response.data.workspace_id !== p.workspace_id || response.data.opportunity_id !== p.opportunity_id || response.data.diligence_case_id !== p.diligence_case_id) return diligenceFailure('AIRPROP_REQUEST_FAILED', 500);
  return NextResponse.json(response.data, { headers: diligenceHeaders });
}
