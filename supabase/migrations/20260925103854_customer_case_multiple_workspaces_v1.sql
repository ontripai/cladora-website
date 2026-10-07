begin;

-- A case is a customer relationship; several approved workspaces may belong
-- to the same tenant. The original case workspace remains its primary link.
create table platform.customer_case_workspace_links (
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  contract_id uuid references platform.workspace_contracts(id) on delete restrict,
  access_basis_id uuid not null references platform.workspace_access_bases(id) on delete restrict,
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default statement_timestamp(),
  reason text not null check (length(btrim(reason)) between 8 and 500),
  primary key(case_id,customer_workspace_id)
);
create index customer_case_workspace_links_workspace_idx on platform.customer_case_workspace_links(customer_workspace_id);
alter table platform.customer_case_workspace_links enable row level security;
revoke all on platform.customer_case_workspace_links from public,anon,authenticated;

-- Existing approved first links are preserved without changing their scope.
insert into platform.customer_case_workspace_links(case_id,customer_workspace_id,contract_id,access_basis_id,linked_by,linked_at,reason)
select c.id,c.customer_workspace_id,c.contract_id,b.id,
  coalesce((select e.actor_id from audit.events e where e.entity_type='customer_case'
    and e.entity_id=c.id and e.action='CUSTOMER_CASE_LINKED' and e.actor_id is not null
    order by e.occurred_at desc limit 1),b.approved_by),
  coalesce(c.linked_at,b.approved_at),'Approved workspace link migrated from case v1'
from platform.customer_cases c
join lateral (
  select b.* from platform.workspace_access_bases b
  where b.customer_workspace_id=c.customer_workspace_id
    and b.normalized_email=c.customer_email
    and (b.contract_id is not distinct from c.contract_id)
  order by b.approved_at desc limit 1
) b on true
where c.customer_workspace_id is not null;

create or replace function customer_api.link_customer_case_workspace_v1(
  p_case_id uuid,p_workspace_id uuid,p_contract_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases; v_basis platform.workspace_access_bases;
  v_workspace platform.customer_workspaces; v_primary platform.customer_workspaces;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_reason' using errcode='22023';
  end if;
  select * into v_case from platform.customer_cases where id=p_case_id and status='open' for update;
  if not found then raise exception 'case_unavailable' using errcode='22023'; end if;
  if exists(select 1 from platform.customer_case_workspace_links l
    where l.case_id=p_case_id and l.customer_workspace_id=p_workspace_id) then
    raise exception 'workspace_already_linked' using errcode='23505';
  end if;
  -- An existing customer-specific commercial approval is mandatory for EVERY
  -- link; no membership, account, contract or workspace is created here.
  select * into v_basis from platform.workspace_access_bases
  where customer_workspace_id=p_workspace_id and normalized_email=v_case.customer_email
    and status in ('prepared','active') and
    ((mode='PILOT' and p_contract_id is null) or
      (mode='PAID' and contract_id=p_contract_id and p_contract_id is not null))
  order by approved_at desc limit 1;
  if not found then raise exception 'approved_access_basis_required' using errcode='42501'; end if;
  select * into v_workspace from platform.customer_workspaces where id=p_workspace_id;
  if not found or v_workspace.archived_at is not null or v_workspace.lifecycle_status in ('TERMINATED','ARCHIVED') then
    raise exception 'workspace_unavailable' using errcode='22023';
  end if;
  if v_case.customer_workspace_id is not null then
    select * into v_primary from platform.customer_workspaces where id=v_case.customer_workspace_id;
    if v_primary.tenant_id <> v_workspace.tenant_id then
      raise exception 'case_workspace_tenant_mismatch' using errcode='42501';
    end if;
  end if;
  if p_contract_id is not null and not exists (
    select 1 from platform.workspace_contracts c where c.id=p_contract_id
      and c.customer_workspace_id=p_workspace_id and c.status='active'
      and c.signed_at is not null
  ) then raise exception 'active_signed_contract_required' using errcode='42501'; end if;
  insert into platform.customer_case_workspace_links(case_id,customer_workspace_id,contract_id,access_basis_id,linked_by,reason)
  values(p_case_id,p_workspace_id,p_contract_id,v_basis.id,auth.uid(),trim(p_reason));
  if v_case.customer_workspace_id is null then
    update platform.customer_cases set customer_workspace_id=p_workspace_id,
      contract_id=p_contract_id,linked_at=statement_timestamp() where id=v_case.id;
  end if;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_LINKED','customer_case',v_case.id,
    trim(p_reason),jsonb_build_object('workspace_id',p_workspace_id,'contract_id',p_contract_id,'basis_id',v_basis.id));
  return jsonb_build_object('case_id',v_case.id,'workspace_id',p_workspace_id,
    'contract_id',p_contract_id);
end $$;

-- Preserve the original case API fields; append the approved links to staff
-- and customer views. All rows are returned only after case AAL2 authorization.
create or replace function customer_api.get_customer_case_v1(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases; v_staff boolean; v_messages jsonb;
begin
  v_staff := app_private.case_staff_allowed_v1(p_case_id);
  if not v_staff and not app_private.case_customer_allowed_v1(p_case_id) then
    raise exception 'case_access_denied' using errcode='42501';
  end if;
  select * into v_case from platform.customer_cases where id=p_case_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'author_id',m.author_id,
    'visibility',m.visibility,'body',m.body,'created_at',m.created_at)
    order by m.created_at,m.id),'[]'::jsonb) into v_messages
  from platform.customer_case_messages m where m.case_id=p_case_id
    and (v_staff or m.visibility='shared');
  return jsonb_build_object('id',v_case.id,'status',v_case.status,
    'workspace_id',v_case.customer_workspace_id,'contract_id',v_case.contract_id,
    'workspace_links',(select coalesce(jsonb_agg(jsonb_build_object(
      'workspace_id',l.customer_workspace_id,'contract_id',l.contract_id,
      'linked_at',l.linked_at,'primary',l.customer_workspace_id=v_case.customer_workspace_id)
      order by l.linked_at,l.customer_workspace_id),'[]'::jsonb)
      from platform.customer_case_workspace_links l where l.case_id=p_case_id),
    'staff_view',v_staff,'messages',v_messages,
    'staff',(case when app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
      or app_private.has_platform_role('PLATFORM_OPERATIONS') then
      (select coalesce(jsonb_agg(jsonb_build_object('user_id',s.platform_user_id,
        'duty',s.duty,'status',s.status)),'[]'::jsonb)
       from platform.customer_case_staff s where s.case_id=p_case_id)
      else '[]'::jsonb end),
    'unread_count',(select count(*) from platform.customer_case_notifications n
      where n.case_id=p_case_id and n.recipient_id=auth.uid() and n.read_at is null));
end $$;

commit;
