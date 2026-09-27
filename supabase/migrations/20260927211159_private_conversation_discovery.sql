begin;

create function communications.can_compose_private(p_context_id uuid, p_unit_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2'
    and communications.context_covers_unit(p_context_id,p_unit_id)
    and exists (select 1 from identity.memberships m
      where m.id=communications.context_membership(p_context_id)
        and communications.member_covers_unit(m.id,m.tenant_id,p_unit_id)
        and exists (select 1 from platform.customer_workspaces w
          join platform.workspace_entitlements e on e.customer_workspace_id=w.id
          where w.tenant_id=m.tenant_id and w.lifecycle_status='ACTIVE'
            and e.entitlement_key='module.communications'
            and e.valid_from<=statement_timestamp()
            and (e.valid_until is null or e.valid_until>statement_timestamp())
            and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
              then e.override_value_json='true'::jsonb else e.boolean_value is true end)))
$$;
revoke all on function communications.can_compose_private(uuid,uuid) from public,anon,authenticated;

create function customer_api.list_private_units_v1(p_context_id uuid,p_query text default null,p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id); v_tenant uuid;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or p_limit not between 1 and 100 or p_offset<0 or length(coalesce(p_query,''))>100 then
    raise exception 'private_unit_discovery_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from identity.memberships where id=v_actor;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.property_name,q.unit_code,q.id)
    from (select u.id,u.code unit_code,pr.name property_name,b.name building_name
      from portfolio.units u join portfolio.buildings b on b.id=u.building_id
      join portfolio.properties pr on pr.id=b.property_id
      where u.tenant_id=v_tenant and u.status='active'
        and communications.can_compose_private(p_context_id,u.id)
        and (p_query is null or u.code ilike '%' || p_query || '%' or pr.name ilike '%' || p_query || '%')
      order by pr.name,u.code,u.id limit p_limit offset p_offset) q),'[]'::jsonb);
end; $$;

create function customer_api.list_private_recipients_v1(p_context_id uuid,p_unit_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id); v_tenant uuid;
begin
  if v_actor is null or not communications.can_compose_private(p_context_id,p_unit_id) then
    raise exception 'private_recipient_discovery_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from identity.memberships where id=v_actor;
  return coalesce((select jsonb_agg(jsonb_build_object('membership_id',m.id,
      'display_name',pr.display_name,'role_code',r.code) order by pr.display_name,m.id)
    from identity.memberships m join identity.profiles pr on pr.user_id=m.user_id
      join identity.roles r on r.id=m.role_id
    where m.tenant_id=v_tenant and m.id<>v_actor
      and communications.member_covers_unit(m.id,v_tenant,p_unit_id)), '[]'::jsonb);
end; $$;

revoke all on function customer_api.list_private_units_v1(uuid,text,integer,integer),
  customer_api.list_private_recipients_v1(uuid,uuid) from public,anon;
grant execute on function customer_api.list_private_units_v1(uuid,text,integer,integer),
  customer_api.list_private_recipients_v1(uuid,uuid) to authenticated;

commit;
