begin;
-- Dependency: Core owns this adapter and its catalog binding/read isolation.
-- Never substitute the tenant-only legacy resolver or install an authorization stub.
do $$begin
 if to_regprocedure('app_private.require_building_setup_authority_v2(uuid,uuid,text,text)') is null then
  raise exception 'building_setup_core_dependency_required';
 end if;
end$$;
alter table platform.building_setup_runs
 add column revision integer not null default 1 check(revision>0),
 add column creation_request_hash text,
 add column creation_receipt jsonb,
 add column submitted_revision integer,
 add column submitted_payload_hash text,
 add column approved_revision integer,
 add column approved_submitted_revision integer,
 add column approved_payload_hash text,
 add column last_command_key text,
 add column last_command_hash text,
 add column last_command_actor uuid references auth.users(id),
 add column last_command_receipt jsonb;
-- No historical provenance backfill. NULL creation binding means review required.
alter table platform.case_workspace_preparations
 add column attempt_key text,
 add column request_hash text,
 add column creation_receipt jsonb;
create unique index case_workspace_preparations_attempt_v2
 on platform.case_workspace_preparations(case_id,attempt_key) where attempt_key is not null;

create function app_private.protect_setup_creation_v2() returns trigger
language plpgsql set search_path=pg_catalog as $$begin
 if (new.tenant_id,new.customer_workspace_id,new.created_by,new.idempotency_key,new.creation_request_hash,new.creation_receipt)
 is distinct from (old.tenant_id,old.customer_workspace_id,old.created_by,old.idempotency_key,old.creation_request_hash,old.creation_receipt)
 then raise exception 'setup_creation_binding_immutable' using errcode='22023';end if;
 return new;
end$$;
create trigger protect_setup_creation_v2 before update on platform.building_setup_runs
 for each row execute function app_private.protect_setup_creation_v2();
revoke all on function app_private.protect_setup_creation_v2() from public,anon,authenticated,service_role;

create function app_private.validate_setup_units_v2(p_units jsonb) returns void
language plpgsql set search_path=pg_catalog as $$begin
 if jsonb_typeof(p_units) is distinct from 'array' then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if jsonb_array_length(p_units) not between 1 and 500 then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_units) e where jsonb_typeof(e) is distinct from 'object'
 or jsonb_typeof(e->'code') is distinct from 'string' or length(btrim(e->>'code')) not between 1 and 40
 or not(e ? 'floor' and e ? 'area_m2')
 or (jsonb_typeof(e->'floor')<>'null' and (jsonb_typeof(e->'floor')<>'number' or (e->>'floor') !~ '^-?[0-9]+$' or (e->>'floor')::numeric not between -5 and 200))
 or (jsonb_typeof(e->'area_m2')<>'null' and (jsonb_typeof(e->'area_m2')<>'number' or (e->>'area_m2')::numeric<=0 or (e->>'area_m2')::numeric>100000)))
 then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_units) e cross join lateral jsonb_object_keys(e) k where k not in ('code','floor','area_m2')) then raise exception 'setup_invalid_units' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_units) e group by lower(btrim(e->>'code')) having count(*)>1)
 then raise exception 'setup_duplicate_unit_code' using errcode='22023';end if;
end$$;
revoke all on function app_private.validate_setup_units_v2(jsonb) from public,anon,authenticated,service_role;

create function app_private.setup_record_v2(p_run platform.building_setup_runs) returns jsonb
language sql stable set search_path=pg_catalog as $$
 select jsonb_build_object('version',2,'run_id',p_run.id,'workspace_id',p_run.customer_workspace_id,
 'revision',p_run.revision,'status',p_run.status,'payload',p_run.setup_payload,'payload_hash',p_run.payload_hash,
 'property_id',p_run.property_id,'effective_units',case when p_run.property_id is null then null else
 (select coalesce(jsonb_agg(jsonb_build_object('code',u.code,'floor',u.floor,'area_m2',u.area_m2) order by u.code),'[]'::jsonb)
 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
 where b.property_id=p_run.property_id and u.tenant_id=p_run.tenant_id) end,
 'creation_request_hash',p_run.creation_request_hash,'creation_receipt',p_run.creation_receipt,
 'submitted_revision',p_run.submitted_revision,'submitted_payload_hash',p_run.submitted_payload_hash,
 'approved_revision',p_run.approved_revision,'approved_payload_hash',p_run.approved_payload_hash,
 'last_command_key',p_run.last_command_key,'last_command_hash',p_run.last_command_hash,
 'last_command_receipt',p_run.last_command_receipt);
