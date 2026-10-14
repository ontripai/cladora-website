begin;

-- DOC-WORKSPACE-BINDING-WRITER-01. These nullable columns extend the existing
-- single-use Vault intent. Historical intents remain byte-for-byte unbound;
-- no default, UPDATE or inferred backfill is permitted here.
alter table documents.upload_intents
  add column workspace_id uuid,
  add column prospective_document_id uuid;

alter table documents.upload_intents
  add constraint upload_intents_workspace_tenant_v1
    foreign key (workspace_id,tenant_id)
    references platform.customer_workspaces(id,tenant_id) on delete restrict,
  add constraint upload_intents_workspace_prospective_pair_v1
    check ((workspace_id is null) = (prospective_document_id is null)),
  add constraint upload_intents_bound_new_document_v1
    check (workspace_id is null or document_id is null);

create index upload_intents_workspace_tenant_v1_idx
  on documents.upload_intents(workspace_id,tenant_id);
create unique index upload_intents_prospective_document_v1_idx
  on documents.upload_intents(prospective_document_id)
  where prospective_document_id is not null;

comment on column documents.upload_intents.workspace_id is
  'Explicit canonical Workspace selected by a new-document command and accepted inside CoreTransactionScopeV1; NULL is historical/unbound.';
comment on column documents.upload_intents.prospective_document_id is
  'Server-generated document identity reserved by a bound new-document intent; NULL is historical/replacement/unbound.';

-- A Workspace binding is established only by INSERT. This guard rejects all
-- UPDATE transitions, including historical NULL to non-NULL and non-NULL to
-- NULL. A future backfill/rebind package needs a separate reviewed migration.
create function documents.reject_document_workspace_rebind_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception using errcode = '55000', message = 'document_workspace_binding_is_immutable';
  end if;
  return new;
end;
$$;

revoke all on function documents.reject_document_workspace_rebind_v1() from public, anon, authenticated, service_role;

create trigger document_workspace_binding_immutable_v1
before update of workspace_id on documents.documents
for each row execute function documents.reject_document_workspace_rebind_v1();

commit;
