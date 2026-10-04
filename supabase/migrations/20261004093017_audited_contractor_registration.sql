begin;

-- Vendor records belong to the association, not to an individual building.
-- No portal membership, user, contract or payment authority is created here.
create function maintenance.contractor_actor_v1(p_context_id uuid,p_permission text)
returns table(tenant_id uuid,user_id uuid,role_code text,workspace_id uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; resolved record;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,p_permission,false);
 select * into resolved from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
 if v.scope_type<>'tenant' or not app_private.check_effective_permission_v1(p_context_id,p_permission,'maintenance','workspace',resolved.workspace_id) then
  raise exception 'contractor_tenant_authority_required' using errcode='42501';
 end if;
 return query select v.tenant_id,v.user_id,v.role_code,resolved.workspace_id;
end $$;
revoke all on function maintenance.contractor_actor_v1(uuid,text) from public,anon,authenticated;

create function maintenance.list_contractors_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; rows jsonb;
begin
 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.manage');
 select coalesce(jsonb_agg(q),'[]'::jsonb) into rows from (
  select vd.id,pt.legal_name name,vd.status,vd.service_categories
  from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id and pt.tenant_id=vd.tenant_id
  where vd.tenant_id=v.tenant_id and pt.archived_at is null order by pt.legal_name,vd.id limit 200
 ) q;
 return jsonb_build_object('vendors',rows,'can_approve',app_private.check_effective_permission_v1(p_context_id,'maintenance.procurement.approve','maintenance','workspace',v.workspace_id));
end $$;

create function maintenance.register_contractor_v1(p_context_id uuid,p_id uuid,p_name text,p_category text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; existing record; party_id uuid;
begin
 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.manage');
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 200 or p_category is null or p_category not in ('ventilation','pump','elevator','fire_safety','other') then
  raise exception 'invalid_contractor' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,144));
 select vd.*,pt.legal_name into existing from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id where vd.id=p_id;
 if found then
  if existing.tenant_id<>v.tenant_id then raise exception 'contractor_not_found' using errcode='P0002'; end if;
  if existing.legal_name<>trim(p_name) or existing.service_categories<>array[p_category] then raise exception 'contractor_replay_conflict' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id,'status',existing.status);
 end if;
 insert into portfolio.parties(tenant_id,type,legal_name) values(v.tenant_id,'company',trim(p_name)) returning id into party_id;
 insert into maintenance.vendors(id,tenant_id,party_id,status,service_categories) values(p_id,v.tenant_id,party_id,'candidate',array[p_category]);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'CONTRACTOR_REGISTERED','maintenance.vendor',p_id,'Candidate contractor registered',jsonb_build_object('name',trim(p_name),'status','candidate','service_categories',array[p_category]));
 return jsonb_build_object('id',p_id,'status','candidate');
end $$;

create function maintenance.approve_contractor_v1(p_context_id uuid,p_vendor_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; vendor maintenance.vendors%rowtype;
begin
 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.approve');
 if p_vendor_id is null or p_reason is null or length(trim(p_reason)) not between 10 and 500 then raise exception 'approval_reason_required' using errcode='22023'; end if;
 select * into vendor from maintenance.vendors where id=p_vendor_id and tenant_id=v.tenant_id for update;
 if not found then raise exception 'contractor_not_found' using errcode='P0002'; end if;
 if vendor.status='approved' then return jsonb_build_object('id',vendor.id,'status','approved'); end if;
 if vendor.status<>'candidate' then raise exception 'contractor_not_candidate' using errcode='40001'; end if;
 if not exists(select 1 from portfolio.parties where id=vendor.party_id and tenant_id=v.tenant_id and archived_at is null) then raise exception 'contractor_party_unavailable' using errcode='22023'; end if;
 update maintenance.vendors set status='approved' where id=vendor.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,before_snapshot,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'CONTRACTOR_APPROVED','maintenance.vendor',vendor.id,trim(p_reason),jsonb_build_object('status','candidate'),jsonb_build_object('status','approved'));
 return jsonb_build_object('id',vendor.id,'status','approved');
end $$;

revoke all on function maintenance.list_contractors_v1(uuid),maintenance.register_contractor_v1(uuid,uuid,text,text),maintenance.approve_contractor_v1(uuid,uuid,text) from public,anon;
grant execute on function maintenance.list_contractors_v1(uuid),maintenance.register_contractor_v1(uuid,uuid,text,text),maintenance.approve_contractor_v1(uuid,uuid,text) to authenticated;

create function customer_api.list_contractors_v1(p_context_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select maintenance.list_contractors_v1(p_context_id)$$;
create function customer_api.register_contractor_v1(p_context_id uuid,p_id uuid,p_name text,p_category text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select maintenance.register_contractor_v1(p_context_id,p_id,p_name,p_category)$$;
create function customer_api.approve_contractor_v1(p_context_id uuid,p_vendor_id uuid,p_reason text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select maintenance.approve_contractor_v1(p_context_id,p_vendor_id,p_reason)$$;
revoke all on function customer_api.list_contractors_v1(uuid),customer_api.register_contractor_v1(uuid,uuid,text,text),customer_api.approve_contractor_v1(uuid,uuid,text) from public,anon;
grant execute on function customer_api.list_contractors_v1(uuid),customer_api.register_contractor_v1(uuid,uuid,text,text),customer_api.approve_contractor_v1(uuid,uuid,text) to authenticated;

commit;
