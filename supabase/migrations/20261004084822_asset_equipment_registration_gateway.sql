begin;
create function assets.registration_context_v1(p_context_id uuid) returns record
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
 v:=assets.check_asset_caller_v1(p_context_id,'assets.manage',false);
 if v.scope_type not in ('tenant','property','building') or not exists(
  select 1 from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
 ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;
 return v;
end $$;
revoke all on function assets.registration_context_v1(uuid) from public,anon,authenticated;

create function assets.registration_choices_v1(p_context_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; properties jsonb; buildings jsonb;
begin
 v:=assets.registration_context_v1(p_context_id);
 select coalesce(jsonb_agg(q),'[]'::jsonb) into properties from (
  select p.id,p.name from portfolio.properties p where p.tenant_id=v.tenant_id and p.status='active'
   and (v.scope_type='tenant' or (v.scope_type='property' and p.id=v.property_id)
    or (v.scope_type='building' and exists(select 1 from portfolio.buildings b where b.id=v.building_id and b.tenant_id=v.tenant_id and b.property_id=p.id)))
  order by p.name,p.id limit 200
 ) q;
 select coalesce(jsonb_agg(q),'[]'::jsonb) into buildings from (
  select b.id,b.name,b.property_id from portfolio.buildings b where b.tenant_id=v.tenant_id and b.status='active'
   and exists(select 1 from jsonb_array_elements(properties) p where p->>'id'=b.property_id::text)
   and (v.scope_type<>'building' or b.id=v.building_id)
  order by b.name,b.id limit 500
 ) q;
 return jsonb_build_object('properties',properties,'buildings',buildings,'building_required',v.scope_type='building');
end $$;
revoke all on function assets.registration_choices_v1(uuid) from public,anon;
grant execute on function assets.registration_choices_v1(uuid) to authenticated;
create function customer_api.get_asset_registration_choices_v1(p_context_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$ select assets.registration_choices_v1(p_context_id) $$;
revoke all on function customer_api.get_asset_registration_choices_v1(uuid) from public,anon;
grant execute on function customer_api.get_asset_registration_choices_v1(uuid) to authenticated;

create function assets.register_equipment_v1(p_context_id uuid,p_property_id uuid,p_building_id uuid,p_category_code text,p_asset_code text,p_name text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v record; category_id uuid; category_name text; result jsonb;
begin
 v:=assets.registration_context_v1(p_context_id);
 if p_category_code not in ('ventilation','pump','elevator','fire_safety','other') or p_category_code is null
  or p_asset_code is null or length(trim(p_asset_code)) not between 1 and 64
  or p_name is null or length(trim(p_name)) not between 1 and 255
 then raise exception 'asset_registration_invalid' using errcode='22023'; end if;
 category_name:=case p_category_code when 'ventilation' then 'Ventilation' when 'pump' then 'Pump' when 'elevator' then 'Elevator' when 'fire_safety' then 'Fire safety' else 'Other equipment' end;
 -- The transaction rolls category creation back if guarded registration fails.
 insert into assets.asset_categories(tenant_id,code,name,status) values(v.tenant_id,p_category_code,category_name,'active')
 on conflict(tenant_id,code) do nothing returning id into category_id;
 if category_id is not null then
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(v.tenant_id,auth.uid(),v.role_code,'ASSET_CATEGORY_CREATED','assets.category',category_id,'Equipment registration category',jsonb_build_object('code',p_category_code,'name',category_name));
 end if;
 select c.id into category_id from assets.asset_categories c where c.tenant_id=v.tenant_id and c.code=p_category_code and c.status='active';
 if category_id is null then raise exception 'asset_category_inactive' using errcode='22023'; end if;
 result:=assets.create_asset_internal_v1(p_context_id=>p_context_id,p_property_id=>p_property_id,p_category_id=>category_id,
  p_asset_code=>p_asset_code,p_name=>p_name,p_scope=>case when p_building_id is null then 'property' else 'building' end,
  p_building_id=>p_building_id,p_is_safety_critical=>p_category_code in ('elevator','fire_safety'),
  p_criticality_level=>case when p_category_code in ('elevator','fire_safety') then 'critical' else 'medium' end);
 return result;
end $$;
revoke all on function assets.register_equipment_v1(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function assets.register_equipment_v1(uuid,uuid,uuid,text,text,text) to authenticated;
create function customer_api.register_equipment_v1(p_context_id uuid,p_property_id uuid,p_building_id uuid,p_category_code text,p_asset_code text,p_name text) returns jsonb
language sql security invoker set search_path=pg_catalog as $$ select assets.register_equipment_v1(p_context_id,p_property_id,p_building_id,p_category_code,p_asset_code,p_name) $$;
revoke all on function customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text) to authenticated;
commit;
