begin;

-- DOC-REFERENCE-AUTHORITY-01: additive canonical binding only. No inferred
-- backfill, privilege changes, upload wiring or reference runtime activation.
alter table documents.documents add column workspace_id uuid;
-- Reuse Core's existing unique(id,tenant_id); a plain Workspace FK would permit
-- a document to claim another tenant's Workspace. NULL remains compatible.
alter table documents.documents add constraint document_reference_workspace_tenant_v1
  foreign key (workspace_id,tenant_id)
  references platform.customer_workspaces(id,tenant_id) on delete restrict;
-- Required by the repository's all-FK covering-index invariant. This avoids
-- scanning the canonical document table when Core checks a Workspace delete.
create index document_reference_workspace_tenant_v1_idx
  on documents.documents(workspace_id,tenant_id);

comment on column documents.documents.workspace_id is
  'Exact canonical Workspace binding. NULL legacy rows are unresolved for reference authority; never infer from tenant/property/links.';

commit;
