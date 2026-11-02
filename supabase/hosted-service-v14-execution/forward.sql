begin;

-- Source-only SERVICE V14 execution extension. This file is not a migration and
-- has no runtime principal grant. Installation and activation require a later,
-- separately authorized package after the canonical provider sources exist.

alter table service_catalog.revisions
  add column revision_version bigint,
  add column provider_agreement_id uuid,
  add column provider_agreement_version bigint,
  add column coverage jsonb,
  add column eligibility jsonb,
  add constraint service_revision_v14_version_ck check (
    revision_version is null or revision_version between 1 and 9007199254740991),
  add constraint service_revision_v14_agreement_ck check (
    (provider_agreement_id is null and provider_agreement_version is null)
    or (provider_agreement_id is not null
      and provider_agreement_version between 1 and 9007199254740991)),
  add constraint service_revision_v14_metadata_ck check (
    (revision_version is null and provider_agreement_id is null
      and coverage is null and eligibility is null)
    or (revision_version is not null and provider_agreement_id is not null
      and jsonb_typeof(coverage)='object' and jsonb_typeof(eligibility)='object'));

create unique index service_revision_v14_version_uq
  on service_catalog.revisions(tenant_id,workspace_id,offering_id,revision_version)
  where revision_version is not null;

alter table service_catalog.requests
  add column offering_version bigint,
  add column published_revision_version bigint,
  add column provider_agreement_id uuid,
  add column provider_agreement_version bigint,
  add column resource_reference jsonb,
  add constraint service_request_v14_versions_ck check (
    (offering_version is null and published_revision_version is null
      and provider_agreement_id is null and provider_agreement_version is null
      and resource_reference is null)
    or (offering_version between 1 and 9007199254740991
      and published_revision_version between 1 and 9007199254740991
      and provider_agreement_id is not null
      and provider_agreement_version between 1 and 9007199254740991
      and (resource_reference is null or jsonb_typeof(resource_reference)='object')));

create function app_private.service_v14_revision_metadata_valid_v1(
  p_coverage jsonb,p_eligibility jsonb)
returns boolean language sql immutable set search_path=pg_catalog
as $$
  select jsonb_typeof(p_coverage)='object'
    and p_coverage ? 'kind'
    and p_coverage->>'kind' in ('workspace','resources','geographic')
    and jsonb_typeof(p_eligibility)='object'
    and p_eligibility ?& array['policy_version','required_resource_types',
      'required_capabilities','required_policy_codes']
    and (p_eligibility->>'policy_version') ~ '^[1-9][0-9]*$'
    and jsonb_typeof(p_eligibility->'required_resource_types')='array'
    and jsonb_typeof(p_eligibility->'required_capabilities')='array'
    and jsonb_typeof(p_eligibility->'required_policy_codes')='array'
$$;

alter table service_catalog.revisions add constraint service_revision_v14_metadata_shape_ck
  check (revision_version is null
    or app_private.service_v14_revision_metadata_valid_v1(coverage,eligibility));

create function app_private.service_v14_revision_binding_immutable_v1()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
  if (new.revision_version,new.provider_agreement_id,new.provider_agreement_version,
      new.coverage,new.eligibility)
    is distinct from
     (old.revision_version,old.provider_agreement_id,old.provider_agreement_version,
      old.coverage,old.eligibility) then
    raise exception 'service_v14_revision_binding_immutable' using errcode='23514';
  end if;
  return new;
end;
$$;

create trigger service_v14_revision_binding_immutable
  before update on service_catalog.revisions for each row
  execute function app_private.service_v14_revision_binding_immutable_v1();

create function app_private.resolve_service_v14_execution_source_v1(
  p_workspace uuid,p_offering uuid,p_revision uuid,
  p_offering_version bigint,p_revision_version bigint)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $$
  select jsonb_build_object(
    'workspace_id',o.workspace_id,
    'offering_id',o.id,
    'revision_id',r.id,
    'offering_version',o.lock_version,
    'revision_version',r.revision_version,
    'provider_party_id',o.provider_party_id,
    'provider_agreement_id',r.provider_agreement_id,
    'provider_agreement_version',r.provider_agreement_version,
    'status',r.status,
    'offering_available',r.valid_from<=clock_timestamp()
      and (r.valid_until is null or r.valid_until>clock_timestamp()),
    'coverage_kind',r.coverage->>'kind',
    'coverage',r.coverage,
    'required_resource_types',r.eligibility->'required_resource_types',
    'requires_capability_policy_resolution',
      jsonb_array_length(r.eligibility->'required_capabilities')>0
      or jsonb_array_length(r.eligibility->'required_policy_codes')>0)
  from service_catalog.offerings o
  join service_catalog.revisions r
    on (r.tenant_id,r.workspace_id,r.offering_id,r.id)
     =(o.tenant_id,o.workspace_id,o.id,p_revision)
  where o.workspace_id=p_workspace and o.id=p_offering
    and o.lock_version=p_offering_version
    and r.revision_version=p_revision_version
