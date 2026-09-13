begin;

-- CLADORA-P2-BANK-002: assisted matching, exception queue and independent approval.
-- Forward-only extension of the canonical payments reconciliation engine.

create table payments.reconciliation_match_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  bank_account_id uuid not null references payments.bank_accounts(id) on delete restrict,
  period_start date,
  period_end date,
  idempotency_key text not null,
  status text not null default 'completed' check (status in ('running','completed','failed')),
  scanned_count integer not null default 0 check (scanned_count >= 0),
  suggested_count integer not null default 0 check (suggested_count >= 0),
  exception_count integer not null default 0 check (exception_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  check (period_end is null or period_start is null or period_end >= period_start),
  unique (tenant_id, idempotency_key)
);

create table payments.reconciliation_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  bank_transaction_id uuid not null references payments.bank_transactions(id) on delete restrict,
  match_run_id uuid references payments.reconciliation_match_runs(id) on delete restrict,
  proposed_match_id uuid references payments.reconciliation_matches(id) on delete restrict,
  exception_code text not null check (exception_code in (
    'no_candidate','ambiguous_candidate','amount_mismatch','currency_mismatch','manual_review'
  )),
  status text not null default 'open' check (status in ('open','pending_approval','resolved','rejected')),
  candidate_snapshot jsonb not null default '[]'::jsonb,
  resolution_note text,
  requested_by uuid references auth.users(id) on delete restrict,
  requested_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (jsonb_typeof(candidate_snapshot) = 'array'),
  check (reviewed_by is null or requested_by is null or reviewed_by <> requested_by)
);

alter table payments.reconciliation_matches
  add column if not exists match_run_id uuid references payments.reconciliation_match_runs(id) on delete restrict,
  add column if not exists proposed_by uuid references auth.users(id) on delete restrict,
  add column if not exists reviewed_by uuid references auth.users(id) on delete restrict,
  add column if not exists reviewed_at timestamptz,
  add column if not exists proposal_key text;

create unique index reconciliation_matches_proposal_key_uidx
  on payments.reconciliation_matches (tenant_id, proposal_key)
  where proposal_key is not null;
create index reconciliation_match_runs_bank_account_idx on payments.reconciliation_match_runs(bank_account_id);
create index reconciliation_match_runs_created_by_idx on payments.reconciliation_match_runs(created_by);
create index reconciliation_match_runs_queue_idx on payments.reconciliation_match_runs(tenant_id, bank_account_id, created_at desc);
create index reconciliation_exceptions_transaction_idx on payments.reconciliation_exceptions(bank_transaction_id);
create index reconciliation_exceptions_run_idx on payments.reconciliation_exceptions(match_run_id);
create index reconciliation_exceptions_match_idx on payments.reconciliation_exceptions(proposed_match_id);
create index reconciliation_exceptions_requested_by_idx on payments.reconciliation_exceptions(requested_by);
create index reconciliation_exceptions_reviewed_by_idx on payments.reconciliation_exceptions(reviewed_by);
create index reconciliation_exceptions_queue_idx on payments.reconciliation_exceptions(tenant_id, status, created_at desc);
create index reconciliation_matches_match_run_idx on payments.reconciliation_matches(match_run_id);
create index reconciliation_matches_proposed_by_idx on payments.reconciliation_matches(proposed_by);
create index reconciliation_matches_reviewed_by_idx on payments.reconciliation_matches(reviewed_by);

alter table payments.reconciliation_match_runs enable row level security;
alter table payments.reconciliation_exceptions enable row level security;

create policy reconciliation_match_runs_context_read on payments.reconciliation_match_runs
for select to authenticated using (
  tenant_id = app_private.active_tenant_id()
  and exists (select 1 from payments.bank_accounts a where a.id = bank_account_id
    and (a.property_id is null or app_private.can_access_property(a.property_id)))
);
create policy reconciliation_exceptions_context_read on payments.reconciliation_exceptions
for select to authenticated using (
  tenant_id = app_private.active_tenant_id()
  and exists (
    select 1 from payments.bank_transactions bt
    join payments.bank_accounts a on a.id = bt.bank_account_id
    where bt.id = bank_transaction_id
      and (a.property_id is null or app_private.can_access_property(a.property_id))
  )
);

