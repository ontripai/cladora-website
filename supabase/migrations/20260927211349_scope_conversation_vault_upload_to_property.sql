begin;

-- Finalize accepts a null property from unit and building contexts. Resolve the
-- property's identity from the single-use upload intent, not a client field.
-- Runs in the same transaction as the immutable version insert; a mismatch
-- rolls the entire finalization back, including the consumed intent.
create function documents.scope_finalized_upload_property()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_intent documents.upload_intents%rowtype;
  v_property uuid; v_existing uuid; v_scope text;
begin
  if not (new.metadata_json ? 'upload_intent_id') then return new; end if;
  select * into v_intent from documents.upload_intents
    where id=(new.metadata_json->>'upload_intent_id')::uuid
      and tenant_id=new.tenant_id and user_id=new.uploaded_by
      and status='consumed' and document_id is null;
  -- Version replacement is covered below too: an existing intent has a
  -- document_id, but must refer to the exact document being versioned.
  if not found then
    select * into v_intent from documents.upload_intents
      where id=(new.metadata_json->>'upload_intent_id')::uuid
        and tenant_id=new.tenant_id and user_id=new.uploaded_by
        and status='consumed' and document_id=new.document_id;
  end if;
  if not found or v_intent.object_path<>new.object_path or
    v_intent.expected_version<>new.version then
    raise exception 'uploaded_version_intent_mismatch' using errcode='42501';
  end if;

  select g.scope_type::text,case g.scope_type::text
    when 'property' then g.property_id
    when 'building' then b.property_id
    when 'unit' then ub.property_id
    else null end into v_scope,v_property
  from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  left join portfolio.buildings b on b.id=g.building_id and b.tenant_id=g.tenant_id
  left join portfolio.units u on u.id=g.unit_id and u.tenant_id=g.tenant_id
  left join portfolio.buildings ub on ub.id=u.building_id and ub.tenant_id=g.tenant_id
  where g.id=v_intent.context_id and g.tenant_id=new.tenant_id and m.user_id=new.uploaded_by;
  -- Existing tenant-wide administrator uploads remain tenant scoped and may
  -- supply a property explicitly; they do not have a unique derived property.
  if v_scope='tenant' then return new; end if;
  if v_property is null then
    raise exception 'uploaded_document_requires_property_scope' using errcode='42501';
  end if;
  select d.property_id into v_existing from documents.documents d
    where d.id=new.document_id and d.tenant_id=new.tenant_id for update;
  if not found or (v_existing is not null and v_existing<>v_property) then
    raise exception 'uploaded_document_property_mismatch' using errcode='42501';
  end if;
  if v_existing is null then
    update documents.documents set property_id=v_property where id=new.document_id;
  end if;
  return new;
end; $$;
revoke all on function documents.scope_finalized_upload_property() from public,anon,authenticated,service_role;
create trigger scope_finalized_upload_property
  after insert on documents.document_versions for each row
  execute function documents.scope_finalized_upload_property();

commit;
