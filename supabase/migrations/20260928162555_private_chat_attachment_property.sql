-- Resolve the property of a private conversation only for a member with access
-- to both the conversation and its unit in the selected workspace context.
create function customer_api.private_conversation_property_v1(p_context_id uuid, p_conversation_id uuid)
returns uuid language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := communications.context_membership(p_context_id);
  v_property uuid;
begin
  if v_actor is null or not communications.can_read_private(p_conversation_id, v_actor) then
    raise exception 'private_conversation_denied' using errcode = '42501';
  end if;

  select b.property_id into v_property
  from communications.private_conversations c
  join portfolio.units u on u.id = c.unit_id
  join portfolio.buildings b on b.id = u.building_id
  where c.id = p_conversation_id
    and communications.context_covers_unit(p_context_id, c.unit_id);

  if v_property is null then
    raise exception 'private_conversation_denied' using errcode = '42501';
  end if;
  return v_property;
end;
$$;

revoke all on function customer_api.private_conversation_property_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.private_conversation_property_v1(uuid, uuid) to authenticated;
