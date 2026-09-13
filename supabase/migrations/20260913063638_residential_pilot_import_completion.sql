begin;

-- CLADORA-P2-ONBOARD-002 / Migration 86
-- Residential pilot completion. DDL/routines only; no tenant or fixture rows.

alter table platform.import_rows
  add column if not exists dependency_key text,
  add column if not exists canonical_snapshot jsonb,
  add column if not exists expected_target_hash text
    check (expected_target_hash is null or expected_target_hash ~ '^[0-9a-f]{64}$');

create index if not exists import_rows_run_natural_key_idx
  on platform.import_rows(run_id,template_code,natural_key);

create or replace function app_private.protect_used_import_template_version_internal_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if exists(select 1 from platform.import_sources s where s.template_version_id=old.id) and
     (new.template_id,new.version,new.format,new.schema_json,new.max_rows,new.max_cell_chars,new.effective_from,new.created_at)
       is distinct from
     (old.template_id,old.version,old.format,old.schema_json,old.max_rows,old.max_cell_chars,old.effective_from,old.created_at)
  then raise exception 'used_import_template_version_immutable' using errcode='55000'; end if;
  return new;
end $$;
drop trigger if exists import_template_versions_used_immutable on platform.import_template_versions;
create trigger import_template_versions_used_immutable before update on platform.import_template_versions
for each row execute function app_private.protect_used_import_template_version_internal_v1();

create or replace function app_private.onboarding_mapped_id_internal_v1(
  p_run_id uuid,p_entity_type text,p_natural_key text
) returns uuid language sql stable security invoker set search_path=pg_catalog
as $$
  select m.canonical_id
  from platform.import_entity_mappings m
  join platform.import_rows r on r.id=m.row_id
  where m.run_id=p_run_id and m.entity_type=p_entity_type
    and r.natural_key=lower(trim(p_natural_key))
  limit 1
$$;

