begin;

-- Keep privileged onboarding mutations outside the exposed PostgREST schema.
alter function customer_api.list_import_templates_v1(uuid) set schema app_private;
alter function app_private.list_import_templates_v1(uuid) rename to onboarding_list_import_templates_internal_v1;
alter function customer_api.create_import_run_v1(uuid,uuid,text) set schema app_private;
alter function app_private.create_import_run_v1(uuid,uuid,text) rename to onboarding_create_import_run_internal_v1;
alter function customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb) set schema app_private;
alter function app_private.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb) rename to onboarding_add_import_source_internal_v1;
alter function customer_api.validate_import_v1(uuid,uuid) set schema app_private;
alter function app_private.validate_import_v1(uuid,uuid) rename to onboarding_validate_import_internal_v1;
alter function customer_api.dry_run_import_v1(uuid,uuid) set schema app_private;
alter function app_private.dry_run_import_v1(uuid,uuid) rename to onboarding_dry_run_import_internal_v1;
alter function customer_api.submit_import_v1(uuid,uuid) set schema app_private;
alter function app_private.submit_import_v1(uuid,uuid) rename to onboarding_submit_import_internal_v1;
alter function customer_api.approve_import_commit_v1(uuid,uuid) set schema app_private;
alter function app_private.approve_import_commit_v1(uuid,uuid) rename to onboarding_approve_import_commit_internal_v1;
alter function customer_api.get_import_preview_v1(uuid,uuid) set schema app_private;
alter function app_private.get_import_preview_v1(uuid,uuid) rename to onboarding_get_import_preview_internal_v1;
alter function customer_api.cancel_import_v1(uuid,uuid) set schema app_private;
alter function app_private.cancel_import_v1(uuid,uuid) rename to onboarding_cancel_import_internal_v1;
alter function customer_api.activate_import_v1(uuid,uuid) set schema app_private;
alter function app_private.activate_import_v1(uuid,uuid) rename to onboarding_activate_import_internal_v1;

create function customer_api.list_import_templates_v1(p_context_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$ select app_private.onboarding_list_import_templates_internal_v1(p_context_id) $$;
create function customer_api.create_import_run_v1(p_context_id uuid,p_property_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_create_import_run_internal_v1(p_context_id,p_property_id,p_idempotency_key) $$;
create function customer_api.add_import_source_v1(p_context_id uuid,p_run_id uuid,p_template_code text,p_filename text,p_media_type text,p_byte_size bigint,p_sha256 text,p_rows jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_add_import_source_internal_v1(p_context_id,p_run_id,p_template_code,p_filename,p_media_type,p_byte_size,p_sha256,p_rows) $$;
create function customer_api.validate_import_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_validate_import_internal_v1(p_context_id,p_run_id) $$;
create function customer_api.dry_run_import_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_dry_run_import_internal_v1(p_context_id,p_run_id) $$;
create function customer_api.submit_import_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_submit_import_internal_v1(p_context_id,p_run_id) $$;
create function customer_api.approve_import_commit_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_approve_import_commit_internal_v1(p_context_id,p_run_id) $$;
create function customer_api.get_import_preview_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$ select app_private.onboarding_get_import_preview_internal_v1(p_context_id,p_run_id) $$;
create function customer_api.cancel_import_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_cancel_import_internal_v1(p_context_id,p_run_id) $$;
create function customer_api.activate_import_v1(p_context_id uuid,p_run_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select app_private.onboarding_activate_import_internal_v1(p_context_id,p_run_id) $$;

revoke all on all functions in schema app_private from public,anon;
grant usage on schema app_private to authenticated,service_role;
grant execute on function app_private.onboarding_list_import_templates_internal_v1(uuid),app_private.onboarding_create_import_run_internal_v1(uuid,uuid,text),app_private.onboarding_add_import_source_internal_v1(uuid,uuid,text,text,text,bigint,text,jsonb),app_private.onboarding_validate_import_internal_v1(uuid,uuid),app_private.onboarding_dry_run_import_internal_v1(uuid,uuid),app_private.onboarding_submit_import_internal_v1(uuid,uuid),app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid),app_private.onboarding_get_import_preview_internal_v1(uuid,uuid),app_private.onboarding_cancel_import_internal_v1(uuid,uuid),app_private.onboarding_activate_import_internal_v1(uuid,uuid) to authenticated,service_role;
revoke all on all functions in schema customer_api from public,anon;
grant execute on function customer_api.list_import_templates_v1(uuid),customer_api.create_import_run_v1(uuid,uuid,text),customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb),customer_api.validate_import_v1(uuid,uuid),customer_api.dry_run_import_v1(uuid,uuid),customer_api.submit_import_v1(uuid,uuid),customer_api.approve_import_commit_v1(uuid,uuid),customer_api.get_import_preview_v1(uuid,uuid),customer_api.cancel_import_v1(uuid,uuid),customer_api.activate_import_v1(uuid,uuid) to authenticated,service_role;
comment on function customer_api.approve_import_commit_v1(uuid,uuid) is 'SECURITY INVOKER PostgREST boundary; privileged implementation is isolated in non-exposed app_private.';
commit;
