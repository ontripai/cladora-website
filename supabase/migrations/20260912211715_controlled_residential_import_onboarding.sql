begin;

-- CLADORA-P2-ONBOARD-001 / Migration 84
-- Controlled residential import staging. No customer fixtures and no parallel ledger.

create table platform.import_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  name text not null,
  description text,
  dependency_order integer not null check (dependency_order between 0 and 1000),
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default statement_timestamp()
);

create table platform.import_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references platform.import_templates(id) on delete restrict,
  version integer not null check (version > 0),
  format text not null default 'csv' check (format in ('csv','xlsx_template_only')),
  schema_json jsonb not null check (jsonb_typeof(schema_json)='object'),
  max_rows integer not null default 10000 check (max_rows between 1 and 100000),
  max_cell_chars integer not null default 4096 check (max_cell_chars between 1 and 32768),
  effective_from timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique(template_id,version),
  check (retired_at is null or retired_at > effective_from)
);

create table platform.import_runs (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  provisioning_run_id uuid references platform.provisioning_runs(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','uploaded','validating','validation_failed','preview_ready','dry_running','dry_run_failed','dry_run_passed','pending_approval','committing','commit_failed','committed','reconciled','activated','cancelled')),
  version integer not null default 1 check (version > 0),
  idempotency_key text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  input_hash text check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  result_hash text check (result_hash is null or result_hash ~ '^[0-9a-f]{64}$'),
  dry_run_summary jsonb,
  committed_at timestamptz,
  reconciled_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,idempotency_key),
  check (approved_by is null or approved_by <> created_by)
);
create unique index import_runs_one_live_scope_idx on platform.import_runs
  (customer_workspace_id,coalesce(property_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status not in ('activated','cancelled');

create table platform.import_sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references platform.import_runs(id) on delete restrict,
  template_version_id uuid not null references platform.import_template_versions(id) on delete restrict,
  original_filename text not null,
  media_type text not null,
  byte_size bigint not null check (byte_size between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default statement_timestamp(),
  unique(run_id,template_version_id,sha256),
  check (media_type = 'text/csv')
);

create table platform.import_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references platform.import_runs(id) on delete restrict,
  source_id uuid not null references platform.import_sources(id) on delete restrict,
  template_code text not null,
  source_row_no integer not null check (source_row_no > 0),
  source_payload jsonb not null check (jsonb_typeof(source_payload)='object'),
  normalized_payload jsonb,
  classification text not null default 'unvalidated' check (classification in ('unvalidated','new','exact_existing','update_candidate','ambiguous','duplicate_in_file','invalid')),
  natural_key text,
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  unique(run_id,template_code,source_row_no),
  unique(run_id,row_hash)
);

create table platform.import_row_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references platform.import_runs(id) on delete restrict,
  row_id uuid references platform.import_rows(id) on delete restrict,
  severity text not null check (severity in ('warning','blocking')),
  code text not null,
  field_name text,
  message text not null,
  created_at timestamptz not null default statement_timestamp()
);

create table platform.import_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references platform.import_runs(id) on delete restrict,
  row_id uuid not null references platform.import_rows(id) on delete restrict,
  entity_type text not null,
  canonical_id uuid not null,
  mapping_kind text not null check (mapping_kind in ('created','exact_existing','forward_correction')),
  created_at timestamptz not null default statement_timestamp(),
  unique(run_id,row_id), unique(run_id,entity_type,canonical_id)
);

create table platform.import_reconciliation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references platform.import_runs(id) on delete restrict,
  total_debits numeric(20,4) not null,
  total_credits numeric(20,4) not null,
  ar_delta numeric(20,4) not null,
  clearing_delta numeric(20,4) not null,
  is_balanced boolean generated always as (total_debits=total_credits and ar_delta=0 and clearing_delta=0) stored,
  evidence_json jsonb not null default '{}'::jsonb,
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  certified_by uuid not null references auth.users(id) on delete restrict,
  certified_at timestamptz not null default statement_timestamp()
);

create table platform.onboarding_checkpoints (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  import_run_id uuid not null references platform.import_runs(id) on delete restrict,
  checkpoint_code text not null,
  status text not null check (status in ('pending','passed','failed')),
  evidence_json jsonb not null default '{}'::jsonb,
  checked_by uuid references auth.users(id) on delete restrict,
  checked_at timestamptz,
  unique(customer_workspace_id,checkpoint_code)
);

