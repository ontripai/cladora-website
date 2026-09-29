begin;
-- Reusing an active, time-limited grant must not create a second context.
create or replace function customer_api.claim_unit_invitation_core_v1(p_invitation uuid,p_display_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_email text; v_i communications.unit_invitations;
 v_role uuid; v_membership uuid;
begin
  select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
  if v_email is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or length(trim(coalesce(p_display_name,''))) not between 2 and 120 then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select * into v_i from communications.unit_invitations where id=p_invitation for update;
  if v_i.id is null or v_i.status<>'pending' or v_i.expires_at<=statement_timestamp()
    or v_i.normalized_email<>v_email
    or not communications.can_manage_unit_invites(v_i.invited_by,v_i.inviter_context_id,v_i.workspace_id,v_i.unit_id)
    or (v_i.role_code='vendor_contact' and not communications.unit_vendor_contract_valid(v_i.unit_id,v_i.vendor_id))
    or (v_i.role_code<>'vendor_contact' and not communications.unit_party_relationship_valid(v_i.unit_id,v_i.party_id,v_i.role_code))
    or not exists(select 1 from platform.customer_workspaces w where w.id=v_i.workspace_id
      and w.tenant_id=v_i.tenant_id and w.lifecycle_status='ACTIVE') then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select id into v_role from identity.roles where code=v_i.role_code
    and (tenant_id is null or tenant_id=v_i.tenant_id)
    order by (tenant_id=v_i.tenant_id) desc limit 1;
  if v_role is null then raise exception 'unit_role_unavailable' using errcode='55000'; end if;
  insert into identity.profiles(user_id,display_name) values(v_actor,trim(p_display_name))
    on conflict(user_id) do nothing;
  insert into identity.memberships(tenant_id,user_id,role_id,status)
    values(v_i.tenant_id,v_actor,v_role,'active')
    on conflict(tenant_id,user_id,role_id) where status in ('invited','active')
    do update set status='active' returning id into v_membership;
  if v_i.role_code='vendor_contact' then
    insert into maintenance.vendor_portal_memberships(tenant_id,vendor_id,membership_id,
      status,verified_by,accepted_at) values(v_i.tenant_id,v_i.vendor_id,v_membership,
      'active',v_i.invited_by,statement_timestamp())
      on conflict(tenant_id,membership_id,vendor_id) do update
        set status='active',verified_by=v_i.invited_by,accepted_at=statement_timestamp(),revoked_at=null;
    insert into identity.context_grants(membership_id,tenant_id,scope_type,property_id)
      select v_membership,v_i.tenant_id,'property',b.property_id
      from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v_i.unit_id
        and not exists(select 1 from identity.context_grants g where g.membership_id=v_membership
          and g.scope_type='property' and g.property_id=b.property_id and (g.ends_at is null or g.ends_at>statement_timestamp()));
  else
    if exists(select 1 from identity.membership_parties where membership_id=v_membership
      and party_id<>v_i.party_id) then raise exception 'unit_party_conflict' using errcode='23505'; end if;
    insert into identity.membership_parties(membership_id,tenant_id,party_id)
      values(v_membership,v_i.tenant_id,v_i.party_id)
      on conflict(membership_id) do nothing;
    insert into identity.context_grants(membership_id,tenant_id,scope_type,unit_id)
      select v_membership,v_i.tenant_id,'unit',v_i.unit_id where not exists(
        select 1 from identity.context_grants g where g.membership_id=v_membership
          and g.scope_type='unit' and g.unit_id=v_i.unit_id and (g.ends_at is null or g.ends_at>statement_timestamp()));
  end if;
  update communications.unit_invitations set status='accepted',accepted_by=v_actor,
    accepted_at=statement_timestamp() where id=v_i.id;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,v_actor,'unit_invitation.accept','communications.unit_invitation',v_i.id);
  return jsonb_build_object('membership_id',v_membership,'unit_id',v_i.unit_id);
end $$;
commit;
