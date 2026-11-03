-- CORE-MOBILE-PAYMENT-SERVER-PROOF-02. Run only on the authorized disposable stack.
begin;
select plan(113);

create temp table core_mobile_users(slot integer primary key, user_id uuid not null);
insert into auth.users(id,email) select
  ('c2110000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'core-mobile-' || n || '@fixture.invalid' from generate_series(1,3) n;
insert into core_mobile_users select n,
  ('c2110000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,3) n;

-- CORE_MOBILE_FIXTURE_BEGIN: reused verbatim by the local connected harness.
-- Canonical synthetic rows follow tests 066/067; existing global owner role and
-- permissions are required. Never create a role, permission, role grant or module.
create function pg_temp.core_mobile_id(n integer) returns uuid language sql immutable
as $$ select ('c2110000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid $$;
do $$ begin
  if exists(select 1 from platform.tenants where id in (pg_temp.core_mobile_id(10),pg_temp.core_mobile_id(20))) then
    raise exception 'core_mobile_fixture_collision';
  end if;
  if (select count(distinct p.code) from identity.roles r
      join identity.role_permissions rp on rp.role_id=r.id and rp.effect='allow'
      join identity.permissions p on p.id=rp.permission_id
      where r.tenant_id is null and r.code='owner'
        and p.code in ('payments.intents.create','payments.intents.read')) <> 2 then
    raise exception 'canonical_owner_payment_permissions_missing';
  end if;
end $$;
insert into platform.tenants(id,legal_name,registration_number,status) values
  (pg_temp.core_mobile_id(10),'Core mobile synthetic A','CORE-MOBILE-211-A','active'),
  (pg_temp.core_mobile_id(20),'Core mobile synthetic B','CORE-MOBILE-211-B','active');
insert into portfolio.properties(id,tenant_id,type,name,status)
select pg_temp.core_mobile_id(n+20),pg_temp.core_mobile_id(n),'condominium','Core mobile synthetic','active'
from unnest(array[10,20]) n;
insert into portfolio.buildings(id,tenant_id,property_id,code,name)
select pg_temp.core_mobile_id(n+30),pg_temp.core_mobile_id(n),pg_temp.core_mobile_id(n+20),'A','Synthetic'
from unnest(array[10,20]) n;
insert into portfolio.units(id,tenant_id,building_id,code) values
  (pg_temp.core_mobile_id(51),pg_temp.core_mobile_id(10),pg_temp.core_mobile_id(40),'A-1'),
  (pg_temp.core_mobile_id(52),pg_temp.core_mobile_id(10),pg_temp.core_mobile_id(40),'A-2'),
  (pg_temp.core_mobile_id(53),pg_temp.core_mobile_id(20),pg_temp.core_mobile_id(50),'B-1');
insert into public.owner_private_units(id,owner_user_id,building_label,unit_label,address_text)
select pg_temp.core_mobile_id(55),user_id,'Private synthetic','Private-1','Private synthetic address'
from core_mobile_users where slot=1;
insert into portfolio.parties(id,tenant_id,type,legal_name)
select pg_temp.core_mobile_id(80+slot),pg_temp.core_mobile_id(case when slot=3 then 20 else 10 end),
 'person','Synthetic payer' from core_mobile_users;
insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from)
select pg_temp.core_mobile_id(case when slot=3 then 20 else 10 end),pg_temp.core_mobile_id(50+slot),
 pg_temp.core_mobile_id(80+slot),1,current_date-1 from core_mobile_users;
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select pg_temp.core_mobile_id(90+slot),pg_temp.core_mobile_id(case when slot=3 then 20 else 10 end),
 u.user_id,r.id,'active',statement_timestamp()-interval '1 day'
from core_mobile_users u cross join identity.roles r where r.tenant_id is null and r.code='owner';
insert into identity.membership_parties(membership_id,party_id,tenant_id)
select pg_temp.core_mobile_id(90+slot),pg_temp.core_mobile_id(80+slot),
 pg_temp.core_mobile_id(case when slot=3 then 20 else 10 end) from core_mobile_users;
insert into identity.context_grants(id,membership_id,tenant_id,scope_type,unit_id,starts_at)
select pg_temp.core_mobile_id(100+slot),pg_temp.core_mobile_id(90+slot),
 pg_temp.core_mobile_id(case when slot=3 then 20 else 10 end),'unit',pg_temp.core_mobile_id(50+slot),
 statement_timestamp()-interval '1 day' from core_mobile_users;
insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner)
select pg_temp.core_mobile_id(n+150),pg_temp.core_mobile_id(n),'ASSOCIATION','ACTIVE','Synthetic'
from unnest(array[10,20]) n;
-- Established module.payments fixture entitlement from test 067; local-only data.
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
select pg_temp.core_mobile_id(n+150),'module.payments','boolean',true,statement_timestamp()-interval '1 day'
from unnest(array[10,20]) n;
insert into payments.payment_allocation_policies(tenant_id,version,strategy,penalties_priority,allow_payer_selection,min_partial_amount)
select pg_temp.core_mobile_id(n),1,'oldest_due_first','principal_first',true,1
from unnest(array[10,20]) n;
-- Test-only beneficiary configuration as in 066, with a synthetic checksum-valid
-- IBAN held in disposable Vault. This is not a production approval or bank action.
insert into payments.bank_accounts(id,tenant_id,property_id,bank_name,iban_encrypted,iban_fingerprint,currency)
select pg_temp.core_mobile_id(n+170),pg_temp.core_mobile_id(n),pg_temp.core_mobile_id(n+20),
 'Synthetic bank','synthetic-not-a-bank-secret',encode(extensions.digest('RO37BTRL0000000000000001','sha256'),'hex'),'RON'
from unnest(array[10,20]) n;
insert into payments.beneficiary_accounts(id,tenant_id,property_id,association_legal_name,bank_account_id,bank_name,currency,masked_iban,iban_fingerprint,status)
select pg_temp.core_mobile_id(n+190),pg_temp.core_mobile_id(n),pg_temp.core_mobile_id(n+20),'Synthetic association',
 pg_temp.core_mobile_id(n+170),'Synthetic bank','RON','RO37****0001',
 encode(extensions.digest('RO37BTRL0000000000000001','sha256'),'hex'),'active'
from unnest(array[10,20]) n;
insert into payments.beneficiary_iban_secrets(beneficiary_id,tenant_id,vault_secret_id)
select pg_temp.core_mobile_id(n+190),pg_temp.core_mobile_id(n),
 vault.create_secret('RO37BTRL0000000000000001','core_mobile_211_'||n,'Disposable test 211 only')
from unnest(array[10,20]) n;
insert into billing.invoices(id,tenant_id,property_id,unit_id,liable_party_id,period_start,period_end,issued_on,due_on,subtotal,tax_total,status)
select pg_temp.core_mobile_id(70+slot),pg_temp.core_mobile_id(case when slot=3 then 20 else 10 end),
 pg_temp.core_mobile_id(case when slot=3 then 40 else 30 end),pg_temp.core_mobile_id(50+slot),pg_temp.core_mobile_id(80+slot),
 current_date-30,current_date,current_date,current_date+10,200,0,'issued' from core_mobile_users;
insert into billing.invoices(id,tenant_id,property_id,unit_id,liable_party_id,period_start,period_end,issued_on,due_on,subtotal,tax_total,status)
select pg_temp.core_mobile_id(74),tenant_id,property_id,unit_id,liable_party_id,period_start,period_end,issued_on,due_on,200,0,'issued'
from billing.invoices where id=pg_temp.core_mobile_id(71);
insert into billing.receivables(tenant_id,invoice_id,original_amount,paid_amount,credited_amount)
select tenant_id,id,200,0,0 from billing.invoices where id in
 (pg_temp.core_mobile_id(71),pg_temp.core_mobile_id(72),pg_temp.core_mobile_id(73),pg_temp.core_mobile_id(74));
-- CORE_MOBILE_FIXTURE_END

create temp table core_mobile_result(name text primary key, data jsonb);
grant select,insert on core_mobile_result to authenticated;
create function pg_temp.core_mobile_create(k text, inv integer default 71, allocation numeric default 10,
 method text default 'bank_transfer', amount numeric default 10, unit_no integer default 51,
 currency text default 'RON', ctx integer default 101) returns jsonb language sql as $$
 select customer_api.create_payment_intent_v1(pg_temp.core_mobile_id(ctx),pg_temp.core_mobile_id(unit_no),
 jsonb_build_array(jsonb_build_object('invoice_id',pg_temp.core_mobile_id(inv),'amount',allocation)),amount,currency,method,k)
$$;
create function pg_temp.core_mobile_intent() returns uuid language sql as $$
 select (data->>'payment_intent_id')::uuid from core_mobile_result where name='first'
$$;
create temp table core_mobile_financial_before as select
 (select count(*) from payments.payments) as payments,
 (select count(*) from payments.settlements) as settlements,
 (select count(*) from finance.journals) as journals,
 (select sum(paid_amount) from billing.receivables) as paid,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.payments t) as payment_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.settlements t) as settlement_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from finance.journals t) as journal_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from billing.receivables t) as receivable_hash,
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from public.owner_private_units t) as private_hash;

