begin;

alter table communications.private_participants add column last_read_at timestamptz;
create table communications.private_message_documents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references communications.private_conversations(id) on delete restrict,
  message_id uuid not null references communications.private_messages(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete restrict,
  version_id uuid not null references documents.document_versions(id) on delete restrict,
  attached_by uuid not null references identity.memberships(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique(message_id,document_id,version_id)
);
create index private_message_docs_conversation_idx on communications.private_message_documents(conversation_id,message_id);
create index private_message_docs_document_idx on communications.private_message_documents(document_id);
create index private_message_docs_version_idx on communications.private_message_documents(version_id);
create index private_message_docs_attached_by_idx on communications.private_message_documents(attached_by);
alter table communications.private_message_documents enable row level security;
grant all on communications.private_message_documents to service_role;

create function communications.validate_private_attachment()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if not exists(select 1 from communications.private_messages m
    where m.id=new.message_id and m.conversation_id=new.conversation_id and m.sender_id=new.attached_by)
    or not exists(select 1 from documents.document_versions v
      where v.id=new.version_id and v.document_id=new.document_id) then
    raise exception 'private_attachment_inconsistent' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger private_attachment_integrity before insert or update on communications.private_message_documents
  for each row execute function communications.validate_private_attachment();
revoke all on function communications.validate_private_attachment() from public,anon,authenticated;

-- A document linked to a private thread requires an explicit, current vault
-- permission for EACH participant. No storage path is returned by list RPCs.
create function communications.private_document_member_grant(p_conversation_id uuid,p_document_id uuid,p_membership_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select exists (select 1 from communications.private_conversations c
    join portfolio.units u on u.id=c.unit_id join portfolio.buildings b on b.id=u.building_id
    join documents.documents d on d.id=p_document_id and d.tenant_id=c.tenant_id
      and d.property_id=b.property_id and d.status='active' and d.deleted_at is null
    join communications.private_participants p on p.conversation_id=c.id and p.membership_id=p_membership_id and p.revoked_at is null
    join documents.document_permissions perm on perm.document_id=d.id and perm.tenant_id=c.tenant_id
      and perm.membership_id=p.membership_id and perm.permission='view'
      and perm.valid_from<=statement_timestamp() and (perm.valid_until is null or perm.valid_until>statement_timestamp())
    where c.id=p_conversation_id and communications.member_covers_unit(p_membership_id,c.tenant_id,c.unit_id));
$$;
revoke all on function communications.private_document_member_grant(uuid,uuid,uuid) from public,anon,authenticated;

create function customer_api.attach_private_document_v1(p_context_id uuid,p_conversation_id uuid,p_message_id uuid,p_document_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
  v_conversation uuid; v_tenant uuid; v_attachment uuid;
begin
  select m.conversation_id,c.tenant_id into v_conversation,v_tenant
  from communications.private_messages m join communications.private_conversations c on c.id=m.conversation_id
  where m.id=p_message_id and m.sender_id=v_actor;
  if v_conversation is null or v_conversation<>p_conversation_id or not communications.can_read_private(v_conversation,v_actor)
    or not exists(select 1 from communications.private_conversations c where c.id=v_conversation
      and communications.context_covers_unit(p_context_id,c.unit_id))
    or not exists(select 1 from documents.document_versions v where v.id=p_version_id
      and v.document_id=p_document_id and v.scanning_status='clean')
    or (select count(*) from communications.private_participants p where p.conversation_id=v_conversation
      and p.revoked_at is null) < 2
    or exists(select 1 from communications.private_participants p where p.conversation_id=v_conversation
      and p.revoked_at is null and not communications.private_document_member_grant(v_conversation,p_document_id,p.membership_id))
    or not communications.private_document_member_grant(v_conversation,p_document_id,v_actor)
    then raise exception 'private_attachment_denied' using errcode='42501'; end if;
  insert into communications.private_message_documents(conversation_id,message_id,document_id,version_id,attached_by)
    values(v_conversation,p_message_id,p_document_id,p_version_id,v_actor)
    on conflict (message_id,document_id,version_id) do nothing returning id into v_attachment;
  if v_attachment is null then
    select id into v_attachment from communications.private_message_documents
      where message_id=p_message_id and document_id=p_document_id and version_id=p_version_id;
    return jsonb_build_object('attachment_id',v_attachment,'replayed',true);
  end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'private_document.attach','communications.private_message_document',v_attachment,
      jsonb_build_object('conversation_id',v_conversation,'document_id',p_document_id,'version_id',p_version_id));
  return jsonb_build_object('attachment_id',v_attachment,'replayed',false);
end; $$;

create function customer_api.list_private_attachments_v1(p_context_id uuid,p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
begin
  if not communications.can_read_private(p_conversation_id,v_actor)
    or not exists(select 1 from communications.private_conversations c where c.id=p_conversation_id
      and communications.context_covers_unit(p_context_id,c.unit_id)) then
    raise exception 'private_attachment_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'message_id',a.message_id,
      'document_id',a.document_id,'version_id',a.version_id,'title',d.title,'created_at',a.created_at)
      order by a.created_at,a.id)
    from communications.private_message_documents a join documents.documents d on d.id=a.document_id
    join documents.document_versions v on v.id=a.version_id and v.document_id=d.id
    where a.conversation_id=p_conversation_id and v.scanning_status='clean'
      and communications.private_document_member_grant(p_conversation_id,d.id,v_actor)),'[]'::jsonb);