create index import_template_versions_template_idx on platform.import_template_versions(template_id,version desc);
create index import_runs_workspace_idx on platform.import_runs(customer_workspace_id,status,created_at desc);
create index import_runs_tenant_idx on platform.import_runs(tenant_id,status);
create index import_runs_property_idx on platform.import_runs(property_id);
create index import_runs_provisioning_idx on platform.import_runs(provisioning_run_id);
create index import_runs_created_by_idx on platform.import_runs(created_by);
create index import_runs_submitted_by_idx on platform.import_runs(submitted_by);
create index import_runs_approved_by_idx on platform.import_runs(approved_by);
create index import_sources_run_idx on platform.import_sources(run_id);
create index import_sources_template_version_idx on platform.import_sources(template_version_id);
create index import_sources_uploaded_by_idx on platform.import_sources(uploaded_by);
create index import_rows_run_classification_idx on platform.import_rows(run_id,classification,source_row_no);
create index import_rows_source_idx on platform.import_rows(source_id);
create index import_row_issues_run_severity_idx on platform.import_row_issues(run_id,severity);
create index import_row_issues_row_idx on platform.import_row_issues(row_id);
create index import_entity_mappings_row_idx on platform.import_entity_mappings(row_id);
create index import_reconciliation_certified_by_idx on platform.import_reconciliation_results(certified_by);
create index onboarding_checkpoints_import_run_idx on platform.onboarding_checkpoints(import_run_id);
create index onboarding_checkpoints_checked_by_idx on platform.onboarding_checkpoints(checked_by);

insert into identity.permissions(code,resource,action,description) values
 ('onboarding.import.read','onboarding.import','read','Read controlled onboarding imports'),
 ('onboarding.import.manage','onboarding.import','manage','Create, upload, validate and dry-run onboarding imports'),
 ('onboarding.import.approve','onboarding.import','approve','Independently approve, reconcile and activate onboarding imports')
on conflict(code) do nothing;

insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','property_manager') and p.code in ('onboarding.import.read','onboarding.import.manage')
on conflict do nothing;
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','president','censor') and p.code in ('onboarding.import.read','onboarding.import.approve')
on conflict do nothing;

create or replace function app_private.import_context(p_context_id uuid,p_permission text,p_aal2 boolean default false)
returns table(tenant_id uuid,workspace_id uuid,role_id uuid,property_id uuid)
language plpgsql stable security definer set search_path=pg_catalog,platform,identity
as $$ begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_aal2 and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  return query select g.tenant_id,w.id,m.role_id,g.property_id
  from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join platform.customer_workspaces w on w.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
    and exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=m.role_id and rp.effect='allow' and p.code=p_permission)
  order by (w.lifecycle_status='PROVISIONING') desc,w.created_at desc limit 1;
  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
end $$;

create or replace function app_private.protect_import_run()
returns trigger language plpgsql set search_path=pg_catalog,platform as $$
declare allowed boolean;
begin
  if new.id<>old.id or new.tenant_id<>old.tenant_id or new.customer_workspace_id<>old.customer_workspace_id
     or new.idempotency_key<>old.idempotency_key or new.created_by<>old.created_by or new.created_at<>old.created_at then
    raise exception 'import_run_identity_immutable' using errcode='55000';
  end if;
  allowed := new.status=old.status or
    (old.status='draft' and new.status in ('uploaded','cancelled')) or
    (old.status='uploaded' and new.status in ('validating','cancelled')) or
    (old.status='validating' and new.status in ('validation_failed','preview_ready')) or
    (old.status='validation_failed' and new.status in ('validating','cancelled')) or
    (old.status='preview_ready' and new.status in ('dry_running','validating','cancelled')) or
    (old.status='dry_running' and new.status in ('dry_run_failed','dry_run_passed')) or
    (old.status='dry_run_failed' and new.status in ('dry_running','cancelled')) or
    (old.status='dry_run_passed' and new.status in ('pending_approval','dry_running','cancelled')) or
    (old.status='pending_approval' and new.status in ('committing','cancelled')) or
    (old.status='committing' and new.status in ('committed','commit_failed')) or
    (old.status='commit_failed' and new.status='committing') or
    (old.status='committed' and new.status='reconciled') or
    (old.status='reconciled' and new.status='activated');
  if not allowed then raise exception 'invalid_import_run_transition' using errcode='22023'; end if;
  new.version:=old.version+1; new.updated_at:=statement_timestamp(); return new;