set local role authenticated;
set local row_security=on;
select set_config('request.jwt.claims','{"sub":"c2110000-0000-4000-8000-000000000001","aal":"aal2"}',true);
-- R1: this is an authenticated DATABASE-session regression with minimal claims,
-- not a signed Auth token. The HTTP harness separately verifies genuine tokens.
-- Never add selected-tenant/context claims to make these positives pass.
select is(current_user::text,'authenticated','R1 uses the actual authenticated database role');
select is(current_setting('row_security'),'on','R1 leaves row security enabled');
select ok(not (auth.jwt() ?| array['active_tenant_id','active_context_id','active_membership_id']),
 'R1 minimal session has no selected-tenant/context/membership claims');
select ok(row_security_active('portfolio.units'::regclass)
 and row_security_active('portfolio.buildings'::regclass)
 and row_security_active('identity.memberships'::regclass)
 and row_security_active('identity.context_grants'::regclass),
 'R1 authenticated reads are actually subject to native RLS');
select is((select count(*)::integer from portfolio.units where id=pg_temp.core_mobile_id(51)),0,
 'R1 native Unit row stays hidden without selected claims; no broad read policy added');
select is((select count(*)::integer from identity.memberships where id=pg_temp.core_mobile_id(91)),0,
 'R1 membership row stays hidden to the minimal invoker');