end; $$;

create function customer_api.authorize_private_attachment_download_v1(p_context_id uuid,p_attachment_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
  v_attachment communications.private_message_documents;
begin
  select * into v_attachment from communications.private_message_documents where id=p_attachment_id;
  if v_attachment.id is null or not communications.can_read_private(v_attachment.conversation_id,v_actor)
    or not exists(select 1 from communications.private_conversations c where c.id=v_attachment.conversation_id
      and communications.context_covers_unit(p_context_id,c.unit_id))
    or not communications.private_document_member_grant(v_attachment.conversation_id,v_attachment.document_id,v_actor)
    then raise exception 'private_attachment_denied' using errcode='42501'; end if;
  -- The vault verifies the actor's document entitlement and scanner state,
  -- records document access, and returns the version's path only to the server.
  return documents.authorize_download_internal(p_context_id,v_attachment.document_id,v_attachment.version_id,false);
end; $$;

create function customer_api.list_attachable_private_documents_v1(p_context_id uuid,p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
begin
  if not communications.can_read_private(p_conversation_id,v_actor)
    or not exists(select 1 from communications.private_conversations c where c.id=p_conversation_id
      and communications.context_covers_unit(p_context_id,c.unit_id)) then
    raise exception 'private_attachment_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.title,q.id)
    from (select d.id,d.title,v.id version_id from communications.private_conversations c
      join portfolio.units u on u.id=c.unit_id join portfolio.buildings b on b.id=u.building_id
      join documents.documents d on d.tenant_id=c.tenant_id and d.property_id=b.property_id and d.status='active' and d.deleted_at is null
      join documents.document_versions v on v.document_id=d.id and v.version=d.current_version and v.scanning_status='clean'
      where c.id=p_conversation_id
        and not exists(select 1 from communications.private_participants p where p.conversation_id=c.id
          and p.revoked_at is null and not communications.private_document_member_grant(c.id,d.id,p.membership_id))
        and communications.private_document_member_grant(c.id,d.id,v_actor)
      order by d.title,d.id limit 100) q),'[]'::jsonb);
end; $$;

create function customer_api.mark_private_conversation_read_v1(p_context_id uuid,p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id); v_count integer;
begin
  if not communications.can_read_private(p_conversation_id,v_actor)
    or not exists(select 1 from communications.private_conversations c where c.id=p_conversation_id
      and communications.context_covers_unit(p_context_id,c.unit_id)) then
    raise exception 'private_conversation_denied' using errcode='42501'; end if;
  update communications.private_participants set last_read_at=clock_timestamp()
    where conversation_id=p_conversation_id and membership_id=v_actor and revoked_at is null;
  update communications.notifications set read_at=clock_timestamp()
    where membership_id=v_actor and type='private_message' and read_at is null
      and payload->>'conversation_id'=p_conversation_id::text;
  get diagnostics v_count=row_count;
  return jsonb_build_object('conversation_id',p_conversation_id,'notifications_read',v_count);
end; $$;

create function customer_api.get_private_unread_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'private_conversation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('conversation_id',c.id,'unread_count',
      (select count(*) from communications.private_messages m where m.conversation_id=c.id
        and m.sender_id<>v_actor and (p.last_read_at is null or m.sent_at>p.last_read_at))) order by c.id)
    from communications.private_conversations c
      join communications.private_participants p on p.conversation_id=c.id and p.membership_id=v_actor and p.revoked_at is null
    where communications.can_read_private(c.id,v_actor)
      and communications.context_covers_unit(p_context_id,c.unit_id)),'[]'::jsonb);
end; $$;

revoke all on function customer_api.attach_private_document_v1(uuid,uuid,uuid,uuid,uuid),
  customer_api.list_private_attachments_v1(uuid,uuid),
  customer_api.authorize_private_attachment_download_v1(uuid,uuid),
  customer_api.list_attachable_private_documents_v1(uuid,uuid),
  customer_api.mark_private_conversation_read_v1(uuid,uuid),
  customer_api.get_private_unread_v1(uuid) from public,anon;
grant execute on function customer_api.attach_private_document_v1(uuid,uuid,uuid,uuid,uuid),
  customer_api.list_private_attachments_v1(uuid,uuid),
  customer_api.authorize_private_attachment_download_v1(uuid,uuid),
  customer_api.list_attachable_private_documents_v1(uuid,uuid),
  customer_api.mark_private_conversation_read_v1(uuid,uuid),
  customer_api.get_private_unread_v1(uuid) to authenticated;

commit;
