begin;

create type finance.monthly_cycle_status as enum (
  'draft','collecting','calculated','pending_review','approved','published','close_ready','closed','cancelled'
);

create table finance.monthly_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  accounting_period_id uuid not null references finance.accounting_periods(id) on delete restrict,
  allocation_run_id uuid references finance.allocation_runs(id) on delete restrict,
  status finance.monthly_cycle_status not null default 'draft',
  currency char(3) not null default 'RON',
  version integer not null default 1 check(version>0),
  prepared_by uuid not null references auth.users(id) on delete restrict,
  source_hash text check(source_hash is null or source_hash~'^[0-9a-f]{64}$'),
  calculated_at timestamptz, submitted_at timestamptz, approved_at timestamptz,
  published_at timestamptz, closed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(property_id,accounting_period_id),
  check(currency=upper(currency))
);
create index monthly_cycles_tenant_status_idx on finance.monthly_cycles(tenant_id,status,created_at desc);
create index monthly_cycles_property_idx on finance.monthly_cycles(property_id);
create index monthly_cycles_period_idx on finance.monthly_cycles(accounting_period_id);
create index monthly_cycles_allocation_idx on finance.monthly_cycles(allocation_run_id);
create index monthly_cycles_prepared_by_idx on finance.monthly_cycles(prepared_by);

create table finance.monthly_cycle_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  cycle_id uuid not null references finance.monthly_cycles(id) on delete restrict,
  source_type text not null check(source_type in ('provider_invoice','meter_reading','allocation_run')),
  source_id uuid not null,
  source_snapshot jsonb not null,
  source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),
  captured_by uuid not null references auth.users(id) on delete restrict,
  captured_at timestamptz not null default statement_timestamp(),
  unique(cycle_id,source_type,source_id)
);
create index monthly_cycle_sources_tenant_idx on finance.monthly_cycle_sources(tenant_id);
create index monthly_cycle_sources_cycle_idx on finance.monthly_cycle_sources(cycle_id);
create index monthly_cycle_sources_captured_by_idx on finance.monthly_cycle_sources(captured_by);

create table finance.monthly_cycle_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  cycle_id uuid not null references finance.monthly_cycles(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_role text not null check(reviewer_role in ('president','censor')),
  decision text not null check(decision in ('approved','rejected')),
  note text,
  evidence_hash text not null check(evidence_hash~'^[0-9a-f]{64}$'),
  reviewed_at timestamptz not null default statement_timestamp(),
  unique(cycle_id,reviewer_role),
  constraint monthly_cycle_reviews_reviewer_unique unique(cycle_id,reviewer_user_id)
);
create index monthly_cycle_reviews_tenant_idx on finance.monthly_cycle_reviews(tenant_id);
create index monthly_cycle_reviews_cycle_idx on finance.monthly_cycle_reviews(cycle_id);
create index monthly_cycle_reviews_user_idx on finance.monthly_cycle_reviews(reviewer_user_id);

create table finance.monthly_cycle_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  cycle_id uuid not null unique references finance.monthly_cycles(id) on delete restrict,
  snapshot_json jsonb not null,
  snapshot_hash text not null unique check(snapshot_hash~'^[0-9a-f]{64}$'),
  published_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default statement_timestamp()
);
create index monthly_cycle_publications_tenant_idx on finance.monthly_cycle_publications(tenant_id);
create index monthly_cycle_publications_published_by_idx on finance.monthly_cycle_publications(published_by);

create table finance.monthly_cycle_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  cycle_id uuid not null references finance.monthly_cycles(id) on delete restrict,
  severity text not null check(severity in ('warning','blocking')),
  code text not null,
  detail_json jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text,
  created_at timestamptz not null default statement_timestamp(),
  check((resolved_at is null)=(resolved_by is null))
);
create index monthly_cycle_exceptions_tenant_idx on finance.monthly_cycle_exceptions(tenant_id);
create index monthly_cycle_exceptions_cycle_idx on finance.monthly_cycle_exceptions(cycle_id,severity,resolved_at);
create index monthly_cycle_exceptions_resolved_by_idx on finance.monthly_cycle_exceptions(resolved_by);

