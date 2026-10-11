begin;

-- DB-HIST-01-R4 temporary forward-only proposal.
-- Existing objects are not dropped or rebuilt. Missing objects are created;
-- matching objects remain in place. Catalog parity is validated outside this file.

-- CLADORA-P2-EXPORT-001: Romanian statutory and operational export pack.
-- The database seals canonical source data and a deterministic manifest. Binary
-- PDF/XLSX/CSV rendering remains a server concern and cannot mutate accounting.

insert into identity.permissions(code,resource,action,description)
values
  ('finance.exports.generate','finance.exports','generate','Generate a sealed Romanian operational export pack'),
  ('finance.exports.read','finance.exports','read','Read sealed export-pack metadata and canonical source data')
on conflict(code) do nothing;

insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow'
from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','property_manager','president','censor')
  and p.code in ('finance.exports.generate','finance.exports.read')
on conflict(role_id,permission_id) do nothing;

create table if not exists finance.export_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  accounting_period_id uuid not null references finance.accounting_periods(id) on delete restrict,
  idempotency_key text not null,
  locale text not null default 'ro' check(locale in ('ro')),
  template_version integer not null default 1 check(template_version>0),
  status text not null default 'sealed' check(status in ('sealed')),
  source_snapshot jsonb not null,
  source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_json jsonb not null,
  manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  generated_by uuid not null references auth.users(id) on delete restrict,
  generated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,idempotency_key),
  unique(id,tenant_id),
  check(jsonb_typeof(source_snapshot)='object'),
  check(jsonb_typeof(manifest_json)='object')
);

create table if not exists finance.export_artifacts (
  id uuid primary key default gen_random_uuid(),
  export_pack_id uuid not null,
  tenant_id uuid not null,
  report_code text not null check(report_code in (
    'trial_balance','unit_charges','receivables_collections','bank_reconciliation',
    'supplier_invoices_payments','meter_allocation_evidence','governance_audit_trail'
  )),
  format text not null check(format in ('pdf','xlsx','csv')),
  media_type text not null,
  canonical_filename text not null check(canonical_filename !~ '[\\/]' and length(canonical_filename) between 5 and 180),
  content_sha256 text check(content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint check(byte_size is null or byte_size>0),
  materialized_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  foreign key(export_pack_id,tenant_id) references finance.export_packs(id,tenant_id) on delete restrict,
  unique(export_pack_id,report_code,format),
  check((content_sha256 is null and byte_size is null and materialized_at is null)
     or (content_sha256 is not null and byte_size is not null and materialized_at is not null))
);

create index if not exists export_packs_period_idx on finance.export_packs(tenant_id,accounting_period_id,generated_at desc);

create index if not exists export_packs_accounting_period_id_idx on finance.export_packs(accounting_period_id);

create index if not exists export_packs_property_id_idx on finance.export_packs(property_id);

create index if not exists export_packs_generated_by_idx on finance.export_packs(generated_by);

create index if not exists export_artifacts_pack_idx on finance.export_artifacts(export_pack_id,report_code,format);

create index if not exists export_artifacts_pack_tenant_idx on finance.export_artifacts(export_pack_id,tenant_id);

alter table finance.export_packs enable row level security;

alter table finance.export_artifacts enable row level security;

revoke all on finance.export_packs,finance.export_artifacts from public,anon,authenticated;

grant all on finance.export_packs,finance.export_artifacts to service_role;

do $reconcile$
begin
  if to_regprocedure('app_private.export_pack_actor_v1(uuid,text)') is null then
    execute $definition$
create or replace function app_private.export_pack_actor_v1(p_context_id uuid,p_permission text)
returns table(tenant_id uuid,property_id uuid,role_code text)
language plpgsql stable security definer
set search_path=pg_catalog,identity
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  return query
  select g.tenant_id,
    case when g.scope_type='property' then g.property_id
         when g.scope_type='building' then b.property_id
         else null end,
    lower(r.code)
  from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id
  left join portfolio.buildings b on b.id=g.building_id and b.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
    and g.scope_type in ('tenant','property','building')
    and lower(r.code) in ('association_admin','property_manager','president','censor')
    and exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=m.role_id and rp.effect='allow' and p.code=p_permission);
  if not found then raise exception 'export_pack_access_denied' using errcode='42501'; end if;
end $$
$definition$;
  end if;
end
$reconcile$;

revoke all on function app_private.export_pack_actor_v1(uuid,text) from public,anon,authenticated;

do $reconcile$
begin
  if to_regprocedure('app_private.build_export_reports_v1(uuid,uuid,date,date)') is null then
    execute $definition$
create or replace function app_private.build_export_reports_v1(
  p_tenant_id uuid,p_property_id uuid,p_period_start date,p_period_end date
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,finance,billing,payments,maintenance,utilities,governance,portfolio
as $$
declare result jsonb; oversized text;
begin
  with report_sizes(code,row_count) as (values
    ('trial_balance',(select count(distinct e.account_id) from finance.journal_entries e join finance.journals j on j.id=e.journal_id and j.tenant_id=e.tenant_id where e.tenant_id=p_tenant_id and (p_property_id is null or j.property_id=p_property_id) and j.occurred_on between p_period_start and p_period_end and j.status in ('posted','reversed'))),
    ('unit_charges',(select count(*) from billing.invoice_lines l join billing.invoices i on i.id=l.invoice_id and i.tenant_id=l.tenant_id where l.tenant_id=p_tenant_id and (p_property_id is null or i.property_id=p_property_id) and i.period_start>=p_period_start and i.period_end<=p_period_end and i.status<>'draft')),
    ('receivables_collections',(select count(*) from billing.receivables r join billing.invoices i on i.id=r.invoice_id and i.tenant_id=r.tenant_id where r.tenant_id=p_tenant_id and (p_property_id is null or i.property_id=p_property_id) and i.period_start>=p_period_start and i.period_end<=p_period_end and i.status<>'draft')),
    ('bank_reconciliation',(select count(*) from payments.reconciliation_sessions s join payments.bank_accounts b on b.id=s.bank_account_id and b.tenant_id=s.tenant_id where s.tenant_id=p_tenant_id and (p_property_id is null or b.property_id=p_property_id) and s.period_start>=p_period_start and s.period_end<=p_period_end)),
    ('supplier_invoices_payments',(select count(*) from maintenance.vendor_payables v join maintenance.work_orders w on w.id=v.work_order_id and w.tenant_id=v.tenant_id where v.tenant_id=p_tenant_id and (p_property_id is null or w.property_id=p_property_id) and v.invoice_date between p_period_start and p_period_end)),
    ('meter_allocation_evidence',(select count(*) from utilities.consumption_periods c join utilities.meters m on m.id=c.meter_id and m.tenant_id=c.tenant_id where c.tenant_id=p_tenant_id and (p_property_id is null or m.property_id=p_property_id) and c.period_start::date>=p_period_start and c.period_end::date<=p_period_end)),
    ('governance_audit_trail',(select count(*) from governance.resolutions r join governance.meetings m on m.id=r.meeting_id and m.tenant_id=r.tenant_id where r.tenant_id=p_tenant_id and (p_property_id is null or m.property_id=p_property_id) and m.scheduled_at::date between p_period_start and p_period_end))
  ) select code into oversized from report_sizes where row_count>5000 order by code limit 1;
  if oversized is not null then raise exception 'export_report_row_limit_exceeded:%',oversized using errcode='54000'; end if;

  result:=jsonb_build_object(
    'trial_balance',(select coalesce(jsonb_agg(to_jsonb(x) order by x.account_code,x.currency),'[]'::jsonb) from (
      select a.code account_code,a.name account_name,a.type::text account_type,a.currency,
        coalesce(sum(e.amount) filter(where e.side='debit'),0) debit_total,
        coalesce(sum(e.amount) filter(where e.side='credit'),0) credit_total,
        coalesce(sum(case when e.side='debit' then e.amount else -e.amount end),0) balance
      from finance.journal_entries e join finance.journals j on j.id=e.journal_id and j.tenant_id=e.tenant_id
      join finance.accounts a on a.id=e.account_id and a.tenant_id=e.tenant_id
      where e.tenant_id=p_tenant_id and (p_property_id is null or j.property_id=p_property_id)
        and j.occurred_on between p_period_start and p_period_end and j.status in ('posted','reversed')
      group by a.code,a.name,a.type,a.currency) x),
    'unit_charges',(select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_no,x.line_description),'[]'::jsonb) from (
      select i.invoice_no,u.code unit_code,i.period_start,i.period_end,i.currency,i.status::text invoice_status,
        l.description line_description,l.quantity,l.unit_price,l.line_subtotal,l.line_tax,(l.line_subtotal+l.line_tax) line_total
      from billing.invoice_lines l join billing.invoices i on i.id=l.invoice_id and i.tenant_id=l.tenant_id
      join portfolio.units u on u.id=i.unit_id and u.tenant_id=i.tenant_id
      where l.tenant_id=p_tenant_id and (p_property_id is null or i.property_id=p_property_id)
        and i.period_start>=p_period_start and i.period_end<=p_period_end and i.status<>'draft') x),
    'receivables_collections',(select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_no),'[]'::jsonb) from (
      select i.invoice_no,u.code unit_code,i.issued_on,i.due_on,i.currency,i.status::text invoice_status,
        r.original_amount,r.paid_amount,r.credited_amount,r.outstanding_amount,r.last_payment_at
      from billing.receivables r join billing.invoices i on i.id=r.invoice_id and i.tenant_id=r.tenant_id
      join portfolio.units u on u.id=i.unit_id and u.tenant_id=i.tenant_id
      where r.tenant_id=p_tenant_id and (p_property_id is null or i.property_id=p_property_id)
        and i.period_start>=p_period_start and i.period_end<=p_period_end and i.status<>'draft') x),
    'bank_reconciliation',(select coalesce(jsonb_agg(to_jsonb(x) order by x.statement_date,x.bank_name,x.currency),'[]'::jsonb) from (
      select s.statement_date,s.period_start,s.period_end,b.bank_name,b.currency,s.opening_balance,s.total_credits,
        s.total_debits,s.closing_balance,s.difference,s.status,s.reconciled_at
      from payments.reconciliation_sessions s join payments.bank_accounts b on b.id=s.bank_account_id and b.tenant_id=s.tenant_id
      where s.tenant_id=p_tenant_id and (p_property_id is null or b.property_id=p_property_id)
        and s.period_start>=p_period_start and s.period_end<=p_period_end) x),
    'supplier_invoices_payments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.invoice_date,x.payable_no),'[]'::jsonb) from (
      select v.payable_no,p.legal_name vendor_name,v.invoice_ref,v.invoice_date,v.due_date,v.currency,
        v.subtotal,v.tax_amount,v.total_amount,v.status,v.posted_at,po.po_no,w.work_order_no
      from maintenance.vendor_payables v join maintenance.work_orders w on w.id=v.work_order_id and w.tenant_id=v.tenant_id
      join maintenance.vendors mv on mv.id=v.vendor_id and mv.tenant_id=v.tenant_id join portfolio.parties p on p.id=mv.party_id and p.tenant_id=mv.tenant_id
      left join maintenance.purchase_orders po on po.id=v.purchase_order_id and po.tenant_id=v.tenant_id
      where v.tenant_id=p_tenant_id and (p_property_id is null or w.property_id=p_property_id)
        and v.invoice_date between p_period_start and p_period_end) x),
    'meter_allocation_evidence',(select coalesce(jsonb_agg(to_jsonb(x) order by x.period_start,x.meter_code),'[]'::jsonb) from (
      select m.serial_fingerprint meter_code,m.service_type::text,m.scope::text,coalesce(u.code,'') unit_code,m.unit_code measurement_unit,
        c.period_start,c.period_end,s.reading_value start_reading,e.reading_value end_reading,c.raw_consumption,c.adjusted_consumption,
        s.status::text start_status,e.status::text end_status
      from utilities.consumption_periods c join utilities.meters m on m.id=c.meter_id and m.tenant_id=c.tenant_id
      join utilities.meter_readings s on s.id=c.start_reading_id and s.tenant_id=c.tenant_id
      join utilities.meter_readings e on e.id=c.end_reading_id and e.tenant_id=c.tenant_id
      left join portfolio.units u on u.id=m.unit_id and u.tenant_id=m.tenant_id
      where c.tenant_id=p_tenant_id and (p_property_id is null or m.property_id=p_property_id)
        and c.period_start::date>=p_period_start and c.period_end::date<=p_period_end) x),
    'governance_audit_trail',(select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at,x.resolution_no),'[]'::jsonb) from (
      select m.title meeting_title,m.meeting_type,m.scheduled_at,m.status::text meeting_status,m.closed_at,
        r.resolution_no,r.title resolution_title,r.adopted,r.effective_on,
        (select count(*) from governance.minutes mn where mn.meeting_id=m.id and mn.approved_at is not null) approved_minutes_versions
      from governance.resolutions r join governance.meetings m on m.id=r.meeting_id and m.tenant_id=r.tenant_id
      where r.tenant_id=p_tenant_id and (p_property_id is null or m.property_id=p_property_id)
        and m.scheduled_at::date between p_period_start and p_period_end) x)
  );
  return result;
end $$
$definition$;
  end if;
end
$reconcile$;

revoke all on function app_private.build_export_reports_v1(uuid,uuid,date,date) from public,anon,authenticated;

do $reconcile$
begin
  if to_regprocedure('app_private.create_export_pack_internal_v1(uuid,uuid,text)') is null then
    execute $definition$
create or replace function app_private.create_export_pack_internal_v1(
  p_context_id uuid,p_accounting_period_id uuid,p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,finance,billing,payments,utilities,governance,audit,extensions
as $$
declare a record; per finance.accounting_periods; pack finance.export_packs; src jsonb; man jsonb; sh text; mh text;
  codes constant text[]:=array['trial_balance','unit_charges','receivables_collections','bank_reconciliation','supplier_invoices_payments','meter_allocation_evidence','governance_audit_trail'];
  code text; fmt text; mt text; fn text;
begin
  select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.generate');
  if length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'export_idempotency_key_required' using errcode='22023'; end if;
  select * into per from finance.accounting_periods where id=p_accounting_period_id and tenant_id=a.tenant_id for share;
  if not found then raise exception 'accounting_period_not_found' using errcode='22023'; end if;
  if per.status<>'closed' then raise exception 'export_requires_closed_accounting_period' using errcode='55000'; end if;
  if a.property_id is not null and per.property_id is distinct from a.property_id then raise exception 'export_period_out_of_scope' using errcode='42501'; end if;

  select * into pack from finance.export_packs where tenant_id=a.tenant_id and idempotency_key=p_idempotency_key;
  if found then
    if pack.accounting_period_id<>p_accounting_period_id then raise exception 'idempotency_payload_mismatch' using errcode='23505'; end if;
    return jsonb_build_object('export_pack_id',pack.id,'status',pack.status,'source_sha256',pack.source_sha256,'manifest_sha256',pack.manifest_sha256,'idempotent_replay',true);
  end if;

  src:=jsonb_build_object(
    'contract','CLADORA-P2-EXPORT-001','schema_version',1,'locale','ro',
    'tenant_id',a.tenant_id,'property_id',per.property_id,'accounting_period_id',per.id,
    'period_start',per.starts_on,'period_end',per.ends_on,'closed_at',per.closed_at,
    'close_snapshot',per.snapshot_json,
    'reports',app_private.build_export_reports_v1(a.tenant_id,per.property_id,per.starts_on,per.ends_on),
    'register_counts',jsonb_build_object(
      'posted_journals',(select count(*) from finance.journals j where j.tenant_id=a.tenant_id and (per.property_id is null or j.property_id=per.property_id) and j.occurred_on between per.starts_on and per.ends_on and j.status in ('posted','reversed')),
      'issued_invoices',(select count(*) from billing.invoices i where i.tenant_id=a.tenant_id and (per.property_id is null or i.property_id=per.property_id) and i.period_start>=per.starts_on and i.period_end<=per.ends_on and i.status<>'draft'),
      'bank_sessions',(select count(*) from payments.reconciliation_sessions r where r.tenant_id=a.tenant_id and r.period_start>=per.starts_on and r.period_end<=per.ends_on and r.status='reconciled')
    )
  );
  sh:=encode(extensions.digest(convert_to(src::text,'UTF8'),'sha256'),'hex');
  man:=jsonb_build_object('contract','CLADORA-P2-EXPORT-001','manifest_version',1,'source_sha256',sh,
    'reports',(select jsonb_agg(jsonb_build_object('report_code',c,'formats',array['pdf','xlsx','csv']) order by c) from unnest(codes) c));
  mh:=encode(extensions.digest(convert_to(man::text,'UTF8'),'sha256'),'hex');

  insert into finance.export_packs(tenant_id,property_id,accounting_period_id,idempotency_key,source_snapshot,source_sha256,manifest_json,manifest_sha256,generated_by)
  values(a.tenant_id,per.property_id,per.id,p_idempotency_key,src,sh,man,mh,auth.uid()) returning * into pack;
  foreach code in array codes loop
    foreach fmt in array array['pdf','xlsx','csv'] loop
      mt:=case fmt when 'pdf' then 'application/pdf' when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' else 'text/csv' end;
      fn:=code||'_'||to_char(per.starts_on,'YYYYMMDD')||'_'||to_char(per.ends_on,'YYYYMMDD')||'.'||fmt;
      insert into finance.export_artifacts(export_pack_id,tenant_id,report_code,format,media_type,canonical_filename)
      values(pack.id,a.tenant_id,code,fmt,mt,fn);
    end loop;
  end loop;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(a.tenant_id,auth.uid(),a.role_code,'ROMANIAN_EXPORT_PACK_SEALED','finance.export_pack',pack.id,
    jsonb_build_object('period_id',per.id,'source_sha256',sh,'manifest_sha256',mh,'artifact_count',21),statement_timestamp());
  return jsonb_build_object('export_pack_id',pack.id,'status','sealed','source_sha256',sh,'manifest_sha256',mh,'artifact_count',21,'idempotent_replay',false);
end $$
$definition$;
  end if;
end
$reconcile$;

revoke all on function app_private.create_export_pack_internal_v1(uuid,uuid,text) from public,anon,authenticated;

do $reconcile$
begin
  if to_regprocedure('app_private.get_export_pack_internal_v1(uuid,uuid)') is null then
    execute $definition$
create or replace function app_private.get_export_pack_internal_v1(p_context_id uuid,p_export_pack_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,finance
as $$
declare a record;p finance.export_packs; arts jsonb;
begin
 select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.read');
 select * into p from finance.export_packs where id=p_export_pack_id and tenant_id=a.tenant_id and (a.property_id is null or property_id=a.property_id);
 if not found then raise exception 'export_pack_not_found' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('report_code',report_code,'format',format,'media_type',media_type,'filename',canonical_filename,'sha256',content_sha256,'byte_size',byte_size,'materialized_at',materialized_at) order by report_code,format),'[]'::jsonb)
 into arts from finance.export_artifacts where export_pack_id=p.id;
 return jsonb_build_object('export_pack_id',p.id,'status',p.status,'locale',p.locale,'template_version',p.template_version,
  'source_snapshot',p.source_snapshot,'source_sha256',p.source_sha256,'manifest',p.manifest_json,'manifest_sha256',p.manifest_sha256,
  'generated_at',p.generated_at,'artifacts',arts);
end $$
$definition$;
  end if;
end
$reconcile$;

revoke all on function app_private.get_export_pack_internal_v1(uuid,uuid) from public,anon,authenticated;

do $reconcile$
begin
  if to_regprocedure('app_private.record_export_artifact_internal_v1(uuid,uuid,text,text,text,bigint)') is null then
    execute $definition$
