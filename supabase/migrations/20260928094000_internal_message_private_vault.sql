begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('internal-message-vault','internal-message-vault',false,20971520,
  array['application/pdf','image/jpeg','image/png','image/webp','text/plain',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=20971520,
  allowed_mime_types=excluded.allowed_mime_types;

create table platform.internal_private_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  thread_id uuid not null references platform.internal_threads(id) on delete restrict,
  message_id uuid not null references platform.internal_messages(id) on delete restrict,
  created_by uuid not null references platform.platform_users(id) on delete restrict,
  uploader_id uuid not null references auth.users(id) on delete restrict,
  filename text not null check(length(trim(filename)) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  object_path text not null unique,
  sha256 text check(sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'authorized' check(state in ('authorized','pending','clean','quarantined')),
  expires_at timestamptz not null default statement_timestamp()+interval '15 minutes',
  scanned_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check((state='authorized' and sha256 is null and scanned_at is null)
    or (state='pending' and sha256 is not null and scanned_at is null)
    or (state in ('clean','quarantined') and sha256 is not null and scanned_at is not null))
);
create index internal_private_docs_thread_idx on platform.internal_private_documents(thread_id,message_id);
alter table platform.internal_private_documents enable row level security;
revoke all on platform.internal_private_documents from public,anon,authenticated;
grant all on platform.internal_private_documents to service_role;

create table platform.internal_private_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references platform.internal_private_documents(id) on delete restrict,
  state text not null default 'pending' check(state in ('pending','leased','retry','completed','dead_letter')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  lease_token uuid, lease_until timestamptz,
  next_attempt_at timestamptz not null default statement_timestamp(),
  last_error_code text,
  created_at timestamptz not null default statement_timestamp(),
  check((state='leased' and lease_token is not null and lease_until is not null)
    or (state<>'leased' and lease_token is null and lease_until is null))
);
create index internal_private_scan_ready_idx on platform.internal_private_scan_jobs(next_attempt_at,created_at)
  where state in ('pending','retry','leased');
alter table platform.internal_private_scan_jobs enable row level security;
revoke all on platform.internal_private_scan_jobs from public,anon,authenticated;
grant all on platform.internal_private_scan_jobs to service_role;

create table platform.internal_private_scan_attestations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references platform.internal_private_documents(id) on delete restrict,
  content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  verdict text not null check(verdict in ('clean','quarantined')),
  engine_version text not null check(length(engine_version) between 1 and 160),
  scanned_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp()
);
alter table platform.internal_private_scan_attestations enable row level security;
revoke all on platform.internal_private_scan_attestations from public,anon,authenticated;
grant select,insert on platform.internal_private_scan_attestations to service_role;
create function platform.prevent_internal_attestation_mutation() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin raise exception 'internal_scan_attestation_is_immutable' using errcode='55000'; end $$;
create trigger internal_attestation_immutable before update or delete on platform.internal_private_scan_attestations
for each row execute function platform.prevent_internal_attestation_mutation();
revoke all on function platform.prevent_internal_attestation_mutation() from public,anon,authenticated;

create function platform.protect_internal_private_document() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if tg_op='INSERT' and new.state='authorized' and new.sha256 is null then return new; end if;
  if tg_op='UPDATE' and old.state='authorized' and new.state='pending'
    and new.scanned_at is null and new.sha256 is not null
    and to_jsonb(new)-'state'-'sha256'=to_jsonb(old)-'state'-'sha256' then return new; end if;
  if tg_op='UPDATE' and old.state='pending' and new.state in ('clean','quarantined')
    and to_jsonb(new)-'state'-'scanned_at'=to_jsonb(old)-'state'-'scanned_at'
    and exists(select 1 from platform.internal_private_scan_attestations a
      where a.document_id=old.id and a.verdict=new.state and a.content_sha256=old.sha256
        and a.scanned_at=new.scanned_at) then return new; end if;
  raise exception 'internal_private_document_immutable' using errcode='55000';
end $$;
create trigger internal_private_document_protection before insert or update or delete on platform.internal_private_documents
for each row execute function platform.protect_internal_private_document();
revoke all on function platform.protect_internal_private_document() from public,anon,authenticated;

create function platform.internal_upload_allowed(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select auth.uid() is not null and exists(select 1 from platform.internal_private_documents d
    where d.object_path=p_path and d.state='authorized' and d.uploader_id=auth.uid()
      and d.expires_at>statement_timestamp() and platform.can_read_internal(d.thread_id,d.created_by));
$$;
revoke all on function platform.internal_upload_allowed(text) from public,anon;
grant execute on function platform.internal_upload_allowed(text) to authenticated;
create policy internal_message_vault_insert on storage.objects for insert to authenticated
with check(bucket_id='internal-message-vault' and platform.internal_upload_allowed(name));
-- Hosted Storage may request SELECT solely for the upload response. This is
-- never a general SELECT or download grant.
do $$ begin
  if to_regprocedure('storage.allow_only_operation(text)') is not null then
    execute $policy$
      create policy internal_message_vault_upload_returning_select on storage.objects
      for select to authenticated using (
        bucket_id='internal-message-vault' and storage.allow_only_operation('object.upload')
        and platform.internal_upload_allowed(name)
      )
    $policy$;
  end if;
end $$;
-- No authenticated general SELECT, UPDATE or DELETE policy is installed.

create function customer_api.begin_internal_private_upload_v1(
  p_thread_id uuid,p_message_id uuid,p_filename text,p_mime text,p_size_bytes bigint
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id(); v_tenant uuid;
  v_id uuid := gen_random_uuid(); v_path text; v_ext text;
begin
  if v_user is null or not platform.can_read_internal(p_thread_id,v_user)
    or not exists(select 1 from platform.internal_messages m
      where m.id=p_message_id and m.thread_id=p_thread_id and m.sender_id=v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  v_ext:=lower(substring(p_filename from '\.([^\.]+)$'));
  if length(trim(coalesce(p_filename,''))) not between 1 and 255
    or v_ext in ('exe','sh','bat','cmd','js','mjs','ts','html','htm','svg','php','py','zip','tar','gz','rar')
    or p_mime not in ('application/pdf','image/jpeg','image/png','image/webp','text/plain',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    or p_size_bytes not between 1 and 20971520 then
    raise exception 'invalid_internal_document' using errcode='22023'; end if;
  select w.tenant_id into v_tenant from platform.internal_threads t
    join platform.customer_workspaces w on w.id=t.workspace_id where t.id=p_thread_id;
  v_path:=v_tenant::text||'/'||v_id::text||'/internal.'||coalesce(v_ext,'bin');
  insert into platform.internal_private_documents(id,tenant_id,thread_id,message_id,created_by,
    uploader_id,filename,mime_type,size_bytes,object_path)
  values(v_id,v_tenant,p_thread_id,p_message_id,v_user,auth.uid(),trim(p_filename),p_mime,p_size_bytes,v_path);
  return jsonb_build_object('intent_id',v_id,'object_path',v_path,'bucket_id','internal-message-vault');
end $$;

create function customer_api.finish_internal_private_upload_v1(
  p_intent_id uuid,p_path text,p_sha256 text,p_size_bytes bigint,p_mime text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id(); v_doc platform.internal_private_documents;
begin
  select * into v_doc from platform.internal_private_documents where id=p_intent_id for update;
  if v_doc.id is null or v_user is null or v_doc.created_by<>v_user or v_doc.uploader_id<>auth.uid()
    or v_doc.state<>'authorized' or v_doc.expires_at<=statement_timestamp()
    or v_doc.object_path<>p_path or not platform.can_read_internal(v_doc.thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or p_size_bytes<>v_doc.size_bytes or p_mime<>v_doc.mime_type
    or not exists(select 1 from storage.objects o where o.bucket_id='internal-message-vault'
      and o.name=v_doc.object_path) then
    raise exception 'internal_document_invalid' using errcode='22023'; end if;
  update platform.internal_private_documents set state='pending',sha256=p_sha256 where id=v_doc.id;
  insert into platform.internal_private_scan_jobs(document_id) values(v_doc.id);
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
  values(v_doc.tenant_id,auth.uid(),'internal_private_document.upload','platform.internal_private_document',v_doc.id,
    jsonb_build_object('thread_id',v_doc.thread_id,'scan_state','pending'));
  return jsonb_build_object('document_id',v_doc.id,'scan_state','pending');
end $$;

create function customer_api.list_internal_private_documents_v1(p_thread_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or not platform.can_read_internal(p_thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'message_id',d.message_id,
    'filename',d.filename,'scan_state',d.state,'created_at',d.created_at) order by d.created_at,d.id)
    from platform.internal_private_documents d where d.thread_id=p_thread_id
      and (d.state='clean' or (d.uploader_id=auth.uid() and d.state in ('authorized','pending')))),
    '[]'::jsonb);
end $$;

create function customer_api.authorize_internal_private_download_v1(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id(); v_doc platform.internal_private_documents;
begin
  select * into v_doc from platform.internal_private_documents where id=p_document_id;
  if v_user is null or v_doc.id is null or v_doc.state<>'clean'
    or not platform.can_read_internal(v_doc.thread_id,v_user) then
    raise exception 'internal_document_denied' using errcode='42501'; end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_doc.tenant_id,auth.uid(),'internal_private_document.download',
      'platform.internal_private_document',v_doc.id);
  return jsonb_build_object('bucket_id','internal-message-vault','object_path',v_doc.object_path);
end $$;

revoke all on function customer_api.begin_internal_private_upload_v1(uuid,uuid,text,text,bigint),
  customer_api.finish_internal_private_upload_v1(uuid,text,text,bigint,text),
  customer_api.list_internal_private_documents_v1(uuid),
  customer_api.authorize_internal_private_download_v1(uuid) from public,anon;
grant execute on function customer_api.begin_internal_private_upload_v1(uuid,uuid,text,text,bigint),
  customer_api.finish_internal_private_upload_v1(uuid,text,text,bigint,text),
  customer_api.list_internal_private_documents_v1(uuid),
  customer_api.authorize_internal_private_download_v1(uuid) to authenticated;

commit;
