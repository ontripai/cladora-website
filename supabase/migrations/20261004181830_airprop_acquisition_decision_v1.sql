begin;

-- Internal dual-control decision only. No role grants, signatures, rights, money or opportunity transition.
insert into identity.permissions(code,resource,action,description) values
 ('airprop.acquisition.propose','airprop.acquisition','propose','Propose an internal acquisition decision against submitted diligence'),
 ('airprop.acquisition.approve','airprop.acquisition','approve','Record an independent AAL2 internal decision; no execution authority')
on conflict(code) do nothing;
insert into platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active' from platform.module_definitions m join identity.permissions p on p.code in('airprop.acquisition.propose','airprop.acquisition.approve') where m.code='airprop_commercial' and m.version=1
on conflict(module_definition_id,permission_id,binding_version) do nothing;
create or replace function app_private.validate_airprop_module_bindings_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare actual integer; matched integer;
begin
 select count(*) into actual from platform.module_permission_bindings b join platform.module_definitions m on m.id=b.module_definition_id where m.code='airprop_commercial' and m.version=1;
 select count(*) into matched from platform.module_permission_bindings b join platform.module_definitions m on m.id=b.module_definition_id join identity.permissions p on p.id=b.permission_id
 join(values('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),('airprop.asset.manage','manage'),('airprop.diligence.manage','manage'),('airprop.diligence.submit','manage'),('airprop.acquisition.propose','manage'),('airprop.acquisition.approve','manage')) x(code,mode) on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1 and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2 and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>9 or matched<>9 then raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002';end if;
end;$$;
revoke all on function app_private.validate_airprop_module_bindings_v1() from public,anon,authenticated,service_role;
select app_private.validate_airprop_module_bindings_v1();

create table airprop.acquisition_proposals(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references platform.tenants(id),
 workspace_id uuid not null references platform.customer_workspaces(id),
 opportunity_id uuid not null references airprop.investment_opportunities(id),
 diligence_case_id uuid not null references airprop.diligence_cases(id),
 submission_id uuid not null unique references airprop.diligence_submissions(id),
 underwriting_case_id uuid not null,
 underwriting_version integer not null,
 diligence_revision integer not null,
 policy_version integer not null check(policy_version=1),
 rationale text not null check(length(btrim(rationale)) between 1 and 2000),
 proposed_by uuid not null references auth.users(id),
 proposed_at timestamptz not null default statement_timestamp(),
 expires_at timestamptz not null default statement_timestamp()+interval '7 days',
 foreign key(underwriting_case_id,underwriting_version) references airprop.underwriting_versions(underwriting_case_id,version),
 foreign key(diligence_case_id,diligence_revision) references airprop.diligence_revisions(diligence_case_id,revision),
 check(expires_at>proposed_at)
);
create index acquisition_proposal_tenant_idx on airprop.acquisition_proposals(tenant_id);
create index acquisition_proposal_workspace_idx on airprop.acquisition_proposals(workspace_id,tenant_id);
create index acquisition_proposal_opportunity_idx on airprop.acquisition_proposals(opportunity_id);
create index acquisition_proposal_diligence_idx on airprop.acquisition_proposals(diligence_case_id,diligence_revision);
create index acquisition_proposal_underwriting_idx on airprop.acquisition_proposals(underwriting_case_id,underwriting_version);
create index acquisition_proposal_actor_idx on airprop.acquisition_proposals(proposed_by);
create table airprop.acquisition_decisions(
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null references airprop.acquisition_proposals(id),
 decision_revision integer not null check(decision_revision in(2,3)),
 decision text not null check(decision in('approve','reject')),
 rationale text not null check(length(btrim(rationale)) between 1 and 2000),
 decided_by uuid not null references auth.users(id),
 decided_at timestamptz not null default statement_timestamp(),
 unique(proposal_id,decided_by),
 unique(proposal_id,decision_revision)
);
create index acquisition_decision_actor_idx on airprop.acquisition_decisions(decided_by);
alter table airprop.acquisition_proposals enable row level security;
alter table airprop.acquisition_decisions enable row level security;
revoke all on airprop.acquisition_proposals,airprop.acquisition_decisions from public,anon,authenticated,service_role;
create function app_private.protect_airprop_acquisition_decision_v1() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'airprop_acquisition_decision_immutable' using errcode='22023';end;$$;
create trigger immutable_acquisition_proposal before update or delete on airprop.acquisition_proposals for each row execute function app_private.protect_airprop_acquisition_decision_v1();
create trigger immutable_acquisition_decision before update or delete on airprop.acquisition_decisions for each row execute function app_private.protect_airprop_acquisition_decision_v1();
revoke all on function app_private.protect_airprop_acquisition_decision_v1() from public,anon,authenticated,service_role;

-- Snapshot identity, readiness, baseline and current Vault evidence all come from server records.
create function app_private.require_airprop_acquisition_baseline_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid,p_current boolean)
returns airprop.diligence_submissions language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; d airprop.diligence_cases%rowtype; s airprop.diligence_submissions%rowtype; snapshot jsonb;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 select * into d from airprop.diligence_cases where id=p_diligence_case_id and tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id;
 select * into s from airprop.diligence_submissions where diligence_case_id=d.id;
 if d.id is null or s.id is null then raise exception 'airprop_acquisition_not_ready' using errcode='22023';end if;
 snapshot=app_private.airprop_diligence_snapshot_v1(d.id);
 if (snapshot->>'revision')::integer<>s.revision or d.policy_version<>1 then raise exception 'airprop_acquisition_baseline_conflict' using errcode='22023';end if;
 perform app_private.validate_airprop_diligence_snapshot_v1(snapshot-'revision');
 if exists(select 1 from jsonb_array_elements(snapshot->'checklist') x where x.value->>'status'<>'satisfied')
 or exists(select 1 from jsonb_array_elements(snapshot->'findings') x where x.value->>'severity'='blocking' and x.value->>'status'='open') then raise exception 'airprop_acquisition_not_ready' using errcode='22023';end if;
 perform app_private.check_airprop_diligence_evidence_v1(p_document_context_id,p_workspace_id,snapshot,p_current);
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 if p_current is null or (p_current and (o.status<>'underwriting' or not exists(select 1 from airprop.underwriting_cases c where c.id=d.underwriting_case_id and c.current_version=d.underwriting_version and c.status='published'))) then raise exception 'airprop_acquisition_baseline_conflict' using errcode='22023';end if;
 return s;
end;$$;
revoke all on function app_private.require_airprop_acquisition_baseline_v1(uuid,uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;
create function app_private.airprop_acquisition_state_v1(p_proposal_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('decision_revision',1+count(*),'approval_count',count(*) filter(where decision='approve'),
 'status',case when bool_or(decision='reject') then 'rejected' when count(*) filter(where decision='approve')=2 then 'internally_approved' else 'pending' end)
 from airprop.acquisition_decisions where proposal_id=p_proposal_id;
$$;
revoke all on function app_private.airprop_acquisition_state_v1(uuid) from public,anon,authenticated,service_role;
create function app_private.airprop_acquisition_independent_v1(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and not exists(
 select 1 from airprop.acquisition_proposals p join airprop.diligence_cases d on d.id=p.diligence_case_id join airprop.diligence_submissions s on s.id=p.submission_id
 join airprop.diligence_revisions r on r.diligence_case_id=d.id and r.revision=s.revision
 join airprop.underwriting_versions u on u.underwriting_case_id=d.underwriting_case_id and u.version=d.underwriting_version
 where p.id=p_proposal_id and (auth.uid() in(p.proposed_by,d.created_by,s.submitted_by,r.created_by,u.created_by)
 or exists(select 1 from airprop.diligence_revisions prior where prior.diligence_case_id=d.id and prior.created_by=auth.uid())
 or exists(select 1 from airprop.acquisition_decisions a where a.proposal_id=p.id and a.decided_by=auth.uid())))
 and exists(select 1 from airprop.acquisition_proposals where id=p_proposal_id);
$$;
revoke all on function app_private.airprop_acquisition_independent_v1(uuid) from public,anon,authenticated,service_role;

create function customer_api.propose_airprop_acquisition_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid,p_expected_submission_id uuid,p_expected_diligence_revision integer,p_expected_underwriting_version integer,p_rationale text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; d airprop.diligence_cases%rowtype; s airprop.diligence_submissions%rowtype; p airprop.acquisition_proposals%rowtype; r platform.idempotency_keys%rowtype; a record; k text; h text; response jsonb;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 if not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.acquisition.propose','airprop_commercial') then raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 if p_expected_submission_id is null or p_expected_diligence_revision is null or p_expected_diligence_revision<2 or p_expected_underwriting_version is null or p_expected_underwriting_version<1
 or p_rationale is null or length(btrim(p_rationale)) not between 1 and 2000 or p_rationale ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_invalid_acquisition' using errcode='22023';end if;
 perform 1 from airprop.investment_opportunities where id=o.id for update;
 s=app_private.require_airprop_acquisition_baseline_v1(p_context_id,p_workspace_id,p_opportunity_id,p_diligence_case_id,p_document_context_id,true);
 if not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.acquisition.propose','airprop_commercial') then raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 select * into d from airprop.diligence_cases where id=s.diligence_case_id;
 if s.id<>p_expected_submission_id or s.revision<>p_expected_diligence_revision or d.underwriting_version<>p_expected_underwriting_version then raise exception 'airprop_acquisition_baseline_conflict' using errcode='22023';end if;
 k='airprop.acquisition.propose.v1/'||d.id||'/'||p_idempotency_key;
 h=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'case',d.id,'submission',s.id,'revision',s.revision,'underwriting',d.underwriting_version,'rationale',btrim(p_rationale))::text,'UTF8')),'hex');
 select * into r from platform.idempotency_keys where tenant_id=o.tenant_id and key=k for update;
 if found then
  if r.actor_id is distinct from auth.uid() or r.request_hash is distinct from h then raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return r.response_ref||jsonb_build_object('idempotent',true);
 end if;
 if exists(select 1 from airprop.acquisition_proposals where submission_id=s.id) then raise exception 'airprop_acquisition_proposal_conflict' using errcode='22023';end if;
 insert into airprop.acquisition_proposals(tenant_id,workspace_id,opportunity_id,diligence_case_id,submission_id,underwriting_case_id,underwriting_version,diligence_revision,policy_version,rationale,proposed_by)
 values(o.tenant_id,o.workspace_id,o.id,d.id,s.id,d.underwriting_case_id,d.underwriting_version,s.revision,1,btrim(p_rationale),auth.uid()) returning * into p;
 response=jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'diligence_case_id',d.id,'proposal_id',p.id,'decision_revision',1,'status','pending','idempotent',false);
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason) values(o.tenant_id,auth.uid(),a.role_code,'AIRPROP_ACQUISITION_PROPOSED','airprop.acquisition_proposal',p.id,response-'idempotent','Internal proposal; no execution');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload) values(o.tenant_id,'airprop.acquisition_proposal',p.id,1,'airprop.acquisition.proposed.v1',response-'idempotent');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at) values(o.tenant_id,auth.uid(),k,h,response,201,statement_timestamp()+interval '30 days');
 return response;
