begin;

-- CE-GUIDE-STORAGE-LIFECYCLE-02
-- Private storage only. Core owns authority, idempotency, audit and outbox.
-- No route, grant, module seed or runtime activation is introduced here.

create schema if not exists experience;

create table experience.guides (
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_id uuid not null,
  title text not null check (title=btrim(title) and length(title) between 2 and 160),
  audience jsonb not null check (jsonb_typeof(audience)='object'),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  content_version bigint not null default 1 check (content_version between 1 and 9007199254740991),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,workspace_id,id),
  foreign key (workspace_id,tenant_id)
    references platform.customer_workspaces(id,tenant_id) on delete restrict,
  check (content_version<=version)
);

create table experience.guide_steps (
  id uuid primary key,
  tenant_id uuid not null,
  workspace_id uuid not null,
  guide_id uuid not null,
  guide_version bigint not null check (guide_version between 1 and 9007199254740991),
  position smallint not null check (position between 1 and 100),
  title text not null check (title=btrim(title) and length(title) between 1 and 160),
  body text not null check (body=btrim(body) and length(body) between 1 and 5000),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,workspace_id,guide_id,guide_version,id),
  unique (guide_id,guide_version,position),
  foreign key (tenant_id,workspace_id,guide_id)
    references experience.guides(tenant_id,workspace_id,id) on delete restrict
);

create table experience.guide_references (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid not null,
  guide_id uuid not null,
  guide_version bigint not null check (guide_version between 1 and 9007199254740991),
  step_id uuid not null,
  position smallint not null check (position between 1 and 20),
  target_type text not null check (target_type='document'),
  target_id uuid not null,
  document_version_id uuid not null,
  document_version integer not null check (document_version>0),
  safe_label text not null check (safe_label=btrim(safe_label) and length(safe_label) between 1 and 120),
  created_at timestamptz not null default statement_timestamp(),
  unique (step_id,position),
  foreign key (tenant_id,workspace_id,guide_id,guide_version,step_id)
    references experience.guide_steps(tenant_id,workspace_id,guide_id,guide_version,id) on delete restrict,
  foreign key (target_id) references documents.documents(id) on delete restrict,
  foreign key (document_version_id) references documents.document_versions(id) on delete restrict
);

create index ce_guides_workspace_idx
  on experience.guides(tenant_id,workspace_id,status,updated_at desc,id);
create index ce_guide_steps_content_idx
  on experience.guide_steps(tenant_id,workspace_id,guide_id,guide_version,position);
create index ce_guide_references_content_idx
  on experience.guide_references(tenant_id,workspace_id,guide_id,guide_version,position);
create index ce_guide_references_document_idx
  on experience.guide_references(tenant_id,target_id,document_version_id);

create function app_private.ce_guide_guard_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='DELETE' then
    raise exception 'ce_guide_delete_prohibited' using errcode='42501';
  end if;
  if new.id<>old.id or new.tenant_id<>old.tenant_id
    or new.workspace_id<>old.workspace_id or new.created_by<>old.created_by
    or new.created_at<>old.created_at then
    raise exception 'ce_guide_identity_immutable' using errcode='42501';
  end if;
  if old.status='cancelled' then
    raise exception 'ce_guide_cancelled_immutable' using errcode='42501';
  end if;
  if old.version>=9007199254740991 or new.version<>old.version+1 then
    raise exception 'ce_guide_exact_version_required' using errcode='40001';
  end if;
  if new.content_version=old.content_version then
    if new.title<>old.title or new.audience<>old.audience
      or not ((old.status='draft' and new.status in ('published','cancelled'))
        or (old.status='published' and new.status in ('draft','cancelled'))) then
      raise exception 'ce_guide_lifecycle_transition_invalid' using errcode='42501';
    end if;
  elsif new.content_version=new.version then
    if old.status<>'draft' or new.status<>'draft' then
      raise exception 'ce_guide_content_change_requires_draft' using errcode='42501';
    end if;
  else
    raise exception 'ce_guide_content_version_invalid' using errcode='40001';
  end if;
  new.updated_at:=statement_timestamp();
  return new;
end $$;

create function app_private.ce_guide_child_guard_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare g experience.guides%rowtype; v_document_version integer; v_document_id uuid;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'ce_guide_content_immutable' using errcode='42501';
  end if;
  select * into g from experience.guides
   where id=new.guide_id and tenant_id=new.tenant_id and workspace_id=new.workspace_id;
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

create trigger ce_guides_guard
before update or delete on experience.guides
for each row execute function app_private.ce_guide_guard_v1();
create trigger ce_guide_steps_guard
before insert or update or delete on experience.guide_steps
for each row execute function app_private.ce_guide_child_guard_v1();
create trigger ce_guide_references_guard
before insert or update or delete on experience.guide_references
for each row execute function app_private.ce_guide_child_guard_v1();

alter table experience.guides enable row level security;
alter table experience.guide_steps enable row level security;
alter table experience.guide_references enable row level security;
revoke all on schema experience from public,anon,authenticated,service_role;
revoke all on experience.guides,experience.guide_steps,experience.guide_references
  from public,anon,authenticated,service_role;
revoke all on function app_private.ce_guide_guard_v1(),
  app_private.ce_guide_child_guard_v1() from public,anon,authenticated,service_role;

commit;
