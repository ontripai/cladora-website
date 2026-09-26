begin;

create table platform.customer_cases (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.marketing_leads(id) on delete restrict,
  customer_email text not null,
  status text not null default 'open' check(status in ('open','archived')),
  customer_workspace_id uuid references platform.customer_workspaces(id) on delete restrict,
  contract_id uuid references platform.workspace_contracts(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  linked_at timestamptz,
  check(customer_email=lower(trim(customer_email))),
  check(contract_id is null or customer_workspace_id is not null)
);
create table platform.customer_case_invitations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  email text not null,
  status text not null default 'pending' check(status in ('pending','claimed','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  claimed_by uuid references auth.users(id),
  expires_at timestamptz not null default (statement_timestamp()+interval '7 days'),
  created_at timestamptz not null default statement_timestamp(),
  claimed_at timestamptz,
  check(email=lower(trim(email)))
);
create unique index customer_case_pending_invite_idx
  on platform.customer_case_invitations(case_id,email) where status='pending';
create table platform.customer_case_participants (
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check(status in ('active','revoked')),
  joined_at timestamptz not null default statement_timestamp(),
  primary key(case_id,auth_user_id)
);
create table platform.customer_case_staff (
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  platform_user_id uuid not null references platform.platform_users(id) on delete restrict,
  duty text not null check(duty in ('sales','contracts','finance','onboarding','support','audit')),
  status text not null default 'active' check(status in ('active','revoked')),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default statement_timestamp(),
  primary key(case_id,platform_user_id,duty)
);
create table platform.customer_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  visibility text not null check(visibility in ('shared','internal')),
  body text not null check(length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default statement_timestamp()
);
create table platform.customer_case_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  message_id uuid not null references platform.customer_case_messages(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz,
  unique(message_id,recipient_id)
);
create index customer_case_notifications_unread_idx
  on platform.customer_case_notifications(recipient_id,case_id,created_at desc) where read_at is null;
create index customer_case_messages_time_idx on platform.customer_case_messages(case_id,created_at,id);
create index customer_case_participants_user_idx on platform.customer_case_participants(auth_user_id,case_id) where status='active';
create index customer_case_staff_user_idx on platform.customer_case_staff(platform_user_id,case_id) where status='active';

-- Extend the existing internal start-request projection with the case pointer.
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

-- Private control-plane tables are accessed only through role-checked RPCs.
alter table platform.customer_cases enable row level security;
alter table platform.customer_case_invitations enable row level security;
alter table platform.customer_case_participants enable row level security;
alter table platform.customer_case_staff enable row level security;
alter table platform.customer_case_messages enable row level security;
alter table platform.customer_case_notifications enable row level security;
revoke all on platform.customer_cases,platform.customer_case_invitations,
  platform.customer_case_participants,platform.customer_case_staff,
  platform.customer_case_messages,platform.customer_case_notifications from public,anon,authenticated;

create function app_private.case_aal2_v1() returns boolean
language sql stable security invoker set search_path=pg_catalog as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2'
$$;
create function app_private.case_staff_allowed_v1(p_case uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select app_private.case_aal2_v1() and exists (
    select 1 from platform.customer_cases c join public.marketing_leads l on l.id=c.lead_id
    where c.id=p_case and (
      app_private.has_platform_role('PLATFORM_SUPER_ADMIN') or
      app_private.has_platform_role('PLATFORM_OPERATIONS') or
      (l.assigned_platform_user_id=app_private.current_platform_user_id()
        and app_private.has_platform_role('PLATFORM_SALES')) or
      exists(select 1 from platform.customer_case_staff s
        join platform.platform_users u on u.id=s.platform_user_id
        where s.case_id=c.id and s.platform_user_id=app_private.current_platform_user_id()
          and s.status='active' and u.status='active' and u.deactivated_at is null
          and app_private.has_platform_role(case s.duty
            when 'sales' then 'PLATFORM_SALES'::platform.platform_role_type
            when 'contracts' then 'PLATFORM_CONTRACTS'::platform.platform_role_type
            when 'finance' then 'PLATFORM_FINANCE'::platform.platform_role_type
            when 'onboarding' then 'PLATFORM_ONBOARDING'::platform.platform_role_type
            when 'audit' then 'PLATFORM_AUDITOR'::platform.platform_role_type
            else 'PLATFORM_SUPPORT'::platform.platform_role_type end))
    )
  )
$$;
create function app_private.case_customer_allowed_v1(p_case uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select app_private.case_aal2_v1() and exists (
    select 1 from platform.customer_case_participants p
    where p.case_id=p_case and p.auth_user_id=auth.uid() and p.status='active'
  )
$$;
revoke all on function app_private.case_aal2_v1(),
  app_private.case_staff_allowed_v1(uuid),
  app_private.case_customer_allowed_v1(uuid) from public,anon,service_role;
grant execute on function app_private.case_aal2_v1(),
  app_private.case_staff_allowed_v1(uuid),
  app_private.case_customer_allowed_v1(uuid) to authenticated;

create function customer_api.open_customer_case_v1(p_lead_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_lead public.marketing_leads; v_case platform.customer_cases; v_invite platform.customer_case_invitations;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_reason' using errcode='22023';
  end if;
  select * into v_lead from public.marketing_leads where id=p_lead_id for update;
  if not found or v_lead.status='spam' then raise exception 'lead_unavailable' using errcode='P0002'; end if;
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')
    or (v_lead.assigned_platform_user_id=app_private.current_platform_user_id()
      and app_private.has_platform_role('PLATFORM_SALES'))) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  insert into platform.customer_cases(lead_id,customer_email,created_by)
  values(v_lead.id,lower(trim(v_lead.email)),auth.uid())
  on conflict(lead_id) do nothing;
  select * into v_case from platform.customer_cases where lead_id=v_lead.id;
  if v_case.status<>'open' then raise exception 'case_archived' using errcode='22023'; end if;
  -- A pointer to the invitation does not grant access. Claim requires AAL2 and verified email.
  if not exists(select 1 from platform.customer_case_participants p
    join auth.users u on u.id=p.auth_user_id
    where p.case_id=v_case.id and p.status='active' and lower(u.email)=v_case.customer_email) then
    update platform.customer_case_invitations set status='expired'
      where case_id=v_case.id and status='pending' and expires_at<=statement_timestamp();
    insert into platform.customer_case_invitations(case_id,email,invited_by)
    values(v_case.id,v_case.customer_email,auth.uid()) on conflict do nothing;
  end if;
  select * into v_invite from platform.customer_case_invitations
    where case_id=v_case.id and status='pending' and expires_at>statement_timestamp();
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_OPENED','customer_case',v_case.id,trim(p_reason));
  return jsonb_build_object('case_id',v_case.id,'invitation_id',v_invite.id,
    'customer_email',v_case.customer_email,'expires_at',v_invite.expires_at,
    'verified_account_exists',exists(select 1 from auth.users u
      where lower(u.email)=v_case.customer_email and u.email_confirmed_at is not null));
end $$;

create function customer_api.my_case_invitations_v1() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_email text; v_result jsonb;
begin
  if not app_private.case_aal2_v1() then raise exception 'aal2_required' using errcode='42501'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'verified_email_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'case_id',c.id,
    'reference_id',l.reference_id,'expires_at',i.expires_at)),'[]'::jsonb) into v_result
  from platform.customer_case_invitations i
  join platform.customer_cases c on c.id=i.case_id
  join public.marketing_leads l on l.id=c.lead_id
  where i.email=v_email and i.status='pending' and i.expires_at>statement_timestamp()
    and c.status='open';
  return v_result;
end $$;

create function customer_api.claim_customer_case_v1(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_invite platform.customer_case_invitations; v_email text; v_case platform.customer_cases;
begin
  if not app_private.case_aal2_v1() then raise exception 'aal2_required' using errcode='42501'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'verified_email_required' using errcode='42501'; end if;
  select * into v_invite from platform.customer_case_invitations
    where id=p_invitation_id and status='pending' and expires_at>statement_timestamp() for update;
  if not found or v_invite.email<>v_email then raise exception 'invitation_unavailable' using errcode='42501'; end if;
  select * into v_case from platform.customer_cases where id=v_invite.case_id and status='open';
  if not found or v_case.customer_email<>v_email then raise exception 'case_unavailable' using errcode='42501'; end if;
  insert into platform.customer_case_participants(case_id,auth_user_id)
  values(v_case.id,auth.uid())
  on conflict(case_id,auth_user_id) do update set status='active';
  update platform.customer_case_invitations set status='claimed',claimed_by=auth.uid(),
    claimed_at=statement_timestamp() where id=v_invite.id;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id)
  values(auth.uid(),'CUSTOMER_CASE','CUSTOMER_CASE_CLAIMED','customer_case',v_case.id);
  return jsonb_build_object('case_id',v_case.id);
end $$;

create function customer_api.my_customer_cases_v1() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  if not app_private.case_aal2_v1() then raise exception 'aal2_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'reference_id',l.reference_id,
    'status',c.status,'created_at',c.created_at,'workspace_id',c.customer_workspace_id,
    'unread_count',(select count(*) from platform.customer_case_notifications n
      where n.case_id=c.id and n.recipient_id=auth.uid() and n.read_at is null))
    order by c.created_at desc),'[]'::jsonb) into v_result
  from platform.customer_case_participants p join platform.customer_cases c on c.id=p.case_id
  join public.marketing_leads l on l.id=c.lead_id
  where p.auth_user_id=auth.uid() and p.status='active';
  return v_result;