select is((select count(*)::integer from identity.context_grants where id=pg_temp.core_mobile_id(101)),0,
 'R1 Context row stays hidden to the minimal invoker');
select is((select count(*)::integer from portfolio.buildings where id=pg_temp.core_mobile_id(40)),0,
 'R2 native Building stays RLS withheld');
insert into core_mobile_result values('first',pg_temp.core_mobile_create('core-mobile-exact-211'));
select is((pg_temp.core_mobile_create('core-mobile-exact-211')->>'payment_intent_id')::uuid,
 pg_temp.core_mobile_intent(),'exact replay returns same ID');
select ok((pg_temp.core_mobile_create('core-mobile-exact-211')->>'is_idempotent_replay')::boolean,'replay is explicit');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',74)$$,'23505','payment_idempotency_conflict','changed invoice conflicts');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',71,9)$$,'23505','payment_idempotency_conflict','changed allocation conflicts');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',71,10,'card')$$,'23505','payment_idempotency_conflict','changed method conflicts');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',71,10,'bank_transfer',11)$$,'23505','payment_idempotency_conflict','changed total conflicts');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',71,10,'bank_transfer',10,51,'EUR')$$,'23505','payment_idempotency_conflict','changed currency conflicts');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',72,10,'bank_transfer',10,52)$$,'42501','payment_unit_access_denied','foreign Unit is authority denial, not fingerprint conflict');
-- Deliberately retain these positive expectations. A false denial is a FAIL,
-- not grounds to mint claims, disable RLS or invert the assertion.
select lives_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,
 'R1 legitimate owner GET must succeed with authenticated/minimal claims/RLS');
select lives_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,
 'R1 legitimate owner instruction must succeed with authenticated/minimal claims/RLS');
-- Direct helper, wrapper and instruction are distinct probes above/below.
select lives_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,
 'R2 direct helper succeeds under authenticated/minimal claims/RLS');
