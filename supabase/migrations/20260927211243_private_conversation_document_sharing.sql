begin;

-- New roles must also lose direct vault metadata access when their company
-- assignment or vendor contract expires. The existing resident RLS applies.
create function documents.private_role_property_access(p_property uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select case when not exists(select 1 from identity.memberships m join identity.roles r on r.id=m.role_id
      where m.id=app_private.active_membership_id() and r.code in ('company_staff','vendor_contact')) then true
    when p_property is null then false
    else exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
      where b.property_id=p_property and u.status='active'
        and communications.member_covers_unit(app_private.active_membership_id(),u.tenant_id,u.id)) end;
$$;
revoke all on function documents.private_role_property_access(uuid) from public,anon,authenticated;

drop policy documents_context_read on documents.documents;
create policy documents_context_read on documents.documents for select to authenticated
using(tenant_id=app_private.active_tenant_id()
  and (property_id is null or app_private.can_access_property(property_id))
  and documents.private_role_property_access(property_id));
drop policy document_versions_context_read on documents.document_versions;
create policy document_versions_context_read on documents.document_versions for select to authenticated
using(tenant_id=app_private.active_tenant_id() and exists(select 1 from documents.documents d
  where d.id=document_id and (d.property_id is null or app_private.can_access_property(d.property_id))
    and documents.private_role_property_access(d.property_id)));
drop policy folders_context_read on documents.folders;
create policy folders_context_read on documents.folders for select to authenticated
using(tenant_id=app_private.active_tenant_id() and (property_id is null or app_private.can_access_property(property_id))
  and documents.private_role_property_access(property_id));
drop policy document_links_context_read on documents.document_links;
create policy document_links_context_read on documents.document_links for select to authenticated
using(tenant_id=app_private.active_tenant_id() and exists(select 1 from documents.documents d
  where d.id=document_id and (d.property_id is null or app_private.can_access_property(d.property_id))
    and documents.private_role_property_access(d.property_id)));

create or replace function documents.resolve_vault_actor(
  p_context_id uuid,
  p_permission text,
  p_require_aal2 boolean default false
)
returns table (
  tenant_id uuid,
  membership_id uuid,
  party_id uuid,
  user_id uuid,
  role_code text,
  scope_type text,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  aal text
) language plpgsql stable security definer set search_path = pg_catalog, identity, platform as $$
declare
  v_rec record;
  v_aal text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  v_aal := coalesce(auth.jwt()->>'aal', 'aal1');
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'mfa_aal2_required' using errcode = '42501';
  end if;

  select
    g.tenant_id,
    g.membership_id,
    m.user_id,
    r.code as role_code,
    g.scope_type::text as scope_type,
    g.property_id,
    g.building_id,
    g.unit_id
  into v_rec
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if lower(v_rec.role_code) in ('company_staff','vendor_contact') and not exists (
    select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
    where u.tenant_id=v_rec.tenant_id and u.status='active'
      and ((v_rec.scope_type='property' and b.property_id=v_rec.property_id)
        or (v_rec.scope_type='building' and b.id=v_rec.building_id)
        or (v_rec.scope_type='unit' and u.id=v_rec.unit_id))
      and communications.member_covers_unit(v_rec.membership_id,v_rec.tenant_id,u.id)
  ) then raise exception 'relationship_expired' using errcode='42501'; end if;

  -- Entitlement check: module.documents
  if not exists (
    select 1
    from platform.customer_workspaces w
    join platform.workspace_entitlements e on e.customer_workspace_id = w.id
    where w.tenant_id = v_rec.tenant_id
      and w.lifecycle_status = 'ACTIVE'
      and e.entitlement_key = 'module.documents'
      and e.valid_from <= statement_timestamp()
      and (e.valid_until is null or e.valid_until > statement_timestamp())
      and e.boolean_value = true
  ) then
    raise exception 'documents_module_not_entitled' using errcode = '42501';
  end if;

  -- Permission check
  if not exists (
    select 1
    from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    join identity.roles r on r.id = rp.role_id
    where lower(r.code) = lower(v_rec.role_code)
      and p.code = p_permission
      and rp.effect = 'allow'
  ) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return query select
    v_rec.tenant_id,
    v_rec.membership_id,
    null::uuid as party_id,
    v_rec.user_id,
    v_rec.role_code,
    v_rec.scope_type,
    v_rec.property_id,
    v_rec.building_id,
    v_rec.unit_id,
    v_aal;
end;
$$;

create or replace function customer_api.attach_private_document_v1(p_context_id uuid,p_conversation_id uuid,p_message_id uuid,p_document_id uuid,p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
  v_conversation uuid; v_tenant uuid; v_attachment uuid; v_owner uuid; v_property uuid; v_recipient uuid;
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
    then raise exception 'private_attachment_denied' using errcode='42501'; end if;
  select d.created_by,d.property_id into v_owner,v_property from documents.documents d
    where d.id=p_document_id and d.tenant_id=v_tenant and d.status='active' and d.deleted_at is null;
  if v_owner=auth.uid() and v_property is not null
    and exists(select 1 from communications.private_conversations c
      join portfolio.units u on u.id=c.unit_id join portfolio.buildings b on b.id=u.building_id
      where c.id=v_conversation and b.property_id=v_property) then
    -- Selecting Attach is an explicit grant to the active participants.
    -- An actor cannot share a document uploaded by someone else.
    perform 1 from documents.resolve_vault_actor(p_context_id,'documents.vault.read',false);
    for v_recipient in select p.membership_id from communications.private_participants p
      where p.conversation_id=v_conversation and p.revoked_at is null loop
      if not communications.private_document_member_grant(v_conversation,p_document_id,v_recipient) then
        insert into documents.document_permissions(tenant_id,document_id,membership_id,permission)
          values(v_tenant,p_document_id,v_recipient,'view');
        insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
          values(v_tenant,auth.uid(),'private_document.grant','documents.document',p_document_id,
            jsonb_build_object('conversation_id',v_conversation,'recipient_membership_id',v_recipient));
      end if;
    end loop;
  end if;
  if exists(select 1 from communications.private_participants p where p.conversation_id=v_conversation
      and p.revoked_at is null and not communications.private_document_member_grant(v_conversation,p_document_id,p.membership_id))
    or not communications.private_document_member_grant(v_conversation,p_document_id,v_actor) then
    raise exception 'private_attachment_denied' using errcode='42501';
  end if;
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


create or replace function customer_api.list_attachable_private_documents_v1(p_context_id uuid,p_conversation_id uuid)
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
        and (
          (not exists(select 1 from communications.private_participants p where p.conversation_id=c.id
            and p.revoked_at is null and not communications.private_document_member_grant(c.id,d.id,p.membership_id))
            and communications.private_document_member_grant(c.id,d.id,v_actor))
          or (d.created_by=auth.uid() and exists(select 1 from platform.customer_workspaces w
              join platform.workspace_entitlements e on e.customer_workspace_id=w.id
              where w.tenant_id=c.tenant_id and w.lifecycle_status='ACTIVE'
                and e.entitlement_key='module.documents' and e.boolean_value is true
                and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp()))
            and exists(select 1 from identity.memberships m
              join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
              join identity.permissions perm on perm.id=rp.permission_id and perm.code='documents.vault.read'
              where m.id=v_actor))
        )
      order by d.title,d.id limit 100) q),'[]'::jsonb);
end; $$;


commit;
