begin;

alter table payments.import_batches
  add column if not exists idempotency_key text,
  add column if not exists file_name text,
  add column if not exists statement_format text,
  add column if not exists status text not null default 'committed',
  add column if not exists opening_balance numeric(20,4),
  add column if not exists closing_balance numeric(20,4),
  add column if not exists total_credits numeric(20,4) not null default 0,
  add column if not exists total_debits numeric(20,4) not null default 0,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists validated_at timestamptz,
  add column if not exists committed_at timestamptz,
  add column if not exists version integer not null default 1;

alter table payments.import_batches drop constraint if exists import_batches_status_check;
alter table payments.import_batches add constraint import_batches_status_check
  check(status in ('draft','staged','validated','validation_failed','committed','cancelled'));
alter table payments.import_batches drop constraint if exists import_batches_statement_format_check;
alter table payments.import_batches add constraint import_batches_statement_format_check
  check(statement_format is null or statement_format in ('csv','camt053','json'));
create unique index if not exists import_batches_idempotency_idx
  on payments.import_batches(tenant_id,bank_account_id,idempotency_key) where idempotency_key is not null;

create table payments.bank_transaction_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  batch_id uuid not null references payments.import_batches(id) on delete restrict,
  row_no integer not null check(row_no>0),
  external_ref text,
  booked_on date,
  value_on date,
  direction text,
  amount numeric(20,4),
  currency text,
  counterparty_name text,
  counterparty_iban_masked text,
  remittance_text text,
  fingerprint text not null,
  raw_snapshot jsonb not null,
  validation_status text not null default 'pending' check(validation_status in ('pending','valid','invalid','duplicate')),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique(batch_id,row_no)
);
create index bank_transaction_staging_tenant_idx on payments.bank_transaction_staging(tenant_id);
create index bank_transaction_staging_batch_idx on payments.bank_transaction_staging(batch_id);
alter table payments.bank_transaction_staging enable row level security;
create policy bank_transaction_staging_context_read on payments.bank_transaction_staging for select to authenticated
using(tenant_id=app_private.active_tenant_id() and exists(
  select 1 from payments.import_batches b join payments.bank_accounts a on a.id=b.bank_account_id
  where b.id=batch_id and (a.property_id is null or app_private.can_access_property(a.property_id))));
grant select on payments.bank_transaction_staging to authenticated;
grant all on payments.bank_transaction_staging to service_role;

create or replace function app_private.create_bank_statement_import_internal_v1(
  p_context_id uuid,p_bank_account_id uuid,p_source text,p_source_hash text,p_file_name text,
  p_statement_format text,p_period_start date,p_period_end date,p_opening_balance numeric,
  p_closing_balance numeric,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,payments
as $$ declare c record;b payments.import_batches; begin
  select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'payments.reconcile',true);
  if p_period_end<p_period_start then raise exception 'invalid_statement_period' using errcode='22023'; end if;
  if p_statement_format not in('csv','camt053','json') then raise exception 'unsupported_statement_format' using errcode='22023'; end if;
  if p_source_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_statement_hash' using errcode='22023'; end if;
  if length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'invalid_idempotency_key' using errcode='22023'; end if;
  if not exists(select 1 from payments.bank_accounts a where a.id=p_bank_account_id and a.tenant_id=c.tenant_id and a.status='active' and (c.property_id is null or a.property_id=c.property_id)) then raise exception 'bank_account_not_found' using errcode='P0002'; end if;
  select * into b from payments.import_batches
  where tenant_id=c.tenant_id and bank_account_id=p_bank_account_id
    and (idempotency_key=p_idempotency_key or source_hash=p_source_hash)
  order by (idempotency_key=p_idempotency_key) desc limit 1 for update;
  if found then
    if b.source_hash<>p_source_hash or coalesce(b.idempotency_key,'')<>p_idempotency_key then
      raise exception 'idempotency_payload_mismatch' using errcode='23505';
    end if;
    return jsonb_build_object('id',b.id,'status',b.status,'version',b.version,'idempotent',true);
  end if;
  insert into payments.import_batches(tenant_id,bank_account_id,source,source_hash,file_name,statement_format,status,period_start,period_end,opening_balance,closing_balance,imported_by,idempotency_key)
  values(c.tenant_id,p_bank_account_id,left(trim(p_source),100),p_source_hash,left(trim(p_file_name),255),p_statement_format,'draft',p_period_start,p_period_end,p_opening_balance,p_closing_balance,auth.uid(),p_idempotency_key)
  returning * into b;
  return jsonb_build_object('id',b.id,'status',b.status,'version',b.version,'idempotent',false);
end $$;