end $$;

create function customer_api.get_customer_case_v1(p_case_id uuid) returns jsonb
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

create function customer_api.assign_customer_case_staff_v1(
  p_case_id uuid,p_platform_user_id uuid,p_duty text,p_status text,p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_role platform.platform_role_type;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  v_role:=case p_duty
    when 'sales' then 'PLATFORM_SALES'::platform.platform_role_type
    when 'contracts' then 'PLATFORM_CONTRACTS'::platform.platform_role_type
    when 'finance' then 'PLATFORM_FINANCE'::platform.platform_role_type
    when 'onboarding' then 'PLATFORM_ONBOARDING'::platform.platform_role_type
    when 'support' then 'PLATFORM_SUPPORT'::platform.platform_role_type
    when 'audit' then 'PLATFORM_AUDITOR'::platform.platform_role_type
    else null end;
  if v_role is null or p_status not in ('active','revoked')
    or length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_case_staff_assignment' using errcode='22023';
  end if;
  if not exists(select 1 from platform.customer_cases where id=p_case_id and status='open')
    or not exists(select 1 from platform.platform_users u
      join platform.platform_role_assignments a on a.platform_user_id=u.id
      where u.id=p_platform_user_id and u.status='active' and u.deactivated_at is null
        and a.role=v_role and a.status='active' and a.valid_from<=statement_timestamp()
        and (a.valid_until is null or a.valid_until>statement_timestamp())) then
    raise exception 'active_role_and_case_required' using errcode='42501';
  end if;
  if p_status='active' then
    insert into platform.customer_case_staff(case_id,platform_user_id,duty,assigned_by)
    values(p_case_id,p_platform_user_id,p_duty,auth.uid())
    on conflict(case_id,platform_user_id,duty) do update set status='active',
      assigned_by=auth.uid(),assigned_at=statement_timestamp();
  else
    update platform.customer_case_staff set status='revoked'
      where case_id=p_case_id and platform_user_id=p_platform_user_id and duty=p_duty;
  end if;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_STAFF_ASSIGNED','customer_case',p_case_id,
    trim(p_reason),jsonb_build_object('platform_user_id',p_platform_user_id,
      'duty',p_duty,'status',p_status));
  return jsonb_build_object('case_id',p_case_id,'platform_user_id',p_platform_user_id,
    'duty',p_duty,'status',p_status);