revoke all on payments.reconciliation_match_runs, payments.reconciliation_exceptions from public, anon, authenticated;
grant select on payments.reconciliation_match_runs, payments.reconciliation_exceptions to authenticated;
grant all on payments.reconciliation_match_runs, payments.reconciliation_exceptions to service_role;

create or replace function app_private.bank_reconciliation_actor_v1(p_context_id uuid, p_require_aal2 boolean default false)
returns table(tenant_id uuid, role_id uuid, role_code text)
language plpgsql stable security definer
set search_path = pg_catalog, identity
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_require_aal2 and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode='42501';
  end if;
  return query
  select g.tenant_id, m.role_id, r.code
  from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and lower(r.code) in ('association_admin','property_manager','president','censor')
    and exists (
      select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=m.role_id and rp.effect='allow' and p.code in ('payments.reconcile','payments.manage')
    );
  if not found then raise exception 'payment_permission_required' using errcode='42501'; end if;
end $$;
revoke all on function app_private.bank_reconciliation_actor_v1(uuid,boolean) from public, anon, authenticated;

create or replace function app_private.generate_bank_match_suggestions_internal_v1(
  p_context_id uuid, p_bank_account_id uuid, p_period_start date, p_period_end date, p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, payments, billing, identity, audit
as $$
declare
  v_actor record; v_run payments.reconciliation_match_runs; v_tx record;
  v_candidates jsonb; v_candidate_count integer; v_payment_id uuid; v_match_id uuid;
  v_scanned integer:=0; v_suggested integer:=0; v_exceptions integer:=0;
begin
  select * into v_actor from app_private.bank_reconciliation_actor_v1(p_context_id,true);
  if p_period_end < p_period_start then raise exception 'invalid_reconciliation_period' using errcode='22023'; end if;
  if length(trim(coalesce(p_idempotency_key,''))) < 8 then raise exception 'idempotency_key_required' using errcode='22023'; end if;
  if not exists(select 1 from payments.bank_accounts a where a.id=p_bank_account_id and a.tenant_id=v_actor.tenant_id)
    then raise exception 'bank_account_not_found' using errcode='22023'; end if;

  insert into payments.reconciliation_match_runs(tenant_id,bank_account_id,period_start,period_end,idempotency_key,status,created_by)
  values(v_actor.tenant_id,p_bank_account_id,p_period_start,p_period_end,p_idempotency_key,'running',auth.uid())
  on conflict(tenant_id,idempotency_key) do nothing returning * into v_run;
  if v_run.id is null then
    select * into v_run from payments.reconciliation_match_runs where tenant_id=v_actor.tenant_id and idempotency_key=p_idempotency_key;
    if (v_run.bank_account_id,v_run.period_start,v_run.period_end) is distinct from (p_bank_account_id,p_period_start,p_period_end)
      then raise exception 'idempotency_payload_mismatch' using errcode='23505'; end if;
    return jsonb_build_object('run_id',v_run.id,'status',v_run.status,'scanned_count',v_run.scanned_count,
      'suggested_count',v_run.suggested_count,'exception_count',v_run.exception_count,'idempotent_replay',true);
  end if;

  for v_tx in
    select bt.* from payments.bank_transactions bt
    where bt.tenant_id=v_actor.tenant_id and bt.bank_account_id=p_bank_account_id
      and bt.direction='credit' and bt.booked_on between p_period_start and p_period_end
      and not exists(select 1 from payments.reconciliation_matches rm where rm.bank_transaction_id=bt.id and rm.status='confirmed')
    order by bt.booked_on,bt.id for update
  loop
    v_scanned:=v_scanned+1;
    select count(*), (array_agg(p.id order by p.paid_at,p.id))[1], coalesce(jsonb_agg(jsonb_build_object(
      'payment_id',p.id,'amount',p.amount,'currency',p.currency,'paid_at',p.paid_at,
      'reference_match',coalesce(pi.client_reference,pi.provider_reference,p.provider_ref)
    ) order by p.paid_at,p.id),'[]'::jsonb)
    into v_candidate_count,v_payment_id,v_candidates
    from payments.payments p
    left join payments.payment_intents pi on pi.id=p.payment_intent_id and pi.tenant_id=p.tenant_id
    where p.tenant_id=v_actor.tenant_id and p.currency=v_tx.currency and p.amount=v_tx.amount
      and p.status='settled'
      and not exists(select 1 from payments.reconciliation_matches x where x.payment_id=p.id and x.status='confirmed')
      and (
        (pi.client_reference is not null and position(upper(pi.client_reference) in upper(coalesce(v_tx.remittance_text,'')))>0)
        or (pi.provider_reference is not null and pi.provider_reference=coalesce(v_tx.external_ref,''))
        or (p.provider_ref is not null and p.provider_ref=coalesce(v_tx.external_ref,''))
      );

    if v_candidate_count=1 then
      insert into payments.reconciliation_matches(tenant_id,bank_transaction_id,payment_id,matched_amount,confidence,status,
        rationale_json,match_run_id,proposed_by,proposal_key)
      values(v_actor.tenant_id,v_tx.id,v_payment_id,v_tx.amount,1.00000,'suggested',
        jsonb_build_object('rule','exact_reference_amount_currency','candidates',v_candidates),v_run.id,auth.uid(),
        'run:'||v_run.id::text||':tx:'||v_tx.id::text)
      on conflict do nothing returning id into v_match_id;
      if v_match_id is not null then v_suggested:=v_suggested+1; end if;
    else
      insert into payments.reconciliation_exceptions(tenant_id,bank_transaction_id,match_run_id,exception_code,candidate_snapshot)
      values(v_actor.tenant_id,v_tx.id,v_run.id,case when v_candidate_count=0 then 'no_candidate' else 'ambiguous_candidate' end,v_candidates);
      v_exceptions:=v_exceptions+1;
    end if;
  end loop;

  update payments.reconciliation_match_runs set status='completed',scanned_count=v_scanned,suggested_count=v_suggested,
    exception_count=v_exceptions,completed_at=statement_timestamp() where id=v_run.id;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'BANK_MATCH_ASSISTED_RUN','payments.reconciliation_match_run',v_run.id,
    jsonb_build_object('scanned',v_scanned,'suggested',v_suggested,'exceptions',v_exceptions),statement_timestamp());
  return jsonb_build_object('run_id',v_run.id,'status','completed','scanned_count',v_scanned,
    'suggested_count',v_suggested,'exception_count',v_exceptions,'idempotent_replay',false);