create or replace function app_private.record_export_artifact_internal_v1(
  p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text,p_content_sha256 text,p_byte_size bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,finance,audit
as $$
declare a record;art finance.export_artifacts;
begin
  select * into a from app_private.export_pack_actor_v1(p_context_id,'finance.exports.generate');
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_export_artifact_hash' using errcode='22023'; end if;
  if p_byte_size<1 or p_byte_size>5242880 then raise exception 'export_artifact_size_out_of_bounds' using errcode='22023'; end if;
  select ea.* into art from finance.export_artifacts ea join finance.export_packs ep on ep.id=ea.export_pack_id and ep.tenant_id=ea.tenant_id
  where ea.export_pack_id=p_export_pack_id and ea.tenant_id=a.tenant_id and ea.report_code=p_report_code and ea.format=p_format
    and (a.property_id is null or ep.property_id=a.property_id) for update of ea;
  if not found then raise exception 'export_artifact_not_found' using errcode='22023'; end if;
  if art.content_sha256 is not null then
    if (art.content_sha256,art.byte_size) is distinct from (p_content_sha256,p_byte_size) then
      raise exception 'export_artifact_materialization_mismatch' using errcode='23505';
    end if;
    return jsonb_build_object('artifact_id',art.id,'sha256',art.content_sha256,'byte_size',art.byte_size,'idempotent_replay',true);
  end if;
  update finance.export_artifacts set content_sha256=p_content_sha256,byte_size=p_byte_size,materialized_at=statement_timestamp()
  where id=art.id returning * into art;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(a.tenant_id,auth.uid(),a.role_code,'EXPORT_ARTIFACT_MATERIALIZED','finance.export_artifact',art.id,
    jsonb_build_object('export_pack_id',p_export_pack_id,'report_code',p_report_code,'format',p_format,'sha256',p_content_sha256,'byte_size',p_byte_size),statement_timestamp());
  return jsonb_build_object('artifact_id',art.id,'sha256',art.content_sha256,'byte_size',art.byte_size,'idempotent_replay',false);
end $$
$definition$;
  end if;
end
$reconcile$;

revoke all on function app_private.record_export_artifact_internal_v1(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;

do $reconcile$
begin
  if to_regprocedure('customer_api.create_export_pack_v1(uuid,uuid,text)') is null then
    execute $definition$
create or replace function customer_api.create_export_pack_v1(p_context_id uuid,p_accounting_period_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.create_export_pack_internal_v1(p_context_id,p_accounting_period_id,p_idempotency_key)$$
$definition$;
  end if;
end
$reconcile$;

do $reconcile$
begin
  if to_regprocedure('customer_api.get_export_pack_v1(uuid,uuid)') is null then
    execute $definition$
create or replace function customer_api.get_export_pack_v1(p_context_id uuid,p_export_pack_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$select app_private.get_export_pack_internal_v1(p_context_id,p_export_pack_id)$$
$definition$;
  end if;
end
$reconcile$;

do $reconcile$
begin
  if to_regprocedure('customer_api.record_export_artifact_v1(uuid,uuid,text,text,text,bigint)') is null then
    execute $definition$
create or replace function customer_api.record_export_artifact_v1(p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text,p_content_sha256 text,p_byte_size bigint)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.record_export_artifact_internal_v1(p_context_id,p_export_pack_id,p_report_code,p_format,p_content_sha256,p_byte_size)$$
$definition$;
  end if;
end
$reconcile$;

revoke all on function customer_api.create_export_pack_v1(uuid,uuid,text),customer_api.get_export_pack_v1(uuid,uuid),customer_api.record_export_artifact_v1(uuid,uuid,text,text,text,bigint) from public,anon;

grant execute on function customer_api.create_export_pack_v1(uuid,uuid,text),customer_api.get_export_pack_v1(uuid,uuid),customer_api.record_export_artifact_v1(uuid,uuid,text,text,text,bigint) to authenticated,service_role;

do $reconcile$
begin
  if to_regprocedure('finance.protect_export_pack_v1()') is null then
    execute $definition$
create or replace function finance.protect_export_pack_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$begin raise exception 'sealed_export_pack_is_immutable' using errcode='55000'; end$$
$definition$;
  end if;
end
$reconcile$;

revoke all on function finance.protect_export_pack_v1() from public,anon,authenticated;

do $reconcile$
begin
  if not exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and c.relname='export_packs' and t.tgname='export_packs_immutable' and not t.tgisinternal) then
    execute $definition$
create trigger export_packs_immutable before update or delete on finance.export_packs for each row execute function finance.protect_export_pack_v1()
$definition$;
  end if;
end
$reconcile$;

do $reconcile$
begin
  if not exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and c.relname='export_artifacts' and t.tgname='export_artifacts_no_delete' and not t.tgisinternal) then
    execute $definition$
create trigger export_artifacts_no_delete before delete on finance.export_artifacts for each row execute function finance.protect_export_pack_v1()
$definition$;
  end if;
end
$reconcile$;


-- Private R7 candidate convergence definitions.
CREATE INDEX IF NOT EXISTS delivery_attempts_recipient_id_idx ON communications.delivery_attempts USING btree (recipient_id);

CREATE INDEX IF NOT EXISTS notice_acknowledgements_membership_id_idx ON communications.notice_acknowledgements USING btree (membership_id);

CREATE INDEX IF NOT EXISTS notice_acknowledgements_recipient_id_idx ON communications.notice_acknowledgements USING btree (recipient_id);

CREATE INDEX IF NOT EXISTS notice_acknowledgements_tenant_id_idx ON communications.notice_acknowledgements USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS notice_recipients_party_id_idx ON communications.notice_recipients USING btree (party_id);

CREATE INDEX IF NOT EXISTS notice_recipients_tenant_id_idx ON communications.notice_recipients USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS notice_recipients_unit_id_idx ON communications.notice_recipients USING btree (unit_id);

CREATE INDEX IF NOT EXISTS notice_suppressions_membership_id_idx ON communications.notice_suppressions USING btree (membership_id);

CREATE INDEX IF NOT EXISTS official_notices_approved_by_idx ON communications.official_notices USING btree (approved_by);

CREATE INDEX IF NOT EXISTS official_notices_building_id_idx ON communications.official_notices USING btree (building_id);

CREATE INDEX IF NOT EXISTS official_notices_cancelled_by_idx ON communications.official_notices USING btree (cancelled_by);

CREATE INDEX IF NOT EXISTS official_notices_created_by_idx ON communications.official_notices USING btree (created_by);

CREATE INDEX IF NOT EXISTS official_notices_property_id_idx ON communications.official_notices USING btree (property_id);

CREATE INDEX IF NOT EXISTS official_notices_published_by_idx ON communications.official_notices USING btree (published_by);

CREATE INDEX IF NOT EXISTS official_notices_template_version_id_idx ON communications.official_notices USING btree (template_version_id);

CREATE INDEX IF NOT EXISTS official_notices_unit_id_idx ON communications.official_notices USING btree (unit_id);

CREATE INDEX IF NOT EXISTS statutory_evidence_captured_by_idx ON communications.statutory_evidence USING btree (captured_by);

CREATE INDEX IF NOT EXISTS statutory_evidence_document_id_idx ON communications.statutory_evidence USING btree (document_id);

CREATE INDEX IF NOT EXISTS statutory_evidence_tenant_id_idx ON communications.statutory_evidence USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS statutory_evidence_verified_by_idx ON communications.statutory_evidence USING btree (verified_by);

do $r7_context$
begin
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261007112219'
  ) then
    execute $r7_final_0$CREATE OR REPLACE FUNCTION app_private.configure_payment_allocation_policy_v1(p_context_id uuid, p_strategy payments.payment_allocation_strategy DEFAULT 'oldest_due_first'::payments.payment_allocation_strategy, p_penalties_priority payments.penalties_priority DEFAULT 'principal_first'::payments.penalties_priority, p_min_partial_amount numeric DEFAULT 1.00, p_overpayment_handling text DEFAULT 'credit_balance'::text, p_credit_balance_handling text DEFAULT 'apply_to_next'::text, p_approval_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_version integer;
  v_policy payments.payment_allocation_policies;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  if p_min_partial_amount is null or p_min_partial_amount <= 0 then
    raise exception 'invalid_min_partial_amount' using errcode = '22023';
  end if;

  -- Close existing active policies
  update payments.payment_allocation_policies
  set effective_to = statement_timestamp()
  where tenant_id = v.tenant_id
    and (effective_to is null or effective_to > statement_timestamp());

  select coalesce(max(version), 0) + 1 into v_version
  from payments.payment_allocation_policies
  where tenant_id = v.tenant_id;

  insert into payments.payment_allocation_policies (
    tenant_id,
    version,
    strategy,
    penalties_priority,
    min_partial_amount,
    overpayment_handling,
    credit_balance_handling,
    effective_from,
    approved_by,
    approval_reference,
    legal_review_status
  ) values (
    v.tenant_id,
    v_version,
    p_strategy,
    p_penalties_priority,
    p_min_partial_amount,
    coalesce(p_overpayment_handling, 'credit_balance'),
    coalesce(p_credit_balance_handling, 'apply_to_next'),
    statement_timestamp(),
    auth.uid(),
    coalesce(p_approval_reference, 'AG-DECISION-' || to_char(current_date, 'YYYYMMDD')),
    'approved'
  ) returning * into v_policy;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'POLICY_CONFIGURED', 'payments.payment_allocation_policy', v_policy.id,
    row_to_json(v_policy)::jsonb,
    statement_timestamp()
  );

  return jsonb_build_object(
    'payment_allocation_policy', row_to_json(v_policy)::jsonb
  );
end;
$function$;$r7_final_0$;
    execute $r7_final_1$CREATE OR REPLACE FUNCTION app_private.reject_beneficiary_account_v1(p_context_id uuid, p_beneficiary_id uuid, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'pending_approval' then
    raise exception 'beneficiary_not_pending_approval' using errcode = '22023';
  end if;

  if v_draft.created_by = auth.uid() then
    raise exception 'dual_control_violation_creator_cannot_reject' using errcode = '42501';
  end if;

  update payments.beneficiary_accounts
  set status = 'rejected',
      rejected_at = statement_timestamp(),
      rejected_by = auth.uid(),
      rejection_reason = coalesce(p_rejection_reason, 'Rejected by authorized manager')
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_REJECTED', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object('id', v_draft.id, 'status', v_draft.status, 'rejection_reason', v_draft.rejection_reason),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'status', v_draft.status,
      'rejected_at', v_draft.rejected_at
    )
  );
end;
$function$;$r7_final_1$;
    execute $r7_final_2$CREATE OR REPLACE FUNCTION app_private.revoke_beneficiary_account_v1(p_context_id uuid, p_beneficiary_id uuid, p_revocation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_acc payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_acc
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_acc.status <> 'active' then
    raise exception 'beneficiary_not_active' using errcode = '22023';
  end if;

  update payments.beneficiary_accounts
  set status = 'revoked',
      revoked_at = statement_timestamp(),
      revoked_by = auth.uid(),
      revocation_reason = coalesce(p_revocation_reason, 'Revoked by authorized manager')
  where id = v_acc.id
  returning * into v_acc;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_REVOKED', 'payments.beneficiary_account', v_acc.id,
    jsonb_build_object('id', v_acc.id, 'status', v_acc.status, 'revocation_reason', v_acc.revocation_reason),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_acc.id,
      'status', v_acc.status,
      'revoked_at', v_acc.revoked_at
    )
  );
end;
$function$;$r7_final_2$;
    execute $r7_final_3$CREATE OR REPLACE FUNCTION app_private.submit_beneficiary_account_for_approval_v1(p_context_id uuid, p_beneficiary_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'draft' then
    raise exception 'beneficiary_not_in_draft_status' using errcode = '22023';
  end if;

  update payments.beneficiary_accounts
  set status = 'pending_approval',
      submitted_at = statement_timestamp(),
      submitted_by = auth.uid()
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_SUBMITTED_FOR_APPROVAL', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'submitted_at', v_draft.submitted_at
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'submitted_at', v_draft.submitted_at
    )
  );
end;
$function$;$r7_final_3$;
    execute $r7_final_4$CREATE OR REPLACE FUNCTION assets.approve_asset_decommission_internal_v1(p_context_id uuid, p_request_id uuid, p_approved boolean, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_req record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.decommission', true);

  select * into v_req from assets.asset_decommission_requests
  where id = p_request_id and tenant_id = v_caller.tenant_id for update;

  if not found or v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING: Decommission request % is not pending', p_request_id;
  end if;

  select * into v_asset from assets.assets
  where id = v_req.asset_id and tenant_id = v_caller.tenant_id for update;

  -- Dual-control: If safety-critical, approver cannot be the same as requester
  if (v_asset.is_safety_critical or v_asset.criticality_level = 'critical') and v_req.requested_by = auth.uid() then
    raise exception 'dual_control_required_for_critical_asset: independent approver required for critical asset decommission';
  end if;

  if p_approved then
    update assets.asset_decommission_requests set
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = statement_timestamp()
    where id = p_request_id;

    -- Set session authorization flag
    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'decommissioned',
      operational_status = 'isolated',
      retired_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where id = v_asset.id;

    insert into assets.asset_history (
      tenant_id, asset_id, event_type, actor_id, reason, occurred_at
    ) values (
      v_caller.tenant_id, v_asset.id, 'asset_decommissioned', auth.uid(), v_req.reason, statement_timestamp()
    );
  else
    update assets.asset_decommission_requests set
      status = 'rejected',
      approved_by = auth.uid(),
      approved_at = statement_timestamp(),
      rejection_reason = p_rejection_reason
    where id = p_request_id;

    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'active',
      updated_at = statement_timestamp()
    where id = v_asset.id;
  end if;

  return jsonb_build_object('success', true, 'request_id', p_request_id, 'approved', p_approved);
end;
$function$;$r7_final_4$;
    execute $r7_final_5$CREATE OR REPLACE FUNCTION assets.check_asset_caller_v1(p_context_id uuid, p_required_permission text, p_require_aal2 boolean DEFAULT false)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'identity', 'platform'
AS $function$
declare
  v_rec record;
  v_uid uuid := auth.uid();
  v_aal text;
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;

  select coalesce(auth.jwt()->>'aal', 'aal1') into v_aal;
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED: Elevated AAL2 authentication required' using errcode = '42501';
  end if;

  select
    g.tenant_id,
    g.membership_id,
    m.user_id,
    r.code as role_code,
    g.scope_type::text as scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.role_id
  into v_rec
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = v_uid
    and m.status = 'active';

  if not found then
    raise exception 'ACCESS_DENIED: User context invalid or inactive' using errcode = '42501';
  end if;

  -- Check explicit permission
  if p_required_permission is not null then
    if not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id = rp.permission_id
      where rp.role_id = v_rec.role_id and p.code = p_required_permission and rp.effect = 'allow'
    ) then
      raise exception 'INSUFFICIENT_PERMISSIONS: Required permission %', p_required_permission using errcode = '42501';
    end if;
  end if;

  return v_rec;
end;
$function$;$r7_final_5$;
    execute $r7_final_6$CREATE OR REPLACE FUNCTION assets.configure_compliance_policy_internal_v1(p_context_id uuid, p_policy_code text, p_category_code text, p_interval_months integer, p_legal_source_reference text, p_effective_from date, p_effective_to date DEFAULT NULL::date, p_property_id uuid DEFAULT NULL::uuid, p_is_safety_mandatory boolean DEFAULT false, p_jurisdiction text DEFAULT 'RO'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_policy_id uuid;
  v_ver integer := 1;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);

  -- Determine version
  select coalesce(max(version), 0) + 1 into v_ver
  from assets.compliance_policies
  where tenant_id = v_caller.tenant_id and policy_code = trim(p_policy_code);

  insert into assets.compliance_policies (
    tenant_id, policy_code, category_code, property_id, jurisdiction,
    interval_months, is_safety_mandatory, legal_source_reference,
    approval_status, effective_from, effective_to, version, created_by
  ) values (
    v_caller.tenant_id, trim(p_policy_code), trim(p_category_code), p_property_id, p_jurisdiction,
    p_interval_months, p_is_safety_mandatory, trim(p_legal_source_reference),
    'APPROVED', p_effective_from, p_effective_to, v_ver, auth.uid()
  ) returning id into v_policy_id;

  return jsonb_build_object('success', true, 'policy_id', v_policy_id, 'version', v_ver);