select is(app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent()),
 customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent()),'thin GET returns exactly the reader projection');
select results_eq($$select jsonb_object_keys(app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())) order by 1$$,
 $$select unnest(array['payment_intent_id','tenant_id','property_id','unit_id','amount','currency','status','payment_method',
 'client_reference','beneficiary','allocation_policy','selected_invoices','expires_at','created_at','settled_at']) order by 1$$,
 'R2 exact existing GET key allowlist');
select ok(app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())::text
 !~ 'configuration_snapshot|request_identity|RO37BTRL0000000000000001|vault_secret|decrypted_secret',
 'R2 GET projection contains no request internals or full IBAN/Vault secret');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',71,10,'bank_transfer',10,55)$$,'42501','payment_unit_access_denied','private Unit cannot be treated as official Unit');
insert into core_mobile_result values('ordered', customer_api.create_payment_intent_v1(
 pg_temp.core_mobile_id(101),pg_temp.core_mobile_id(51),
 jsonb_build_array(jsonb_build_object('invoice_id',pg_temp.core_mobile_id(71),'amount',5),
                  jsonb_build_object('invoice_id',pg_temp.core_mobile_id(74),'amount',5)),
 10,'RON','bank_transfer','core-mobile-order-211'));
select is(customer_api.create_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_id(51),
 jsonb_build_array(jsonb_build_object('invoice_id',pg_temp.core_mobile_id(74),'amount',5),
                  jsonb_build_object('invoice_id',pg_temp.core_mobile_id(71),'amount',5)),
 10,'RON','bank_transfer','core-mobile-order-211')->>'payment_intent_id',
 (select data->>'payment_intent_id' from core_mobile_result where name='ordered'),'selection reordering is exact semantic replay');
select throws_ok($$select customer_api.create_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_id(51),
 jsonb_build_array(jsonb_build_object('invoice_id',pg_temp.core_mobile_id(71),'amount',5),
                  jsonb_build_object('invoice_id',pg_temp.core_mobile_id(74),'amount',5),
                  jsonb_build_object('invoice_id',pg_temp.core_mobile_id(74),'amount',5)),
 10,'RON','bank_transfer','core-mobile-order-211')$$,'23505','payment_idempotency_conflict','duplicate selection is material');
insert into core_mobile_result values('precision',pg_temp.core_mobile_create('core-mobile-precision-211',71,10,'bank_transfer',10.001));
select is(pg_temp.core_mobile_create('core-mobile-precision-211',71,10,'bank_transfer',10.001)->>'payment_intent_id',
 (select data->>'payment_intent_id' from core_mobile_result where name='precision'),'request identity survives numeric column rounding');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-precision-211',71,10,'bank_transfer',10.004)$$,
 '23505','payment_idempotency_conflict','distinct raw totals conflict even when persisted cents would match');
reset role;

savepoint before_scope;
update identity.context_grants set unit_id=pg_temp.core_mobile_id(52) where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',72,10,'bank_transfer',10,52)$$,'23505','payment_idempotency_conflict','changed authorized Unit still conflicts on same key');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','narrowed Context cannot read historic Unit');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','narrowed Context cannot read historic Unit');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','direct helper: narrowed Context cannot read historic Unit');
reset role;
rollback to before_scope;

savepoint r2_native_scope;
update identity.context_grants set scope_type='tenant',property_id=null,building_id=null,unit_id=null where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select lives_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'app_private.read_payment_intent_scoped_v1 accepts canonical tenant ceiling for own intent');
select lives_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'customer_api.get_payment_intent_v1 accepts canonical tenant ceiling for own intent');
select lives_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'customer_api.generate_bank_instruction_v1 accepts canonical tenant ceiling for own intent');
reset role;
rollback to r2_native_scope;
savepoint r2_native_scope;
update identity.context_grants set scope_type='property',property_id=pg_temp.core_mobile_id(30),building_id=null,unit_id=null where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select lives_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'app_private.read_payment_intent_scoped_v1 accepts canonical property ceiling for own intent');
select lives_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'customer_api.get_payment_intent_v1 accepts canonical property ceiling for own intent');
select lives_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'customer_api.generate_bank_instruction_v1 accepts canonical property ceiling for own intent');
reset role;
rollback to r2_native_scope;
savepoint r2_native_scope;
update identity.context_grants set scope_type='building',property_id=null,building_id=pg_temp.core_mobile_id(40),unit_id=null where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select lives_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'app_private.read_payment_intent_scoped_v1 accepts canonical building ceiling for own intent');
select lives_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'customer_api.get_payment_intent_v1 accepts canonical building ceiling for own intent');
select lives_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'customer_api.generate_bank_instruction_v1 accepts canonical building ceiling for own intent');
reset role;
rollback to r2_native_scope;

