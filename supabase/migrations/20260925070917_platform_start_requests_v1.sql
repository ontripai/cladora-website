begin;

-- Public submissions already land in marketing_leads. Keep this table outside
-- direct authenticated access and assign each new lead transactionally.
alter table public.marketing_leads
  add column assigned_platform_user_id uuid references platform.platform_users(id) on delete set null,
  add column assigned_at timestamptz;
create index marketing_leads_assignee_queue_idx
  on public.marketing_leads(assigned_platform_user_id,status,created_at desc);

create function app_private.assign_start_request_v1() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare v_assignee uuid;
begin
  -- Serializes the choice across concurrent public submissions.
  perform pg_catalog.pg_advisory_xact_lock(807251,1);
  select u.id into v_assignee
  from platform.platform_users u
  join platform.platform_role_assignments a on a.platform_user_id=u.id
  left join public.marketing_leads l on l.assigned_platform_user_id=u.id
    and l.status in ('new','contacted','qualified')
  where u.status='active' and u.deactivated_at is null
    and a.role='PLATFORM_SALES' and a.status='active'
    and a.valid_from<=statement_timestamp()
    and (a.valid_until is null or a.valid_until>statement_timestamp())
  group by u.id
  order by count(l.id), u.created_at, u.id
  limit 1;
  new.assigned_platform_user_id := v_assignee;
  new.assigned_at := case when v_assignee is null then null else statement_timestamp() end;
  return new;
end $$;
revoke all on function app_private.assign_start_request_v1() from public,anon,authenticated,service_role;
create trigger marketing_leads_auto_assign_v1 before insert on public.marketing_leads
for each row execute function app_private.assign_start_request_v1();

create function customer_api.list_start_requests_v1(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_admin boolean; v_self uuid; v_rows jsonb;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  v_admin := app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS');
  v_self := app_private.current_platform_user_id();
  if not v_admin and not app_private.has_platform_role('PLATFORM_SALES') then
    raise exception 'access_denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_rows
  from (
    select l.id,l.reference_id,l.created_at,l.lead_type,l.full_name,l.email,
      l.phone,l.city,l.message,l.status,l.assigned_platform_user_id,
      l.assigned_at,u.display_name as assignee_name
    from public.marketing_leads l
    left join platform.platform_users u on u.id=l.assigned_platform_user_id
    where v_admin or l.assigned_platform_user_id=v_self
    order by l.created_at desc,l.id desc
    limit least(greatest(coalesce(p_limit,50),1),100)
  ) q;
  return v_rows;
end $$;

create function customer_api.assign_start_request_v1(p_lead_id uuid,p_assignee_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_before uuid; v_result public.marketing_leads;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_reason' using errcode='22023';
  end if;
  if p_assignee_id is not null and not exists (
    select 1 from platform.platform_users u join platform.platform_role_assignments a
      on a.platform_user_id=u.id where u.id=p_assignee_id and u.status='active'
      and u.deactivated_at is null and a.role='PLATFORM_SALES' and a.status='active'
      and a.valid_from<=statement_timestamp()
      and (a.valid_until is null or a.valid_until>statement_timestamp())
  ) then raise exception 'active_sales_required' using errcode='22023'; end if;
  select assigned_platform_user_id into v_before from public.marketing_leads
    where id=p_lead_id and status in ('new','contacted','qualified') for update;
  if not found then raise exception 'start_request_not_found' using errcode='P0002'; end if;
  update public.marketing_leads set assigned_platform_user_id=p_assignee_id,
    assigned_at=case when p_assignee_id is null then null else statement_timestamp() end
    where id=p_lead_id returning * into v_result;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','START_REQUEST_ASSIGNED','marketing_lead',p_lead_id,
    jsonb_build_object('assignee_id',v_before),jsonb_build_object('assignee_id',p_assignee_id),trim(p_reason));
  return jsonb_build_object('id',v_result.id,'assignee_id',v_result.assigned_platform_user_id);
end $$;

create function customer_api.update_start_request_v1(p_lead_id uuid,p_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_before text; v_assignee uuid; v_result public.marketing_leads;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if p_status not in ('contacted','qualified','rejected','spam')
    or length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_start_request_update' using errcode='22023';
  end if;
  select status,assigned_platform_user_id into v_before,v_assignee
    from public.marketing_leads where id=p_lead_id for update;
  if not found or v_before not in ('new','contacted','qualified') then
    raise exception 'start_request_not_found' using errcode='P0002';
  end if;
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')
    or (v_assignee=app_private.current_platform_user_id() and app_private.has_platform_role('PLATFORM_SALES'))) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  update public.marketing_leads set status=p_status where id=p_lead_id returning * into v_result;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','START_REQUEST_STATUS_UPDATED','marketing_lead',p_lead_id,
    jsonb_build_object('status',v_before),jsonb_build_object('status',p_status),trim(p_reason));
  return jsonb_build_object('id',v_result.id,'status',v_result.status);
end $$;

revoke all on function customer_api.list_start_requests_v1(integer),
  customer_api.assign_start_request_v1(uuid,uuid,text),
  customer_api.update_start_request_v1(uuid,text,text) from public,anon,service_role;
grant execute on function customer_api.list_start_requests_v1(integer),
  customer_api.assign_start_request_v1(uuid,uuid,text),
  customer_api.update_start_request_v1(uuid,text,text) to authenticated;

commit;