end;
$function$;$r7_final_6$;
    execute $r7_final_7$CREATE OR REPLACE FUNCTION assets.create_warranty_claim_internal_v1(p_context_id uuid, p_warranty_id uuid, p_claim_reference text, p_description text, p_claim_date date DEFAULT CURRENT_DATE, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
  v_a record;
  v_snapshot jsonb;
  v_claim_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_w from assets.asset_warranties
  where id = p_warranty_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'WARRANTY_NOT_FOUND: Warranty % not found', p_warranty_id;
  end if;

  select * into v_a from assets.assets where id = v_w.asset_id;

  v_snapshot := jsonb_build_object(
    'warranty_id', v_w.id,
    'starts_on', v_w.starts_on,
    'ends_on', v_w.ends_on,
    'vendor_id', v_w.vendor_id,
    'asset_code', v_a.asset_code,
    'asset_name', v_a.name
  );

  insert into assets.asset_warranty_claims (
    tenant_id, warranty_id, asset_id, claim_reference, claim_date,
    description, warranty_snapshot, document_id, created_by
  ) values (
    v_caller.tenant_id, p_warranty_id, v_w.asset_id, trim(p_claim_reference), p_claim_date,
    p_description, v_snapshot, p_document_id, auth.uid()
  ) returning id into v_claim_id;

  return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$function$;$r7_final_7$;
    execute $r7_final_8$CREATE OR REPLACE FUNCTION assets.end_asset_downtime_internal_v1(p_context_id uuid, p_downtime_id uuid, p_ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_restored_operational_status text DEFAULT 'operational'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_dt record;
  v_end timestamptz := coalesce(p_ended_at, statement_timestamp());
  v_duration integer;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Atomic select for update ensuring exactly one winner
  select * into v_dt from assets.asset_downtimes
  where id = p_downtime_id and tenant_id = v_caller.tenant_id and ended_at is null
  for update;

  if not found then
    raise exception 'DOWNTIME_NOT_ACTIVE: Active downtime session % not found', p_downtime_id;
  end if;

  if v_end <= v_dt.started_at then
    raise exception 'INVALID_END_TIME: Downtime end time must be strictly after started_at';
  end if;

  v_duration := greatest(0, floor(extract(epoch from (v_end - v_dt.started_at)) / 60)::integer);

  update assets.asset_downtimes set
    ended_at = v_end,
    duration_minutes = v_duration
  where id = p_downtime_id;

  -- Restore operational status
  update assets.assets set
    operational_status = p_restored_operational_status,
    updated_at = statement_timestamp()
  where id = v_dt.asset_id;

  return jsonb_build_object('success', true, 'downtime_id', p_downtime_id, 'duration_minutes', v_duration);
end;
$function$;$r7_final_8$;
    execute $r7_final_9$CREATE OR REPLACE FUNCTION assets.enforce_asset_domain_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_prop portfolio.properties;
  v_bldg portfolio.buildings;
  v_unit portfolio.units;
  v_meter utilities.meters;
  v_ap security_access.access_points;
  v_vendor maintenance.vendors;
  v_contract maintenance.vendor_contracts;
  v_doc documents.documents;
begin
  -- Block hard delete across all asset tables
  if tg_op = 'DELETE' then
    raise exception 'asset_hard_delete_prohibited: physical deletion is strictly forbidden';
  end if;

  if tg_table_name = 'assets' then
    -- Validate building scope
    if new.building_id is not null then
      select * into v_bldg from portfolio.buildings where id = new.building_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_building_scope_invalid: building not found in property'; end if;
    end if;

    -- Validate unit scope
    if new.unit_id is not null then
      select * into v_unit from portfolio.units where id = new.unit_id and tenant_id = new.tenant_id;
      if not found then raise exception 'asset_unit_scope_invalid: unit not found in tenant'; end if;
      if new.building_id is not null and v_unit.building_id <> new.building_id then
        raise exception 'asset_unit_scope_invalid: unit does not belong to building';
      end if;
    end if;

    -- Validate meter_id
    if new.meter_id is not null then
      select * into v_meter from utilities.meters where id = new.meter_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_meter_scope_invalid: meter not found in property'; end if;
    end if;

    -- Validate access_point_id
    if new.access_point_id is not null then
      select * into v_ap from security_access.access_points where id = new.access_point_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_access_point_scope_invalid: access point not found in property'; end if;
    end if;

    -- Validate vendor_id
    if new.vendor_id is not null then
      select * into v_vendor from maintenance.vendors where id = new.vendor_id and tenant_id = new.tenant_id;
      if not found then raise exception 'asset_vendor_scope_invalid: vendor not found in tenant'; end if;
    end if;

    -- Validate service_contract_id
    if new.service_contract_id is not null then
      select * into v_contract from maintenance.vendor_contracts where id = new.service_contract_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_contract_scope_invalid: service contract not found in property'; end if;
      if new.vendor_id is not null and v_contract.vendor_id <> new.vendor_id then
        raise exception 'asset_contract_scope_invalid: contract vendor mismatch';
      end if;
    end if;

    -- Prevent direct decommissioning transition from regular updates
    if tg_op = 'UPDATE' and new.lifecycle_status in ('decommissioned','decommission_pending') and old.lifecycle_status not in ('decommissioned','decommission_pending') then
      if coalesce(current_setting('cladora.decommission_authorized', true), '') <> 'true' then
        raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
      end if;
    end if;

    -- Immutability of decommissioned/disposed assets
    if tg_op = 'UPDATE' and old.lifecycle_status in ('decommissioned','disposed') and (new.lifecycle_status = old.lifecycle_status or new.status = old.status) and new is distinct from old then
      if coalesce(current_setting('cladora.decommission_authorized', true), '') <> 'true' then
        raise exception 'decommissioned_asset_is_immutable: decommissioned assets cannot be modified';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'asset_inspections' then
    -- Immutability of verified inspections
    if tg_op = 'UPDATE' and old.is_verified = true and new is distinct from old then
      raise exception 'verified_inspection_is_immutable: verified inspections cannot be modified; record a new inspection event';
    end if;

    -- Validate document evidence if attached
    if new.document_id is not null then
      select * into v_doc from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
      if not found then raise exception 'document_not_found'; end if;
      if not exists (
        select 1 from documents.document_versions dv
        where dv.document_id = v_doc.id and dv.version = coalesce(v_doc.current_version, 1) and dv.scanning_status = 'clean'
      ) or v_doc.status <> 'active' or v_doc.disposition_status in ('disposition_pending_execution', 'disposition_approved', 'disposed') then
        raise exception 'document_not_authoritative_evidence: unscanned, quarantined or deferred documents cannot be used as inspection evidence';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'asset_warranty_claims' then
    -- Immutability of resolved claims
    if tg_op = 'UPDATE' and old.resolution_status in ('accepted','rejected','resolved') and new is distinct from old then
      raise exception 'resolved_claim_is_immutable: finalized warranty claims cannot be modified';
    end if;

    return new;
  end if;

  return new;
end;
$function$;$r7_final_9$;
    execute $r7_final_10$CREATE OR REPLACE FUNCTION assets.get_asset_detail_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_asset record;
  v_warranty record;
  v_active_downtime record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  select * into v_active_downtime from assets.asset_downtimes
  where asset_id = p_asset_id and ended_at is null
  order by started_at desc limit 1;

  if v_is_restricted then
    return jsonb_build_object(
      'id', v_asset.id,
      'asset_code', v_asset.asset_code,
      'name', v_asset.name,
      'category_id', v_asset.category_id,
      'property_id', v_asset.property_id,
      'building_id', v_asset.building_id,
      'unit_id', v_asset.unit_id,
      'scope', v_asset.scope,
      'location_description', v_asset.location_description,
      'lifecycle_status', v_asset.lifecycle_status,
      'operational_status', v_asset.operational_status,
      'condition', v_asset.condition,
      'criticality_level', v_asset.criticality_level,
      'is_safety_critical', v_asset.is_safety_critical,
      'installed_on', v_asset.installed_on,
      'commissioned_at', v_asset.commissioned_at,
      'is_in_downtime', (v_active_downtime.id is not null)
    );
  end if;

  select * into v_warranty from assets.asset_warranties
  where asset_id = p_asset_id order by ends_on desc limit 1;

  return jsonb_build_object(
    'id', v_asset.id,
    'asset_code', v_asset.asset_code,
    'name', v_asset.name,
    'description', v_asset.description,
    'category_id', v_asset.category_id,
    'property_id', v_asset.property_id,
    'building_id', v_asset.building_id,
    'unit_id', v_asset.unit_id,
    'scope', v_asset.scope,
    'manufacturer', v_asset.manufacturer,
    'model', v_asset.model,
    'serial_fingerprint', v_asset.serial_fingerprint,
    'manufacture_year', v_asset.manufacture_year,
    'installed_on', v_asset.installed_on,
    'commissioned_at', v_asset.commissioned_at,
    'location_description', v_asset.location_description,
    'ownership_type', v_asset.ownership_type,
    'lifecycle_status', v_asset.lifecycle_status,
    'operational_status', v_asset.operational_status,
    'condition', v_asset.condition,
    'criticality_level', v_asset.criticality_level,
    'criticality', v_asset.criticality,
    'is_safety_critical', v_asset.is_safety_critical,
    'replacement_cost', v_asset.replacement_cost,
    'currency', v_asset.currency,
    'meter_id', v_asset.meter_id,
    'access_point_id', v_asset.access_point_id,
    'vendor_id', v_asset.vendor_id,
    'service_contract_id', v_asset.service_contract_id,
    'service_frequency_months', v_asset.service_frequency_months,
    'last_service_date', v_asset.last_service_date,
    'next_service_date', v_asset.next_service_date,
    'warranty', case when v_warranty.id is not null then jsonb_build_object(
      'id', v_warranty.id,
      'status', v_warranty.status,
      'starts_on', v_warranty.starts_on,
      'ends_on', v_warranty.ends_on,
      'vendor_id', v_warranty.vendor_id,
      'coverage_json', v_warranty.coverage_json,
      'document_id', v_warranty.document_id
    ) else null end,
    'active_downtime', case when v_active_downtime.id is not null then jsonb_build_object(
      'id', v_active_downtime.id,
      'started_at', v_active_downtime.started_at,
      'reason', v_active_downtime.reason,
      'is_planned', v_active_downtime.is_planned
    ) else null end,
    'created_at', v_asset.created_at,
    'updated_at', v_asset.updated_at
  );
end;
$function$;$r7_final_10$;
    execute $r7_final_11$CREATE OR REPLACE FUNCTION assets.get_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty terms restricted';
  end if;

  select * into v_w from assets.asset_warranties
  where asset_id = p_asset_id and tenant_id = v_caller.tenant_id
  order by ends_on desc limit 1;

  if not found then
    return jsonb_build_object('warranty', null);
  end if;

  return jsonb_build_object(
    'warranty', jsonb_build_object(
      'id', v_w.id,
      'status', case when v_w.ends_on < current_date and v_w.status = 'active' then 'expired' else v_w.status end,
      'starts_on', v_w.starts_on,
      'ends_on', v_w.ends_on,
      'vendor_id', v_w.vendor_id,
      'coverage_json', v_w.coverage_json,
      'warranty_terms', v_w.warranty_terms,
      'document_id', v_w.document_id,
      'created_at', v_w.created_at
    )
  );
end;
$function$;$r7_final_11$;
    execute $r7_final_12$CREATE OR REPLACE FUNCTION assets.list_asset_inspections_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'inspection_type', i.inspection_type,
      'scheduled_date', i.scheduled_date,
      'performed_at', i.performed_at,
      'result', i.result,
      'inspector_name', i.inspector_name,
      'observations', i.observations,
      'corrective_action_required', i.corrective_action_required,
      'next_due_date', i.next_due_date,
      'is_verified', i.is_verified,
      'verified_at', i.verified_at,
      'document_id', i.document_id,
      'policy_id', i.policy_id
    ) order by i.scheduled_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_inspections i
  where i.asset_id = p_asset_id and i.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;$r7_final_12$;
    execute $r7_final_13$CREATE OR REPLACE FUNCTION assets.list_assets_internal_v1(p_context_id uuid, p_property_id uuid DEFAULT NULL::uuid, p_building_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_lifecycle_status text DEFAULT NULL::text, p_operational_status text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_criticality_level text DEFAULT NULL::text, p_is_safety_critical boolean DEFAULT NULL::boolean, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_total bigint;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select count(*) into v_total
  from assets.assets a
  where a.tenant_id = v_caller.tenant_id
    and (p_property_id is null or a.property_id = p_property_id)
    and (p_building_id is null or a.building_id = p_building_id)
    and (p_category_id is null or a.category_id = p_category_id)
    and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
    and (p_operational_status is null or a.operational_status = p_operational_status)
    and (p_condition is null or a.condition::text = p_condition)
    and (p_criticality_level is null or a.criticality_level = p_criticality_level)
    and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
    and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%');

  if v_is_restricted then
    -- Projected allowlist for owner / resident (excludes confidential commercial, serial, cost, vendor data)
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'location_description', a.location_description,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'is_safety_critical', a.is_safety_critical,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'created_at', a.created_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  else
    -- Full administrative projection
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'description', a.description,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'manufacturer', a.manufacturer,
        'model', a.model,
        'serial_fingerprint', a.serial_fingerprint,
        'manufacture_year', a.manufacture_year,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'location_description', a.location_description,
        'ownership_type', a.ownership_type,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'criticality', a.criticality,
        'is_safety_critical', a.is_safety_critical,
        'replacement_cost', a.replacement_cost,
        'currency', a.currency,
        'meter_id', a.meter_id,
        'access_point_id', a.access_point_id,
        'vendor_id', a.vendor_id,
        'service_contract_id', a.service_contract_id,
        'service_frequency_months', a.service_frequency_months,
        'last_service_date', a.last_service_date,
        'next_service_date', a.next_service_date,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'limit', coalesce(p_limit, 25),
    'offset', coalesce(p_offset, 0),
    'items', v_items
  );
end;
$function$;$r7_final_13$;
    execute $r7_final_14$CREATE OR REPLACE FUNCTION assets.list_compliance_policies_internal_v1(p_context_id uuid, p_category_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'policy_code', p.policy_code,
      'category_code', p.category_code,
      'property_id', p.property_id,
      'jurisdiction', p.jurisdiction,
      'interval_months', p.interval_months,
      'is_safety_mandatory', p.is_safety_mandatory,
      'legal_source_reference', p.legal_source_reference,
      'approval_status', p.approval_status,
      'effective_from', p.effective_from,
      'effective_to', p.effective_to,
      'version', p.version
    ) order by p.created_at desc
  ), '[]'::jsonb) into v_items
  from assets.compliance_policies p
  where p.tenant_id = v_caller.tenant_id
    and (p_category_code is null or p.category_code = p_category_code);

  return jsonb_build_object('items', v_items);
end;
$function$;$r7_final_14$;
    execute $r7_final_15$CREATE OR REPLACE FUNCTION assets.list_warranty_claims_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty claims restricted';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'claim_reference', c.claim_reference,
      'claim_date', c.claim_date,
      'description', c.description,
      'resolution_status', c.resolution_status,
      'resolution_notes', c.resolution_notes,
      'document_id', c.document_id,
      'created_at', c.created_at
    ) order by c.claim_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_warranty_claims c
  where c.asset_id = p_asset_id and c.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;$r7_final_15$;
    execute $r7_final_16$CREATE OR REPLACE FUNCTION assets.record_asset_inspection_internal_v1(p_context_id uuid, p_asset_id uuid, p_inspection_type text, p_scheduled_date date, p_performed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_result text DEFAULT 'pending'::text, p_inspector_name text DEFAULT NULL::text, p_inspector_vendor_id uuid DEFAULT NULL::uuid, p_observations text DEFAULT NULL::text, p_corrective_action_required text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid, p_policy_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_policy record;
  v_snapshot jsonb := null;
  v_next_due date := null;
  v_insp_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if p_policy_id is not null then
    select * into v_policy from assets.compliance_policies
    where id = p_policy_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'compliance_policy_unconfigured: Compliance policy % not found or inactive', p_policy_id;
    end if;

    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  elsif p_inspection_type in ('statutory_compliance', 'statutory', 'mandatory_safety', 'annual_safety') then
    select cp.* into v_policy from assets.compliance_policies cp
    join assets.asset_categories ac on ac.id = v_asset.category_id
    where cp.tenant_id = v_caller.tenant_id
      and cp.category_code = ac.code
      and cp.approval_status = 'APPROVED'
      and (cp.property_id is null or cp.property_id = v_asset.property_id)
      and (cp.effective_to is null or cp.effective_to >= current_date)
      and cp.effective_from <= current_date
    order by (cp.property_id is not null) desc, cp.version desc
    limit 1;

    if not found then
      raise exception 'compliance_policy_unconfigured: No active statutory compliance policy configured for asset category';
    end if;

    p_policy_id := v_policy.id;
    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  end if;

  insert into assets.asset_inspections (
    tenant_id, asset_id, policy_id, policy_version_snapshot, inspection_type,
    scheduled_date, performed_at, result, inspector_name, inspector_vendor_id,
    observations, corrective_action_required, next_due_date, document_id, created_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_policy_id, v_snapshot, p_inspection_type,
    p_scheduled_date, p_performed_at, p_result, p_inspector_name, p_inspector_vendor_id,
    p_observations, p_corrective_action_required, v_next_due, p_document_id, auth.uid()
  ) returning id into v_insp_id;

  -- If inspection failed and asset is safety critical, degrade operational status
  if p_result = 'failed' and v_asset.is_safety_critical then
    update assets.assets set
      operational_status = 'degraded',
      updated_at = statement_timestamp()
    where id = p_asset_id;
  end if;

  return jsonb_build_object('success', true, 'inspection_id', v_insp_id, 'next_due_date', v_next_due);
end;
$function$;$r7_final_16$;
    execute $r7_final_17$CREATE OR REPLACE FUNCTION assets.request_asset_decommission_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_replacement_asset_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_req_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % not found in tenant', p_asset_id;
  end if;

  if v_asset.lifecycle_status in ('decommissioned', 'disposed') then
    raise exception 'ASSET_ALREADY_DECOMMISSIONED: Cannot request decommission for already decommissioned asset';
  end if;

  if p_replacement_asset_id is not null then
    perform 1 from assets.assets
    where id = p_replacement_asset_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'REPLACEMENT_ASSET_NOT_FOUND: Replacement asset not found in same tenant';
    end if;
  end if;

  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, replacement_asset_id, status, reason, requested_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_replacement_asset_id, 'pending', p_reason, auth.uid()
  ) returning id into v_req_id;

  -- Set session authorization flag for decommission transition
  perform set_config('cladora.decommission_authorized', 'true', true);

  update assets.assets set
    lifecycle_status = 'decommission_pending',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'request_id', v_req_id);
end;
$function$;$r7_final_17$;
    execute $r7_final_18$CREATE OR REPLACE FUNCTION assets.resolve_warranty_claim_internal_v1(p_context_id uuid, p_claim_id uuid, p_resolution_status text, p_resolution_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_claim record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_resolution_status not in ('in_review','accepted','rejected','resolved') then
    raise exception 'INVALID_STATUS: Resolution status % not allowed', p_resolution_status;
  end if;

  select * into v_claim from assets.asset_warranty_claims
  where id = p_claim_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND: Claim % not found', p_claim_id;
  end if;

  update assets.asset_warranty_claims set
    resolution_status = p_resolution_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    updated_at = statement_timestamp()
  where id = p_claim_id;

  return jsonb_build_object('success', true, 'claim_id', p_claim_id, 'resolution_status', p_resolution_status);
end;
$function$;$r7_final_18$;
    execute $r7_final_19$CREATE OR REPLACE FUNCTION assets.start_asset_downtime_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_is_planned boolean DEFAULT false, p_work_order_id uuid DEFAULT NULL::uuid, p_ticket_id uuid DEFAULT NULL::uuid, p_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_downtime_id uuid;
  v_start timestamptz := coalesce(p_started_at, statement_timestamp());
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Row lock asset
  perform 1 from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, reason, is_planned,
    work_order_id, ticket_id, recorded_by
  ) values (
    v_caller.tenant_id, p_asset_id, v_start, p_reason, p_is_planned,
    p_work_order_id, p_ticket_id, auth.uid()
  ) returning id into v_downtime_id;

  -- Automatically update operational status to unavailable
  update assets.assets set
    operational_status = 'unavailable',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'downtime_id', v_downtime_id, 'asset_id', p_asset_id);
end;
$function$;$r7_final_19$;
    execute $r7_final_20$CREATE OR REPLACE FUNCTION assets.transition_asset_lifecycle_internal_v1(p_context_id uuid, p_asset_id uuid, p_target_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_target_status in ('decommissioned', 'decommission_pending') then
    raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  -- Commissioning requires AAL2 and verification
  if p_target_status = 'commissioned' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);
  end if;

  if v_asset.is_safety_critical and p_target_status in ('commissioned','out_of_service') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    lifecycle_status = p_target_status,
    commissioned_at = case when p_target_status = 'commissioned' and commissioned_at is null then statement_timestamp() else commissioned_at end,
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'lifecycle_transition', auth.uid(), p_reason,
    jsonb_build_object('lifecycle_status', v_asset.lifecycle_status),
    jsonb_build_object('lifecycle_status', p_target_status),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'lifecycle_status', p_target_status);
end;
$function$;$r7_final_20$;
    execute $r7_final_21$CREATE OR REPLACE FUNCTION assets.update_asset_internal_v1(p_context_id uuid, p_asset_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_location_description text DEFAULT NULL::text, p_meter_id uuid DEFAULT NULL::uuid, p_access_point_id uuid DEFAULT NULL::uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_service_contract_id uuid DEFAULT NULL::uuid, p_service_frequency_months integer DEFAULT NULL::integer, p_replacement_cost numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical or v_asset.criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    name = coalesce(trim(p_name), name),
    description = coalesce(p_description, description),
    location_description = coalesce(p_location_description, location_description),
    meter_id = coalesce(p_meter_id, meter_id),
    access_point_id = coalesce(p_access_point_id, access_point_id),
    vendor_id = coalesce(p_vendor_id, vendor_id),
    service_contract_id = coalesce(p_service_contract_id, service_contract_id),
    service_frequency_months = coalesce(p_service_frequency_months, service_frequency_months),
    replacement_cost = coalesce(p_replacement_cost, replacement_cost),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'asset_id', p_asset_id);
end;
$function$;$r7_final_21$;
    execute $r7_final_22$CREATE OR REPLACE FUNCTION assets.update_asset_operational_status_internal_v1(p_context_id uuid, p_asset_id uuid, p_operational_status text, p_condition text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical and p_operational_status in ('unavailable', 'isolated') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    operational_status = p_operational_status,
    condition = coalesce(p_condition::assets.asset_condition, condition),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'operational_status_change', auth.uid(), p_reason,
    jsonb_build_object('operational_status', v_asset.operational_status, 'condition', v_asset.condition),
    jsonb_build_object('operational_status', p_operational_status, 'condition', coalesce(p_condition, v_asset.condition::text)),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'operational_status', p_operational_status);
end;
$function$;$r7_final_22$;
    execute $r7_final_23$CREATE OR REPLACE FUNCTION assets.upsert_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid, p_starts_on date, p_ends_on date, p_vendor_id uuid DEFAULT NULL::uuid, p_coverage_json jsonb DEFAULT '{}'::jsonb, p_warranty_terms text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_w_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_ends_on < p_starts_on then
    raise exception 'INVALID_WARRANTY_DATES: Warranty ends_on must be on or after starts_on';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_warranties (
    tenant_id, asset_id, starts_on, ends_on, vendor_id,
    coverage_json, warranty_terms, document_id
  ) values (
    v_caller.tenant_id, p_asset_id, p_starts_on, p_ends_on, p_vendor_id,
    coalesce(p_coverage_json, '{}'::jsonb), p_warranty_terms, p_document_id
  ) returning id into v_w_id;

  return jsonb_build_object('success', true, 'warranty_id', v_w_id);