savepoint r2_hierarchy;
update identity.context_grants set building_id=pg_temp.core_mobile_id(50) where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','app_private.read_payment_intent_scoped_v1 rejects mismatched Context building_id ceiling');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','customer_api.get_payment_intent_v1 rejects mismatched Context building_id ceiling');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','customer_api.generate_bank_instruction_v1 rejects mismatched Context building_id ceiling');
reset role;
rollback to r2_hierarchy;
savepoint r2_hierarchy;
update identity.context_grants set property_id=pg_temp.core_mobile_id(40) where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','app_private.read_payment_intent_scoped_v1 rejects mismatched Context property_id ceiling');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','customer_api.get_payment_intent_v1 rejects mismatched Context property_id ceiling');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payment_unit_access_denied','customer_api.generate_bank_instruction_v1 rejects mismatched Context property_id ceiling');
reset role;
rollback to r2_hierarchy;

-- Legacy rows cannot establish equality from the all-outstanding projection.
update payments.payment_intents set configuration_snapshot=configuration_snapshot-'request_identity_v1'
where id=pg_temp.core_mobile_intent();
set local role authenticated;
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'23505','payment_idempotency_conflict','legacy unknown identity fails closed');
reset role;

-- Independent missing-actor and anonymous SQL entry-point checks.
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','authentication_required','app_private.read_payment_intent_scoped_v1 rejects missing actor');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','authentication_required','customer_api.get_payment_intent_v1 rejects missing actor');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','authentication_required','customer_api.generate_bank_instruction_v1 rejects missing actor');
reset role;
set local role anon;
select throws_ok($$select app_private.read_payment_intent_scoped_v1('c2110000-0000-4000-8000-000000000101'::uuid,'c2110000-0000-4000-8000-000000000999'::uuid)$$,'42501',NULL,'app_private.read_payment_intent_scoped_v1 rejects anonymous invocation');
select throws_ok($$select customer_api.get_payment_intent_v1('c2110000-0000-4000-8000-000000000101'::uuid,'c2110000-0000-4000-8000-000000000999'::uuid)$$,'42501',NULL,'customer_api.get_payment_intent_v1 rejects anonymous invocation');
select throws_ok($$select customer_api.generate_bank_instruction_v1('c2110000-0000-4000-8000-000000000101'::uuid,'c2110000-0000-4000-8000-000000000999'::uuid)$$,'42501',NULL,'customer_api.generate_bank_instruction_v1 rejects anonymous invocation');
reset role;
select set_config('request.jwt.claims','{"sub":"c2110000-0000-4000-8000-000000000001","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_id(999))$$,'22023','payment_intent_not_found','app_private.read_payment_intent_scoped_v1 rejects unknown intent');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_id(999))$$,'22023','payment_intent_not_found','customer_api.get_payment_intent_v1 rejects unknown intent');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_id(999))$$,'22023','payment_intent_not_found','customer_api.generate_bank_instruction_v1 rejects unknown intent');
reset role;
savepoint r2_context_revoke;
delete from identity.context_grants where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','app_private.read_payment_intent_scoped_v1 rejects revoked Context');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','customer_api.get_payment_intent_v1 rejects revoked Context');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','customer_api.generate_bank_instruction_v1 rejects revoked Context');
reset role;
rollback to r2_context_revoke;

-- Existing customer MFA policy applies inside the helper as well.
savepoint r2_mfa;
update identity.memberships set role_id=(select id from identity.roles where tenant_id is null and code='association_admin')
 where id=pg_temp.core_mobile_id(91);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2110000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','mfa_required','app_private.read_payment_intent_scoped_v1 preserves existing elevated-customer MFA policy');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','mfa_required','customer_api.get_payment_intent_v1 preserves existing elevated-customer MFA policy');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','mfa_required','customer_api.generate_bank_instruction_v1 preserves existing elevated-customer MFA policy');
