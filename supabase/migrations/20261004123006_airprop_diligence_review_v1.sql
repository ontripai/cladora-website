begin;

insert into identity.permissions(code,resource,action,description)
values('airprop.diligence.submit','airprop.diligence','submit','Submit an exact-version complete diligence review; no acquisition approval') on conflict(code) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active' from platform.module_definitions m join identity.permissions p on p.code='airprop.diligence.submit'
where m.code='airprop_commercial' and m.version=1 on conflict(module_definition_id,permission_id,binding_version) do nothing;
create or replace function app_private.validate_airprop_module_bindings_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare actual integer; matched integer;
begin
 select count(*) into actual from platform.module_permission_bindings b join platform.module_definitions m on m.id=b.module_definition_id where m.code='airprop_commercial' and m.version=1;
 select count(*) into matched from platform.module_permission_bindings b join platform.module_definitions m on m.id=b.module_definition_id join identity.permissions p on p.id=b.permission_id
 join(values('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage'),('airprop.diligence.manage','manage'),('airprop.diligence.submit','manage')) x(code,mode) on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1 and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2 and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>7 or matched<>7 then raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002';end if;
end;$$;
revoke all on function app_private.validate_airprop_module_bindings_v1() from public,anon,authenticated,service_role;
select app_private.validate_airprop_module_bindings_v1();

-- Initial cases remain immutable. Each edit and submission is append-only.
create table airprop.diligence_revisions(
 diligence_case_id uuid not null references airprop.diligence_cases(id),
 revision integer not null check(revision>=2),
 checklist jsonb not null,
 findings jsonb not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default statement_timestamp(),
 primary key(diligence_case_id,revision)
);
create index diligence_revision_creator_idx on airprop.diligence_revisions(created_by);
create table airprop.diligence_revision_evidence(
 diligence_case_id uuid not null,
 revision integer not null,
 version_id uuid not null references documents.document_versions(id) on delete restrict,
 primary key(diligence_case_id,revision,version_id),
 foreign key(diligence_case_id,revision) references airprop.diligence_revisions(diligence_case_id,revision)
);
create index diligence_evidence_version_idx on airprop.diligence_revision_evidence(version_id);
alter table airprop.diligence_revision_evidence enable row level security;
revoke all on airprop.diligence_revision_evidence from public,anon,authenticated,service_role;
create table airprop.diligence_submissions(
 id uuid primary key default gen_random_uuid(),
 diligence_case_id uuid not null unique references airprop.diligence_cases(id),
 revision integer not null,
 submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default statement_timestamp(),
 foreign key(diligence_case_id,revision) references airprop.diligence_revisions(diligence_case_id,revision)
);
create index diligence_submission_actor_idx on airprop.diligence_submissions(submitted_by);
alter table airprop.diligence_revisions enable row level security;
alter table airprop.diligence_submissions enable row level security;
revoke all on airprop.diligence_revisions,airprop.diligence_submissions from public,anon,authenticated,service_role;
create function app_private.protect_airprop_diligence_review_v1() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'airprop_diligence_review_immutable' using errcode='22023';end;$$;
create trigger immutable_diligence_revision before update or delete on airprop.diligence_revisions for each row execute function app_private.protect_airprop_diligence_review_v1();
create trigger immutable_diligence_submission before update or delete on airprop.diligence_submissions for each row execute function app_private.protect_airprop_diligence_review_v1();
create trigger immutable_diligence_evidence before update or delete on airprop.diligence_revision_evidence for each row execute function app_private.protect_airprop_diligence_review_v1();
revoke all on function app_private.protect_airprop_diligence_review_v1() from public,anon,authenticated,service_role;