end $$;

create function customer_api.post_customer_case_message_v1(p_case_id uuid,p_body text,p_visibility text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_staff boolean; v_message platform.customer_case_messages;
begin
  v_staff := app_private.case_staff_allowed_v1(p_case_id);
  if not v_staff and not app_private.case_customer_allowed_v1(p_case_id) then
    raise exception 'case_access_denied' using errcode='42501';
  end if;
  if not exists(select 1 from platform.customer_cases where id=p_case_id and status='open')
    or p_visibility not in ('shared','internal') or (p_visibility='internal' and not v_staff)
    or length(trim(coalesce(p_body,''))) not between 1 and 5000 then
    raise exception 'invalid_case_message' using errcode='22023';
  end if;
  insert into platform.customer_case_messages(case_id,author_id,visibility,body)
  values(p_case_id,auth.uid(),p_visibility,trim(p_body)) returning * into v_message;
  if p_visibility='shared' then
    insert into platform.customer_case_notifications(case_id,message_id,recipient_id)
    select p_case_id,v_message.id,p.auth_user_id from platform.customer_case_participants p
    where p.case_id=p_case_id and p.status='active' and p.auth_user_id<>auth.uid()
    on conflict do nothing;
  end if;
  if not v_staff then
    insert into platform.customer_case_notifications(case_id,message_id,recipient_id)
    select p_case_id,v_message.id,u.auth_user_id
    from platform.customer_cases c join public.marketing_leads l on l.id=c.lead_id
    join platform.platform_users u on u.id=l.assigned_platform_user_id
    join platform.platform_role_assignments r on r.platform_user_id=u.id
    where c.id=p_case_id and u.status='active' and u.deactivated_at is null
      and r.status='active' and r.role='PLATFORM_SALES'
      and u.auth_user_id<>auth.uid()
    on conflict do nothing;
  end if;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,after_snapshot)
  values(auth.uid(),case when v_staff then 'PLATFORM_CONTROL_PLANE' else 'CUSTOMER_CASE' end,
    'CUSTOMER_CASE_MESSAGE_POSTED','customer_case_message',v_message.id,
    jsonb_build_object('case_id',p_case_id,'visibility',p_visibility));
  return jsonb_build_object('id',v_message.id,'created_at',v_message.created_at);
