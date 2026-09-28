begin;

-- Keep private Supabase Storage; deny direct browser reads of deferred uploads.
-- Storage INSERT alone suffices for upsert:false, and server signing occurs only
-- after the document authorization RPC. Existing immutable versions are intact.
drop policy if exists document_vault_tenant_select on storage.objects;

create or replace function documents.authorize_download_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_version_id uuid default null,
  p_admin_inspection boolean default false
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_doc documents.documents;
  v_ver documents.document_versions;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.read', false);

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  -- Apply scope and role rules at download time. Private-thread documents may
  -- additionally be viewed with an explicit permission and live relationship.
  -- Every download requires a currently AAL2-authenticated session.
  if v_actor.aal <> 'aal2' or v_doc.deleted_at is not null or v_doc.status <> 'active' then
    raise exception 'document_download_access_denied' using errcode='42501';
  end if;
  if not (
    (documents.customer_document_scope_matches(v_actor.scope_type,v_actor.property_id,
       v_actor.building_id,v_actor.unit_id,v_doc.property_id)
     and case lower(v_actor.role_code)
       when 'association_admin' then true
       when 'property_manager' then v_doc.classification<>'restricted'
       when 'president' then v_doc.classification<>'restricted' and
         (v_doc.document_type ilike 'governance%' or exists(select 1 from documents.document_links l
           where l.document_id=v_doc.id and l.entity_type in ('governance.meeting','governance.resolution')))
       when 'censor' then v_doc.classification<>'restricted' and
         (v_doc.document_type ilike any(array['audit%','financial%','governance%'])
          or exists(select 1 from documents.document_links l where l.document_id=v_doc.id
            and l.entity_type in ('finance.journal','billing.invoice','governance.meeting','governance.resolution'))
          or exists(select 1 from documents.document_audit_links l where l.document_id=v_doc.id))
       when 'owner' then v_doc.classification<>'restricted' and
         exists(select 1 from documents.document_links l where l.document_id=v_doc.id
           and l.entity_type='portfolio.unit' and l.entity_id=v_actor.unit_id)
         and communications.member_covers_unit(v_actor.membership_id,v_actor.tenant_id,v_actor.unit_id)
       when 'tenant_resident' then v_doc.classification='public' and
         communications.member_covers_unit(v_actor.membership_id,v_actor.tenant_id,v_actor.unit_id)
       else false end)
    or exists(select 1 from documents.document_permissions perm
       join portfolio.buildings b on b.property_id=v_doc.property_id and b.tenant_id=v_actor.tenant_id
       join portfolio.units u on u.building_id=b.id and u.tenant_id=v_actor.tenant_id and u.status='active'
       where perm.document_id=v_doc.id and perm.tenant_id=v_actor.tenant_id
         and perm.permission='view' and perm.membership_id=v_actor.membership_id
         and perm.valid_from<=statement_timestamp()
         and (perm.valid_until is null or perm.valid_until>statement_timestamp())
         and communications.member_covers_unit(v_actor.membership_id,v_actor.tenant_id,u.id)
         and communications.context_covers_unit(p_context_id,u.id))
  ) then
    raise exception 'document_download_access_denied' using errcode='42501';
  end if;

  if p_version_id is not null then
    select * into v_ver from documents.document_versions where id = p_version_id and document_id = p_document_id;
  else
    select * into v_ver from documents.document_versions where document_id = p_document_id and version = v_doc.current_version;
  end if;

  if not found then
    raise exception 'document_version_not_found' using errcode = '22000';
  end if;

  -- Quarantine check: quarantined files cannot be downloaded
  if v_ver.scanning_status = 'quarantined' then
    raise exception 'quarantined_file_cannot_download' using errcode = '42501';
  end if;

  -- Scanning pending check: pending files cannot be downloaded
  if v_ver.scanning_status = 'scanning_pending' then
    raise exception 'pending_scanner_cannot_download' using errcode = '42501';
  end if;

  -- Scanner-Deferred Fail Closed Check: normal signed download strictly denied
  if v_ver.scanning_status = 'deferred' and not coalesce(p_admin_inspection, false) then
    raise exception 'deferred_scanner_cannot_normal_download' using errcode = '42501';
  end if;

  -- Admin Inspection: requires AAL2 and admin / manager role
  if v_ver.scanning_status = 'deferred' and coalesce(p_admin_inspection, false) then
    if v_actor.aal <> 'aal2' then
      raise exception 'admin_inspection_aal2_required' using errcode = '42501';
    end if;
    if v_actor.role_code not in ('association_admin', 'property_manager', 'president') then
      raise exception 'admin_inspection_permission_denied' using errcode = '42501';
    end if;
  end if;

  -- Record access event
  insert into documents.access_events (
    tenant_id, document_id, version_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, p_document_id, v_ver.id, v_actor.user_id,
    case when coalesce(p_admin_inspection, false) then 'admin_inspection_download' else 'authorized_download' end,
    case when coalesce(p_admin_inspection, false) then 'Admin inspection signed download requested' else 'Authorized signed download requested' end
  );

  return jsonb_build_object(
    'document_id', p_document_id,
    'version_id', v_ver.id,
    'bucket_id', 'document-vault',
    'object_path', v_ver.object_path,
    'mime_type', v_ver.mime_type,
    'size_bytes', v_ver.size_bytes,
    'sha256', v_ver.sha256,
    'expires_in_seconds', 60,
    'is_admin_inspection', coalesce(p_admin_inspection, false)
  );
end;
$$;
-- The exposed customer_api wrapper is SECURITY INVOKER. It must be able to
-- execute this fully guarded function; documents is not a Data API schema.
grant execute on function documents.authorize_download_internal(uuid,uuid,uuid,boolean) to authenticated;

commit;
