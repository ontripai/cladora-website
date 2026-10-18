-- PM-01A: private, operator-managed oversight register. No public API or webhook.
-- User instruction 2026-10-08 transfers PM ownership to Documentation/Oversight.
-- No customer tenant is fabricated; shared outbox/idempotency are tenant-bound.
create schema pm_control;
revoke all on schema pm_control from public, anon, authenticated, service_role;
alter default privileges in schema pm_control revoke execute on functions from public;
create table pm_control.projects (
 code text primary key, title text not null, baseline_ref text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table pm_control.workstreams (
 code text primary key, label text not null
);
create table pm_control.packages (
 project_code text not null references pm_control.projects,
 code text not null, owner_work text not null references pm_control.workstreams,
 scope text not null, current_cycle integer not null default 1 check(current_cycle>0),
 primary key(project_code,code)
);
create table pm_control.cycles (
 id uuid not null default gen_random_uuid() unique,
 project_code text not null, package_code text not null, cycle_no integer not null,
 parent_cycle integer, baseline_ref text not null,
 stage text not null default 'planned' check(stage in ('planned','ready','in_progress','in_review','tested','accepted','closed','cancelled')),
 version integer not null default 1 check(version>0), blocker text,
 required_criteria text[] not null check(cardinality(required_criteria)>0),
 candidate_commit text check(candidate_commit ~ '^[0-9a-f]{40}$'),
 contributor_ref text not null, started_at timestamptz, closed_at timestamptz,
 change_reason text, created_at timestamptz not null default clock_timestamp(),
 primary key(project_code,package_code,cycle_no),
 foreign key(project_code,package_code) references pm_control.packages,
 foreign key(project_code,package_code,parent_cycle) references pm_control.cycles(project_code,package_code,cycle_no),
 check((cycle_no=1 and parent_cycle is null) or (parent_cycle is not null and parent_cycle<cycle_no)),
 check((stage='closed')=(closed_at is not null))
);
create table pm_control.reports (
 id bigint generated always as identity primary key,
 cycle_id uuid not null references pm_control.cycles(id),
 reported_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
 source_ref text not null, source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 classification text not null default 'reported' check(classification='reported')
);
create table pm_control.evidence (
 id bigint generated always as identity primary key,
 cycle_id uuid not null references pm_control.cycles(id),
 criterion text not null, commit_sha text not null check(commit_sha ~ '^[0-9a-f]{40}$'),
 environment text not null, result text not null check(result in ('pass','fail','error','not_run')),
 classification text not null check(classification in ('reported','observed')),
 artifact_ref text not null, artifact_sha256 text not null check(artifact_sha256 ~ '^[0-9a-f]{64}$'),
 observed_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
 recorded_by text not null
);
create table pm_control.decisions (
 id bigint generated always as identity primary key,
 cycle_id uuid not null references pm_control.cycles(id),
 evidence_hash text not null, candidate_commit text not null,
 reviewer_ref text not null, decision_ref text not null, reason text not null,
 recorded_by text not null, created_at timestamptz not null default clock_timestamp()
);
create table pm_control.transitions (
 id bigint generated always as identity primary key,
 cycle_id uuid not null references pm_control.cycles(id),
 action text not null, from_stage text, to_stage text not null,
 from_version integer, to_version integer not null,
 request_key text not null, recorded_by text not null,
 occurred_at timestamptz not null default clock_timestamp()
);
-- Bounded PM command receipts, not a replacement shared idempotency service.
create table pm_control.command_receipts (
 project_code text not null references pm_control.projects,
 request_key text not null, request_body jsonb not null, actor text not null,
 receipt jsonb not null, recorded_at timestamptz not null default clock_timestamp(),
 primary key(project_code,request_key)
);
create function pm_control.deny_history_mutation() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin raise exception 'pm_history_is_append_only' using errcode='55000'; end $$;
do $$ declare t text; begin
 foreach t in array array['projects','workstreams','packages','cycles','reports','evidence','decisions','transitions','command_receipts'] loop
  execute format('alter table pm_control.%I enable row level security',t);
 end loop;
 foreach t in array array['reports','evidence','decisions','transitions','command_receipts'] loop
  execute format('create trigger immutable_history before update or delete on pm_control.%I for each row execute function pm_control.deny_history_mutation()',t);
 end loop;
end $$;

create function pm_control.command_v1(p_project text,p_key text,p_expected_version integer,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pm_control as $$
declare
 a text:=p_body->>'action'; k text:=p_body->>'package'; n integer;
 c pm_control.cycles%rowtype; old_stage text; old_version integer;
 r pm_control.command_receipts%rowtype; result jsonb; eh text; latest jsonb;
 request jsonb:=jsonb_build_object('expected_version',p_expected_version,'body',p_body);
begin
 -- Deliberately no auth/JWT impersonation and no app/service-role access.
 if current_user<>'postgres' then raise exception 'pm_operator_access_required' using errcode='42501'; end if;
 if p_key is null or length(p_key) not between 8 and 240 or jsonb_typeof(p_body) is distinct from 'object'
 or nullif(k,'') is null or a is null then raise exception 'invalid_pm_command'; end if;
 -- Small internal control plane: project lock serializes commands and exact replay.
 perform 1 from pm_control.projects where code=p_project for update;
 if not found then raise exception 'pm_project_not_found'; end if;
 select * into r from pm_control.command_receipts where project_code=p_project and request_key=p_key;
 if found then
  if r.request_body<>request or r.actor<>current_user then raise exception 'pm_idempotency_conflict'; end if;
  return r.receipt;
 end if;
 if a='register' then
  if p_expected_version is distinct from 0 then raise exception 'pm_version_conflict'; end if;
  insert into pm_control.packages(project_code,code,owner_work,scope)
   values(p_project,k,p_body->>'owner_work',p_body->>'scope');
  insert into pm_control.cycles(project_code,package_code,cycle_no,baseline_ref,required_criteria,contributor_ref)
   values(p_project,k,1,p_body->>'baseline_ref',array(select jsonb_array_elements_text(p_body->'required_criteria')),p_body->>'contributor_ref') returning * into c;
  old_stage:=null;old_version:=0;
 else
  select current_cycle into n from pm_control.packages where project_code=p_project and code=k;
  select * into c from pm_control.cycles where project_code=p_project and package_code=k and cycle_no=n for update;
  if not found then raise exception 'pm_package_not_found'; end if;
  if p_expected_version is distinct from c.version or (p_body->>'cycle_no')::integer is distinct from c.cycle_no then raise exception 'pm_version_conflict'; end if;
  old_stage:=c.stage;old_version:=c.version;
  if c.stage in ('accepted','closed','cancelled') and a not in ('close','reopen') then raise exception 'pm_cycle_frozen'; end if;
  if a='report' then
   insert into pm_control.reports(cycle_id,reported_at,source_ref,source_sha256,payload)
   values(c.id,(p_body->>'reported_at')::timestamptz,p_body->>'source_ref',p_body->>'source_sha256',p_body->'payload');
  elsif a='evidence' then
   if c.stage not in ('in_progress','in_review') then raise exception 'pm_evidence_stage'; end if;
   insert into pm_control.evidence(cycle_id,criterion,commit_sha,environment,result,classification,artifact_ref,artifact_sha256,observed_at,recorded_by)
   values(c.id,p_body->>'criterion',p_body->>'commit_sha',p_body->>'environment',p_body->>'result',p_body->>'classification',p_body->>'artifact_ref',p_body->>'artifact_sha256',(p_body->>'observed_at')::timestamptz,current_user);
  elsif a='block' then
   c.blocker:=nullif(trim(p_body->>'reason'),'');
  elsif a='advance' then
   if c.blocker is not null then raise exception 'pm_blocked'; end if;
   if c.stage='planned' and p_body->>'stage'='ready' then c.stage:='ready';
   elsif c.stage='ready' and p_body->>'stage'='in_progress' then c.stage:='in_progress';c.started_at:=clock_timestamp();
   elsif c.stage='in_progress' and p_body->>'stage'='in_review' then
    c.candidate_commit:=p_body->>'candidate_commit';
    if c.candidate_commit is null then raise exception 'pm_candidate_required'; end if;
    c.stage:='in_review';
   elsif c.stage='in_review' and p_body->>'stage'='tested' then
    if exists(select 1 from unnest(c.required_criteria) req where not coalesce((
     select e.result='pass' and e.classification='observed' from pm_control.evidence e
      where e.cycle_id=c.id and e.criterion=req and e.commit_sha=c.candidate_commit order by e.id desc limit 1),false)) then raise exception 'pm_required_test_missing_or_failed'; end if;
    c.stage:='tested';
   else raise exception 'pm_invalid_transition'; end if;
  elsif a='accept' then
   if c.stage<>'tested' or c.blocker is not null then raise exception 'pm_acceptance_stage'; end if;
   if nullif(trim(p_body->>'reviewer_ref'),'') is null or p_body->>'reviewer_ref'=c.contributor_ref
    or nullif(trim(p_body->>'decision_ref'),'') is null or nullif(trim(p_body->>'reason'),'') is null then raise exception 'pm_external_independent_decision_required'; end if;
   -- Operator records an independently supplied human acceptance reference.
   -- This is not an authenticated reviewer UI or a substitute for its future policy.
   select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)::text,'UTF8')),'hex') into eh from pm_control.evidence e where e.cycle_id=c.id;
   insert into pm_control.decisions(cycle_id,evidence_hash,candidate_commit,reviewer_ref,decision_ref,reason,recorded_by)
    values(c.id,eh,c.candidate_commit,p_body->>'reviewer_ref',p_body->>'decision_ref',p_body->>'reason',current_user);
   c.stage:='accepted';
  elsif a='close' then
   if c.stage<>'accepted' or not exists(select 1 from pm_control.decisions where cycle_id=c.id and candidate_commit=c.candidate_commit) then raise exception 'pm_acceptance_required'; end if;
   c.stage:='closed';c.closed_at:=clock_timestamp();
  elsif a='reopen' then
   if c.stage not in ('accepted','closed','cancelled') or nullif(trim(p_body->>'reason'),'') is null then raise exception 'pm_reopen_requires_history_and_reason'; end if;
   insert into pm_control.cycles(project_code,package_code,cycle_no,parent_cycle,baseline_ref,required_criteria,contributor_ref,change_reason)
    values(p_project,k,c.cycle_no+1,c.cycle_no,coalesce(p_body->>'baseline_ref',c.baseline_ref),c.required_criteria,coalesce(p_body->>'contributor_ref',c.contributor_ref),p_body->>'reason') returning * into c;
   update pm_control.packages set current_cycle=c.cycle_no where project_code=p_project and code=k;
  elsif a='cancel' then
   if nullif(trim(p_body->>'reason'),'') is null then raise exception 'pm_reason_required'; end if;
   c.stage:='cancelled';c.change_reason:=p_body->>'reason';
  else raise exception 'pm_unknown_command'; end if;
  if a<>'reopen' then
   c.version:=c.version+1;
   update pm_control.cycles set stage=c.stage,version=c.version,blocker=c.blocker,candidate_commit=c.candidate_commit,started_at=c.started_at,closed_at=c.closed_at,change_reason=c.change_reason where id=c.id;
  end if;
 end if;
 result:=jsonb_build_object('contract','pm-operator-receipt.v1','project',p_project,'package',k,'cycle_no',c.cycle_no,'cycle_id',c.id,'version',c.version,'stage',c.stage,'blocker',c.blocker,'request_key',p_key,'recorded_by',current_user);
 insert into pm_control.transitions(cycle_id,action,from_stage,to_stage,from_version,to_version,request_key,recorded_by)
 values(c.id,a,old_stage,c.stage,old_version,c.version,p_key,current_user);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(null,null,'database_operator','PM01_'||upper(a),'pm_control.cycle',c.id,result,'Internal oversight; operator action, not customer or reviewer impersonation');
 insert into pm_control.command_receipts(project_code,request_key,request_body,actor,receipt) values(p_project,p_key,request,current_user,result);
 return result;
end $$;
create view pm_control.package_status_v1 with(security_invoker=true) as
 select p.project_code,p.code,p.owner_work,p.scope,c.cycle_no,c.stage as recorded_stage,c.version,c.blocker,c.baseline_ref,c.started_at,c.closed_at,c.candidate_commit,
 r.reported_at,r.source_ref,r.payload as latest_reported_status,
 (select count(*) from pm_control.evidence e where e.cycle_id=c.id) as evidence_count
 from pm_control.packages p join pm_control.cycles c on c.project_code=p.project_code and c.package_code=p.code and c.cycle_no=p.current_cycle
 left join lateral(select * from pm_control.reports x where x.cycle_id=c.id order by x.id desc limit 1) r on true;
revoke all on all tables in schema pm_control from public,anon,authenticated,service_role;
revoke all on all sequences in schema pm_control from public,anon,authenticated,service_role;
revoke all on all functions in schema pm_control from public,anon,authenticated,service_role;
comment on schema pm_control is 'PM-01A private operator-managed internal oversight. No customer tenant, public API, webhook, automated reviewer or shared outbox integration.';