end;$$;

create function customer_api.decide_airprop_acquisition_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid,p_proposal_id uuid,p_expected_decision_revision integer,p_decision text,p_rationale text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; p airprop.acquisition_proposals%rowtype; s airprop.diligence_submissions%rowtype; r platform.idempotency_keys%rowtype; a record; state jsonb; k text; h text; response jsonb;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 if not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.acquisition.approve','airprop_commercial') then raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 if p_expected_decision_revision is null or p_expected_decision_revision not in(1,2) or p_decision is null or p_decision not in('approve','reject')
 or p_rationale is null or length(btrim(p_rationale)) not between 1 and 2000 or p_rationale ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
 or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception 'airprop_invalid_acquisition' using errcode='22023';end if;
 perform 1 from airprop.investment_opportunities where id=o.id for update;
 select * into p from airprop.acquisition_proposals where id=p_proposal_id and tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id and diligence_case_id=p_diligence_case_id for update;
 if p.id is null then raise exception 'airprop_acquisition_not_found' using errcode='P0002';end if;
 s=app_private.require_airprop_acquisition_baseline_v1(p_context_id,p_workspace_id,p_opportunity_id,p_diligence_case_id,p_document_context_id,true);
 if s.id<>p.submission_id or s.revision<>p.diligence_revision then raise exception 'airprop_acquisition_baseline_conflict' using errcode='22023';end if;
 if not app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.acquisition.approve','airprop_commercial') then raise exception 'airprop_workspace_access_denied' using errcode='42501';end if;
 k='airprop.acquisition.decide.v1/'||p.id||'/'||p_idempotency_key;
 h=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'proposal',p.id,'revision',p_expected_decision_revision,'decision',p_decision,'rationale',btrim(p_rationale))::text,'UTF8')),'hex');
 select * into r from platform.idempotency_keys where tenant_id=o.tenant_id and key=k for update;
 if found then
  if r.actor_id is distinct from auth.uid() or r.request_hash is distinct from h then raise exception 'airprop_idempotency_conflict' using errcode='22023';end if;
  return r.response_ref||jsonb_build_object('idempotent',true);
 end if;
 if not app_private.airprop_acquisition_independent_v1(p.id) then raise exception 'airprop_acquisition_independence_required' using errcode='42501';end if;
 state=app_private.airprop_acquisition_state_v1(p.id);
 if p.expires_at<=clock_timestamp() or state->>'status'<>'pending' or (state->>'decision_revision')::integer<>p_expected_decision_revision then raise exception 'airprop_acquisition_decision_conflict' using errcode='22023';end if;
 insert into airprop.acquisition_decisions(proposal_id,decision_revision,decision,rationale,decided_by) values(p.id,p_expected_decision_revision+1,p_decision,btrim(p_rationale),auth.uid());
 response=app_private.airprop_acquisition_state_v1(p.id)||jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'diligence_case_id',p.diligence_case_id,'proposal_id',p.id,'idempotent',false);
 select * into a from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason) values(o.tenant_id,auth.uid(),a.role_code,'AIRPROP_ACQUISITION_DECISION_RECORDED','airprop.acquisition_proposal',p.id,response-'idempotent','Independent internal decision; no execution');
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload) values(o.tenant_id,'airprop.acquisition_proposal',p.id,p_expected_decision_revision+1,'airprop.acquisition.decision_recorded.v1',response-'idempotent');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at) values(o.tenant_id,auth.uid(),k,h,response,201,statement_timestamp()+interval '30 days');
 return response;
