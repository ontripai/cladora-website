import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ownershipTransferCommandV1Schema, ownershipTransferResponseV1Schema } from '@/lib/core/ownership-transfer-v1';
import { diligenceFailure, diligenceHeaders } from '@/lib/airprop/diligence-route-response';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

function databaseFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    return diligenceFailure(['mfa_required', 'mfa_aal2_required'].includes(error.message ?? '')
      ? 'MFA_REQUIRED' : 'OWNERSHIP_TRANSFER_ACCESS_DENIED', 403);
  }
  const conflicts: Record<string, string> = {
    core_ownership_transfer_not_verified: 'RELATIONSHIP_NOT_VERIFIED',
    core_ownership_transfer_subject_mismatch: 'SUBJECT_MISMATCH',
    core_ownership_transfer_stale_baseline: 'BASELINE_CONFLICT',
    core_ownership_transfer_evidence_mismatch: 'EVIDENCE_MISMATCH',
    core_ownership_transfer_idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
    core_ownership_transfer_already_executed: 'ALREADY_EXECUTED',
  };
  if (conflicts[error.message ?? '']) return diligenceFailure(conflicts[error.message ?? ''], 409);
  const invalid = ['22023', '22P02', '22003'].includes(error.code ?? '');
  return diligenceFailure(invalid ? 'INVALID_REQUEST' : 'OWNERSHIP_TRANSFER_FAILED', invalid ? 400 : 500);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return diligenceFailure('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return diligenceFailure('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 12 * 1024);
  if (errorResponse) {
    for (const [key, value] of Object.entries(diligenceHeaders)) errorResponse.headers.set(key, value);
    return errorResponse;
  }
  const parsed = ownershipTransferCommandV1Schema.safeParse(body);
  if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return diligenceFailure('UNAUTHORIZED', 401);
  const p = parsed.data;
  const { data, error } = await db.schema('customer_api').rpc('execute_verified_ownership_transfer_v1' as never, {
    p_context_id: p.context_id,
    p_workspace_id: p.workspace_id,
    p_property_id: p.property_id,
    p_proposal_id: p.proposal_id,
    p_document_context_id: p.document_context_id,
    p_evidence_version_id: p.evidence_version_id,
    p_expected_outgoing_ownership_id: p.expected_outgoing_ownership_id,
    p_expected_outgoing_valid_from: p.expected_outgoing_valid_from,
    p_expected_share: p.expected_share,
    p_idempotency_key: p.idempotency_key,
  } as never);
  if (error) return databaseFailure(error);
  const response = ownershipTransferResponseV1Schema.safeParse(data);
  if (!response.success) return diligenceFailure('OWNERSHIP_TRANSFER_FAILED', 500);
  return NextResponse.json(response.data, {
    status: response.data.idempotent ? 200 : 201,
    headers: diligenceHeaders,
  });
}
