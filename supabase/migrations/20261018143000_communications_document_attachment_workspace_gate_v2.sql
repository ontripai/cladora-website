begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- D6: attachment rows carry no duplicate Workspace. The two canonical stores
-- and the Core-bound transaction marker must agree exactly at write time.
create or replace function communications.validate_private_attachment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_conversation_workspace uuid;
  v_document_workspace uuid;
  v_tenant uuid;
  v_marker jsonb;
begin
  select c.workspace_id,d.workspace_id,c.tenant_id
    into v_conversation_workspace,v_document_workspace,v_tenant
  from communications.private_conversations c
  join communications.private_messages m
    on m.id=new.message_id and m.conversation_id=c.id
    and m.sender_id=new.attached_by
    and m.lifecycle_state='available'
  join documents.documents d
    on d.id=new.document_id and d.tenant_id=c.tenant_id
    and d.workspace_id=c.workspace_id
    and d.status='active'::platform.record_status
    and d.archived_at is null and d.deleted_at is null
  join documents.document_versions v
    on v.id=new.version_id and v.document_id=d.id and v.tenant_id=d.tenant_id
    and v.version=d.current_version
    and v.checksum_status='verified' and v.scanning_status='clean'
  join documents.document_scan_attestations a
    on a.version_id=v.id and a.tenant_id=v.tenant_id
    and a.provider='clamav' and a.verdict='clean'
    and a.content_sha256=v.sha256
  where c.id=new.conversation_id
    and c.workspace_id is not null
  for share of c,m,d,v,a;

  if v_conversation_workspace is null
    or v_document_workspace is distinct from v_conversation_workspace
  then
    raise exception using
      errcode='42501', message='private_attachment_workspace_mismatch';
  end if;

  begin
    v_marker := nullif(current_setting(
      'communications.document_attachment_workspace_gate_v2', true
    ), '')::jsonb;
  exception when others then
    v_marker := null;
  end;

  if v_marker is null
    or v_marker->>'contract_version'
      <> 'communications-document-attachment-workspace.v2'
    or v_marker->>'tenant_id' <> v_tenant::text
    or v_marker->>'workspace_id' <> v_conversation_workspace::text
    or v_marker->>'conversation_id' <> new.conversation_id::text
    or v_marker->>'message_id' <> new.message_id::text
    or v_marker->>'document_id' <> new.document_id::text
    or v_marker->>'version_id' <> new.version_id::text
    or v_marker->>'attached_by' <> new.attached_by::text
  then
    raise exception using
      errcode='42501', message='canonical_private_attachment_writer_required';
  end if;

  return new;
end;
$$;

alter function communications.validate_private_attachment() owner to postgres;
revoke all on function communications.validate_private_attachment()
  from public,anon,authenticated,service_role,cladora_rpc_owner,
    cladora_ce_guide_runtime,cladora_ce_guide_executor;

-- Preserve the existing helper identity while making Workspace equality an
-- unconditional prerequisite. D6 creates no grants or participant permission.
create or replace function communications.private_document_member_grant(
  p_conversation_id uuid,
  p_document_id uuid,
  p_membership_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path=pg_catalog
as $$
  select exists (
    select 1
    from communications.private_conversations c
    join documents.documents d
      on d.id=p_document_id and d.tenant_id=c.tenant_id
      and d.workspace_id=c.workspace_id
      and d.status='active'::platform.record_status
      and d.archived_at is null and d.deleted_at is null
    join communications.private_participants participant
      on participant.conversation_id=c.id
      and participant.membership_id=p_membership_id
      and participant.revoked_at is null
    join documents.document_permissions permission
      on permission.document_id=d.id and permission.tenant_id=d.tenant_id
      and permission.membership_id=participant.membership_id
      and permission.permission='view'
      and permission.valid_from<=statement_timestamp()
      and (permission.valid_until is null
        or permission.valid_until>statement_timestamp())
    where c.id=p_conversation_id and c.workspace_id is not null
  );
$$;

alter function communications.private_document_member_grant(uuid,uuid,uuid)
  owner to postgres;
revoke all on function communications.private_document_member_grant(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,cladora_rpc_owner,
    cladora_ce_guide_runtime,cladora_ce_guide_executor;

-- V1 signatures have no exact Core Workspace input. Retain their identities
-- only as deterministic pre-activation tombstones; application rollback is to
-- maintenance, never to tenant/property inference or participant auto-grant.
create or replace function customer_api.attach_private_document_v1(
  p_context_id uuid,p_conversation_id uuid,p_message_id uuid,
  p_document_id uuid,p_version_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_private_attachment_required';
end;
$$;

create or replace function customer_api.list_private_attachments_v1(
  p_context_id uuid,p_conversation_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_private_attachment_required';
end;
$$;

create or replace function customer_api.authorize_private_attachment_download_v1(
  p_context_id uuid,p_attachment_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_private_attachment_required';
end;
$$;

create or replace function customer_api.list_attachable_private_documents_v1(
  p_context_id uuid,p_conversation_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_private_attachment_required';
end;
$$;

create or replace function customer_api.send_private_file_v1(
  p_context_id uuid,p_conversation_id uuid,p_document_id uuid,
  p_version_id uuid,p_request_id uuid
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_private_attachment_required';
end;
$$;

create or replace function customer_api.my_private_file_scan_status_v1(
  p_context_id uuid,p_conversation_id uuid,p_document_id uuid,p_version_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',message='canonical_private_attachment_required';
end;
$$;

alter function customer_api.attach_private_document_v1(uuid,uuid,uuid,uuid,uuid)
  owner to postgres;
alter function customer_api.list_private_attachments_v1(uuid,uuid)
  owner to postgres;
alter function customer_api.authorize_private_attachment_download_v1(uuid,uuid)
  owner to postgres;
alter function customer_api.list_attachable_private_documents_v1(uuid,uuid)
  owner to postgres;
alter function customer_api.send_private_file_v1(uuid,uuid,uuid,uuid,uuid)
  owner to postgres;
alter function customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid)
  owner to postgres;

revoke all on function
  customer_api.attach_private_document_v1(uuid,uuid,uuid,uuid,uuid),
  customer_api.list_private_attachments_v1(uuid,uuid),
  customer_api.authorize_private_attachment_download_v1(uuid,uuid),
  customer_api.list_attachable_private_documents_v1(uuid,uuid),
  customer_api.send_private_file_v1(uuid,uuid,uuid,uuid,uuid),
  customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid)
from public,anon,authenticated,service_role,cladora_rpc_owner,
  cladora_ce_guide_runtime,cladora_ce_guide_executor;

commit;