insert into identity.permissions(code,resource,action,description) values
 ('finance.monthly.read','finance.monthly','read','Read monthly financial cycles'),
 ('finance.monthly.manage','finance.monthly','manage','Prepare monthly financial cycles'),
 ('finance.monthly.review','finance.monthly','review','Review and publish monthly financial cycles')
on conflict(code) do nothing;
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','property_manager') and p.code in ('finance.monthly.read','finance.monthly.manage')
on conflict do nothing;
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','president','censor') and p.code in ('finance.monthly.read','finance.monthly.review')
on conflict do nothing;

create or replace function app_private.monthly_cycle_context_internal_v1(p_context_id uuid,p_permission text,p_aal2 boolean default false)
returns table(tenant_id uuid,role_code text,property_id uuid)
language plpgsql stable security definer set search_path=pg_catalog,identity
as $$ begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_aal2 and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
 return query select g.tenant_id,r.code,g.property_id from identity.context_grants g
 join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
 join identity.roles r on r.id=m.role_id
 where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
 and m.starts_at<=statement_timestamp() and(m.ends_at is null or m.ends_at>statement_timestamp())
 and g.starts_at<=statement_timestamp() and(g.ends_at is null or g.ends_at>statement_timestamp())
 and exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
   where rp.role_id=m.role_id and rp.effect='allow' and p.code=p_permission);
 if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
end $$;

create or replace function app_private.protect_monthly_cycle_artifact_internal_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog,finance
as $$ declare s finance.monthly_cycle_status; begin
 select status into s from finance.monthly_cycles where id=coalesce(new.cycle_id,old.cycle_id);
 if tg_op='DELETE' or s in ('published','close_ready','closed') then raise exception 'monthly_cycle_artifact_immutable' using errcode='55000'; end if;
 return new;
end $$;
create trigger monthly_cycle_sources_immutable before update or delete on finance.monthly_cycle_sources for each row execute function app_private.protect_monthly_cycle_artifact_internal_v1();
create trigger monthly_cycle_reviews_immutable before update or delete on finance.monthly_cycle_reviews for each row execute function app_private.protect_monthly_cycle_artifact_internal_v1();
create trigger monthly_cycle_publications_immutable before update or delete on finance.monthly_cycle_publications for each row execute function app_private.protect_monthly_cycle_artifact_internal_v1();

