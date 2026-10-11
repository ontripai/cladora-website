begin;

-- LC-C01 internal relationship lookup. Domain commands still need their
-- own permission, entitlement, evidence and record visibility checks.
create function app_private.current_workspace_property_mandate_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_property_id uuid,
  p_purpose text
) returns uuid language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_context record;
  v_mandate_id uuid;
begin
  if p_context_id is null or p_workspace_id is null or p_property_id is null
     or p_purpose not in ('property_operations', 'investment', 'service_delivery')
     or auth.uid() is null then
    return null;
  end if;

  begin
    select * into v_context
    from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
  exception when sqlstate '42501' then
    return null;
  end;
  if v_context.workspace_id is distinct from p_workspace_id then
    return null;
  end if;

  select a.id into v_mandate_id
  from platform.workspace_property_authorities a
  join portfolio.properties p on p.id=a.property_id and p.tenant_id=a.tenant_id
  where a.property_id=p_property_id and a.customer_workspace_id=p_workspace_id
    and a.tenant_id=v_context.tenant_id and a.purpose=p_purpose
    and a.status='active' and a.valid_from<=statement_timestamp()
    and (a.valid_to is null or a.valid_to>statement_timestamp());
  return v_mandate_id;
end;
$$;

revoke all on function app_private.current_workspace_property_mandate_v1(uuid,uuid,uuid,text)
  from public,anon,authenticated,service_role;
comment on function app_private.current_workspace_property_mandate_v1(uuid,uuid,uuid,text)
  is 'Private explicit workspace/subject/purpose relationship lookup, requiring the caller native workspace context. The returned ID is not a permission or cross-workspace data grant; domain commands must also check module and record permissions.';

commit;