create or replace function app_private.stage_bank_statement_rows_internal_v1(p_context_id uuid,p_batch_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,payments,extensions
as $$ declare c record;b payments.import_batches;r jsonb;n integer:=0;fp text; begin
  select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'payments.reconcile',true);
  select * into b from payments.import_batches where id=p_batch_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'statement_import_not_found' using errcode='P0002'; end if;
  if b.status<>'draft' then raise exception 'statement_import_not_draft' using errcode='55000'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>5000 then raise exception 'invalid_statement_row_count' using errcode='22023'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop n:=n+1;
    fp:=encode(extensions.digest(convert_to(concat_ws('|',coalesce(r->>'external_ref',''),r->>'booked_on',lower(coalesce(r->>'direction','')),r->>'amount',upper(coalesce(r->>'currency','')),regexp_replace(coalesce(r->>'remittance_text',''),'\s+',' ','g')),'UTF8'),'sha256'),'hex');
    if coalesce(r->>'counterparty_iban_masked','') !~ '^[A-Z]{2}[0-9]{2}[*]{4,28}[A-Z0-9]{0,4}$' and coalesce(r->>'counterparty_iban_masked','')<>'' then
      raise exception 'unmasked_counterparty_iban_rejected' using errcode='22023';
    end if;
    insert into payments.bank_transaction_staging(tenant_id,batch_id,row_no,external_ref,booked_on,value_on,direction,amount,currency,counterparty_name,counterparty_iban_masked,remittance_text,fingerprint,raw_snapshot)
    values(c.tenant_id,b.id,n,nullif(r->>'external_ref',''),nullif(r->>'booked_on','')::date,nullif(r->>'value_on','')::date,lower(r->>'direction'),nullif(r->>'amount','')::numeric,upper(r->>'currency'),left(r->>'counterparty_name',255),left(r->>'counterparty_iban_masked',64),left(r->>'remittance_text',1000),fp,
      jsonb_strip_nulls(jsonb_build_object('external_ref',nullif(r->>'external_ref',''),'booked_on',nullif(r->>'booked_on',''),'value_on',nullif(r->>'value_on',''),'direction',nullif(lower(r->>'direction'),''),'amount',nullif(r->>'amount',''),'currency',nullif(upper(r->>'currency'),''),'counterparty_name',nullif(left(r->>'counterparty_name',255),''),'counterparty_iban_masked',nullif(left(r->>'counterparty_iban_masked',64),''),'remittance_text',nullif(left(r->>'remittance_text',1000),''))));
  end loop;
  update payments.import_batches set status='staged',row_count=n,version=version+1 where id=b.id;
  return jsonb_build_object('id',b.id,'status','staged','row_count',n);
end $$;

create or replace function app_private.validate_bank_statement_import_internal_v1(p_context_id uuid,p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,payments
as $$ declare c record;b payments.import_batches;bad integer;dups integer;cr numeric;dr numeric;errs jsonb; begin
  select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'payments.reconcile',true);
  select * into b from payments.import_batches where id=p_batch_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'statement_import_not_found' using errcode='P0002'; end if;
  if b.status not in('staged','validation_failed') then raise exception 'statement_import_not_staged' using errcode='55000'; end if;
  update payments.bank_transaction_staging s set validation_errors=jsonb_strip_nulls(jsonb_build_object(
    'booked_on',case when s.booked_on is null or s.booked_on not between b.period_start and b.period_end then 'outside_statement_period' end,
    'direction',case when s.direction not in('credit','debit') then 'invalid_direction' end,
    'amount',case when s.amount is null or s.amount<=0 then 'invalid_amount' end,
    'currency',case when s.currency is null or length(s.currency)<>3 then 'invalid_currency' end)),validation_status='pending'
  where s.batch_id=b.id;
  update payments.bank_transaction_staging s set validation_status=case
    when s.validation_errors<>'{}'::jsonb then 'invalid'
    when exists(select 1 from payments.bank_transaction_staging x where x.batch_id=s.batch_id and x.fingerprint=s.fingerprint and x.row_no<s.row_no) then 'duplicate'
    when exists(select 1 from payments.bank_transactions t where t.bank_account_id=b.bank_account_id and t.fingerprint=s.fingerprint) then 'duplicate'
    else 'valid' end where s.batch_id=b.id;
  select count(*) filter(where validation_status='invalid'),count(*) filter(where validation_status='duplicate'),coalesce(sum(amount) filter(where validation_status='valid' and direction='credit'),0),coalesce(sum(amount) filter(where validation_status='valid' and direction='debit'),0)
  into bad,dups,cr,dr from payments.bank_transaction_staging where batch_id=b.id;
  errs:=case when bad>0 then jsonb_build_array(jsonb_build_object('code','invalid_statement_rows','count',bad)) else '[]'::jsonb end;
  update payments.import_batches set status=case when bad=0 then 'validated' else 'validation_failed' end,total_credits=cr,total_debits=dr,validation_errors=errs,validated_at=statement_timestamp(),version=version+1 where id=b.id;
  return jsonb_build_object('id',b.id,'status',case when bad=0 then 'validated' else 'validation_failed' end,'valid_rows',b.row_count-bad-dups,'invalid_rows',bad,'duplicate_rows',dups,'total_credits',cr,'total_debits',dr);
end $$;

create or replace function app_private.protect_committed_bank_import_internal_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,payments
as $$ begin
  if old.status='committed' and new is distinct from old then
    raise exception 'committed_statement_import_immutable' using errcode='55000';
  end if;
  return new;
