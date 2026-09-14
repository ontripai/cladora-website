begin;

-- CLADORA-P2-SETUP-HARDENING-001
-- Keep privileged implementations outside the exposed Data API schema.
alter function customer_api.create_building_setup_v1(uuid,text,jsonb) set schema app_private;
alter function customer_api.rehearse_building_setup_v1(uuid,uuid) set schema app_private;
alter function customer_api.submit_building_setup_v1(uuid,uuid) set schema app_private;
alter function customer_api.approve_building_setup_v1(uuid,uuid) set schema app_private;
alter function customer_api.provision_building_setup_v1(uuid,uuid) set schema app_private;

revoke all on function
  app_private.create_building_setup_v1(uuid,text,jsonb),
  app_private.rehearse_building_setup_v1(uuid,uuid),
  app_private.submit_building_setup_v1(uuid,uuid),
  app_private.approve_building_setup_v1(uuid,uuid),
  app_private.provision_building_setup_v1(uuid,uuid)
from public,anon;
grant execute on function
  app_private.create_building_setup_v1(uuid,text,jsonb),
  app_private.rehearse_building_setup_v1(uuid,uuid),
  app_private.submit_building_setup_v1(uuid,uuid),
  app_private.approve_building_setup_v1(uuid,uuid),
  app_private.provision_building_setup_v1(uuid,uuid)
to authenticated,service_role;

create function customer_api.create_building_setup_v1(p_context_id uuid,p_idempotency_key text,p_payload jsonb)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.create_building_setup_v1(p_context_id,p_idempotency_key,p_payload)$$;

create function customer_api.rehearse_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.rehearse_building_setup_v1(p_context_id,p_run_id)$$;

create function customer_api.submit_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.submit_building_setup_v1(p_context_id,p_run_id)$$;

create function customer_api.approve_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.approve_building_setup_v1(p_context_id,p_run_id)$$;

create function customer_api.provision_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.provision_building_setup_v1(p_context_id,p_run_id)$$;

revoke all on function
  customer_api.create_building_setup_v1(uuid,text,jsonb),
  customer_api.rehearse_building_setup_v1(uuid,uuid),
  customer_api.submit_building_setup_v1(uuid,uuid),
  customer_api.approve_building_setup_v1(uuid,uuid),
  customer_api.provision_building_setup_v1(uuid,uuid)
from public,anon;
grant execute on function
  customer_api.create_building_setup_v1(uuid,text,jsonb),
  customer_api.rehearse_building_setup_v1(uuid,uuid),
  customer_api.submit_building_setup_v1(uuid,uuid),
  customer_api.approve_building_setup_v1(uuid,uuid),
  customer_api.provision_building_setup_v1(uuid,uuid)
to authenticated,service_role;

comment on function customer_api.create_building_setup_v1(uuid,text,jsonb) is 'Invoker-only Data API gateway to guarded private setup implementation.';
comment on function customer_api.rehearse_building_setup_v1(uuid,uuid) is 'Invoker-only Data API gateway to zero-write opening balance rehearsal.';
comment on function customer_api.submit_building_setup_v1(uuid,uuid) is 'Invoker-only Data API gateway to guarded setup submission.';
comment on function customer_api.approve_building_setup_v1(uuid,uuid) is 'Invoker-only Data API gateway to AAL2 dual-control approval.';
comment on function customer_api.provision_building_setup_v1(uuid,uuid) is 'Invoker-only Data API gateway to idempotent atomic provisioning.';

commit;
