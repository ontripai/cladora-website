begin;

insert into identity.roles(tenant_id,code,name,is_system) values
  (null,'company_staff','Company staff',true),
  (null,'vendor_contact','Verified contractor contact',true)
on conflict(tenant_id,code) do update set name=excluded.name,is_system=true;
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
where r.code in ('company_staff','vendor_contact') and r.is_system and r.tenant_id is null
  and p.code in ('communications.feed.read','documents.vault.read')
on conflict(role_id,permission_id) do update set effect='allow';

-- Only the trusted provisioning workflow may bind an authenticated membership
-- to an approved vendor; a party/vendor record alone confers no access.
create table maintenance.vendor_portal_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  vendor_id uuid not null references maintenance.vendors(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  status text not null default 'invited' check(status in ('invited','active','revoked')),
  verified_by uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,membership_id,vendor_id),
  check(status<>'active' or (accepted_at is not null and revoked_at is null))
);
create index vendor_portal_memberships_vendor_idx on maintenance.vendor_portal_memberships(vendor_id,status);
create index vendor_portal_memberships_member_idx on maintenance.vendor_portal_memberships(membership_id,status);
create index vendor_portal_memberships_tenant_idx on maintenance.vendor_portal_memberships(tenant_id);
create index vendor_portal_memberships_verified_by_idx on maintenance.vendor_portal_memberships(verified_by);
alter table maintenance.vendor_portal_memberships enable row level security;
grant all on maintenance.vendor_portal_memberships to service_role;

create function maintenance.audit_vendor_portal_membership()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,before_snapshot,after_snapshot)
    values(new.tenant_id,coalesce(auth.uid(),new.verified_by),
      case when tg_op='INSERT' then 'vendor_portal_membership.create' else 'vendor_portal_membership.update' end,
      'maintenance.vendor_portal_membership',new.id,
      case when tg_op='UPDATE' then jsonb_build_object('status',old.status,'revoked_at',old.revoked_at) else null end,
      jsonb_build_object('vendor_id',new.vendor_id,'membership_id',new.membership_id,
        'status',new.status,'accepted_at',new.accepted_at,'revoked_at',new.revoked_at));
  return new;
end; $$;
create trigger vendor_portal_membership_audit after insert or update on maintenance.vendor_portal_memberships
  for each row execute function maintenance.audit_vendor_portal_membership();
revoke all on function maintenance.audit_vendor_portal_membership() from public,anon,authenticated;

