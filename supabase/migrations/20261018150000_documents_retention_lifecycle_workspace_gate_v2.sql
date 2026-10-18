begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D7 is an inactive, read-only Core preflight. These V1 entrypoints have no
-- exact Workspace/current-version/committed-artifact contract and therefore
-- cannot remain as a compatibility mutation path.
create or replace function documents.place_legal_hold_internal(
  p_context_id uuid,p_document_id uuid,p_reason text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function documents.release_legal_hold_internal(
  p_context_id uuid,p_document_id uuid,p_release_reason text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function documents.request_disposition_internal(
  p_context_id uuid,p_document_id uuid,p_reason text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function documents.approve_disposition_internal(
  p_context_id uuid,p_request_id uuid,p_decision text,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function documents.assign_retention_policy_internal(
  p_context_id uuid,p_document_id uuid,p_policy_code text,
  p_basis text default 'standard_statutory'
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function customer_api.place_legal_hold_v1(
  p_context_id uuid,p_document_id uuid,p_reason text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function customer_api.release_legal_hold_v1(
  p_context_id uuid,p_document_id uuid,p_release_reason text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function customer_api.request_document_disposition_v1(
  p_context_id uuid,p_document_id uuid,p_reason text
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function customer_api.approve_document_disposition_v1(
  p_context_id uuid,p_request_id uuid,p_decision text,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

create or replace function customer_api.assign_retention_policy_v1(
  p_context_id uuid,p_document_id uuid,p_policy_code text,
  p_basis text default 'standard_statutory'
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_document_retention_preflight_required';
end;
$$;

alter function documents.place_legal_hold_internal(uuid,uuid,text) owner to postgres;
alter function documents.release_legal_hold_internal(uuid,uuid,text) owner to postgres;
alter function documents.request_disposition_internal(uuid,uuid,text) owner to postgres;
alter function documents.approve_disposition_internal(uuid,uuid,text,text) owner to postgres;
alter function documents.assign_retention_policy_internal(uuid,uuid,text,text) owner to postgres;
alter function customer_api.place_legal_hold_v1(uuid,uuid,text) owner to postgres;
alter function customer_api.release_legal_hold_v1(uuid,uuid,text) owner to postgres;
alter function customer_api.request_document_disposition_v1(uuid,uuid,text) owner to postgres;
alter function customer_api.approve_document_disposition_v1(uuid,uuid,text,text) owner to postgres;
alter function customer_api.assign_retention_policy_v1(uuid,uuid,text,text) owner to postgres;

revoke all on function
  documents.place_legal_hold_internal(uuid,uuid,text),
  documents.release_legal_hold_internal(uuid,uuid,text),
  documents.request_disposition_internal(uuid,uuid,text),
  documents.approve_disposition_internal(uuid,uuid,text,text),
  documents.assign_retention_policy_internal(uuid,uuid,text,text),
  customer_api.place_legal_hold_v1(uuid,uuid,text),
  customer_api.release_legal_hold_v1(uuid,uuid,text),
  customer_api.request_document_disposition_v1(uuid,uuid,text),
  customer_api.approve_document_disposition_v1(uuid,uuid,text,text),
  customer_api.assign_retention_policy_v1(uuid,uuid,text,text)
from public,anon,authenticated,service_role,cladora_rpc_owner,
  cladora_ce_guide_runtime,cladora_ce_guide_executor;

commit;
