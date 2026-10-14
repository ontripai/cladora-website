begin;

-- Serialize immutable child insertion with the Guide lifecycle transition.
-- Core's existing aggregate lock closes the statement-snapshot/FK window;
-- FOR KEY SHARE then binds the accepted child to the locked parent row.
create or replace function app_private.ce_guide_child_guard_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare g experience.guides%rowtype; v_document_version integer; v_document_id uuid;
  v_aggregate_lock bigint; v_lock_immediate boolean;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'ce_guide_content_immutable' using errcode='42501';
  end if;
  -- Reuse Core's aggregate lock namespace. Shared child locks remain mutually
  -- compatible and conflict only with a lifecycle command's exclusive lock.
  v_aggregate_lock:=hashtextextended(
    'aggregate:'||new.workspace_id::text||':experience_guide:'||new.guide_id::text,0);
  v_lock_immediate:=pg_try_advisory_xact_lock_shared(v_aggregate_lock);
  if not v_lock_immediate then
    perform pg_advisory_xact_lock_shared(v_aggregate_lock);
    raise exception 'ce_guide_content_binding_invalid' using errcode='42501';
  end if;
  select * into g from experience.guides
   where id=new.guide_id and tenant_id=new.tenant_id and workspace_id=new.workspace_id
     and status='draft' and version=content_version and content_version=new.guide_version
   for key share;
  if g.id is null or g.status<>'draft' or g.version<>g.content_version
    or g.content_version<>new.guide_version then
    raise exception 'ce_guide_content_binding_invalid' using errcode='42501';
  end if;
  if tg_table_name='guide_references' then
    select v.document_id,v.version into v_document_id,v_document_version
      from documents.document_versions v join documents.documents d
        on d.id=v.document_id and d.tenant_id=v.tenant_id
     where v.id=new.document_version_id and v.document_id=new.target_id
       and v.tenant_id=new.tenant_id and d.workspace_id=new.workspace_id;
    if v_document_id is null or v_document_version<>new.document_version then
      raise exception 'ce_guide_document_version_binding_invalid' using errcode='42501';
    end if;
  end if;
  return new;
end $$;

commit;
