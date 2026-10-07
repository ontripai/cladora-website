begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('case-vault','case-vault',false,10485760,
  array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

create table platform.customer_case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  title text not null check(length(trim(title)) between 1 and 200),
  visibility text not null check(visibility in ('shared','internal')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default statement_timestamp()
);
create table platform.customer_case_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references platform.customer_case_documents(id) on delete restrict,
  version integer not null check(version>0),
  object_path text not null unique,
  mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size integer not null check(byte_size between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  scan_status text not null default 'pending' check(scan_status in ('pending','clean','quarantined')),
  scan_evidence text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  unique(document_id,version),
  check((scan_status='pending' and reviewed_by is null and reviewed_at is null)
    or (scan_status in ('clean','quarantined') and reviewed_by is not null
      and reviewed_at is not null and length(trim(scan_evidence))>=15))
);
create index customer_case_documents_case_idx on platform.customer_case_documents(case_id,created_at desc);
create index customer_case_document_versions_doc_idx on platform.customer_case_document_versions(document_id,version desc);
alter table platform.customer_case_documents enable row level security;
alter table platform.customer_case_document_versions enable row level security;
revoke all on platform.customer_case_documents,platform.customer_case_document_versions
  from public,anon,authenticated;

create function customer_api.begin_customer_case_document_v1(
  p_case_id uuid,p_document_id uuid,p_title text,p_visibility text,
  p_mime_type text,p_byte_size integer,p_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_staff boolean; v_doc platform.customer_case_documents; v_version platform.customer_case_document_versions; v_number integer;
begin
  v_staff:=app_private.case_staff_allowed_v1(p_case_id);
  if not v_staff and not app_private.case_customer_allowed_v1(p_case_id) then
    raise exception 'case_access_denied' using errcode='42501';
  end if;
  if not exists(select 1 from platform.customer_cases where id=p_case_id and status='open')
    or length(trim(coalesce(p_title,''))) not between 1 and 200
    or p_visibility not in ('shared','internal') or (p_visibility='internal' and not v_staff)
    or p_mime_type not in ('application/pdf','image/png','image/jpeg')
    or p_byte_size not between 1 and 10485760
    or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_document' using errcode='22023';
  end if;
  if p_document_id is null then
    insert into platform.customer_case_documents(case_id,title,visibility,created_by)
    values(p_case_id,trim(p_title),p_visibility,auth.uid()) returning * into v_doc;
  else
    select * into v_doc from platform.customer_case_documents
      where id=p_document_id and case_id=p_case_id for update;
    if not found or v_doc.visibility<>p_visibility then
      raise exception 'document_unavailable' using errcode='42501';
    end if;
  end if;
  select coalesce(max(version),0)+1 into v_number
    from platform.customer_case_document_versions where document_id=v_doc.id;
  insert into platform.customer_case_document_versions(document_id,version,object_path,
    mime_type,byte_size,sha256,uploaded_by)
  values(v_doc.id,v_number,p_case_id::text||'/'||v_doc.id::text||'/'||gen_random_uuid()::text,
    p_mime_type,p_byte_size,p_sha256,auth.uid()) returning * into v_version;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,after_snapshot)
  values(auth.uid(),case when v_staff then 'PLATFORM_CONTROL_PLANE' else 'CUSTOMER_CASE' end,
    'CUSTOMER_CASE_DOCUMENT_UPLOADED','customer_case_document_version',v_version.id,
    jsonb_build_object('case_id',p_case_id,'document_id',v_doc.id,'version',v_number,
      'visibility',v_doc.visibility,'scan_status','pending'));
  return jsonb_build_object('document_id',v_doc.id,'version_id',v_version.id,
    'object_path',v_version.object_path,'version',v_number);
end $$;

create function customer_api.get_customer_case_documents_v1(p_case_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_staff boolean; v_result jsonb;
begin
  v_staff:=app_private.case_staff_allowed_v1(p_case_id);
  if not v_staff and not app_private.case_customer_allowed_v1(p_case_id) then
    raise exception 'case_access_denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'document_id',d.id,
    'title',d.title,'visibility',d.visibility,'version',v.version,
    'scan_status',v.scan_status,'created_at',v.created_at,'uploaded_by',v.uploaded_by)
    order by v.created_at desc),'[]'::jsonb) into v_result
  from platform.customer_case_documents d
  join platform.customer_case_document_versions v on v.document_id=d.id
  where d.case_id=p_case_id and (v_staff or d.visibility='shared')
    and (v_staff or v.scan_status='clean' or v.uploaded_by=auth.uid());
  return v_result;