reset role;
rollback to r2_mfa;

-- Revocation/expiry are genuine row mutations on the isolated fixture only.
savepoint before_revoke;
update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','expired Context denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','expired Context denies GET');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','expired Context denies instruction');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','customer_context_access_denied','expired Context denies replay before fingerprint lookup');
reset role;
rollback to before_revoke;
update identity.memberships set ends_at=statement_timestamp()-interval '1 second' where id=pg_temp.core_mobile_id(91);
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','expired membership denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','expired membership denies GET');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','customer_context_access_denied','expired membership denies replay');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','expired membership denies instruction');
reset role;
rollback to before_revoke;
update identity.memberships set status='suspended' where id=pg_temp.core_mobile_id(91);
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','revoked membership denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','revoked membership denies GET');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','customer_context_access_denied','revoked membership denies replay');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','revoked membership denies instruction');
reset role;
rollback to before_revoke;
update identity.context_grants set starts_at=statement_timestamp()+interval '1 day' where id=pg_temp.core_mobile_id(101);
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','future Context denies GET');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','future Context denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','future Context denies GET');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','customer_context_access_denied','future Context denies replay');
reset role;
rollback to before_revoke;
update identity.memberships set starts_at=statement_timestamp()+interval '1 day' where id=pg_temp.core_mobile_id(91);
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','future membership denies GET');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','future membership denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','future membership denies GET');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','customer_context_access_denied','future membership denies replay');
reset role;
rollback to before_revoke;
update identity.memberships set role_id=(select id from identity.roles where tenant_id is null and code='multi_unit_owner')
where id=pg_temp.core_mobile_id(91);
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payments_permission_required','membership without canonical read permission denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payments_permission_required','membership without canonical read permission denies GET');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','payments_permission_required','membership without create permission denies replay');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payments_permission_required','no read permission denies instruction');
reset role;
rollback to before_revoke;
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=pg_temp.core_mobile_id(160) and entitlement_key='module.payments';
set local role authenticated;
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payments_entitlement_required','no current entitlement denies GET');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payments_entitlement_required','no current entitlement denies GET');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211')$$,'42501','payments_entitlement_required','no current entitlement denies replay');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','payments_entitlement_required','no current entitlement denies instruction');
reset role;
rollback to before_revoke;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c2110000-0000-4000-8000-000000000002","aal":"aal2"}',true);
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','foreign actor cannot borrow owner Context');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','foreign actor cannot borrow owner Context');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(101),pg_temp.core_mobile_intent())$$,'42501','customer_context_access_denied','direct helper: foreign actor cannot borrow owner Context');
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(102),pg_temp.core_mobile_intent())$$,'42501','payment_intent_access_denied','foreign payer cannot read historic ID');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(102),pg_temp.core_mobile_intent())$$,'42501','payment_intent_access_denied','foreign payer cannot read historic ID');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(102),pg_temp.core_mobile_intent())$$,'42501','payment_intent_access_denied','direct helper: foreign payer cannot read historic ID');
select throws_ok($$select pg_temp.core_mobile_create('core-mobile-exact-211',72,10,'bank_transfer',10,52,'RON',102)$$,'23505','payment_idempotency_conflict','same tenant key belongs to original actor');
select set_config('request.jwt.claims','{"sub":"c2110000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select throws_ok($$select customer_api.get_payment_intent_v1(pg_temp.core_mobile_id(103),pg_temp.core_mobile_intent())$$,'22023','payment_intent_not_found','foreign tenant cannot find intent');
select throws_ok($$select customer_api.generate_bank_instruction_v1(pg_temp.core_mobile_id(103),pg_temp.core_mobile_intent())$$,'22023','payment_intent_not_found','foreign tenant cannot find intent');
select throws_ok($$select app_private.read_payment_intent_scoped_v1(pg_temp.core_mobile_id(103),pg_temp.core_mobile_intent())$$,'22023','payment_intent_not_found','direct helper: foreign tenant cannot find intent');
select ok((pg_temp.core_mobile_create('core-mobile-exact-211',73,10,'bank_transfer',10,53,'RON',103)->>'payment_intent_id')::uuid
 <> pg_temp.core_mobile_intent(),'same key in other tenant is independent, not an old-tenant replay');
reset role;
select is((select count(*)::integer from payments.payment_intents where tenant_id=pg_temp.core_mobile_id(10)),3,'only the three distinct requests persisted; no duplicate on denial/conflict');
select ok((select status='created' and settled_at is null from payments.payment_intents where id=pg_temp.core_mobile_intent()),'instruction is not paid or settled');
select results_eq($$select (select count(*) from payments.payments),(select count(*) from payments.settlements),
 (select count(*) from finance.journals),(select sum(paid_amount) from billing.receivables),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.payments t),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.settlements t),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from finance.journals t),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from billing.receivables t),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from public.owner_private_units t)$$,
 $$select payments,settlements,journals,paid,payment_hash,settlement_hash,journal_hash,receivable_hash,private_hash
 from core_mobile_financial_before$$,'no financial effects or private/official crossover, counts and content');