-- Reuse the existing Vault gate without broadening its roles, classification or scope.
-- A native tenant context cannot stand in for the actor's explicit physical document context.
create function app_private.require_airprop_diligence_evidence_v1(p_document_context_id uuid,p_workspace_id uuid,p_version_id uuid,p_require_current boolean default true)
returns documents.document_versions language plpgsql security definer set search_path=pg_catalog as $$
declare v documents.document_versions%rowtype; d documents.documents%rowtype; w platform.customer_workspaces%rowtype; actor record;
begin
 select * into actor from documents.resolve_vault_actor(p_document_context_id,'documents.vault.read',true);
 if actor.scope_type not in('property','building','unit') then raise exception 'airprop_evidence_unavailable' using errcode='42501';end if;
 select * into w from platform.customer_workspaces where id=p_workspace_id;
 select * into v from documents.document_versions where id=p_version_id for share;
 select * into d from documents.documents where id=v.document_id for share;
 if w.id is null or v.id is null or d.id is null or v.tenant_id<>w.tenant_id or d.tenant_id<>w.tenant_id
 or p_require_current is null or d.deleted_at is not null or d.status<>'active' or (p_require_current and d.current_version<>v.version)
 or not d.is_evidence or d.evidence_status<>'verified' or d.verified_by is null or d.verified_by is not distinct from d.created_by
 or d.verified_at is null or d.verified_at<v.created_at
 or v.checksum_status<>'verified' or v.scanning_status<>'clean' or v.sha256 !~ '^[0-9a-f]{64}$'
 or not exists(select 1 from documents.document_scan_attestations a where a.version_id=v.id and a.tenant_id=w.tenant_id and a.provider='clamav' and a.verdict='clean' and a.content_sha256=v.sha256)
 or not exists(select 1 from platform.workspace_property_bindings b where b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.property_id=d.property_id and b.status='active' and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
 or not exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id=w.id and e.entitlement_key='module.documents' and e.boolean_value and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp()))
 or not exists(select 1 from platform.workspace_modules m where m.customer_workspace_id=w.id and m.module_code='documents' and m.status='active' and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp())) then
 raise exception 'airprop_evidence_unavailable' using errcode='42501';end if;
 perform documents.authorize_download_internal(p_document_context_id,d.id,v.id,false);
 return v;
end;$$;
revoke all on function app_private.require_airprop_diligence_evidence_v1(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

-- This validator is also used for direct RPC callers; HTTP parsing is not an authority boundary.
create function app_private.validate_airprop_diligence_snapshot_v1(p_snapshot jsonb)
returns void language plpgsql immutable set search_path=pg_catalog as $$
declare item jsonb; ids jsonb; kind text; seen text[]; codes text[]; token text;
begin
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or (select count(*) from jsonb_object_keys(p_snapshot))<>2
 or not(p_snapshot ?& array['checklist','findings']) or jsonb_typeof(p_snapshot->'checklist')<>'array' or jsonb_typeof(p_snapshot->'findings')<>'array'
 or jsonb_array_length(p_snapshot->'checklist')<>3 or jsonb_array_length(p_snapshot->'findings')>128 then
 raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
 codes=array[]::text[];
 for item in select value from jsonb_array_elements(p_snapshot->'checklist') loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3 or not(item ?& array['code','status','evidence_version_ids'])
  or item->>'code' not in('legal','financial','technical') or item->>'code'=any(codes) or item->>'status' not in('pending','satisfied')
  or jsonb_typeof(item->'code')<>'string' or jsonb_typeof(item->'status')<>'string' then raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
  codes=array_append(codes,item->>'code');
 end loop;
 seen=array[]::text[];
 for item in select value from jsonb_array_elements(p_snapshot->'findings') loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['finding_id','severity','status','summary','evidence_version_ids'])
  or item->>'severity' not in('blocking','advisory') or item->>'status' not in('open','resolved')
  or jsonb_typeof(item->'severity')<>'string' or jsonb_typeof(item->'status')<>'string'
  or jsonb_typeof(item->'finding_id')<>'string' or item->>'finding_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or lower(item->>'finding_id')=any(seen) or jsonb_typeof(item->'summary')<>'string' or length(btrim(item->>'summary')) not between 1 and 2000
  or item->>'summary' ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
  seen=array_append(seen,lower(item->>'finding_id'));
  if (item->>'status'='open' and (select count(*) from jsonb_object_keys(item))<>5)
  or (item->>'status'='resolved' and ((select count(*) from jsonb_object_keys(item))<>6 or jsonb_typeof(item->'resolution') is distinct from 'string' or length(btrim(item->>'resolution')) not between 1 and 2000 or item->>'resolution' ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')) then raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
 end loop;
 for kind in select unnest(array['checklist','findings']) loop
  for item in select value from jsonb_array_elements(p_snapshot->kind) loop
   ids=item->'evidence_version_ids';seen=array[]::text[];
   if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)>32
   or ((item->>'status' in('satisfied','resolved')) and jsonb_array_length(ids)=0) then raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
   for token in select value from jsonb_array_elements_text(ids) loop
    if token is null or token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or lower(token)=any(seen) then raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
    seen=array_append(seen,lower(token));
   end loop;
  end loop;
 end loop;
end;$$;
revoke all on function app_private.validate_airprop_diligence_snapshot_v1(jsonb) from public,anon,authenticated,service_role;

create function app_private.check_airprop_diligence_evidence_v1(p_document_context_id uuid,p_workspace_id uuid,p_snapshot jsonb,p_require_current boolean default true)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid;
begin
 for v_id in select distinct e.value::uuid from jsonb_array_elements((p_snapshot->'checklist')||(p_snapshot->'findings')) x cross join lateral jsonb_array_elements_text(x.value->'evidence_version_ids') e order by 1 loop
  perform app_private.require_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,v_id,p_require_current);
 end loop;
