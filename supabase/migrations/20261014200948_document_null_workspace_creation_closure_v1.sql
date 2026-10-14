begin;

-- DOC-NULL-WORKSPACE-CREATION-CLOSURE-01. Historical NULL bindings remain
-- untouched. After this cutover, a new-document intent must carry the exact
-- Workspace and reserved document identity supplied by the canonical writer.
create function documents.reject_unbound_new_document_intent_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.document_id is null
    and (new.workspace_id is null or new.prospective_document_id is null)
    and (tg_op = 'INSERT' or new.status = 'consumed' or new.consumed_at is not null)
  then
    raise exception using
      errcode = '23502',
      message = 'document_workspace_binding_required_for_new_intent';
  end if;
  return new;
end;
$$;

alter function documents.reject_unbound_new_document_intent_v1() owner to postgres;
revoke all on function documents.reject_unbound_new_document_intent_v1()
  from public, anon, authenticated, service_role;

create trigger upload_intent_new_document_binding_required_v1
before insert on documents.upload_intents
for each row execute function documents.reject_unbound_new_document_intent_v1();

create trigger upload_intent_unbound_consumption_denied_v1
before update of status,consumed_at on documents.upload_intents
for each row execute function documents.reject_unbound_new_document_intent_v1();

-- Every newly inserted document must be backed by the consumed, single-use
-- intent and transaction-local trusted-object marker produced by the accepted
-- Core writer. This does not validate or mutate historical rows.
create function documents.require_workspace_bound_document_insert_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_intent documents.upload_intents%rowtype;
  v_marker jsonb;
begin
  if new.workspace_id is null then
    raise exception using
      errcode = '23502',
      message = 'document_workspace_binding_required_on_insert';
  end if;

  select ui.* into v_intent
  from documents.upload_intents ui
  where ui.tenant_id = new.tenant_id
    and ui.workspace_id = new.workspace_id
    and ui.prospective_document_id = new.id
    and ui.document_id is null
    and ui.expected_version = 1
    and ui.user_id = new.created_by
    and ui.status = 'consumed'
    and ui.consumed_at is not null
    and ui.attempts = 1
  for share;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'canonical_document_writer_intent_required';
  end if;

  begin
    v_marker := nullif(
      current_setting('documents.workspace_binding_writer_v1', true), ''
    )::jsonb;
  exception when others then
    v_marker := null;
  end;

  if v_marker is null
    or v_marker->>'contract_version' <> 'documents-workspace-binding-writer.v1'
    or v_marker->>'intent_id' <> v_intent.id::text
    or v_marker->>'document_id' <> new.id::text
    or v_marker->>'workspace_id' <> new.workspace_id::text
    or v_marker->>'actor_id' <> new.created_by::text
    or v_marker->>'bucket_id' <> v_intent.bucket_id
    or v_marker->>'object_path' <> v_intent.object_path
    or v_marker->>'non_overwritable' <> 'true'
    or coalesce(v_marker->>'sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce((v_marker->>'size_bytes')::bigint, 0) <= 0
    or coalesce(v_marker->>'detected_mime_type', '') = ''
  then
    raise exception using
      errcode = '42501',
      message = 'trusted_document_object_verification_required';
  end if;

  return new;
end;
$$;

alter function documents.require_workspace_bound_document_insert_v1() owner to postgres;
revoke all on function documents.require_workspace_bound_document_insert_v1()
  from public, anon, authenticated, service_role;

create trigger document_workspace_creation_guard_v1
before insert on documents.documents
for each row execute function documents.require_workspace_bound_document_insert_v1();

commit;
