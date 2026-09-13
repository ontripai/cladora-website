begin;

-- CLADORA-P2-SEC-ADVISORY-001
-- Forward-only security advisory closure. No fixture or customer DML.

-- Pin the five trigger/helper function search paths reported by the database linter.
alter function payments.validate_and_mask_iban(text)
  set search_path = pg_catalog, extensions;
alter function public.set_marketing_leads_updated_at()
  set search_path = pg_catalog;
alter function documents.check_retention_policy_overlap()
  set search_path = pg_catalog, documents;
alter function maintenance.enforce_work_order_transition_guards()
  set search_path = pg_catalog, maintenance;
alter function maintenance.protect_sla_policy_immutability()
  set search_path = pg_catalog, maintenance;

-- Trigger functions are not public APIs.
revoke all on function public.set_marketing_leads_updated_at() from public, anon, authenticated;
revoke all on function documents.check_retention_policy_overlap() from public, anon, authenticated;
revoke all on function maintenance.enforce_work_order_transition_guards() from public, anon, authenticated;
revoke all on function maintenance.protect_sla_policy_immutability() from public, anon, authenticated;
revoke all on function payments.validate_and_mask_iban(text) from public, anon;

-- Move privileged implementations out of the exposed customer_api schema.
alter function customer_api.approve_beneficiary_account_v1(uuid,uuid) set schema app_private;
alter function customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text) set schema app_private;
alter function customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text) set schema app_private;
alter function customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text) set schema app_private;
alter function customer_api.list_payment_configuration_v1(uuid,uuid) set schema app_private;
alter function customer_api.reject_beneficiary_account_v1(uuid,uuid,text) set schema app_private;
alter function customer_api.revoke_beneficiary_account_v1(uuid,uuid,text) set schema app_private;
alter function customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid) set schema app_private;

-- The invoker wrappers require EXECUTE on the private implementations.
-- app_private is not exposed through the Data API.
grant usage on schema app_private to authenticated;
revoke all on function app_private.approve_beneficiary_account_v1(uuid,uuid) from public,anon,service_role;
revoke all on function app_private.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text) from public,anon,service_role;
revoke all on function app_private.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text) from public,anon,service_role;
revoke all on function app_private.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text) from public,anon,service_role;
revoke all on function app_private.list_payment_configuration_v1(uuid,uuid) from public,anon,service_role;
revoke all on function app_private.reject_beneficiary_account_v1(uuid,uuid,text) from public,anon,service_role;
revoke all on function app_private.revoke_beneficiary_account_v1(uuid,uuid,text) from public,anon,service_role;
revoke all on function app_private.submit_beneficiary_account_for_approval_v1(uuid,uuid) from public,anon,service_role;
grant execute on function
  app_private.approve_beneficiary_account_v1(uuid,uuid),
  app_private.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text),
  app_private.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text),
  app_private.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text),
  app_private.list_payment_configuration_v1(uuid,uuid),
  app_private.reject_beneficiary_account_v1(uuid,uuid,text),
  app_private.revoke_beneficiary_account_v1(uuid,uuid,text),
  app_private.submit_beneficiary_account_for_approval_v1(uuid,uuid)
to authenticated;

create function customer_api.approve_beneficiary_account_v1(p_context_id uuid,p_beneficiary_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.approve_beneficiary_account_v1(p_context_id,p_beneficiary_id)$$;

create function customer_api.configure_payment_allocation_policy_v1(
  p_context_id uuid,
  p_strategy payments.payment_allocation_strategy default 'oldest_due_first',
  p_penalties_priority payments.penalties_priority default 'principal_first',
  p_min_partial_amount numeric default 1.00,
  p_overpayment_handling text default 'credit_balance',
  p_credit_balance_handling text default 'apply_to_next',
  p_approval_reference text default null)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.configure_payment_allocation_policy_v1(
  p_context_id,p_strategy,p_penalties_priority,p_min_partial_amount,
  p_overpayment_handling,p_credit_balance_handling,p_approval_reference)$$;

create function customer_api.create_beneficiary_account_draft_v1(
  p_context_id uuid,p_property_id uuid,p_bank_account_id uuid,
  p_association_legal_name text,p_bank_name text,p_currency text,p_iban text)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.create_beneficiary_account_draft_v1(
  p_context_id,p_property_id,p_bank_account_id,p_association_legal_name,p_bank_name,p_currency,p_iban)$$;

create function customer_api.create_sla_policy_v1(
  p_context_id uuid,p_name text,p_priority text,p_response_hours numeric,
  p_attendance_hours numeric,p_resolution_hours numeric,p_effective_from date,
  p_effective_to date default null,p_property_id uuid default null,
  p_category text default null,p_timezone text default 'Europe/Bucharest')
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.create_sla_policy_v1(
  p_context_id,p_name,p_priority,p_response_hours,p_attendance_hours,
  p_resolution_hours,p_effective_from,p_effective_to,p_property_id,p_category,p_timezone)$$;

create function customer_api.list_payment_configuration_v1(
  p_context_id uuid,p_property_id uuid default null)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.list_payment_configuration_v1(p_context_id,p_property_id)$$;

create function customer_api.reject_beneficiary_account_v1(
  p_context_id uuid,p_beneficiary_id uuid,p_rejection_reason text default null)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.reject_beneficiary_account_v1(p_context_id,p_beneficiary_id,p_rejection_reason)$$;

create function customer_api.revoke_beneficiary_account_v1(
  p_context_id uuid,p_beneficiary_id uuid,p_revocation_reason text default null)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.revoke_beneficiary_account_v1(p_context_id,p_beneficiary_id,p_revocation_reason)$$;

create function customer_api.submit_beneficiary_account_for_approval_v1(
  p_context_id uuid,p_beneficiary_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.submit_beneficiary_account_for_approval_v1(p_context_id,p_beneficiary_id)$$;

revoke all on function
  customer_api.approve_beneficiary_account_v1(uuid,uuid),
  customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text),
  customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text),
  customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text),
  customer_api.list_payment_configuration_v1(uuid,uuid),
  customer_api.reject_beneficiary_account_v1(uuid,uuid,text),
  customer_api.revoke_beneficiary_account_v1(uuid,uuid,text),
  customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid)
