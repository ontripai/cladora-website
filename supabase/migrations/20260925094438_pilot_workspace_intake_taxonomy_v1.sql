begin;

-- Intake categories describe the customer's requested space, not the existing
-- platform.workspace_type (which describes the operating customer). No
-- workspace or tenant is provisioned by recording this request.
alter table public.marketing_leads
  add column applicant_type text,
  add column requested_workspace_type text,
  add column requested_workspace_subtype text,
  add column requested_workspace_count integer,
  add column requested_workspace_description text,
  add column requested_related_buildings text;

alter table public.marketing_leads
  add constraint marketing_leads_applicant_type_check
    check (applicant_type is null or applicant_type in ('association','management_company','owner','company','other')),
  add constraint marketing_leads_requested_workspace_type_check
    check (requested_workspace_type is null or requested_workspace_type in
      ('residential','commercial','retail','office','industrial','mixed','shared','other')),
  add constraint marketing_leads_requested_workspace_count_check
    check (requested_workspace_count is null or requested_workspace_count between 1 and 1000),
  add constraint marketing_leads_requested_workspace_subtype_check
    check (requested_workspace_subtype is null or length(requested_workspace_subtype) between 1 and 80),
  add constraint marketing_leads_requested_workspace_description_check
    check (requested_workspace_description is null or length(requested_workspace_description) between 1 and 500),
  add constraint marketing_leads_requested_related_buildings_check
    check (requested_related_buildings is null or length(requested_related_buildings) between 1 and 1000);

create or replace function customer_api.list_start_requests_v1(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
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
      l.applicant_type,l.requested_workspace_type,l.requested_workspace_subtype,
      l.requested_workspace_count,l.requested_workspace_description,
      l.requested_related_buildings,l.units_count,l.building_type,
      l.assigned_at,u.display_name as assignee_name,c.id as case_id
    from public.marketing_leads l
    left join platform.platform_users u on u.id=l.assigned_platform_user_id
    left join platform.customer_cases c on c.lead_id=l.id
    where v_admin or l.assigned_platform_user_id=v_self
    order by l.created_at desc,l.id desc
    limit least(greatest(coalesce(p_limit,50),1),100)
  ) q;
  return v_rows;
end $$;

commit;