create or replace function app_private.create_monthly_cycle_internal_v1(p_context_id uuid,p_property_id uuid,p_period_id uuid,p_currency text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,finance,portfolio
as $$ declare c record;cy finance.monthly_cycles; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.manage',true);
 if c.property_id is not null and c.property_id<>p_property_id then raise exception 'property_scope_denied' using errcode='42501'; end if;
 if not exists(select 1 from portfolio.properties where id=p_property_id and tenant_id=c.tenant_id) then raise exception 'property_not_found' using errcode='P0002'; end if;
 if not exists(select 1 from finance.accounting_periods where id=p_period_id and tenant_id=c.tenant_id and property_id=p_property_id and status='open') then raise exception 'open_accounting_period_required' using errcode='55000'; end if;
 insert into finance.monthly_cycles(tenant_id,property_id,accounting_period_id,currency,prepared_by,status)
 values(c.tenant_id,p_property_id,p_period_id,upper(p_currency),auth.uid(),'collecting') returning * into cy;
 return to_jsonb(cy);
end $$;

create or replace function app_private.capture_monthly_cycle_source_internal_v1(p_context_id uuid,p_cycle_id uuid,p_source_type text,p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,finance,utilities,extensions
as $$ declare c record;cy finance.monthly_cycles;s jsonb;h text; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.manage',true);
 select * into cy from finance.monthly_cycles where id=p_cycle_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'monthly_cycle_not_found' using errcode='P0002'; end if;
 if cy.status<>'collecting' then raise exception 'monthly_source_capture_not_allowed' using errcode='22023'; end if;
 if p_source_type='provider_invoice' then
   select to_jsonb(i) into s from utilities.provider_invoices i join utilities.supply_contracts sc on sc.id=i.contract_id
   where i.id=p_source_id and i.tenant_id=c.tenant_id and sc.property_id=cy.property_id and i.status in ('approved','posted');
 elsif p_source_type='meter_reading' then
   select to_jsonb(r) into s from utilities.meter_readings r join utilities.meters m on m.id=r.meter_id
   where r.id=p_source_id and r.tenant_id=c.tenant_id and m.property_id=cy.property_id and r.status='validated';
 elsif p_source_type='allocation_run' then
   select to_jsonb(a) into s from finance.allocation_runs a where a.id=p_source_id and a.tenant_id=c.tenant_id and a.property_id=cy.property_id and a.status in ('calculated','approved','posted');
 else raise exception 'unsupported_monthly_source' using errcode='22023'; end if;
 if s is null then raise exception 'approved_monthly_source_not_found' using errcode='P0002'; end if;
 h:=encode(extensions.digest(convert_to(s::text,'UTF8'),'sha256'),'hex');
 insert into finance.monthly_cycle_sources(tenant_id,cycle_id,source_type,source_id,source_snapshot,source_hash,captured_by)
 values(c.tenant_id,cy.id,p_source_type,p_source_id,s,h,auth.uid())
 on conflict(cycle_id,source_type,source_id) do nothing;
 return jsonb_build_object('cycle_id',cy.id,'source_type',p_source_type,'source_id',p_source_id,'source_hash',h);
end $$;

create or replace function app_private.submit_monthly_cycle_internal_v1(p_context_id uuid,p_cycle_id uuid,p_allocation_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,finance,extensions
as $$ declare c record;cy finance.monthly_cycles;h text; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.manage',true);
 select * into cy from finance.monthly_cycles where id=p_cycle_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'monthly_cycle_not_found' using errcode='P0002'; end if;
 if cy.status<>'collecting' then raise exception 'monthly_submission_not_allowed' using errcode='22023'; end if;
 if not exists(select 1 from finance.allocation_runs a where a.id=p_allocation_run_id and a.tenant_id=c.tenant_id and a.property_id=cy.property_id and a.status in('approved','posted')) then raise exception 'approved_allocation_required' using errcode='55000'; end if;
 if exists(select 1 from finance.monthly_cycle_exceptions e where e.cycle_id=cy.id and e.severity='blocking' and e.resolved_at is null) then raise exception 'blocking_monthly_exceptions_exist' using errcode='23514'; end if;
 select encode(extensions.digest(convert_to(coalesce(string_agg(source_hash,'' order by source_type,source_id),''),'UTF8'),'sha256'),'hex') into h from finance.monthly_cycle_sources where cycle_id=cy.id;
 update finance.monthly_cycles set allocation_run_id=p_allocation_run_id,status='pending_review',source_hash=h,calculated_at=statement_timestamp(),submitted_at=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where id=cy.id returning * into cy;
 return to_jsonb(cy);
end $$;

create or replace function app_private.review_monthly_cycle_internal_v1(p_context_id uuid,p_cycle_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,finance,extensions
as $$ declare c record;cy finance.monthly_cycles;h text; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.review',true);
 if lower(c.role_code) not in('president','censor') then raise exception 'monthly_statutory_reviewer_required' using errcode='42501'; end if;
 if p_decision not in('approved','rejected') then raise exception 'invalid_monthly_review_decision' using errcode='22023'; end if;
 select * into cy from finance.monthly_cycles where id=p_cycle_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'monthly_cycle_not_found' using errcode='P0002'; end if;
 if cy.status<>'pending_review' then raise exception 'monthly_review_not_allowed' using errcode='22023'; end if;
 if cy.prepared_by=auth.uid() then raise exception 'dual_control_violation' using errcode='42501'; end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_object('cycle',cy.id,'role',lower(c.role_code),'decision',p_decision,'source_hash',cy.source_hash)::text,'UTF8'),'sha256'),'hex');
 insert into finance.monthly_cycle_reviews(tenant_id,cycle_id,reviewer_user_id,reviewer_role,decision,note,evidence_hash)
 values(c.tenant_id,cy.id,auth.uid(),lower(c.role_code),p_decision,left(p_note,1000),h);
 return jsonb_build_object('cycle_id',cy.id,'reviewer_role',lower(c.role_code),'decision',p_decision,'evidence_hash',h);
end $$;

create or replace function app_private.publish_monthly_cycle_internal_v1(p_context_id uuid,p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,finance,billing,extensions
as $$ declare c record;cy finance.monthly_cycles;parity jsonb;s jsonb;h text;pub finance.monthly_cycle_publications; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.review',true);
 select * into cy from finance.monthly_cycles where id=p_cycle_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'monthly_cycle_not_found' using errcode='P0002'; end if;
 if cy.status<>'pending_review' then raise exception 'monthly_publication_not_allowed' using errcode='22023'; end if;
 if (select count(*) from finance.monthly_cycle_reviews where cycle_id=cy.id and decision='approved' and reviewer_role in('president','censor'))<>2 then raise exception 'president_and_censor_approval_required' using errcode='42501'; end if;
 parity:=finance.get_ar_subledger_parity(c.tenant_id,cy.property_id,cy.currency);
 if not coalesce((parity->>'is_continuous_parity')::boolean,false) then raise exception 'continuous_financial_parity_required' using errcode='23514'; end if;
 s:=jsonb_build_object('version',1,'cycle_id',cy.id,'period_id',cy.accounting_period_id,'allocation_run_id',cy.allocation_run_id,'source_hash',cy.source_hash,'parity',parity,'invoice_ids',coalesce((select jsonb_agg(id order by id) from billing.invoices where tenant_id=c.tenant_id and property_id=cy.property_id and allocation_run_id=cy.allocation_run_id),'[]'::jsonb),'reviews',(select jsonb_agg(jsonb_build_object('role',reviewer_role,'decision',decision,'evidence_hash',evidence_hash) order by reviewer_role) from finance.monthly_cycle_reviews where cycle_id=cy.id));
 h:=encode(extensions.digest(convert_to(s::text,'UTF8'),'sha256'),'hex');
 insert into finance.monthly_cycle_publications(tenant_id,cycle_id,snapshot_json,snapshot_hash,published_by) values(c.tenant_id,cy.id,s,h,auth.uid()) returning * into pub;
 update finance.monthly_cycles set status='close_ready',approved_at=statement_timestamp(),published_at=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where id=cy.id;
 return jsonb_build_object('status','close_ready','publication_id',pub.id,'snapshot_hash',h);
end $$;

create or replace function app_private.close_monthly_cycle_internal_v1(p_context_id uuid,p_cycle_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,finance
as $$ declare c record;cy finance.monthly_cycles;r jsonb; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.review',true);
 select * into cy from finance.monthly_cycles where id=p_cycle_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'monthly_cycle_not_found' using errcode='P0002'; end if;
 if cy.status<>'close_ready' then raise exception 'monthly_cycle_not_close_ready' using errcode='22023'; end if;
 r:=finance.close_accounting_period(p_context_id,cy.accounting_period_id,p_reason);
 update finance.monthly_cycles set status='closed',closed_at=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where id=cy.id;
 return r||jsonb_build_object('monthly_cycle_id',cy.id,'monthly_cycle_status','closed');
end $$;

create or replace function app_private.list_monthly_cycles_internal_v1(p_context_id uuid,p_property_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,finance
as $$ declare c record; begin
 select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'finance.monthly.read',false);
 if p_property_id is not null and c.property_id is not null and c.property_id<>p_property_id then raise exception 'property_scope_denied' using errcode='42501'; end if;
 return jsonb_build_object('cycles',coalesce((select jsonb_agg(jsonb_build_object(
   'id',cy.id,'property_id',cy.property_id,'accounting_period_id',cy.accounting_period_id,
   'status',cy.status,'currency',cy.currency,'version',cy.version,'source_hash',cy.source_hash,
   'prepared_by',cy.prepared_by,'submitted_at',cy.submitted_at,'published_at',cy.published_at,
   'closed_at',cy.closed_at,'created_at',cy.created_at,
   'sources',(select count(*) from finance.monthly_cycle_sources s where s.cycle_id=cy.id),
   'approved_reviews',(select count(*) from finance.monthly_cycle_reviews r where r.cycle_id=cy.id and r.decision='approved'),
   'blocking_exceptions',(select count(*) from finance.monthly_cycle_exceptions e where e.cycle_id=cy.id and e.severity='blocking' and e.resolved_at is null),
   'snapshot_hash',(select p.snapshot_hash from finance.monthly_cycle_publications p where p.cycle_id=cy.id)
 ) order by cy.created_at desc) from finance.monthly_cycles cy where cy.tenant_id=c.tenant_id
 and (p_property_id is null or cy.property_id=p_property_id)
 and (c.property_id is null or cy.property_id=c.property_id)),'[]'::jsonb));
end $$;

create or replace function customer_api.list_monthly_cycles_v1(p_context_id uuid,p_property_id uuid default null) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.list_monthly_cycles_internal_v1(p_context_id,p_property_id)$$;
create or replace function customer_api.create_monthly_cycle_v1(p_context_id uuid,p_property_id uuid,p_period_id uuid,p_currency text default 'RON') returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.create_monthly_cycle_internal_v1(p_context_id,p_property_id,p_period_id,p_currency)$$;
create or replace function customer_api.capture_monthly_cycle_source_v1(p_context_id uuid,p_cycle_id uuid,p_source_type text,p_source_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.capture_monthly_cycle_source_internal_v1(p_context_id,p_cycle_id,p_source_type,p_source_id)$$;
create or replace function customer_api.submit_monthly_cycle_v1(p_context_id uuid,p_cycle_id uuid,p_allocation_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.submit_monthly_cycle_internal_v1(p_context_id,p_cycle_id,p_allocation_run_id)$$;
create or replace function customer_api.review_monthly_cycle_v1(p_context_id uuid,p_cycle_id uuid,p_decision text,p_note text default null) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.review_monthly_cycle_internal_v1(p_context_id,p_cycle_id,p_decision,p_note)$$;
create or replace function customer_api.publish_monthly_cycle_v1(p_context_id uuid,p_cycle_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.publish_monthly_cycle_internal_v1(p_context_id,p_cycle_id)$$;
create or replace function customer_api.close_monthly_cycle_v1(p_context_id uuid,p_cycle_id uuid,p_reason text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.close_monthly_cycle_internal_v1(p_context_id,p_cycle_id,p_reason)$$;

do $$declare t text;begin foreach t in array array['monthly_cycles','monthly_cycle_sources','monthly_cycle_reviews','monthly_cycle_publications','monthly_cycle_exceptions'] loop execute format('alter table finance.%I enable row level security',t);execute format('revoke all on finance.%I from public,anon,authenticated',t);end loop;end$$;
create policy monthly_cycles_read on finance.monthly_cycles for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
create policy monthly_sources_read on finance.monthly_cycle_sources for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from finance.monthly_cycles c where c.id=cycle_id and app_private.can_access_property(c.property_id)));
create policy monthly_reviews_read on finance.monthly_cycle_reviews for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from finance.monthly_cycles c where c.id=cycle_id and app_private.can_access_property(c.property_id)));
create policy monthly_publications_read on finance.monthly_cycle_publications for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from finance.monthly_cycles c where c.id=cycle_id and app_private.can_access_property(c.property_id)));
create policy monthly_exceptions_read on finance.monthly_cycle_exceptions for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from finance.monthly_cycles c where c.id=cycle_id and app_private.can_access_property(c.property_id)));
grant select on finance.monthly_cycles,finance.monthly_cycle_sources,finance.monthly_cycle_reviews,finance.monthly_cycle_publications,finance.monthly_cycle_exceptions to authenticated;
grant all on finance.monthly_cycles,finance.monthly_cycle_sources,finance.monthly_cycle_reviews,finance.monthly_cycle_publications,finance.monthly_cycle_exceptions to service_role;

