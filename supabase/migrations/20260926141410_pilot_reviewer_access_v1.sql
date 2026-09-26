begin;

-- A second, narrowly scoped human can review building setup during an active pilot.
-- This is deliberately separate from the primary-admin and commercial invitation flows.
create table platform.pilot_setup_reviewers (
 id uuid primary key default gen_random_uuid(),
 customer_workspace_id uuid not null references platform.customer_workspaces(id),
 normalized_email text not null,
 status text not null default 'prepared' check (status in ('prepared','active','revoked')),
 expires_at timestamptz not null,
 reason text not null,
 prepared_by uuid not null references auth.users(id),
 prepared_at timestamptz not null default statement_timestamp(),
 activated_by uuid references auth.users(id),
 membership_id uuid references identity.memberships(id),
 context_grant_id uuid references identity.context_grants(id),
 revoked_at timestamptz,
 check (normalized_email=lower(btrim(normalized_email))),
 check ((status='prepared' and activated_by is null and membership_id is null and context_grant_id is null)
     or (status='active' and activated_by is not null and membership_id is not null and context_grant_id is not null)
     or status='revoked')
);
create unique index pilot_setup_reviewers_open_email on platform.pilot_setup_reviewers(customer_workspace_id,normalized_email)
 where status in ('prepared','active');
alter table platform.pilot_setup_reviewers enable row level security;
revoke all on platform.pilot_setup_reviewers from public,anon,authenticated;
grant all on platform.pilot_setup_reviewers to service_role;

create function platform.end_pilot_reviewers_with_basis() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_row platform.pilot_setup_reviewers; v_now timestamptz:=statement_timestamp();
begin
 if old.mode='PILOT' and old.status='active' and new.status<>'active' then
   for v_row in select * from platform.pilot_setup_reviewers
     where customer_workspace_id=new.customer_workspace_id and status in ('prepared','active') for update loop
     if v_row.status='active' then
       update identity.memberships set status='revoked',ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_row.membership_id;
       update identity.context_grants set ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_row.context_grant_id;
     end if;
     update platform.pilot_setup_reviewers set status='revoked',revoked_at=v_now where id=v_row.id;
   end loop;
 end if;
 return new;
end $$;
revoke all on function platform.end_pilot_reviewers_with_basis() from public,anon,authenticated,service_role;
create trigger end_pilot_reviewers_with_basis after update of status on platform.workspace_access_bases
for each row execute function platform.end_pilot_reviewers_with_basis();

create function app_private.prepare_pilot_setup_reviewer_v1(p_workspace_id uuid,p_email text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ws platform.customer_workspaces; v_basis platform.workspace_access_bases; v_id uuid; v_email text:=lower(btrim(coalesce(p_email,'')));
begin
 if auth.uid() is null or not app_private.has_platform_aal2() or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
 then raise exception 'access_denied' using errcode='42501'; end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>320
    or length(btrim(coalesce(p_reason,'')))<10 or length(p_reason)>500
 then raise exception 'invalid_reviewer' using errcode='22023'; end if;
 select * into v_ws from platform.customer_workspaces where id=p_workspace_id for update;
 select * into v_basis from platform.workspace_access_bases where customer_workspace_id=p_workspace_id
   and mode='PILOT' and status='active' and expires_at>statement_timestamp() order by expires_at desc limit 1;
 if not found or v_ws.environment<>'PILOT' or v_ws.lifecycle_status<>'ACTIVE' or v_ws.primary_admin_user_id is null
 then raise exception 'active_pilot_required' using errcode='42501'; end if;
 if exists(select 1 from auth.users where id=v_ws.primary_admin_user_id and lower(btrim(email))=v_email)
 then raise exception 'independent_reviewer_required' using errcode='42501'; end if;
 insert into platform.pilot_setup_reviewers(customer_workspace_id,normalized_email,expires_at,reason,prepared_by)
 values(p_workspace_id,v_email,v_basis.expires_at,btrim(p_reason),auth.uid()) returning id into v_id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,occurred_at)
 values(v_ws.tenant_id,auth.uid(),'PLATFORM_CONTROL_PLANE','PILOT_SETUP_REVIEWER_PREPARED','pilot_setup_reviewer',v_id,p_reason,statement_timestamp());
 return jsonb_build_object('id',v_id,'expires_at',v_basis.expires_at);