end;$$;
revoke all on function app_private.check_airprop_diligence_evidence_v1(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;

create function app_private.airprop_diligence_snapshot_v1(p_case_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce((select jsonb_build_object('checklist',r.checklist,'findings',r.findings,'revision',r.revision) from airprop.diligence_revisions r where r.diligence_case_id=d.id order by revision desc limit 1),jsonb_build_object('checklist',d.checklist,'findings','[]'::jsonb,'revision',1)) from airprop.diligence_cases d where d.id=p_case_id;
$$;
revoke all on function app_private.airprop_diligence_snapshot_v1(uuid) from public,anon,authenticated,service_role;

create function customer_api.save_airprop_diligence_revision_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid,p_expected_revision integer,p_snapshot jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; d airprop.diligence_cases%rowtype; r platform.idempotency_keys%rowtype; s jsonb; response jsonb; k text; h text; a record;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 perform app_private.validate_airprop_diligence_snapshot_v1(p_snapshot);
 if p_expected_revision is null or p_expected_revision<1 or p_expected_revision>=2147483647 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_invalid_diligence' using errcode='22023';end if;
 perform 1 from airprop.investment_opportunities where id=o.id for update;
 select * into d from airprop.diligence_cases where id=p_diligence_case_id and tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id for update;
 if d.id is null then raise exception 'airprop_diligence_not_found' using errcode='P0002';end if;
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 -- Evidence locks and fresh document access are required even for exact retries.
 perform app_private.check_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,p_snapshot);
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 k='airprop.diligence.save.v1/'||d.id||'/'||p_idempotency_key;
 h=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'case',d.id,'revision',p_expected_revision,'snapshot',p_snapshot)::text,'UTF8')),'hex');
 select * into r from platform.idempotency_keys where tenant_id=o.tenant_id and key=k for update;
 if found then
  if r.actor_id is distinct from auth.uid() or r.request_hash is distinct from h then raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return r.response_ref||jsonb_build_object('idempotent',true);
 end if;
 s=app_private.airprop_diligence_snapshot_v1(d.id);
 if (s->>'revision')::integer<>p_expected_revision or exists(select 1 from airprop.diligence_submissions where diligence_case_id=d.id) then raise exception 'airprop_diligence_revision_conflict' using errcode='22023';end if;
 if o.status<>'underwriting' or not exists(select 1 from airprop.underwriting_cases c where c.id=d.underwriting_case_id and c.status='published' and c.current_version=d.underwriting_version) then raise exception 'airprop_diligence_baseline_conflict' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(s->'findings') old_item where not exists(select 1 from jsonb_array_elements(p_snapshot->'findings') new_item where lower(new_item.value->>'finding_id')=lower(old_item.value->>'finding_id') and new_item.value->>'severity'=old_item.value->>'severity')) then raise exception 'airprop_invalid_diligence_snapshot' using errcode='22023';end if;
 insert into airprop.diligence_revisions(diligence_case_id,revision,checklist,findings,created_by) values(d.id,p_expected_revision+1,p_snapshot->'checklist',p_snapshot->'findings',auth.uid());
 insert into airprop.diligence_revision_evidence(diligence_case_id,revision,version_id) select d.id,p_expected_revision+1,e.value::uuid from jsonb_array_elements((p_snapshot->'checklist')||(p_snapshot->'findings')) x cross join lateral jsonb_array_elements_text(x.value->'evidence_version_ids') e group by e.value::uuid;
 response=jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'diligence_case_id',d.id,'revision',p_expected_revision+1,'status','draft','idempotent',false);
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason) values(o.tenant_id,auth.uid(),a.role_code,'AIRPROP_DILIGENCE_REVISION_SAVED','airprop.diligence_case',d.id,response-'idempotent','Append-only diligence revision');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload) values(o.tenant_id,'airprop.diligence_case',d.id,p_expected_revision+1,'airprop.diligence.revision_saved.v1',response-'idempotent');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at) values(o.tenant_id,auth.uid(),k,h,response,201,statement_timestamp()+interval '30 days');
 return response;
