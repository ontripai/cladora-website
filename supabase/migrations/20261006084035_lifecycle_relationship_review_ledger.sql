begin;

-- LC-C03 foundation: private evidence and independent review only. These rows
-- are not canonical title, leases, mandates, account links or access grants.
create table portfolio.relationship_proposals (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict,
 customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
 kind text not null check(kind in ('contractual_buyer','ownership_transfer','lease')),
 source_party_id uuid references portfolio.parties(id) on delete restrict,
 target_party_id uuid not null references portfolio.parties(id) on delete restrict,
 effective_from date not null,
 effective_to date,
 evidence_reference text not null check(length(btrim(evidence_reference)) between 15 and 500),
 reason text not null check(length(btrim(reason)) between 8 and 500),
 proposed_by uuid not null references auth.users(id) on delete restrict,
 proposed_at timestamptz not null default statement_timestamp(),
 check(effective_to is null or effective_to>effective_from),
 check(source_party_id is null or source_party_id<>target_party_id),
 check(kind='contractual_buyer' or source_party_id is not null)
);
create index relationship_proposals_subject_idx
 on portfolio.relationship_proposals(tenant_id,unit_id,proposed_at desc);
create index relationship_proposals_workspace_idx
 on portfolio.relationship_proposals(customer_workspace_id,proposed_at desc);
create index relationship_proposals_property_idx on portfolio.relationship_proposals(property_id);
create index relationship_proposals_unit_idx on portfolio.relationship_proposals(unit_id);
create index relationship_proposals_source_party_idx on portfolio.relationship_proposals(source_party_id);
create index relationship_proposals_target_party_idx on portfolio.relationship_proposals(target_party_id);
create index relationship_proposals_proposed_by_idx on portfolio.relationship_proposals(proposed_by);

create table portfolio.relationship_reviews (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique references portfolio.relationship_proposals(id) on delete restrict,
 tenant_id uuid not null references platform.tenants(id) on delete restrict,
 decision text not null check(decision in ('verified','rejected')),
 evidence_reference text not null check(length(btrim(evidence_reference)) between 15 and 500),
 reason text not null check(length(btrim(reason)) between 8 and 500),
 reviewed_by uuid not null references auth.users(id) on delete restrict,
 reviewed_at timestamptz not null default statement_timestamp()
);
create index relationship_reviews_tenant_idx on portfolio.relationship_reviews(tenant_id,reviewed_at desc);
create index relationship_reviews_reviewed_by_idx on portfolio.relationship_reviews(reviewed_by);

create function app_private.guard_relationship_proposal_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_unit record;
begin
 if tg_op<>'INSERT' then
  raise exception 'relationship_proposal_immutable' using errcode='42501';
 end if;
 select u.tenant_id,b.property_id,p.tenant_id as property_tenant
 into v_unit from portfolio.units u
 join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 join portfolio.properties p on p.id=b.property_id
 where u.id=new.unit_id;
 if not found or v_unit.tenant_id is distinct from new.tenant_id
   or v_unit.property_id is distinct from new.property_id
   or v_unit.property_tenant is distinct from new.tenant_id
   or not exists(select 1 from platform.customer_workspaces w
    where w.id=new.customer_workspace_id and w.tenant_id=new.tenant_id)
   or not exists(select 1 from portfolio.parties p
    where p.id=new.target_party_id and p.tenant_id=new.tenant_id)
   or (new.source_party_id is not null and not exists(select 1 from portfolio.parties p
    where p.id=new.source_party_id and p.tenant_id=new.tenant_id)) then
  raise exception 'relationship_proposal_subject_mismatch' using errcode='42501';
 end if;
 return new;
end;$$;
create trigger guard_relationship_proposal
 before insert or update or delete on portfolio.relationship_proposals
 for each row execute function app_private.guard_relationship_proposal_v1();

create function app_private.guard_relationship_review_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_proposal record;
begin
 if tg_op<>'INSERT' then
  raise exception 'relationship_review_immutable' using errcode='42501';
 end if;
 select tenant_id,proposed_by into v_proposal
 from portfolio.relationship_proposals where id=new.proposal_id;
 if not found or new.tenant_id is distinct from v_proposal.tenant_id
   or new.reviewed_by=v_proposal.proposed_by then
  raise exception 'relationship_review_independence_required' using errcode='42501';
 end if;
 return new;
end;$$;
create trigger guard_relationship_review
 before insert or update or delete on portfolio.relationship_reviews
 for each row execute function app_private.guard_relationship_review_v1();

alter table portfolio.relationship_proposals enable row level security;
alter table portfolio.relationship_reviews enable row level security;
revoke all on portfolio.relationship_proposals,portfolio.relationship_reviews
 from public,anon,authenticated,service_role;
revoke all on function app_private.guard_relationship_proposal_v1(),
 app_private.guard_relationship_review_v1() from public,anon,authenticated,service_role;
comment on table portfolio.relationship_proposals is
 'Private LC-C03 proposed relationship evidence. No customer execution or legal/access effect; a reviewed transition command is separate.';
comment on table portfolio.relationship_reviews is
 'Private independent, immutable review. Verification does not itself mutate canonical ownership or lease.';
commit;