end $$;

create function app_private.revoke_pilot_setup_reviewer_v1(p_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row platform.pilot_setup_reviewers; v_now timestamptz:=statement_timestamp();
begin
 if auth.uid() is null or not app_private.has_platform_aal2() or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
 then raise exception 'access_denied' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'reason_required' using errcode='22023'; end if;
 select * into v_row from platform.pilot_setup_reviewers where id=p_id for update;
 if not found then raise exception 'reviewer_not_found' using errcode='P0002'; end if;
 if v_row.status='active' then
   update identity.memberships set status='revoked',ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_row.membership_id;
   update identity.context_grants set ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_row.context_grant_id;
 end if;
 update platform.pilot_setup_reviewers set status='revoked',revoked_at=v_now where id=p_id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,occurred_at)
 select w.tenant_id,auth.uid(),'PLATFORM_CONTROL_PLANE','PILOT_SETUP_REVIEWER_REVOKED','pilot_setup_reviewer',p_id,p_reason,v_now
 from platform.customer_workspaces w where w.id=v_row.customer_workspace_id;
 return jsonb_build_object('id',p_id,'status','revoked');
end $$;

create function app_private.claim_pilot_setup_reviewer_v1(p_workspace_id uuid,p_display_name text,p_locale text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=statement_timestamp(); v_email text; v_row platform.pilot_setup_reviewers; v_ws platform.customer_workspaces;
 v_role uuid; v_membership uuid; v_grant uuid;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2' or length(btrim(coalesce(p_display_name,''))) not between 2 and 120
    or p_locale not in ('ro','en','fa') then raise exception 'verified_aal2_required' using errcode='42501'; end if;
 select lower(btrim(email)) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into v_row from platform.pilot_setup_reviewers where customer_workspace_id=p_workspace_id
   and normalized_email=v_email and status='prepared' and expires_at>v_now for update;
 if not found then raise exception 'reviewer_preparation_unavailable' using errcode='42501'; end if;
 select * into v_ws from platform.customer_workspaces where id=p_workspace_id for update;
 if v_ws.environment<>'PILOT' or v_ws.lifecycle_status<>'ACTIVE' or v_ws.primary_admin_user_id=auth.uid()
    or not exists(select 1 from platform.workspace_access_bases where customer_workspace_id=p_workspace_id
      and mode='PILOT' and status='active' and expires_at>=v_row.expires_at and expires_at>v_now)
 then raise exception 'pilot_access_unavailable' using errcode='42501'; end if;
 if exists(select 1 from identity.memberships where tenant_id=v_ws.tenant_id and user_id=auth.uid() and status='active')
 then raise exception 'existing_membership_requires_review' using errcode='42501'; end if;
 insert into identity.roles(tenant_id,code,name,is_system) values(v_ws.tenant_id,'building_setup_reviewer','Building setup reviewer',false)
 on conflict(tenant_id,code) do update set name=excluded.name returning id into v_role;
 insert into identity.role_permissions(role_id,permission_id,effect)
 select v_role,id,'allow' from identity.permissions where code in ('onboarding.import.read','onboarding.import.approve')
 on conflict(role_id,permission_id) do nothing;
 insert into identity.profiles(user_id,display_name,locale) values(auth.uid(),btrim(p_display_name),p_locale)
 on conflict(user_id) do nothing;
 insert into identity.memberships(tenant_id,user_id,role_id,status,starts_at,ends_at)
 values(v_ws.tenant_id,auth.uid(),v_role,'active',v_now,v_row.expires_at) returning id into v_membership;
 insert into identity.context_grants(membership_id,tenant_id,scope_type,starts_at,ends_at)
 values(v_membership,v_ws.tenant_id,'tenant',v_now,v_row.expires_at) returning id into v_grant;
 update platform.pilot_setup_reviewers set status='active',activated_by=auth.uid(),membership_id=v_membership,context_grant_id=v_grant
 where id=v_row.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,occurred_at)
 values(v_ws.tenant_id,auth.uid(),'CUSTOMER_REVIEWER','PILOT_SETUP_REVIEWER_ACTIVATED','pilot_setup_reviewer',v_row.id,
 'Verified independent reviewer activated temporary access',v_now);
 return jsonb_build_object('context_id',v_grant,'expires_at',v_row.expires_at);