exception when others then
  if v_run.id is not null then update payments.reconciliation_match_runs set status='failed',completed_at=statement_timestamp() where id=v_run.id; end if;
  raise;
end $$;

create or replace function app_private.get_bank_matching_work_queue_internal_v1(
  p_context_id uuid,p_bank_account_id uuid default null,p_status text default null,p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, payments, identity
as $$
declare v_actor record; v_items jsonb; v_total bigint;
begin
  select * into v_actor from app_private.bank_reconciliation_actor_v1(p_context_id,false);
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;
  with queue as (
    select 'suggestion'::text item_type,rm.id,rm.bank_transaction_id,rm.status::text status,rm.matched_amount,
      rm.confidence,rm.payment_id,rm.receivable_id,rm.rationale_json details,rm.created_at
    from payments.reconciliation_matches rm join payments.bank_transactions bt on bt.id=rm.bank_transaction_id
    where rm.tenant_id=v_actor.tenant_id and rm.status='suggested'
      and (p_bank_account_id is null or bt.bank_account_id=p_bank_account_id)
    union all
    select 'exception',e.id,e.bank_transaction_id,e.status,null,null,null,null,
      jsonb_build_object('exception_code',e.exception_code,'candidates',e.candidate_snapshot,'resolution_note',e.resolution_note),e.created_at
    from payments.reconciliation_exceptions e join payments.bank_transactions bt on bt.id=e.bank_transaction_id
    where e.tenant_id=v_actor.tenant_id and e.status in ('open','pending_approval')
      and (p_bank_account_id is null or bt.bank_account_id=p_bank_account_id)
  ), filtered as (select * from queue where p_status is null or status=p_status), page as (
    select *,count(*) over() total_count from filtered order by created_at,id limit p_limit offset p_offset
  ) select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by created_at,id),'[]'::jsonb)
    into v_total,v_items from page;
  return jsonb_build_object('total',v_total,'items',v_items,'limit',p_limit,'offset',p_offset);
