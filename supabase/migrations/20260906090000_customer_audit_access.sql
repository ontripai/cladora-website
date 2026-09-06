begin;

-- 1. Create audit.events.read permission in identity schema
insert into identity.permissions(code, resource, action, description)
values ('audit.events.read', 'audit.events', 'read', 'Read scoped customer audit trail events')
on conflict(code) do update set resource = excluded.resource, action = excluded.action, description = excluded.description;

-- 2. Grant audit.events.read permission strictly to authorized management and oversight roles
-- Strictly exclude resident and owner roles: owner, tenant_resident
insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager', 'president', 'censor')
  and p.code = 'audit.events.read'
on conflict(role_id, permission_id) do update set effect = 'allow';

-- 3. Create customer audit query RPC in audit schema
create or replace function audit.get_customer_events(
  p_context_id uuid,
  p_limit integer default 25,
  p_offset integer default 0,
  p_query text default null,
  p_action text default null,
  p_from timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, audit, identity, platform, portfolio, maintenance, billing, governance, utilities, security_access, app_private
as $$
declare
  v record;
  v_workspace uuid;
  v_total bigint;
  v_rows jsonb;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Customer MFA policy enforcement
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Pagination bounds validation (1..100, offset >= 0)
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;

  -- 4. Date range validation
  if p_from is not null and p_until is not null and p_from > p_until then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;

  -- 5. Active context and membership resolution with time bounds
  select g.*, m.id as membership_key, m.role_id, r.code as role_code, r.name as role_name, t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 6. Role gating: Allowed ONLY for association_admin, property_manager, president, censor
  if lower(v.role_code) not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'audit_role_denied' using errcode = '42501';
  end if;

  -- 7. Explicit permission verification: audit.events.read
  if not exists (
    select 1
    from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id
      and rp.effect = 'allow'
      and p.code = 'audit.events.read'
  ) then
    raise exception 'audit_permission_required' using errcode = '42501';
  end if;

  -- 8. Customer workspace must be in ACTIVE status
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id
    and w.lifecycle_status = 'ACTIVE'
  order by w.id
  limit 1;

  if v_workspace is null then
    raise exception 'active_workspace_required' using errcode = '42501';
  end if;

  -- 9. Query scoped audit events with tenant isolation, context scoping, redaction, and no snapshots/raw actor IDs
  with resolved as (
    select
      e.id,
      e.action,
      coalesce(e.actor_role, 'authorized_member') as actor_role,
      e.entity_type,
      e.entity_id,
      app_private.redact_audit_text(e.reason) as reason,
      e.occurred_at,
      count(*) over() as total_count
    from audit.events e
    where e.tenant_id = v.tenant_id
      -- Context scope filtering: property / building / unit
      and (
        v.scope_type = 'tenant'
        or (
          v.scope_type = 'property' and (
            coalesce(
              app_private.try_uuid(coalesce(e.after_snapshot, e.before_snapshot)->>'property_id'),
              case
                when e.entity_type in ('portfolio.property', 'property') then e.entity_id
                when e.entity_type in ('portfolio.building', 'building') then (select b.property_id from portfolio.buildings b where b.id = e.entity_id and b.tenant_id = v.tenant_id)
                when e.entity_type in ('portfolio.unit', 'unit') then (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = e.entity_id and u.tenant_id = v.tenant_id)
                when e.entity_type in ('maintenance.work_order', 'work_order') then (select wo.property_id from maintenance.work_orders wo where wo.id = e.entity_id and wo.tenant_id = v.tenant_id)
                when e.entity_type in ('billing.invoice', 'invoice') then (select inv.property_id from billing.invoices inv where inv.id = e.entity_id and inv.tenant_id = v.tenant_id)
                when e.entity_type in ('governance.meeting', 'meeting') then (select m.property_id from governance.meetings m where m.id = e.entity_id and m.tenant_id = v.tenant_id)
                when e.entity_type in ('utilities.meter', 'meter') then (select met.property_id from utilities.meters met where met.id = e.entity_id and met.tenant_id = v.tenant_id)
                else null
              end
            ) = v.property_id
          )
        )
        or (
          v.scope_type = 'building' and (
            coalesce(
              app_private.try_uuid(coalesce(e.after_snapshot, e.before_snapshot)->>'building_id'),
              case
                when e.entity_type in ('portfolio.building', 'building') then e.entity_id
                when e.entity_type in ('portfolio.unit', 'unit') then (select u.building_id from portfolio.units u where u.id = e.entity_id and u.tenant_id = v.tenant_id)
                when e.entity_type in ('maintenance.work_order', 'work_order') then (select wo.building_id from maintenance.work_orders wo where wo.id = e.entity_id and wo.tenant_id = v.tenant_id)
                when e.entity_type in ('utilities.meter', 'meter') then (select met.building_id from utilities.meters met where met.id = e.entity_id and met.tenant_id = v.tenant_id)
                else null
              end
            ) = v.building_id
          )
        )
        or (
          v.scope_type = 'unit' and (
            coalesce(
              app_private.try_uuid(coalesce(e.after_snapshot, e.before_snapshot)->>'unit_id'),
              case
                when e.entity_type in ('portfolio.unit', 'unit') then e.entity_id
                when e.entity_type in ('billing.invoice', 'invoice') then (select inv.unit_id from billing.invoices inv where inv.id = e.entity_id and inv.tenant_id = v.tenant_id)
                when e.entity_type in ('maintenance.work_order', 'work_order') then (select wo.unit_id from maintenance.work_orders wo where wo.id = e.entity_id and wo.tenant_id = v.tenant_id)
                when e.entity_type in ('utilities.meter', 'meter') then (select met.unit_id from utilities.meters met where met.id = e.entity_id and met.tenant_id = v.tenant_id)
                else null
              end
            ) = v.unit_id
          )
        )
      )
      -- Text query filter
      and (
        p_query is null or trim(p_query) = '' or
        e.action ilike '%' || trim(p_query) || '%' or
        e.entity_type ilike '%' || trim(p_query) || '%' or
        coalesce(app_private.redact_audit_text(e.reason), '') ilike '%' || trim(p_query) || '%' or
        coalesce(e.actor_role, '') ilike '%' || trim(p_query) || '%'
      )
      -- Action filter
      and (
        p_action is null or trim(p_action) = '' or e.action = trim(p_action)
      )
      -- Date range filter
      and (p_from is null or e.occurred_at >= p_from)
      and (p_until is null or e.occurred_at <= p_until)
    order by e.occurred_at desc, e.id desc
    limit p_limit
    offset p_offset
  )
  select
    coalesce(max(total_count), 0),
    coalesce(jsonb_agg(to_jsonb(r) - 'total_count'), '[]'::jsonb)
  into v_total, v_rows
  from resolved r;

  return jsonb_build_object(
    'events', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

-- 4. Secure privileges: Revoke from anon/public, grant execute strictly to authenticated
revoke all on function audit.get_customer_events(uuid, integer, integer, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function audit.get_customer_events(uuid, integer, integer, text, text, timestamptz, timestamptz) to authenticated;

commit;