revoke all on function app_private.monthly_cycle_context_internal_v1(uuid,text,boolean),app_private.protect_monthly_cycle_artifact_internal_v1(),app_private.list_monthly_cycles_internal_v1(uuid,uuid),app_private.create_monthly_cycle_internal_v1(uuid,uuid,uuid,text),app_private.capture_monthly_cycle_source_internal_v1(uuid,uuid,text,uuid),app_private.submit_monthly_cycle_internal_v1(uuid,uuid,uuid),app_private.review_monthly_cycle_internal_v1(uuid,uuid,text,text),app_private.publish_monthly_cycle_internal_v1(uuid,uuid),app_private.close_monthly_cycle_internal_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app_private.monthly_cycle_context_internal_v1(uuid,text,boolean),app_private.list_monthly_cycles_internal_v1(uuid,uuid),app_private.create_monthly_cycle_internal_v1(uuid,uuid,uuid,text),app_private.capture_monthly_cycle_source_internal_v1(uuid,uuid,text,uuid),app_private.submit_monthly_cycle_internal_v1(uuid,uuid,uuid),app_private.review_monthly_cycle_internal_v1(uuid,uuid,text,text),app_private.publish_monthly_cycle_internal_v1(uuid,uuid),app_private.close_monthly_cycle_internal_v1(uuid,uuid,text) to authenticated,service_role;
revoke all on function customer_api.list_monthly_cycles_v1(uuid,uuid),customer_api.create_monthly_cycle_v1(uuid,uuid,uuid,text),customer_api.capture_monthly_cycle_source_v1(uuid,uuid,text,uuid),customer_api.submit_monthly_cycle_v1(uuid,uuid,uuid),customer_api.review_monthly_cycle_v1(uuid,uuid,text,text),customer_api.publish_monthly_cycle_v1(uuid,uuid),customer_api.close_monthly_cycle_v1(uuid,uuid,text) from public,anon;
grant execute on function customer_api.list_monthly_cycles_v1(uuid,uuid),customer_api.create_monthly_cycle_v1(uuid,uuid,uuid,text),customer_api.capture_monthly_cycle_source_v1(uuid,uuid,text,uuid),customer_api.submit_monthly_cycle_v1(uuid,uuid,uuid),customer_api.review_monthly_cycle_v1(uuid,uuid,text,text),customer_api.publish_monthly_cycle_v1(uuid,uuid),customer_api.close_monthly_cycle_v1(uuid,uuid,text) to authenticated,service_role;
revoke execute on function customer_api.close_accounting_period_v1(uuid,uuid,text) from authenticated;

comment on table finance.monthly_cycles is 'Orchestration state only; canonical invoices, allocations, journals and periods remain authoritative.';
comment on function customer_api.publish_monthly_cycle_v1(uuid,uuid) is 'SECURITY INVOKER gateway; requires president and censor AAL2 approvals plus continuous 4111/419 parity.';
comment on function customer_api.close_accounting_period_v1(uuid,uuid,text) is 'Legacy direct close gateway disabled for authenticated callers by Migration 87; use customer_api.close_monthly_cycle_v1.';

commit;