end $$;

create function customer_api.mark_customer_case_read_v1(p_case_id uuid) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer;
begin
  if not app_private.case_staff_allowed_v1(p_case_id)
    and not app_private.case_customer_allowed_v1(p_case_id) then
    raise exception 'case_access_denied' using errcode='42501';
  end if;
  update platform.customer_case_notifications set read_at=statement_timestamp()
    where case_id=p_case_id and recipient_id=auth.uid() and read_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create function customer_api.link_customer_case_workspace_v1(
  p_case_id uuid,p_workspace_id uuid,p_contract_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases; v_basis platform.workspace_access_bases;
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
  if not found or v_case.customer_workspace_id is not null then
    raise exception 'case_unavailable_or_linked' using errcode='22023';
  end if;
  -- Only the existing commercial approval flow may authorize a link. This
  -- function never creates contracts, memberships or workspace access.
  select * into v_basis from platform.workspace_access_bases
  where customer_workspace_id=p_workspace_id and normalized_email=v_case.customer_email
    and status in ('prepared','active') and
    ((mode='PILOT' and p_contract_id is null) or
      (mode='PAID' and contract_id=p_contract_id and p_contract_id is not null))
  order by approved_at desc limit 1;
  if not found then raise exception 'approved_access_basis_required' using errcode='42501'; end if;
  if p_contract_id is not null and not exists (
    select 1 from platform.workspace_contracts c where c.id=p_contract_id
      and c.customer_workspace_id=p_workspace_id and c.status='active'
      and c.signed_at is not null
  ) then raise exception 'active_signed_contract_required' using errcode='42501'; end if;
  update platform.customer_cases set customer_workspace_id=p_workspace_id,
    contract_id=p_contract_id,linked_at=statement_timestamp() where id=v_case.id;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_LINKED','customer_case',v_case.id,
    trim(p_reason),jsonb_build_object('workspace_id',p_workspace_id,'contract_id',p_contract_id,'basis_id',v_basis.id));
  return jsonb_build_object('case_id',v_case.id,'workspace_id',p_workspace_id,
    'contract_id',p_contract_id);
end $$;

revoke all on function customer_api.open_customer_case_v1(uuid,text),
  customer_api.my_case_invitations_v1(), customer_api.claim_customer_case_v1(uuid),
  customer_api.my_customer_cases_v1(),customer_api.get_customer_case_v1(uuid),
  customer_api.post_customer_case_message_v1(uuid,text,text),
  customer_api.assign_customer_case_staff_v1(uuid,uuid,text,text,text),
  customer_api.mark_customer_case_read_v1(uuid),
  customer_api.link_customer_case_workspace_v1(uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function customer_api.open_customer_case_v1(uuid,text),
  customer_api.my_case_invitations_v1(),customer_api.claim_customer_case_v1(uuid),
  customer_api.my_customer_cases_v1(),customer_api.get_customer_case_v1(uuid),
  customer_api.post_customer_case_message_v1(uuid,text,text),
  customer_api.assign_customer_case_staff_v1(uuid,uuid,text,text,text),
  customer_api.mark_customer_case_read_v1(uuid),
  customer_api.link_customer_case_workspace_v1(uuid,uuid,uuid,text) to authenticated;

commit;
