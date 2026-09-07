-- Migration 67: Occupancy & Resident Registry Vertical Slice
-- Scope: Resident Registry Dashboard, Unit Occupancy Registry, Party Management, Occupancy Lifecycle & Security Model

begin;

-- 1. Performance index on occupancies for fast status/kind queries
create index if not exists occupancies_tenant_status_kind_idx
  on occupancy.occupancies (tenant_id, status, kind);

-- 2. Define permission and role assignments
insert into identity.permissions (code, resource, action, description)
values ('occupancy.occupancies.manage', 'occupancy.occupancies', 'manage', 'Create, update, renew, end and transfer unit occupancies within authorized scope')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager')
  and p.code = 'occupancy.occupancies.manage'
on conflict (role_id, permission_id) do update set effect = 'allow';

-- 3. Enhanced occupancy.get_customer_registry with complete dashboard metrics and 'units' view
create or replace function occupancy.get_customer_registry(
  p_context_id uuid,
  p_view text default 'occupancies'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_kind text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'billing', 'payments', 'utilities', 'maintenance', 'governance', 'documents', 'audit'
as $function$
declare
  x record;
  v_workspace uuid;
  v_party uuid;
  v_total bigint;
  v_rows jsonb;
  v_summary jsonb;
  v_detail jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_view not in('parties','residents','ownerships','leases','occupancies','mappings','links','history','units') or p_limit<1 or p_limit>100 or p_offset<0 then
    raise exception 'invalid_query' using errcode = '22023';
  end if;
  if p_kind is not null and p_kind not in('owner','tenant','household_member','short_stay','company','empty') then
    raise exception 'invalid_occupancy_kind' using errcode = '22023';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'occupancy_role_denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code='occupancy.registry.read'
  ) then
    raise exception 'occupancy_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = x.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key='module.occupancy'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'occupancy_entitlement_required' using errcode = '42501';
  end if;

  if lower(x.role_code) in ('owner', 'tenant_resident') then
    select mp.party_id into v_party
    from identity.membership_parties mp
    where mp.membership_id = x.membership_key and mp.tenant_id = x.tenant_id
      and mp.valid_from<=statement_timestamp() and (mp.valid_until is null or mp.valid_until > statement_timestamp());
    if v_party is null or x.scope_type <> 'unit' then
      raise exception 'resident_party_and_unit_context_required' using errcode = '42501';
    end if;
  end if;

  -- Allowed units resolution based on tenant & role boundary
  with allowed_units as (
    select u.id, u.code as unit_code, b.id as building_id, b.name as building_name, p.id as property_id, p.name as property_name
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    join portfolio.properties p on p.id = b.property_id
    where u.tenant_id = x.tenant_id
      and (x.scope_type = 'tenant' or p.id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
      and (case lower(x.role_code)
             when 'owner' then exists (select 1 from portfolio.ownerships o where o.unit_id = u.id and o.party_id=v_party and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date))
             when 'tenant_resident' then exists (select 1 from occupancy.leases l where l.unit_id = u.id and l.tenant_party_id=v_party and l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date))
             else true end)
  )
  select jsonb_build_object(
    'units', count(*),
    'occupied', count(*) filter (where exists (
      select 1 from occupancy.occupancies o
      where o.unit_id = allowed_units.id and o.status = 'active' and o.kind <> 'empty'
        and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    )),
    'vacant', count(*) filter (where not exists (
      select 1 from occupancy.occupancies o
      where o.unit_id = allowed_units.id and o.status = 'active' and o.kind <> 'empty'
        and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    )),
    'owner_occupied', count(*) filter (where exists (
      select 1 from occupancy.occupancies o
      where o.unit_id = allowed_units.id and o.status = 'active' and o.kind = 'owner'
        and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    )),
    'rented', count(*) filter (where exists (
      select 1 from occupancy.occupancies o
      where o.unit_id = allowed_units.id and o.status = 'active' and o.kind = 'tenant'
        and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    )),
    'company_occupied', count(*) filter (where exists (
      select 1 from occupancy.occupancies o
      where o.unit_id = allowed_units.id and o.status = 'active' and o.kind = 'company'
        and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    )),
    'short_term', count(*) filter (where exists (
      select 1 from occupancy.occupancies o
      where o.unit_id = allowed_units.id and o.status = 'active' and o.kind = 'short_stay'
        and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    )),
    'active_owners', (
      select count(distinct o.party_id)
      from portfolio.ownerships o
      join allowed_units au on au.id = o.unit_id
      where o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date)
    ),
    'active_tenants', (
      select count(distinct l.tenant_party_id)
      from occupancy.leases l
      join allowed_units au on au.id = l.unit_id
      where l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date)
    ),
    'active_residents', (
      select count(distinct oc.party_id)
      from occupancy.occupants oc
      join occupancy.occupancies o on o.id = oc.occupancy_id
      join allowed_units au on au.id = o.unit_id
      where o.status = 'active' and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
    ),
    'expiring_leases', (
      select count(*)
      from occupancy.leases l
      join allowed_units au on au.id = l.unit_id
      where l.status = 'active' and l.ends_on is not null and l.ends_on between current_date and (current_date + interval '30 days')
    ),
    'incomplete_records', (
      select count(*)
      from occupancy.occupancies o
      join allowed_units au on au.id = o.unit_id
      where o.status = 'active' and o.kind <> 'empty'
        and not exists (select 1 from occupancy.occupants oc where oc.occupancy_id = o.id)
    ),
    'active_leases', coalesce(sum((
      select count(*) from occupancy.leases l
      where l.unit_id = allowed_units.id and l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date)
    )), 0)
  )
  into v_summary
  from allowed_units;

  -- Views dispatch
  if p_view = 'occupancies' then
    with allowed_units as (
      select u.id, u.code as unit_code, b.name as building_name, p.name as property_name
      from portfolio.units u
      join portfolio.buildings b on b.id = u.building_id
      join portfolio.properties p on p.id = b.property_id
      where u.tenant_id = x.tenant_id
        and (x.scope_type = 'tenant' or p.id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
        and (case lower(x.role_code)
               when 'owner' then exists (select 1 from portfolio.ownerships z where z.unit_id = u.id and z.party_id = v_party and z.valid_from <= current_date and (z.valid_to is null or z.valid_to > current_date))
               when 'tenant_resident' then exists (select 1 from occupancy.leases z where z.unit_id = u.id and z.tenant_party_id = v_party and z.status = 'active' and z.starts_on <= current_date and (z.ends_on is null or z.ends_on > current_date))
               else true end)
    ),
    q as (
      select
        o.id,
        a.property_name,
        a.building_name,
        a.unit_code,
        o.unit_id,
        o.kind::text,
        o.status::text,
        o.starts_at,
        o.ends_at,
        (select count(*) from occupancy.occupants z where z.occupancy_id = o.id and (lower(x.role_code) <> 'tenant_resident' or z.party_id = v_party)) as resident_count,
        o.finalized_at,
        count(*) over() as total_count
      from occupancy.occupancies o
      join allowed_units a on a.id = o.unit_id
      where (lower(x.role_code) <> 'tenant_resident' or (
              exists (select 1 from occupancy.occupants z where z.occupancy_id = o.id and z.party_id = v_party)
              and exists (select 1 from occupancy.leases l where l.unit_id = o.unit_id and l.tenant_party_id = v_party and l.status = 'active' and l.starts_on <= o.starts_at::date and (l.ends_on is null or l.ends_on >= coalesce(o.ends_at::date, o.starts_at::date)))
            ))
        and (p_id is null or o.id = p_id)
        and (p_status is null or o.status::text = p_status)
        and (p_kind is null or o.kind::text = p_kind)
        and (p_from is null or o.starts_at::date >= p_from)
        and (p_to is null or o.starts_at::date <= p_to)
        and (p_query is null or a.unit_code ilike '%' || trim(p_query) || '%' or a.building_name ilike '%' || trim(p_query) || '%')
      order by o.starts_at desc, o.id
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  elsif p_view = 'units' then
    with allowed_units as (
      select u.id, u.code as unit_code, u.floor, u.area_m2, u.bedrooms, u.status as unit_status,
             b.id as building_id, b.name as building_name, p.id as property_id, p.name as property_name
      from portfolio.units u
      join portfolio.buildings b on b.id = u.building_id
      join portfolio.properties p on p.id = b.property_id
      where u.tenant_id = x.tenant_id
        and (x.scope_type = 'tenant' or p.id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
        and (case lower(x.role_code)
               when 'owner' then exists (select 1 from portfolio.ownerships z where z.unit_id = u.id and z.party_id = v_party and z.valid_from <= current_date and (z.valid_to is null or z.valid_to > current_date))
               when 'tenant_resident' then exists (select 1 from occupancy.leases z where z.unit_id = u.id and z.tenant_party_id = v_party and z.status = 'active' and z.starts_on <= current_date and (z.ends_on is null or z.ends_on > current_date))
               else true end)
    ),
    unit_stats as (
      select
        au.id,
        au.unit_code,
        au.building_name,
        au.property_name,
        au.floor,
        au.area_m2,
        au.bedrooms,
        au.unit_status::text,
        coalesce(
          (select o.kind::text from occupancy.occupancies o
           where o.unit_id = au.id and o.status = 'active' and o.kind <> 'empty'
             and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
           order by o.starts_at desc limit 1),
          'vacant'
        ) as occupancy_kind,
        case
          when exists (
            select 1 from occupancy.occupancies o
            where o.unit_id = au.id and o.status = 'active' and o.kind <> 'empty'
              and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
          ) then 'active'
          when exists (
            select 1 from occupancy.occupancies o
            where o.unit_id = au.id and o.status in ('planned', 'active') and o.starts_at > statement_timestamp()
          ) then 'upcoming'
          else 'vacant'
        end as occupancy_lifecycle,
        (
          select case
            when lower(x.role_code) in ('association_admin', 'property_manager') or o.party_id = v_party then pt.legal_name
            else 'Owner · ' || left(o.party_id::text, 8)
          end
          from portfolio.ownerships o
          join portfolio.parties pt on pt.id = o.party_id
          where o.unit_id = au.id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date)
          order by o.share desc limit 1
        ) as primary_owner,
        (
          select case
            when lower(x.role_code) in ('association_admin', 'property_manager') or l.tenant_party_id = v_party then pt.legal_name
            else 'Tenant · ' || left(l.tenant_party_id::text, 8)
          end
          from occupancy.leases l
          join portfolio.parties pt on pt.id = l.tenant_party_id
          where l.unit_id = au.id and l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date)
          order by l.starts_on desc limit 1
        ) as primary_tenant,
        (
          select o.id from occupancy.occupancies o
          where o.unit_id = au.id and o.status = 'active' and o.kind <> 'empty'
            and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
          order by o.starts_at desc limit 1
        ) as active_occupancy_id,
        count(*) over() as total_count
      from allowed_units au
      where (p_id is null or au.id = p_id)
        and (p_query is null or au.unit_code ilike '%' || trim(p_query) || '%' or au.building_name ilike '%' || trim(p_query) || '%')
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(unit_stats) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows
    from (
      select * from unit_stats
      where (p_kind is null or occupancy_kind = p_kind)
        and (p_status is null or occupancy_lifecycle = p_status)
      order by property_name, building_name, unit_code
      limit p_limit offset p_offset
    ) unit_stats;

  elsif p_view = 'ownerships' then
    with q as (
      select
        o.id,
        u.code as unit_code,
        b.name as building_name,
        case when lower(x.role_code) in ('association_admin', 'property_manager') or o.party_id = v_party then p.legal_name else 'Owner · ' || left(o.party_id::text, 8) end as party_label,
        p.type::text as party_type,
        o.share,
        o.valid_from,
        o.valid_to,
        o.finalized_at,
        count(*) over() as total_count
      from portfolio.ownerships o
      join portfolio.units u on u.id = o.unit_id
      join portfolio.buildings b on b.id = u.building_id
      join portfolio.parties p on p.id = o.party_id
      where o.tenant_id = x.tenant_id
        and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
        and (lower(x.role_code) not in ('owner', 'tenant_resident') or o.party_id = v_party)
        and (p_id is null or o.id = p_id)
        and (p_from is null or o.valid_from >= p_from)
        and (p_to is null or o.valid_from <= p_to)
        and (p_query is null or u.code ilike '%' || trim(p_query) || '%' or (lower(x.role_code) in ('association_admin', 'property_manager') and p.legal_name ilike '%' || trim(p_query) || '%'))
      order by o.valid_from desc, o.id
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  elsif p_view = 'leases' then
    with q as (
      select
        l.id,
        u.code as unit_code,
        b.name as building_name,
        case when lower(x.role_code) in ('association_admin', 'property_manager') or l.landlord_party_id = v_party then lp.legal_name else 'Landlord · ' || left(l.landlord_party_id::text, 8) end as landlord_label,
        case when lower(x.role_code) in ('association_admin', 'property_manager') or l.tenant_party_id = v_party then tp.legal_name else 'Tenant · ' || left(l.tenant_party_id::text, 8) end as tenant_label,
        l.starts_on,
        l.ends_on,
        l.currency,
        l.status::text,
        l.finalized_at,
        count(*) over() as total_count
      from occupancy.leases l
      join portfolio.units u on u.id = l.unit_id
      join portfolio.buildings b on b.id = u.building_id
      join portfolio.parties lp on lp.id = l.landlord_party_id
      join portfolio.parties tp on tp.id = l.tenant_party_id
      where l.tenant_id = x.tenant_id
        and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
        and (lower(x.role_code) not in ('owner', 'tenant_resident') or l.landlord_party_id = v_party or l.tenant_party_id = v_party)
        and (p_id is null or l.id = p_id)
        and (p_status is null or l.status::text = p_status)
        and (p_from is null or l.starts_on >= p_from)
        and (p_to is null or l.starts_on <= p_to)
        and (p_query is null or u.code ilike '%' || trim(p_query) || '%')
      order by l.starts_on desc, l.id
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  elsif p_view = 'residents' then
    with q as (
      select
        z.party_id as id,
        u.code as unit_code,
        b.name as building_name,
        case when lower(x.role_code) in ('association_admin', 'property_manager') or z.party_id = v_party then p.legal_name else 'Resident · ' || left(z.party_id::text, 8) end as resident_label,
        p.type::text as party_type,
        z.role,
        z.resident_weight,
        o.kind::text,
        o.starts_at,
        o.ends_at,
        count(*) over() as total_count
      from occupancy.occupants z
      join occupancy.occupancies o on o.id = z.occupancy_id
      join portfolio.units u on u.id = o.unit_id
      join portfolio.buildings b on b.id = u.building_id
      join portfolio.parties p on p.id = z.party_id
      where o.tenant_id = x.tenant_id
        and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
        and (lower(x.role_code) not in ('owner', 'tenant_resident') or z.party_id = v_party)
        and (p_query is null or u.code ilike '%' || trim(p_query) || '%' or (lower(x.role_code) in ('association_admin', 'property_manager') and p.legal_name ilike '%' || trim(p_query) || '%'))
      order by o.starts_at desc, z.party_id
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  elsif p_view = 'parties' then
    with visible as (
      select distinct p.id, p.type, p.legal_name, p.created_at, p.archived_at
      from portfolio.parties p
      left join portfolio.ownerships ow on ow.party_id = p.id
      left join occupancy.leases l on l.landlord_party_id = p.id or l.tenant_party_id = p.id
      left join occupancy.occupants oc on oc.party_id = p.id
      left join occupancy.occupancies o on o.id = oc.occupancy_id
      where p.tenant_id = x.tenant_id
        and (lower(x.role_code) in ('association_admin', 'property_manager', 'president', 'censor') or p.id = v_party)
        and (p_query is null or (lower(x.role_code) in ('association_admin', 'property_manager') and p.legal_name ilike '%' || trim(p_query) || '%'))
    ),
    q as (
      select
        id,
        type::text as party_type,
        case when lower(x.role_code) in ('association_admin', 'property_manager') or id = v_party then legal_name else 'Party · ' || left(id::text, 8) end as display_name,
        created_at,
        archived_at,
        count(*) over() as total_count
      from visible
      order by created_at desc, id
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  elsif p_view = 'mappings' then
    with q as (
      select
        mp.party_id as id,
        case when mp.party_id = v_party then p.legal_name else 'Party · ' || left(mp.party_id::text, 8) end as party_label,
        r.code as role_code,
        mp.valid_from,
        mp.valid_until,
        mp.finalized_at,
        (mp.valid_from <= statement_timestamp() and (mp.valid_until is null or mp.valid_until > statement_timestamp())) as active,
        count(*) over() as total_count
      from identity.membership_parties mp
      join identity.memberships m on m.id = mp.membership_id
      join identity.roles r on r.id = m.role_id
      join portfolio.parties p on p.id = mp.party_id
      where mp.tenant_id = x.tenant_id
        and (lower(x.role_code) in ('association_admin', 'property_manager') or mp.membership_id = x.membership_key)
      order by mp.valid_from desc, mp.party_id
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  elsif p_view = 'links' then
    with q as (
      select
        u.id,
        u.code as unit_code,
        b.name as building_name,
        p.name as property_name,
        (select count(*) from billing.invoices i where i.unit_id = u.id and (lower(x.role_code) <> 'tenant_resident' or i.liable_party_id = v_party)) as invoice_count,
        (select count(*) from billing.receivables r join billing.invoices i on i.id = r.invoice_id where i.unit_id = u.id and (lower(x.role_code) <> 'tenant_resident' or i.liable_party_id = v_party)) as receivable_count,
        (select count(*) from payments.payments y where y.unit_id = u.id and (lower(x.role_code) <> 'tenant_resident' or y.payer_party_id = v_party)) as payment_count,
        (select count(*) from utilities.meters m where m.unit_id = u.id) as meter_count,
        (select count(*) from maintenance.work_orders w where w.unit_id = u.id) as work_order_count,
        (select count(distinct e.meeting_id) from governance.eligibility_snapshots e where e.unit_id = u.id and (lower(x.role_code) <> 'tenant_resident' or e.party_id = v_party)) as meeting_count,
        (select count(*) from documents.document_links d where d.entity_type = 'portfolio.unit' and d.entity_id = u.id) as document_count,
        (select count(*) from audit.events a where a.tenant_id = x.tenant_id and a.entity_id = u.id) as audit_event_count,
        count(*) over() as total_count
      from portfolio.units u
      join portfolio.buildings b on b.id = u.building_id
      join portfolio.properties p on p.id = b.property_id
      where u.tenant_id = x.tenant_id
        and (x.scope_type = 'tenant' or p.id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
        and (lower(x.role_code) not in ('owner', 'tenant_resident') or u.id = x.unit_id)
      order by p.name, b.name, u.code
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;

  else
    with q as (
      select
        h.id,
        h.entity_type,
        h.entity_id,
        h.event_type,
        h.status_from,
        h.status_to,
        h.reason,
        h.rule_version,
        h.occurred_at,
        count(*) over() as total_count
      from occupancy.lifecycle_events h
      where h.tenant_id = x.tenant_id
        and (lower(x.role_code) in ('association_admin', 'property_manager', 'president', 'censor') or h.entity_id = v_party or h.entity_id = x.unit_id)
      order by h.occurred_at desc, h.id desc
      limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
    into v_total, v_rows from q;
  end if;

  v_detail := case when p_id is null then null else (select r from jsonb_array_elements(v_rows) r where r->>'id' = p_id::text limit 1) end;

  return jsonb_build_object(
    'context', jsonb_build_object('id', x.id, 'role', x.role_code, 'scope', x.scope_type),
    'view', p_view,
    'total', coalesce(v_total, 0),
    'rows', coalesce(v_rows, '[]'::jsonb),
    'summary', coalesce(v_summary, '{}'::jsonb),
    'detail', v_detail,
    'read_only', (lower(x.role_code) in ('president', 'censor', 'owner', 'tenant_resident')),
    'pii_redacted', true,
    'generated_at', statement_timestamp()
  );
end $function$;

-- 4. Unit Occupancy Detail RPC
create or replace function occupancy.get_unit_occupancy_detail(
  p_context_id uuid,
  p_unit_id uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'audit'
as $function$
declare
  x record;
  v_workspace uuid;
  v_party uuid;
  v_unit record;
  v_owners jsonb;
  v_lease jsonb;
  v_occupants jsonb;
  v_active_occ record;
  v_history jsonb;
  v_lifecycle text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'occupancy_role_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code = 'occupancy.registry.read'
  ) then
    raise exception 'occupancy_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = x.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.occupancy'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'occupancy_entitlement_required' using errcode = '42501';
  end if;

  if lower(x.role_code) in ('owner', 'tenant_resident') then
    select mp.party_id into v_party
    from identity.membership_parties mp
    where mp.membership_id = x.membership_key and mp.tenant_id = x.tenant_id
      and mp.valid_from <= statement_timestamp() and (mp.valid_until is null or mp.valid_until > statement_timestamp());
    if v_party is null or x.scope_type <> 'unit' then
      raise exception 'resident_party_and_unit_context_required' using errcode = '42501';
    end if;
  end if;

  -- Load unit with scope check
  select u.id, u.code as unit_code, u.floor, u.area_m2, u.bedrooms, u.status as unit_status,
         b.id as building_id, b.name as building_name, p.id as property_id, p.name as property_name
  into v_unit
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  join portfolio.properties p on p.id = b.property_id
  where u.id = p_unit_id and u.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or p.id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
    and (case lower(x.role_code)
           when 'owner' then exists (select 1 from portfolio.ownerships o where o.unit_id = u.id and o.party_id = v_party and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date))
           when 'tenant_resident' then exists (select 1 from occupancy.leases l where l.unit_id = u.id and l.tenant_party_id = v_party and l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date))
           else true end);

  if not found then
    raise exception 'unit_not_found_or_access_denied' using errcode = '42501';
  end if;

  -- Active occupancy
  select o.id, o.kind::text, o.status::text, o.starts_at, o.ends_at, o.finalized_at
  into v_active_occ
  from occupancy.occupancies o
  where o.unit_id = v_unit.id and o.status = 'active' and o.kind <> 'empty'
    and o.starts_at <= statement_timestamp() and (o.ends_at is null or o.ends_at > statement_timestamp())
  order by o.starts_at desc limit 1;

  if v_active_occ.id is not null then
    v_lifecycle := 'active';
  elsif exists (select 1 from occupancy.occupancies o where o.unit_id = v_unit.id and o.status in ('planned', 'active') and o.starts_at > statement_timestamp()) then
    v_lifecycle := 'upcoming';
  elsif exists (select 1 from occupancy.occupancies o where o.unit_id = v_unit.id and o.status = 'ended') then
    v_lifecycle := 'expired';
  else
    v_lifecycle := 'vacant';
  end if;

  -- Owners list
  select coalesce(jsonb_agg(jsonb_build_object(
    'party_id', o.party_id,
    'share', o.share,
    'valid_from', o.valid_from,
    'valid_to', o.valid_to,
    'party_type', p.type::text,
    'display_name', case
      when lower(x.role_code) in ('association_admin', 'property_manager') or o.party_id = v_party then p.legal_name
      else 'Owner · ' || left(o.party_id::text, 8)
    end
  ) order by o.share desc), '[]'::jsonb)
  into v_owners
  from portfolio.ownerships o
  join portfolio.parties p on p.id = o.party_id
  where o.unit_id = v_unit.id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date);

  -- Active lease
  select to_jsonb(l_row)
  into v_lease
  from (
    select
      l.id,
      l.starts_on,
      l.ends_on,
      l.currency,
      l.status::text,
      case when lower(x.role_code) in ('association_admin', 'property_manager') or l.landlord_party_id = v_party then lp.legal_name else 'Landlord · ' || left(l.landlord_party_id::text, 8) end as landlord_label,
      case when lower(x.role_code) in ('association_admin', 'property_manager') or l.tenant_party_id = v_party then tp.legal_name else 'Tenant · ' || left(l.tenant_party_id::text, 8) end as tenant_label
    from occupancy.leases l
    join portfolio.parties lp on lp.id = l.landlord_party_id
    join portfolio.parties tp on tp.id = l.tenant_party_id
    where l.unit_id = v_unit.id and l.status = 'active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date)
    order by l.starts_on desc limit 1
  ) l_row;

  -- Occupants of active occupancy
  if v_active_occ.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'party_id', oc.party_id,
      'role', oc.role,
      'resident_weight', oc.resident_weight,
      'display_name', case
        when lower(x.role_code) in ('association_admin', 'property_manager') or oc.party_id = v_party then p.legal_name
        else 'Resident · ' || left(oc.party_id::text, 8)
      end
    )), '[]'::jsonb)
    into v_occupants
    from occupancy.occupants oc
    join portfolio.parties p on p.id = oc.party_id
    where oc.occupancy_id = v_active_occ.id;
  else
    v_occupants := '[]'::jsonb;
  end if;

  -- Unit lifecycle history
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id,
    'event_type', h.event_type,
    'status_from', h.status_from,
    'status_to', h.status_to,
    'reason', h.reason,
    'occurred_at', h.occurred_at
  ) order by h.occurred_at desc), '[]'::jsonb)
  into v_history
  from (
    select h.* from occupancy.lifecycle_events h
    where h.tenant_id = x.tenant_id and (
      (h.entity_type = 'occupancy' and h.entity_id in (select o.id from occupancy.occupancies o where o.unit_id = v_unit.id))
      or (h.entity_type = 'lease' and h.entity_id in (select l.id from occupancy.leases l where l.unit_id = v_unit.id))
    )
    order by h.occurred_at desc limit 20
  ) h;

  return jsonb_build_object(
    'unit', jsonb_build_object(
      'id', v_unit.id,
      'code', v_unit.unit_code,
      'floor', v_unit.floor,
      'area_m2', v_unit.area_m2,
      'bedrooms', v_unit.bedrooms,
      'status', v_unit.unit_status
    ),
    'building', jsonb_build_object('id', v_unit.building_id, 'name', v_unit.building_name),
    'property', jsonb_build_object('id', v_unit.property_id, 'name', v_unit.property_name),
    'occupancy_status', coalesce(v_active_occ.kind, 'vacant'),
    'lifecycle_status', v_lifecycle,
    'active_occupancy', case when v_active_occ.id is not null then to_jsonb(v_active_occ) else null end,
    'owners', v_owners,
    'active_lease', v_lease,
    'occupants', v_occupants,
    'history', v_history,
    'read_only', (lower(x.role_code) in ('president', 'censor', 'owner', 'tenant_resident')),
    'pii_redacted', true,
    'generated_at', statement_timestamp()
  );
end $function$;

-- 5. Mutation RPCs: Create, Update, End, Renew, Transfer Occupancies

-- 5.1 Create Occupancy
create or replace function occupancy.create_occupancy(
  p_context_id uuid,
  p_unit_id uuid,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_occupant_party_ids uuid[] default null,
  p_role text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'audit', 'app_private'
as $function$
declare
  x record;
  v_workspace uuid;
  v_unit record;
  v_new_occ record;
  v_pid uuid;
  v_sanitized_reason text;
  v_created_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'occupancy_mutation_forbidden_for_role: %', x.role_code using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code = 'occupancy.occupancies.manage'
  ) then
    raise exception 'occupancy_management_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = x.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.occupancy'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'occupancy_entitlement_required' using errcode = '42501';
  end if;

  -- Validate unit scope
  select u.*, b.property_id
  into v_unit
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where u.id = p_unit_id and u.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id);

  if not found then
    raise exception 'unit_not_found_or_scope_mismatch' using errcode = '42501';
  end if;

  if p_kind not in ('owner', 'tenant', 'household_member', 'short_stay', 'company', 'empty') then
    raise exception 'invalid_occupancy_kind: %', p_kind using errcode = '22023';
  end if;

  if p_starts_at is null then
    raise exception 'starts_at_required' using errcode = '22023';
  end if;

  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'ends_at_must_be_after_starts_at' using errcode = '22023';
  end if;

  -- Check overlapping active occupancy
  if exists (
    select 1 from occupancy.occupancies o
    where o.unit_id = v_unit.id and o.status = 'active' and (o.kind = 'empty' or p_kind = 'empty')
      and tstzrange(o.starts_at, coalesce(o.ends_at, 'infinity'::timestamptz), '[)') &&
          tstzrange(p_starts_at, coalesce(p_ends_at, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'invalid_overlapping_occupancy' using errcode = '40001';
  end if;

  if p_reason is not null and trim(p_reason) <> '' then
    v_sanitized_reason := app_private.redact_audit_text(p_reason);
  else
    v_sanitized_reason := 'Occupancy created within authorized customer context';
  end if;

  -- Insert occupancy
  insert into occupancy.occupancies (
    tenant_id,
    unit_id,
    kind,
    status,
    starts_at,
    ends_at,
    created_at,
    updated_at
  ) values (
    x.tenant_id,
    v_unit.id,
    p_kind::occupancy.occupancy_kind,
    'active'::occupancy.occupancy_status,
    p_starts_at,
    p_ends_at,
    statement_timestamp(),
    statement_timestamp()
  )
  returning id, tenant_id, unit_id, kind::text, status::text, starts_at, ends_at, created_at, updated_at
  into v_new_occ;

  v_created_id := v_new_occ.id;

  -- Insert occupants if provided
  if p_occupant_party_ids is not null and array_length(p_occupant_party_ids, 1) > 0 then
    foreach v_pid in array p_occupant_party_ids
    loop
      insert into occupancy.occupants (
        occupancy_id,
        party_id,
        role,
        resident_weight,
        created_at
      ) values (
        v_created_id,
        v_pid,
        coalesce(p_role, case p_kind when 'owner' then 'owner' when 'tenant' then 'tenant' else 'resident' end),
        1.0,
        statement_timestamp()
      )
      on conflict (occupancy_id, party_id) do nothing;
    end loop;
  end if;

  -- Append to lifecycle events
  insert into occupancy.lifecycle_events (
    tenant_id,
    entity_type,
    entity_id,
    event_type,
    status_from,
    status_to,
    reason,
    rule_version,
    occurred_at
  ) values (
    x.tenant_id,
    'occupancy',
    v_created_id,
    'CREATE',
    null,
    'active',
    v_sanitized_reason,
    1,
    statement_timestamp()
  );

  -- Log audit event
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
    x.tenant_id,
    auth.uid(),
    x.role_code,
    'OCCUPANCY_CREATED',
    'occupancy',
    v_created_id,
    v_sanitized_reason,
    null,
    to_jsonb(v_new_occ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'occupancy', to_jsonb(v_new_occ),
    'message', 'Occupancy successfully registered'
  );
end $function$;

-- 5.2 Update Occupancy Permitted Fields
create or replace function occupancy.update_occupancy(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_ends_at timestamptz default null,
  p_status text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'audit', 'app_private'
as $function$
declare
  x record;
  v_workspace uuid;
  v_old record;
  v_new record;
  v_sanitized_reason text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'occupancy_mutation_forbidden_for_role: %', x.role_code using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code = 'occupancy.occupancies.manage'
  ) then
    raise exception 'occupancy_management_permission_required' using errcode = '42501';
  end if;

  -- Lock row
  select o.*, b.property_id, b.id as building_id
  into v_old
  from occupancy.occupancies o
  join portfolio.units u on u.id = o.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where o.id = p_occupancy_id and o.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
  for update;

  if not found then
    raise exception 'occupancy_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v_old.finalized_at is not null then
    raise exception 'final_occupancy_snapshot_is_immutable' using errcode = '22023';
  end if;

  if p_ends_at is not null and p_ends_at <= v_old.starts_at then
    raise exception 'ends_at_must_be_after_starts_at' using errcode = '22023';
  end if;

  if p_status is not null and p_status not in ('planned', 'active', 'ended', 'cancelled') then
    raise exception 'invalid_occupancy_status: %', p_status using errcode = '22023';
  end if;

  if p_reason is not null and trim(p_reason) <> '' then
    v_sanitized_reason := app_private.redact_audit_text(p_reason);
  else
    v_sanitized_reason := 'Occupancy record updated';
  end if;

  update occupancy.occupancies
  set
    ends_at = coalesce(p_ends_at, ends_at),
    status = coalesce(p_status::occupancy.occupancy_status, status),
    updated_at = statement_timestamp()
  where id = p_occupancy_id
  returning id, tenant_id, unit_id, kind::text, status::text, starts_at, ends_at, created_at, updated_at
  into v_new;

  -- Lifecycle event
  insert into occupancy.lifecycle_events (
    tenant_id,
    entity_type,
    entity_id,
    event_type,
    status_from,
    status_to,
    reason,
    rule_version,
    occurred_at
  ) values (
    x.tenant_id,
    'occupancy',
    p_occupancy_id,
    'UPDATE',
    v_old.status::text,
    v_new.status::text,
    v_sanitized_reason,
    1,
    statement_timestamp()
  );

  -- Audit event
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
    x.tenant_id,
    auth.uid(),
    x.role_code,
    'OCCUPANCY_UPDATED',
    'occupancy',
    p_occupancy_id,
    v_sanitized_reason,
    to_jsonb(v_old),
    to_jsonb(v_new),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'occupancy', to_jsonb(v_new),
    'message', 'Occupancy updated'
  );
end $function$;

-- 5.3 End Occupancy
create or replace function occupancy.end_occupancy(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_ended_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'audit', 'app_private'
as $function$
declare
  x record;
  v_old record;
  v_new record;
  v_end_time timestamptz;
  v_sanitized_reason text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'occupancy_mutation_forbidden_for_role: %', x.role_code using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code = 'occupancy.occupancies.manage'
  ) then
    raise exception 'occupancy_management_permission_required' using errcode = '42501';
  end if;

  select o.*, b.property_id, b.id as building_id
  into v_old
  from occupancy.occupancies o
  join portfolio.units u on u.id = o.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where o.id = p_occupancy_id and o.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
  for update;

  if not found then
    raise exception 'occupancy_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v_old.status = 'ended' then
    raise exception 'occupancy_already_ended' using errcode = '22023';
  end if;

  v_end_time := coalesce(p_ended_at, statement_timestamp());
  if v_end_time <= v_old.starts_at then
    v_end_time := v_old.starts_at + interval '1 second';
  end if;

  if p_reason is not null and trim(p_reason) <> '' then
    v_sanitized_reason := app_private.redact_audit_text(p_reason);
  else
    v_sanitized_reason := 'Occupancy finalized and ended';
  end if;

  update occupancy.occupancies
  set
    status = 'ended'::occupancy.occupancy_status,
    ends_at = v_end_time,
    finalized_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_occupancy_id
  returning id, tenant_id, unit_id, kind::text, status::text, starts_at, ends_at, finalized_at, created_at, updated_at
  into v_new;

  insert into occupancy.lifecycle_events (
    tenant_id,
    entity_type,
    entity_id,
    event_type,
    status_from,
    status_to,
    reason,
    rule_version,
    occurred_at
  ) values (
    x.tenant_id,
    'occupancy',
    p_occupancy_id,
    'END',
    v_old.status::text,
    'ended',
    v_sanitized_reason,
    1,
    statement_timestamp()
  );

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
    x.tenant_id,
    auth.uid(),
    x.role_code,
    'OCCUPANCY_ENDED',
    'occupancy',
    p_occupancy_id,
    v_sanitized_reason,
    to_jsonb(v_old),
    to_jsonb(v_new),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'occupancy', to_jsonb(v_new),
    'message', 'Occupancy successfully ended'
  );
end $function$;

-- 5.4 Renew Occupancy
create or replace function occupancy.renew_occupancy(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_new_ends_at timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'audit', 'app_private'
as $function$
declare
  x record;
  v_old record;
  v_new record;
  v_sanitized_reason text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_new_ends_at is null then
    raise exception 'new_ends_at_required' using errcode = '22023';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'occupancy_mutation_forbidden_for_role: %', x.role_code using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code = 'occupancy.occupancies.manage'
  ) then
    raise exception 'occupancy_management_permission_required' using errcode = '42501';
  end if;

  select o.*, b.property_id, b.id as building_id
  into v_old
  from occupancy.occupancies o
  join portfolio.units u on u.id = o.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where o.id = p_occupancy_id and o.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
  for update;

  if not found then
    raise exception 'occupancy_not_found_or_access_denied' using errcode = '42501';
  end if;

  if p_new_ends_at <= v_old.starts_at or (v_old.ends_at is not null and p_new_ends_at <= v_old.ends_at) then
    raise exception 'new_ends_at_must_extend_beyond_current_period' using errcode = '22023';
  end if;

  if p_reason is not null and trim(p_reason) <> '' then
    v_sanitized_reason := app_private.redact_audit_text(p_reason);
  else
    v_sanitized_reason := 'Occupancy renewed with extended period';
  end if;

  update occupancy.occupancies
  set
    ends_at = p_new_ends_at,
    status = 'active'::occupancy.occupancy_status,
    finalized_at = null,
    updated_at = statement_timestamp()
  where id = p_occupancy_id
  returning id, tenant_id, unit_id, kind::text, status::text, starts_at, ends_at, created_at, updated_at
  into v_new;

  insert into occupancy.lifecycle_events (
    tenant_id,
    entity_type,
    entity_id,
    event_type,
    status_from,
    status_to,
    reason,
    rule_version,
    occurred_at
  ) values (
    x.tenant_id,
    'occupancy',
    p_occupancy_id,
    'RENEW',
    v_old.status::text,
    'active',
    v_sanitized_reason,
    1,
    statement_timestamp()
  );

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
    x.tenant_id,
    auth.uid(),
    x.role_code,
    'OCCUPANCY_RENEWED',
    'occupancy',
    p_occupancy_id,
    v_sanitized_reason,
    to_jsonb(v_old),
    to_jsonb(v_new),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'occupancy', to_jsonb(v_new),
    'message', 'Occupancy renewed successfully'
  );
