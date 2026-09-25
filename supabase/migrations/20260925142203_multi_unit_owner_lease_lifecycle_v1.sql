begin;

alter table public.owner_private_leases add column activated_at timestamptz, add column closed_at timestamptz;
alter table public.owner_private_leases add constraint owner_private_lease_identity unique(id,owner_user_id,unit_id);
alter table public.owner_private_cash_entries add column lease_id uuid;
alter table public.owner_private_cash_entries add constraint owner_private_cash_lease_fk
  foreign key(lease_id,owner_user_id,unit_id) references public.owner_private_leases(id,owner_user_id,unit_id) on delete restrict;
create index owner_private_cash_lease_idx on public.owner_private_cash_entries(owner_user_id,lease_id,due_on)
  where lease_id is not null;
alter table public.owner_private_cash_entries add constraint rent_lease_entry_check
  check(lease_id is null or (kind='rent' and direction='income' and due_on is not null and paid_on is not null));

-- Once active, the agreed amount, currency, dates and tenant name cannot be
-- silently rewritten. The owner can end a lease and create a new draft.
create function app_private.guard_owner_private_lease_lifecycle_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if old.status='draft' and new.status='active' then
    new.activated_at=statement_timestamp();
  elsif old.status='draft' and new.status='cancelled' then
    new.closed_at=statement_timestamp();
  elsif old.status='active' and new.status='ended' then
    new.closed_at=statement_timestamp();
  elsif old.status<>new.status or old.status in ('ended','cancelled') then
    raise exception 'invalid_lease_transition' using errcode='23514';
  end if;
  if old.status<>'draft' and (new.tenant_label,new.starts_on,new.ends_on,new.monthly_rent,new.currency,new.unit_id,new.owner_user_id)
    is distinct from (old.tenant_label,old.starts_on,old.ends_on,old.monthly_rent,old.currency,old.unit_id,old.owner_user_id) then
    raise exception 'active_lease_terms_immutable' using errcode='23514';
  end if;
  if (old.status<>'draft' and new.activated_at is distinct from old.activated_at)
    or (old.status=new.status and new.closed_at is distinct from old.closed_at) then
    raise exception 'lease_audit_immutable' using errcode='23514';
  end if;
  if new.status='active' and new.ends_on is not null and new.ends_on<current_date then
    raise exception 'lease_already_expired' using errcode='23514';
  end if;
  return new;
end $$;
create trigger owner_private_lease_lifecycle before update on public.owner_private_leases
  for each row execute function app_private.guard_owner_private_lease_lifecycle_v1();
revoke all on function app_private.guard_owner_private_lease_lifecycle_v1() from public;

-- Only a self-reported payment may be linked to a lease. It is not a bank
-- settlement and never changes the canonical invoice/receivable balance.
commit;