end $$;
create trigger protect_committed_bank_import before update or delete on payments.import_batches
for each row execute function app_private.protect_committed_bank_import_internal_v1();

create or replace function customer_api.get_bank_statement_import_v1(p_context_id uuid,p_batch_id uuid default null,p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,payments
as $$ declare c record; begin
  select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'payments.reconcile',false);
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.imported_at desc,x.id) from (
    select b.id,b.bank_account_id,b.file_name,b.statement_format,b.status,b.period_start,b.period_end,
      b.row_count,b.total_credits,b.total_debits,b.validation_errors,b.validated_at,b.committed_at,b.imported_at,b.version
    from payments.import_batches b join payments.bank_accounts a on a.id=b.bank_account_id
    where b.tenant_id=c.tenant_id and (p_batch_id is null or b.id=p_batch_id)
      and (c.property_id is null or a.property_id=c.property_id)
    order by b.imported_at desc,b.id limit p_limit offset p_offset
  ) x),'[]'::jsonb);
end $$;

create or replace function app_private.commit_bank_statement_import_internal_v1(p_context_id uuid,p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,payments
as $$ declare c record;b payments.import_batches;ins integer; begin
  select * into c from app_private.monthly_cycle_context_internal_v1(p_context_id,'payments.reconcile',true);
  select * into b from payments.import_batches where id=p_batch_id and tenant_id=c.tenant_id for update;
  if not found then raise exception 'statement_import_not_found' using errcode='P0002'; end if;
  if b.status='committed' then return jsonb_build_object('id',b.id,'status','committed','inserted_rows',0,'idempotent',true); end if;
  if b.status<>'validated' then raise exception 'validated_statement_required' using errcode='55000'; end if;
  insert into payments.bank_transactions(tenant_id,batch_id,bank_account_id,external_ref,booked_on,value_on,direction,amount,currency,counterparty_name,remittance_text,fingerprint,raw_snapshot)
  select s.tenant_id,s.batch_id,b.bank_account_id,s.external_ref,s.booked_on,s.value_on,s.direction::payments.transaction_direction,s.amount,s.currency,s.counterparty_name,s.remittance_text,s.fingerprint,s.raw_snapshot
  from payments.bank_transaction_staging s where s.batch_id=b.id and s.validation_status='valid'
  on conflict(bank_account_id,fingerprint) do nothing;
  get diagnostics ins=row_count;
  update payments.import_batches set status='committed',committed_at=statement_timestamp(),version=version+1 where id=b.id;
  return jsonb_build_object('id',b.id,'status','committed','inserted_rows',ins,'idempotent',false);
end $$;

create or replace function customer_api.create_bank_statement_import_v1(p_context_id uuid,p_bank_account_id uuid,p_source text,p_source_hash text,p_file_name text,p_statement_format text,p_period_start date,p_period_end date,p_opening_balance numeric,p_closing_balance numeric,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.create_bank_statement_import_internal_v1(p_context_id,p_bank_account_id,p_source,p_source_hash,p_file_name,p_statement_format,p_period_start,p_period_end,p_opening_balance,p_closing_balance,p_idempotency_key)$$;
create or replace function customer_api.stage_bank_statement_rows_v1(p_context_id uuid,p_batch_id uuid,p_rows jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.stage_bank_statement_rows_internal_v1(p_context_id,p_batch_id,p_rows)$$;
create or replace function customer_api.validate_bank_statement_import_v1(p_context_id uuid,p_batch_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.validate_bank_statement_import_internal_v1(p_context_id,p_batch_id)$$;
create or replace function customer_api.commit_bank_statement_import_v1(p_context_id uuid,p_batch_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.commit_bank_statement_import_internal_v1(p_context_id,p_batch_id)$$;

revoke all on function app_private.create_bank_statement_import_internal_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text),app_private.stage_bank_statement_rows_internal_v1(uuid,uuid,jsonb),app_private.validate_bank_statement_import_internal_v1(uuid,uuid),app_private.commit_bank_statement_import_internal_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.create_bank_statement_import_internal_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text),app_private.stage_bank_statement_rows_internal_v1(uuid,uuid,jsonb),app_private.validate_bank_statement_import_internal_v1(uuid,uuid),app_private.commit_bank_statement_import_internal_v1(uuid,uuid) to authenticated,service_role;
revoke all on function customer_api.create_bank_statement_import_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text),customer_api.stage_bank_statement_rows_v1(uuid,uuid,jsonb),customer_api.validate_bank_statement_import_v1(uuid,uuid),customer_api.commit_bank_statement_import_v1(uuid,uuid) from public,anon;
grant execute on function customer_api.create_bank_statement_import_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text),customer_api.stage_bank_statement_rows_v1(uuid,uuid,jsonb),customer_api.validate_bank_statement_import_v1(uuid,uuid),customer_api.commit_bank_statement_import_v1(uuid,uuid) to authenticated,service_role;
revoke all on function customer_api.get_bank_statement_import_v1(uuid,uuid,integer,integer) from public,anon;
grant execute on function customer_api.get_bank_statement_import_v1(uuid,uuid,integer,integer) to authenticated,service_role;

commit;
