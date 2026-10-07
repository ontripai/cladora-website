-- Show only the uploader their file's coarse scan state in this conversation.
-- Scanner details and vault paths remain private.
create function customer_api.my_private_file_scan_status_v1(
  p_context_id uuid, p_conversation_id uuid, p_document_id uuid, p_version_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
declare v_state text;
begin
  if auth.uid() is null or not communications.can_read_private(
    p_conversation_id, communications.context_membership(p_context_id))
    or not exists(select 1 from communications.private_conversations c
      where c.id=p_conversation_id and communications.context_covers_unit(p_context_id,c.unit_id)) then
    raise exception 'private_file_denied' using errcode='42501';
  end if;

  select v.scanning_status into v_state
  from communications.private_conversations c
  join portfolio.units u on u.id=c.unit_id and u.tenant_id=c.tenant_id
  join portfolio.buildings b on b.id=u.building_id and b.tenant_id=c.tenant_id
  join documents.documents d on d.id=p_document_id and d.tenant_id=c.tenant_id
    and d.property_id=b.property_id and d.created_by=auth.uid()
    and d.status='active' and d.deleted_at is null
  join documents.document_versions v on v.id=p_version_id and v.document_id=d.id
    and v.tenant_id=d.tenant_id and v.uploaded_by=auth.uid()
    and v.size_bytes between 1 and 204800
  where c.id=p_conversation_id;

  if v_state is null then
    raise exception 'private_file_denied' using errcode='42501';
  end if;
  return jsonb_build_object('status',case v_state
    when 'clean' then 'ready'
    when 'quarantined' then 'rejected'
    else 'checking' end);
end;
$$;

revoke all on function customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function customer_api.my_private_file_scan_status_v1(uuid,uuid,uuid,uuid) to authenticated;
