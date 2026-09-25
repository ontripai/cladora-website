begin;

-- A separate persona. No workspace, financial or administrator permissions are
-- inherited from the existing owner or owner_portfolio_admin role.
insert into identity.roles(tenant_id,code,name,is_system)
values(null,'multi_unit_owner','Multi-unit owner',true)
on conflict(tenant_id,code) do update set name=excluded.name,is_system=true;

create or replace function app_private.has_multi_unit_owner_role_v1()
returns boolean language sql stable security definer
set search_path=pg_catalog,identity,auth as $$
  select auth.uid() is not null
    and (auth.jwt()->>'aal')='aal2'
    and exists (
      select 1 from identity.memberships m
      join identity.roles r on r.id=m.role_id
      join platform.tenants t on t.id=m.tenant_id
      join auth.users u on u.id=m.user_id
      where m.user_id=auth.uid() and u.email_confirmed_at is not null
        and r.code='multi_unit_owner' and r.is_system and r.tenant_id is null
        and t.status='active' and m.status='active' and m.starts_at<=statement_timestamp()
        and (m.ends_at is null or m.ends_at>statement_timestamp())
    );
$$;
revoke all on function app_private.has_multi_unit_owner_role_v1() from public;
grant execute on function app_private.has_multi_unit_owner_role_v1() to authenticated,service_role;

create or replace function customer_api.my_multi_unit_owner_access_v1()
returns boolean language sql stable security invoker
set search_path=pg_catalog as $$
  select app_private.has_multi_unit_owner_role_v1();
$$;
revoke all on function customer_api.my_multi_unit_owner_access_v1() from public;
grant execute on function customer_api.my_multi_unit_owner_access_v1() to authenticated;

create table public.owner_private_units (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  building_label text not null check(length(btrim(building_label)) between 2 and 160),
  unit_label text not null check(length(btrim(unit_label)) between 1 and 100),
  address_text text not null check(length(btrim(address_text)) between 5 and 500),
  usage_kind text not null default 'residential' check(usage_kind in ('residential','commercial','office','industrial','other')),
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(id,owner_user_id)
);
create index owner_private_units_actor_idx on public.owner_private_units(owner_user_id,status,created_at desc);

create table public.owner_private_leases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  unit_id uuid not null,
  tenant_label text not null check(length(btrim(tenant_label)) between 2 and 160),
  starts_on date not null,
  ends_on date,
  monthly_rent numeric(14,2) not null check(monthly_rent>=0),
  currency char(3) not null default 'RON' check(currency in ('RON','EUR','USD')),
  status text not null default 'draft' check(status in ('draft','active','ended','cancelled')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint owner_private_leases_unit_fk foreign key(unit_id,owner_user_id)
    references public.owner_private_units(id,owner_user_id) on delete restrict,
  check(ends_on is null or ends_on>starts_on)
);
create index owner_private_leases_actor_idx on public.owner_private_leases(owner_user_id,unit_id,starts_on desc);

create table public.owner_private_cash_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  unit_id uuid not null,
  kind text not null check(kind in ('rent','building_charge','owner_expense','tax_reserve','other')),
  direction text not null check(direction in ('income','expense')),
  amount numeric(14,2) not null check(amount>0),
  currency char(3) not null default 'RON' check(currency in ('RON','EUR','USD')),
  due_on date,
  paid_on date,
  memo text check(memo is null or length(memo)<=500),
  source text not null default 'self_reported' check(source='self_reported'),
  created_at timestamptz not null default statement_timestamp(),
  constraint owner_private_cash_entries_unit_fk foreign key(unit_id,owner_user_id)
    references public.owner_private_units(id,owner_user_id) on delete restrict
);
create index owner_private_cash_entries_actor_idx on public.owner_private_cash_entries(owner_user_id,unit_id,created_at desc);

alter table public.owner_private_units enable row level security;
alter table public.owner_private_leases enable row level security;
alter table public.owner_private_cash_entries enable row level security;

create policy owner_private_units_read on public.owner_private_units for select to authenticated
using(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));
create policy owner_private_units_insert on public.owner_private_units for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));
create policy owner_private_units_update on public.owner_private_units for update to authenticated
using(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()))
with check(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));

create policy owner_private_leases_read on public.owner_private_leases for select to authenticated
using(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));
create policy owner_private_leases_insert on public.owner_private_leases for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));
create policy owner_private_leases_update on public.owner_private_leases for update to authenticated
using(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()))
with check(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));

create policy owner_private_cash_entries_read on public.owner_private_cash_entries for select to authenticated
using(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));
create policy owner_private_cash_entries_insert on public.owner_private_cash_entries for insert to authenticated
with check(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));
create policy owner_private_cash_entries_update on public.owner_private_cash_entries for update to authenticated
using(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()))
with check(owner_user_id=(select auth.uid()) and (select app_private.has_multi_unit_owner_role_v1()));

grant select,insert,update on public.owner_private_units,public.owner_private_leases,public.owner_private_cash_entries to authenticated;
grant all on public.owner_private_units,public.owner_private_leases,public.owner_private_cash_entries to service_role;

commit;