end $$;

create or replace function app_private.review_bank_match_suggestion_internal_v1(
  p_context_id uuid,p_match_id uuid,p_decision text,p_reason text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, payments, identity, audit
as $$
declare v_actor record; v_match payments.reconciliation_matches; v_tx payments.bank_transactions;
begin
  select * into v_actor from app_private.bank_reconciliation_actor_v1(p_context_id,true);
  if p_decision not in ('approve','reject') then raise exception 'invalid_review_decision' using errcode='22023'; end if;
  select * into v_match from payments.reconciliation_matches where id=p_match_id and tenant_id=v_actor.tenant_id for update;
  if not found then raise exception 'match_not_found' using errcode='22023'; end if;
  if v_match.status<>'suggested' then raise exception 'match_not_pending_review' using errcode='23505'; end if;
  if v_match.proposed_by=auth.uid() then raise exception 'dual_control_violation' using errcode='42501'; end if;
  select * into v_tx from payments.bank_transactions where id=v_match.bank_transaction_id and tenant_id=v_actor.tenant_id for update;
  if p_decision='approve' then
    update payments.reconciliation_matches set status='confirmed',confirmed_by=auth.uid(),confirmed_at=statement_timestamp(),
      reviewed_by=auth.uid(),reviewed_at=statement_timestamp(),rationale_json=rationale_json||jsonb_build_object('review_reason',p_reason)
      where id=p_match_id;
    update payments.reconciliation_exceptions set status='resolved',reviewed_by=auth.uid(),reviewed_at=statement_timestamp(),updated_at=statement_timestamp()
      where proposed_match_id=p_match_id and status='pending_approval';
  else
    update payments.reconciliation_matches set status='rejected',reviewed_by=auth.uid(),reviewed_at=statement_timestamp(),
      rationale_json=rationale_json||jsonb_build_object('review_reason',p_reason) where id=p_match_id;
    insert into payments.reconciliation_exceptions(tenant_id,bank_transaction_id,proposed_match_id,exception_code,status,
      candidate_snapshot,resolution_note,reviewed_by,reviewed_at)
    values(v_actor.tenant_id,v_match.bank_transaction_id,p_match_id,'manual_review','rejected','[]'::jsonb,p_reason,auth.uid(),statement_timestamp());
  end if;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'BANK_MATCH_'||upper(p_decision),'payments.reconciliation_match',p_match_id,
    jsonb_build_object('decision',p_decision,'reason',p_reason),statement_timestamp());
  return jsonb_build_object('match_id',p_match_id,'status',case when p_decision='approve' then 'confirmed' else 'rejected' end);
end $$;