$$;
revoke all on function app_private.setup_record_v2(platform.building_setup_runs) from public,anon,authenticated,service_role;

create function app_private.get_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.read','read');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id
 and customer_workspace_id=c.workspace_id;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002';end if;
 if r.created_by<>c.actor_id then
  perform app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.approve','approve');
  if r.submitted_by=c.actor_id or not(r.status='submitted' or (r.last_command_actor=c.actor_id and r.last_command_receipt->>'operation'='approve'))
  then raise exception 'setup_read_denied' using errcode='42501';end if;
 end if;
 return app_private.setup_record_v2(r);
end$$;

create function app_private.get_building_setup_attempt_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.read','read');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 select * into r from platform.building_setup_runs where tenant_id=c.tenant_id and customer_workspace_id=c.workspace_id
 and created_by=c.actor_id and idempotency_key=p_idempotency_key;
 if not found then return null;end if;
 if r.creation_request_hash is null then raise exception 'setup_legacy_review_required' using errcode='22023';end if;
 return app_private.setup_record_v2(r);
end$$;

create function app_private.create_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;v_hash text;v_id uuid:=gen_random_uuid();v_receipt jsonb;
begin
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.manage','create');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 v_hash:=encode(extensions.digest(jsonb_build_object('actor',c.actor_id,'tenant',c.tenant_id,'workspace',c.workspace_id,'operation','create','payload',p_payload)::text,'sha256'),'hex');
 -- Same lock namespace as the existing tenant/key uniqueness; no dummy lock rows.
 perform pg_advisory_xact_lock(hashtextextended(c.tenant_id::text||':'||p_idempotency_key,0));
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,'onboarding.import.manage','create');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 select * into r from platform.building_setup_runs where tenant_id=c.tenant_id and idempotency_key=p_idempotency_key for update;
 if found then
  if r.creation_request_hash is null then raise exception 'setup_legacy_review_required' using errcode='22023';end if;
  if r.created_by<>c.actor_id or r.customer_workspace_id<>c.workspace_id or r.creation_request_hash<>v_hash
  then raise exception 'setup_attempt_conflict' using errcode='23505';end if;
  return r.creation_receipt;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or (p_payload->>'currency') is distinct from 'RON'
 or length(btrim(coalesce(p_payload#>>'{association,name}',''))) not between 2 and 160
 or length(btrim(coalesce(p_payload#>>'{building,name}',''))) not between 2 and 160
 or length(btrim(coalesce(p_payload#>>'{building,code}',''))) not between 1 and 40
 or coalesce(p_payload#>>'{building,floors}','') !~ '^[0-9]+$'
 or (p_payload#>>'{building,floors}')::integer not between 0 and 200
 or coalesce(p_payload->>'period_start','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or coalesce(p_payload->>'period_end','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or (p_payload->>'period_start')::date>(p_payload->>'period_end')::date
 then raise exception 'setup_invalid_payload' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('association','building','currency','period_start','period_end','units','opening_balances'))
 or exists(select 1 from jsonb_object_keys(p_payload->'association') k where k<>'name')
 or exists(select 1 from jsonb_object_keys(p_payload->'building') k where k not in ('name','code','floors'))
 then raise exception 'setup_invalid_payload' using errcode='22023';end if;
 perform app_private.validate_setup_units_v2(p_payload->'units');
 if jsonb_typeof(p_payload->'opening_balances') is distinct from 'array' then raise exception 'setup_invalid_balances' using errcode='22023';end if;
 if jsonb_array_length(p_payload->'opening_balances')>500 or exists(select 1 from jsonb_array_elements(p_payload->'opening_balances') x
 where coalesce(x->>'side','') not in ('debit','credit') or jsonb_typeof(x->'account_code') is distinct from 'string' or length(btrim(x->>'account_code')) not between 1 and 40 or jsonb_typeof(x->'amount') is distinct from 'number'
 or (x->>'amount')::numeric<=0 or (x->>'amount')::numeric>1000000000)
 then raise exception 'setup_invalid_balances' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'opening_balances') e cross join lateral jsonb_object_keys(e) k where k not in ('account_code','side','amount')) then raise exception 'setup_invalid_balances' using errcode='22023';end if;
 v_receipt:=jsonb_build_object('version',2,'run_id',v_id,'workspace_id',c.workspace_id,'revision',1,'status','draft','creation_request_hash',v_hash);
 insert into platform.building_setup_runs(id,tenant_id,customer_workspace_id,idempotency_key,setup_payload,payload_hash,created_by,creation_request_hash,creation_receipt)
 values(v_id,c.tenant_id,c.workspace_id,p_idempotency_key,p_payload,encode(extensions.digest(p_payload::text,'sha256'),'hex'),c.actor_id,v_hash,v_receipt);
 return v_receipt;
end$$;

-- Process replacement of the existing Setup transition path. Canonical portfolio,
-- period, audit and existing atomic Workspace-binding trigger remain authoritative.
create function app_private.command_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,
 p_expected_revision integer,p_command_key text,p_action text,p_units jsonb default null,p_expected_payload_hash text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c record;r platform.building_setup_runs%rowtype;v_hash text;v_receipt jsonb;v_d numeric;v_cr numeric;
 v_payload jsonb;v_status text;v_property uuid;v_building uuid;x jsonb;
begin
 if p_action not in ('update','rehearse','submit','approve','provision') or p_action is null then raise exception 'setup_invalid_action' using errcode='22023';end if;
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,
 case when p_action in ('approve','provision') then 'onboarding.import.approve' else 'onboarding.import.manage' end,p_action);
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_expected_revision is null then raise exception 'setup_precondition_required' using errcode='22004';end if;
 if p_expected_revision<1 or p_command_key is null or length(p_command_key)>128
 or p_command_key not like 'setup-'||p_run_id::text||'-r'||p_expected_revision::text||'-%'
 or p_command_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'setup_invalid_command_key' using errcode='22023';end if;
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id and customer_workspace_id=c.workspace_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002';end if;
 select * into strict c from app_private.require_building_setup_authority_v2(p_context_id,p_workspace_id,case when p_action in ('approve','provision') then 'onboarding.import.approve' else 'onboarding.import.manage' end,p_action);
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from p_workspace_id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
 if p_action<>'approve' and r.created_by<>c.actor_id then raise exception 'setup_actor_denied' using errcode='42501';end if;
 if p_action='approve' and (r.created_by=c.actor_id or r.submitted_by=c.actor_id) then raise exception 'setup_dual_control_violation' using errcode='42501';end if;
 if r.creation_request_hash is null then raise exception 'setup_legacy_review_required' using errcode='22023';end if;
 v_hash:=encode(extensions.digest(jsonb_build_object('actor',c.actor_id,'tenant',c.tenant_id,'workspace',c.workspace_id,'run',r.id,
 'operation',p_action,'expected_revision',p_expected_revision,'units',p_units,'expected_payload_hash',p_expected_payload_hash)::text,'sha256'),'hex');
 if r.last_command_key=p_command_key then
  if r.last_command_actor<>c.actor_id or r.last_command_hash<>v_hash then raise exception 'setup_attempt_conflict' using errcode='23505';end if;
  return r.last_command_receipt;
 end if;
 if r.revision<>p_expected_revision then raise exception 'setup_revision_conflict' using errcode='40001';end if;
 v_payload:=r.setup_payload;v_status:=r.status;v_property:=r.property_id;
 if p_action='update' then
  if r.status<>'draft' then raise exception 'setup_invalid_state' using errcode='22023';end if;
  perform app_private.validate_setup_units_v2(p_units);
  v_payload:=jsonb_set(r.setup_payload,'{units}',p_units);
 elsif p_action='rehearse' then
  if r.status not in ('draft','rehearsed') then raise exception 'setup_invalid_state' using errcode='22023';end if;
  select coalesce(sum((e->>'amount')::numeric) filter(where e->>'side'='debit'),0),coalesce(sum((e->>'amount')::numeric) filter(where e->>'side'='credit'),0)
  into v_d,v_cr from jsonb_array_elements(r.setup_payload->'opening_balances') e;
  if v_d<>v_cr then raise exception 'opening_balance_rehearsal_not_zero' using errcode='22023';end if;
  v_status:='rehearsed';
 elsif p_action='submit' then
  if r.status<>'rehearsed' or (r.rehearsal_result->>'balanced')::boolean is distinct from true then raise exception 'setup_rehearsal_required' using errcode='22023';end if;
  v_status:='submitted';
 elsif p_action='approve' then
  if r.status<>'submitted' then raise exception 'setup_invalid_state' using errcode='22023';end if;
  if r.submitted_revision is distinct from r.revision or r.submitted_payload_hash is distinct from r.payload_hash
   or p_expected_payload_hash is distinct from r.submitted_payload_hash
  then raise exception 'setup_snapshot_conflict' using errcode='40001';end if;
  v_status:='approved';
 elsif p_action='provision' then
  if r.status<>'approved' then raise exception 'setup_approval_required' using errcode='22023';end if;
  if r.approved_revision is distinct from r.revision or r.approved_submitted_revision is distinct from r.submitted_revision
   or r.approved_payload_hash is distinct from r.payload_hash or r.submitted_payload_hash is distinct from r.payload_hash
   or r.approved_by is null or r.approved_by=r.submitted_by
  then raise exception 'setup_snapshot_conflict' using errcode='40001';end if;
  -- Existing canonical binding trigger selects the creator's active membership.
  -- Refuse ambiguity rather than letting it choose another membership/Context.
  if (select count(*) from identity.memberships m where m.tenant_id=c.tenant_id and m.user_id=r.created_by
   and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()))<>1
   or not exists(select 1 from identity.memberships m where m.id=c.membership_id and m.user_id=r.created_by and m.tenant_id=c.tenant_id)
  then raise exception 'setup_operator_membership_review_required' using errcode='42501';end if;
  insert into portfolio.properties(tenant_id,type,name,base_currency,status)
  values(c.tenant_id,'condominium',r.setup_payload#>>'{association,name}','RON','active') returning id into v_property;
  insert into portfolio.buildings(tenant_id,property_id,code,name,floors,status)
  values(c.tenant_id,v_property,r.setup_payload#>>'{building,code}',r.setup_payload#>>'{building,name}',(r.setup_payload#>>'{building,floors}')::smallint,'active') returning id into v_building;
  for x in select value from jsonb_array_elements(r.setup_payload->'units') loop
   insert into portfolio.units(tenant_id,building_id,code,floor,area_m2,status)
   values(c.tenant_id,v_building,x->>'code',nullif(x->>'floor','')::smallint,nullif(x->>'area_m2','')::numeric,'active');
  end loop;
  insert into finance.accounting_periods(tenant_id,property_id,starts_on,ends_on,status)
  values(c.tenant_id,v_property,(r.setup_payload->>'period_start')::date,(r.setup_payload->>'period_end')::date,'open');
  v_status:='provisioned';
 end if;
 update platform.building_setup_runs set revision=r.revision+1,status=v_status,setup_payload=v_payload,
 payload_hash=encode(extensions.digest(v_payload::text,'sha256'),'hex'),property_id=v_property,updated_at=statement_timestamp(),
 rehearsal_result=case when p_action='rehearse' then jsonb_build_object('debits',v_d,'credits',v_cr,'difference',0,'balanced',true,'zero_writes',true,'unit_count',jsonb_array_length(v_payload->'units')) else r.rehearsal_result end,
 submitted_by=case when p_action='submit' then c.actor_id else r.submitted_by end,
 submitted_revision=case when p_action='submit' then r.revision+1 else r.submitted_revision end,
 submitted_payload_hash=case when p_action='submit' then r.payload_hash else r.submitted_payload_hash end,
 approved_by=case when p_action='approve' then c.actor_id else r.approved_by end,
 approved_revision=case when p_action='approve' then r.revision+1 else r.approved_revision end,
 approved_submitted_revision=case when p_action='approve' then r.submitted_revision else r.approved_submitted_revision end,
 approved_payload_hash=case when p_action='approve' then r.payload_hash else r.approved_payload_hash end
 where id=r.id returning * into r;
 v_receipt:=jsonb_build_object('version',2,'run_id',r.id,'workspace_id',r.customer_workspace_id,'revision',r.revision,
 'status',r.status,'payload_hash',r.payload_hash,'expected_revision',p_expected_revision,'operation',p_action,'command_key',p_command_key,'property_id',r.property_id);
 update platform.building_setup_runs set last_command_key=p_command_key,last_command_hash=v_hash,
 last_command_actor=c.actor_id,last_command_receipt=v_receipt where id=r.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(c.tenant_id,c.actor_id,'CUSTOMER_OPERATOR','BUILDING_SETUP_'||upper(p_action),'building_setup_run',r.id,
 'Version-bound building setup operation',jsonb_build_object('workspace_id',r.customer_workspace_id,'revision',r.revision,'payload_hash',r.payload_hash));
 return v_receipt;
end$$;
revoke all on function app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text) from public,anon,authenticated,service_role;

create function app_private.update_building_setup_units_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_units jsonb) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'update',p_units,null)$$;

create function app_private.rehearse_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'rehearse',null,null)$$;

create function app_private.submit_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'submit',null,null)$$;

create function app_private.approve_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_expected_payload_hash text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'approve',null,p_expected_payload_hash)$$;

create function app_private.provision_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security definer set search_path=pg_catalog as $$select app_private.command_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,'provision',null,null)$$;

create function customer_api.create_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text,p_payload jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.create_building_setup_v2(p_context_id,p_workspace_id,p_idempotency_key,p_payload)$$;
revoke all on function app_private.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.create_building_setup_v2(uuid,uuid,text,jsonb) to authenticated;
revoke all on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.create_building_setup_v2(uuid,uuid,text,jsonb) to authenticated;

create function customer_api.get_building_setup_attempt_v2(p_context_id uuid,p_workspace_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_building_setup_attempt_v2(p_context_id,p_workspace_id,p_idempotency_key)$$;
revoke all on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function app_private.get_building_setup_attempt_v2(uuid,uuid,text) to authenticated;
revoke all on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.get_building_setup_attempt_v2(uuid,uuid,text) to authenticated;

create function customer_api.get_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_building_setup_v2(p_context_id,p_workspace_id,p_run_id)$$;
revoke all on function app_private.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.get_building_setup_v2(uuid,uuid,uuid) to authenticated;
revoke all on function customer_api.get_building_setup_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.get_building_setup_v2(uuid,uuid,uuid) to authenticated;

create function customer_api.update_building_setup_units_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_units jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.update_building_setup_units_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,p_units)$$;
revoke all on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) to authenticated;
revoke all on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function customer_api.update_building_setup_units_v2(uuid,uuid,uuid,integer,text,jsonb) to authenticated;

create function customer_api.rehearse_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.rehearse_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;
revoke all on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) to authenticated;
revoke all on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text) to authenticated;