create or replace function communications.member_covers_unit(p_membership uuid, p_tenant uuid, p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select exists (
    select 1 from identity.memberships m
    join identity.context_grants g on g.membership_id=m.id and g.tenant_id=m.tenant_id
    join identity.roles r on r.id=m.role_id
    join portfolio.units u on u.id=p_unit and u.tenant_id=m.tenant_id and u.status='active'
    join portfolio.buildings b on b.id=u.building_id and b.tenant_id=m.tenant_id
    where m.id=p_membership and m.tenant_id=p_tenant and m.status='active'
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and lower(r.code) in ('association_admin','property_manager','president','owner','tenant_resident','company_staff','vendor_contact')
      and exists (select 1 from identity.role_permissions rp join identity.permissions perm on perm.id=rp.permission_id
        where rp.role_id=m.role_id and rp.effect='allow' and perm.code='communications.feed.read')
      and (lower(r.code) not in ('owner','tenant_resident') or
        (g.scope_type='unit' and g.unit_id=p_unit and exists (
          select 1 from identity.membership_parties mp where mp.membership_id=m.id and mp.tenant_id=m.tenant_id
            and ((lower(r.code)='owner' and exists (
              select 1 from portfolio.ownerships o where o.tenant_id=m.tenant_id and o.unit_id=p_unit
                and o.party_id=mp.party_id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)))
              or (lower(r.code)='tenant_resident' and exists (
                select 1 from occupancy.leases l where l.tenant_id=m.tenant_id and l.unit_id=p_unit
                  and l.tenant_party_id=mp.party_id and l.status='active' and l.starts_on<=current_date
                  and (l.ends_on is null or l.ends_on>current_date)))))))
      and (lower(r.code)<>'company_staff' or exists (
        select 1 from platform.platform_users pu
        join platform.platform_role_assignments pra on pra.platform_user_id=pu.id
          and pra.status='active' and pra.revoked_at is null and pra.role in ('PLATFORM_OPERATIONS','PLATFORM_SUPPORT')
          and pra.valid_from<=statement_timestamp() and (pra.valid_until is null or pra.valid_until>statement_timestamp())
        join platform.platform_customer_assignments ca on ca.platform_user_id=pu.id
          and ca.status='active' and ca.revoked_at is null
          and ca.valid_from<=statement_timestamp() and (ca.valid_until is null or ca.valid_until>statement_timestamp())
        join platform.customer_workspaces w on w.id=ca.customer_workspace_id and w.tenant_id=m.tenant_id and w.lifecycle_status='ACTIVE'
        where pu.auth_user_id=m.user_id and pu.status='active' and pu.deactivated_at is null))
      and (lower(r.code)<>'vendor_contact' or exists (
        select 1 from maintenance.vendor_portal_memberships vp
        join maintenance.vendors v on v.id=vp.vendor_id and v.tenant_id=m.tenant_id and v.status='approved'
        join maintenance.vendor_contracts vc on vc.vendor_id=v.id and vc.tenant_id=m.tenant_id
          and vc.property_id=b.property_id and vc.status='active'
          and vc.starts_on<=current_date and (vc.ends_on is null or vc.ends_on>current_date)
        join auth.users au on au.id=m.user_id and au.email_confirmed_at is not null
        where vp.membership_id=m.id and vp.tenant_id=m.tenant_id and vp.status='active'
          and vp.accepted_at is not null and vp.revoked_at is null))
      -- Tenant-wide grants are intentionally excluded from private discovery.
      and ((g.scope_type='property' and g.property_id=b.property_id)
        or (g.scope_type='building' and g.building_id=b.id)
        or (g.scope_type='unit' and g.unit_id=u.id))
  );
$$;

create function communications.private_pair_allowed(p_first uuid,p_second uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from identity.memberships a join identity.roles ar on ar.id=a.role_id
    join identity.memberships b on b.id=p_second and b.tenant_id=a.tenant_id
    join identity.roles br on br.id=b.role_id
    where a.id=p_first and a.id<>b.id
      and (lower(ar.code) not in ('company_staff','vendor_contact')
        and lower(br.code) not in ('company_staff','vendor_contact')
        or (lower(ar.code) in ('company_staff','vendor_contact')
          and lower(br.code) in ('association_admin','property_manager','president'))
        or (lower(br.code) in ('company_staff','vendor_contact')
          and lower(ar.code) in ('association_admin','property_manager','president')))
      and communications.member_covers_unit(a.id,a.tenant_id,p_unit)
      and communications.member_covers_unit(b.id,b.tenant_id,p_unit));