end $$;

create function app_private.my_pilot_setup_reviewer_v1(p_workspace_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 then raise exception 'verified_identity_required' using errcode='42501'; end if;
 select jsonb_build_object('status',r.status,'context_id',g.id,'expires_at',r.expires_at,
   'workspace_id',w.id,
   'runs',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'building',s.setup_payload#>>'{building,name}'))
   from platform.building_setup_runs s where s.tenant_id=w.tenant_id and s.status='submitted' and r.status='active'
      and coalesce(auth.jwt()->>'aal','')='aal2' and r.activated_by=auth.uid()
      and exists(select 1 from identity.memberships m where m.id=r.membership_id and m.status='active' and m.ends_at>statement_timestamp())
      and exists(select 1 from platform.workspace_access_bases b where b.customer_workspace_id=w.id
        and b.mode='PILOT' and b.status='active' and b.expires_at>statement_timestamp())), '[]'::jsonb)) into v_result
 from platform.pilot_setup_reviewers r join platform.customer_workspaces w on w.id=r.customer_workspace_id
 left join identity.context_grants g on g.id=r.context_grant_id and g.ends_at>statement_timestamp()
 where (p_workspace_id is null or r.customer_workspace_id=p_workspace_id) and r.normalized_email=(select lower(btrim(email)) from auth.users where id=auth.uid())
 and r.status in ('prepared','active') and r.expires_at>statement_timestamp()
 order by r.expires_at desc limit 1;
 return coalesce(v_result,'{}'::jsonb);
end $$;

create or replace function app_private.approve_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform as $$
declare c record;r platform.building_setup_runs%rowtype;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.approve');
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if exists(select 1 from platform.pilot_setup_reviewers reviewer
     where reviewer.context_grant_id=p_context_id and reviewer.activated_by=auth.uid())
    and not exists(select 1 from platform.pilot_setup_reviewers reviewer
     where reviewer.context_grant_id=p_context_id and reviewer.activated_by=auth.uid()
       and reviewer.status='active' and reviewer.expires_at>statement_timestamp()
       and reviewer.customer_workspace_id=r.customer_workspace_id
       and exists(select 1 from platform.workspace_access_bases b where b.customer_workspace_id=r.customer_workspace_id
         and b.mode='PILOT' and b.status='active' and b.expires_at>statement_timestamp()))
 then raise exception 'reviewer_scope_denied' using errcode='42501'; end if;
 if r.status<>'submitted' then raise exception 'setup_invalid_state' using errcode='22023'; end if;
 if r.submitted_by=auth.uid() then raise exception 'setup_dual_control_violation' using errcode='42501'; end if;
 update platform.building_setup_runs set status='approved',approved_by=auth.uid(),updated_at=statement_timestamp() where id=r.id;
 return jsonb_build_object('version',1,'run_id',r.id,'status','approved');
end $$;

