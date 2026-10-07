begin;

-- Keep invitation continuation on the exposed customer_api boundary. The
-- underlying platform functions remain private and retain the authoritative
-- verified-email, lifecycle, role, scope, idempotency, and audit checks.

create or replace function platform.claim_workspace_invitation(
  p_invitation_id uuid,
  p_display_name text,
  p_locale text default 'ro',
  p_timezone text default 'Europe/Bucharest'
)
returns table (
  claim_status text,
  customer_workspace_id uuid,
  membership_id uuid,
  onboarding_required boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actor uuid := auth.uid();
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_invitation platform.workspace_invitations;
  v_workspace platform.customer_workspaces;
  v_role identity.roles;
  v_membership identity.memberships;
  v_context_grant_id uuid;
  v_is_primary_admin boolean;
  v_onboarding_required boolean;
begin
  if v_actor is null then
    raise exception 'authentication_required: authenticated invitation session required'
      using errcode = '42501';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(u.email)), u.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users as u
  where u.id = v_actor;

  if not found or v_auth_email is null or v_email_confirmed_at is null then
    raise exception 'verified_identity_required: verified Auth identity is unavailable'
      using errcode = '42501';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_display_name, ''))) < 2
     or pg_catalog.length(pg_catalog.btrim(p_display_name)) > 120 then
    raise exception 'invalid_display_name: display name must contain 2 to 120 characters'
      using errcode = '22023';
  end if;

  if p_locale not in ('ro', 'en', 'fa') then
    raise exception 'invalid_locale: supported locales are ro, en, and fa'
      using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_timezone, ''))) = 0
     or pg_catalog.length(pg_catalog.btrim(p_timezone)) > 100 then
    raise exception 'invalid_timezone: timezone is required'
      using errcode = '22023';
  end if;

  select * into v_invitation
  from platform.workspace_invitations as i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation_unavailable: invitation cannot be claimed'
      using errcode = 'P0002';
  end if;

  if v_invitation.status = 'accepted'
     and v_invitation.accepted_by = v_actor
     and v_invitation.accepted_membership_id is not null then
    return query
    select
      'already_claimed_by_you'::text,
      v_invitation.customer_workspace_id,
      v_invitation.accepted_membership_id,
      w.onboarding_completed_at is null
    from platform.customer_workspaces as w
    where w.id = v_invitation.customer_workspace_id;
    return;
  end if;

  if v_invitation.status <> 'sent'
     or v_invitation.expires_at <= v_now
     or v_invitation.normalized_email <> v_auth_email then
    raise exception 'invitation_unavailable: invitation cannot be claimed'
      using errcode = '42501';
  end if;

  if v_invitation.scope_type <> 'tenant' then
    raise exception 'unsupported_invitation_scope: tokenless rollout currently permits tenant scope only'
      using errcode = '22023';
  end if;

  select * into v_workspace
  from platform.customer_workspaces as w
  where w.id = v_invitation.customer_workspace_id
  for update;

  if not found or v_workspace.lifecycle_status <> 'PROVISIONING' then
    raise exception 'workspace_unavailable: invitation workspace cannot be claimed'
      using errcode = '55000';
  end if;

  select * into v_role
  from identity.roles as r
  where r.id = v_invitation.role_id;

  if not found
     or (v_role.tenant_id is not null and v_role.tenant_id <> v_workspace.tenant_id) then
    raise exception 'invitation_authorization_mismatch: stored role is outside the workspace tenant'
      using errcode = '42501';
  end if;

  v_is_primary_admin := lower(v_role.code) in (
    'workspace_owner',
    'workspace_admin',
    'association_admin',
    'property_manager'
  );

  if v_is_primary_admin
     and v_workspace.primary_admin_user_id is not null
     and v_workspace.primary_admin_user_id <> v_actor then
    raise exception 'workspace_unavailable: a different primary administrator is already assigned'
      using errcode = '23505';
  end if;

  insert into identity.profiles (user_id, display_name, locale, timezone)
  values (
    v_actor,
    pg_catalog.btrim(p_display_name),
    p_locale,
    pg_catalog.btrim(p_timezone)
  )
  on conflict (user_id) do nothing;

  insert into identity.memberships (
    tenant_id,
    user_id,
    role_id,
    status,
    starts_at
  ) values (
    v_workspace.tenant_id,
    v_actor,
    v_invitation.role_id,
    'active',
    v_now
  )
  on conflict (tenant_id, user_id, role_id)
    where status in ('invited', 'active')
  do update
    set status = 'active',
        starts_at = least(identity.memberships.starts_at, excluded.starts_at),
        updated_at = v_now
  returning * into v_membership;

  insert into identity.context_grants (
    membership_id,
    tenant_id,
    scope_type,
    starts_at
  ) values (
    v_membership.id,
    v_workspace.tenant_id,
    'tenant',
    v_now
  )
  on conflict (membership_id, tenant_id, scope_type)
    where scope_type = 'tenant'
      and property_id is null
      and building_id is null
      and unit_id is null
      and ends_at is null
  do update
    set starts_at = least(identity.context_grants.starts_at, excluded.starts_at)
  returning id into v_context_grant_id;

  if v_context_grant_id is null then
    raise exception 'context_grant_unavailable: invitation context could not be established'
      using errcode = '55000';
  end if;

  update platform.workspace_invitations
  set status = 'accepted',
      accepted_by = v_actor,
      accepted_at = v_now,
      accepted_membership_id = v_membership.id
  where id = v_invitation.id
  returning * into v_invitation;

  if v_is_primary_admin and v_workspace.primary_admin_user_id is null then
    update platform.customer_workspaces
    set primary_admin_user_id = v_actor,
        primary_admin_membership_id = v_membership.id,
        primary_admin_accepted_at = v_now,
        updated_at = v_now,
        version = version + 1
    where id = v_workspace.id
    returning * into v_workspace;
  end if;

  v_onboarding_required := v_is_primary_admin and v_workspace.onboarding_completed_at is null;

  insert into audit.events (
    tenant_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    before_snapshot,
    after_snapshot,
    occurred_at
  ) values (
    v_workspace.tenant_id,
    v_actor,
    'CUSTOMER_INVITEE',
    'WORKSPACE_INVITATION_CLAIMED',
    'workspace_invitation',
    v_invitation.id,
    'Verified user claimed a server-bound workspace invitation',
    pg_catalog.jsonb_build_object('invitation_status', 'sent'),
    pg_catalog.jsonb_build_object(
      'invitation_status', 'accepted',
      'membership_id', v_membership.id,
      'scope_type', v_invitation.scope_type
    ),
    v_now
  );

  return query
  select 'claimed'::text, v_workspace.id, v_membership.id, v_onboarding_required;
end;
$$;

revoke all on function platform.claim_workspace_invitation(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function platform.claim_workspace_invitation(uuid, text, text, text)
  to authenticated;

create or replace function customer_api.list_my_claimable_workspace_invitations_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required: authenticated invitation session required'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_result
  from platform.list_my_claimable_workspace_invitations() as x;

  return v_result;
end;
$$;

create or replace function customer_api.claim_workspace_invitation_v1(
  p_invitation_id uuid,
  p_display_name text,
  p_locale text,
  p_timezone text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required: authenticated invitation session required'
      using errcode = '42501';
  end if;

  select to_jsonb(x)
  into v_result
  from platform.claim_workspace_invitation(
    p_invitation_id,
    p_display_name,
    p_locale,
    p_timezone
  ) as x;

  return v_result;
end;
$$;

revoke all on function customer_api.list_my_claimable_workspace_invitations_v1()
  from public, anon, service_role;
grant execute on function customer_api.list_my_claimable_workspace_invitations_v1()
  to authenticated;

revoke all on function customer_api.claim_workspace_invitation_v1(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function customer_api.claim_workspace_invitation_v1(uuid, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