end;
$function$;$r7_final_23$;
    execute $r7_final_24$CREATE OR REPLACE FUNCTION assets.verify_asset_inspection_internal_v1(p_context_id uuid, p_inspection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_insp record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.inspections.verify', true);

  select * into v_insp from assets.asset_inspections
  where id = p_inspection_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'INSPECTION_NOT_FOUND: Inspection % not found', p_inspection_id;
  end if;

  if v_insp.is_verified then
    raise exception 'ALREADY_VERIFIED: Inspection has already been certified';
  end if;

  update assets.asset_inspections set
    is_verified = true,
    verified_by = auth.uid(),
    verified_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_inspection_id;

  return jsonb_build_object('success', true, 'inspection_id', p_inspection_id, 'verified_at', statement_timestamp());
end;
$function$;$r7_final_24$;
    execute $r7_final_25$CREATE OR REPLACE FUNCTION audit.get_customer_events(p_context_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_query text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'audit', 'identity', 'platform', 'portfolio', 'maintenance', 'billing', 'governance', 'utilities', 'security_access', 'app_private'
AS $function$
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
$function$;$r7_final_25$;
    execute $r7_final_26$CREATE OR REPLACE FUNCTION documents.enforce_customer_document_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'documents', 'platform', 'portfolio', 'finance', 'billing', 'payments', 'maintenance', 'governance', 'communications', 'utilities', 'assets', 'audit'
AS $function$
declare
  d documents.documents;
  target_tenant uuid;
begin
  if tg_table_name = 'document_retention_assignments' then
    if tg_op = 'DELETE' then
      raise exception 'retention_assignment_is_immutable' using errcode = '22000';
    end if;
    if tg_op = 'UPDATE' and (old.policy_snapshot is distinct from new.policy_snapshot or old.policy_version is distinct from new.policy_version or old.document_id is distinct from new.document_id) then
      raise exception 'historical_retention_snapshot_immutable' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'document_audit_links' then
    if tg_op <> 'INSERT' then
      raise exception 'document_audit_link_is_immutable' using errcode = '22000';
    end if;
    select * into d from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
    select tenant_id into target_tenant from audit.events where id = new.audit_event_id;
    if d.id is null or target_tenant is null or target_tenant <> new.tenant_id then
      raise exception 'document_link_cross_tenant_or_missing' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'document_links' then
    if tg_op <> 'INSERT' then
      raise exception 'document_link_is_immutable' using errcode = '22000';
    end if;
    select * into d from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
    if d.id is null then
      raise exception 'document_link_document_invalid' using errcode = '22000';
    end if;

    -- Canonical Cross-Module Resolver & Existence Check
    if new.entity_type = 'platform.tenant' then
      select id into target_tenant from platform.tenants where id = new.entity_id;
    elsif new.entity_type = 'portfolio.property' then
      select tenant_id into target_tenant from portfolio.properties where id = new.entity_id;
    elsif new.entity_type = 'portfolio.building' then
      select tenant_id into target_tenant from portfolio.buildings where id = new.entity_id;
    elsif new.entity_type = 'portfolio.unit' then
      select tenant_id into target_tenant from portfolio.units where id = new.entity_id;
    elsif new.entity_type = 'platform.contract' then
      select w.tenant_id into target_tenant
      from platform.workspace_contracts c
      join platform.customer_workspaces w on w.id = c.customer_workspace_id
      where c.id = new.entity_id;
    elsif new.entity_type = 'billing.invoice' then
      select tenant_id into target_tenant from billing.invoices where id = new.entity_id;
    elsif new.entity_type = 'payments.payment' then
      select tenant_id into target_tenant from payments.payments where id = new.entity_id;
    elsif new.entity_type = 'finance.journal' then
      select tenant_id into target_tenant from finance.journals where id = new.entity_id;
    elsif new.entity_type = 'maintenance.work_order' then
      select tenant_id into target_tenant from maintenance.work_orders where id = new.entity_id;
    elsif new.entity_type = 'maintenance.purchase_order' then
      select tenant_id into target_tenant from maintenance.purchase_orders where id = new.entity_id;
    elsif new.entity_type = 'maintenance.rfq' then
      select tenant_id into target_tenant from maintenance.rfqs where id = new.entity_id;
    elsif new.entity_type = 'maintenance.vendor_quote' then
      select tenant_id into target_tenant from maintenance.vendor_quotes where id = new.entity_id;
    elsif new.entity_type = 'maintenance.ticket' then
      select tenant_id into target_tenant from maintenance.tickets where id = new.entity_id;
    elsif new.entity_type = 'governance.meeting' then
      select tenant_id into target_tenant from governance.meetings where id = new.entity_id;
    elsif new.entity_type = 'governance.resolution' then
      select tenant_id into target_tenant from governance.resolutions where id = new.entity_id;
    elsif new.entity_type = 'governance.minute' then
      select tenant_id into target_tenant from governance.minutes where id = new.entity_id;
    elsif new.entity_type = 'communications.post' then
      select tenant_id into target_tenant from communications.posts where id = new.entity_id;
    elsif new.entity_type = 'communications.official_notice' then
      select tenant_id into target_tenant from communications.official_notices where id = new.entity_id;
    elsif new.entity_type = 'communications.statutory_evidence' then
      select tenant_id into target_tenant from communications.statutory_evidence where id = new.entity_id;
    elsif new.entity_type = 'utilities.meter' then
      select tenant_id into target_tenant from utilities.meters where id = new.entity_id;
    elsif new.entity_type = 'utilities.meter_reading' then
      select tenant_id into target_tenant from utilities.meter_readings where id = new.entity_id;
    elsif new.entity_type = 'utilities.ocr_candidate' then
      select tenant_id into target_tenant from utilities.ocr_field_candidates where id = new.entity_id;
    elsif new.entity_type = 'utilities.consumption_period' then
      select tenant_id into target_tenant from utilities.consumption_periods where id = new.entity_id;
    elsif new.entity_type = 'assets.asset' then
      select tenant_id into target_tenant from assets.assets where id = new.entity_id;
    elsif new.entity_type = 'assets.inspection' then
      select tenant_id into target_tenant from assets.asset_inspections where id = new.entity_id;
    elsif new.entity_type = 'assets.warranty' then
      select tenant_id into target_tenant from assets.asset_warranties where id = new.entity_id;
    else
      raise exception 'document_link_type_invalid' using errcode = '22000';
    end if;

    if target_tenant is null or target_tenant <> new.tenant_id then
      raise exception 'document_link_cross_tenant_or_missing' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'documents' then
    if tg_op = 'DELETE' then
      if old.legal_hold or exists(select 1 from documents.legal_holds h where h.document_id = old.id and h.status = 'active') then
        raise exception 'document_under_legal_hold' using errcode = '22000';
      end if;
      if old.is_evidence and old.evidence_status = 'verified' then
        raise exception 'verified_evidence_cannot_be_deleted' using errcode = '22000';
      end if;
    end if;

    if tg_op = 'UPDATE' then
      if old.legal_hold and (new.title, new.document_type, new.category, new.deleted_at) is distinct from (old.title, old.document_type, old.category, old.deleted_at) then
        raise exception 'document_under_legal_hold' using errcode = '22000';
      end if;
      if old.evidence_status = 'verified' and (new.is_evidence, new.evidence_status, new.evidence_type, new.verified_by, new.verified_at) is distinct from (old.is_evidence, old.evidence_status, old.evidence_type, old.verified_by, old.verified_at) then
        raise exception 'verified_evidence_is_immutable' using errcode = '22000';
      end if;
      if old.published_at is not null and (new.current_version, new.title, new.document_type, new.effective_on, new.retention_snapshot) is distinct from (old.current_version, old.title, old.document_type, old.effective_on, old.retention_snapshot) then
        raise exception 'published_document_is_immutable' using errcode = '22000';
      end if;
      if new.classification < old.classification then
        raise exception 'classification_downgrade_forbidden' using errcode = '22000';
      end if;
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'legal_holds' then
    if tg_op = 'DELETE' then
      raise exception 'legal_hold_history_is_append_only' using errcode = '22000';
    end if;
    if tg_op = 'UPDATE' and old.status = 'released' and new is distinct from old then
      raise exception 'released_legal_hold_is_immutable' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'retention_records' then
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.finalized_at is not null and new is distinct from old) then
      raise exception 'final_retention_record_is_immutable' using errcode = '22000';
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'lifecycle_events' then
    if tg_op <> 'INSERT' then
      raise exception 'document_lifecycle_is_append_only' using errcode = '22000';
    end if;
    return new;
  end if;

  return new;
end;
$function$;$r7_final_26$;
    execute $r7_final_27$CREATE OR REPLACE FUNCTION governance.create_minutes_correction(p_context_id uuid, p_prior_minutes_id uuid, p_correction_reason text, p_content_json jsonb)
 RETURNS governance.minutes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'governance', 'audit', 'extensions'
AS $function$
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

  v_sha := encode(extensions.digest(p_content_json::text, 'sha256'), 'hex');

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
$function$;$r7_final_27$;
    execute $r7_final_28$CREATE OR REPLACE FUNCTION payments.assert_payments_module_entitled(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'platform'
AS $function$
declare
  v_workspace uuid;
begin
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = p_tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.payments'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'payments_entitlement_required' using errcode = '42501';
  end if;

  return true;
end;
$function$;$r7_final_28$;
    execute $r7_final_29$CREATE OR REPLACE FUNCTION payments.process_webhook_event_v1(p_tenant_id uuid DEFAULT NULL::uuid, p_provider_code text DEFAULT 'unconfigured'::text, p_provider_event_id text DEFAULT 'unknown'::text, p_event_type text DEFAULT 'unknown'::text, p_payload_hash text DEFAULT ''::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'billing', 'finance', 'portfolio', 'audit'
AS $function$
declare
  v_intent_id uuid;
  v_intent payments.payment_intents;
  v_tenant_id uuid;
  v_receipt payments.webhook_receipts;
  v_beneficiary payments.beneficiary_accounts;
  v_bank_gl_id uuid;
  v_ar_gl_id uuid;
  v_clearing_gl_id uuid;
  v_settled_at timestamptz;
  v_amount numeric(20,4);
  v_currency text;
  v_journal_id uuid;
  v_journal_no bigint;
  v_payment_id uuid;
  v_settlement_id uuid;
  v_inv record;
  v_remaining numeric(20,4);
  v_alloc_amount numeric(20,4);
  v_total_allocated numeric(20,4) := 0;
  v_unallocated numeric(20,4) := 0;
  v_alloc_id uuid;
begin
  -- 5.1 Resolve Intent directly from payload reference without trusting header tenant
  v_intent_id := (p_payload->>'payment_intent_id')::uuid;
  if v_intent_id is null and (p_payload->>'client_reference') is not null then
    select id into v_intent_id from payments.payment_intents
    where client_reference = trim(p_payload->>'client_reference');
  end if;

  if v_intent_id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'missing_payment_intent_id');
  end if;

  -- 5.2 Row lock target Payment Intent
  select * into v_intent
  from payments.payment_intents
  where id = v_intent_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed', 'reason', 'intent_not_found');
  end if;

  v_tenant_id := v_intent.tenant_id;

  -- Enforce untrusted tenant isolation
  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'untrusted_tenant_boundary_violation' using errcode = '42501';
  end if;

  -- 5.3 Webhook Receipt Idempotency
  select * into v_receipt
  from payments.webhook_receipts
  where tenant_id = v_tenant_id
    and provider_code = p_provider_code
    and provider_event_id = p_provider_event_id;

  if found then
    return jsonb_build_object(
      'status', 'ignored',
      'reason', 'duplicate_event',
      'receipt_id', v_receipt.id
    );
  end if;

  insert into payments.webhook_receipts (
    tenant_id,
    provider_code,
    provider_event_id,
    event_type,
    payload_hash,
    raw_payload_sanitized,
    processing_status
  ) values (
    v_tenant_id,
    p_provider_code,
    p_provider_event_id,
    p_event_type,
    p_payload_hash,
    p_payload,
    'received'
  ) returning * into v_receipt;

  -- 5.4 Fail-closed Reversal & Chargeback boundary
  if p_event_type in ('payment.refunded', 'payment.chargeback', 'refund.created') then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'deferred', error_details = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'deferred', 'reason', 'DEFERRED-PAYMENT-REVERSAL-PROVIDER');
  end if;

  -- 5.5 Terminal state immutability for settlement events
  if v_intent.status in ('succeeded', 'settled', 'cancelled', 'expired') then
    update payments.webhook_receipts
    set processing_status = 'ignored', error_details = 'intent_already_terminal'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'ignored', 'reason', 'intent_already_terminal');
  end if;

  -- 5.6 Fail-closed check: verify associated beneficiary is NOT revoked
  select * into v_beneficiary
  from payments.beneficiary_accounts
  where id = (v_intent.beneficiary_snapshot->>'beneficiary_id')::uuid;

  if not found or v_beneficiary.status = 'revoked' then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'beneficiary_revoked',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'failed', error_details = 'beneficiary_revoked'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'requires_review', 'reason', 'beneficiary_revoked');
  end if;

  -- 5.7 Amount & currency validation
  v_amount := (p_payload->>'amount')::numeric(20,4);
  v_currency := coalesce(p_payload->>'currency', 'RON');

  if v_amount is null or v_amount <> v_intent.amount or v_currency <> v_intent.currency then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'amount_or_currency_mismatch',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'failed', error_details = 'amount_or_currency_mismatch'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'requires_review', 'reason', 'amount_or_currency_mismatch');
  end if;

  -- 5.8 Succeeded / Checkout Completed Event Handling
  if p_event_type in ('payment.succeeded', 'checkout.completed') then
    v_settled_at := statement_timestamp();

    -- Open accounting period assertion (reject closed period)
    perform finance.assert_scope_date_not_in_closed_period(v_tenant_id, v_intent.property_id, v_settled_at::date);

    -- Select Bank GL Account (5121)
    select id into v_bank_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
    order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_bank_gl_id is null then
      insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status)
      values (v_tenant_id, v_intent.property_id, '5121', 'Conturi la banci in lei', 'asset', coalesce(v_currency, 'RON'), 'active')
      on conflict do nothing;

      select id into v_bank_gl_id from finance.accounts
      where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
        and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
      order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;
    end if;

    if v_bank_gl_id is null then
      raise exception 'bank_gl_account_not_found' using errcode = '22023';
    end if;

    -- Select AR GL Account (4111)
    select id into v_ar_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '4111' or code like '411%') and status = 'active'
    order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_ar_gl_id is null then
      insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status)
      values (v_tenant_id, v_intent.property_id, '4111', 'Clienti / Proprietari cote intretinere', 'asset', coalesce(v_currency, 'RON'), 'active')
      on conflict do nothing;

      select id into v_ar_gl_id from finance.accounts
      where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
        and (code = '4111' or code like '411%') and status = 'active'
      order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;
    end if;

    if v_ar_gl_id is null then
      raise exception 'ar_gl_account_not_found' using errcode = '22023';
    end if;

    -- Select Clearing GL Account (419 Customer Advances)
    select id into v_clearing_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
    order by (case when code = '419' or code like '419%' then 0 else 1 end),
             (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_clearing_gl_id is null then
      insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status)
      values (v_tenant_id, v_intent.property_id, '419', 'Clienti - creditori (Avansuri incasate)', 'liability', coalesce(v_currency, 'RON'), 'active')
      on conflict do nothing;

      select id into v_clearing_gl_id from finance.accounts
      where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
        and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
      order by (case when code = '419' or code like '419%' then 0 else 1 end),
               (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;
    end if;

    if v_clearing_gl_id is null then
      raise exception 'clearing_gl_account_not_found' using errcode = '22023';
    end if;

    -- Compute invoice allocations (S = A + U)
    v_remaining := v_amount;
    v_total_allocated := 0;

    for v_inv in
      select inv.id as invoice_id, inv.invoice_no, r.id as receivable_id, r.outstanding_amount
      from billing.invoices inv
      join billing.receivables r on r.invoice_id = inv.id
      where inv.tenant_id = v_tenant_id
        and inv.unit_id = v_intent.unit_id
        and r.outstanding_amount > 0
        and inv.status <> 'void'
      order by inv.due_on asc, inv.invoice_no asc
      for update of r
    loop
      if v_remaining <= 0 then exit; end if;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      if v_alloc_amount > 0 then
        v_total_allocated := v_total_allocated + v_alloc_amount;
        v_remaining := v_remaining - v_alloc_amount;
      end if;
    end loop;

    v_unallocated := v_amount - v_total_allocated;

    -- 5.8.1 Atomic compound journal posting:
    -- Dr 5121 (Bank) = S
    -- Cr 4111 (AR) = A
    -- Cr 419  (Advances) = U
    -- Total Dr = Total Cr = S
    v_settlement_id := gen_random_uuid();
    v_journal_id := gen_random_uuid();

    insert into finance.journals (
      id, tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
    ) values (
      v_journal_id, v_tenant_id, v_intent.property_id, v_settled_at::date, v_currency,
      'Direct association payment settlement: ' || v_intent.client_reference,
      'payments.settlement', v_settlement_id, 'draft'
    ) returning journal_no into v_journal_no;

    -- Dr 5121 Bank for total settlement S
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v_tenant_id, v_journal_id, v_bank_gl_id, v_intent.unit_id, v_intent.payer_party_id,
      'debit', v_amount, 'Direct settlement bank receipt: ' || v_intent.client_reference
    );

    -- Cr 4111 Receivables for allocated amount A
    if v_total_allocated > 0 then
      insert into finance.journal_entries (
        tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
      ) values (
        v_tenant_id, v_journal_id, v_ar_gl_id, v_intent.unit_id, v_intent.debtor_party_id,
        'credit', v_total_allocated, 'Bill receivables cleared: ' || v_intent.client_reference
      );
    end if;

    -- Cr 419 Customer Advances for unallocated excess U
    if v_unallocated > 0 then
      insert into finance.journal_entries (
        tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
      ) values (
        v_tenant_id, v_journal_id, v_clearing_gl_id, v_intent.unit_id, v_intent.payer_party_id,
        'credit', v_unallocated, 'Unallocated advance clearing balance: ' || v_intent.client_reference
      );
    end if;

    -- Post the journal
    update finance.journals
    set status = 'posted',
        posted_at = statement_timestamp()
    where id = v_journal_id;

    -- 5.8.2 Insert canonical Payment record (status: settled)
    v_payment_id := gen_random_uuid();
    insert into payments.payments (
      id,
      tenant_id,
      property_id,
      unit_id,
      payer_party_id,
      amount,
      currency,
      paid_at,
      status,
      method,
      provider_ref,
      description,
      idempotency_key,
      journal_id,
      payment_intent_id,
      clearing_account_id
    ) values (
      v_payment_id,
      v_tenant_id,
      v_intent.property_id,
      v_intent.unit_id,
      v_intent.payer_party_id,
      v_amount,
      v_currency,
      v_settled_at,
      'settled',
      v_intent.payment_method,
      p_provider_event_id,
      'Settled Direct Checkout: ' || v_intent.client_reference,
      v_intent.idempotency_key,
      v_journal_id,
      v_intent.id,
      v_clearing_gl_id
    );

    -- 5.8.3 Insert Settlement Record (bound to payment_id and journal_id)
    insert into payments.settlements (
      id,
      tenant_id,
      payment_intent_id,
      beneficiary_account_id,
      settlement_reference,
      amount,
      currency,
      settled_at,
      payment_id,
      journal_id
    ) values (
      v_settlement_id,
      v_tenant_id,
      v_intent.id,
      v_beneficiary.id,
      coalesce(p_payload->>'settlement_reference', 'SETTLE-' || p_provider_event_id),
      v_amount,
      v_currency,
      v_settled_at,
      v_payment_id,
      v_journal_id
    );

    -- 5.8.4 Execute allocations and update receivables via canonical path
    v_remaining := v_amount;
    for v_inv in
      select inv.id as invoice_id, inv.invoice_no, r.id as receivable_id, r.outstanding_amount, r.paid_amount, r.original_amount, r.credited_amount
      from billing.invoices inv
      join billing.receivables r on r.invoice_id = inv.id
      where inv.tenant_id = v_tenant_id
        and inv.unit_id = v_intent.unit_id
        and r.outstanding_amount > 0
        and inv.status <> 'void'
      order by inv.due_on asc, inv.invoice_no asc
      for update of r
    loop
      if v_remaining <= 0 then exit; end if;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      if v_alloc_amount > 0 then
        insert into payments.payment_allocations (
          tenant_id,
          payment_id,
          receivable_id,
          amount,
          status,
          idempotency_key,
          journal_id
        ) values (
          v_tenant_id,
          v_payment_id,
          v_inv.receivable_id,
          v_alloc_amount,
          'active',
          'ALLOC-' || v_intent.idempotency_key || '-' || v_inv.receivable_id::text,
          v_journal_id
        ) returning id into v_alloc_id;

        update billing.receivables
        set paid_amount = paid_amount + v_alloc_amount,
            last_payment_at = statement_timestamp(),
            updated_at = statement_timestamp()
        where id = v_inv.receivable_id;

        update billing.invoices
        set status = case
          when (v_inv.original_amount - (v_inv.paid_amount + v_alloc_amount) - v_inv.credited_amount) <= 0 then 'paid'::billing.invoice_status
          else 'partially_paid'::billing.invoice_status
        end,
        updated_at = statement_timestamp()
        where id = v_inv.invoice_id;

        v_remaining := v_remaining - v_alloc_amount;
      end if;
    end loop;

    -- 5.8.5 Mark intent succeeded
    update payments.payment_intents
    set status = 'succeeded',
        settled_at = v_settled_at,
        updated_at = statement_timestamp()
    where id = v_intent.id;

    -- 5.8.6 Mark webhook receipt processed
    update payments.webhook_receipts
    set processing_status = 'processed',
        processed_at = statement_timestamp()
    where id = v_receipt.id;

    insert into audit.events (
      tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
    ) values (
      v_tenant_id, null, 'webhook_service', 'SETTLEMENT_PROCESSED_CANONICAL', 'payments.settlement', v_settlement_id,
      jsonb_build_object(
        'payment_intent_id', v_intent.id,
        'payment_id', v_payment_id,
        'journal_id', v_journal_id,
        'journal_no', v_journal_no,
        'amount', v_amount,
        'allocated_amount', v_total_allocated,
        'unallocated_amount', v_unallocated
      ),
      statement_timestamp()
    );

    return jsonb_build_object(
      'status', 'succeeded',
      'payment_intent_id', v_intent.id,
      'payment_id', v_payment_id,
      'journal_id', v_journal_id,
      'journal_no', v_journal_no,
      'settlement_amount', v_amount,
      'allocated_amount', v_total_allocated,
      'unallocated_amount', v_unallocated
    );
  end if;

  return jsonb_build_object('status', 'ignored', 'reason', 'unhandled_event_type');