end $function$;

-- 5.5 Transfer Occupancy
create or replace function occupancy.transfer_occupancy(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_to_unit_id uuid,
  p_effective_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'occupancy', 'portfolio', 'identity', 'platform', 'audit', 'app_private'
as $function$
declare
  x record;
  v_old_occ record;
  v_target_unit record;
  v_new_occ record;
  v_eff_time timestamptz;
  v_sanitized_reason text;
  v_new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into x
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(x.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'occupancy_mutation_forbidden_for_role: %', x.role_code using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = x.role_id and rp.effect = 'allow' and p.code = 'occupancy.occupancies.manage'
  ) then
    raise exception 'occupancy_management_permission_required' using errcode = '42501';
  end if;

  -- Old occupancy
  select o.*, b.property_id, b.id as building_id
  into v_old_occ
  from occupancy.occupancies o
  join portfolio.units u on u.id = o.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where o.id = p_occupancy_id and o.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id)
  for update;

  if not found then
    raise exception 'source_occupancy_not_found_or_access_denied' using errcode = '42501';
  end if;

  -- Target unit
  select u.*, b.property_id
  into v_target_unit
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where u.id = p_to_unit_id and u.tenant_id = x.tenant_id
    and (x.scope_type = 'tenant' or b.property_id = x.property_id or b.id = x.building_id or u.id = x.unit_id);

  if not found then
    raise exception 'target_unit_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v_target_unit.id = v_old_occ.unit_id then
    raise exception 'cannot_transfer_to_same_unit' using errcode = '22023';
  end if;

  v_eff_time := coalesce(p_effective_at, statement_timestamp());

  if p_reason is not null and trim(p_reason) <> '' then
    v_sanitized_reason := app_private.redact_audit_text(p_reason);
  else
    v_sanitized_reason := 'Occupancy transferred to unit ' || v_target_unit.code;
  end if;

  -- End old occupancy
  update occupancy.occupancies
  set
    status = 'ended'::occupancy.occupancy_status,
    ends_at = v_eff_time,
    finalized_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_occupancy_id;

  -- Create new occupancy on target unit
  insert into occupancy.occupancies (
    tenant_id,
    unit_id,
    kind,
    status,
    starts_at,
    ends_at,
    created_at,
    updated_at
  ) values (
    x.tenant_id,
    v_target_unit.id,
    v_old_occ.kind,
    'active'::occupancy.occupancy_status,
    v_eff_time,
    v_old_occ.ends_at,
    statement_timestamp(),
    statement_timestamp()
  )
  returning id, tenant_id, unit_id, kind::text, status::text, starts_at, ends_at, created_at, updated_at
  into v_new_occ;

  v_new_id := v_new_occ.id;

  -- Copy occupants to new occupancy
  insert into occupancy.occupants (occupancy_id, party_id, role, resident_weight, created_at)
  select v_new_id, oc.party_id, oc.role, oc.resident_weight, statement_timestamp()
  from occupancy.occupants oc
  where oc.occupancy_id = p_occupancy_id;

  -- Lifecycles
  insert into occupancy.lifecycle_events (tenant_id, entity_type, entity_id, event_type, status_from, status_to, reason, rule_version, occurred_at)
  values (x.tenant_id, 'occupancy', p_occupancy_id, 'TRANSFER_OUT', v_old_occ.status::text, 'ended', v_sanitized_reason, 1, statement_timestamp()),
         (x.tenant_id, 'occupancy', v_new_id, 'TRANSFER_IN', null, 'active', v_sanitized_reason, 1, statement_timestamp());

  -- Audit event
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_snapshot, after_snapshot, occurred_at)
  values (
    x.tenant_id,
    auth.uid(),
    x.role_code,
    'OCCUPANCY_TRANSFERRED',
    'occupancy',
    v_new_id,
    v_sanitized_reason,
    jsonb_build_object('transferred_from_occupancy_id', p_occupancy_id, 'source_unit_id', v_old_occ.unit_id),
    to_jsonb(v_new_occ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'old_occupancy_id', p_occupancy_id,
    'new_occupancy', to_jsonb(v_new_occ),
    'message', 'Occupancy successfully transferred'
  );
end $function$;

-- 6. Customer API Gateway Wrappers (customer_api schema)

-- 6.1 Get Unit Occupancy Detail
create or replace function customer_api.get_unit_occupancy_detail_v1(
  p_context_id uuid,
  p_unit_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog', 'customer_api', 'occupancy'
as $function$
begin
  return occupancy.get_unit_occupancy_detail(p_context_id, p_unit_id);
exception
  when sqlstate '42501' then raise;
  when sqlstate '22023' then raise;
  when others then
    raise exception 'get_unit_occupancy_detail_failed' using errcode = 'P0001';
end;
$function$;

-- 6.2 Create Occupancy Wrapper
create or replace function customer_api.create_occupancy_v1(
  p_context_id uuid,
  p_unit_id uuid,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_occupant_party_ids uuid[] default null,
  p_role text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'customer_api', 'occupancy'
as $function$
begin
  return occupancy.create_occupancy(
    p_context_id,
    p_unit_id,
    p_kind,
    p_starts_at,
    p_ends_at,
    p_occupant_party_ids,
    p_role,
    p_reason
  );
exception
  when sqlstate '42501' then raise;
  when sqlstate '22023' then raise;
  when sqlstate '40001' then raise;
  when others then
    raise exception 'create_occupancy_failed' using errcode = 'P0001';
end;
$function$;

-- 6.3 Update Occupancy Wrapper
create or replace function customer_api.update_occupancy_v1(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_ends_at timestamptz default null,
  p_status text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'customer_api', 'occupancy'
as $function$
begin
  return occupancy.update_occupancy(
    p_context_id,
    p_occupancy_id,
    p_ends_at,
    p_status,
    p_reason
  );
exception
  when sqlstate '42501' then raise;
  when sqlstate '22023' then raise;
  when others then
    raise exception 'update_occupancy_failed' using errcode = 'P0001';
end;
$function$;

-- 6.4 End Occupancy Wrapper
create or replace function customer_api.end_occupancy_v1(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_ended_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'customer_api', 'occupancy'
as $function$
begin
  return occupancy.end_occupancy(
    p_context_id,
    p_occupancy_id,
    p_ended_at,
    p_reason
  );
exception
  when sqlstate '42501' then raise;
  when sqlstate '22023' then raise;
  when others then
    raise exception 'end_occupancy_failed' using errcode = 'P0001';
end;
$function$;

-- 6.5 Renew Occupancy Wrapper
create or replace function customer_api.renew_occupancy_v1(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_new_ends_at timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'customer_api', 'occupancy'
as $function$
begin
  return occupancy.renew_occupancy(
    p_context_id,
    p_occupancy_id,
    p_new_ends_at,
    p_reason
  );
exception
  when sqlstate '42501' then raise;
  when sqlstate '22023' then raise;
  when others then
    raise exception 'renew_occupancy_failed' using errcode = 'P0001';
end;
$function$;

-- 6.6 Transfer Occupancy Wrapper
create or replace function customer_api.transfer_occupancy_v1(
  p_context_id uuid,
  p_occupancy_id uuid,
  p_to_unit_id uuid,
  p_effective_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'customer_api', 'occupancy'
as $function$
begin
  return occupancy.transfer_occupancy(
    p_context_id,
    p_occupancy_id,
    p_to_unit_id,
    p_effective_at,
    p_reason
  );
exception
  when sqlstate '42501' then raise;
  when sqlstate '22023' then raise;
  when others then
    raise exception 'transfer_occupancy_failed' using errcode = 'P0001';
end;
$function$;

-- 7. Secure Privileges: Revoke from public/anon, Grant only to authenticated
revoke all on function occupancy.get_customer_registry(uuid, text, text, text, text, date, date, integer, integer, uuid) from public, anon;
grant execute on function occupancy.get_customer_registry(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;

revoke all on function occupancy.get_unit_occupancy_detail(uuid, uuid) from public, anon;
grant execute on function occupancy.get_unit_occupancy_detail(uuid, uuid) to authenticated;

revoke all on function occupancy.create_occupancy(uuid, uuid, text, timestamptz, timestamptz, uuid[], text, text) from public, anon;
grant execute on function occupancy.create_occupancy(uuid, uuid, text, timestamptz, timestamptz, uuid[], text, text) to authenticated;

revoke all on function occupancy.update_occupancy(uuid, uuid, timestamptz, text, text) from public, anon;
grant execute on function occupancy.update_occupancy(uuid, uuid, timestamptz, text, text) to authenticated;

revoke all on function occupancy.end_occupancy(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function occupancy.end_occupancy(uuid, uuid, timestamptz, text) to authenticated;

revoke all on function occupancy.renew_occupancy(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function occupancy.renew_occupancy(uuid, uuid, timestamptz, text) to authenticated;

revoke all on function occupancy.transfer_occupancy(uuid, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function occupancy.transfer_occupancy(uuid, uuid, uuid, timestamptz, text) to authenticated;

revoke all on function customer_api.get_unit_occupancy_detail_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.get_unit_occupancy_detail_v1(uuid, uuid) to authenticated;

revoke all on function customer_api.create_occupancy_v1(uuid, uuid, text, timestamptz, timestamptz, uuid[], text, text) from public, anon;
grant execute on function customer_api.create_occupancy_v1(uuid, uuid, text, timestamptz, timestamptz, uuid[], text, text) to authenticated;

revoke all on function customer_api.update_occupancy_v1(uuid, uuid, timestamptz, text, text) from public, anon;
grant execute on function customer_api.update_occupancy_v1(uuid, uuid, timestamptz, text, text) to authenticated;

revoke all on function customer_api.end_occupancy_v1(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function customer_api.end_occupancy_v1(uuid, uuid, timestamptz, text) to authenticated;

revoke all on function customer_api.renew_occupancy_v1(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function customer_api.renew_occupancy_v1(uuid, uuid, timestamptz, text) to authenticated;

revoke all on function customer_api.transfer_occupancy_v1(uuid, uuid, uuid, timestamptz, text) from public, anon;
grant execute on function customer_api.transfer_occupancy_v1(uuid, uuid, uuid, timestamptz, text) to authenticated;

commit;
