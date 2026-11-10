-- Inactive source payload; Platform admission, exact owner/ACL/RLS and policy required.
-- Invoker functions; no role assignment, ledger, transaction host or receipt store.
begin;
create function utilities.monthly_input_actor_v1(p_context uuid,p_workspace uuid,p_revision bigint,p_permission text,p_property uuid)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $guard$
declare t timestamptz; c record; derived record;
begin
 if p_permission is null or p_permission not in ('utilities.invoices.ingest','utilities.invoices.review','utilities.readings.approve') then
  raise exception 'utility_input_denied' using errcode='42501'; end if;
 perform app_private.core_functional_checkpoint_v1(p_context,p_workspace,p_permission,'utilities',p_revision);
 -- Fresh server time after the checkpoint's session/epoch/context row waits.
 t:=clock_timestamp();
 perform app_private.require_request_session_current_at_v1(t);
 select * into strict c from app_private.resolve_workspace_native_context_v2_at_v1(p_context,p_workspace,t);
 select * into strict derived from app_private.resolve_workspace_from_customer_context_v1_at_v1(p_context,false,t);
 if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2'
  or derived.workspace_id is distinct from p_workspace or derived.tenant_id is distinct from c.tenant_id
  or not coalesce(app_private.check_effective_permission_v2_at_v1(p_context,p_permission,'utilities','property',p_property,null,t),false)
  or not exists(select 1 from portfolio.properties where id=p_property and tenant_id=c.tenant_id)
 then raise exception 'utility_input_denied' using errcode='42501'; end if;
 return c.tenant_id;
end $guard$;

