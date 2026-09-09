begin;

-- ============================================================================
-- CLADORA-P2-GOV-001: Association Governance, Meetings, Voting & Decisions
-- Authoritative Romanian Legal Contract: Legea nr. 196/2018
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Governance Policies Table (Versioned, Effective-Dated, Snapshot-Based)
-- ----------------------------------------------------------------------------
create table if not exists governance.governance_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  name text not null,
  policy_version integer not null default 1 check (policy_version > 0),
  legal_basis text not null default 'Legea nr. 196/2018',
  effective_from timestamptz not null default statement_timestamp(),
  effective_until timestamptz,
  timezone text not null default 'Europe/Bucharest',
  meeting_type text not null default 'general_assembly',
  notice_period_days integer not null default 10 check (notice_period_days >= 3),
  reconvened_notice_period_days integer not null default 3 check (reconvened_notice_period_days >= 3),
  reconvened_window_days integer not null default 15 check (reconvened_window_days between 3 and 15),
  quorum_rule jsonb not null default '{"basis":"members","threshold":0.5000000001}'::jsonb,
  reconvened_quorum_rule jsonb not null default '{"basis":"present_members","threshold":0.0}'::jsonb,
  voting_basis text not null default 'ownership_share' check (voting_basis in ('unit', 'owner', 'ownership_share')),
  default_majority_rule jsonb not null default '{"type":"simple_majority","threshold":0.5000000001}'::jsonb,
  proxy_allowed boolean not null default true,
  proxy_limit_rule jsonb not null default '{"max_proxies_per_representative":1}'::jsonb,
  electronic_participation_allowed boolean not null default true,
  electronic_voting_allowed boolean not null default true,
  secret_ballot_allowed boolean not null default true,
  status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'archived')),
  approved_by_resolution_id uuid references governance.resolutions(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  activated_by uuid references auth.users(id) on delete restrict,
  activated_at timestamptz,
  superseded_by uuid references governance.governance_policies(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  unique (tenant_id, property_id, policy_version)
);

create index if not exists governance_policies_lookup_idx on governance.governance_policies(tenant_id, property_id, status, effective_from desc);
create index if not exists governance_policies_property_id_idx on governance.governance_policies(property_id);
create index if not exists governance_policies_created_by_idx on governance.governance_policies(created_by);
create index if not exists governance_policies_activated_by_idx on governance.governance_policies(activated_by);
create index if not exists governance_policies_superseded_by_idx on governance.governance_policies(superseded_by);
create index if not exists governance_policies_approved_res_idx on governance.governance_policies(approved_by_resolution_id);

create or replace function governance.protect_governance_policy()
returns trigger language plpgsql security definer set search_path=pg_catalog,governance as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'active' or exists(select 1 from governance.meetings m where m.policy_id = old.id) then
      raise exception 'active_or_referenced_policy_cannot_be_deleted';
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if exists(select 1 from governance.meetings m where m.policy_id = old.id) and new is distinct from old then
      if (new.superseded_by is distinct from old.superseded_by or new.effective_until is distinct from old.effective_until or new.status = 'superseded')
         and new.id = old.id and new.tenant_id = old.tenant_id and new.property_id is not distinct from old.property_id
         and new.policy_version = old.policy_version and new.quorum_rule = old.quorum_rule
         and new.voting_basis = old.voting_basis then
        return new;
      end if;
      raise exception 'referenced_governance_policy_is_immutable';
    end if;
    return new;
  end if;
  return new;
end;
$$;

create trigger governance_policy_protect before update or delete on governance.governance_policies
for each row execute function governance.protect_governance_policy();

-- ----------------------------------------------------------------------------
-- 2. Domain Schema Extensions (Forward-Only)
-- ----------------------------------------------------------------------------

-- meetings extensions
alter table governance.meetings
  add column if not exists policy_id uuid references governance.governance_policies(id) on delete restrict,
  add column if not exists policy_snapshot jsonb,
  add column if not exists description text,
  add column if not exists scheduled_end timestamptz,
  add column if not exists timezone text not null default 'Europe/Bucharest',
  add column if not exists venue text,
  add column if not exists remote_join_reference text,
  add column if not exists first_call boolean not null default true,
  add column if not exists parent_meeting_id uuid references governance.meetings(id) on delete restrict,
  add column if not exists record_date timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete restrict,
  add column if not exists published_at timestamptz,
  add column if not exists opened_by uuid references auth.users(id) on delete restrict,
  add column if not exists cancellation_reason text;

create index if not exists governance_meetings_policy_id_idx on governance.meetings(policy_id);
create index if not exists governance_meetings_parent_meeting_id_idx on governance.meetings(parent_meeting_id);
create index if not exists governance_meetings_published_by_idx on governance.meetings(published_by);
create index if not exists governance_meetings_opened_by_idx on governance.meetings(opened_by);

-- agenda_items extensions
alter table governance.agenda_items
  add column if not exists item_type text not null default 'discussion' check (item_type in ('discussion', 'motion', 'information', 'election')),
  add column if not exists presenter text,
  add column if not exists discussion_duration_minutes integer,
  add column if not exists voting_required boolean not null default false,
  add column if not exists majority_rule_snapshot jsonb,
  add column if not exists financial_impact_indicator boolean not null default false,
  add column if not exists proposed_amount numeric(15,4),
  add column if not exists currency text check (currency is null or length(currency) = 3),
  add column if not exists status text not null default 'draft' check (status in ('draft', 'approved', 'deferred', 'concluded'));

-- eligibility_snapshots extensions
alter table governance.eligibility_snapshots
  add column if not exists source_ownership_id uuid references portfolio.ownerships(id) on delete restrict,
  add column if not exists exclusion_reason text;

create index if not exists governance_eligibility_source_ownership_id_idx on governance.eligibility_snapshots(source_ownership_id);

-- attendance extensions
alter table governance.attendance
  add column if not exists participant_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists checked_out_at timestamptz,
  add column if not exists notes text;

create index if not exists governance_attendance_participant_user_id_idx on governance.attendance(participant_user_id);

-- proxies extensions
alter table governance.proxies
  add column if not exists verification_status text not null default 'verified' check (verification_status in ('pending', 'verified', 'rejected')),
  add column if not exists verified_by uuid references auth.users(id) on delete restrict,
  add column if not exists verified_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

create index if not exists governance_proxies_verified_by_idx on governance.proxies(verified_by);

-- votes extensions
alter table governance.votes
  add column if not exists motion_text text,
  add column if not exists proposer text,
  add column if not exists seconder text,
  add column if not exists voting_basis text check (voting_basis in ('unit', 'owner', 'ownership_share')),
  add column if not exists majority_rule_snapshot jsonb,
  add column if not exists quorum_snapshot jsonb,
  add column if not exists eligible_weight numeric(20,10),
  add column if not exists cast_weight numeric(20,10),
  add column if not exists for_weight numeric(20,10),
  add column if not exists against_weight numeric(20,10),
  add column if not exists abstain_weight numeric(20,10);

-- ballots extensions
alter table governance.ballots
  add column if not exists choice text check (choice in ('for', 'against', 'abstain')),
  add column if not exists source text not null default 'remote' check (source in ('in_person', 'remote', 'proxy', 'written')),
  add column if not exists idempotency_key text,
  add column if not exists represented_party_id uuid references portfolio.parties(id) on delete restrict;

create index if not exists governance_ballots_represented_party_id_idx on governance.ballots(represented_party_id);
create unique index if not exists governance_ballots_idempotency_idx on governance.ballots(tenant_id, idempotency_key) where idempotency_key is not null;

-- resolutions extensions
alter table governance.resolutions
  add column if not exists responsible_actor text,
  add column if not exists due_date date,
  add column if not exists execution_status text not null default 'pending' check (execution_status in ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  add column if not exists financial_impact numeric(15,4),
  add column if not exists currency text check (currency is null or length(currency) = 3),
  add column if not exists maintenance_work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  add column if not exists purchase_order_id uuid references maintenance.purchase_orders(id) on delete restrict,
  add column if not exists supersedes_resolution_id uuid references governance.resolutions(id) on delete restrict,
  add column if not exists vote_totals jsonb,
  add column if not exists threshold_result jsonb;

create index if not exists governance_resolutions_work_order_id_idx on governance.resolutions(maintenance_work_order_id);
create index if not exists governance_resolutions_purchase_order_id_idx on governance.resolutions(purchase_order_id);
create index if not exists governance_resolutions_supersedes_id_idx on governance.resolutions(supersedes_resolution_id);

-- minutes extensions
alter table governance.minutes
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references auth.users(id) on delete restrict,
  add column if not exists prior_version_id uuid references governance.minutes(id) on delete restrict,
  add column if not exists correction_reason text;

create index if not exists governance_minutes_finalized_by_idx on governance.minutes(finalized_by);
create index if not exists governance_minutes_prior_version_id_idx on governance.minutes(prior_version_id);

-- resolution_actions table
create table if not exists governance.resolution_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  resolution_id uuid not null references governance.resolutions(id) on delete restrict,
  action_title text not null,
  description text,
  responsible_actor text,
  due_date date,
  execution_status text not null default 'pending' check (execution_status in ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists governance_resolution_actions_res_idx on governance.resolution_actions(tenant_id, resolution_id);
create index if not exists resolution_actions_resolution_id_idx on governance.resolution_actions(resolution_id);

-- RLS & Grants
alter table governance.governance_policies enable row level security;
alter table governance.resolution_actions enable row level security;

create policy governance_policies_context_read on governance.governance_policies
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id() and (property_id is null or app_private.can_access_property(property_id)));

create policy resolution_actions_context_read on governance.resolution_actions
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id() and exists (
    select 1 from governance.resolutions r join governance.meetings m on m.id = r.meeting_id
    where r.id = resolution_id and app_private.can_access_property(m.property_id)
  ));

grant select on governance.governance_policies to authenticated;
grant select on governance.resolution_actions to authenticated;
grant all on governance.governance_policies to service_role;
grant all on governance.resolution_actions to service_role;

-- ----------------------------------------------------------------------------
-- 3. Permissions & Role-Permission Bootstrap
-- ----------------------------------------------------------------------------
insert into identity.permissions(code, resource, action, description) values
  ('governance.meetings.manage', 'governance.meetings', 'manage', 'Create, update, publish and complete governance meetings'),
  ('governance.agenda.manage', 'governance.agenda', 'manage', 'Add, modify, and manage meeting agenda items'),
  ('governance.attendance.manage', 'governance.attendance', 'manage', 'Record meeting participant attendance and proxies'),
  ('governance.proxies.manage', 'governance.proxies', 'manage', 'Register, verify, and revoke voting proxies'),
  ('governance.votes.cast', 'governance.votes', 'cast', 'Cast ballots in open governance votes'),
  ('governance.votes.administer', 'governance.votes', 'administer', 'Open, close, and tally ballots and resolutions'),
  ('governance.resolutions.read', 'governance.resolutions', 'read', 'Read adopted resolutions and action registers'),
  ('governance.resolutions.manage', 'governance.resolutions', 'manage', 'Adopt, track, and execute governance resolutions'),
  ('governance.minutes.read', 'governance.minutes', 'read', 'Read formal meeting minutes and version history'),
  ('governance.minutes.finalize', 'governance.minutes', 'finalize', 'Finalize formal meeting minutes and issue corrections'),
  ('governance.audit.read', 'governance.audit', 'read', 'Read governance security and vote audit logs')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) = 'association_admin' and p.code like 'governance.%'
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) = 'property_manager'
  and p.code in (
    'governance.meetings.read', 'governance.meetings.manage',
    'governance.agenda.manage', 'governance.attendance.manage',
    'governance.proxies.manage', 'governance.votes.administer',
    'governance.resolutions.read', 'governance.resolutions.manage',
    'governance.minutes.read', 'governance.audit.read'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) = 'president'
  and p.code in (
    'governance.meetings.read', 'governance.meetings.manage',
    'governance.agenda.manage', 'governance.attendance.manage',
    'governance.proxies.manage', 'governance.votes.administer',
    'governance.resolutions.read', 'governance.resolutions.manage',
    'governance.minutes.read', 'governance.minutes.finalize', 'governance.audit.read'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) = 'censor'
  and p.code in ('governance.meetings.read', 'governance.resolutions.read', 'governance.minutes.read', 'governance.audit.read')
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) = 'owner'
  and p.code in ('governance.meetings.read', 'governance.votes.cast', 'governance.resolutions.read', 'governance.minutes.read')
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) = 'tenant_resident'
  and p.code in ('governance.meetings.read', 'governance.resolutions.read', 'governance.minutes.read')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- ----------------------------------------------------------------------------
