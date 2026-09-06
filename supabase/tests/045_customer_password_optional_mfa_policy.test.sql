begin;
select plan(22);

select ok(to_regprocedure('app_private.customer_mfa_required()') is not null,'role-aware customer MFA predicate exists');
select ok(to_regprocedure('platform.my_customer_mfa_requirement()') is not null,'customer MFA requirement RPC exists');
select ok(has_function_privilege('authenticated','platform.my_customer_mfa_requirement()','EXECUTE'),'authenticated may resolve its MFA requirement');
select ok(not has_function_privilege('anon','platform.my_customer_mfa_requirement()','EXECUTE'),'anon cannot resolve customer MFA policy');
select ok(not has_function_privilege('service_role','platform.my_customer_mfa_requirement()','EXECUTE'),'service role cannot call customer MFA policy RPC');
select ok(position('app_private.customer_mfa_required()' in pg_get_functiondef('platform.list_my_customer_contexts()'::regprocedure))>0,'context list uses role-aware MFA policy');
select ok(not has_function_privilege('authenticated','app_private.customer_mfa_required()','EXECUTE'),'internal MFA predicate is not directly executable by authenticated');

do $$ begin
  insert into auth.users(id,email) values
    ('45000000-0000-0000-0000-000000000001','owner-045@cladora.test'),
    ('45000000-0000-0000-0000-000000000002','tenant-045@cladora.test'),
    ('45000000-0000-0000-0000-000000000003','admin-045@cladora.test');
  insert into platform.tenants(id,legal_name,registration_number,status) values
    ('45100000-0000-0000-0000-000000000001','Policy Tenant One','POLICY-045-1','active'),
    ('45100000-0000-0000-0000-000000000002','Policy Tenant Two','POLICY-045-2','active');
  insert into identity.roles(id,tenant_id,code,name) values
    ('45200000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','owner','Owner'),
    ('45200000-0000-0000-0000-000000000002','45100000-0000-0000-0000-000000000001','tenant_resident','Tenant resident'),
    ('45200000-0000-0000-0000-000000000003','45100000-0000-0000-0000-000000000001','association_admin','Association administrator'),
    ('45200000-0000-0000-0000-000000000004','45100000-0000-0000-0000-000000000002','property_manager','Property manager');
  insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at) values
    ('45300000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000001','45200000-0000-0000-0000-000000000001','active',statement_timestamp()-interval '1 day'),
    ('45300000-0000-0000-0000-000000000002','45100000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000002','45200000-0000-0000-0000-000000000002','active',statement_timestamp()-interval '1 day'),
    ('45300000-0000-0000-0000-000000000003','45100000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000003','45200000-0000-0000-0000-000000000003','active',statement_timestamp()-interval '1 day');
  insert into portfolio.properties(id,tenant_id,type,name,status) values
    ('45500000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','condominium','Policy Prop 1','active');
  insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
    ('45600000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','45500000-0000-0000-0000-000000000001','B45','Policy Building 1','active');
  insert into portfolio.units(id,tenant_id,building_id,code,status) values
    ('45700000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','45600000-0000-0000-0000-000000000001','U45-1','active');
  insert into portfolio.parties(id,tenant_id,type,legal_name) values
    ('45800000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','person','Owner 45 Party');
  insert into identity.membership_parties(membership_id,tenant_id,party_id) values
    ('45300000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','45800000-0000-0000-0000-000000000001');
  insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from) values
    ('45100000-0000-0000-0000-000000000001','45700000-0000-0000-0000-000000000001','45800000-0000-0000-0000-000000000001',1.0,current_date-10);
  insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id,building_id,unit_id,starts_at) values
    ('45400000-0000-0000-0000-000000000001','45300000-0000-0000-0000-000000000001','45100000-0000-0000-0000-000000000001','unit','45500000-0000-0000-0000-000000000001','45600000-0000-0000-0000-000000000001','45700000-0000-0000-0000-000000000001',statement_timestamp()-interval '1 day'),
    ('45400000-0000-0000-0000-000000000002','45300000-0000-0000-0000-000000000002','45100000-0000-0000-0000-000000000001','tenant',null,null,null,statement_timestamp()-interval '1 day'),
    ('45400000-0000-0000-0000-000000000003','45300000-0000-0000-0000-000000000003','45100000-0000-0000-0000-000000000001','tenant',null,null,null,statement_timestamp()-interval '1 day');
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"45000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(not platform.my_customer_mfa_requirement(),'owner receives optional MFA decision');
select ok(app_private.customer_context_is_active('45400000-0000-0000-0000-000000000001'),'owner AAL1 context remains active');
select ok((select count(*) from platform.list_my_customer_contexts())=1,'owner AAL1 can list its context');
select ok(platform.get_customer_dashboard('45400000-0000-0000-0000-000000000001')#>>'{context,role_code}'='owner','owner AAL1 can read scoped dashboard');

select set_config('request.jwt.claims','{"sub":"45000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select ok(not platform.my_customer_mfa_requirement(),'tenant resident does not require MFA');
select ok((select count(*) from platform.list_my_customer_contexts())=1,'tenant resident AAL1 can list its context');

select set_config('request.jwt.claims','{"sub":"45000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
select ok(platform.my_customer_mfa_requirement(),'association administrator requires MFA');
select ok(platform.my_customer_mfa_requirement(),'sensitive customer role receives mandatory MFA decision');
select throws_like($$select * from platform.list_my_customer_contexts()$$,'%mfa_required%','sensitive AAL1 cannot list contexts');
select throws_like($$select platform.get_customer_dashboard('45400000-0000-0000-0000-000000000003')$$,'%mfa_required%','sensitive AAL1 cannot load dashboard');
select ok(not app_private.customer_context_is_active('45400000-0000-0000-0000-000000000003'),'sensitive AAL1 context fails closed');

select set_config('request.jwt.claims','{"sub":"45000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}',true);
select ok((select count(*) from platform.list_my_customer_contexts())=1,'sensitive AAL2 can list contexts');

reset role;
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
values('45300000-0000-0000-0000-000000000004','45100000-0000-0000-0000-000000000002','45000000-0000-0000-0000-000000000001','45200000-0000-0000-0000-000000000004','active',statement_timestamp()-interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"45000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(platform.my_customer_mfa_requirement(),'mixed owner and active sensitive membership requires MFA globally');
reset role;
update identity.memberships set ends_at=statement_timestamp()-interval '1 minute' where id='45300000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"45000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(not platform.my_customer_mfa_requirement(),'expired sensitive membership no longer requires MFA');
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1"}',true);
select throws_like($$select platform.my_customer_mfa_requirement()$$,'%authentication_required%','missing UID fails closed');

select * from finish();
rollback;