$$;

create function app_private.apply_service_v14_execution_v1(p_operation text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid:=auth.uid();
  v_context uuid:=(p_payload->>'context_id')::uuid;
  v_workspace uuid:=(p_payload->>'workspace_id')::uuid;
  v_tenant uuid;
  v_permission text;
  v_offering service_catalog.offerings%rowtype;
  v_revision service_catalog.revisions%rowtype;
  v_membership uuid;
  v_resource jsonb;
  v_action text;
  v_status text;
begin
  if v_actor is null or p_operation not in
    ('create_offering','transition_offering','create_request') then
    raise exception 'service_v14_invalid_command' using errcode='22023';
  end if;
  v_action:=p_payload->>'action';
  v_permission:=case
    when p_operation='create_request' then 'services.orders.request'
    when p_operation='transition_offering' and v_action='publish'
      then 'services.catalog.publish'
    else 'services.catalog.manage' end;
  v_tenant:=case when p_operation='create_request'
    then (select tenant_id from app_private.service_request_authorize_v1(
      v_context,v_workspace,v_permission))
    else app_private.service_catalog_authorize_v1(v_context,v_workspace,v_permission) end;

  if p_operation='create_offering' then
    perform 1 from service_catalog.definitions
      where tenant_id=v_tenant and workspace_id=v_workspace
        and id=(p_payload->>'definition_id')::uuid and active for key share;
    if not found then raise exception 'service_v14_definition_unavailable' using errcode='40001'; end if;
    perform 1 from portfolio.parties where tenant_id=v_tenant
      and id=(p_payload->>'provider_party_id')::uuid and archived_at is null for share;
    if not found then raise exception 'service_v14_provider_unavailable' using errcode='40001'; end if;
    perform app_private.service_catalog_authorize_v1(v_context,v_workspace,v_permission);
    if not app_private.service_catalog_revision_valid_v1(p_payload->'revision')
      or not app_private.service_v14_revision_metadata_valid_v1(
        p_payload->'coverage',p_payload->'eligibility') then
      raise exception 'service_v14_invalid_revision' using errcode='22023';
    end if;
    insert into service_catalog.offerings(
      id,tenant_id,workspace_id,definition_id,provider_party_id,current_revision_id,created_by)
    values((p_payload->>'offering_id')::uuid,v_tenant,v_workspace,
      (p_payload->>'definition_id')::uuid,(p_payload->>'provider_party_id')::uuid,
      (p_payload->>'revision_id')::uuid,v_actor);
    insert into service_catalog.revisions(
      id,tenant_id,workspace_id,offering_id,commercial_terms,valid_from,valid_until,
      created_by,revision_version,provider_agreement_id,provider_agreement_version,
      coverage,eligibility)
    values((p_payload->>'revision_id')::uuid,v_tenant,v_workspace,
      (p_payload->>'offering_id')::uuid,p_payload->'revision',
      (p_payload->'revision'->>'valid_from')::timestamptz,
      (p_payload->'revision'->>'valid_until')::timestamptz,v_actor,1,
      (p_payload->>'provider_agreement_id')::uuid,
      (p_payload->>'provider_agreement_version')::bigint,
      p_payload->'coverage',p_payload->'eligibility');
    return (p_payload->>'offering_id')::uuid;
  end if;

  select * into v_offering from service_catalog.offerings
    where tenant_id=v_tenant and workspace_id=v_workspace
      and id=(p_payload->>'offering_id')::uuid for update;
  if not found or v_offering.lock_version<>(p_payload->>'expected_offering_version')::bigint then
    raise exception 'service_v14_offering_version_conflict' using errcode='40001';
  end if;
  select * into v_revision from service_catalog.revisions
    where tenant_id=v_tenant and workspace_id=v_workspace and offering_id=v_offering.id
      and id=(case when p_operation='create_request'
        then p_payload->>'published_revision_id' else p_payload->>'revision_id' end)::uuid
    for update;
  if not found
    or v_revision.revision_version<>(case when p_operation='create_request'
      then p_payload->>'published_revision_version'
      else p_payload->>'expected_revision_version' end)::bigint
    or v_revision.provider_agreement_id<>(p_payload->>'provider_agreement_id')::uuid
    or v_revision.provider_agreement_version<>(p_payload->>'provider_agreement_version')::bigint
    or v_offering.provider_party_id<>(p_payload->>'provider_party_id')::uuid then
    raise exception 'service_v14_revision_version_conflict' using errcode='40001';
  end if;
  perform 1 from service_catalog.definitions
    where tenant_id=v_tenant and workspace_id=v_workspace
      and id=v_offering.definition_id and active for key share;
  if not found then raise exception 'service_v14_definition_unavailable' using errcode='40001'; end if;
  perform 1 from portfolio.parties where tenant_id=v_tenant
    and id=v_offering.provider_party_id and archived_at is null for share;
  if not found then raise exception 'service_v14_provider_unavailable' using errcode='40001'; end if;

  -- This second canonical call is intentionally after every domain lock/wait.
  if p_operation='create_request' then
    select tenant_id,membership_id into strict v_tenant,v_membership
      from app_private.service_request_authorize_v1(v_context,v_workspace,v_permission);
  else
    perform app_private.service_catalog_authorize_v1(v_context,v_workspace,v_permission);
  end if;

  if p_operation='transition_offering' then
    v_status:=case
      when v_action='submit' and v_revision.status='draft' then 'submitted'
      when v_action='publish' and v_revision.status='submitted' then 'published'
      when v_action='suspend' and v_revision.status='published' then 'suspended'
      when v_action='archive' and v_revision.status in('draft','submitted','published','suspended') then 'archived'
      else null end;
    if v_status is null then raise exception 'service_v14_invalid_transition' using errcode='40001'; end if;
    update service_catalog.revisions set status=v_status,
      submitted_by=case when v_action='submit' then v_actor else submitted_by end,
      published_by=case when v_action='publish' then v_actor else published_by end
      where id=v_revision.id;
    update service_catalog.offerings set lock_version=lock_version+1,
      published_revision_id=case when v_action='publish' then v_revision.id
        when v_action in('suspend','archive') and published_revision_id=v_revision.id then null
        else published_revision_id end
      where id=v_offering.id;
    return v_offering.id;
  end if;

  if v_offering.published_revision_id is distinct from v_revision.id
    or v_revision.status<>'published'
    or v_revision.valid_from>clock_timestamp()
    or (v_revision.valid_until is not null and v_revision.valid_until<=clock_timestamp())
    or v_revision.coverage->>'kind'='geographic'
    or jsonb_array_length(v_revision.eligibility->'required_capabilities')>0
    or jsonb_array_length(v_revision.eligibility->'required_policy_codes')>0 then
    raise exception 'service_v14_offering_unavailable' using errcode='40001';
  end if;
  perform 1 from identity.membership_parties mp
    join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
    where mp.tenant_id=v_tenant and mp.membership_id=v_membership
      and mp.party_id=(p_payload->>'beneficiary_party_id')::uuid
      and mp.valid_from<=clock_timestamp()
      and (mp.valid_until is null or mp.valid_until>clock_timestamp())
      and p.archived_at is null for share of mp,p;
  if not found then raise exception 'service_v14_beneficiary_denied' using errcode='42501'; end if;
  v_resource:=p_payload->'resource';
  if v_revision.coverage->>'kind'='resources' then
    if v_resource is null or v_resource='null'::jsonb or not exists(
      select 1 from jsonb_array_elements(v_revision.coverage->'resources') item
      where item->>'resource_id'=v_resource->>'resource_id'
        and (item->>'resource_version')::bigint=(v_resource->>'resource_version')::bigint
        and item->>'resource_type'=v_resource->>'resource_type') then
      raise exception 'service_v14_resource_outside_coverage' using errcode='42501';
    end if;
  end if;
  if jsonb_array_length(v_revision.eligibility->'required_resource_types')>0
    and (v_resource is null or v_resource='null'::jsonb or not exists(
      select 1 from jsonb_array_elements_text(
        v_revision.eligibility->'required_resource_types') as required_type(value)
      where required_type.value=v_resource->>'resource_type')) then
    raise exception 'service_v14_resource_ineligible' using errcode='42501';
  end if;
  insert into service_catalog.requests(
    id,tenant_id,workspace_id,offering_id,published_revision_id,requester_id,
    membership_id,beneficiary_party_id,description,version,offering_version,
    published_revision_version,provider_agreement_id,provider_agreement_version,
    resource_reference)
  values((p_payload->>'request_id')::uuid,v_tenant,v_workspace,v_offering.id,
    v_revision.id,v_actor,v_membership,(p_payload->>'beneficiary_party_id')::uuid,
    p_payload->>'description',1,v_offering.lock_version,v_revision.revision_version,
    v_revision.provider_agreement_id,v_revision.provider_agreement_version,
    case when v_resource='null'::jsonb then null else v_resource end);
  return (p_payload->>'request_id')::uuid;
end;
$$;

revoke all on function app_private.service_v14_revision_metadata_valid_v1(jsonb,jsonb),
  app_private.service_v14_revision_binding_immutable_v1(),
  app_private.resolve_service_v14_execution_source_v1(uuid,uuid,uuid,bigint,bigint),
  app_private.apply_service_v14_execution_v1(text,jsonb)
  from public,anon,authenticated,service_role;

commit;