end;$$;

create function customer_api.get_airprop_acquisition_v1(p_context_id uuid,p_workspace_id uuid,p_opportunity_id uuid,p_diligence_case_id uuid,p_document_context_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o airprop.investment_opportunities%rowtype; d airprop.diligence_cases%rowtype; s airprop.diligence_submissions%rowtype; p airprop.acquisition_proposals%rowtype; state jsonb; current_baseline boolean; response jsonb; votes jsonb;
begin
 o=app_private.require_airprop_diligence_target_v1(p_context_id,p_workspace_id,p_opportunity_id,false);
 select * into d from airprop.diligence_cases where id=p_diligence_case_id and tenant_id=o.tenant_id and workspace_id=o.workspace_id and opportunity_id=o.id;
 if d.id is null then raise exception 'airprop_acquisition_not_found' using errcode='P0002';end if;
 response=jsonb_build_object('version',1,'workspace_id',o.workspace_id,'opportunity_id',o.id,'diligence_case_id',d.id,'underwriting_version',d.underwriting_version);
 select * into s from airprop.diligence_submissions where diligence_case_id=d.id;
 if s.id is null then return response||jsonb_build_object('eligible',false,'can_propose',false,'can_decide',false,'proposal',null,'reason','DILIGENCE_NOT_SUBMITTED');end if;
 s=app_private.require_airprop_acquisition_baseline_v1(p_context_id,p_workspace_id,p_opportunity_id,p_diligence_case_id,p_document_context_id,false);
 current_baseline=o.status='underwriting' and exists(select 1 from airprop.underwriting_cases c where c.id=d.underwriting_case_id and c.current_version=d.underwriting_version and c.status='published')
 and not exists(select 1 from airprop.diligence_revision_evidence e join documents.document_versions v on v.id=e.version_id join documents.documents doc on doc.id=v.document_id where e.diligence_case_id=d.id and e.revision=s.revision and doc.current_version<>v.version);
 select * into p from airprop.acquisition_proposals where submission_id=s.id;
 response=response||jsonb_build_object('submission_id',s.id,'diligence_revision',s.revision,'eligible',current_baseline,'reason',case when current_baseline then null else 'BASELINE_CHANGED' end,
 'can_propose',p.id is null and current_baseline and app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.acquisition.propose','airprop_commercial'));
 if p.id is null then return response||jsonb_build_object('proposal',null,'can_decide',false);end if;
 state=app_private.airprop_acquisition_state_v1(p.id);
 select coalesce(jsonb_agg(jsonb_build_object('decision_revision',a.decision_revision,'decision',a.decision,'rationale',a.rationale,'decided_at',a.decided_at) order by a.decision_revision),'[]'::jsonb) into votes from airprop.acquisition_decisions a where a.proposal_id=p.id;
 return response||jsonb_build_object('can_decide',current_baseline and p.expires_at>clock_timestamp() and state->>'status'='pending'
 and app_private.check_workspace_native_permission_v2(p_context_id,p_workspace_id,'airprop.acquisition.approve','airprop_commercial') and app_private.airprop_acquisition_independent_v1(p.id),
 'proposal',state||jsonb_build_object('proposal_id',p.id,'rationale',p.rationale,'proposed_at',p.proposed_at,'expires_at',p.expires_at,'expired',p.expires_at<=clock_timestamp(),'decisions',votes));
end;$$;
revoke all on function customer_api.propose_airprop_acquisition_v1(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text),customer_api.decide_airprop_acquisition_v1(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,text),customer_api.get_airprop_acquisition_v1(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function customer_api.propose_airprop_acquisition_v1(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text),customer_api.decide_airprop_acquisition_v1(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,text),customer_api.get_airprop_acquisition_v1(uuid,uuid,uuid,uuid,uuid) to authenticated;
commit;
