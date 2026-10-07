import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  leaseHandoverResponseV1Schema, leaseTerminationResponseV1Schema,
  leaseTransitionCommandV1Schema,
} from '@/lib/core/lease-handover-v1';
import { diligenceFailure, diligenceHeaders } from '@/lib/airprop/diligence-route-response';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

function databaseFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') return diligenceFailure(
    ['mfa_required', 'mfa_aal2_required'].includes(error.message ?? '') ? 'MFA_REQUIRED' : 'LEASE_TRANSITION_ACCESS_DENIED', 403,
  );
  const conflicts: Record<string, string> = {
    core_lease_handover_not_verified: 'RELATIONSHIP_NOT_VERIFIED',
    core_lease_handover_subject_mismatch: 'SUBJECT_MISMATCH',
    core_lease_handover_evidence_mismatch: 'EVIDENCE_MISMATCH',
    core_lease_handover_idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
    core_lease_handover_conflict: 'LEASE_CONFLICT',
    core_lease_termination_stale_baseline: 'BASELINE_CONFLICT',
    core_lease_termination_access_mismatch: 'ACCESS_BASELINE_CONFLICT',
    core_lease_termination_idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  };
  if (conflicts[error.message ?? '']) return diligenceFailure(conflicts[error.message ?? ''], 409);
  const invalid = ['22023', '22P02', '22003'].includes(error.code ?? '');
  return diligenceFailure(invalid ? 'INVALID_REQUEST' : 'LEASE_TRANSITION_FAILED', invalid ? 400 : 500);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return diligenceFailure('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return diligenceFailure('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 20 * 1024);
  if (errorResponse) {
    for (const [key, value] of Object.entries(diligenceHeaders)) errorResponse.headers.set(key, value);
    return errorResponse;
  }
  const parsed = leaseTransitionCommandV1Schema.safeParse(body);
  if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return diligenceFailure('UNAUTHORIZED', 401);
  const p = parsed.data;
  const call = p.action === 'activate'
    ? db.schema('customer_api').rpc('execute_verified_lease_handover_v1' as never, {
      p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_property_id: p.property_id,
      p_proposal_id: p.proposal_id, p_document_context_id: p.document_context_id,
      p_evidence_version_id: p.evidence_version_id, p_handover_status: p.handover_status,
      p_schedule_snapshot: p.schedule_snapshot, p_transferable_facts: p.transferable_facts,
      p_idempotency_key: p.idempotency_key,
    } as never)
    : db.schema('customer_api').rpc('terminate_verified_lease_v1' as never, {
      p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_property_id: p.property_id,
      p_lease_id: p.lease_id, p_expected_starts_on: p.expected_starts_on,
      p_effective_on: p.effective_on, p_access_assignment_ids: p.access_assignment_ids,
      p_reason: p.reason, p_idempotency_key: p.idempotency_key,
    } as never);
  const { data, error } = await call;
  if (error) return databaseFailure(error);
  const response = p.action === 'activate'
    ? leaseHandoverResponseV1Schema.safeParse(data) : leaseTerminationResponseV1Schema.safeParse(data);
  if (!response.success) return diligenceFailure('LEASE_TRANSITION_FAILED', 500);
  return NextResponse.json(response.data, { status: response.data.idempotent ? 200 : 201, headers: diligenceHeaders });
}