end;$$;

create function customer_api.submit_airprop_diligence_review_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid,p_expected_revision integer,p_expected_underwriting_version integer,p_expected_policy_version integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; d airprop.diligence_cases%rowtype; r platform.idempotency_keys%rowtype; s jsonb; response jsonb; k text; h text; a record; submission uuid;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 if not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.diligence.submit','airprop_commercial') then raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 if p_expected_revision is null or p_expected_revision<1 or p_expected_underwriting_version is null or p_expected_underwriting_version<1 or p_expected_policy_version is distinct from 1 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_invalid_diligence' using errcode='22023';end if;
 perform 1 from airprop.investment_opportunities where id=o.id for update;
 select * into d from airprop.diligence_cases where id=p_diligence_case_id and tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id for update;
 if d.id is null then raise exception 'airprop_diligence_not_found' using errcode='P0002';end if;
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 s=app_private.airprop_diligence_snapshot_v1(d.id);
 perform app_private.check_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,s);
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,true);
 if not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.diligence.submit','airprop_commercial') then raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 k='airprop.diligence.submit.v1/'||d.id||'/'||p_idempotency_key;
 h=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'case',d.id,'revision',p_expected_revision,'underwriting_version',p_expected_underwriting_version,'policy_version',p_expected_policy_version)::text,'UTF8')),'hex');
 select * into r from platform.idempotency_keys where tenant_id=o.tenant_id and key=k for update;
 if found then
  if r.actor_id is distinct from auth.uid() or r.request_hash is distinct from h then raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return r.response_ref||jsonb_build_object('idempotent',true);
 end if;
 if (s->>'revision')::integer<>p_expected_revision or p_expected_revision<2 or exists(select 1 from airprop.diligence_submissions where diligence_case_id=d.id) then raise exception 'airprop_diligence_revision_conflict' using errcode='22023';end if;
 if d.underwriting_version<>p_expected_underwriting_version or d.policy_version<>p_expected_policy_version or o.status<>'underwriting'
 or not exists(select 1 from airprop.underwriting_cases c where c.id=d.underwriting_case_id and c.status='published' and c.current_version=d.underwriting_version) then raise exception 'airprop_diligence_baseline_conflict' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(s->'checklist') x where x.value->>'status'<>'satisfied' or jsonb_array_length(x.value->'evidence_version_ids')=0)
 or exists(select 1 from jsonb_array_elements(s->'findings') x where x.value->>'severity'='blocking' and x.value->>'status'='open') then raise exception 'airprop_diligence_not_ready' using errcode='22023';end if;
 insert into airprop.diligence_submissions(diligence_case_id,revision,submitted_by) values(d.id,p_expected_revision,auth.uid()) returning id into submission;
 response=jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'diligence_case_id',d.id,'revision',p_expected_revision,'submission_id',submission,'status','submitted','idempotent',false);
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason) values(o.tenant_id,auth.uid(),a.role_code,'AIRPROP_DILIGENCE_REVIEW_SUBMITTED','airprop.diligence_case',d.id,response-'idempotent','Submitted for review; no acquisition approval');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload) values(o.tenant_id,'airprop.diligence_submission',submission,1,'airprop.diligence.review_submitted.v1',response-'idempotent');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at) values(o.tenant_id,auth.uid(),k,h,response,201,statement_timestamp()+interval '30 days');
 return response;