end;
$function$;$r7_final_29$;
    execute $r7_final_30$CREATE OR REPLACE FUNCTION payments.resolve_unit_debtor_party_v1(p_tenant_id uuid, p_unit_id uuid, p_membership_key uuid DEFAULT NULL::uuid)
 RETURNS TABLE(property_id uuid, debtor_party_id uuid, payer_party_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'portfolio', 'billing', 'identity'
AS $function$
declare
  v_prop_id uuid;
  v_debtor uuid;
  v_payer uuid;
begin
  select b.property_id, coalesce(
    (select o.party_id from portfolio.ownerships o where o.tenant_id = p_tenant_id and o.unit_id = u.id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date) limit 1),
    (select inv.liable_party_id from billing.invoices inv where inv.tenant_id = p_tenant_id and inv.unit_id = u.id order by inv.period_end desc limit 1)
  ) into v_prop_id, v_debtor
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where u.id = p_unit_id and u.tenant_id = p_tenant_id;

  if p_membership_key is not null then
    select mp.party_id into v_payer
    from identity.membership_parties mp
    where mp.membership_id = p_membership_key and mp.tenant_id = p_tenant_id;
  end if;

  return query select v_prop_id, v_debtor, v_payer;
end;
$function$;$r7_final_30$;
    execute $r7_final_31$CREATE OR REPLACE FUNCTION payments.validate_and_mask_iban(p_iban text, OUT o_normalized text, OUT o_masked text, OUT o_fingerprint text)
 RETURNS record
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'extensions'
AS $function$
declare
  v_clean text;
  v_num text;
  v_char text;
  v_code integer;
  v_mod integer := 0;
  i integer;
begin
  v_clean := upper(regexp_replace(coalesce(p_iban, ''), '[^A-Za-z0-9]', '', 'g'));
  
  if length(v_clean) < 15 or length(v_clean) > 34 then
    raise exception 'invalid_iban_length' using errcode = '22023';
  end if;

  -- Romanian IBAN specific validation if starting with RO
  if left(v_clean, 2) = 'RO' and length(v_clean) <> 24 then
    raise exception 'invalid_romanian_iban_length' using errcode = '22023';
  end if;

  -- MOD-97 check
  v_num := substr(v_clean, 5) || substr(v_clean, 1, 4);
  v_mod := 0;
  for i in 1..length(v_num) loop
    v_char := substr(v_num, i, 1);
    if v_char ~ '^[0-9]$' then
      v_mod := (v_mod * 10 + v_char::integer) % 97;
    else
      v_code := ascii(v_char) - 55;
      v_mod := (v_mod * 100 + v_code) % 97;
    end if;
  end loop;

  if v_mod <> 1 then
    raise exception 'invalid_iban_checksum' using errcode = '22023';
  end if;

  o_normalized := v_clean;
  o_masked := left(v_clean, 4) || '****' || right(v_clean, 4);
  o_fingerprint := encode(extensions.digest(v_clean, 'sha256'), 'hex');
end;
$function$;$r7_final_31$;
    execute $r7_final_32$CREATE OR REPLACE FUNCTION platform.get_customer_dashboard(p_context_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'platform', 'identity', 'portfolio', 'maintenance', 'billing', 'communications', 'occupancy'
AS $function$
declare
  v record;
  v_workspace uuid;
  v_party_id uuid;
  v_ownership_id uuid;
  v_lease_id uuid;
  v_entitlements jsonb;
  v_permissions jsonb;
  v_modules jsonb;
  v_persona text;
  v_sections jsonb;
  v_capabilities jsonb;
  v_kpis jsonb;
begin
  -- 1. Authentication requirement
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Customer MFA verification
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context grant, active membership, tenant and role resolution
  select
    g.id,
    g.membership_id,
    g.tenant_id,
    g.scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.id as membership_key,
    m.role_id,
    lower(r.code) as role_code,
    r.name as role_name,
    t.legal_name as tenant_name
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

  -- 4. Fail-closed check: only 6 canonical roles permitted
  if v.role_code not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'unknown_role' using errcode = '42501';
  end if;

  -- 5. Customer workspace validation: active workspace must be present
  select w.id
  into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id
    and w.lifecycle_status = 'ACTIVE'
  order by w.id
  limit 1;

  if v_workspace is null then
    raise exception 'workspace_inactive' using errcode = '42501';
  end if;

  -- 6. Server-authoritative entitlements and permissions extraction with full override semantics
  select coalesce(jsonb_agg(e.entitlement_key order by e.entitlement_key), '[]'::jsonb)
  into v_entitlements
  from platform.workspace_entitlements e
  where e.customer_workspace_id = v_workspace
    and e.valid_from <= statement_timestamp()
    and (e.valid_until is null or e.valid_until > statement_timestamp())
    and (
      case
        when e.override_value_json is not null
         and e.override_expires_at > statement_timestamp()
        then e.override_value_json = 'true'::jsonb
        else e.boolean_value is true
      end
    );

  select coalesce(jsonb_agg(distinct p.code order by p.code), '[]'::jsonb)
  into v_permissions
  from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  where rp.role_id = v.role_id and rp.effect = 'allow';

  -- 7. Server-authoritative module visibility derivation (intersection of permission + active entitlement)
  select coalesce(jsonb_agg(m order by m), '[]'::jsonb)
  into v_modules
  from (
    select 'dashboard' as m
    union
    select 'accounting' where (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting')
    union
    select 'billing' where (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing')
    union
    select 'payments' where (v_permissions ? 'payments.reconciliation.read') and (v_entitlements ? 'module.payments')
    union
    select 'utilities' where (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities')
    union
    select 'maintenance' where (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'procurement' where (v_permissions ? 'maintenance.procurement.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'governance' where (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance')
    union
    select 'communications' where (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications')
    union
    select 'documents' where (v_permissions ? 'documents.vault.read') and (v_entitlements ? 'module.documents')
    union
    select 'occupancy' where (v_permissions ? 'occupancy.registry.read') and (v_entitlements ? 'module.occupancy')
    union
    select 'security' where (v_permissions ? 'security.access.read') and (v_entitlements ? 'module.security')
    union
    select 'audit' where (v_permissions ? 'audit.events.read')
  ) t;

  -- 8. Deep Resident Validation (owner and tenant_resident)
  if v.role_code in ('owner', 'tenant_resident') then
    -- 8.1 Unit context requirement: scope_type must be unit and unit_id not null
    if v.scope_type <> 'unit' or v.unit_id is null then
      raise exception 'unit_context_required' using errcode = '42501';
    end if;

    -- 8.2 Party mapping requirement
    select mp.party_id into v_party_id
    from identity.membership_parties mp
    where mp.membership_id = v.membership_key
      and mp.tenant_id = v.tenant_id;

    if v_party_id is null then
      raise exception 'resident_party_mapping_required' using errcode = '42501';
    end if;

    -- 8.3 Owner validation: active ownership record
    if v.role_code = 'owner' then
      select o.id into v_ownership_id
      from portfolio.ownerships o
      where o.tenant_id = v.tenant_id
        and o.unit_id = v.unit_id
        and o.party_id = v_party_id
        and o.valid_from <= current_date
        and (o.valid_to is null or o.valid_to > current_date)
      limit 1;

      if v_ownership_id is null then
        raise exception 'ownership_required' using errcode = '42501';
      end if;

    -- 8.4 Tenant-resident validation: active lease
    elsif v.role_code = 'tenant_resident' then
      select l.id into v_lease_id
      from occupancy.leases l
      where l.tenant_id = v.tenant_id
        and l.unit_id = v.unit_id
        and l.tenant_party_id = v_party_id
        and l.status = 'active'
        and l.starts_on <= current_date
        and (l.ends_on is null or l.ends_on > current_date)
      limit 1;

      if v_lease_id is null then
        raise exception 'active_lease_required' using errcode = '42501';
      end if;
    end if;
  end if;

  -- 9. Role-aware Persona matrix, sections, capabilities, and isolated KPIs
  if v.role_code in ('association_admin', 'property_manager') then
    v_persona := v.role_code;
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_sections := v_sections || jsonb_build_array('operations');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_operations');
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_sections := v_sections || jsonb_build_array('financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financials');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'properties', (select count(*) from portfolio.properties p where p.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or p.id = v.property_id or p.id = (select b.property_id from portfolio.buildings b where b.id = v.building_id) or p.id = (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = v.unit_id))),
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id or b.id = (select u.building_id from portfolio.units u where u.id = v.unit_id))),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id))
    );

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id or w.unit_id = v.unit_id)));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id)));
    end if;

  elsif v.role_code = 'president' then
    v_persona := 'president';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance') then
      v_sections := v_sections || jsonb_build_array('governance');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_governance');
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_sections := v_sections || jsonb_build_array('financial_summary');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_summary');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id)),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id))
    );

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id)));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)));
    end if;

  elsif v.role_code = 'censor' then
    v_persona := 'censor';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_sections := v_sections || jsonb_build_array('financial_controls');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_controls');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_kpis := v_kpis || jsonb_build_object(
        'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)),
        'financial_records', (select count(*) from billing.invoices i where i.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id))
      );
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

  elsif v.role_code = 'owner' then
    v_persona := 'owner';
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    v_sections := v_sections || jsonb_build_array('my_units');
    v_capabilities := v_capabilities || jsonb_build_array('can_view_my_units');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_financials');
    end if;

    -- Strict unit-only isolation: unit_id matches the validated ownership unit!
    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'my_units_count', (select count(*) from portfolio.ownerships o where o.tenant_id = v.tenant_id and o.unit_id = v.unit_id and o.party_id = v_party_id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date))
    );

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('my_open_requests', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')));
    end if;

  elsif v.role_code = 'tenant_resident' then
    v_persona := 'tenant_resident';
    v_sections := jsonb_build_array('my_residence');
    v_capabilities := jsonb_build_array('can_view_my_residence');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_expenses');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_expenses');
    end if;

    if (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities') then
      v_sections := v_sections || jsonb_build_array('my_consumption');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_consumption');
    end if;

    -- Strict unit & tenant party isolation!
    v_kpis := '{}'::jsonb;

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id and (i.liable_party_id is null or i.liable_party_id = v_party_id)));
    end if;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('my_open_tickets', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;
  end if;

  -- 10. Explicit versioned response construction
  return jsonb_build_object(
    'version', 1,
    'persona', v_persona,
    'contextId', v.id,
    'context', jsonb_build_object(
      'id', v.id,
      'tenant_id', v.tenant_id,
      'tenant_name', v.tenant_name,
      'role_code', v.role_code,
      'role_name', v.role_name,
      'scope_type', v.scope_type,
      'property_id', v.property_id,
      'building_id', v.building_id,
      'unit_id', v.unit_id
    ),
    'workspace_id', v_workspace,
    'permissions', v_permissions,
    'entitlements', v_entitlements,
    'modules', v_modules,
    'capabilities', v_capabilities,
    'sections', v_sections,
    'kpis', v_kpis,
    'generated_at', statement_timestamp()
  );
end $function$;$r7_final_32$;
  else
    execute $r7_early_0$CREATE OR REPLACE FUNCTION assets.approve_asset_decommission_internal_v1(p_context_id uuid, p_request_id uuid, p_approved boolean, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_req record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.decommission', true);

  select * into v_req from assets.asset_decommission_requests
  where id = p_request_id and tenant_id = v_caller.tenant_id for update;

  if not found or v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING: Decommission request % is not pending', p_request_id;
  end if;

  select * into v_asset from assets.assets
  where id = v_req.asset_id and tenant_id = v_caller.tenant_id for update;

  -- Dual-control: If safety-critical, approver cannot be the same as requester
  if (v_asset.is_safety_critical or v_asset.criticality_level = 'critical') and v_req.requested_by = auth.uid() then
    raise exception 'dual_control_required_for_critical_asset: independent approver required for critical asset decommission';
  end if;

  if p_approved then
    update assets.asset_decommission_requests set
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = statement_timestamp()
    where id = p_request_id;

    -- Set session authorization flag
    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'decommissioned',
      operational_status = 'isolated',
      retired_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where id = v_asset.id;

    insert into assets.asset_history (
      tenant_id, asset_id, event_type, actor_id, reason, occurred_at
    ) values (
      v_caller.tenant_id, v_asset.id, 'asset_decommissioned', auth.uid(), v_req.reason, statement_timestamp()
    );
  else
    update assets.asset_decommission_requests set
      status = 'rejected',
      approved_by = auth.uid(),
      approved_at = statement_timestamp(),
      rejection_reason = p_rejection_reason
    where id = p_request_id;

    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'active',
      updated_at = statement_timestamp()
    where id = v_asset.id;
  end if;

  return jsonb_build_object('success', true, 'request_id', p_request_id, 'approved', p_approved);
end;
$function$;$r7_early_0$;
    execute $r7_early_1$CREATE OR REPLACE FUNCTION assets.check_asset_caller_v1(p_context_id uuid, p_required_permission text, p_require_aal2 boolean DEFAULT false)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'identity', 'platform'
AS $function$
declare
  v_rec record;
  v_uid uuid := auth.uid();
  v_aal text;
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;

  select coalesce(auth.jwt()->>'aal', 'aal1') into v_aal;
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED: Elevated AAL2 authentication required' using errcode = '42501';
  end if;

  select
    g.tenant_id,
    g.membership_id,
    m.user_id,
    r.code as role_code,
    g.scope_type::text as scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.role_id
  into v_rec
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = v_uid
    and m.status = 'active';

  if not found then
    raise exception 'ACCESS_DENIED: User context invalid or inactive' using errcode = '42501';
  end if;

  -- Check explicit permission
  if p_required_permission is not null then
    if not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id = rp.permission_id
      where rp.role_id = v_rec.role_id and p.code = p_required_permission and rp.effect = 'allow'
    ) then
      raise exception 'INSUFFICIENT_PERMISSIONS: Required permission %', p_required_permission using errcode = '42501';
    end if;
  end if;

  return v_rec;
end;
$function$;$r7_early_1$;
    execute $r7_early_2$CREATE OR REPLACE FUNCTION assets.configure_compliance_policy_internal_v1(p_context_id uuid, p_policy_code text, p_category_code text, p_interval_months integer, p_legal_source_reference text, p_effective_from date, p_effective_to date DEFAULT NULL::date, p_property_id uuid DEFAULT NULL::uuid, p_is_safety_mandatory boolean DEFAULT false, p_jurisdiction text DEFAULT 'RO'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_policy_id uuid;
  v_ver integer := 1;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);

  -- Determine version
  select coalesce(max(version), 0) + 1 into v_ver
  from assets.compliance_policies
  where tenant_id = v_caller.tenant_id and policy_code = trim(p_policy_code);

  insert into assets.compliance_policies (
    tenant_id, policy_code, category_code, property_id, jurisdiction,
    interval_months, is_safety_mandatory, legal_source_reference,
    approval_status, effective_from, effective_to, version, created_by
  ) values (
    v_caller.tenant_id, trim(p_policy_code), trim(p_category_code), p_property_id, p_jurisdiction,
    p_interval_months, p_is_safety_mandatory, trim(p_legal_source_reference),
    'APPROVED', p_effective_from, p_effective_to, v_ver, auth.uid()
  ) returning id into v_policy_id;

  return jsonb_build_object('success', true, 'policy_id', v_policy_id, 'version', v_ver);
end;
$function$;$r7_early_2$;
    execute $r7_early_3$CREATE OR REPLACE FUNCTION assets.create_warranty_claim_internal_v1(p_context_id uuid, p_warranty_id uuid, p_claim_reference text, p_description text, p_claim_date date DEFAULT CURRENT_DATE, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
  v_a record;
  v_snapshot jsonb;
  v_claim_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_w from assets.asset_warranties
  where id = p_warranty_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'WARRANTY_NOT_FOUND: Warranty % not found', p_warranty_id;
  end if;

  select * into v_a from assets.assets where id = v_w.asset_id;

  v_snapshot := jsonb_build_object(
    'warranty_id', v_w.id,
    'starts_on', v_w.starts_on,
    'ends_on', v_w.ends_on,
    'vendor_id', v_w.vendor_id,
    'asset_code', v_a.asset_code,
    'asset_name', v_a.name
  );

  insert into assets.asset_warranty_claims (
    tenant_id, warranty_id, asset_id, claim_reference, claim_date,
    description, warranty_snapshot, document_id, created_by
  ) values (
    v_caller.tenant_id, p_warranty_id, v_w.asset_id, trim(p_claim_reference), p_claim_date,
    p_description, v_snapshot, p_document_id, auth.uid()
  ) returning id into v_claim_id;

  return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$function$;$r7_early_3$;
    execute $r7_early_4$CREATE OR REPLACE FUNCTION assets.end_asset_downtime_internal_v1(p_context_id uuid, p_downtime_id uuid, p_ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_restored_operational_status text DEFAULT 'operational'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_dt record;
  v_end timestamptz := coalesce(p_ended_at, statement_timestamp());
  v_duration integer;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Atomic select for update ensuring exactly one winner
  select * into v_dt from assets.asset_downtimes
  where id = p_downtime_id and tenant_id = v_caller.tenant_id and ended_at is null
  for update;

  if not found then
    raise exception 'DOWNTIME_NOT_ACTIVE: Active downtime session % not found', p_downtime_id;
  end if;

  if v_end <= v_dt.started_at then
    raise exception 'INVALID_END_TIME: Downtime end time must be strictly after started_at';
  end if;

  v_duration := greatest(0, floor(extract(epoch from (v_end - v_dt.started_at)) / 60)::integer);

  update assets.asset_downtimes set
    ended_at = v_end,
    duration_minutes = v_duration
  where id = p_downtime_id;

  -- Restore operational status
  update assets.assets set
    operational_status = p_restored_operational_status,
    updated_at = statement_timestamp()
  where id = v_dt.asset_id;

  return jsonb_build_object('success', true, 'downtime_id', p_downtime_id, 'duration_minutes', v_duration);
end;
$function$;$r7_early_4$;
    execute $r7_early_5$CREATE OR REPLACE FUNCTION assets.enforce_asset_domain_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_prop portfolio.properties;
  v_bldg portfolio.buildings;
  v_unit portfolio.units;
  v_meter utilities.meters;
  v_ap security_access.access_points;
  v_vendor maintenance.vendors;
  v_contract maintenance.vendor_contracts;
  v_doc documents.documents;
begin
  -- Block hard delete across all asset tables
  if tg_op = 'DELETE' then
    raise exception 'asset_hard_delete_prohibited: physical deletion is strictly forbidden';
  end if;

  if tg_table_name = 'assets' then
    -- Validate building scope
    if new.building_id is not null then
      select * into v_bldg from portfolio.buildings where id = new.building_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_building_scope_invalid: building not found in property'; end if;
    end if;

    -- Validate unit scope
    if new.unit_id is not null then
      select * into v_unit from portfolio.units where id = new.unit_id and tenant_id = new.tenant_id;
      if not found then raise exception 'asset_unit_scope_invalid: unit not found in tenant'; end if;
      if new.building_id is not null and v_unit.building_id <> new.building_id then
        raise exception 'asset_unit_scope_invalid: unit does not belong to building';
      end if;
    end if;

    -- Validate meter_id
    if new.meter_id is not null then
      select * into v_meter from utilities.meters where id = new.meter_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_meter_scope_invalid: meter not found in property'; end if;
    end if;

    -- Validate access_point_id
    if new.access_point_id is not null then
      select * into v_ap from security_access.access_points where id = new.access_point_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_access_point_scope_invalid: access point not found in property'; end if;
    end if;

    -- Validate vendor_id
    if new.vendor_id is not null then
      select * into v_vendor from maintenance.vendors where id = new.vendor_id and tenant_id = new.tenant_id;
      if not found then raise exception 'asset_vendor_scope_invalid: vendor not found in tenant'; end if;
    end if;

    -- Validate service_contract_id
    if new.service_contract_id is not null then
      select * into v_contract from maintenance.vendor_contracts where id = new.service_contract_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_contract_scope_invalid: service contract not found in property'; end if;
      if new.vendor_id is not null and v_contract.vendor_id <> new.vendor_id then
        raise exception 'asset_contract_scope_invalid: contract vendor mismatch';
      end if;
    end if;

    -- Prevent direct decommissioning transition from regular updates
    if tg_op = 'UPDATE' and new.lifecycle_status in ('decommissioned','decommission_pending') and old.lifecycle_status not in ('decommissioned','decommission_pending') then
      if coalesce(current_setting('cladora.decommission_authorized', true), '') <> 'true' then
        raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
      end if;
    end if;

    -- Immutability of decommissioned/disposed assets
    if tg_op = 'UPDATE' and old.lifecycle_status in ('decommissioned','disposed') and (new.lifecycle_status = old.lifecycle_status or new.status = old.status) and new is distinct from old then
      if coalesce(current_setting('cladora.decommission_authorized', true), '') <> 'true' then
        raise exception 'decommissioned_asset_is_immutable: decommissioned assets cannot be modified';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'asset_inspections' then
    -- Immutability of verified inspections
    if tg_op = 'UPDATE' and old.is_verified = true and new is distinct from old then
      raise exception 'verified_inspection_is_immutable: verified inspections cannot be modified; record a new inspection event';
    end if;

    -- Validate document evidence if attached
    if new.document_id is not null then
      select * into v_doc from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
      if not found then raise exception 'document_not_found'; end if;
      if not exists (
        select 1 from documents.document_versions dv
        where dv.document_id = v_doc.id and dv.version = coalesce(v_doc.current_version, 1) and dv.scanning_status = 'clean'
      ) or v_doc.status <> 'active' or v_doc.disposition_status in ('disposition_pending_execution', 'disposition_approved', 'disposed') then
        raise exception 'document_not_authoritative_evidence: unscanned, quarantined or deferred documents cannot be used as inspection evidence';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'asset_warranty_claims' then
    -- Immutability of resolved claims
    if tg_op = 'UPDATE' and old.resolution_status in ('accepted','rejected','resolved') and new is distinct from old then
      raise exception 'resolved_claim_is_immutable: finalized warranty claims cannot be modified';
    end if;

    return new;
  end if;

  return new;
end;
$function$;$r7_early_5$;
    execute $r7_early_6$CREATE OR REPLACE FUNCTION assets.get_asset_detail_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_asset record;
  v_warranty record;
  v_active_downtime record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  select * into v_active_downtime from assets.asset_downtimes
  where asset_id = p_asset_id and ended_at is null
  order by started_at desc limit 1;

  if v_is_restricted then
    return jsonb_build_object(
      'id', v_asset.id,
      'asset_code', v_asset.asset_code,
      'name', v_asset.name,
      'category_id', v_asset.category_id,
      'property_id', v_asset.property_id,
      'building_id', v_asset.building_id,
      'unit_id', v_asset.unit_id,
      'scope', v_asset.scope,
      'location_description', v_asset.location_description,
      'lifecycle_status', v_asset.lifecycle_status,
      'operational_status', v_asset.operational_status,
      'condition', v_asset.condition,
      'criticality_level', v_asset.criticality_level,
      'is_safety_critical', v_asset.is_safety_critical,
      'installed_on', v_asset.installed_on,
      'commissioned_at', v_asset.commissioned_at,
      'is_in_downtime', (v_active_downtime.id is not null)
    );
  end if;

  select * into v_warranty from assets.asset_warranties
  where asset_id = p_asset_id order by ends_on desc limit 1;

  return jsonb_build_object(
    'id', v_asset.id,
    'asset_code', v_asset.asset_code,
    'name', v_asset.name,
    'description', v_asset.description,
    'category_id', v_asset.category_id,
    'property_id', v_asset.property_id,
    'building_id', v_asset.building_id,
    'unit_id', v_asset.unit_id,
    'scope', v_asset.scope,
    'manufacturer', v_asset.manufacturer,
    'model', v_asset.model,
    'serial_fingerprint', v_asset.serial_fingerprint,
    'manufacture_year', v_asset.manufacture_year,
    'installed_on', v_asset.installed_on,
    'commissioned_at', v_asset.commissioned_at,
    'location_description', v_asset.location_description,
    'ownership_type', v_asset.ownership_type,
    'lifecycle_status', v_asset.lifecycle_status,
    'operational_status', v_asset.operational_status,
    'condition', v_asset.condition,
    'criticality_level', v_asset.criticality_level,
    'criticality', v_asset.criticality,
    'is_safety_critical', v_asset.is_safety_critical,
    'replacement_cost', v_asset.replacement_cost,
    'currency', v_asset.currency,
    'meter_id', v_asset.meter_id,
    'access_point_id', v_asset.access_point_id,
    'vendor_id', v_asset.vendor_id,
    'service_contract_id', v_asset.service_contract_id,
    'service_frequency_months', v_asset.service_frequency_months,
    'last_service_date', v_asset.last_service_date,
    'next_service_date', v_asset.next_service_date,
    'warranty', case when v_warranty.id is not null then jsonb_build_object(
      'id', v_warranty.id,
      'status', v_warranty.status,
      'starts_on', v_warranty.starts_on,
      'ends_on', v_warranty.ends_on,
      'vendor_id', v_warranty.vendor_id,
      'coverage_json', v_warranty.coverage_json,
      'document_id', v_warranty.document_id
    ) else null end,
    'active_downtime', case when v_active_downtime.id is not null then jsonb_build_object(
      'id', v_active_downtime.id,
      'started_at', v_active_downtime.started_at,
      'reason', v_active_downtime.reason,
      'is_planned', v_active_downtime.is_planned
    ) else null end,
    'created_at', v_asset.created_at,
    'updated_at', v_asset.updated_at
  );
end;
$function$;$r7_early_6$;
    execute $r7_early_7$CREATE OR REPLACE FUNCTION assets.get_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty terms restricted';
  end if;

  select * into v_w from assets.asset_warranties
  where asset_id = p_asset_id and tenant_id = v_caller.tenant_id
  order by ends_on desc limit 1;

  if not found then
    return jsonb_build_object('warranty', null);
  end if;

  return jsonb_build_object(
    'warranty', jsonb_build_object(
      'id', v_w.id,
      'status', case when v_w.ends_on < current_date and v_w.status = 'active' then 'expired' else v_w.status end,
      'starts_on', v_w.starts_on,
      'ends_on', v_w.ends_on,
      'vendor_id', v_w.vendor_id,
      'coverage_json', v_w.coverage_json,
      'warranty_terms', v_w.warranty_terms,
      'document_id', v_w.document_id,
      'created_at', v_w.created_at
    )
  );
end;
$function$;$r7_early_7$;
    execute $r7_early_8$CREATE OR REPLACE FUNCTION assets.list_asset_inspections_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'inspection_type', i.inspection_type,
      'scheduled_date', i.scheduled_date,
      'performed_at', i.performed_at,
      'result', i.result,
      'inspector_name', i.inspector_name,
      'observations', i.observations,
      'corrective_action_required', i.corrective_action_required,
      'next_due_date', i.next_due_date,
      'is_verified', i.is_verified,
      'verified_at', i.verified_at,
      'document_id', i.document_id,
      'policy_id', i.policy_id
    ) order by i.scheduled_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_inspections i
  where i.asset_id = p_asset_id and i.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;$r7_early_8$;
    execute $r7_early_9$CREATE OR REPLACE FUNCTION assets.list_assets_internal_v1(p_context_id uuid, p_property_id uuid DEFAULT NULL::uuid, p_building_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_lifecycle_status text DEFAULT NULL::text, p_operational_status text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_criticality_level text DEFAULT NULL::text, p_is_safety_critical boolean DEFAULT NULL::boolean, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_total bigint;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select count(*) into v_total
  from assets.assets a
  where a.tenant_id = v_caller.tenant_id
    and (p_property_id is null or a.property_id = p_property_id)
    and (p_building_id is null or a.building_id = p_building_id)
    and (p_category_id is null or a.category_id = p_category_id)
    and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
    and (p_operational_status is null or a.operational_status = p_operational_status)
    and (p_condition is null or a.condition::text = p_condition)
    and (p_criticality_level is null or a.criticality_level = p_criticality_level)
    and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
    and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%');

  if v_is_restricted then
    -- Projected allowlist for owner / resident (excludes confidential commercial, serial, cost, vendor data)
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'location_description', a.location_description,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'is_safety_critical', a.is_safety_critical,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'created_at', a.created_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  else
    -- Full administrative projection
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'description', a.description,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'manufacturer', a.manufacturer,
        'model', a.model,
        'serial_fingerprint', a.serial_fingerprint,
        'manufacture_year', a.manufacture_year,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'location_description', a.location_description,
        'ownership_type', a.ownership_type,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'criticality', a.criticality,
        'is_safety_critical', a.is_safety_critical,
        'replacement_cost', a.replacement_cost,
        'currency', a.currency,
        'meter_id', a.meter_id,
        'access_point_id', a.access_point_id,
        'vendor_id', a.vendor_id,
        'service_contract_id', a.service_contract_id,
        'service_frequency_months', a.service_frequency_months,
        'last_service_date', a.last_service_date,
        'next_service_date', a.next_service_date,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'limit', coalesce(p_limit, 25),
    'offset', coalesce(p_offset, 0),
    'items', v_items
  );
end;
$function$;$r7_early_9$;
    execute $r7_early_10$CREATE OR REPLACE FUNCTION assets.list_compliance_policies_internal_v1(p_context_id uuid, p_category_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'policy_code', p.policy_code,
      'category_code', p.category_code,
      'property_id', p.property_id,
      'jurisdiction', p.jurisdiction,
      'interval_months', p.interval_months,
      'is_safety_mandatory', p.is_safety_mandatory,
      'legal_source_reference', p.legal_source_reference,
      'approval_status', p.approval_status,
      'effective_from', p.effective_from,
      'effective_to', p.effective_to,
      'version', p.version
    ) order by p.created_at desc
  ), '[]'::jsonb) into v_items
  from assets.compliance_policies p
  where p.tenant_id = v_caller.tenant_id
    and (p_category_code is null or p.category_code = p_category_code);

  return jsonb_build_object('items', v_items);