create function customer_api.submit_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.submit_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;
revoke all on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text) to authenticated;
revoke all on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text) to authenticated;

create function customer_api.approve_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text,p_expected_payload_hash text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.approve_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key,p_expected_payload_hash)$$;
revoke all on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) to authenticated;
revoke all on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text) to authenticated;

create function customer_api.provision_building_setup_v2(p_context_id uuid,p_workspace_id uuid,p_run_id uuid,p_expected_revision integer,p_command_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.provision_building_setup_v2(p_context_id,p_workspace_id,p_run_id,p_expected_revision,p_command_key)$$;
revoke all on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text) to authenticated;
revoke all on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text) to authenticated;

-- Existing reviewer discovery/claim semantics stay separate from approval authority.
create or replace function app_private.my_pilot_setup_reviewer_v1(p_workspace_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_reviewer platform.pilot_setup_reviewers%rowtype;v_workspace platform.customer_workspaces%rowtype;v_rows jsonb:='[]';c record;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 then raise exception 'verified_identity_required' using errcode='42501';end if;
 select * into v_reviewer from platform.pilot_setup_reviewers
 where (p_workspace_id is null or customer_workspace_id=p_workspace_id)
 and normalized_email=(select lower(btrim(email)) from auth.users where id=auth.uid())
 and status in ('prepared','active') and expires_at>statement_timestamp() order by expires_at desc limit 1;
 if not found then return '{}'::jsonb;end if;
 select * into v_workspace from platform.customer_workspaces where id=v_reviewer.customer_workspace_id;
 if v_reviewer.status='active' then
  select * into strict c from app_private.require_building_setup_authority_v2(v_reviewer.context_grant_id,v_workspace.id,'onboarding.import.approve','approve');
 if c.actor_id is distinct from auth.uid() or c.workspace_id is distinct from v_workspace.id or c.tenant_id is null or c.membership_id is null then raise exception 'setup_authority_contract_invalid' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'workspace_id',s.customer_workspace_id,'status',s.status,
    'building',s.setup_payload#>>'{building,name}','revision',s.revision,'payload_hash',s.payload_hash,
    'submitted_revision',s.submitted_revision,'submitted_payload_hash',s.submitted_payload_hash) order by s.created_at,s.id),'[]'::jsonb)
  into v_rows from platform.building_setup_runs s where s.tenant_id=c.tenant_id and s.customer_workspace_id=c.workspace_id
   and s.status='submitted' and s.creation_request_hash is not null and s.submitted_revision=s.revision
   and s.submitted_payload_hash=s.payload_hash and s.submitted_by<>c.actor_id;
 end if;
 return jsonb_build_object('status',v_reviewer.status,'context_id',v_reviewer.context_grant_id,
 'workspace_id',v_workspace.id,'expires_at',v_reviewer.expires_at,'runs',v_rows);
