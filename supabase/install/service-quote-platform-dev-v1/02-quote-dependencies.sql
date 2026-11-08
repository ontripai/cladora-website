-- Exact narrow canonical Quote DDL + nullable historical provenance; no data backfill.
-- Coordinator drafts only; no consent, order, payment, work order or user grants.
insert into identity.permissions(code,resource,action,description) values
 ('services.quotes.manage','services.quotes','manage','Review workspace requests and create non-binding quote drafts') on conflict(code) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2)
select m.id,p.id,'manage',false,true from platform.module_definitions m cross join identity.permissions p
where m.code='services_orders' and m.version=1 and p.code='services.quotes.manage'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

alter table service_catalog.requests add constraint service_request_quote_target_uq unique(tenant_id,workspace_id,id,published_revision_id,beneficiary_party_id);
create table service_catalog.quote_drafts(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, workspace_id uuid not null,
 request_id uuid not null, published_revision_id uuid not null, beneficiary_party_id uuid not null,
 version integer not null check(version between 1 and 1000000000), status text not null default 'draft' check(status='draft'),
 scope text not null check(scope=btrim(scope) and length(scope) between 5 and 5000),
 total_minor numeric(18,0) not null check(total_minor between 0 and 999999999999999999),
 currency text not null check(currency in('RON','EUR','GBP','USD')),
 valid_until timestamptz not null check(isfinite(valid_until)),
 created_by uuid not null references auth.users(id), membership_id uuid not null references identity.memberships(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,workspace_id,request_id,version),
 foreign key(tenant_id,workspace_id,request_id,published_revision_id,beneficiary_party_id)
 references service_catalog.requests(tenant_id,workspace_id,id,published_revision_id,beneficiary_party_id),
 check(valid_until>created_at)
);
create index service_quote_creator_idx on service_catalog.quote_drafts(created_by);
create index service_quote_member_idx on service_catalog.quote_drafts(membership_id);
create index service_request_coordinator_idx on service_catalog.requests(tenant_id,workspace_id,created_at desc,id) where status='submitted';
alter table service_catalog.quote_drafts enable row level security;
revoke all on service_catalog.quote_drafts from public,anon,authenticated,service_role;
create function app_private.service_quote_immutable_v1() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'quote_versions_are_immutable' using errcode='23514'; end;$$;
create trigger service_quote_immutable before update or delete on service_catalog.quote_drafts for each row execute function app_private.service_quote_immutable_v1();
revoke all on function app_private.service_quote_immutable_v1() from public,anon,authenticated,service_role;

alter table service_catalog.quote_drafts
  add column request_version bigint;
alter table service_catalog.quote_drafts
  add constraint service_quote_request_version_positive_safe
  check (request_version is null or request_version between 1 and 9007199254740991);


alter table service_catalog.quote_drafts force row level security;