end;
$function$;$r7_early_10$;
    execute $r7_early_11$CREATE OR REPLACE FUNCTION assets.list_warranty_claims_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty claims restricted';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'claim_reference', c.claim_reference,
      'claim_date', c.claim_date,
      'description', c.description,
      'resolution_status', c.resolution_status,
      'resolution_notes', c.resolution_notes,
      'document_id', c.document_id,
      'created_at', c.created_at
    ) order by c.claim_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_warranty_claims c
  where c.asset_id = p_asset_id and c.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;$r7_early_11$;
    execute $r7_early_12$CREATE OR REPLACE FUNCTION assets.record_asset_inspection_internal_v1(p_context_id uuid, p_asset_id uuid, p_inspection_type text, p_scheduled_date date, p_performed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_result text DEFAULT 'pending'::text, p_inspector_name text DEFAULT NULL::text, p_inspector_vendor_id uuid DEFAULT NULL::uuid, p_observations text DEFAULT NULL::text, p_corrective_action_required text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid, p_policy_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_policy record;
  v_snapshot jsonb := null;
  v_next_due date := null;
  v_insp_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if p_policy_id is not null then
    select * into v_policy from assets.compliance_policies
    where id = p_policy_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'compliance_policy_unconfigured: Compliance policy % not found or inactive', p_policy_id;
    end if;

    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  elsif p_inspection_type in ('statutory_compliance', 'statutory', 'mandatory_safety', 'annual_safety') then
    select cp.* into v_policy from assets.compliance_policies cp
    join assets.asset_categories ac on ac.id = v_asset.category_id
    where cp.tenant_id = v_caller.tenant_id
      and cp.category_code = ac.code
      and cp.approval_status = 'APPROVED'
      and (cp.property_id is null or cp.property_id = v_asset.property_id)
      and (cp.effective_to is null or cp.effective_to >= current_date)
      and cp.effective_from <= current_date
    order by (cp.property_id is not null) desc, cp.version desc
    limit 1;

    if not found then
      raise exception 'compliance_policy_unconfigured: No active statutory compliance policy configured for asset category';
    end if;

    p_policy_id := v_policy.id;
    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  end if;

  insert into assets.asset_inspections (
    tenant_id, asset_id, policy_id, policy_version_snapshot, inspection_type,
    scheduled_date, performed_at, result, inspector_name, inspector_vendor_id,
    observations, corrective_action_required, next_due_date, document_id, created_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_policy_id, v_snapshot, p_inspection_type,
    p_scheduled_date, p_performed_at, p_result, p_inspector_name, p_inspector_vendor_id,
    p_observations, p_corrective_action_required, v_next_due, p_document_id, auth.uid()
  ) returning id into v_insp_id;

  -- If inspection failed and asset is safety critical, degrade operational status
  if p_result = 'failed' and v_asset.is_safety_critical then
    update assets.assets set
      operational_status = 'degraded',
      updated_at = statement_timestamp()
    where id = p_asset_id;
  end if;

  return jsonb_build_object('success', true, 'inspection_id', v_insp_id, 'next_due_date', v_next_due);
end;
$function$;$r7_early_12$;
    execute $r7_early_13$CREATE OR REPLACE FUNCTION assets.request_asset_decommission_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_replacement_asset_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_req_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % not found in tenant', p_asset_id;
  end if;

  if v_asset.lifecycle_status in ('decommissioned', 'disposed') then
    raise exception 'ASSET_ALREADY_DECOMMISSIONED: Cannot request decommission for already decommissioned asset';
  end if;

  if p_replacement_asset_id is not null then
    perform 1 from assets.assets
    where id = p_replacement_asset_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'REPLACEMENT_ASSET_NOT_FOUND: Replacement asset not found in same tenant';
    end if;
  end if;

  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, replacement_asset_id, status, reason, requested_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_replacement_asset_id, 'pending', p_reason, auth.uid()
  ) returning id into v_req_id;

  -- Set session authorization flag for decommission transition
  perform set_config('cladora.decommission_authorized', 'true', true);

  update assets.assets set
    lifecycle_status = 'decommission_pending',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'request_id', v_req_id);
end;
$function$;$r7_early_13$;
    execute $r7_early_14$CREATE OR REPLACE FUNCTION assets.resolve_warranty_claim_internal_v1(p_context_id uuid, p_claim_id uuid, p_resolution_status text, p_resolution_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_claim record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_resolution_status not in ('in_review','accepted','rejected','resolved') then
    raise exception 'INVALID_STATUS: Resolution status % not allowed', p_resolution_status;
  end if;

  select * into v_claim from assets.asset_warranty_claims
  where id = p_claim_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND: Claim % not found', p_claim_id;
  end if;

  update assets.asset_warranty_claims set
    resolution_status = p_resolution_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    updated_at = statement_timestamp()
  where id = p_claim_id;

  return jsonb_build_object('success', true, 'claim_id', p_claim_id, 'resolution_status', p_resolution_status);
end;
$function$;$r7_early_14$;
    execute $r7_early_15$CREATE OR REPLACE FUNCTION assets.start_asset_downtime_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_is_planned boolean DEFAULT false, p_work_order_id uuid DEFAULT NULL::uuid, p_ticket_id uuid DEFAULT NULL::uuid, p_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_downtime_id uuid;
  v_start timestamptz := coalesce(p_started_at, statement_timestamp());
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Row lock asset
  perform 1 from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, reason, is_planned,
    work_order_id, ticket_id, recorded_by
  ) values (
    v_caller.tenant_id, p_asset_id, v_start, p_reason, p_is_planned,
    p_work_order_id, p_ticket_id, auth.uid()
  ) returning id into v_downtime_id;

  -- Automatically update operational status to unavailable
  update assets.assets set
    operational_status = 'unavailable',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'downtime_id', v_downtime_id, 'asset_id', p_asset_id);
end;
$function$;$r7_early_15$;
    execute $r7_early_16$CREATE OR REPLACE FUNCTION assets.transition_asset_lifecycle_internal_v1(p_context_id uuid, p_asset_id uuid, p_target_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_target_status in ('decommissioned', 'decommission_pending') then
    raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  -- Commissioning requires AAL2 and verification
  if p_target_status = 'commissioned' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);
  end if;

  if v_asset.is_safety_critical and p_target_status in ('commissioned','out_of_service') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    lifecycle_status = p_target_status,
    commissioned_at = case when p_target_status = 'commissioned' and commissioned_at is null then statement_timestamp() else commissioned_at end,
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'lifecycle_transition', auth.uid(), p_reason,
    jsonb_build_object('lifecycle_status', v_asset.lifecycle_status),
    jsonb_build_object('lifecycle_status', p_target_status),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'lifecycle_status', p_target_status);
end;
$function$;$r7_early_16$;
    execute $r7_early_17$CREATE OR REPLACE FUNCTION assets.update_asset_internal_v1(p_context_id uuid, p_asset_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_location_description text DEFAULT NULL::text, p_meter_id uuid DEFAULT NULL::uuid, p_access_point_id uuid DEFAULT NULL::uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_service_contract_id uuid DEFAULT NULL::uuid, p_service_frequency_months integer DEFAULT NULL::integer, p_replacement_cost numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical or v_asset.criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    name = coalesce(trim(p_name), name),
    description = coalesce(p_description, description),
    location_description = coalesce(p_location_description, location_description),
    meter_id = coalesce(p_meter_id, meter_id),
    access_point_id = coalesce(p_access_point_id, access_point_id),
    vendor_id = coalesce(p_vendor_id, vendor_id),
    service_contract_id = coalesce(p_service_contract_id, service_contract_id),
    service_frequency_months = coalesce(p_service_frequency_months, service_frequency_months),
    replacement_cost = coalesce(p_replacement_cost, replacement_cost),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'asset_id', p_asset_id);