select ok(not (select prosecdef from pg_proc where oid='customer_api.get_payment_intent_v1(uuid,uuid)'::regprocedure),'GET remains invoker');
select ok(not (select prosecdef from pg_proc where oid='customer_api.create_payment_intent_v1(uuid,uuid,jsonb,numeric,text,text,text)'::regprocedure),'creation wrapper remains invoker');
-- These are actual-catalog checks only when pgTAP runs on the authorized DB.
select is((select proowner from pg_proc where oid='app_private.read_payment_intent_scoped_v1(uuid,uuid)'::regprocedure),
 (select proowner from pg_proc where oid='app_private.create_payment_intent_scoped_v1(uuid,uuid,jsonb,numeric,text,text,text)'::regprocedure),
 'R2 reader owner matches the existing scoped creation owner');
select diag('R2 actual reader owner: ' || pg_get_userbyid(proowner)) from pg_proc
 where oid='app_private.read_payment_intent_scoped_v1(uuid,uuid)'::regprocedure;
select ok((select prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog']
 and pronargs=2 and proargtypes='2950 2950'::oidvector and prorettype='jsonb'::regtype
 from pg_proc where oid='app_private.read_payment_intent_scoped_v1(uuid,uuid)'::regprocedure),
 'R2 private reader is STABLE definer, fixed path, only two UUID inputs, JSONB output');
select ok((select not prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog']
 from pg_proc where oid='customer_api.get_payment_intent_v1(uuid,uuid)'::regprocedure),'R2 wrapper stays STABLE invoker with fixed path');
select ok(has_schema_privilege('authenticated','app_private','USAGE'),'R2 uses existing private-schema USAGE');
select ok(has_function_privilege('authenticated','app_private.read_payment_intent_scoped_v1(uuid,uuid)','EXECUTE')
 and not has_function_privilege('anon','app_private.read_payment_intent_scoped_v1(uuid,uuid)','EXECUTE')
 and not has_function_privilege('service_role','app_private.read_payment_intent_scoped_v1(uuid,uuid)','EXECUTE'),
 'R2 authenticated EXECUTE, no anonymous or service role access');
select is((select count(*)::integer from pg_proc p,
 lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
 where p.oid='app_private.read_payment_intent_scoped_v1(uuid,uuid)'::regprocedure
 and (acl.grantee not in (p.proowner,'authenticated'::regrole) or acl.is_grantable and acl.grantee<>p.proowner)),0,
 'R2 no PUBLIC/default extra grantee or delegated grant option');
select diag('R2 actual wrapper owner: ' || pg_get_userbyid(proowner) || '; ACL: ' || coalesce(proacl::text,'default'))
 from pg_proc where oid='customer_api.get_payment_intent_v1(uuid,uuid)'::regprocedure;
select ok(has_function_privilege('authenticated','customer_api.get_payment_intent_v1(uuid,uuid)','EXECUTE')
 and not has_function_privilege('anon','customer_api.get_payment_intent_v1(uuid,uuid)','EXECUTE'),
 'R2 existing public GET execute contract remains authenticated-only versus anon');
select * from finish();
rollback;