-- The historical provision endpoint used the approval permission. Keep existing
-- administrators working while denying a reviewer context the mutation itself.
create or replace function app_private.provision_building_setup_v1(p_context_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,platform,portfolio,finance as $$
declare c record;r platform.building_setup_runs%rowtype;p_id uuid;b_id uuid;x jsonb;
begin
 select * into c from app_private.require_setup_context(p_context_id,'onboarding.import.approve');
 if exists(select 1 from identity.context_grants g join identity.memberships m on m.id=g.membership_id
     join identity.roles role on role.id=m.role_id where g.id=p_context_id and m.user_id=auth.uid()
       and role.code='building_setup_reviewer')
 then raise exception 'reviewer_cannot_provision' using errcode='42501'; end if;
 select * into r from platform.building_setup_runs where id=p_run_id and tenant_id=c.tenant_id for update;
 if not found then raise exception 'setup_run_not_found' using errcode='P0002'; end if;
 if r.status='provisioned' then return jsonb_build_object('version',1,'run_id',r.id,'status',r.status,'property_id',r.property_id,'idempotent',true); end if;
 if r.status<>'approved' then raise exception 'setup_approval_required' using errcode='22023'; end if;
 insert into portfolio.properties(tenant_id,type,name,base_currency,status)
 values(c.tenant_id,'condominium',r.setup_payload#>>'{association,name}','RON','active') returning id into p_id;
 insert into portfolio.buildings(tenant_id,property_id,code,name,floors,status)
 values(c.tenant_id,p_id,coalesce(r.setup_payload#>>'{building,code}','MAIN'),r.setup_payload#>>'{building,name}',nullif(r.setup_payload#>>'{building,floors}','')::smallint,'active') returning id into b_id;
 for x in select value from jsonb_array_elements(r.setup_payload->'units') loop
   insert into portfolio.units(tenant_id,building_id,code,floor,area_m2,status)
   values(c.tenant_id,b_id,x->>'code',nullif(x->>'floor','')::smallint,nullif(x->>'area_m2','')::numeric,'active');
 end loop;
 insert into finance.accounting_periods(tenant_id,property_id,starts_on,ends_on,status)
 values(c.tenant_id,p_id,(r.setup_payload->>'period_start')::date,(r.setup_payload->>'period_end')::date,'open');
 update platform.building_setup_runs set status='provisioned',property_id=p_id,updated_at=statement_timestamp() where id=r.id;
 return jsonb_build_object('version',1,'run_id',r.id,'status','provisioned','property_id',p_id,'building_id',b_id,'idempotent',false);
end $$;

revoke all on function app_private.prepare_pilot_setup_reviewer_v1(uuid,text,text),
 app_private.revoke_pilot_setup_reviewer_v1(uuid,text),app_private.claim_pilot_setup_reviewer_v1(uuid,text,text),
 app_private.my_pilot_setup_reviewer_v1(uuid) from public,anon;
grant execute on function app_private.prepare_pilot_setup_reviewer_v1(uuid,text,text),
 app_private.revoke_pilot_setup_reviewer_v1(uuid,text),app_private.claim_pilot_setup_reviewer_v1(uuid,text,text),
 app_private.my_pilot_setup_reviewer_v1(uuid) to authenticated,service_role;

create function customer_api.prepare_pilot_setup_reviewer_v1(p_workspace_id uuid,p_email text,p_reason text)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.prepare_pilot_setup_reviewer_v1(p_workspace_id,p_email,p_reason)$$;
create function customer_api.revoke_pilot_setup_reviewer_v1(p_id uuid,p_reason text)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.revoke_pilot_setup_reviewer_v1(p_id,p_reason)$$;
create function customer_api.claim_pilot_setup_reviewer_v1(p_workspace_id uuid,p_display_name text,p_locale text)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.claim_pilot_setup_reviewer_v1(p_workspace_id,p_display_name,p_locale)$$;
create function customer_api.my_pilot_setup_reviewer_v1(p_workspace_id uuid default null)
returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$select app_private.my_pilot_setup_reviewer_v1(p_workspace_id)$$;
revoke all on function customer_api.prepare_pilot_setup_reviewer_v1(uuid,text,text),
 customer_api.revoke_pilot_setup_reviewer_v1(uuid,text),customer_api.claim_pilot_setup_reviewer_v1(uuid,text,text),
 customer_api.my_pilot_setup_reviewer_v1(uuid) from public,anon;
grant execute on function customer_api.prepare_pilot_setup_reviewer_v1(uuid,text,text),
 customer_api.revoke_pilot_setup_reviewer_v1(uuid,text),customer_api.claim_pilot_setup_reviewer_v1(uuid,text,text),
 customer_api.my_pilot_setup_reviewer_v1(uuid) to authenticated,service_role;
commit;
