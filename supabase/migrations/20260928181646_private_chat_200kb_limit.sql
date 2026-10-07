-- Restrict files sent as private conversation messages to 200 KiB.
-- Create a file-only chat message and its scanned attachment in one transaction.
-- If sharing fails, the placeholder message and notification are rolled back.
create or replace function customer_api.send_private_file_v1(
  p_context_id uuid,
  p_conversation_id uuid,
  p_document_id uuid,
  p_version_id uuid,
  p_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_title text;
  v_message jsonb;
  v_attachment jsonb;
begin
  if auth.uid() is null or p_request_id is null then
    raise exception 'private_file_denied' using errcode = '42501';
  end if;

  select d.title into v_title
  from documents.documents d
  join documents.document_versions v on v.document_id = d.id and v.id = p_version_id
  join communications.private_conversations c on c.id = p_conversation_id
  join portfolio.units u on u.id = c.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where d.id = p_document_id
    and d.tenant_id = c.tenant_id
    and d.property_id = b.property_id
    and d.created_by = auth.uid()
    and d.status = 'active' and d.deleted_at is null
    and v.scanning_status = 'clean'
    and v.size_bytes between 1 and 204800
    and communications.can_read_private(c.id, communications.context_membership(p_context_id))
    and communications.context_covers_unit(p_context_id, c.unit_id);

  if v_title is null then
    raise exception 'private_file_denied' using errcode = '42501';
  end if;

  v_message := customer_api.send_private_message_v1(
    p_context_id, p_conversation_id, left('📎 ' || v_title, 5000), p_request_id
  );
  v_attachment := customer_api.attach_private_document_v1(
    p_context_id, p_conversation_id, (v_message->>'message_id')::uuid, p_document_id, p_version_id
  );
  return jsonb_build_object('message_id', v_message->>'message_id',
    'attachment_id', v_attachment->>'attachment_id', 'replayed', v_message->'replayed');
end;
$$;

revoke all on function customer_api.send_private_file_v1(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function customer_api.send_private_file_v1(uuid,uuid,uuid,uuid,uuid) to authenticated;
