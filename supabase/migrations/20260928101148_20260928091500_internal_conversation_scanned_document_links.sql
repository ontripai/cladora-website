begin;

-- A staff member may share only a clean version of a document they uploaded
-- with the current participants of one internal conversation. This table has
-- no direct authenticated access: every read rechecks the live assignment.
create table platform.internal_message_documents (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references platform.internal_threads(id) on delete restrict,
  message_id uuid not null references platform.internal_messages(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete restrict,
  version_id uuid not null references documents.document_versions(id) on delete restrict,
  attached_by uuid not null references platform.platform_users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique(message_id,document_id,version_id)
);
create index internal_message_documents_thread_idx on platform.internal_message_documents(thread_id,message_id);
alter table platform.internal_message_documents enable row level security;
revoke all on platform.internal_message_documents from public,anon,authenticated;
grant all on platform.internal_message_documents to service_role;

create function customer_api.my_internal_identity_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  return jsonb_build_object('id',v_user);
end; $$;

create function customer_api.attach_internal_document_v1(
  p_thread_id uuid,p_message_id uuid,p_document_id uuid,p_version_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
  v_attachment uuid; v_tenant uuid;
begin
  if v_user is null or not platform.can_read_internal(p_thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  select w.tenant_id into v_tenant from platform.internal_threads t
    join platform.customer_workspaces w on w.id=t.workspace_id where t.id=p_thread_id;
  if not exists(select 1 from platform.internal_messages m
      where m.id=p_message_id and m.thread_id=p_thread_id and m.sender_id=v_user)
    or not exists(select 1 from documents.documents d
      join documents.document_versions v on v.document_id=d.id
      where d.id=p_document_id and v.id=p_version_id and d.tenant_id=v_tenant
        and v.tenant_id=v_tenant and d.created_by=auth.uid() and v.uploaded_by=auth.uid()
        and d.status='active' and d.deleted_at is null and v.scanning_status='clean') then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  insert into platform.internal_message_documents(thread_id,message_id,document_id,version_id,attached_by)
    values(p_thread_id,p_message_id,p_document_id,p_version_id,v_user)
    on conflict(message_id,document_id,version_id) do nothing returning id into v_attachment;
  if v_attachment is null then
    select id into v_attachment from platform.internal_message_documents
      where message_id=p_message_id and document_id=p_document_id and version_id=p_version_id;
    return jsonb_build_object('attachment_id',v_attachment,'replayed',true); end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'internal_document.attach','platform.internal_message_document',v_attachment,
      jsonb_build_object('thread_id',p_thread_id,'document_id',p_document_id,'version_id',p_version_id));
  return jsonb_build_object('attachment_id',v_attachment,'replayed',false);
end; $$;

create function customer_api.list_internal_attachments_v1(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or not platform.can_read_internal(p_thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'message_id',a.message_id,
    'title',d.title,'created_at',a.created_at) order by a.created_at,a.id)
    from platform.internal_message_documents a
    join documents.documents d on d.id=a.document_id
    join documents.document_versions v on v.id=a.version_id and v.document_id=d.id
    where a.thread_id=p_thread_id and v.scanning_status='clean' and d.status='active'
      and d.deleted_at is null),'[]'::jsonb);
end; $$;

create function customer_api.list_internal_attachable_documents_v1(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or not platform.can_read_internal(p_thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.title,q.id)
    from (select d.id,d.title,v.id as version_id
      from platform.internal_threads t
      join platform.customer_workspaces w on w.id=t.workspace_id
      join documents.documents d on d.tenant_id=w.tenant_id
      join documents.document_versions v on v.document_id=d.id and v.version=d.current_version
      where t.id=p_thread_id and d.created_by=auth.uid() and v.uploaded_by=auth.uid()
        and d.status='active' and d.deleted_at is null and v.scanning_status='clean'
      order by d.title,d.id limit 100) q),'[]'::jsonb);
end; $$;

-- The authorized server route signs the Storage path with a short expiry.
-- Direct RPC callers still cannot read private Storage objects without a
-- signature, and every RPC invocation rechecks the participant and assignment.
create function customer_api.authorize_internal_attachment_download_v1(p_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
  v_rec record;
begin
  select a.thread_id,a.document_id,a.version_id,d.tenant_id,d.title,v.object_path,
    v.mime_type,v.size_bytes,v.sha256 into v_rec
  from platform.internal_message_documents a
  join platform.internal_threads t on t.id=a.thread_id
  join platform.customer_workspaces w on w.id=t.workspace_id
  join documents.documents d on d.id=a.document_id and d.tenant_id=w.tenant_id
  join documents.document_versions v on v.id=a.version_id and v.document_id=d.id
    and v.tenant_id=d.tenant_id
  where a.id=p_attachment_id and d.status='active' and d.deleted_at is null
    and v.scanning_status='clean';
  if v_rec.thread_id is null or v_user is null
    or not platform.can_read_internal(v_rec.thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  insert into documents.access_events(tenant_id,document_id,version_id,actor_id,action,purpose)
    values(v_rec.tenant_id,v_rec.document_id,v_rec.version_id,auth.uid(),
      'internal_message_download','Authorized internal conversation attachment download');
  return jsonb_build_object('bucket_id','document-vault','object_path',v_rec.object_path,
    'mime_type',v_rec.mime_type,'size_bytes',v_rec.size_bytes,'sha256',v_rec.sha256,
    'title',v_rec.title,'expires_in_seconds',60);
end; $$;

revoke all on function customer_api.my_internal_identity_v1(),
  customer_api.attach_internal_document_v1(uuid,uuid,uuid,uuid),
  customer_api.list_internal_attachments_v1(uuid),
  customer_api.list_internal_attachable_documents_v1(uuid),
  customer_api.authorize_internal_attachment_download_v1(uuid) from public,anon;
grant execute on function customer_api.my_internal_identity_v1(),
  customer_api.attach_internal_document_v1(uuid,uuid,uuid,uuid),
  customer_api.list_internal_attachments_v1(uuid),
  customer_api.list_internal_attachable_documents_v1(uuid),
  customer_api.authorize_internal_attachment_download_v1(uuid) to authenticated;

commit;