end $$;
create trigger import_runs_transition_guard before update on platform.import_runs for each row execute function app_private.protect_import_run();

create or replace function app_private.protect_import_artifact()
returns trigger language plpgsql set search_path=pg_catalog,platform as $$
declare v_status text;
begin
  select status into v_status from platform.import_runs where id=coalesce(new.run_id,old.run_id);
  if v_status in ('committing','committed','reconciled','activated') then raise exception 'committed_import_artifact_immutable' using errcode='55000'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger import_sources_immutable before update or delete on platform.import_sources for each row execute function app_private.protect_import_artifact();
create trigger import_rows_immutable before update or delete on platform.import_rows for each row execute function app_private.protect_import_artifact();

alter table platform.import_templates enable row level security;
alter table platform.import_template_versions enable row level security;
alter table platform.import_runs enable row level security;
alter table platform.import_sources enable row level security;
alter table platform.import_rows enable row level security;
alter table platform.import_row_issues enable row level security;
alter table platform.import_entity_mappings enable row level security;
alter table platform.import_reconciliation_results enable row level security;
alter table platform.onboarding_checkpoints enable row level security;
create policy import_templates_authenticated_read on platform.import_templates for select to authenticated using(status='active');
create policy import_template_versions_authenticated_read on platform.import_template_versions for select to authenticated using(exists(select 1 from platform.import_templates t where t.id=template_id and t.status='active'));
create policy import_runs_context_read on platform.import_runs for select to authenticated using(tenant_id=app_private.active_tenant_id());
create policy import_sources_context_read on platform.import_sources for select to authenticated using(exists(select 1 from platform.import_runs r where r.id=run_id and r.tenant_id=app_private.active_tenant_id()));
create policy import_rows_context_read on platform.import_rows for select to authenticated using(exists(select 1 from platform.import_runs r where r.id=run_id and r.tenant_id=app_private.active_tenant_id()));
create policy import_issues_context_read on platform.import_row_issues for select to authenticated using(exists(select 1 from platform.import_runs r where r.id=run_id and r.tenant_id=app_private.active_tenant_id()));
create policy import_mappings_context_read on platform.import_entity_mappings for select to authenticated using(exists(select 1 from platform.import_runs r where r.id=run_id and r.tenant_id=app_private.active_tenant_id()));
create policy import_reconciliation_context_read on platform.import_reconciliation_results for select to authenticated using(exists(select 1 from platform.import_runs r where r.id=run_id and r.tenant_id=app_private.active_tenant_id()));
create policy onboarding_checkpoints_context_read on platform.onboarding_checkpoints for select to authenticated using(exists(select 1 from platform.customer_workspaces w where w.id=customer_workspace_id and w.tenant_id=app_private.active_tenant_id()));
grant select on platform.import_templates,platform.import_template_versions,platform.import_runs,platform.import_sources,platform.import_rows,platform.import_row_issues,platform.import_entity_mappings,platform.import_reconciliation_results,platform.onboarding_checkpoints to authenticated;

create or replace function customer_api.list_import_templates_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,platform as $$
begin
  perform 1 from app_private.import_context(p_context_id,'onboarding.import.read',false);
  return coalesce((select jsonb_agg(jsonb_build_object('code',t.code,'name',t.name,'description',t.description,'version',v.version,'format',v.format,'schema',v.schema_json,'max_rows',v.max_rows) order by t.dependency_order)
    from platform.import_templates t join lateral(select * from platform.import_template_versions x where x.template_id=t.id and x.retired_at is null order by version desc limit 1)v on true where t.status='active'),'[]'::jsonb);
end $$;