$$;
revoke all on function communications.private_pair_allowed(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function communications.can_read_private(p_conversation uuid, p_membership uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select exists (
    select 1 from communications.private_conversations c
    join communications.private_participants p on p.conversation_id=c.id
    join identity.memberships m on m.id=p.membership_id and m.tenant_id=c.tenant_id
    where c.id=p_conversation and p.membership_id=p_membership and p.revoked_at is null
      and m.user_id=auth.uid()
      and coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and exists(select 1 from platform.customer_workspaces w join platform.workspace_entitlements e
        on e.customer_workspace_id=w.id where w.tenant_id=c.tenant_id and w.lifecycle_status='ACTIVE'
          and e.entitlement_key='module.communications' and e.valid_from<=statement_timestamp()
          and (e.valid_until is null or e.valid_until>statement_timestamp())
          and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
            then e.override_value_json='true'::jsonb else e.boolean_value is true end))
      and communications.member_covers_unit(m.id,c.tenant_id,c.unit_id)
      and not exists(select 1 from communications.private_participants other
        where other.conversation_id=c.id and other.membership_id<>m.id and other.revoked_at is null
          and (not communications.member_covers_unit(other.membership_id,c.tenant_id,c.unit_id)
            or not communications.private_pair_allowed(m.id,other.membership_id,c.unit_id)))
  );
$$;

create or replace function customer_api.create_private_conversation_v1(
  p_context_id uuid, p_unit_id uuid, p_recipient_membership_id uuid, p_body text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
  v_tenant uuid; v_thread uuid; v_message uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
      or v_actor is null or p_recipient_membership_id is null
      or p_recipient_membership_id=v_actor or p_request_id is null
      or length(trim(coalesce(p_body,''))) not between 1 and 5000 then
    raise exception 'private_conversation_denied' using errcode='42501';
  end if;
  select tenant_id into v_tenant from identity.memberships where id=v_actor;
  if not communications.member_covers_unit(v_actor,v_tenant,p_unit_id)
     or not communications.member_covers_unit(p_recipient_membership_id,v_tenant,p_unit_id)
     or not communications.private_pair_allowed(v_actor,p_recipient_membership_id,p_unit_id)
     or not exists(select 1 from platform.customer_workspaces w join platform.workspace_entitlements e
       on e.customer_workspace_id=w.id where w.tenant_id=v_tenant and w.lifecycle_status='ACTIVE'
         and e.entitlement_key='module.communications' and e.valid_from<=statement_timestamp()
         and (e.valid_until is null or e.valid_until>statement_timestamp())
         and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
           then e.override_value_json='true'::jsonb else e.boolean_value is true end))
     or not communications.context_covers_unit(p_context_id,p_unit_id)
     then raise exception 'private_conversation_denied' using errcode='42501'; end if;
  -- Both identities must be active in the same tenant and have a current,
  -- explicit property/building/unit grant. Raw vendor rows cannot participate.
  insert into communications.private_conversations(tenant_id,unit_id,created_by,client_request_id)
    values(v_tenant,p_unit_id,v_actor,p_request_id)
    on conflict (created_by,client_request_id) do nothing returning id into v_thread;
  if v_thread is null then
    select c.id into v_thread from communications.private_conversations c
    where c.created_by=v_actor and c.client_request_id=p_request_id and c.unit_id=p_unit_id
      and exists(select 1 from communications.private_participants p
        where p.conversation_id=c.id and p.membership_id=p_recipient_membership_id and p.revoked_at is null);
    if v_thread is null then raise exception 'private_conversation_request_conflict' using errcode='23505'; end if;
    select id into v_message from communications.private_messages
      where conversation_id=v_thread and sender_id=v_actor and client_request_id=p_request_id;
    return jsonb_build_object('conversation_id',v_thread,'message_id',v_message,'replayed',true);
  end if;
  insert into communications.private_participants(conversation_id,membership_id)
    values(v_thread,v_actor),(v_thread,p_recipient_membership_id);
  insert into communications.private_messages(conversation_id,sender_id,client_request_id,body)
    values(v_thread,v_actor,p_request_id,trim(p_body)) returning id into v_message;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'private_conversation.create','communications.private_conversation',v_thread,
      jsonb_build_object('unit_id',p_unit_id,'recipient_membership_id',p_recipient_membership_id,'message_id',v_message));
  insert into communications.notifications(tenant_id,membership_id,type,title,action_url,payload)
    values(v_tenant,p_recipient_membership_id,'private_message','New private message','/app/communications',jsonb_build_object('conversation_id',v_thread));
  return jsonb_build_object('conversation_id',v_thread,'message_id',v_message);
end; $$;


create or replace function customer_api.list_private_recipients_v1(p_context_id uuid,p_unit_id uuid)
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
      and communications.member_covers_unit(m.id,v_tenant,p_unit_id)
      and communications.private_pair_allowed(v_actor,m.id,p_unit_id)), '[]'::jsonb);
end; $$;


commit;