end;
$function$;$r7_early_17$;
    execute $r7_early_18$CREATE OR REPLACE FUNCTION assets.update_asset_operational_status_internal_v1(p_context_id uuid, p_asset_id uuid, p_operational_status text, p_condition text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical and p_operational_status in ('unavailable', 'isolated') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    operational_status = p_operational_status,
    condition = coalesce(p_condition::assets.asset_condition, condition),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'operational_status_change', auth.uid(), p_reason,
    jsonb_build_object('operational_status', v_asset.operational_status, 'condition', v_asset.condition),
    jsonb_build_object('operational_status', p_operational_status, 'condition', coalesce(p_condition, v_asset.condition::text)),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'operational_status', p_operational_status);
end;
$function$;$r7_early_18$;
    execute $r7_early_19$CREATE OR REPLACE FUNCTION assets.upsert_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid, p_starts_on date, p_ends_on date, p_vendor_id uuid DEFAULT NULL::uuid, p_coverage_json jsonb DEFAULT '{}'::jsonb, p_warranty_terms text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_w_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_ends_on < p_starts_on then
    raise exception 'INVALID_WARRANTY_DATES: Warranty ends_on must be on or after starts_on';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_warranties (
    tenant_id, asset_id, starts_on, ends_on, vendor_id,
    coverage_json, warranty_terms, document_id
  ) values (
    v_caller.tenant_id, p_asset_id, p_starts_on, p_ends_on, p_vendor_id,
    coalesce(p_coverage_json, '{}'::jsonb), p_warranty_terms, p_document_id
  ) returning id into v_w_id;

  return jsonb_build_object('success', true, 'warranty_id', v_w_id);
end;
$function$;$r7_early_19$;
    execute $r7_early_20$CREATE OR REPLACE FUNCTION assets.verify_asset_inspection_internal_v1(p_context_id uuid, p_inspection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_insp record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.inspections.verify', true);

  select * into v_insp from assets.asset_inspections
  where id = p_inspection_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'INSPECTION_NOT_FOUND: Inspection % not found', p_inspection_id;
  end if;

  if v_insp.is_verified then
    raise exception 'ALREADY_VERIFIED: Inspection has already been certified';
  end if;

  update assets.asset_inspections set
    is_verified = true,
    verified_by = auth.uid(),
    verified_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_inspection_id;

  return jsonb_build_object('success', true, 'inspection_id', p_inspection_id, 'verified_at', statement_timestamp());
end;
$function$;$r7_early_20$;
    execute $r7_early_21$CREATE OR REPLACE FUNCTION audit.get_customer_events(p_context_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_query text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'audit', 'identity', 'platform', 'portfolio', 'maintenance', 'billing', 'governance', 'utilities', 'security_access', 'app_private'
AS $function$
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
$function$;$r7_early_21$;
    execute $r7_early_22$CREATE OR REPLACE FUNCTION customer_api.configure_payment_allocation_policy_v1(p_context_id uuid, p_strategy payments.payment_allocation_strategy DEFAULT 'oldest_due_first'::payments.payment_allocation_strategy, p_penalties_priority payments.penalties_priority DEFAULT 'principal_first'::payments.penalties_priority, p_min_partial_amount numeric DEFAULT 1.00, p_overpayment_handling text DEFAULT 'credit_balance'::text, p_credit_balance_handling text DEFAULT 'apply_to_next'::text, p_approval_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_version integer;
  v_policy payments.payment_allocation_policies;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  if p_min_partial_amount is null or p_min_partial_amount <= 0 then
    raise exception 'invalid_min_partial_amount' using errcode = '22023';
  end if;

  -- Close existing active policies
  update payments.payment_allocation_policies
  set effective_to = statement_timestamp()
  where tenant_id = v.tenant_id
    and (effective_to is null or effective_to > statement_timestamp());

  select coalesce(max(version), 0) + 1 into v_version
  from payments.payment_allocation_policies
  where tenant_id = v.tenant_id;

  insert into payments.payment_allocation_policies (
    tenant_id,
    version,
    strategy,
    penalties_priority,
    min_partial_amount,
    overpayment_handling,
    credit_balance_handling,
    effective_from,
    approved_by,
    approval_reference,
    legal_review_status
  ) values (
    v.tenant_id,
    v_version,
    p_strategy,
    p_penalties_priority,
    p_min_partial_amount,
    coalesce(p_overpayment_handling, 'credit_balance'),
    coalesce(p_credit_balance_handling, 'apply_to_next'),
    statement_timestamp(),
    auth.uid(),
    coalesce(p_approval_reference, 'AG-DECISION-' || to_char(current_date, 'YYYYMMDD')),
    'approved'
  ) returning * into v_policy;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'POLICY_CONFIGURED', 'payments.payment_allocation_policy', v_policy.id,
    row_to_json(v_policy)::jsonb,
    statement_timestamp()
  );

  return jsonb_build_object(
    'payment_allocation_policy', row_to_json(v_policy)::jsonb
  );
end;
$function$;$r7_early_22$;
    execute $r7_early_23$CREATE OR REPLACE FUNCTION customer_api.reject_beneficiary_account_v1(p_context_id uuid, p_beneficiary_id uuid, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'pending_approval' then
    raise exception 'beneficiary_not_pending_approval' using errcode = '22023';
  end if;

  if v_draft.created_by = auth.uid() then
    raise exception 'dual_control_violation_creator_cannot_reject' using errcode = '42501';
  end if;

  update payments.beneficiary_accounts
  set status = 'rejected',
      rejected_at = statement_timestamp(),
      rejected_by = auth.uid(),
      rejection_reason = coalesce(p_rejection_reason, 'Rejected by authorized manager')
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_REJECTED', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object('id', v_draft.id, 'status', v_draft.status, 'rejection_reason', v_draft.rejection_reason),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'status', v_draft.status,
      'rejected_at', v_draft.rejected_at
    )
  );
end;
$function$;$r7_early_23$;
    execute $r7_early_24$CREATE OR REPLACE FUNCTION customer_api.revoke_beneficiary_account_v1(p_context_id uuid, p_beneficiary_id uuid, p_revocation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_acc payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_acc
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_acc.status <> 'active' then
    raise exception 'beneficiary_not_active' using errcode = '22023';
  end if;

  update payments.beneficiary_accounts
  set status = 'revoked',
      revoked_at = statement_timestamp(),
      revoked_by = auth.uid(),
      revocation_reason = coalesce(p_revocation_reason, 'Revoked by authorized manager')
  where id = v_acc.id
  returning * into v_acc;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_REVOKED', 'payments.beneficiary_account', v_acc.id,
    jsonb_build_object('id', v_acc.id, 'status', v_acc.status, 'revocation_reason', v_acc.revocation_reason),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_acc.id,
      'status', v_acc.status,
      'revoked_at', v_acc.revoked_at
    )
  );
end;
$function$;$r7_early_24$;
    execute $r7_early_25$CREATE OR REPLACE FUNCTION customer_api.submit_beneficiary_account_for_approval_v1(p_context_id uuid, p_beneficiary_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'platform', 'identity', 'audit'
AS $function$
declare
  v record;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'draft' then
    raise exception 'beneficiary_not_in_draft_status' using errcode = '22023';
  end if;

  update payments.beneficiary_accounts
  set status = 'pending_approval',
      submitted_at = statement_timestamp(),
      submitted_by = auth.uid()
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_SUBMITTED_FOR_APPROVAL', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'submitted_at', v_draft.submitted_at
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'submitted_at', v_draft.submitted_at
    )
  );
end;
$function$;$r7_early_25$;
    execute $r7_early_26$CREATE OR REPLACE FUNCTION documents.enforce_customer_document_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'documents', 'platform', 'portfolio', 'finance', 'billing', 'payments', 'maintenance', 'governance', 'communications', 'utilities', 'assets', 'audit'
AS $function$
declare
  d documents.documents;
  target_tenant uuid;
begin
  if tg_table_name = 'document_retention_assignments' then
    if tg_op = 'DELETE' then
      raise exception 'retention_assignment_is_immutable' using errcode = '22000';
    end if;
    if tg_op = 'UPDATE' and (old.policy_snapshot is distinct from new.policy_snapshot or old.policy_version is distinct from new.policy_version or old.document_id is distinct from new.document_id) then
      raise exception 'historical_retention_snapshot_immutable' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'document_audit_links' then
    if tg_op <> 'INSERT' then
      raise exception 'document_audit_link_is_immutable' using errcode = '22000';
    end if;
    select * into d from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
    select tenant_id into target_tenant from audit.events where id = new.audit_event_id;
    if d.id is null or target_tenant is null or target_tenant <> new.tenant_id then
      raise exception 'document_link_cross_tenant_or_missing' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'document_links' then
    if tg_op <> 'INSERT' then
      raise exception 'document_link_is_immutable' using errcode = '22000';
    end if;
    select * into d from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
    if d.id is null then
      raise exception 'document_link_document_invalid' using errcode = '22000';
    end if;

    -- Canonical Cross-Module Resolver & Existence Check
    if new.entity_type = 'platform.tenant' then
      select id into target_tenant from platform.tenants where id = new.entity_id;
    elsif new.entity_type = 'portfolio.property' then
      select tenant_id into target_tenant from portfolio.properties where id = new.entity_id;
    elsif new.entity_type = 'portfolio.building' then
      select tenant_id into target_tenant from portfolio.buildings where id = new.entity_id;
    elsif new.entity_type = 'portfolio.unit' then
      select tenant_id into target_tenant from portfolio.units where id = new.entity_id;
    elsif new.entity_type = 'platform.contract' then
      select w.tenant_id into target_tenant
      from platform.workspace_contracts c
      join platform.customer_workspaces w on w.id = c.customer_workspace_id
      where c.id = new.entity_id;
    elsif new.entity_type = 'billing.invoice' then
      select tenant_id into target_tenant from billing.invoices where id = new.entity_id;
    elsif new.entity_type = 'payments.payment' then
      select tenant_id into target_tenant from payments.payments where id = new.entity_id;
    elsif new.entity_type = 'finance.journal' then
      select tenant_id into target_tenant from finance.journals where id = new.entity_id;
    elsif new.entity_type = 'maintenance.work_order' then
      select tenant_id into target_tenant from maintenance.work_orders where id = new.entity_id;
    elsif new.entity_type = 'maintenance.purchase_order' then
      select tenant_id into target_tenant from maintenance.purchase_orders where id = new.entity_id;
    elsif new.entity_type = 'maintenance.rfq' then
      select tenant_id into target_tenant from maintenance.rfqs where id = new.entity_id;
    elsif new.entity_type = 'maintenance.vendor_quote' then
      select tenant_id into target_tenant from maintenance.vendor_quotes where id = new.entity_id;
    elsif new.entity_type = 'maintenance.ticket' then
      select tenant_id into target_tenant from maintenance.tickets where id = new.entity_id;
    elsif new.entity_type = 'governance.meeting' then
      select tenant_id into target_tenant from governance.meetings where id = new.entity_id;
    elsif new.entity_type = 'governance.resolution' then
      select tenant_id into target_tenant from governance.resolutions where id = new.entity_id;
    elsif new.entity_type = 'governance.minute' then
      select tenant_id into target_tenant from governance.minutes where id = new.entity_id;
    elsif new.entity_type = 'communications.post' then
      select tenant_id into target_tenant from communications.posts where id = new.entity_id;
    elsif new.entity_type = 'communications.official_notice' then
      select tenant_id into target_tenant from communications.official_notices where id = new.entity_id;
    elsif new.entity_type = 'communications.statutory_evidence' then
      select tenant_id into target_tenant from communications.statutory_evidence where id = new.entity_id;
    elsif new.entity_type = 'utilities.meter' then
      select tenant_id into target_tenant from utilities.meters where id = new.entity_id;
    elsif new.entity_type = 'utilities.meter_reading' then
      select tenant_id into target_tenant from utilities.meter_readings where id = new.entity_id;
    elsif new.entity_type = 'utilities.ocr_candidate' then
      select tenant_id into target_tenant from utilities.ocr_field_candidates where id = new.entity_id;
    elsif new.entity_type = 'utilities.consumption_period' then
      select tenant_id into target_tenant from utilities.consumption_periods where id = new.entity_id;
    elsif new.entity_type = 'assets.asset' then
      select tenant_id into target_tenant from assets.assets where id = new.entity_id;
    elsif new.entity_type = 'assets.inspection' then
      select tenant_id into target_tenant from assets.asset_inspections where id = new.entity_id;
    elsif new.entity_type = 'assets.warranty' then
      select tenant_id into target_tenant from assets.asset_warranties where id = new.entity_id;
    else
      raise exception 'document_link_type_invalid' using errcode = '22000';
    end if;

    if target_tenant is null or target_tenant <> new.tenant_id then
      raise exception 'document_link_cross_tenant_or_missing' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'documents' then
    if tg_op = 'DELETE' then
      if old.legal_hold or exists(select 1 from documents.legal_holds h where h.document_id = old.id and h.status = 'active') then
        raise exception 'document_under_legal_hold' using errcode = '22000';
      end if;
      if old.is_evidence and old.evidence_status = 'verified' then
        raise exception 'verified_evidence_cannot_be_deleted' using errcode = '22000';
      end if;
    end if;

    if tg_op = 'UPDATE' then
      if old.legal_hold and (new.title, new.document_type, new.category, new.deleted_at) is distinct from (old.title, old.document_type, old.category, old.deleted_at) then
        raise exception 'document_under_legal_hold' using errcode = '22000';
      end if;
      if old.evidence_status = 'verified' and (new.is_evidence, new.evidence_status, new.evidence_type, new.verified_by, new.verified_at) is distinct from (old.is_evidence, old.evidence_status, old.evidence_type, old.verified_by, old.verified_at) then
        raise exception 'verified_evidence_is_immutable' using errcode = '22000';
      end if;
      if old.published_at is not null and (new.current_version, new.title, new.document_type, new.effective_on, new.retention_snapshot) is distinct from (old.current_version, old.title, old.document_type, old.effective_on, old.retention_snapshot) then
        raise exception 'published_document_is_immutable' using errcode = '22000';
      end if;
      if new.classification < old.classification then
        raise exception 'classification_downgrade_forbidden' using errcode = '22000';
      end if;
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'legal_holds' then
    if tg_op = 'DELETE' then
      raise exception 'legal_hold_history_is_append_only' using errcode = '22000';
    end if;
    if tg_op = 'UPDATE' and old.status = 'released' and new is distinct from old then
      raise exception 'released_legal_hold_is_immutable' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'retention_records' then
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.finalized_at is not null and new is distinct from old) then
      raise exception 'final_retention_record_is_immutable' using errcode = '22000';
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'lifecycle_events' then
    if tg_op <> 'INSERT' then
      raise exception 'document_lifecycle_is_append_only' using errcode = '22000';
    end if;
    return new;
  end if;

  return new;
end;
$function$;$r7_early_26$;
    execute $r7_early_27$CREATE OR REPLACE FUNCTION governance.create_minutes_correction(p_context_id uuid, p_prior_minutes_id uuid, p_correction_reason text, p_content_json jsonb)
 RETURNS governance.minutes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'governance', 'audit', 'extensions'