-- 4. Actor Resolution & Validation Helper
-- ----------------------------------------------------------------------------
create or replace function governance.resolve_governance_actor(
  p_context_id uuid,
  p_required_permission text,
  p_require_aal2 boolean default true
)
returns table(
  tenant_id uuid,
  membership_id uuid,
  role_code text,
  scope_type text,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  party_id uuid,
  actor_id uuid
) language plpgsql stable security definer set search_path=pg_catalog,identity,platform,portfolio,occupancy as $$
declare
  v_uid uuid := auth.uid();
  v_grant record;
  v_workspace uuid;
  v_party uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_require_aal2 and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as m_id, m.role_id, r.code as r_code
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = v_uid
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if p_required_permission is not null then
    if not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id = rp.permission_id
      where rp.role_id = v_grant.role_id
        and rp.effect = 'allow'
        and p.code = p_required_permission
    ) then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_grant.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements we
    where we.customer_workspace_id = v_workspace
      and we.entitlement_key = 'module.governance'
      and we.valid_from <= statement_timestamp()
      and (we.valid_until is null or we.valid_until > statement_timestamp())
      and (case when we.override_value_json is not null and we.override_expires_at > statement_timestamp()
                then we.override_value_json = 'true'::jsonb
                else we.boolean_value is true end)
  ) then
    raise exception 'governance_entitlement_required' using errcode = '42501';
  end if;

  if lower(v_grant.r_code) in ('owner', 'tenant_resident') then
    select mp.party_id into v_party
    from identity.membership_parties mp
    where mp.membership_id = v_grant.m_id and mp.tenant_id = v_grant.tenant_id
    limit 1;

    if v_party is null or v_grant.scope_type <> 'unit' then
      raise exception 'resident_party_and_unit_context_required' using errcode = '42501';
    end if;

    if lower(v_grant.r_code) = 'owner' and not exists (
      select 1 from portfolio.ownerships o
      where o.tenant_id = v_grant.tenant_id
        and o.unit_id = v_grant.unit_id
        and o.party_id = v_party
        and o.valid_from <= current_date
        and (o.valid_to is null or o.valid_to > current_date)
    ) then
      raise exception 'ownership_required' using errcode = '42501';
    end if;
  end if;

  return query select
    v_grant.tenant_id,
    v_grant.m_id,
    v_grant.r_code,
    v_grant.scope_type::text,
    v_grant.property_id,
    v_grant.building_id,
    v_grant.unit_id,
    v_party,
    v_uid;