from public,anon;
grant execute on function
  customer_api.approve_beneficiary_account_v1(uuid,uuid),
  customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text),
  customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text),
  customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text),
  customer_api.list_payment_configuration_v1(uuid,uuid),
  customer_api.reject_beneficiary_account_v1(uuid,uuid,text),
  customer_api.revoke_beneficiary_account_v1(uuid,uuid,text),
  customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid)
to authenticated;

-- Explicit fail-closed policies document intentional private-table boundaries.
create policy disposition_requests_direct_deny on documents.disposition_requests for all to anon,authenticated using(false) with check(false);
create policy document_audit_links_direct_deny on documents.document_audit_links for all to anon,authenticated using(false) with check(false);
create policy document_permissions_direct_deny on documents.document_permissions for all to anon,authenticated using(false) with check(false);
create policy document_retention_assignments_direct_deny on documents.document_retention_assignments for all to anon,authenticated using(false) with check(false);
create policy legal_holds_direct_deny on documents.legal_holds for all to anon,authenticated using(false) with check(false);
create policy document_lifecycle_events_direct_deny on documents.lifecycle_events for all to anon,authenticated using(false) with check(false);
create policy retention_records_direct_deny on documents.retention_records for all to anon,authenticated using(false) with check(false);
create policy upload_intents_direct_deny on documents.upload_intents for all to anon,authenticated using(false) with check(false);
create policy export_scan_attestations_direct_deny on finance.export_artifact_scan_attestations for all to anon,authenticated using(false) with check(false);
create policy export_artifacts_direct_deny on finance.export_artifacts for all to anon,authenticated using(false) with check(false);
create policy export_packs_direct_deny on finance.export_packs for all to anon,authenticated using(false) with check(false);
create policy minutes_signatures_direct_deny on governance.minutes_attendee_signatures for all to anon,authenticated using(false) with check(false);
create policy motion_snapshots_direct_deny on governance.motion_electorate_snapshots for all to anon,authenticated using(false) with check(false);
create policy statutory_relationships_direct_deny on governance.statutory_officer_relationships for all to anon,authenticated using(false) with check(false);
create policy statutory_officers_direct_deny on governance.statutory_officers for all to anon,authenticated using(false) with check(false);
create policy occupancy_lifecycle_events_direct_deny on occupancy.lifecycle_events for all to anon,authenticated using(false) with check(false);
create policy marketing_leads_direct_deny on public.marketing_leads for all to anon,authenticated using(false) with check(false);
create policy marketing_rate_limits_direct_deny on public.marketing_rate_limits for all to anon,authenticated using(false) with check(false);
create policy access_events_direct_deny on security_access.access_events for all to anon,authenticated using(false) with check(false);
create policy access_points_direct_deny on security_access.access_points for all to anon,authenticated using(false) with check(false);
create policy credential_assignments_direct_deny on security_access.credential_assignments for all to anon,authenticated using(false) with check(false);
create policy credential_lifecycle_direct_deny on security_access.credential_lifecycle for all to anon,authenticated using(false) with check(false);
create policy credentials_direct_deny on security_access.credentials for all to anon,authenticated using(false) with check(false);
create policy visitor_access_history_direct_deny on security_access.visitor_access_history for all to anon,authenticated using(false) with check(false);
create policy visitor_passes_direct_deny on security_access.visitor_passes for all to anon,authenticated using(false) with check(false);

commit;