AS $function$
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

  v_sha := encode(extensions.digest(p_content_json::text, 'sha256'), 'hex');

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
$function$;$r7_early_27$;
    execute $r7_early_28$CREATE OR REPLACE FUNCTION payments.assert_payments_module_entitled(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'platform'
AS $function$
declare
  v_workspace uuid;
begin
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = p_tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.payments'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'payments_entitlement_required' using errcode = '42501';
  end if;

  return true;
end;
$function$;$r7_early_28$;
    execute $r7_early_29$CREATE OR REPLACE FUNCTION payments.process_webhook_event_v1(p_tenant_id uuid DEFAULT NULL::uuid, p_provider_code text DEFAULT 'unconfigured'::text, p_provider_event_id text DEFAULT 'unknown'::text, p_event_type text DEFAULT 'unknown'::text, p_payload_hash text DEFAULT ''::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'payments', 'billing', 'finance', 'portfolio', 'audit'
AS $function$
declare
  v_intent_id uuid;
  v_intent payments.payment_intents;
  v_tenant_id uuid;
  v_receipt payments.webhook_receipts;
  v_beneficiary payments.beneficiary_accounts;
  v_bank_gl_id uuid;
  v_ar_gl_id uuid;
  v_clearing_gl_id uuid;
  v_settled_at timestamptz;
  v_amount numeric(20,4);
  v_currency text;
  v_journal_id uuid;
  v_journal_no bigint;
  v_payment_id uuid;
  v_settlement_id uuid;
  v_inv record;
  v_remaining numeric(20,4);
  v_alloc_amount numeric(20,4);
  v_total_allocated numeric(20,4) := 0;
  v_unallocated numeric(20,4) := 0;
  v_alloc_id uuid;
begin
  -- 5.1 Resolve Intent directly from payload reference without trusting header tenant
  v_intent_id := (p_payload->>'payment_intent_id')::uuid;
  if v_intent_id is null and (p_payload->>'client_reference') is not null then
    select id into v_intent_id from payments.payment_intents
    where client_reference = trim(p_payload->>'client_reference');
  end if;

  if v_intent_id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'missing_payment_intent_id');
  end if;

  -- 5.2 Row lock target Payment Intent
  select * into v_intent
  from payments.payment_intents
  where id = v_intent_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed', 'reason', 'intent_not_found');
  end if;

  v_tenant_id := v_intent.tenant_id;

  -- Enforce untrusted tenant isolation
  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'untrusted_tenant_boundary_violation' using errcode = '42501';
  end if;

  -- 5.3 Webhook Receipt Idempotency
  select * into v_receipt
  from payments.webhook_receipts
  where tenant_id = v_tenant_id
    and provider_code = p_provider_code
    and provider_event_id = p_provider_event_id;

  if found then
    return jsonb_build_object(
      'status', 'ignored',
      'reason', 'duplicate_event',
      'receipt_id', v_receipt.id
    );
  end if;

  insert into payments.webhook_receipts (
    tenant_id,
    provider_code,
    provider_event_id,
    event_type,
    payload_hash,
    raw_payload_sanitized,
    processing_status
  ) values (
    v_tenant_id,
    p_provider_code,
    p_provider_event_id,
    p_event_type,
    p_payload_hash,
    p_payload,
    'received'
  ) returning * into v_receipt;

  -- 5.4 Fail-closed Reversal & Chargeback boundary
  if p_event_type in ('payment.refunded', 'payment.chargeback', 'refund.created') then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'deferred', error_details = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'deferred', 'reason', 'DEFERRED-PAYMENT-REVERSAL-PROVIDER');
  end if;

  -- 5.5 Terminal state immutability for settlement events
  if v_intent.status in ('succeeded', 'settled', 'cancelled', 'expired') then
    update payments.webhook_receipts
    set processing_status = 'ignored', error_details = 'intent_already_terminal'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'ignored', 'reason', 'intent_already_terminal');
  end if;

  -- 5.6 Fail-closed check: verify associated beneficiary is NOT revoked
  select * into v_beneficiary
  from payments.beneficiary_accounts
  where id = (v_intent.beneficiary_snapshot->>'beneficiary_id')::uuid;

  if not found or v_beneficiary.status = 'revoked' then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'beneficiary_revoked',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'failed', error_details = 'beneficiary_revoked'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'requires_review', 'reason', 'beneficiary_revoked');
  end if;

  -- 5.7 Amount & currency validation
  v_amount := (p_payload->>'amount')::numeric(20,4);
  v_currency := coalesce(p_payload->>'currency', 'RON');

  if v_amount is null or v_amount <> v_intent.amount or v_currency <> v_intent.currency then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'amount_or_currency_mismatch',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'failed', error_details = 'amount_or_currency_mismatch'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'requires_review', 'reason', 'amount_or_currency_mismatch');
  end if;

  -- 5.8 Succeeded / Checkout Completed Event Handling
  if p_event_type in ('payment.succeeded', 'checkout.completed') then
    v_settled_at := statement_timestamp();

    -- Open accounting period assertion (reject closed period)
    perform finance.assert_scope_date_not_in_closed_period(v_tenant_id, v_intent.property_id, v_settled_at::date);

    -- Select Bank GL Account (5121)
    select id into v_bank_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
    order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_bank_gl_id is null then
      insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status)
      values (v_tenant_id, v_intent.property_id, '5121', 'Conturi la banci in lei', 'asset', coalesce(v_currency, 'RON'), 'active')
      on conflict do nothing;

      select id into v_bank_gl_id from finance.accounts
      where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
        and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
      order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;
    end if;

    if v_bank_gl_id is null then
      raise exception 'bank_gl_account_not_found' using errcode = '22023';
    end if;

    -- Select AR GL Account (4111)
    select id into v_ar_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '4111' or code like '411%') and status = 'active'
    order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_ar_gl_id is null then
      insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status)
      values (v_tenant_id, v_intent.property_id, '4111', 'Clienti / Proprietari cote intretinere', 'asset', coalesce(v_currency, 'RON'), 'active')
      on conflict do nothing;

      select id into v_ar_gl_id from finance.accounts
      where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
        and (code = '4111' or code like '411%') and status = 'active'
      order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;
    end if;

    if v_ar_gl_id is null then
      raise exception 'ar_gl_account_not_found' using errcode = '22023';
    end if;

    -- Select Clearing GL Account (419 Customer Advances)
    select id into v_clearing_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
    order by (case when code = '419' or code like '419%' then 0 else 1 end),
             (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_clearing_gl_id is null then
      insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status)
      values (v_tenant_id, v_intent.property_id, '419', 'Clienti - creditori (Avansuri incasate)', 'liability', coalesce(v_currency, 'RON'), 'active')
      on conflict do nothing;

      select id into v_clearing_gl_id from finance.accounts
      where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
        and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
      order by (case when code = '419' or code like '419%' then 0 else 1 end),
               (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;
    end if;

    if v_clearing_gl_id is null then
      raise exception 'clearing_gl_account_not_found' using errcode = '22023';
    end if;

    -- Compute invoice allocations (S = A + U)
    v_remaining := v_amount;
    v_total_allocated := 0;

    for v_inv in
      select inv.id as invoice_id, inv.invoice_no, r.id as receivable_id, r.outstanding_amount
      from billing.invoices inv
      join billing.receivables r on r.invoice_id = inv.id
      where inv.tenant_id = v_tenant_id
        and inv.unit_id = v_intent.unit_id
        and r.outstanding_amount > 0
        and inv.status <> 'void'
      order by inv.due_on asc, inv.invoice_no asc
      for update of r
    loop
      if v_remaining <= 0 then exit; end if;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      if v_alloc_amount > 0 then
        v_total_allocated := v_total_allocated + v_alloc_amount;
        v_remaining := v_remaining - v_alloc_amount;
      end if;
    end loop;

    v_unallocated := v_amount - v_total_allocated;

    -- 5.8.1 Atomic compound journal posting:
    -- Dr 5121 (Bank) = S
    -- Cr 4111 (AR) = A
    -- Cr 419  (Advances) = U
    -- Total Dr = Total Cr = S
    v_settlement_id := gen_random_uuid();
    v_journal_id := gen_random_uuid();

    insert into finance.journals (
      id, tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
    ) values (
      v_journal_id, v_tenant_id, v_intent.property_id, v_settled_at::date, v_currency,
      'Direct association payment settlement: ' || v_intent.client_reference,
      'payments.settlement', v_settlement_id, 'draft'
    ) returning journal_no into v_journal_no;

    -- Dr 5121 Bank for total settlement S
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v_tenant_id, v_journal_id, v_bank_gl_id, v_intent.unit_id, v_intent.payer_party_id,
      'debit', v_amount, 'Direct settlement bank receipt: ' || v_intent.client_reference
    );

    -- Cr 4111 Receivables for allocated amount A
    if v_total_allocated > 0 then
      insert into finance.journal_entries (
        tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
      ) values (
        v_tenant_id, v_journal_id, v_ar_gl_id, v_intent.unit_id, v_intent.debtor_party_id,
        'credit', v_total_allocated, 'Bill receivables cleared: ' || v_intent.client_reference
      );
    end if;

    -- Cr 419 Customer Advances for unallocated excess U
    if v_unallocated > 0 then
      insert into finance.journal_entries (
        tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
      ) values (
        v_tenant_id, v_journal_id, v_clearing_gl_id, v_intent.unit_id, v_intent.payer_party_id,
        'credit', v_unallocated, 'Unallocated advance clearing balance: ' || v_intent.client_reference
      );
    end if;

    -- Post the journal
    update finance.journals
    set status = 'posted',
        posted_at = statement_timestamp()
    where id = v_journal_id;

    -- 5.8.2 Insert canonical Payment record (status: settled)
    v_payment_id := gen_random_uuid();
    insert into payments.payments (
      id,
      tenant_id,
      property_id,
      unit_id,
      payer_party_id,
      amount,
      currency,
      paid_at,
      status,
      method,
      provider_ref,
      description,
      idempotency_key,
      journal_id,
      payment_intent_id,
      clearing_account_id
    ) values (
      v_payment_id,
      v_tenant_id,
      v_intent.property_id,
      v_intent.unit_id,
      v_intent.payer_party_id,
      v_amount,
      v_currency,
      v_settled_at,
      'settled',
      v_intent.payment_method,
      p_provider_event_id,
      'Settled Direct Checkout: ' || v_intent.client_reference,
      v_intent.idempotency_key,
      v_journal_id,
      v_intent.id,
      v_clearing_gl_id
    );

    -- 5.8.3 Insert Settlement Record (bound to payment_id and journal_id)
    insert into payments.settlements (
      id,
      tenant_id,
      payment_intent_id,
      beneficiary_account_id,
      settlement_reference,
      amount,
      currency,
      settled_at,
      payment_id,
      journal_id
    ) values (
      v_settlement_id,
      v_tenant_id,
      v_intent.id,
      v_beneficiary.id,
      coalesce(p_payload->>'settlement_reference', 'SETTLE-' || p_provider_event_id),
      v_amount,
      v_currency,
      v_settled_at,
      v_payment_id,
      v_journal_id
    );

    -- 5.8.4 Execute allocations and update receivables via canonical path
    v_remaining := v_amount;
    for v_inv in
      select inv.id as invoice_id, inv.invoice_no, r.id as receivable_id, r.outstanding_amount, r.paid_amount, r.original_amount, r.credited_amount
      from billing.invoices inv
      join billing.receivables r on r.invoice_id = inv.id
      where inv.tenant_id = v_tenant_id
        and inv.unit_id = v_intent.unit_id
        and r.outstanding_amount > 0
        and inv.status <> 'void'
      order by inv.due_on asc, inv.invoice_no asc
      for update of r
    loop
      if v_remaining <= 0 then exit; end if;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      if v_alloc_amount > 0 then
        insert into payments.payment_allocations (
          tenant_id,
          payment_id,
          receivable_id,
          amount,
          status,
          idempotency_key,
          journal_id
        ) values (
          v_tenant_id,
          v_payment_id,
          v_inv.receivable_id,
          v_alloc_amount,
          'active',
          'ALLOC-' || v_intent.idempotency_key || '-' || v_inv.receivable_id::text,
          v_journal_id
        ) returning id into v_alloc_id;

        update billing.receivables
        set paid_amount = paid_amount + v_alloc_amount,
            last_payment_at = statement_timestamp(),
            updated_at = statement_timestamp()
        where id = v_inv.receivable_id;

        update billing.invoices
        set status = case
          when (v_inv.original_amount - (v_inv.paid_amount + v_alloc_amount) - v_inv.credited_amount) <= 0 then 'paid'::billing.invoice_status
          else 'partially_paid'::billing.invoice_status
        end,
        updated_at = statement_timestamp()
        where id = v_inv.invoice_id;

        v_remaining := v_remaining - v_alloc_amount;
      end if;
    end loop;

    -- 5.8.5 Mark intent succeeded
    update payments.payment_intents
    set status = 'succeeded',
        settled_at = v_settled_at,
        updated_at = statement_timestamp()
    where id = v_intent.id;

    -- 5.8.6 Mark webhook receipt processed
    update payments.webhook_receipts
    set processing_status = 'processed',
        processed_at = statement_timestamp()
    where id = v_receipt.id;

    insert into audit.events (
      tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
    ) values (
      v_tenant_id, null, 'webhook_service', 'SETTLEMENT_PROCESSED_CANONICAL', 'payments.settlement', v_settlement_id,
      jsonb_build_object(
        'payment_intent_id', v_intent.id,
        'payment_id', v_payment_id,
        'journal_id', v_journal_id,
        'journal_no', v_journal_no,
        'amount', v_amount,
        'allocated_amount', v_total_allocated,
        'unallocated_amount', v_unallocated
      ),
      statement_timestamp()
    );

    return jsonb_build_object(
      'status', 'succeeded',
      'payment_intent_id', v_intent.id,
      'payment_id', v_payment_id,
      'journal_id', v_journal_id,
      'journal_no', v_journal_no,
      'settlement_amount', v_amount,
      'allocated_amount', v_total_allocated,
      'unallocated_amount', v_unallocated
    );
  end if;

  return jsonb_build_object('status', 'ignored', 'reason', 'unhandled_event_type');
end;
$function$;$r7_early_29$;
    execute $r7_early_30$CREATE OR REPLACE FUNCTION payments.resolve_unit_debtor_party_v1(p_tenant_id uuid, p_unit_id uuid, p_membership_key uuid DEFAULT NULL::uuid)
 RETURNS TABLE(property_id uuid, debtor_party_id uuid, payer_party_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'portfolio', 'billing', 'identity'
AS $function$
declare
  v_prop_id uuid;
  v_debtor uuid;
  v_payer uuid;
begin
  select b.property_id, coalesce(
    (select o.party_id from portfolio.ownerships o where o.tenant_id = p_tenant_id and o.unit_id = u.id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date) limit 1),
    (select inv.liable_party_id from billing.invoices inv where inv.tenant_id = p_tenant_id and inv.unit_id = u.id order by inv.period_end desc limit 1)
  ) into v_prop_id, v_debtor
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where u.id = p_unit_id and u.tenant_id = p_tenant_id;

  if p_membership_key is not null then
    select mp.party_id into v_payer
    from identity.membership_parties mp
    where mp.membership_id = p_membership_key and mp.tenant_id = p_tenant_id;
  end if;

  return query select v_prop_id, v_debtor, v_payer;
end;
$function$;$r7_early_30$;
    execute $r7_early_31$CREATE OR REPLACE FUNCTION payments.validate_and_mask_iban(p_iban text, OUT o_normalized text, OUT o_masked text, OUT o_fingerprint text)
 RETURNS record
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  v_clean text;
  v_num text;
  v_char text;
  v_code integer;
  v_mod integer := 0;
  i integer;
begin
  v_clean := upper(regexp_replace(coalesce(p_iban, ''), '[^A-Za-z0-9]', '', 'g'));
  
  if length(v_clean) < 15 or length(v_clean) > 34 then
    raise exception 'invalid_iban_length' using errcode = '22023';
  end if;

  -- Romanian IBAN specific validation if starting with RO
  if left(v_clean, 2) = 'RO' and length(v_clean) <> 24 then
    raise exception 'invalid_romanian_iban_length' using errcode = '22023';
  end if;

  -- MOD-97 check
  v_num := substr(v_clean, 5) || substr(v_clean, 1, 4);
  v_mod := 0;
  for i in 1..length(v_num) loop
    v_char := substr(v_num, i, 1);
    if v_char ~ '^[0-9]$' then
      v_mod := (v_mod * 10 + v_char::integer) % 97;
    else
      v_code := ascii(v_char) - 55;
      v_mod := (v_mod * 100 + v_code) % 97;
    end if;
  end loop;

  if v_mod <> 1 then
    raise exception 'invalid_iban_checksum' using errcode = '22023';
  end if;

  o_normalized := v_clean;
  o_masked := left(v_clean, 4) || '****' || right(v_clean, 4);
  o_fingerprint := encode(extensions.digest(v_clean, 'sha256'), 'hex');
end;
$function$;$r7_early_31$;
    execute $r7_early_32$CREATE OR REPLACE FUNCTION platform.get_customer_dashboard(p_context_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'platform', 'identity', 'portfolio', 'maintenance', 'billing', 'communications', 'occupancy'
AS $function$
declare
  v record;
  v_workspace uuid;
  v_party_id uuid;
  v_ownership_id uuid;
  v_lease_id uuid;
  v_entitlements jsonb;
  v_permissions jsonb;
  v_modules jsonb;
  v_persona text;
  v_sections jsonb;
  v_capabilities jsonb;
  v_kpis jsonb;
begin
  -- 1. Authentication requirement
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Customer MFA verification
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context grant, active membership, tenant and role resolution
  select
    g.id,
    g.membership_id,
    g.tenant_id,
    g.scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.id as membership_key,
    m.role_id,
    lower(r.code) as role_code,
    r.name as role_name,
    t.legal_name as tenant_name
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

  -- 4. Fail-closed check: only 6 canonical roles permitted
  if v.role_code not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'unknown_role' using errcode = '42501';
  end if;

  -- 5. Customer workspace validation: active workspace must be present
  select w.id
  into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id
    and w.lifecycle_status = 'ACTIVE'
  order by w.id
  limit 1;

  if v_workspace is null then
    raise exception 'workspace_inactive' using errcode = '42501';
  end if;

  -- 6. Server-authoritative entitlements and permissions extraction with full override semantics
  select coalesce(jsonb_agg(e.entitlement_key order by e.entitlement_key), '[]'::jsonb)
  into v_entitlements
  from platform.workspace_entitlements e
  where e.customer_workspace_id = v_workspace
    and e.valid_from <= statement_timestamp()
    and (e.valid_until is null or e.valid_until > statement_timestamp())
    and (
      case
        when e.override_value_json is not null
         and e.override_expires_at > statement_timestamp()
        then e.override_value_json = 'true'::jsonb
        else e.boolean_value is true
      end
    );

  select coalesce(jsonb_agg(distinct p.code order by p.code), '[]'::jsonb)
  into v_permissions
  from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  where rp.role_id = v.role_id and rp.effect = 'allow';

  -- 7. Server-authoritative module visibility derivation (intersection of permission + active entitlement)
  select coalesce(jsonb_agg(m order by m), '[]'::jsonb)
  into v_modules
  from (
    select 'dashboard' as m
    union
    select 'accounting' where (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting')
    union
    select 'billing' where (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing')
    union
    select 'payments' where (v_permissions ? 'payments.reconciliation.read') and (v_entitlements ? 'module.payments')
    union
    select 'utilities' where (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities')
    union
    select 'maintenance' where (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'procurement' where (v_permissions ? 'maintenance.procurement.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'governance' where (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance')
    union
    select 'communications' where (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications')
    union
    select 'documents' where (v_permissions ? 'documents.vault.read') and (v_entitlements ? 'module.documents')
    union
    select 'occupancy' where (v_permissions ? 'occupancy.registry.read') and (v_entitlements ? 'module.occupancy')
    union
    select 'security' where (v_permissions ? 'security.access.read') and (v_entitlements ? 'module.security')
    union
    select 'audit' where (v_permissions ? 'audit.events.read')
  ) t;

  -- 8. Deep Resident Validation (owner and tenant_resident)
  if v.role_code in ('owner', 'tenant_resident') then
    -- 8.1 Unit context requirement: scope_type must be unit and unit_id not null
    if v.scope_type <> 'unit' or v.unit_id is null then
      raise exception 'unit_context_required' using errcode = '42501';
    end if;

    -- 8.2 Party mapping requirement
    select mp.party_id into v_party_id
    from identity.membership_parties mp
    where mp.membership_id = v.membership_key
      and mp.tenant_id = v.tenant_id;

    if v_party_id is null then
      raise exception 'resident_party_mapping_required' using errcode = '42501';
    end if;

    -- 8.3 Owner validation: active ownership record
    if v.role_code = 'owner' then
      select o.id into v_ownership_id
      from portfolio.ownerships o
      where o.tenant_id = v.tenant_id
        and o.unit_id = v.unit_id
        and o.party_id = v_party_id
        and o.valid_from <= current_date
        and (o.valid_to is null or o.valid_to > current_date)
      limit 1;

      if v_ownership_id is null then
        raise exception 'ownership_required' using errcode = '42501';
      end if;

    -- 8.4 Tenant-resident validation: active lease
    elsif v.role_code = 'tenant_resident' then
      select l.id into v_lease_id
      from occupancy.leases l
      where l.tenant_id = v.tenant_id
        and l.unit_id = v.unit_id
        and l.tenant_party_id = v_party_id
        and l.status = 'active'
        and l.starts_on <= current_date
        and (l.ends_on is null or l.ends_on > current_date)
      limit 1;

      if v_lease_id is null then
        raise exception 'active_lease_required' using errcode = '42501';
      end if;
    end if;
  end if;

  -- 9. Role-aware Persona matrix, sections, capabilities, and isolated KPIs
  if v.role_code in ('association_admin', 'property_manager') then
    v_persona := v.role_code;
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_sections := v_sections || jsonb_build_array('operations');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_operations');
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_sections := v_sections || jsonb_build_array('financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financials');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'properties', (select count(*) from portfolio.properties p where p.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or p.id = v.property_id or p.id = (select b.property_id from portfolio.buildings b where b.id = v.building_id) or p.id = (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = v.unit_id))),
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id or b.id = (select u.building_id from portfolio.units u where u.id = v.unit_id))),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id))
    );

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id or w.unit_id = v.unit_id)));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id)));
    end if;

  elsif v.role_code = 'president' then
    v_persona := 'president';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance') then
      v_sections := v_sections || jsonb_build_array('governance');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_governance');
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_sections := v_sections || jsonb_build_array('financial_summary');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_summary');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id)),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id))
    );

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id)));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)));
    end if;

  elsif v.role_code = 'censor' then
    v_persona := 'censor';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_sections := v_sections || jsonb_build_array('financial_controls');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_controls');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_kpis := v_kpis || jsonb_build_object(
        'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)),
        'financial_records', (select count(*) from billing.invoices i where i.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id))
      );
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

  elsif v.role_code = 'owner' then
    v_persona := 'owner';
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    v_sections := v_sections || jsonb_build_array('my_units');
    v_capabilities := v_capabilities || jsonb_build_array('can_view_my_units');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_financials');
    end if;

    -- Strict unit-only isolation: unit_id matches the validated ownership unit!
    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'my_units_count', (select count(*) from portfolio.ownerships o where o.tenant_id = v.tenant_id and o.unit_id = v.unit_id and o.party_id = v_party_id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date))
    );

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('my_open_requests', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')));
    end if;

  elsif v.role_code = 'tenant_resident' then
    v_persona := 'tenant_resident';
    v_sections := jsonb_build_array('my_residence');
    v_capabilities := jsonb_build_array('can_view_my_residence');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_expenses');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_expenses');
    end if;

    if (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities') then
      v_sections := v_sections || jsonb_build_array('my_consumption');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_consumption');
    end if;

    -- Strict unit & tenant party isolation!
    v_kpis := '{}'::jsonb;

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id and (i.liable_party_id is null or i.liable_party_id = v_party_id)));
    end if;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('my_open_tickets', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;
  end if;

  -- 10. Explicit versioned response construction
  return jsonb_build_object(
    'version', 1,
    'persona', v_persona,
    'contextId', v.id,
    'context', jsonb_build_object(
      'id', v.id,
      'tenant_id', v.tenant_id,
      'tenant_name', v.tenant_name,
      'role_code', v.role_code,
      'role_name', v.role_name,
      'scope_type', v.scope_type,
      'property_id', v.property_id,
      'building_id', v.building_id,
      'unit_id', v.unit_id
    ),
    'workspace_id', v_workspace,
    'permissions', v_permissions,
    'entitlements', v_entitlements,
    'modules', v_modules,
    'capabilities', v_capabilities,
    'sections', v_sections,
    'kpis', v_kpis,
    'generated_at', statement_timestamp()
  );
end $function$;$r7_early_32$;
  end if;
end
$r7_context$;

commit;