end;
$$;

revoke all on function governance.resolve_governance_actor(uuid, text, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Domain RPC: Create Governance Policy
-- ----------------------------------------------------------------------------
create or replace function governance.create_governance_policy(
  p_context_id uuid,
  p_property_id uuid,
  p_name text,
  p_voting_basis text default 'ownership_share',
  p_notice_period_days integer default 10,
  p_quorum_threshold numeric default 0.5000000001
)
returns governance.governance_policies
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_next_version integer;
  v_policy governance.governance_policies;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  if p_voting_basis not in ('unit', 'owner', 'ownership_share') then
    raise exception 'invalid_voting_basis' using errcode = '22023';
  end if;

  if p_notice_period_days < 3 then
    raise exception 'notice_period_below_statutory_minimum' using errcode = '22023';
  end if;

  select coalesce(max(policy_version), 0) + 1 into v_next_version
  from governance.governance_policies
  where tenant_id = v_actor.tenant_id
    and (property_id is null and p_property_id is null or property_id = p_property_id);

  insert into governance.governance_policies(
    tenant_id, property_id, name, policy_version, legal_basis,
    effective_from, voting_basis, notice_period_days,
    quorum_rule, created_by, activated_by, activated_at, status
  ) values (
    v_actor.tenant_id, p_property_id, p_name, v_next_version, 'Legea nr. 196/2018',
    statement_timestamp(), p_voting_basis, p_notice_period_days,
    jsonb_build_object('basis', case when p_voting_basis = 'unit' then 'units' else 'ownership_share' end, 'threshold', p_quorum_threshold),
    v_actor.actor_id, v_actor.actor_id, statement_timestamp(), 'active'
  ) returning * into v_policy;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'create_governance_policy', 'governance_policy',
    v_policy.id, to_jsonb(v_policy), statement_timestamp()
  );

  return v_policy;
end;
$$;

revoke all on function governance.create_governance_policy(uuid, uuid, text, text, integer, numeric) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Domain RPC: Create Meeting (Draft)
-- ----------------------------------------------------------------------------
create or replace function governance.create_meeting(
  p_context_id uuid,
  p_property_id uuid,
  p_title text,
  p_meeting_type text,
  p_scheduled_at timestamptz,
  p_location_text text default null,
  p_remote_join_url text default null,
  p_description text default null,
  p_venue text default null,
  p_record_date timestamptz default null
)
returns governance.meetings
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_policy governance.governance_policies;
  v_meeting governance.meetings;
  v_rec_date timestamptz;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  if p_property_id is null or trim(p_title) = '' or p_scheduled_at is null then
    raise exception 'invalid_meeting_parameters' using errcode = '22023';
  end if;

  if v_actor.scope_type = 'property' and v_actor.property_id <> p_property_id then
    raise exception 'property_scope_mismatch' using errcode = '42501';
  end if;

  select * into v_policy
  from governance.governance_policies
  where tenant_id = v_actor.tenant_id
    and (property_id = p_property_id or property_id is null)
    and status = 'active'
    and effective_from <= statement_timestamp()
    and (effective_until is null or effective_until > statement_timestamp())
  order by (case when property_id = p_property_id then 1 else 2 end), policy_version desc
  limit 1;

  if v_policy.id is null then
    raise exception 'governance_policy_unconfigured' using errcode = 'P0001';
  end if;

  v_rec_date := coalesce(p_record_date, statement_timestamp());

  insert into governance.meetings(
    tenant_id, property_id, title, meeting_type, scheduled_at,
    location_text, remote_join_url, status, quorum_rule,
    policy_id, policy_snapshot, description, venue,
    first_call, record_date, created_by, created_at
  ) values (
    v_actor.tenant_id, p_property_id, p_title, p_meeting_type, p_scheduled_at,
    p_location_text, p_remote_join_url, 'draft', v_policy.quorum_rule,
    v_policy.id, to_jsonb(v_policy), p_description, p_venue,
    true, v_rec_date, v_actor.actor_id, statement_timestamp()
  ) returning * into v_meeting;

  insert into governance.meeting_history(
    tenant_id, meeting_id, event_type, status_from, status_to, reason, rule_version, occurred_at
  ) values (
    v_actor.tenant_id, v_meeting.id, 'meeting_created', null, 'draft', 'Meeting draft created', 1, statement_timestamp()
  );

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'create_meeting', 'meeting',
    v_meeting.id, to_jsonb(v_meeting), statement_timestamp()
  );

  return v_meeting;
end;
$$;

