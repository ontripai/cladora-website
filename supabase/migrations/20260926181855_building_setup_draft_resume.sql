-- Read a saved setup from the same authenticated operator context.
create function app_private.get_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,platform as $$
declare c record; r platform.building_setup_runs%rowtype;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.manage');
 select * into r from platform.building_setup_runs
 where id=p_run_id and tenant_id=c.tenant_id and customer_workspace_id=c.workspace_id and created_by=auth.uid();
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 return jsonb_build_object('run_id',r.id,'status',r.status,'payload',r.setup_payload,'property_id',r.property_id,
   'effective_units',case when r.property_id is not null then
      (select coalesce(jsonb_agg(jsonb_build_object('code',u.code,'floor',u.floor,'area_m2',u.area_m2) order by u.code),'[]'::jsonb)
       from portfolio.units u join portfolio.buildings b on b.id=u.building_id
       where b.property_id=r.property_id and u.tenant_id=c.tenant_id)
    else null end);
end $$;

-- Edits are only possible before rehearsal; the submitted evidence remains immutable.
create function app_private.update_building_setup_units_v1(p_context_id uuid,p_run_id uuid,p_units jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform as $$
declare c record; r platform.building_setup_runs%rowtype; x jsonb;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.manage');
 select * into r from platform.building_setup_runs
 where id=p_run_id and tenant_id=c.tenant_id and customer_workspace_id=c.workspace_id and created_by=auth.uid() for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if r.status<>'draft' then raise exception 'setup_draft_edit_closed' using errcode='22023'; end if;
 if jsonb_typeof(p_units)<>'array' or jsonb_array_length(p_units) not between 1 and 500 then
   raise exception 'setup_invalid_units' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_units) e where jsonb_typeof(e)<>'object'
   or jsonb_typeof(e->'code')<>'string' or length(btrim(e->>'code')) not between 1 and 40
   or (e->'floor' is not null and jsonb_typeof(e->'floor')<>'null' and
      (jsonb_typeof(e->'floor')<>'number' or (e->>'floor') !~ '^-?[0-9]+$' or (e->>'floor')::numeric not between -5 and 200))
   or (e->'area_m2' is not null and jsonb_typeof(e->'area_m2')<>'null' and
      (jsonb_typeof(e->'area_m2')<>'number' or (e->>'area_m2')::numeric<=0 or (e->>'area_m2')::numeric>100000))) then
   raise exception 'setup_invalid_units' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_units) e group by lower(btrim(e->>'code')) having count(*)>1) then
   raise exception 'setup_duplicate_unit_code' using errcode='22023'; end if;
 update platform.building_setup_runs set setup_payload=jsonb_set(setup_payload,'{units}',p_units),
   payload_hash=encode(extensions.digest(convert_to(jsonb_set(setup_payload,'{units}',p_units)::text,'UTF8'),'sha256'),'hex'),
   updated_at=statement_timestamp()
 where id=r.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
 values(c.tenant_id,auth.uid(),'association_admin','BUILDING_SETUP_DRAFT_UNITS_UPDATED','building_setup_run',r.id,
   jsonb_build_object('units',r.setup_payload->'units'),jsonb_build_object('units',p_units),'Operator saved draft units before rehearsal');
 return jsonb_build_object('run_id',r.id,'status','draft','payload',jsonb_set(r.setup_payload,'{units}',p_units));
end $$;

revoke all on function app_private.get_building_setup_v1(uuid,uuid),
 app_private.update_building_setup_units_v1(uuid,uuid,jsonb) from public,anon;
grant execute on function app_private.get_building_setup_v1(uuid,uuid),
 app_private.update_building_setup_units_v1(uuid,uuid,jsonb) to authenticated,service_role;

create function customer_api.get_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$select app_private.get_building_setup_v1(p_context_id,p_run_id)$$;
create function customer_api.update_building_setup_units_v1(p_context_id uuid,p_run_id uuid,p_units jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.update_building_setup_units_v1(p_context_id,p_run_id,p_units)$$;
revoke all on function customer_api.get_building_setup_v1(uuid,uuid),
 customer_api.update_building_setup_units_v1(uuid,uuid,jsonb) from public,anon;
grant execute on function customer_api.get_building_setup_v1(uuid,uuid),
 customer_api.update_building_setup_units_v1(uuid,uuid,jsonb) to authenticated,service_role;