create function utilities.produce_monthly_input_v1(p_context uuid,p_workspace uuid,p_revision bigint,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $producer$
declare op text; permission text; tenant uuid; property uuid; source uuid; c utilities.supply_contracts;
 d utilities.ingestion_documents; s utilities.ingestion_sources; i utilities.provider_invoices;
 task utilities.review_tasks; r utilities.meter_readings; m utilities.meters;
 item jsonb; subtotal numeric(20,4); tax numeric(20,4); before_row jsonb; after_row jsonb;
 expected text; source_relation text; allowed_keys text[]; line_image jsonb;
begin
 if current_setting('transaction_isolation')<>'serializable' then raise exception 'serializable_required' using errcode='55000';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>65536
  or p_input->>'contract_version' is distinct from 'utilities-monthly-input.v1'
 then raise exception 'utility_input_invalid' using errcode='22023';end if;
 op:=p_input->>'operation';source:=(p_input->>'source_id')::uuid;
 if source is null then raise exception 'utility_input_invalid' using errcode='22023';end if;
 if op='ingest_invoice' then
  permission:='utilities.invoices.ingest';
  allowed_keys:=array['contract_version','operation','source_id','contract_id','ingestion_document_id','external_invoice_no','issued_on','due_on','period_start','period_end','currency','lines'];
 elsif op='review_invoice' then
  permission:='utilities.invoices.review';
  allowed_keys:=array['contract_version','operation','source_id','review_task_id','expected_source_sha256','decision','reason'];
 elsif op='approve_reading' then
  permission:='utilities.readings.approve';
  allowed_keys:=array['contract_version','operation','source_id','expected_source_sha256','note'];
 else raise exception 'utility_input_invalid' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_input) k where not(k=any(allowed_keys)))
  or exists(select 1 from unnest(allowed_keys) k where not(p_input ? k))
 then raise exception 'utility_input_invalid' using errcode='22023';end if;
 -- Session/epoch/context before source locks; this does not create C03 reservation.
 perform app_private.core_functional_checkpoint_v1(p_context,p_workspace,permission,'utilities',p_revision);
 select x.tenant_id into strict tenant from app_private.resolve_workspace_native_context_v2_at_v1(p_context,p_workspace,clock_timestamp()) x;
 if op='ingest_invoice' then
  select * into c from utilities.supply_contracts where id=(p_input->>'contract_id')::uuid and tenant_id=tenant for share;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  property:=c.property_id;
  select * into d from utilities.ingestion_documents where id=(p_input->>'ingestion_document_id')::uuid and tenant_id=tenant;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  select * into s from utilities.ingestion_sources where id=d.source_id and tenant_id=tenant for share;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  select * into d from utilities.ingestion_documents where id=(p_input->>'ingestion_document_id')::uuid and tenant_id=tenant for update;
  if not found or d.source_id is distinct from s.id or d.invoice_id is not null
   or s.contract_id is distinct from c.id or s.status<>'active' or d.sha256 !~ '^[a-f0-9]{64}$'
   or d.object_path is null or d.object_path='' then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  perform utilities.monthly_input_actor_v1(p_context,p_workspace,p_revision,permission,property);
  if exists(select 1 from unnest(array['external_invoice_no','issued_on','period_start','period_end','currency']) k where jsonb_typeof(p_input->k) is distinct from 'string')
   or exists(select 1 from unnest(array['issued_on','period_start','period_end']) k where (p_input->>k) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
   or (p_input->'due_on'<>'null'::jsonb and jsonb_typeof(p_input->'due_on') is distinct from 'string')
   or c.status<>'active' or p_input->>'currency' is distinct from c.currency::text
   or p_input->>'currency' !~ '^[A-Z]{3}$' or p_input->>'issued_on' is null
   or (p_input->>'period_start')::date>=(p_input->>'period_end')::date
   or (p_input->>'period_start')::date<c.starts_on
   or (c.ends_on is not null and (p_input->>'period_end')::date>c.ends_on)
   or ((p_input->>'due_on') is not null and (p_input->>'due_on')::date<(p_input->>'issued_on')::date)
   or length(btrim(p_input->>'external_invoice_no')) not between 1 and 160
   or jsonb_typeof(p_input->'lines') is distinct from 'array'
  then raise exception 'utility_invoice_invalid' using errcode='22023';end if;
  if jsonb_array_length(p_input->'lines') not between 1 and 100 then raise exception 'utility_invoice_invalid' using errcode='22023';end if;
  subtotal:=0;tax:=0;
  for item in select value from jsonb_array_elements(p_input->'lines') loop
   if jsonb_typeof(item) is distinct from 'object'
    or exists(select 1 from unnest(array['service_type','description','line_subtotal','line_tax']) k where jsonb_typeof(item->k) is distinct from 'string')
    or exists(select 1 from jsonb_object_keys(item) k where k not in ('service_type','description','line_subtotal','line_tax'))
    or item->>'service_type' is distinct from c.service_type::text
    or length(btrim(item->>'description')) not between 1 and 500
    or jsonb_typeof(item->'line_subtotal') is distinct from 'string' or jsonb_typeof(item->'line_tax') is distinct from 'string'
    or item->>'line_subtotal' !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$'
    or item->>'line_tax' !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$'
   then raise exception 'utility_invoice_line_invalid' using errcode='22023';end if;
   subtotal:=subtotal+(item->>'line_subtotal')::numeric;tax:=tax+(item->>'line_tax')::numeric;
  end loop;
  insert into utilities.provider_invoices(id,tenant_id,contract_id,provider_id,external_invoice_no,issued_on,due_on,period_start,period_end,currency,subtotal,tax_total,status,source_object_path,source_sha256)
  values(source,tenant,c.id,c.provider_id,btrim(p_input->>'external_invoice_no'),(p_input->>'issued_on')::date,(p_input->>'due_on')::date,
   (p_input->>'period_start')::date,(p_input->>'period_end')::date,c.currency,subtotal,tax,'review_required',d.object_path,d.sha256);
  for item in select value from jsonb_array_elements(p_input->'lines') loop
   insert into utilities.provider_invoice_lines(tenant_id,invoice_id,service_type,description,line_subtotal,line_tax)
   values(tenant,source,c.service_type,btrim(item->>'description'),(item->>'line_subtotal')::numeric,(item->>'line_tax')::numeric);
  end loop;
  insert into utilities.review_tasks(tenant_id,invoice_id,reason_code,status)
  values(tenant,source,'utilities.monthly.invoice_review','open');
  update utilities.ingestion_documents set invoice_id=source,processing_status='review_required' where id=d.id;
  source_relation:='utilities.provider_invoices';
 elsif op='review_invoice' then
  select * into i from utilities.provider_invoices where id=source and tenant_id=tenant;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  select * into c from utilities.supply_contracts where id=i.contract_id and tenant_id=tenant for share;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  property:=c.property_id;
  select * into i from utilities.provider_invoices where id=source and tenant_id=tenant for update;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  perform 1 from utilities.provider_invoice_lines where invoice_id=source and tenant_id=tenant order by id for share;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into line_image from utilities.provider_invoice_lines x where invoice_id=source and tenant_id=tenant;
  select * into task from utilities.review_tasks where id=(p_input->>'review_task_id')::uuid and tenant_id=tenant and invoice_id=source for update;
  if not found or task.reason_code<>'utilities.monthly.invoice_review' or task.status not in ('open','assigned') or (task.assigned_to is not null and task.assigned_to is distinct from auth.uid())
   or i.status<>'review_required' or i.contract_id is distinct from c.id or i.provider_id is distinct from c.provider_id
  then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  before_row:=jsonb_build_object('invoice',to_jsonb(i),'lines',line_image);
  expected:=encode(extensions.digest(convert_to(before_row::text,'UTF8'),'sha256'),'hex');
  if jsonb_typeof(p_input->'decision') is distinct from 'string' or jsonb_typeof(p_input->'reason') is distinct from 'string'
   or expected is distinct from p_input->>'expected_source_sha256' or p_input->>'decision' not in ('approved','rejected')
   or length(btrim(p_input->>'reason')) not between 8 and 1000 then raise exception 'utility_review_mismatch' using errcode='22023';end if;
  perform utilities.monthly_input_actor_v1(p_context,p_workspace,p_revision,permission,property);
  if c.status<>'active' or i.currency is distinct from c.currency or i.period_start<c.starts_on or (c.ends_on is not null and i.period_end>c.ends_on)
  then raise exception 'utility_contract_invalid' using errcode='42501';end if;
  update utilities.provider_invoices set status=(case when p_input->>'decision'='approved' then 'approved' else 'void' end)::utilities.invoice_status,
   approved_by=case when p_input->>'decision'='approved' then auth.uid() else null end,
   approved_at=case when p_input->>'decision'='approved' then clock_timestamp() else null end,
   approved_snapshot=case when p_input->>'decision'='approved' then before_row else null end
  where id=source and tenant_id=tenant returning to_jsonb(provider_invoices.*) into after_row;
  update utilities.review_tasks set status=(p_input->>'decision')::utilities.review_status,decided_by=auth.uid(),decided_at=clock_timestamp(),decision_note=p_input->>'reason' where id=task.id;
  insert into utilities.review_decisions(tenant_id,task_id,actor_id,decision,before_snapshot,after_snapshot,reason)
  values(tenant,task.id,auth.uid(),p_input->>'decision',before_row,after_row,p_input->>'reason');
  source_relation:='utilities.provider_invoices';
 else
  select * into r from utilities.meter_readings where id=source and tenant_id=tenant;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  select * into m from utilities.meters where id=r.meter_id and tenant_id=tenant for share;
  if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  property:=m.property_id;
  select * into r from utilities.meter_readings where id=source and tenant_id=tenant for update;
  if not found or r.meter_id is distinct from m.id or r.status<>'captured' then raise exception 'utility_input_unavailable' using errcode='42501';end if;
  if jsonb_typeof(p_input->'note') is distinct from 'string' and p_input->'note'<>'null'::jsonb
   then raise exception 'utility_input_invalid' using errcode='22023';end if;
  expected:=encode(extensions.digest(convert_to(to_jsonb(r)::text,'UTF8'),'sha256'),'hex');
  if expected is distinct from p_input->>'expected_source_sha256' then raise exception 'utility_reading_mismatch' using errcode='22023';end if;
  perform utilities.monthly_input_actor_v1(p_context,p_workspace,p_revision,permission,property);
  perform utilities.approve_reading(p_context,source,p_input->>'note');
  source_relation:='utilities.meter_readings';
 end if;
 -- Recheck the entire canonical chain after domain-trigger/review/audit waits.
 -- The C03 host remains responsible for its later audit/outbox/receipt/settlement.
 perform utilities.monthly_input_actor_v1(p_context,p_workspace,p_revision,permission,property);
 if source_relation='utilities.provider_invoices' then
  select to_jsonb(x) into strict after_row from utilities.provider_invoices x where id=source and tenant_id=tenant;
 else select to_jsonb(x) into strict after_row from utilities.meter_readings x where id=source and tenant_id=tenant;end if;
 return jsonb_build_object('contract_version','utilities-monthly-input-result.v1','source_relation',source_relation,'source_id',source,
  'source_sha256',encode(extensions.digest(convert_to(after_row::text,'UTF8'),'sha256'),'hex'),'status',after_row->>'status',
  'mutation_id',source,'tenant_id',tenant,'actor_id',auth.uid(),'database_transaction_id',txid_current()::text);
end $producer$;

-- Read-only preparation, on a lock-capable read scope; no C03 reservation/receipt.
-- Returns a real DB snapshot hash + task identity, NOT an approval or authority.
create function utilities.read_invoice_review_source_v1(p_context uuid,p_workspace uuid,p_revision bigint,p_source uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $read_source$
declare tenant uuid; i utilities.provider_invoices; c utilities.supply_contracts; task utilities.review_tasks; lines jsonb; image jsonb;
begin
 if current_setting('transaction_isolation')<>'serializable' then raise exception 'serializable_required' using errcode='55000';end if;
 perform app_private.core_functional_checkpoint_v1(p_context,p_workspace,'utilities.invoices.review','utilities',p_revision);
 select x.tenant_id into strict tenant from app_private.resolve_workspace_native_context_v2_at_v1(p_context,p_workspace,clock_timestamp()) x;
 select * into i from utilities.provider_invoices where id=p_source and tenant_id=tenant;
 if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
 select * into c from utilities.supply_contracts where id=i.contract_id and tenant_id=tenant for share;
 if not found then raise exception 'utility_input_unavailable' using errcode='42501';end if;
 select * into i from utilities.provider_invoices where id=p_source and tenant_id=tenant for share;
 if not found or i.contract_id is distinct from c.id or i.status<>'review_required' then raise exception 'utility_input_unavailable' using errcode='42501';end if;
 perform 1 from utilities.provider_invoice_lines where invoice_id=p_source and tenant_id=tenant order by id for share;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into lines from utilities.provider_invoice_lines x where invoice_id=p_source and tenant_id=tenant;
 select * into strict task from utilities.review_tasks where invoice_id=p_source and tenant_id=tenant
  and reason_code='utilities.monthly.invoice_review' and status in('open','assigned') for share;
 if task.assigned_to is not null and task.assigned_to is distinct from auth.uid() then raise exception 'utility_input_unavailable' using errcode='42501';end if;
 perform utilities.monthly_input_actor_v1(p_context,p_workspace,p_revision,'utilities.invoices.review',c.property_id);
 image:=jsonb_build_object('invoice',to_jsonb(i),'lines',lines);
 return jsonb_build_object('contract_version','utilities-invoice-review-source.v1','source_id',p_source,'review_task_id',task.id,
  'source_sha256',encode(extensions.digest(convert_to(image::text,'UTF8'),'sha256'),'hex'),
  'tenant_id',tenant,'actor_id',auth.uid(),'database_transaction_id',txid_current()::text);
end $read_source$;
revoke all on function utilities.monthly_input_actor_v1(uuid,uuid,bigint,text,uuid),utilities.produce_monthly_input_v1(uuid,uuid,bigint,jsonb),utilities.read_invoice_review_source_v1(uuid,uuid,bigint,uuid) from public,anon,authenticated,service_role;
commit;