end$$;

-- Case preparation reuses the existing control-plane domain operation.
create function app_private.protect_case_workspace_attempt_v2() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if old.request_hash is not null and (new.case_id,new.customer_workspace_id,new.prepared_by,new.attempt_key,new.request_hash,new.creation_receipt)
 is distinct from (old.case_id,old.customer_workspace_id,old.prepared_by,old.attempt_key,old.request_hash,old.creation_receipt)
 then raise exception 'case_attempt_binding_immutable' using errcode='22023';end if;
 return new;
end$$;
create trigger protect_case_workspace_attempt_v2 before update on platform.case_workspace_preparations for each row execute function app_private.protect_case_workspace_attempt_v2();
revoke all on function app_private.protect_case_workspace_attempt_v2() from public,anon,authenticated,service_role;

create function app_private.require_case_workspace_attempt_v1(p_case_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases%rowtype;v_tenant uuid;
begin
 perform app_private.assert_control_plane_gateway_access_v1();
 if not(app_private.has_platform_role('PLATFORM_SUPER_ADMIN') or app_private.has_platform_role('PLATFORM_OPERATIONS'))
 then raise exception 'access_denied' using errcode='42501';end if;
 select * into v_case from platform.customer_cases where id=p_case_id and status='open' for update;
 if not found or v_case.customer_workspace_id is null then raise exception 'linked_case_required' using errcode='42501';end if;
 select tenant_id into v_tenant from platform.customer_workspaces where id=v_case.customer_workspace_id
 and archived_at is null and lifecycle_status not in ('TERMINATED','ARCHIVED');
 if v_tenant is null or not exists(select 1 from platform.workspace_access_bases b
 where b.customer_workspace_id=v_case.customer_workspace_id and b.normalized_email=v_case.customer_email
 and ((b.status='prepared' and b.approved_at+interval '7 days'>statement_timestamp()) or(b.status='active' and b.expires_at>statement_timestamp()))
 and (b.mode='PILOT' or(b.mode='PAID' and b.paid_through>=(statement_timestamp() at time zone 'Europe/Bucharest')::date
 and exists(select 1 from platform.workspace_contracts k where k.id=b.contract_id and k.customer_workspace_id=b.customer_workspace_id and k.status='active' and k.signed_at is not null))))
 then raise exception 'approved_access_basis_required' using errcode='42501';end if;
 return v_tenant;
end$$;
revoke all on function app_private.require_case_workspace_attempt_v1(uuid) from public,anon,authenticated,service_role;

create function app_private.get_case_workspace_attempt_v1(p_case_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_result jsonb;
begin
 v_tenant:=app_private.require_case_workspace_attempt_v1(p_case_id);
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 select p.creation_receipt into v_result from platform.case_workspace_preparations p
 join platform.customer_workspaces w on w.id=p.customer_workspace_id and w.tenant_id=v_tenant
 where p.case_id=p_case_id and p.prepared_by=auth.uid() and p.attempt_key=p_idempotency_key;
 return v_result;
end$$;

create function app_private.create_case_workspace_v2(p_case_id uuid,p_workspace_type text,p_profile_code text,p_model_code text,p_commercial_owner text,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_tenant uuid;v_hash text;r platform.case_workspace_preparations%rowtype;v_result jsonb;
begin
 v_tenant:=app_private.require_case_workspace_attempt_v1(p_case_id);
 if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
 then raise exception 'invalid_idempotency_key' using errcode='22023';end if;
 v_hash:=encode(extensions.digest(jsonb_build_object('actor',auth.uid(),'tenant',v_tenant,'case',p_case_id,'operation','create_case_workspace',
 'type',p_workspace_type,'profile',p_profile_code,'model',p_model_code,'owner',p_commercial_owner,'reason',p_reason)::text,'sha256'),'hex');
 select * into r from platform.case_workspace_preparations where case_id=p_case_id and attempt_key=p_idempotency_key;
 if found then
  if r.prepared_by<>auth.uid() or r.request_hash<>v_hash then raise exception 'case_attempt_conflict' using errcode='23505';end if;
  return r.creation_receipt;
 end if;
 v_result:=customer_api.create_case_workspace_v1(p_case_id,p_workspace_type,p_profile_code,p_model_code,p_commercial_owner,p_reason);
 update platform.case_workspace_preparations set attempt_key=p_idempotency_key,request_hash=v_hash,creation_receipt=v_result
 where case_id=p_case_id and customer_workspace_id=(v_result->>'workspace_id')::uuid and prepared_by=auth.uid();
 if not found then raise exception 'case_creation_receipt_missing' using errcode='22023';end if;
 return v_result;
end$$;
create function customer_api.get_case_workspace_attempt_v1(p_case_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.get_case_workspace_attempt_v1(p_case_id,p_idempotency_key)$$;
revoke all on function app_private.get_case_workspace_attempt_v1(uuid,text) from public,anon,authenticated,service_role;
grant execute on function app_private.get_case_workspace_attempt_v1(uuid,text) to authenticated;
revoke all on function customer_api.get_case_workspace_attempt_v1(uuid,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.get_case_workspace_attempt_v1(uuid,text) to authenticated;
create function customer_api.create_case_workspace_v2(p_case_id uuid,p_workspace_type text,p_profile_code text,p_model_code text,p_commercial_owner text,p_reason text,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select app_private.create_case_workspace_v2(p_case_id,p_workspace_type,p_profile_code,p_model_code,p_commercial_owner,p_reason,p_idempotency_key)$$;
revoke all on function app_private.create_case_workspace_v2(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function app_private.create_case_workspace_v2(uuid,text,text,text,text,text,text) to authenticated;
revoke all on function customer_api.create_case_workspace_v2(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function customer_api.create_case_workspace_v2(uuid,text,text,text,text,text,text) to authenticated;
revoke execute on function app_private.create_building_setup_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke execute on function customer_api.create_building_setup_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke execute on function app_private.get_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function customer_api.get_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function app_private.update_building_setup_units_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke execute on function customer_api.update_building_setup_units_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke execute on function app_private.rehearse_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function customer_api.rehearse_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function app_private.submit_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function customer_api.submit_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function app_private.approve_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function customer_api.approve_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function app_private.provision_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function customer_api.provision_building_setup_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function customer_api.create_case_workspace_v1(uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
notify pgrst, 'reload schema';
commit;