create or replace function app_private.onboarding_configure_template_internal_v1(
  p_context_id uuid,p_code text,p_name text,p_description text,
  p_dependency_order integer,p_schema jsonb,p_max_rows integer default 10000
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform
as $$
declare c record;t platform.import_templates;v platform.import_template_versions;n integer;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.approve',true);
  if p_code not in ('property','building','entrance','unit','party','ownership','occupancy','account','opening_gl','open_receivable','meter','meter_reading') then
    raise exception 'unsupported_residential_template' using errcode='22023';
  end if;
  if p_schema is null or jsonb_typeof(p_schema)<>'object' then raise exception 'invalid_template_schema' using errcode='22023'; end if;
  insert into platform.import_templates(code,name,description,dependency_order,status)
  values(p_code,trim(p_name),p_description,p_dependency_order,'active')
  on conflict(code) do update set name=excluded.name,description=excluded.description,dependency_order=excluded.dependency_order,status='active'
  returning * into t;
  perform 1 from platform.import_templates where id=t.id for update;
  select coalesce(max(version),0)+1 into n from platform.import_template_versions where template_id=t.id;
  update platform.import_template_versions set retired_at=statement_timestamp()
    where template_id=t.id and retired_at is null;
  insert into platform.import_template_versions(template_id,version,format,schema_json,max_rows)
  values(t.id,n,'csv',p_schema,p_max_rows) returning * into v;
  return jsonb_build_object('template_id',t.id,'version_id',v.id,'version',n,'code',p_code);
end $$;

create or replace function customer_api.configure_import_template_v1(
  p_context_id uuid,p_code text,p_name text,p_description text,
  p_dependency_order integer,p_schema jsonb,p_max_rows integer default 10000
) returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select app_private.onboarding_configure_template_internal_v1(
  p_context_id,p_code,p_name,p_description,p_dependency_order,p_schema,p_max_rows) $$;

create or replace function app_private.onboarding_validate_import_internal_v1(
  p_context_id uuid,p_run_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform,extensions
as $$
declare c record;r platform.import_runs;blocking integer;warnings integer;h text;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.manage',false);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status not in ('uploaded','validation_failed','preview_ready') then raise exception 'import_validation_not_allowed' using errcode='22023'; end if;
  update platform.import_runs set status='validating' where id=r.id;
  delete from platform.import_row_issues where run_id=r.id;

  update platform.import_rows x set
    normalized_payload=(select jsonb_object_agg(lower(trim(key)),case when jsonb_typeof(value)='string' then to_jsonb(trim(both from value#>>'{}')) else value end) from jsonb_each(x.source_payload)),
    natural_key=lower(trim(coalesce(x.source_payload->>'source_key',''))),
    dependency_key=lower(trim(coalesce(x.source_payload->>'dependency_key',''))),
    classification='new',canonical_snapshot=null,expected_target_hash=null
  where x.run_id=r.id;

  insert into platform.import_row_issues(run_id,row_id,severity,code,field_name,message)
  select r.id,x.id,'blocking','source_key_required','source_key','Every pilot row requires a stable source_key'
  from platform.import_rows x where x.run_id=r.id and coalesce(x.natural_key,'')='';

  insert into platform.import_row_issues(run_id,row_id,severity,code,message)
  select r.id,x.id,'blocking','unsupported_residential_template','Template has no ONBOARD-002 commit contract'
  from platform.import_rows x where x.run_id=r.id and x.template_code not in
    ('property','building','entrance','unit','party','ownership','occupancy','account','opening_gl','open_receivable','meter','meter_reading');

  update platform.import_rows x set classification='duplicate_in_file'
  where x.run_id=r.id and exists(select 1 from platform.import_rows y
    where y.run_id=x.run_id and y.template_code=x.template_code and y.natural_key=x.natural_key and y.source_row_no<x.source_row_no);
  insert into platform.import_row_issues(run_id,row_id,severity,code,message)
  select r.id,x.id,'blocking','duplicate_natural_key','Duplicate source_key in template'
  from platform.import_rows x where x.run_id=r.id and x.classification='duplicate_in_file';

  -- Pilot R1 is insert-only. Existing canonical natural keys are never silently updated.
  update platform.import_rows x set classification='update_candidate'
  where x.run_id=r.id and x.classification='new' and (
    (x.template_code='building' and exists(select 1 from portfolio.buildings b where b.tenant_id=r.tenant_id and b.property_id=r.property_id and lower(b.code)=x.natural_key)) or
    (x.template_code='unit' and exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.tenant_id=r.tenant_id and b.property_id=r.property_id and lower(u.code)=x.natural_key)) or
    (x.template_code='account' and exists(select 1 from finance.accounts a where a.tenant_id=r.tenant_id and a.property_id=r.property_id and lower(a.code)=x.natural_key)) or
    (x.template_code='meter' and exists(select 1 from utilities.meters m where m.tenant_id=r.tenant_id and lower(m.serial_fingerprint)=lower(x.normalized_payload->>'serial_fingerprint')))
  );
  insert into platform.import_row_issues(run_id,row_id,severity,code,message)
  select r.id,x.id,'blocking','existing_record_update_requires_forward_correction','Existing canonical records cannot be changed by the pilot importer'
  from platform.import_rows x where x.run_id=r.id and x.classification='update_candidate';

  insert into platform.import_row_issues(run_id,row_id,severity,code,field_name,message)
  select r.id,x.id,'blocking','dependency_missing','dependency_key','Referenced source row is absent from this import run'
  from platform.import_rows x where x.run_id=r.id and x.template_code in ('entrance','unit','ownership','occupancy','meter','meter_reading','opening_gl','open_receivable')
    and coalesce(x.dependency_key,'')<>'' and not exists(select 1 from platform.import_rows d where d.run_id=r.id and d.natural_key=x.dependency_key);

  insert into platform.import_row_issues(run_id,row_id,severity,code,field_name,message)
  select r.id,x.id,'blocking','amount_invalid','amount','Financial amount must be positive'
  from platform.import_rows x where x.run_id=r.id and x.template_code in ('opening_gl','open_receivable')
    and coalesce((x.normalized_payload->>'amount')::numeric,0)<=0;

  insert into platform.import_row_issues(run_id,row_id,severity,code,field_name,message)
  select r.id,x.id,'blocking','ownership_share_invalid','share','Ownership share must be greater than zero and at most one'
  from platform.import_rows x where x.run_id=r.id and x.template_code='ownership'
    and coalesce((x.normalized_payload->>'share')::numeric,0) not between 0.00000001 and 1;

  insert into platform.import_row_issues(run_id,row_id,severity,code,field_name,message)
  select r.id,x.id,'blocking','required_field_missing',f.field_name,'Required field is missing'
  from platform.import_rows x
  cross join lateral (values
    (case x.template_code
      when 'property' then 'name' when 'building' then 'code' when 'entrance' then 'building_key'
      when 'unit' then 'building_key' when 'party' then 'legal_name' when 'ownership' then 'unit_key'
      when 'occupancy' then 'unit_key' when 'account' then 'code' when 'opening_gl' then 'account_key'
      when 'open_receivable' then 'unit_key' when 'meter' then 'serial_fingerprint'
      when 'meter_reading' then 'meter_key' end)) f(field_name)
  where x.run_id=r.id and f.field_name is not null and nullif(x.normalized_payload->>f.field_name,'') is null;

  insert into platform.import_row_issues(run_id,row_id,severity,code,field_name,message)
  select r.id,(array_agg(x.id order by x.source_row_no))[1],'blocking','ownership_share_total_exceeded','share','Imported ownership shares exceed one for a unit'
  from platform.import_rows x where x.run_id=r.id and x.template_code='ownership'
  group by lower(x.normalized_payload->>'unit_key') having sum((x.normalized_payload->>'share')::numeric)>1;

  select count(*) filter(where severity='blocking'),count(*) filter(where severity='warning') into blocking,warnings
  from platform.import_row_issues where run_id=r.id;
  update platform.import_rows x set classification='invalid' where x.run_id=r.id and exists(
    select 1 from platform.import_row_issues i where i.row_id=x.id and i.severity='blocking') and x.classification='new';
  select encode(extensions.digest(convert_to(coalesce(string_agg(row_hash,'' order by template_code,source_row_no),''),'UTF8'),'sha256'),'hex') into h
  from platform.import_rows where run_id=r.id;
  update platform.import_runs set status=case when blocking>0 then 'validation_failed' else 'preview_ready' end,input_hash=h where id=r.id;
  return jsonb_build_object('status',case when blocking>0 then 'validation_failed' else 'preview_ready' end,'blocking_issues',blocking,'warnings',warnings,'input_hash',h);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_typed_field' using errcode='22023';
end $$;

create or replace function app_private.onboarding_commit_residential_internal_v1(p_run_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform,portfolio,occupancy,finance,billing,utilities,extensions
as $$
declare r platform.import_runs;z record;p jsonb;cid uuid;pid uuid;bid uuid;eid uuid;uid uuid;party uuid;meter uuid;
  opening_journal uuid;opening_date date;debits numeric(20,4):=0;credits numeric(20,4):=0;
  ar_gl numeric(20,4):=0;ar_sub numeric(20,4):=0;advance_gl numeric(20,4):=0;rh text;
begin
  select * into r from platform.import_runs where id=p_run_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.tenant_id::text||':'||coalesce(r.property_id::text,r.id::text),0));
  if exists(select 1 from platform.import_row_issues where run_id=r.id and severity='blocking') then raise exception 'blocking_import_issues_exist' using errcode='23514'; end if;
  if exists(select 1 from platform.import_rows where run_id=r.id and classification<>'new') then raise exception 'non_new_row_requires_forward_correction' using errcode='22023'; end if;

  for z in select x.* from platform.import_rows x join platform.import_templates t on t.code=x.template_code
    where x.run_id=r.id and x.template_code not in ('opening_gl','open_receivable') order by t.dependency_order,x.source_row_no for update of x loop
    p:=z.normalized_payload; cid:=null;
    if z.template_code='property' then
      if r.property_id is not null then raise exception 'property_already_bound' using errcode='22023'; end if;
      insert into portfolio.properties(tenant_id,type,name,base_currency,status)
      values(r.tenant_id,coalesce((p->>'type')::portfolio.property_type,'condominium'),p->>'name',coalesce(p->>'currency','RON'),'draft') returning id into cid;
      update platform.import_runs set property_id=cid where id=r.id; r.property_id:=cid;
    elsif z.template_code='building' then
      insert into portfolio.buildings(tenant_id,property_id,code,name,year_built,floors,status)
      values(r.tenant_id,r.property_id,p->>'code',p->>'name',nullif(p->>'year_built','')::smallint,nullif(p->>'floors','')::smallint,'active') returning id into cid;
    elsif z.template_code='entrance' then
      bid:=app_private.onboarding_mapped_id_internal_v1(r.id,'building',p->>'building_key');
      if bid is null then raise exception 'building_dependency_missing' using errcode='23503'; end if;
      insert into portfolio.entrances(tenant_id,building_id,code,name) values(r.tenant_id,bid,p->>'code',p->>'name') returning id into cid;
    elsif z.template_code='unit' then
      bid:=app_private.onboarding_mapped_id_internal_v1(r.id,'building',p->>'building_key');
      eid:=case when nullif(p->>'entrance_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'entrance',p->>'entrance_key') end;
      if bid is null then raise exception 'building_dependency_missing' using errcode='23503'; end if;
      insert into portfolio.units(tenant_id,building_id,entrance_id,code,floor,area_m2,bedrooms,status)
      values(r.tenant_id,bid,eid,p->>'code',nullif(p->>'floor','')::smallint,nullif(p->>'area_m2','')::numeric,nullif(p->>'bedrooms','')::smallint,'active') returning id into cid;
    elsif z.template_code='party' then
      insert into portfolio.parties(tenant_id,type,legal_name) values(r.tenant_id,coalesce((p->>'type')::portfolio.party_type,'person'),p->>'legal_name') returning id into cid;
    elsif z.template_code='ownership' then
      uid:=app_private.onboarding_mapped_id_internal_v1(r.id,'unit',p->>'unit_key'); party:=app_private.onboarding_mapped_id_internal_v1(r.id,'party',p->>'party_key');
      if uid is null or party is null then raise exception 'ownership_dependency_missing' using errcode='23503'; end if;
      insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from,valid_to)
      values(r.tenant_id,uid,party,(p->>'share')::numeric,(p->>'valid_from')::date,nullif(p->>'valid_to','')::date) returning id into cid;
    elsif z.template_code='occupancy' then
      uid:=app_private.onboarding_mapped_id_internal_v1(r.id,'unit',p->>'unit_key'); party:=app_private.onboarding_mapped_id_internal_v1(r.id,'party',p->>'party_key');
      if uid is null or party is null then raise exception 'occupancy_dependency_missing' using errcode='23503'; end if;
      insert into occupancy.occupancies(tenant_id,unit_id,kind,status,starts_at,ends_at)
      values(r.tenant_id,uid,(p->>'kind')::occupancy.occupancy_kind,'active',(p->>'starts_at')::timestamptz,nullif(p->>'ends_at','')::timestamptz) returning id into cid;
      insert into occupancy.occupants(occupancy_id,party_id,role,resident_weight) values(cid,party,coalesce(p->>'role','resident'),coalesce(nullif(p->>'resident_weight','')::numeric,1));
    elsif z.template_code='account' then
      insert into finance.accounts(tenant_id,property_id,code,name,type,currency,is_control_account)
      values(r.tenant_id,r.property_id,p->>'code',p->>'name',(p->>'type')::finance.account_type,coalesce(p->>'currency','RON'),coalesce((p->>'is_control_account')::boolean,false)) returning id into cid;
    elsif z.template_code='meter' then
      bid:=case when nullif(p->>'building_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'building',p->>'building_key') end;
      uid:=case when nullif(p->>'unit_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'unit',p->>'unit_key') end;
      insert into utilities.meters(tenant_id,property_id,building_id,unit_id,service_type,scope,serial_fingerprint,unit_code,multiplier,installed_on,status)
      values(r.tenant_id,r.property_id,bid,uid,(p->>'service_type')::utilities.service_type,(p->>'scope')::utilities.meter_scope,lower(p->>'serial_fingerprint'),p->>'unit_code',coalesce(nullif(p->>'multiplier','')::numeric,1),nullif(p->>'installed_on','')::date,'active') returning id into cid;
    elsif z.template_code='meter_reading' then
      meter:=app_private.onboarding_mapped_id_internal_v1(r.id,'meter',p->>'meter_key');
      if meter is null then raise exception 'meter_dependency_missing' using errcode='23503'; end if;
      insert into utilities.meter_readings(tenant_id,meter_id,reading_at,reading_value,method,status,entered_by,note)
      values(r.tenant_id,meter,(p->>'reading_at')::timestamptz,(p->>'reading_value')::numeric,'bulk_import','captured',p_actor,p->>'note') returning id into cid;
    else raise exception 'template_commit_handler_unconfigured:%',z.template_code using errcode='0A000'; end if;
    insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,z.id,z.template_code,cid,'created');
  end loop;

  -- Avoid polymorphic date tricks: derive and validate the single accounting date explicitly.
  select min((normalized_payload->>'occurred_on')::date) into opening_date from platform.import_rows where run_id=r.id and template_code='opening_gl';
  if opening_date is not null then
    if exists(select 1 from platform.import_rows where run_id=r.id and template_code='opening_gl' and (normalized_payload->>'occurred_on')::date<>opening_date) then raise exception 'multiple_opening_dates_forbidden' using errcode='22023'; end if;
    if not exists(select 1 from finance.accounting_periods ap where ap.tenant_id=r.tenant_id and ap.property_id=r.property_id and ap.status='open' and opening_date between ap.starts_on and ap.ends_on) then raise exception 'accounting_period_not_open' using errcode='55000'; end if;
    insert into finance.journals(tenant_id,property_id,occurred_on,currency,description,source_type,source_id,status)
    values(r.tenant_id,r.property_id,opening_date,'RON','Residential pilot opening balances','onboarding_import',r.id,'draft') returning id into opening_journal;
    for z in select * from platform.import_rows where run_id=r.id and template_code='opening_gl' order by source_row_no for update loop
      pid:=app_private.onboarding_mapped_id_internal_v1(r.id,'account',z.normalized_payload->>'account_key');
      uid:=case when nullif(z.normalized_payload->>'unit_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'unit',z.normalized_payload->>'unit_key') end;
      party:=case when nullif(z.normalized_payload->>'party_key','') is null then null else app_private.onboarding_mapped_id_internal_v1(r.id,'party',z.normalized_payload->>'party_key') end;
      if pid is null then raise exception 'opening_account_dependency_missing' using errcode='23503'; end if;
      insert into finance.journal_entries(tenant_id,journal_id,account_id,unit_id,party_id,side,amount,memo)
      values(r.tenant_id,opening_journal,pid,uid,party,(z.normalized_payload->>'side')::finance.entry_side,(z.normalized_payload->>'amount')::numeric,z.normalized_payload->>'memo') returning id into cid;
      insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,z.id,'opening_gl_entry',cid,'created');
    end loop;
    perform finance.assert_balanced(opening_journal);
    update finance.journals set status='posted',posted_by=p_actor where id=opening_journal;
  end if;

  for z in select * from platform.import_rows where run_id=r.id and template_code='open_receivable' order by source_row_no for update loop
    uid:=app_private.onboarding_mapped_id_internal_v1(r.id,'unit',z.normalized_payload->>'unit_key'); party:=app_private.onboarding_mapped_id_internal_v1(r.id,'party',z.normalized_payload->>'party_key');
    if uid is null or party is null or opening_journal is null then raise exception 'receivable_dependency_missing' using errcode='23503'; end if;
    insert into billing.invoices(tenant_id,property_id,unit_id,liable_party_id,period_start,period_end,due_on,currency,subtotal,tax_total,status,journal_id)
    values(r.tenant_id,r.property_id,uid,party,(z.normalized_payload->>'period_start')::date,(z.normalized_payload->>'period_end')::date,(z.normalized_payload->>'due_on')::date,coalesce(z.normalized_payload->>'currency','RON'),(z.normalized_payload->>'amount')::numeric,0,'draft',opening_journal) returning id into cid;
    insert into billing.invoice_lines(tenant_id,invoice_id,description,quantity,unit_price,line_subtotal,line_tax)
    values(r.tenant_id,cid,coalesce(z.normalized_payload->>'description','Opening receivable'),1,(z.normalized_payload->>'amount')::numeric,(z.normalized_payload->>'amount')::numeric,0);
    update billing.invoices set status='issued',issued_on=opening_date where id=cid;
    insert into billing.receivables(tenant_id,invoice_id,original_amount) values(r.tenant_id,cid,(z.normalized_payload->>'amount')::numeric);
    insert into platform.import_entity_mappings(run_id,row_id,entity_type,canonical_id,mapping_kind) values(r.id,z.id,'open_receivable',cid,'created');
  end loop;

  select coalesce(sum(case when e.side='debit' then e.amount else -e.amount end),0) into ar_gl from finance.journal_entries e join finance.accounts a on a.id=e.account_id where e.journal_id=opening_journal and a.code='4111';
  select coalesce(sum(rv.outstanding_amount),0) into ar_sub from billing.receivables rv join billing.invoices i on i.id=rv.invoice_id where i.tenant_id=r.tenant_id and i.property_id=r.property_id and i.journal_id=opening_journal;
  select coalesce(sum(case when e.side='credit' then e.amount else -e.amount end),0) into advance_gl from finance.journal_entries e join finance.accounts a on a.id=e.account_id where e.journal_id=opening_journal and a.code='419';
  if ar_gl<>ar_sub then raise exception 'opening_ar_parity_failed' using errcode='23514'; end if;
  if advance_gl<>0 then raise exception 'customer_advance_import_not_configured' using errcode='0A000'; end if;
  select coalesce(sum(amount)filter(where side='debit'),0),coalesce(sum(amount)filter(where side='credit'),0) into debits,credits from finance.journal_entries where journal_id=opening_journal;
  rh:=encode(extensions.digest(convert_to(jsonb_build_object('debits',debits,'credits',credits,'ar',ar_sub,'mappings',(select count(*) from platform.import_entity_mappings where run_id=r.id))::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object('journal_id',opening_journal,'debits',debits,'credits',credits,'ar_delta',ar_gl-ar_sub,'clearing_delta',advance_gl,'result_hash',rh);
end $$;

create or replace function app_private.onboarding_approve_import_commit_internal_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,platform,extensions
as $$
declare c record;r platform.import_runs;s jsonb;
begin
  select * into c from app_private.import_context(p_context_id,'onboarding.import.approve',true);
  select * into r from platform.import_runs where id=p_run_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'import_run_not_found' using errcode='P0002'; end if;
  if r.status<>'pending_approval' then raise exception 'import_not_pending_approval' using errcode='22023'; end if;
  if r.created_by=auth.uid() or r.submitted_by=auth.uid() then raise exception 'dual_control_violation' using errcode='42501'; end if;
  update platform.import_runs set status='committing',approved_by=auth.uid() where id=r.id;
  s:=app_private.onboarding_commit_residential_internal_v1(r.id,auth.uid());
  update platform.import_runs set status='committed',committed_at=statement_timestamp(),result_hash=s->>'result_hash' where id=r.id;
  insert into platform.import_reconciliation_results(run_id,total_debits,total_credits,ar_delta,clearing_delta,evidence_json,result_hash,certified_by)
  values(r.id,(s->>'debits')::numeric,(s->>'credits')::numeric,(s->>'ar_delta')::numeric,(s->>'clearing_delta')::numeric,s,s->>'result_hash',auth.uid());
  update platform.import_runs set status='reconciled',reconciled_at=statement_timestamp() where id=r.id;
  return s||jsonb_build_object('status','reconciled');
end $$;

revoke all on function app_private.protect_used_import_template_version_internal_v1(),app_private.onboarding_mapped_id_internal_v1(uuid,text,text),app_private.onboarding_configure_template_internal_v1(uuid,text,text,text,integer,jsonb,integer),app_private.onboarding_commit_residential_internal_v1(uuid,uuid) from public,anon;
grant execute on function app_private.protect_used_import_template_version_internal_v1(),app_private.onboarding_mapped_id_internal_v1(uuid,text,text),app_private.onboarding_configure_template_internal_v1(uuid,text,text,text,integer,jsonb,integer),app_private.onboarding_commit_residential_internal_v1(uuid,uuid) to authenticated,service_role;
revoke all on function customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer) from public,anon;
grant execute on function customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer) to authenticated,service_role;

comment on function customer_api.configure_import_template_v1(uuid,text,text,text,integer,jsonb,integer) is 'AAL2-controlled versioned residential import template registration; migration contains no fixture DML.';
comment on function app_private.onboarding_commit_residential_internal_v1(uuid,uuid) is 'Insert-only atomic residential pilot commit; existing-record updates and customer advances fail closed.';

commit;
