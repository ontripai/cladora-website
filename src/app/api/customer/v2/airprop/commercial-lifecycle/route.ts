import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { commercialLifecycleCommandV1Schema, commercialLifecycleResponseV1Schema } from '@/lib/airprop/commercial-lifecycle-v1';
import { diligenceFailure, diligenceHeaders } from '@/lib/airprop/diligence-route-response';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

function databaseFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    return diligenceFailure(error.message === 'mfa_required' ? 'MFA_REQUIRED' : 'AIRPROP_COMMERCIAL_ACCESS_DENIED', 403);
  }
  const conflict = error.code === '23P01' || error.code === '23505';
  const invalid = ['22023', '22P02', '22003'].includes(error.code ?? '');
  return diligenceFailure(conflict ? 'COMMERCIAL_CONFLICT' : invalid ? 'INVALID_REQUEST' : 'AIRPROP_COMMERCIAL_FAILED', conflict ? 409 : invalid ? 400 : 500);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return diligenceFailure('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return diligenceFailure('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 64 * 1024);
  if (errorResponse) {
    for (const [key, value] of Object.entries(diligenceHeaders)) errorResponse.headers.set(key, value);
    return errorResponse;
  }
  const parsed = commercialLifecycleCommandV1Schema.safeParse(body);
  if (!parsed.success) return diligenceFailure('INVALID_REQUEST', 400);
  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return diligenceFailure('UNAUTHORIZED', 401);
  const command = parsed.data;
  let rpc: string;
  let args: Record<string, unknown>;
  switch (command.action) {
    case 'publish_listing':
      rpc = 'publish_airprop_listing_v1';
      args = { p_context_id: command.context_id, p_workspace_id: command.workspace_id, p_opportunity_id: command.opportunity_id, p_property_id: command.property_id, p_unit_id: command.unit_id, p_kind: command.kind, p_available_from: command.available_from, p_available_until: command.available_until, p_idempotency_key: command.idempotency_key };
      break;
    case 'submit_applicant':
      rpc = 'submit_airprop_applicant_v1';
      args = { p_context_id: command.context_id, p_workspace_id: command.workspace_id, p_listing_id: command.listing_id, p_party_id: command.party_id, p_idempotency_key: command.idempotency_key };
      break;
    case 'reserve_listing':
      rpc = 'reserve_airprop_listing_v1';
      args = { p_context_id: command.context_id, p_workspace_id: command.workspace_id, p_listing_id: command.listing_id, p_applicant_id: command.applicant_id, p_reserved_until: command.reserved_until, p_idempotency_key: command.idempotency_key };
      break;
    case 'cancel_reservation':
    case 'expire_reservation':
    case 'extend_reservation':
    case 'convert_reservation':
      rpc = 'control_airprop_reservation_v1';
      args = {
        p_context_id: command.context_id,
        p_workspace_id: command.workspace_id,
        p_reservation_id: command.reservation_id,
        p_action: command.action === 'cancel_reservation' ? 'cancel' : command.action === 'expire_reservation' ? 'expire' : command.action === 'extend_reservation' ? 'extend' : 'convert',
        p_expected_version: command.expected_version,
        p_reserved_until: command.action === 'extend_reservation' ? command.reserved_until : null,
        p_conversion_reference: command.action === 'convert_reservation' ? command.conversion_reference : null,
        p_reason: command.reason,
        p_idempotency_key: command.idempotency_key,
      };
      break;
    case 'edit_listing':
    case 'withdraw_listing':
    case 'republish_listing':
      rpc = 'control_airprop_listing_v1';
      args = {
        p_context_id: command.context_id,
        p_workspace_id: command.workspace_id,
        p_listing_id: command.listing_id,
        p_action: command.action === 'edit_listing' ? 'edit' : command.action === 'withdraw_listing' ? 'withdraw' : 'republish',
        p_expected_version: command.expected_version,
        p_available_from: command.action === 'withdraw_listing' ? null : command.available_from,
        p_available_until: command.action === 'withdraw_listing' ? null : command.available_until,
        p_reason: command.reason,
        p_idempotency_key: command.idempotency_key,
      };
      break;
    case 'record_obligation_schedule':
      rpc = 'record_airprop_obligation_schedule_v1';
      args = { p_context_id: command.context_id, p_workspace_id: command.workspace_id, p_presale_contract_id: command.presale_contract_id, p_currency: command.currency, p_total_amount: command.total_amount, p_terms: command.terms, p_financial_source_reference: command.financial_source_reference, p_idempotency_key: command.idempotency_key };
      break;
    case 'link_execution':
      rpc = 'link_airprop_commercial_execution_v1';
      args = { p_context_id: command.context_id, p_workspace_id: command.workspace_id, p_property_id: command.property_id, p_unit_id: command.unit_id, p_kind: command.kind, p_core_record_id: command.core_record_id, p_commercial_terms: command.commercial_terms, p_effective_from: command.effective_from, p_effective_to: command.effective_to, p_idempotency_key: command.idempotency_key };
      break;
  }
  const { data, error } = await db.schema('customer_api').rpc(rpc as never, args as never);
  if (error) return databaseFailure(error);
  const response = commercialLifecycleResponseV1Schema.safeParse(data);
  if (!response.success) return diligenceFailure('AIRPROP_COMMERCIAL_FAILED', 500);
  return NextResponse.json(response.data, { status: response.data.idempotent ? 200 : 201, headers: diligenceHeaders });
}
