-- Additive source only; not executed. Existing canonical review records, no ledger.
begin;
create function utilities.protect_invoice_review_provenance_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $origin$
declare binding record;
begin
 if tg_op='INSERT' then
  if (new.decision='submitted' and new.reason='utilities.invoice.origin.v1')
   or new.after_snapshot->>'contract_version'='utilities-invoice-origin.v1' then
   if new.decision is distinct from 'submitted' or new.reason is distinct from 'utilities.invoice.origin.v1'
    or new.after_snapshot->>'contract_version' is distinct from 'utilities-invoice-origin.v1'
    or new.actor_id is distinct from auth.uid() or auth.uid() is null
   then raise exception 'utility_invoice_origin_invalid' using errcode='42501';end if;
   select t.invoice_id,c.property_id into strict binding from utilities.review_tasks t
    join utilities.provider_invoices i on i.id=t.invoice_id and i.tenant_id=t.tenant_id
    join utilities.supply_contracts c on c.id=i.contract_id and c.tenant_id=i.tenant_id
    where t.id=new.task_id and t.tenant_id=new.tenant_id for share of t,i,c;
   if new.after_snapshot->>'source_id' is distinct from binding.invoice_id::text
    or new.after_snapshot->>'property_id' is distinct from binding.property_id::text
   then raise exception 'utility_invoice_origin_invalid' using errcode='42501';end if;
   if new.tenant_id is distinct from utilities.monthly_input_actor_v1(
     (new.after_snapshot->>'context_id')::uuid,(new.after_snapshot->>'workspace_id')::uuid,
     (new.after_snapshot->>'authority_revision')::bigint,'utilities.invoices.ingest',binding.property_id)
   then raise exception 'utility_invoice_origin_invalid' using errcode='42501';end if;
  end if;
  return new;
 end if;
 if (old.decision='submitted' and old.reason='utilities.invoice.origin.v1')
  or old.after_snapshot->>'contract_version' in ('utilities-invoice-origin.v1','utilities-invoice-review-decision.v2')
 then raise exception 'utility_invoice_provenance_immutable' using errcode='55000';end if;
 if tg_op='UPDATE' then
  if (new.decision='submitted' and new.reason='utilities.invoice.origin.v1')
   or new.after_snapshot->>'contract_version' in ('utilities-invoice-origin.v1','utilities-invoice-review-decision.v2')
  then raise exception 'utility_invoice_provenance_immutable' using errcode='55000';end if;
  return new;
 end if;
 return old;
end $origin$;
create unique index invoice_review_origin_once_v1 on utilities.review_decisions(tenant_id,(after_snapshot->>'source_id'))
 where decision='submitted' and reason='utilities.invoice.origin.v1';
create trigger invoice_review_provenance_immutable_v1 before insert or update or delete on utilities.review_decisions
 for each row execute function utilities.protect_invoice_review_provenance_v1();
-- Existing invoice guard freezes amounts/lines but does not cover every source
-- provenance/approval field. Extend only this NEW approval family, not legacy.
create function utilities.protect_invoice_approval_content_v2()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $approval$
begin
 if old.approved_snapshot->>'contract_version'='utilities-invoice-approval.v2'
  and old.status in ('approved','posted') then
  if new.status not in ('approved','posted')
   or (to_jsonb(new)-array['status','updated_at','ledger_journal_id']) is distinct from
      (to_jsonb(old)-array['status','updated_at','ledger_journal_id'])
  then raise exception 'utility_invoice_approved_version_immutable' using errcode='55000';end if;
 end if;
 return new;
end $approval$;
create trigger invoice_input_approval_immutable_v2 before update on utilities.provider_invoices
 for each row execute function utilities.protect_invoice_approval_content_v2();
revoke all on function utilities.protect_invoice_review_provenance_v1() from public,anon,authenticated,service_role;
revoke all on function utilities.protect_invoice_approval_content_v2() from public,anon,authenticated,service_role;
commit;