end;$$;

create function customer_api.get_airprop_diligence_review_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; d airprop.diligence_cases%rowtype; s jsonb; current_version integer; submitted boolean;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 select * into d from airprop.diligence_cases where id=p_diligence_case_id and tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id;
 if d.id is null then raise exception 'airprop_diligence_not_found' using errcode='P0002';end if;
 s=app_private.airprop_diligence_snapshot_v1(d.id);
 perform app_private.check_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,s,false);
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 select c.current_version into current_version from airprop.underwriting_cases c where c.id=d.underwriting_case_id;
 select exists(select 1 from airprop.diligence_submissions where diligence_case_id=d.id) into submitted;
 return s||jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'diligence_case_id',d.id,'underwriting_version',d.underwriting_version,'policy_version',d.policy_version,
 'current_underwriting_version',current_version,'status',case when submitted then 'submitted' else 'draft' end,
 'can_manage',app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.diligence.manage','airprop_commercial'),
 'can_submit',app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.diligence.submit','airprop_commercial'),
 'ready_for_review',not exists(select 1 from airprop.diligence_revision_evidence e join documents.document_versions v on v.id=e.version_id join documents.documents doc on doc.id=v.document_id where e.diligence_case_id=d.id and e.revision=(s->>'revision')::integer and doc.current_version<>v.version) and not submitted and d.underwriting_version=current_version and o.status='underwriting' and not exists(select 1 from jsonb_array_elements(s->'checklist') x where x.value->>'status'<>'satisfied') and not exists(select 1 from jsonb_array_elements(s->'findings') x where x.value->>'severity'='blocking' and x.value->>'status'='open'));
end;$$;

create function customer_api.list_airprop_diligence_evidence_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_document_context_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; candidate record; rows jsonb='[]'::jsonb; verified documents.document_versions%rowtype;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 -- Resolve the explicit document actor first: never scan titles across unauthorized contexts.
 perform 1 from documents.resolve_vault_actor(p_document_context_id,'documents.vault.read',true);
 for candidate in select d.title,v.id from documents.documents d join documents.document_versions v on v.document_id=d.id and v.version=d.current_version
 join platform.workspace_property_bindings b on b.property_id=d.property_id and b.tenant_id=d.tenant_id and b.customer_workspace_id=o.workspace_id and b.status='active'
 where d.tenant_id=o.tenant_id and d.status='active' and d.deleted_at is null and d.is_evidence and d.evidence_status='verified' and v.scanning_status='clean'
 order by d.id limit 200 loop
  begin
   verified=app_private.require_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,candidate.id);
   rows=rows||jsonb_build_array(jsonb_build_object('document_id',verified.document_id,'version_id',verified.id,'document_version',verified.version,'title',candidate.title));
  exception when sqlstate '42501' or sqlstate '22000' then null;end;
  exit when jsonb_array_length(rows)>=100;
 end loop;
 return jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'evidence',rows);
end;$$;

revoke all on function customer_api.save_airprop_diligence_revision_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text),customer_api.submit_airprop_diligence_review_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text),customer_api.get_airprop_diligence_review_v1(uuid,uuid,uuid,uuid,uuid),customer_api.list_airprop_diligence_evidence_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.save_airprop_diligence_revision_v1(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text),customer_api.submit_airprop_diligence_review_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text),customer_api.get_airprop_diligence_review_v1(uuid,uuid,uuid,uuid,uuid),customer_api.list_airprop_diligence_evidence_v1(uuid,uuid,uuid,uuid) to authenticated;
commit;
