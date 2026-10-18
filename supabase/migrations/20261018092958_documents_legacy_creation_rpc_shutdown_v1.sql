begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D1: Retain the four legacy creation entrypoint signatures so callers receive
-- a deterministic cutover error instead of falling through to a weaker writer.
-- The canonical writer is introduced separately; these routines never redirect.
create or replace function customer_api.create_upload_intent_v1(
  p_context_id uuid,
  p_document_id uuid default null,
  p_filename text default 'document.bin',
  p_declared_mime text default 'application/pdf',
  p_size_bytes bigint default 1048576,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'canonical_document_writer_required';
end;
$$;

create or replace function customer_api.finalize_upload_v1(
  p_context_id uuid,
  p_intent_id uuid,
  p_computed_sha256 text,
  p_actual_size_bytes bigint,
  p_detected_mime text,
  p_title text default null,
  p_document_type text default 'general',
  p_classification text default 'internal',
  p_property_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'canonical_document_writer_required';
end;
$$;

create or replace function documents.create_upload_intent_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_filename text,
  p_declared_mime text,
  p_size_bytes bigint,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'canonical_document_writer_required';
end;
$$;

create or replace function documents.finalize_upload_internal(
  p_context_id uuid,
  p_intent_id uuid,
  p_computed_sha256 text,
  p_actual_size_bytes bigint,
  p_detected_mime text,
  p_title text default null,
  p_document_type text default 'general',
  p_classification text default 'internal',
  p_property_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'canonical_document_writer_required';
end;
$$;

alter function customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text)
  owner to postgres;
alter function customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid)
  owner to postgres;
alter function documents.create_upload_intent_internal(uuid, uuid, text, text, bigint, text)
  owner to postgres;
alter function documents.finalize_upload_internal(uuid, uuid, text, bigint, text, text, text, text, uuid)
  owner to postgres;

revoke all on function customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;
revoke all on function customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid)
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;
revoke all on function documents.create_upload_intent_internal(uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;
revoke all on function documents.finalize_upload_internal(uuid, uuid, text, bigint, text, text, text, text, uuid)
  from public, anon, authenticated, service_role, cladora_rpc_owner,
    cladora_ce_guide_runtime, cladora_ce_guide_executor;

comment on function customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text)
  is 'D1 legacy entrypoint retained only to fail closed during canonical Documents cutover.';
comment on function customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid)
  is 'D1 legacy entrypoint retained only to fail closed during canonical Documents cutover.';
comment on function documents.create_upload_intent_internal(uuid, uuid, text, text, bigint, text)
  is 'D1 legacy entrypoint retained only to fail closed during canonical Documents cutover.';
comment on function documents.finalize_upload_internal(uuid, uuid, text, bigint, text, text, text, text, uuid)
  is 'D1 legacy entrypoint retained only to fail closed during canonical Documents cutover.';

commit;