create or replace function app_private.propose_bank_exception_resolution_internal_v1(
  p_context_id uuid,p_exception_id uuid,p_payment_id uuid default null,p_receivable_id uuid default null,
  p_matched_amount numeric default null,p_note text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, payments, billing, identity
as $$
declare v_actor record; v_exception payments.reconciliation_exceptions; v_tx payments.bank_transactions; v_match_id uuid; v_amount numeric;
begin
  select * into v_actor from app_private.bank_reconciliation_actor_v1(p_context_id,true);
  if p_payment_id is null and p_receivable_id is null then raise exception 'match_target_required' using errcode='22023'; end if;
  select * into v_exception from payments.reconciliation_exceptions where id=p_exception_id and tenant_id=v_actor.tenant_id for update;
  if not found then raise exception 'exception_not_found' using errcode='22023'; end if;
  if v_exception.status<>'open' then raise exception 'exception_not_open' using errcode='23505'; end if;
  select * into v_tx from payments.bank_transactions where id=v_exception.bank_transaction_id and tenant_id=v_actor.tenant_id for update;
  v_amount:=coalesce(p_matched_amount,v_tx.amount);
  if v_amount<=0 or v_amount>v_tx.amount then raise exception 'invalid_matched_amount' using errcode='22023'; end if;
  if p_payment_id is not null and not exists(select 1 from payments.payments p where p.id=p_payment_id and p.tenant_id=v_actor.tenant_id and p.currency=v_tx.currency)
    then raise exception 'payment_not_found_or_currency_mismatch' using errcode='22023'; end if;
  if p_receivable_id is not null and not exists(select 1 from billing.receivables r join billing.invoices i on i.id=r.invoice_id
      where r.id=p_receivable_id and r.tenant_id=v_actor.tenant_id and i.currency=v_tx.currency)
    then raise exception 'receivable_not_found_or_currency_mismatch' using errcode='22023'; end if;
  insert into payments.reconciliation_matches(tenant_id,bank_transaction_id,payment_id,receivable_id,matched_amount,confidence,status,
    rationale_json,proposed_by,proposal_key)
  values(v_actor.tenant_id,v_tx.id,p_payment_id,p_receivable_id,v_amount,0.50000,'suggested',
    jsonb_build_object('rule','manual_exception_resolution','note',p_note),auth.uid(),'exception:'||p_exception_id::text)
  returning id into v_match_id;
  update payments.reconciliation_exceptions set status='pending_approval',proposed_match_id=v_match_id,resolution_note=p_note,
    requested_by=auth.uid(),requested_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_exception_id;
  return jsonb_build_object('exception_id',p_exception_id,'match_id',v_match_id,'status','pending_approval');
end $$;

-- Replace the legacy direct-confirm path. Every new manual match is now a proposal.
create or replace function payments.match_bank_transaction(
  p_context_id uuid,p_bank_transaction_id uuid,p_payment_id uuid default null,p_receivable_id uuid default null,
  p_matched_amount numeric default null,p_notes text default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,payments,billing,identity,audit
as $$
declare v_actor record;v_tx payments.bank_transactions;v_amount numeric;v_match_id uuid;
begin
  select * into v_actor from app_private.bank_reconciliation_actor_v1(p_context_id,true);
  if p_payment_id is null and p_receivable_id is null then raise exception 'match_target_required' using errcode='22023'; end if;
  select * into v_tx from payments.bank_transactions where id=p_bank_transaction_id and tenant_id=v_actor.tenant_id for update;
  if not found then raise exception 'bank_transaction_not_found' using errcode='22023'; end if;
  if v_tx.direction<>'credit' then raise exception 'only_credit_transactions_can_be_reconciled' using errcode='22023'; end if;
  v_amount:=coalesce(p_matched_amount,v_tx.amount);
  if v_amount<=0 or v_amount>v_tx.amount then raise exception 'invalid_matched_amount' using errcode='22023'; end if;
  if p_payment_id is not null and not exists(select 1 from payments.payments p where p.id=p_payment_id and p.tenant_id=v_actor.tenant_id and p.currency=v_tx.currency)
    then raise exception 'payment_not_found_or_currency_mismatch' using errcode='22023'; end if;
  if p_receivable_id is not null and not exists(select 1 from billing.receivables r join billing.invoices i on i.id=r.invoice_id
      where r.id=p_receivable_id and r.tenant_id=v_actor.tenant_id and i.currency=v_tx.currency)
    then raise exception 'receivable_not_found_or_currency_mismatch' using errcode='22023'; end if;
  insert into payments.reconciliation_matches(tenant_id,bank_transaction_id,payment_id,receivable_id,matched_amount,confidence,status,
    rationale_json,proposed_by,proposal_key)
  values(v_actor.tenant_id,p_bank_transaction_id,p_payment_id,p_receivable_id,v_amount,1.00000,'suggested',
    jsonb_build_object('rule','manual_proposal','notes',p_notes),auth.uid(),
    'manual:'||p_bank_transaction_id::text||':'||coalesce(p_payment_id::text,'-')||':'||coalesce(p_receivable_id::text,'-'))
  returning id into v_match_id;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,occurred_at)
  values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'BANK_TRANSACTION_MATCH_PROPOSED','payments.reconciliation_match',v_match_id,
    jsonb_build_object('bank_transaction_id',p_bank_transaction_id,'payment_id',p_payment_id,'receivable_id',p_receivable_id,'matched_amount',v_amount),statement_timestamp());
  return jsonb_build_object('match_id',v_match_id,'bank_transaction_id',p_bank_transaction_id,'payment_id',p_payment_id,
    'receivable_id',p_receivable_id,'matched_amount',v_amount,'status','suggested','requires_independent_approval',true);
