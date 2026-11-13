-- V2 complete fresh-schema candidate; REPLACES v1 source proposal, DO NOT stack.
-- Existing installed/history requires a separate reviewed ALTER, never DROP/backfill.
-- INACTIVE DOMAIN SOURCE ONLY. Not a migration or installer. No adoption grant.
-- Platform/Core review must supply effective role/RLS/ACL and writer admission.
begin;
do $$ begin
  raise exception 'AIRPROP_LISTING_SELECTED_BINDING_ADOPTION_REQUIRED' using errcode='55000';
end $$;

create table airprop.listing_selected_bindings_v1 (
 tenant_id uuid not null,
 workspace_id uuid not null,
 -- Context is a canonical server-resolved selection, not a platform.contexts table.
 context_id uuid not null,
 listing_id uuid not null,
 listing_version integer not null check(listing_version>0),
 binding jsonb not null check(pg_catalog.jsonb_typeof(binding)='object'),
 unit_id uuid generated always as ((binding#>>'{selection,unit_id}')::uuid) stored not null,
 party_id uuid generated always as ((binding#>>'{selection,party_id}')::uuid) stored not null,
 spec_id uuid generated always as ((binding->>'spec_id')::uuid) stored not null,
 spec_version integer generated always as ((binding->>'spec_version')::integer) stored not null,
 primary key(listing_id,listing_version),
 foreign key(listing_id,tenant_id,workspace_id)
   references airprop.market_listings(id,tenant_id,workspace_id) on delete restrict,
 foreign key(spec_id) references portfolio.unit_specification_versions(id) on delete restrict,
 foreign key(party_id) references portfolio.parties(id) on delete restrict,
 foreign key(unit_id,spec_version) references portfolio.unit_specification_versions(unit_id,version) on delete restrict,
 check(((binding->>'tenant_id')::uuid=tenant_id and (binding->>'workspace_id')::uuid=workspace_id
   and (binding->>'context_id')::uuid=context_id
   and (binding#>>'{selection,listing_id}')::uuid=listing_id
   and (binding#>>'{selection,listing_version}')::integer=listing_version
   and (binding#>>'{selection,resource_id}')::uuid=unit_id
   and binding#>>'{selection,resource_type}'='unit'
   and (binding#>>'{selection,resource_version}')::integer=spec_version) is true),
 check((binding ?& array['actor_id','command_id','transaction_id','command_key','wire_sha256','selection'])
   and (binding->'selection') ?& array['party_id','party_kind','relationship_id','relationship_version','relationship_kind']),
 check(((binding#>>'{selection,party_kind}') in ('person','company')
   and (binding#>>'{selection,relationship_kind}') in ('ownership','management','representation')
   and (binding#>>'{selection,relationship_id}')::uuid is not null
   and (binding#>>'{selection,relationship_version}')::bigint>0
   and (binding->>'actor_id')::uuid is not null and (binding->>'command_id')::uuid is not null
   and (binding->>'transaction_id')::uuid is not null
   and (binding->>'wire_sha256') ~ '^[a-f0-9]{64}$'
   and (binding->>'command_key') ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$') is true),
 check((binding->'binding_version'='2'::jsonb
   and binding#>'{selection,source_versions,version}'='2'::jsonb
   and (binding#>>'{selection,source_versions,specification_id}')::uuid=spec_id
   and (binding#>>'{selection,source_versions,resource_version}')::integer=spec_version
   and pg_catalog.jsonb_typeof(binding#>'{selection,source_versions,party_version}')='number'
   and (binding#>>'{selection,source_versions,party_version}')::bigint between 1 and 9007199254740991
   and (binding#>>'{selection,source_versions,relationship_version}')::bigint=(binding#>>'{selection,relationship_version}')::bigint
   and (binding#>'{selection,source_versions}')-array['version','specification_id','resource_version','party_version','relationship_version']='{}'::jsonb) is true),
 check(binding-array['binding_version','tenant_id','workspace_id','context_id','actor_id','selection','spec_id','spec_version',
   'command_id','transaction_id','command_key','wire_sha256']='{}'::jsonb),
 check((binding->'selection')-array['listing_id','listing_version','property_id','unit_id','resource_id','resource_version',
   'resource_type','party_id','party_kind','relationship_id','relationship_version','relationship_kind','source_versions']='{}'::jsonb)
);
create unique index listing_selected_binding_command_v1
 on airprop.listing_selected_bindings_v1(tenant_id,workspace_id,
   ((binding->>'actor_id')::uuid),(binding->>'command_key'));
create unique index listing_selected_binding_command_id_v1
 on airprop.listing_selected_bindings_v1(((binding->>'command_id')::uuid));
-- This is immutable reference history, not an ownership/mandate registry or allow.
-- No backfill: a historical row without a binding is NOT a current Party selection.
create function airprop.guard_listing_selected_binding_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if tg_op<>'INSERT' then
   raise exception 'listing_selected_binding_immutable' using errcode='42501';
 end if;
 if auth.uid() is null or (new.binding->>'actor_id')::uuid is distinct from auth.uid()
   or new.context_id is distinct from app_private.active_context_id()
   or new.tenant_id is distinct from app_private.active_tenant_id() then
   raise exception 'listing_selected_binding_scope' using errcode='42501';
 end if;
 perform 1 from airprop.market_listings l
   join portfolio.unit_specification_versions s on s.id=new.spec_id and s.tenant_id=l.tenant_id
   join portfolio.parties p on p.id=new.party_id and p.tenant_id=l.tenant_id
   where l.id=new.listing_id and l.tenant_id=new.tenant_id and l.workspace_id=new.workspace_id
     and l.version=new.listing_version and l.unit_id=new.unit_id
     and l.property_id=(new.binding#>>'{selection,property_id}')::uuid
     and s.unit_id=new.unit_id and s.version=new.spec_version
     and p.native_revision_v1=(new.binding#>>'{selection,source_versions,party_version}')::bigint;
 if not found then
   raise exception 'listing_selected_binding_subject' using errcode='23514';
 end if;
 return new;
end $$;
create trigger listing_selected_binding_immutable_v1
 after insert or update or delete on airprop.listing_selected_bindings_v1
 for each row execute function airprop.guard_listing_selected_binding_v1();
create trigger listing_selected_binding_no_truncate_v1
 before truncate on airprop.listing_selected_bindings_v1
 for each statement execute function airprop.guard_listing_selected_binding_v1();
-- The host writes its REAL receipt only after mutate returns. Verify at settlement,
-- without generating a receipt or changing the canonical Core ledger/schema.
create function airprop.assert_listing_selected_binding_c03_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 perform 1 from platform.idempotency_keys k
   join audit.events a on a.id=(k.response_ref->>'audit_event_id')::bigint
   join platform.outbox_events o on o.id=(k.response_ref->>'outbox_event_id')::uuid
   where k.tenant_id=new.tenant_id and k.actor_id=(new.binding->>'actor_id')::uuid
     and k.key='core-tx.v1:'||new.workspace_id::text||':'||(new.binding->>'command_key')
     and k.status_code=200
     -- xmin is xid32; txid_current includes the epoch. Require this transaction's
     -- ledger write, not an old receipt offered to backfill a historical binding.
     and k.xmin::text=(pg_catalog.txid_current()%4294967296)::text
     and k.response_ref->>'contract_version' in ('core-transaction-receipt.v1','core-transaction-receipt.v2')
     and (k.response_ref->>'receipt_id')::uuid is not null
     and (k.response_ref->>'command_id')::uuid=(new.binding->>'command_id')::uuid
     and (k.response_ref->>'transaction_id')::uuid=(new.binding->>'transaction_id')::uuid
     and (k.response_ref->>'workspace_id')::uuid=new.workspace_id
     and (k.response_ref->>'actor_id')::uuid=(new.binding->>'actor_id')::uuid
     and (k.response_ref->>'mutation_id')::uuid=new.listing_id
     and k.response_ref->>'aggregate_type'='portfolio.unit'
     and (k.response_ref->>'aggregate_id')::uuid=new.unit_id
     and k.response_ref->>'input_fingerprint'='sha256:'||(new.binding->>'wire_sha256')
     and k.response_ref->>'idempotency_key'=new.binding->>'command_key'
     and k.response_ref#>>'{authority,decision}'='allowed'
     and (k.response_ref#>>'{authority,context_id}')::uuid=new.context_id
     and k.response_ref#>>'{authority,permission_code}'='airprop.opportunity.manage'
     and k.response_ref#>>'{authority,module_code}'='airprop_commercial'
     and a.tenant_id=new.tenant_id and a.actor_id=k.actor_id
     and a.request_id=(new.binding->>'command_id')::uuid
     and (a.after_snapshot->>'receipt_id')::uuid=(k.response_ref->>'receipt_id')::uuid
     and (a.after_snapshot->>'mutation_id')::uuid=new.listing_id
     and o.tenant_id=new.tenant_id and o.aggregate_type='portfolio.unit' and o.aggregate_id=new.unit_id
     and o.trace_id=(new.binding->>'command_id')::uuid
     and (o.payload->>'receipt_id')::uuid=(k.response_ref->>'receipt_id')::uuid
     and (o.payload->>'mutation_id')::uuid=new.listing_id;
 if not found then
   raise exception 'listing_selected_binding_core_receipt_required' using errcode='23514';
 end if;
 return null;
end $$;
create constraint trigger listing_selected_binding_c03_v1
 after insert on airprop.listing_selected_bindings_v1
 deferrable initially deferred for each row
 execute function airprop.assert_listing_selected_binding_c03_v1();
alter table airprop.listing_selected_bindings_v1 enable row level security;
alter table airprop.listing_selected_bindings_v1 force row level security;
revoke all on airprop.listing_selected_bindings_v1 from public,anon,authenticated,service_role;
revoke all on function airprop.guard_listing_selected_binding_v1() from public,anon,authenticated,service_role;
revoke all on function airprop.assert_listing_selected_binding_c03_v1() from public,anon,authenticated,service_role;
-- No policy, owner change, activation grant or default-ACL mutation. Adoption OPEN.
commit;