end $$;

create function customer_api.review_customer_case_document_v1(
  p_version_id uuid,p_verdict text,p_evidence text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_version platform.customer_case_document_versions; v_case_id uuid;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if p_verdict not in ('clean','quarantined') or length(trim(coalesce(p_evidence,'')))<15
    or length(p_evidence)>1000 then
    raise exception 'invalid_scan_evidence' using errcode='22023';
  end if;
  select * into v_version from platform.customer_case_document_versions
    where id=p_version_id and scan_status='pending' for update;
  select d.case_id into v_case_id from platform.customer_case_documents d where d.id=v_version.document_id;
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or (app_private.has_platform_role('PLATFORM_AUDITOR')
      and app_private.case_staff_allowed_v1(v_case_id))) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if not found or v_version.uploaded_by=auth.uid() then
    raise exception 'independent_review_required' using errcode='42501';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='case-vault'
    and o.name=v_version.object_path) then
    raise exception 'file_not_uploaded' using errcode='22023';
  end if;
  update platform.customer_case_document_versions set scan_status=p_verdict,
    scan_evidence=trim(p_evidence),reviewed_by=auth.uid(),reviewed_at=statement_timestamp()
    where id=v_version.id;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_DOCUMENT_REVIEWED',
    'customer_case_document_version',v_version.id,trim(p_evidence),
    jsonb_build_object('scan_status',p_verdict));
  return jsonb_build_object('version_id',v_version.id,'scan_status',p_verdict);
end $$;

create function customer_api.get_customer_case_download_v1(p_version_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_version platform.customer_case_document_versions; v_doc platform.customer_case_documents;
begin
  select * into v_version from platform.customer_case_document_versions where id=p_version_id;
  if not found then raise exception 'document_unavailable' using errcode='42501'; end if;
  select * into v_doc from platform.customer_case_documents where id=v_version.document_id;
  if not app_private.case_staff_allowed_v1(v_doc.case_id) and not (
    v_doc.visibility='shared' and app_private.case_customer_allowed_v1(v_doc.case_id)) then
    raise exception 'document_unavailable' using errcode='42501';
  end if;
  if v_version.scan_status<>'clean' then raise exception 'scan_clearance_required' using errcode='42501'; end if;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id)
  values(auth.uid(),'CUSTOMER_CASE','CUSTOMER_CASE_DOCUMENT_ACCESSED',
    'customer_case_document_version',v_version.id);
  return jsonb_build_object('bucket','case-vault','object_path',v_version.object_path,
    'mime_type',v_version.mime_type,'title',v_doc.title);
end $$;

create function customer_api.get_customer_case_inspection_v1(p_version_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v_version platform.customer_case_document_versions; v_case_id uuid;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  select * into v_version from platform.customer_case_document_versions
    where id=p_version_id and scan_status='pending';
  select d.case_id into v_case_id from platform.customer_case_documents d where d.id=v_version.document_id;
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or (app_private.has_platform_role('PLATFORM_AUDITOR')
      and app_private.case_staff_allowed_v1(v_case_id))) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if not found or v_version.uploaded_by=auth.uid() then
    raise exception 'independent_inspection_required' using errcode='42501';
  end if;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_DOCUMENT_INSPECTED',
    'customer_case_document_version',v_version.id);
  return jsonb_build_object('bucket','case-vault','object_path',v_version.object_path,
    'mime_type',v_version.mime_type);
end $$;

revoke all on function customer_api.begin_customer_case_document_v1(uuid,uuid,text,text,text,integer,text),
  customer_api.get_customer_case_documents_v1(uuid),
  customer_api.review_customer_case_document_v1(uuid,text,text),
  customer_api.get_customer_case_download_v1(uuid),
  customer_api.get_customer_case_inspection_v1(uuid) from public,anon,service_role;
grant execute on function customer_api.begin_customer_case_document_v1(uuid,uuid,text,text,text,integer,text),
  customer_api.get_customer_case_documents_v1(uuid),
  customer_api.review_customer_case_document_v1(uuid,text,text),
  customer_api.get_customer_case_download_v1(uuid),
  customer_api.get_customer_case_inspection_v1(uuid) to authenticated;

commit;