end $$;

create or replace function customer_api.generate_bank_match_suggestions_v1(
  p_context_id uuid,p_bank_account_id uuid,p_period_start date,p_period_end date,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select app_private.generate_bank_match_suggestions_internal_v1(p_context_id,p_bank_account_id,p_period_start,p_period_end,p_idempotency_key) $$;
create or replace function customer_api.get_bank_matching_work_queue_v1(
  p_context_id uuid,p_bank_account_id uuid default null,p_status text default null,p_limit integer default 50,p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$ select app_private.get_bank_matching_work_queue_internal_v1(p_context_id,p_bank_account_id,p_status,p_limit,p_offset) $$;
create or replace function customer_api.review_bank_match_suggestion_v1(
  p_context_id uuid,p_match_id uuid,p_decision text,p_reason text default null
) returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select app_private.review_bank_match_suggestion_internal_v1(p_context_id,p_match_id,p_decision,p_reason) $$;
create or replace function customer_api.propose_bank_exception_resolution_v1(
  p_context_id uuid,p_exception_id uuid,p_payment_id uuid default null,p_receivable_id uuid default null,
  p_matched_amount numeric default null,p_note text default null
) returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select app_private.propose_bank_exception_resolution_internal_v1(p_context_id,p_exception_id,p_payment_id,p_receivable_id,p_matched_amount,p_note) $$;

revoke all on function customer_api.generate_bank_match_suggestions_v1(uuid,uuid,date,date,text) from public,anon;
revoke all on function customer_api.get_bank_matching_work_queue_v1(uuid,uuid,text,integer,integer) from public,anon;
revoke all on function customer_api.review_bank_match_suggestion_v1(uuid,uuid,text,text) from public,anon;
revoke all on function customer_api.propose_bank_exception_resolution_v1(uuid,uuid,uuid,uuid,numeric,text) from public,anon;
grant execute on function customer_api.generate_bank_match_suggestions_v1(uuid,uuid,date,date,text) to authenticated,service_role;
grant execute on function customer_api.get_bank_matching_work_queue_v1(uuid,uuid,text,integer,integer) to authenticated,service_role;
grant execute on function customer_api.review_bank_match_suggestion_v1(uuid,uuid,text,text) to authenticated,service_role;
grant execute on function customer_api.propose_bank_exception_resolution_v1(uuid,uuid,uuid,uuid,numeric,text) to authenticated,service_role;

commit;
