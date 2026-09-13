begin;

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
on conflict(role_id,permission_id) do update set effect=excluded.effect;

create table finance.export_packs (
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

create table finance.export_artifacts (
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

create index export_packs_period_idx on finance.export_packs(tenant_id,accounting_period_id,generated_at desc);
create index export_packs_accounting_period_id_idx on finance.export_packs(accounting_period_id);
create index export_packs_property_id_idx on finance.export_packs(property_id);
create index export_packs_generated_by_idx on finance.export_packs(generated_by);
create index export_artifacts_pack_idx on finance.export_artifacts(export_pack_id,report_code,format);
create index export_artifacts_pack_tenant_idx on finance.export_artifacts(export_pack_id,tenant_id);
alter table finance.export_packs enable row level security;
alter table finance.export_artifacts enable row level security;
revoke all on finance.export_packs,finance.export_artifacts from public,anon,authenticated;
grant all on finance.export_packs,finance.export_artifacts to service_role;

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
end $$;
revoke all on function app_private.export_pack_actor_v1(uuid,text) from public,anon,authenticated;

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
end $$;
revoke all on function app_private.build_export_reports_v1(uuid,uuid,date,date) from public,anon,authenticated;

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
end $$;
revoke all on function app_private.create_export_pack_internal_v1(uuid,uuid,text) from public,anon,authenticated;

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
end $$;
revoke all on function app_private.get_export_pack_internal_v1(uuid,uuid) from public,anon,authenticated;

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
end $$;
revoke all on function app_private.record_export_artifact_internal_v1(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;

create or replace function customer_api.create_export_pack_v1(p_context_id uuid,p_accounting_period_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.create_export_pack_internal_v1(p_context_id,p_accounting_period_id,p_idempotency_key)$$;
create or replace function customer_api.get_export_pack_v1(p_context_id uuid,p_export_pack_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$select app_private.get_export_pack_internal_v1(p_context_id,p_export_pack_id)$$;
create or replace function customer_api.record_export_artifact_v1(p_context_id uuid,p_export_pack_id uuid,p_report_code text,p_format text,p_content_sha256 text,p_byte_size bigint)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$select app_private.record_export_artifact_internal_v1(p_context_id,p_export_pack_id,p_report_code,p_format,p_content_sha256,p_byte_size)$$;
revoke all on function customer_api.create_export_pack_v1(uuid,uuid,text),customer_api.get_export_pack_v1(uuid,uuid),customer_api.record_export_artifact_v1(uuid,uuid,text,text,text,bigint) from public,anon;
grant execute on function customer_api.create_export_pack_v1(uuid,uuid,text),customer_api.get_export_pack_v1(uuid,uuid),customer_api.record_export_artifact_v1(uuid,uuid,text,text,text,bigint) to authenticated,service_role;

create or replace function finance.protect_export_pack_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$begin raise exception 'sealed_export_pack_is_immutable' using errcode='55000'; end$$;
revoke all on function finance.protect_export_pack_v1() from public,anon,authenticated;
create trigger export_packs_immutable before update or delete on finance.export_packs for each row execute function finance.protect_export_pack_v1();
create trigger export_artifacts_no_delete before delete on finance.export_artifacts for each row execute function finance.protect_export_pack_v1();

commit;