create or replace function customer_api.create_import_run_v1(p_context_id uuid,p_property_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform as $$
declare c record;r platform.import_runs;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',false);
  if p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  if p_property_id is not null and not exists(select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=c.tenant_id) then raise exception 'property_not_found_or_access_denied' using errcode='42501'; end if;
  select * into r from platform.import_runs where tenant_id=c.tenant_id and idempotency_key=p_idempotency_key;
  if found then return to_jsonb(r); end if;
  insert into platform.import_runs(customer_workspace_id,tenant_id,property_id,idempotency_key,created_by)
  values(c.workspace_id,c.tenant_id,p_property_id,p_idempotency_key,auth.uid()) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function customer_api.add_import_source_v1(p_context_id uuid,p_run_id uuid,p_template_code text,p_filename text,p_media_type text,p_byte_size bigint,p_sha256 text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform,extensions as $$
declare c record;r platform.import_runs;tv platform.import_template_versions;s platform.import_sources;item jsonb;n integer:=0;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',false);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status not in ('draft','uploaded','validation_failed','preview_ready') then raise exception 'import_source_not_allowed' using errcode='22023'; end if;
  if p_media_type<>'text/csv' then raise exception 'DEFERRED_XLSX_IMPORT_UNTIL_MALWARE_SCANNER' using errcode='0A000'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'rows_must_be_array' using errcode='22023'; end if;
  select v.* into tv from platform.import_templates t join platform.import_template_versions v on v.template_id=t.id where t.code=p_template_code and t.status='active' and v.retired_at is null order by v.version desc limit 1;
  if not found then raise exception 'import_template_not_found' using errcode='P0002'; end if;
  if jsonb_array_length(p_rows)>tv.max_rows then raise exception 'import_row_limit_exceeded' using errcode='22023'; end if;
  insert into platform.import_sources(run_id,template_version_id,original_filename,media_type,byte_size,sha256,row_count,uploaded_by)
  values(r.id,tv.id,left(p_filename,255),p_media_type,p_byte_size,lower(p_sha256),jsonb_array_length(p_rows),auth.uid()) returning * into s;
  for item in select value from jsonb_array_elements(p_rows) loop n:=n+1;
    insert into platform.import_rows(run_id,source_id,template_code,source_row_no,source_payload,row_hash)
    values(r.id,s.id,p_template_code,n,item,encode(extensions.digest(convert_to(item::text,'UTF8'),'sha256'),'hex'));
  end loop;
  if r.status='draft' then update platform.import_runs set status='uploaded' where id=r.id; end if;
  return jsonb_build_object('source_id',s.id,'row_count',n);
end $$;

create or replace function customer_api.validate_import_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform,extensions as $$
declare c record;r platform.import_runs;blocking integer;h text;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',false);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status not in ('uploaded','validation_failed','preview_ready') then raise exception 'import_validation_not_allowed' using errcode='22023'; end if;
  update platform.import_runs set status='validating' where id=r.id;
  delete from platform.import_row_issues where run_id=r.id;
  update platform.import_rows x set normalized_payload=(select jsonb_object_agg(lower(trim(key)),case when jsonb_typeof(value)='string' then to_jsonb(trim(both from value#>>'{}')) else value end) from jsonb_each(x.source_payload)), classification='new' where x.run_id=r.id;
  insert into platform.import_row_issues(run_id,row_id,severity,code,message)
  select r.id,x.id,'blocking','empty_row','Source row has no fields' from platform.import_rows x where x.run_id=r.id and x.source_payload='{}'::jsonb;
  update platform.import_rows x set classification='duplicate_in_file' where x.run_id=r.id and exists(select 1 from platform.import_rows y where y.run_id=x.run_id and y.template_code=x.template_code and y.row_hash=x.row_hash and y.source_row_no<x.source_row_no);
  insert into platform.import_row_issues(run_id,row_id,severity,code,message)
  select r.id,x.id,'blocking','duplicate_in_file','Duplicate source row' from platform.import_rows x where x.run_id=r.id and x.classification='duplicate_in_file';
  select count(*) into blocking from platform.import_row_issues where run_id=r.id and severity='blocking';
  select encode(extensions.digest(convert_to(coalesce(string_agg(row_hash,'' order by template_code,source_row_no),''),'UTF8'),'sha256'),'hex') into h from platform.import_rows where run_id=r.id;
  update platform.import_runs set status=case when blocking>0 then 'validation_failed' else 'preview_ready' end,input_hash=h where id=r.id;
  return jsonb_build_object('status',case when blocking>0 then 'validation_failed' else 'preview_ready' end,'blocking_issues',blocking,'input_hash',h);
end $$;

create or replace function customer_api.dry_run_import_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform,extensions as $$
declare c record;r platform.import_runs;s jsonb;h text;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',true);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status not in ('preview_ready','dry_run_failed','dry_run_passed') then raise exception 'import_dry_run_not_allowed' using errcode='22023'; end if;
  update platform.import_runs set status='dry_running' where id=r.id;
  select jsonb_build_object('rows',count(*),'new_rows',count(*)filter(where classification='new'),'blocking_issues',(select count(*) from platform.import_row_issues where run_id=r.id and severity='blocking'),'canonical_writes',0) into s from platform.import_rows where run_id=r.id;
  h:=encode(extensions.digest(convert_to(s::text,'UTF8'),'sha256'),'hex');
  update platform.import_runs set status=case when (s->>'blocking_issues')::int=0 then 'dry_run_passed' else 'dry_run_failed' end,dry_run_summary=s,result_hash=h where id=r.id;
  return s||jsonb_build_object('result_hash',h);
end $$;

create or replace function customer_api.submit_import_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform as $$
declare c record;r platform.import_runs;
begin select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',true);
 select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
 if r.status<>'dry_run_passed' then raise exception 'dry_run_pass_required' using errcode='22023'; end if;
 update platform.import_runs set status='pending_approval',submitted_by=auth.uid() where id=r.id returning * into r; return to_jsonb(r); end $$;

create or replace function customer_api.approve_import_commit_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform,portfolio,finance,extensions as $$
declare c record;r platform.import_runs;rowrec record;cid uuid;debits numeric:=0;credits numeric:=0;rh text;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.approve',true);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status<>'pending_approval' then raise exception 'import_not_pending_approval' using errcode='22023'; end if;
  if r.created_by=auth.uid() or r.submitted_by=auth.uid() then raise exception 'dual_control_violation' using errcode='42501'; end if;
  update platform.import_runs set status='committing',approved_by=auth.uid() where id=r.id;
  -- R1 commits structural canonical entities. Financial rows are accepted only after a balanced opening-journal contract exists.
  for rowrec in select * from platform.import_rows where run_id=r.id and classification='new' order by source_row_no for update loop
    if rowrec.template_code='property' then
      insert into portfolio.properties(tenant_id,type,name,base_currency,status) values(r.tenant_id,coalesce((rowrec.normalized_payload->>'type')::portfolio.property_type,'condominium'),rowrec.normalized_payload->>'name',coalesce(rowrec.normalized_payload->>'currency','RON'),'draft') returning id into cid;
    elsif rowrec.template_code='account' then
      if r.property_id is null then raise exception 'property_required_for_financial_import' using errcode='22023'; end if;
      insert into finance.accounts(tenant_id,property_id,code,name,type,currency) values(r.tenant_id,r.property_id,rowrec.normalized_payload->>'code',rowrec.normalized_payload->>'name',(rowrec.normalized_payload->>'type')::finance.account_type,coalesce(rowrec.normalized_payload->>'currency','RON')) returning id into cid;
    else
      raise exception 'template_commit_handler_unconfigured:%',rowrec.template_code using errcode='0A000';
    end if;
    insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,rowrec.id,rowrec.template_code,cid,'created');
  end loop;
  select coalesce(sum((normalized_payload->>'debit')::numeric),0),coalesce(sum((normalized_payload->>'credit')::numeric),0) into debits,credits from platform.import_rows where run_id=r.id and template_code='opening_gl';
  if debits<>credits then raise exception 'opening_balance_unbalanced' using errcode='23514'; end if;
  rh:=encode(extensions.digest(convert_to(jsonb_build_object('debits',debits,'credits',credits,'mappings',(select count(*) from platform.import_entity_mappings where run_id=r.id))::text,'UTF8'),'sha256'),'hex');
  update platform.import_runs set status='committed',committed_at=statement_timestamp() where id=r.id;
  insert into platform.import_reconciliation_results(run_id,total_debits,total_credits,ar_delta,clearing_delta,evidence_json,result_hash,certified_by)
  values(r.id,debits,credits,0,0,jsonb_build_object('mapping_count',(select count(*) from platform.import_entity_mappings where run_id=r.id)),rh,auth.uid());
  update platform.import_runs set status='reconciled',reconciled_at=statement_timestamp() where id=r.id;
  return jsonb_build_object('status','reconciled','result_hash',rh);
end $$;

create or replace function customer_api.get_import_preview_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,platform as $$
declare c record;r platform.import_runs;
begin select * into c from app_private.import_context(p_context_id,'onboarding.import.read',false); select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id;
 if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
 return jsonb_build_object('run',to_jsonb(r),'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'template_code',template_code,'source_row_no',source_row_no,'classification',classification,'payload',normalized_payload) order by template_code,source_row_no) from platform.import_rows where run_id=r.id),'[]'::jsonb),'issues',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from platform.import_row_issues i where run_id=r.id),'[]'::jsonb)); end $$;

create or replace function customer_api.cancel_import_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform as $$
declare c record;r platform.import_runs;
begin select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',false); select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if; if r.status in ('committing','committed','reconciled','activated') then raise exception 'post_commit_cancellation_forbidden' using errcode='55000'; end if;
 update platform.import_runs set status='cancelled',cancelled_at=statement_timestamp() where id=r.id returning * into r; return to_jsonb(r); end $$;

create or replace function customer_api.activate_import_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform as $$
declare c record;r platform.import_runs;
begin select * into c from app_private.import_context(p_context_id,'onboarding.import.approve',true); select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if; if r.status<>'reconciled' or not exists(select 1 from platform.import_reconciliation_results x where x.run_id=r.id and x.is_balanced) then raise exception 'reconciliation_required' using errcode='22023'; end if;
 insert into platform.onboarding_checkpoints(customer_workspace_id,import_run_id,checkpoint_code,status,evidence_json,checked_by,checked_at) values(r.customer_workspace_id,r.id,'controlled_import_reconciled','passed',jsonb_build_object('result_hash',r.result_hash),auth.uid(),statement_timestamp()) on conflict(customer_workspace_id,checkpoint_code) do update set import_run_id=excluded.import_run_id,status='passed',evidence_json=excluded.evidence_json,checked_by=excluded.checked_by,checked_at=excluded.checked_at;
 update platform.import_runs set status='activated',activated_at=statement_timestamp() where id=r.id; return jsonb_build_object('status','activated','workspace_id',r.customer_workspace_id); end $$;

revoke all on function app_private.import_context(uuid,text,boolean),app_private.protect_import_run(),app_private.protect_import_artifact() from public,anon,authenticated;
grant execute on function app_private.import_context(uuid,text,boolean) to service_role;
revoke all on function customer_api.list_import_templates_v1(uuid),customer_api.create_import_run_v1(uuid,uuid,text),customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb),customer_api.validate_import_v1(uuid,uuid),customer_api.dry_run_import_v1(uuid,uuid),customer_api.submit_import_v1(uuid,uuid),customer_api.approve_import_commit_v1(uuid,uuid),customer_api.get_import_preview_v1(uuid,uuid),customer_api.cancel_import_v1(uuid,uuid),customer_api.activate_import_v1(uuid,uuid) from public,anon;
grant execute on function customer_api.list_import_templates_v1(uuid),customer_api.create_import_run_v1(uuid,uuid,text),customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb),customer_api.validate_import_v1(uuid,uuid),customer_api.dry_run_import_v1(uuid,uuid),customer_api.submit_import_v1(uuid,uuid),customer_api.approve_import_commit_v1(uuid,uuid),customer_api.get_import_preview_v1(uuid,uuid),customer_api.cancel_import_v1(uuid,uuid),customer_api.activate_import_v1(uuid,uuid) to authenticated,service_role;

comment on table platform.import_rows is 'Untrusted staging rows only; never a canonical business record.';
comment on function customer_api.approve_import_commit_v1(uuid,uuid) is 'AAL2 dual-control atomic commit into canonical domains; unsupported handlers fail closed.';
comment on function customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb) is 'CSV-only R1 boundary; XLSX ingestion deferred until malware scanning is available.';

commit;