revoke all on function governance.create_meeting(uuid, uuid, text, text, timestamptz, text, text, text, text, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Domain RPC: Add Agenda Item
-- ----------------------------------------------------------------------------
create or replace function governance.add_agenda_item(
  p_context_id uuid,
  p_meeting_id uuid,
  p_sequence_no integer,
  p_title text,
  p_description text default null,
  p_item_type text default 'discussion',
  p_voting_required boolean default false,
  p_proposed_amount numeric default null,
  p_currency text default 'RON'
)
returns governance.agenda_items
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_agenda governance.agenda_items;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.agenda.manage', true);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id
  for update;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  if v_meeting.status <> 'draft' then
    raise exception 'agenda_items_require_draft_meeting' using errcode = '42501';
  end if;

  if p_sequence_no <= 0 or trim(p_title) = '' then
    raise exception 'invalid_agenda_item' using errcode = '22023';
  end if;

  insert into governance.agenda_items(
    tenant_id, meeting_id, sequence_no, title, description,
    decision_required, item_type, voting_required,
    proposed_amount, currency, status, created_at
  ) values (
    v_actor.tenant_id, p_meeting_id, p_sequence_no, p_title, p_description,
    p_voting_required, p_item_type, p_voting_required,
    p_proposed_amount, case when p_proposed_amount is not null then p_currency else null end,
    'draft', statement_timestamp()
  ) returning * into v_agenda;

  return v_agenda;
end;
$$;

revoke all on function governance.add_agenda_item(uuid, uuid, integer, text, text, text, boolean, numeric, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Domain RPC: Publish Meeting & Snapshot Electorate (Draft -> Announced)
-- ----------------------------------------------------------------------------
create or replace function governance.publish_meeting(
  p_context_id uuid,
  p_meeting_id uuid
)
returns governance.meetings
language plpgsql security definer set search_path=pg_catalog,governance,portfolio,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_policy governance.governance_policies;
  v_min_notice interval;
  v_own record;
  v_weight numeric;
  v_total_units numeric;
  v_electorate_count integer := 0;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id
  for update;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  if v_meeting.status <> 'draft' then
    raise exception 'meeting_must_be_draft_to_publish' using errcode = '42501';
  end if;

  select * into v_policy from governance.governance_policies
  where id = v_meeting.policy_id;

  if v_policy.id is null then
    raise exception 'governance_policy_unconfigured' using errcode = 'P0001';
  end if;

  v_min_notice := (v_policy.notice_period_days || ' days')::interval;
  if v_meeting.scheduled_at < statement_timestamp() + v_min_notice then
    raise exception 'notice_period_below_statutory_minimum' using errcode = '22023';
  end if;

  if not exists (select 1 from governance.agenda_items where meeting_id = v_meeting.id) then
    raise exception 'meeting_requires_agenda_to_publish' using errcode = '22023';
  end if;

  -- Create frozen Electorate Snapshot from current ownerships
  select count(distinct u.id) into v_total_units
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where b.property_id = v_meeting.property_id and u.tenant_id = v_meeting.tenant_id;

  for v_own in
    select o.id as ownership_id, o.unit_id, o.party_id, o.share
    from portfolio.ownerships o
    join portfolio.units u on u.id = o.unit_id
    join portfolio.buildings b on b.id = u.building_id
    where b.property_id = v_meeting.property_id
      and o.tenant_id = v_meeting.tenant_id
      and o.valid_from <= current_date
      and (o.valid_to is null or o.valid_to > current_date)
  loop
    v_weight := case
      when v_policy.voting_basis = 'unit' then (v_own.share / nullif(v_total_units, 0))
      when v_policy.voting_basis = 'owner' then (1.0 / nullif(v_total_units, 0))
      else v_own.share
    end;

    insert into governance.eligibility_snapshots(
      tenant_id, meeting_id, unit_id, party_id, ownership_share,
      voting_weight, eligible, snapshot_json, source_ownership_id, created_at
    ) values (
      v_meeting.tenant_id, v_meeting.id, v_own.unit_id, v_own.party_id,
      v_own.share, v_weight, true,
      jsonb_build_object('ownership_id', v_own.ownership_id, 'basis', v_policy.voting_basis, 'frozen_at', statement_timestamp()),
      v_own.ownership_id, statement_timestamp()
    ) on conflict (meeting_id, unit_id, party_id) do nothing;

    v_electorate_count := v_electorate_count + 1;
  end loop;

  update governance.meetings
  set status = 'announced',
      announced_at = statement_timestamp(),
      published_by = v_actor.actor_id,
      published_at = statement_timestamp(),
      tenant_visible = true,
      updated_at = statement_timestamp()
  where id = v_meeting.id
  returning * into v_meeting;

  insert into governance.meeting_history(
    tenant_id, meeting_id, event_type, status_from, status_to, reason, rule_version, occurred_at
  ) values (
    v_actor.tenant_id, v_meeting.id, 'meeting_published', 'draft', 'announced',
    'Meeting published with ' || v_electorate_count || ' eligible voters snapshotted', 1, statement_timestamp()
  );

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'publish_meeting', 'meeting',
    v_meeting.id, to_jsonb(v_meeting), statement_timestamp()
  );

  return v_meeting;
end;
$$;

revoke all on function governance.publish_meeting(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Domain RPC: Register Attendance
-- ----------------------------------------------------------------------------
create or replace function governance.register_attendance(
  p_context_id uuid,
  p_meeting_id uuid,
  p_eligibility_id uuid,
  p_attendance_mode text default 'in_person',
  p_represented_by_party_id uuid default null
)
returns governance.attendance
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_eligibility governance.eligibility_snapshots;
  v_att governance.attendance;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.attendance.manage', false);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  if v_meeting.status not in ('announced', 'open') then
    raise exception 'attendance_requires_announced_or_open_meeting' using errcode = '42501';
  end if;

  select * into v_eligibility from governance.eligibility_snapshots
  where id = p_eligibility_id and meeting_id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_eligibility.id is null or not v_eligibility.eligible then
    raise exception 'ineligible_voter_for_meeting' using errcode = '42501';
  end if;

  insert into governance.attendance(
    tenant_id, meeting_id, eligibility_id, represented_by_party_id,
    attendance_mode, checked_in_at, participant_user_id
  ) values (
    v_actor.tenant_id, p_meeting_id, p_eligibility_id, p_represented_by_party_id,
    p_attendance_mode, statement_timestamp(), v_actor.actor_id
  ) on conflict (meeting_id, eligibility_id) do update
    set attendance_mode = excluded.attendance_mode,
        represented_by_party_id = excluded.represented_by_party_id,
        checked_in_at = statement_timestamp()
  returning * into v_att;

  return v_att;
end;
$$;

revoke all on function governance.register_attendance(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Domain RPC: Register & Verify Proxy (Statutory Limit: max 1 proxy per member)
-- ----------------------------------------------------------------------------
create or replace function governance.register_proxy(
  p_context_id uuid,
  p_meeting_id uuid,
  p_eligibility_id uuid,
  p_representative_party_id uuid,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns governance.proxies
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_eligibility governance.eligibility_snapshots;
  v_policy governance.governance_policies;
  v_active_proxies integer;
  v_proxy governance.proxies;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.proxies.manage', false);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  select * into v_policy from governance.governance_policies where id = v_meeting.policy_id;

  select * into v_eligibility from governance.eligibility_snapshots
  where id = p_eligibility_id and meeting_id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_eligibility.id is null or not v_eligibility.eligible then
    raise exception 'ineligible_entitlement' using errcode = '42501';
  end if;

  if v_eligibility.party_id = p_representative_party_id then
    raise exception 'grantor_and_representative_must_differ' using errcode = '22023';
  end if;

  -- Statutory limit: Legea 196/2018 Art. 47 alin. (2) lit. e: A member can represent at most 1 other member
  select count(*) into v_active_proxies
  from governance.proxies
  where meeting_id = p_meeting_id
    and representative_party_id = p_representative_party_id
    and status = 'active';

  if v_active_proxies >= 1 then
    raise exception 'proxy_representative_limit_exceeded' using errcode = '22023';
  end if;

  insert into governance.proxies(
    tenant_id, meeting_id, eligibility_id, grantor_party_id,
    representative_party_id, valid_from, valid_until, status,
    verification_status, verified_by, verified_at, created_at
  ) values (
    v_actor.tenant_id, p_meeting_id, p_eligibility_id, v_eligibility.party_id,
    p_representative_party_id, p_valid_from, p_valid_until, 'active',
    'verified', v_actor.actor_id, statement_timestamp(), statement_timestamp()
  ) returning * into v_proxy;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'register_proxy', 'proxy',
    v_proxy.id, to_jsonb(v_proxy), statement_timestamp()
  );

  return v_proxy;
end;
$$;

revoke all on function governance.register_proxy(uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. Domain RPC: Calculate Quorum
-- ----------------------------------------------------------------------------
create or replace function governance.calculate_quorum(
  p_context_id uuid,
  p_meeting_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,governance as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_eligible_weight numeric := 0;
  v_represented_weight numeric := 0;
  v_percent numeric := 0;
  v_threshold numeric := 0.5000000001;
  v_quorum_met boolean := false;
  v_is_reconvened boolean := false;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.read', false);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  v_is_reconvened := not coalesce(v_meeting.first_call, true);

  select
    coalesce(sum(e.voting_weight) filter (where e.eligible), 0),
    coalesce(sum(e.voting_weight) filter (where e.eligible and a.id is not null), 0)
  into v_eligible_weight, v_represented_weight
  from governance.eligibility_snapshots e
  left join governance.attendance a on a.meeting_id = v_meeting.id and a.eligibility_id = e.id
  where e.meeting_id = v_meeting.id and e.tenant_id = v_meeting.tenant_id;

  if v_eligible_weight > 0 then
    v_percent := round((v_represented_weight / v_eligible_weight) * 100, 4);
  end if;

  if v_is_reconvened then
    -- Under Legea 196/2018 Art. 48 alin. (5): Reconvened meeting is legally convened regardless of attendance
    v_quorum_met := (v_represented_weight > 0);
  else
    v_threshold := coalesce((v_meeting.quorum_rule->>'threshold')::numeric, 0.5000000001);
    v_quorum_met := (v_eligible_weight > 0 and (v_represented_weight / v_eligible_weight) >= v_threshold);
  end if;

  return jsonb_build_object(
    'meeting_id', v_meeting.id,
    'first_call', v_meeting.first_call,
    'eligible_weight', v_eligible_weight,
    'represented_weight', v_represented_weight,
    'quorum_percent', v_percent,
    'quorum_met', v_quorum_met,
    'calculated_at', statement_timestamp()
  );
end;
$$;

revoke all on function governance.calculate_quorum(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12. Domain RPC: Open Meeting & Open Ballot
-- ----------------------------------------------------------------------------
create or replace function governance.open_meeting(
  p_context_id uuid,
  p_meeting_id uuid
)
returns governance.meetings
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id
  for update;

  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = '42704';
  end if;

  if v_meeting.status <> 'announced' then
    raise exception 'meeting_must_be_announced_to_open' using errcode = '42501';
  end if;

  update governance.meetings
  set status = 'open',
      opened_at = statement_timestamp(),
      opened_by = v_actor.actor_id,
      updated_at = statement_timestamp()
  where id = v_meeting.id
  returning * into v_meeting;

  insert into governance.meeting_history(
    tenant_id, meeting_id, event_type, status_from, status_to, reason, rule_version, occurred_at
  ) values (
    v_actor.tenant_id, v_meeting.id, 'meeting_opened', 'announced', 'open',
    'Meeting opened by authorized actor', 1, statement_timestamp()
  );

  return v_meeting;
end;
$$;

revoke all on function governance.open_meeting(uuid, uuid) from public, anon, authenticated;

create or replace function governance.open_ballot(
  p_context_id uuid,
  p_agenda_item_id uuid,
  p_question text,
  p_secret_ballot boolean default false
)
returns governance.votes
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_agenda governance.agenda_items;
  v_meeting governance.meetings;
  v_vote governance.votes;
  v_opt_for uuid;
  v_opt_against uuid;
  v_opt_abstain uuid;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.votes.administer', true);

  select * into v_agenda from governance.agenda_items where id = p_agenda_item_id and tenant_id = v_actor.tenant_id;
  if v_agenda.id is null then raise exception 'agenda_item_not_found' using errcode = '42704'; end if;

  select * into v_meeting from governance.meetings where id = v_agenda.meeting_id and tenant_id = v_actor.tenant_id for update;
  if v_meeting.status <> 'open' then raise exception 'meeting_must_be_open_to_open_ballot' using errcode = '42501'; end if;

  -- Create vote in draft
  insert into governance.votes(
    tenant_id, meeting_id, agenda_item_id, question,
    status, voting_method, opens_at, secret_ballot, rule_version, created_at
  ) values (
    v_actor.tenant_id, v_meeting.id, v_agenda.id, p_question,
    'draft', 'weighted', statement_timestamp(), p_secret_ballot, 1, statement_timestamp()
  ) returning * into v_vote;

  -- Standard options: For, Against, Abstain
  insert into governance.vote_options(tenant_id, vote_id, code, label, sequence_no)
  values (v_actor.tenant_id, v_vote.id, 'for', 'Pentru (For)', 1) returning id into v_opt_for;

  insert into governance.vote_options(tenant_id, vote_id, code, label, sequence_no)
  values (v_actor.tenant_id, v_vote.id, 'against', 'Împotrivă (Against)', 2) returning id into v_opt_against;

  insert into governance.vote_options(tenant_id, vote_id, code, label, sequence_no)
  values (v_actor.tenant_id, v_vote.id, 'abstain', 'Abținere (Abstain)', 3) returning id into v_opt_abstain;

  -- Open vote
  update governance.votes
  set status = 'open',
      opens_at = statement_timestamp()
  where id = v_vote.id
  returning * into v_vote;

  return v_vote;
end;
$$;

revoke all on function governance.open_ballot(uuid, uuid, text, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 13. Domain RPC: Cast Vote (Idempotent, Server-Side Weight, Confidential)
-- ----------------------------------------------------------------------------
create or replace function governance.cast_vote(
  p_context_id uuid,
  p_vote_id uuid,
  p_eligibility_id uuid,
  p_choice text,
  p_idempotency_key text default null
)
returns governance.ballots
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_vote governance.votes;
  v_eligibility governance.eligibility_snapshots;
  v_opt governance.vote_options;
  v_ballot governance.ballots;
  v_receipt text;
  v_party_match boolean := false;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.votes.cast', false);

  if p_choice not in ('for', 'against', 'abstain') then
    raise exception 'invalid_ballot_choice' using errcode = '22023';
  end if;

  select * into v_vote from governance.votes
  where id = p_vote_id and tenant_id = v_actor.tenant_id
  for update;

  if v_vote.id is null or v_vote.status <> 'open' then
    raise exception 'ballot_not_open' using errcode = '42501';
  end if;

  select * into v_eligibility from governance.eligibility_snapshots
  where id = p_eligibility_id and meeting_id = v_vote.meeting_id and tenant_id = v_actor.tenant_id;

  if v_eligibility.id is null or not v_eligibility.eligible then
    raise exception 'ineligible_voter' using errcode = '42501';
  end if;

  -- Verify voter entitlement: direct owner OR verified proxy
  if v_eligibility.party_id = v_actor.party_id then
    v_party_match := true;
  else
    if exists (
      select 1 from governance.proxies p
      where p.meeting_id = v_vote.meeting_id
        and p.eligibility_id = p_eligibility_id
        and p.representative_party_id = v_actor.party_id
        and p.status = 'active'
        and p.valid_from <= statement_timestamp()
        and p.valid_until > statement_timestamp()
    ) then
      v_party_match := true;
    end if;
  end if;

  if not v_party_match and lower(v_actor.role_code) not in ('association_admin') then
    raise exception 'voter_entitlement_mismatch' using errcode = '42501';
  end if;

  -- Check if already voted
  if exists (select 1 from governance.ballots where vote_id = p_vote_id and eligibility_id = p_eligibility_id) then
    raise exception 'duplicate_vote_rejected' using errcode = '23505';
  end if;

  select * into v_opt from governance.vote_options
  where vote_id = p_vote_id and code = p_choice and tenant_id = v_actor.tenant_id;

  if v_opt.id is null then
    raise exception 'vote_option_not_found' using errcode = '42704';
  end if;

  v_receipt := encode(digest(p_vote_id::text || ':' || p_eligibility_id::text || ':' || coalesce(p_idempotency_key, gen_random_uuid()::text), 'sha256'), 'hex');

  insert into governance.ballots(
    tenant_id, vote_id, eligibility_id, option_id,
    voting_weight, cast_by, cast_at, receipt_hash,
    choice, source, idempotency_key, represented_party_id
  ) values (
    v_actor.tenant_id, p_vote_id, p_eligibility_id, v_opt.id,
    v_eligibility.voting_weight, v_actor.actor_id, statement_timestamp(), v_receipt,
    p_choice, 'remote', p_idempotency_key, v_eligibility.party_id
  ) returning * into v_ballot;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'cast_vote', 'ballot',
    v_ballot.id,
    -- For secret ballots: do not leak choice or voter in audit payload
    case when v_vote.secret_ballot then jsonb_build_object('vote_id', p_vote_id, 'receipt', v_receipt, 'secret_ballot', true)
         else jsonb_build_object('vote_id', p_vote_id, 'eligibility_id', p_eligibility_id, 'choice', p_choice) end,
    statement_timestamp()
  );

  return v_ballot;
end;
$$;

revoke all on function governance.cast_vote(uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 14. Domain RPC: Close Ballot & Tally
-- ----------------------------------------------------------------------------
create or replace function governance.close_ballot(
  p_context_id uuid,
  p_vote_id uuid
)
returns governance.votes
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_vote governance.votes;
  v_for numeric := 0;
  v_against numeric := 0;
  v_abstain numeric := 0;
  v_cast numeric := 0;
  v_eligible numeric := 0;
  v_snapshot jsonb;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.votes.administer', true);

  select * into v_vote from governance.votes
  where id = p_vote_id and tenant_id = v_actor.tenant_id
  for update;

  if v_vote.id is null or v_vote.status <> 'open' then
    raise exception 'ballot_not_open_to_close' using errcode = '42501';
  end if;

  select coalesce(sum(e.voting_weight) filter (where e.eligible), 0) into v_eligible
  from governance.eligibility_snapshots e
  where e.meeting_id = v_vote.meeting_id and e.tenant_id = v_actor.tenant_id;

  select
    coalesce(sum(b.voting_weight) filter (where o.code = 'for'), 0),
    coalesce(sum(b.voting_weight) filter (where o.code = 'against'), 0),
    coalesce(sum(b.voting_weight) filter (where o.code = 'abstain'), 0),
    coalesce(sum(b.voting_weight), 0)
  into v_for, v_against, v_abstain, v_cast
  from governance.ballots b
  join governance.vote_options o on o.id = b.option_id
  where b.vote_id = v_vote.id and b.tenant_id = v_actor.tenant_id;

  v_snapshot := jsonb_build_object(
    'eligible_weight', v_eligible,
    'cast_weight', v_cast,
    'for_weight', v_for,
    'against_weight', v_against,
    'abstain_weight', v_abstain,
    'closed_at', statement_timestamp()
  );

  update governance.votes
  set status = 'closed',
      closes_at = statement_timestamp(),
      eligible_weight = v_eligible,
      cast_weight = v_cast,
      for_weight = v_for,
      against_weight = v_against,
      abstain_weight = v_abstain,
      result_snapshot = v_snapshot
  where id = v_vote.id
  returning * into v_vote;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'close_ballot', 'vote',
    v_vote.id, v_snapshot, statement_timestamp()
  );

  return v_vote;
end;
$$;

revoke all on function governance.close_ballot(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 15. Domain RPC: Adopt Resolution
-- ----------------------------------------------------------------------------
create or replace function governance.adopt_resolution(
  p_context_id uuid,
  p_meeting_id uuid,
  p_agenda_item_id uuid,
  p_resolution_no text,
  p_title text,
  p_text_body text,
  p_responsible_actor text default null,
  p_due_date date default null,
  p_financial_impact numeric default null,
  p_maintenance_work_order_id uuid default null
)
returns governance.resolutions
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_vote governance.votes;
  v_adopted boolean := false;
  v_res governance.resolutions;
  v_result jsonb;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.resolutions.manage', true);

  select * into v_meeting from governance.meetings where id = p_meeting_id and tenant_id = v_actor.tenant_id;
  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;

  select * into v_vote from governance.votes where agenda_item_id = p_agenda_item_id and tenant_id = v_actor.tenant_id;
  if v_vote.id is null or v_vote.status <> 'closed' then
    raise exception 'resolution_requires_closed_vote' using errcode = '42501';
  end if;

  -- Deterministic adoption rule: For > Against
  v_adopted := (coalesce(v_vote.for_weight, 0) > coalesce(v_vote.against_weight, 0));

  v_result := jsonb_build_object(
    'adopted', v_adopted,
    'for_weight', v_vote.for_weight,
    'against_weight', v_vote.against_weight,
    'abstain_weight', v_vote.abstain_weight,
    'cast_weight', v_vote.cast_weight,
    'eligible_weight', v_vote.eligible_weight
  );

  insert into governance.resolutions(
    tenant_id, meeting_id, agenda_item_id, resolution_no,
    title, text_body, adopted, result_snapshot,
    effective_on, responsible_actor, due_date, execution_status,
    financial_impact, currency, maintenance_work_order_id,
    vote_totals, created_at, tenant_visible
  ) values (
    v_actor.tenant_id, p_meeting_id, p_agenda_item_id, p_resolution_no,
    p_title, p_text_body, v_adopted, v_result,
    current_date, p_responsible_actor, p_due_date, 'pending',
    p_financial_impact, case when p_financial_impact is not null then 'RON' else null end,
    p_maintenance_work_order_id, v_result, statement_timestamp(), true
  ) returning * into v_res;

  if p_responsible_actor is not null or p_due_date is not null then
    insert into governance.resolution_actions(
      tenant_id, resolution_id, action_title, description,
      responsible_actor, due_date, execution_status
    ) values (
      v_actor.tenant_id, v_res.id, 'Implement: ' || p_title, p_text_body,
      p_responsible_actor, p_due_date, 'pending'
    );
  end if;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'adopt_resolution', 'resolution',
    v_res.id, to_jsonb(v_res), statement_timestamp()
  );

  return v_res;
end;
$$;

revoke all on function governance.adopt_resolution(uuid, uuid, uuid, text, text, text, text, date, numeric, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 16. Domain RPC: Complete Meeting
-- ----------------------------------------------------------------------------
create or replace function governance.complete_meeting(
  p_context_id uuid,
  p_meeting_id uuid
)
returns governance.meetings
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.meetings.manage', true);

  select * into v_meeting from governance.meetings
  where id = p_meeting_id and tenant_id = v_actor.tenant_id
  for update;

  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;
  if v_meeting.status not in ('announced', 'open') then raise exception 'meeting_not_active' using errcode = '42501'; end if;

  update governance.meetings
  set status = 'closed',
      closed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = v_meeting.id
  returning * into v_meeting;

  insert into governance.meeting_history(
    tenant_id, meeting_id, event_type, status_from, status_to, reason, rule_version, occurred_at
  ) values (
    v_actor.tenant_id, v_meeting.id, 'meeting_completed', 'open', 'closed', 'Meeting completed successfully', 1, statement_timestamp()
  );

  return v_meeting;
end;
$$;

revoke all on function governance.complete_meeting(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 17. Domain RPC: Finalize Minutes & Versioned Corrections
-- ----------------------------------------------------------------------------
create or replace function governance.finalize_minutes(
  p_context_id uuid,
  p_meeting_id uuid,
  p_content_json jsonb
)
returns governance.minutes
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_meeting governance.meetings;
  v_min governance.minutes;
  v_sha text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.minutes.finalize', true);

  select * into v_meeting from governance.meetings where id = p_meeting_id and tenant_id = v_actor.tenant_id;
  if v_meeting.id is null then raise exception 'meeting_not_found' using errcode = '42704'; end if;

  v_sha := encode(digest(p_content_json::text, 'sha256'), 'hex');

  insert into governance.minutes(
    tenant_id, meeting_id, version, content_json,
    sha256, approved_at, approved_by, finalized_at, finalized_by,
    created_at, tenant_visible
  ) values (
    v_actor.tenant_id, p_meeting_id, 1, p_content_json,
    v_sha, statement_timestamp(), v_actor.actor_id, statement_timestamp(), v_actor.actor_id,
    statement_timestamp(), true
  ) returning * into v_min;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'finalize_minutes', 'minutes',
    v_min.id, to_jsonb(v_min), statement_timestamp()
  );

  return v_min;
end;
$$;

revoke all on function governance.finalize_minutes(uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function governance.create_minutes_correction(
  p_context_id uuid,
  p_prior_minutes_id uuid,
  p_correction_reason text,
  p_content_json jsonb
)
returns governance.minutes
language plpgsql security definer set search_path=pg_catalog,governance,audit as $$
declare
  v_actor record;
  v_prior governance.minutes;
  v_new_min governance.minutes;
  v_next_version integer;
  v_sha text;
begin
  select * into v_actor from governance.resolve_governance_actor(p_context_id, 'governance.minutes.finalize', true);

  select * into v_prior from governance.minutes where id = p_prior_minutes_id and tenant_id = v_actor.tenant_id;
  if v_prior.id is null then raise exception 'prior_minutes_not_found' using errcode = '42704'; end if;

  if trim(p_correction_reason) = '' then
    raise exception 'correction_reason_required' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from governance.minutes where meeting_id = v_prior.meeting_id and tenant_id = v_actor.tenant_id;

  v_sha := encode(digest(p_content_json::text, 'sha256'), 'hex');

  insert into governance.minutes(
    tenant_id, meeting_id, version, content_json,
    sha256, approved_at, approved_by, finalized_at, finalized_by,
    prior_version_id, correction_reason, created_at, tenant_visible
  ) values (
    v_actor.tenant_id, v_prior.meeting_id, v_next_version, p_content_json,
    v_sha, statement_timestamp(), v_actor.actor_id, statement_timestamp(), v_actor.actor_id,
    v_prior.id, p_correction_reason, statement_timestamp(), true
  ) returning * into v_new_min;

  insert into audit.events(
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id, v_actor.actor_id, v_actor.role_code, 'create_minutes_correction', 'minutes',
    v_new_min.id, to_jsonb(v_new_min), statement_timestamp()
  );

  return v_new_min;
end;
$$;

revoke all on function governance.create_minutes_correction(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 18. Customer API Gateway Wrappers (SECURITY INVOKER, authenticated only)
-- ----------------------------------------------------------------------------

create or replace function customer_api.create_governance_policy_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_name text,
  p_voting_basis text default 'ownership_share',
  p_notice_period_days integer default 10,
  p_quorum_threshold numeric default 0.5000000001
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.create_governance_policy(
    p_context_id, p_property_id, p_name, p_voting_basis, p_notice_period_days, p_quorum_threshold
  ));
end;
$$;

create or replace function customer_api.create_meeting_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_title text,
  p_meeting_type text,
  p_scheduled_at timestamptz,
  p_location_text text default null,
  p_remote_join_url text default null,
  p_description text default null,
  p_venue text default null,
  p_record_date timestamptz default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.create_meeting(
    p_context_id, p_property_id, p_title, p_meeting_type, p_scheduled_at,
    p_location_text, p_remote_join_url, p_description, p_venue, p_record_date
  ));
end;
$$;

create or replace function customer_api.add_agenda_item_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_sequence_no integer,
  p_title text,
  p_description text default null,
  p_item_type text default 'discussion',
  p_voting_required boolean default false,
  p_proposed_amount numeric default null,
  p_currency text default 'RON'
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.add_agenda_item(
    p_context_id, p_meeting_id, p_sequence_no, p_title, p_description,
    p_item_type, p_voting_required, p_proposed_amount, p_currency
  ));
end;
$$;

create or replace function customer_api.publish_meeting_v1(
  p_context_id uuid,
  p_meeting_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.publish_meeting(p_context_id, p_meeting_id));
end;
$$;

create or replace function customer_api.register_attendance_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_eligibility_id uuid,
  p_attendance_mode text default 'in_person',
  p_represented_by_party_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.register_attendance(
    p_context_id, p_meeting_id, p_eligibility_id, p_attendance_mode, p_represented_by_party_id
  ));
end;
$$;

create or replace function customer_api.register_proxy_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_eligibility_id uuid,
  p_representative_party_id uuid,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.register_proxy(
    p_context_id, p_meeting_id, p_eligibility_id, p_representative_party_id, p_valid_from, p_valid_until
  ));
end;
$$;

create or replace function customer_api.calculate_quorum_v1(
  p_context_id uuid,
  p_meeting_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return governance.calculate_quorum(p_context_id, p_meeting_id);
end;
$$;

create or replace function customer_api.open_meeting_v1(
  p_context_id uuid,
  p_meeting_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.open_meeting(p_context_id, p_meeting_id));
end;
$$;

create or replace function customer_api.open_ballot_v1(
  p_context_id uuid,
  p_agenda_item_id uuid,
  p_question text,
  p_secret_ballot boolean default false
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.open_ballot(p_context_id, p_agenda_item_id, p_question, p_secret_ballot));
end;
$$;

create or replace function customer_api.cast_vote_v1(
  p_context_id uuid,
  p_vote_id uuid,
  p_eligibility_id uuid,
  p_choice text,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.cast_vote(p_context_id, p_vote_id, p_eligibility_id, p_choice, p_idempotency_key));
end;
$$;

create or replace function customer_api.close_ballot_v1(
  p_context_id uuid,
  p_vote_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.close_ballot(p_context_id, p_vote_id));
end;
$$;

create or replace function customer_api.adopt_resolution_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_agenda_item_id uuid,
  p_resolution_no text,
  p_title text,
  p_text_body text,
  p_responsible_actor text default null,
  p_due_date date default null,
  p_financial_impact numeric default null,
  p_maintenance_work_order_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.adopt_resolution(
    p_context_id, p_meeting_id, p_agenda_item_id, p_resolution_no,
    p_title, p_text_body, p_responsible_actor, p_due_date,
    p_financial_impact, p_maintenance_work_order_id
  ));
end;
$$;

create or replace function customer_api.complete_meeting_v1(
  p_context_id uuid,
  p_meeting_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.complete_meeting(p_context_id, p_meeting_id));
end;
$$;

create or replace function customer_api.finalize_minutes_v1(
  p_context_id uuid,
  p_meeting_id uuid,
  p_content_json jsonb
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.finalize_minutes(p_context_id, p_meeting_id, p_content_json));
end;
$$;

create or replace function customer_api.create_minutes_correction_v1(
  p_context_id uuid,
  p_prior_minutes_id uuid,
  p_correction_reason text,
  p_content_json jsonb
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return to_jsonb(governance.create_minutes_correction(p_context_id, p_prior_minutes_id, p_correction_reason, p_content_json));
end;
$$;

-- Grant execution privileges on customer_api wrappers to authenticated
grant execute on function customer_api.create_governance_policy_v1(uuid, uuid, text, text, integer, numeric) to authenticated;
grant execute on function customer_api.create_meeting_v1(uuid, uuid, text, text, timestamptz, text, text, text, text, timestamptz) to authenticated;
grant execute on function customer_api.add_agenda_item_v1(uuid, uuid, integer, text, text, text, boolean, numeric, text) to authenticated;
grant execute on function customer_api.publish_meeting_v1(uuid, uuid) to authenticated;
grant execute on function customer_api.register_attendance_v1(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function customer_api.register_proxy_v1(uuid, uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function customer_api.calculate_quorum_v1(uuid, uuid) to authenticated;
grant execute on function customer_api.open_meeting_v1(uuid, uuid) to authenticated;
grant execute on function customer_api.open_ballot_v1(uuid, uuid, text, boolean) to authenticated;
grant execute on function customer_api.cast_vote_v1(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function customer_api.close_ballot_v1(uuid, uuid) to authenticated;
grant execute on function customer_api.adopt_resolution_v1(uuid, uuid, uuid, text, text, text, text, date, numeric, uuid) to authenticated;
grant execute on function customer_api.complete_meeting_v1(uuid, uuid) to authenticated;
grant execute on function customer_api.finalize_minutes_v1(uuid, uuid, jsonb) to authenticated;
grant execute on function customer_api.create_minutes_correction_v1(uuid, uuid, text, jsonb) to authenticated;

revoke all on function customer_api.create_governance_policy_v1(uuid, uuid, text, text, integer, numeric) from public, anon;
revoke all on function customer_api.create_meeting_v1(uuid, uuid, text, text, timestamptz, text, text, text, text, timestamptz) from public, anon;
revoke all on function customer_api.add_agenda_item_v1(uuid, uuid, integer, text, text, text, boolean, numeric, text) from public, anon;
revoke all on function customer_api.publish_meeting_v1(uuid, uuid) from public, anon;
revoke all on function customer_api.register_attendance_v1(uuid, uuid, uuid, text, uuid) from public, anon;
revoke all on function customer_api.register_proxy_v1(uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke all on function customer_api.calculate_quorum_v1(uuid, uuid) from public, anon;
revoke all on function customer_api.open_meeting_v1(uuid, uuid) from public, anon;
revoke all on function customer_api.open_ballot_v1(uuid, uuid, text, boolean) from public, anon;
revoke all on function customer_api.cast_vote_v1(uuid, uuid, uuid, text, text) from public, anon;
revoke all on function customer_api.close_ballot_v1(uuid, uuid) from public, anon;
revoke all on function customer_api.adopt_resolution_v1(uuid, uuid, uuid, text, text, text, text, date, numeric, uuid) from public, anon;
revoke all on function customer_api.complete_meeting_v1(uuid, uuid) from public, anon;
revoke all on function customer_api.finalize_minutes_v1(uuid, uuid, jsonb) from public, anon;
revoke all on function customer_api.create_minutes_correction_v1(uuid, uuid, text, jsonb) from public, anon;

commit;
