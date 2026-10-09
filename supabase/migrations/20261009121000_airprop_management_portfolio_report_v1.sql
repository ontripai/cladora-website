begin;

-- AP08-RPT-01 is a current-authority AIRPROP read model. It reports only
-- AIRPROP-owned mandate/action receipts and canonical labels. Operations and
-- Finance remain authoritative for their live detail and monetary records.
create function customer_api.read_airprop_management_portfolio_v1(
 p_context_id uuid,p_workspace_id uuid
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor record;v_properties jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 select * into v_actor from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 if not app_private.check_workspace_native_permission_v2(
  p_context_id,p_workspace_id,'airprop.asset.read','airprop_commercial') then
  raise exception 'airprop_management_report_access_denied' using errcode='42501';end if;

 select coalesce(jsonb_agg(jsonb_build_object(
  'mandate_request_id',m.id,
  'property',jsonb_build_object('id',p.id,'label',p.name),
  'owner',jsonb_build_object('party_id',o.id,'label',o.legal_name),
  'scope',m.scope,
  'valid_from',m.valid_from,
  'valid_to',m.valid_to,
  'status',m.status,
  'action_links',coalesce((select jsonb_agg(jsonb_build_object(
    'action_link_id',a.id,
    'core_record_type',a.core_record_type,
    'core_record_id',a.core_record_id,
    'unit_id',a.unit_id,
    'source_status_snapshot',a.source_status_snapshot,
    'linked_at',a.linked_at
   ) order by a.linked_at desc,a.id)
   from airprop.management_action_links a
   where a.tenant_id=m.tenant_id and a.workspace_id=m.workspace_id
    and a.mandate_request_id=m.id),'[]'::jsonb)
 ) order by p.name,m.id),'[]'::jsonb) into v_properties
 from airprop.management_mandate_requests m
 join portfolio.properties p on p.id=m.property_id and p.tenant_id=m.tenant_id
 join portfolio.parties o on o.id=m.owner_party_id and o.tenant_id=m.tenant_id
 where m.tenant_id=v_actor.tenant_id and m.workspace_id=p_workspace_id
  and m.status='accepted' and current_date>=m.valid_from and current_date<m.valid_to
  and app_private.current_workspace_property_mandate_v1(
   p_context_id,p_workspace_id,m.property_id,'property_operations') is not null;

 return jsonb_build_object(
  'version',1,
  'idempotent',true,
  'as_of',statement_timestamp(),
  'properties',v_properties,
  'operations',jsonb_build_object(
   'detail_owner','Operations',
   'mode','canonical_references_only'),
  'finance',jsonb_build_object(
   'detail_owner','Finance',
   'mode','not_connected',
   'reason','canonical_receipt_contract_unavailable'));
end;$$;

revoke all on function customer_api.read_airprop_management_portfolio_v1(uuid,uuid)
 from public,anon,service_role;
grant execute on function customer_api.read_airprop_management_portfolio_v1(uuid,uuid)
 to authenticated;

commit;
