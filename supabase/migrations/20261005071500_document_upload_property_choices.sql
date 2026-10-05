begin;

-- The vault upload form may bind a document to a property. Return only active
-- properties in the caller's live document-upload context.
create function customer_api.list_document_upload_properties_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
  select * into v from documents.resolve_vault_actor(p_context_id,'documents.vault.upload',false);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
    from portfolio.properties p
    where p.tenant_id=v.tenant_id and p.status='active'
      and (v.scope_type='tenant'
        or (v.scope_type='property' and p.id=v.property_id)
        or (v.scope_type='building' and exists (
          select 1 from portfolio.buildings b
          where b.id=v.building_id and b.tenant_id=v.tenant_id and b.property_id=p.id
        ))
        or (v.scope_type='unit' and exists (
          select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
          where u.id=v.unit_id and u.tenant_id=v.tenant_id and b.tenant_id=v.tenant_id
            and b.property_id=p.id
        )))
  ),'[]'::jsonb);
end $$;

revoke all on function customer_api.list_document_upload_properties_v1(uuid) from public,anon,service_role;
grant execute on function customer_api.list_document_upload_properties_v1(uuid) to authenticated;

commit;
