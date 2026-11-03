-- REVIEW ONLY, INACTIVE. Additive to ce_011_event_interest_operational_v1.sql.
-- No installation, owner assignment, role change or positive EXECUTE grant here.
-- Existing command/lifecycle/receipt functions and strict read_ce_events_v1 stay unchanged.
begin;

create function customer_api.read_ce_event_attendance_v1(
 p_context_id uuid, p_workspace_id uuid, p_event_id uuid, p_occurrence_id uuid,
 p_expected_event_version integer, p_limit integer default 25, p_after_attendance_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare
 v_scope record; v_event community.events%rowtype; v_occurrence community.event_occurrences%rowtype;
 v_targets jsonb; v_next uuid;
begin
 if p_context_id is null or p_workspace_id is null or p_event_id is null or p_occurrence_id is null
  or p_expected_event_version is null or p_expected_event_version<1
  or p_limit is null or p_limit not between 1 and 50 then
  raise exception 'ce_attendance_invalid_request' using errcode='22023';
 end if;
 -- Explicit read profile AND correction authority; record and persona imply neither.
 select * into strict v_scope from app_private.ce_event_authorize_v1(p_context_id,p_workspace_id,'events.event.read');
 perform app_private.ce_event_authorize_v1(p_context_id,p_workspace_id,'events.attendance.correct');
 select * into v_event from community.events
 where id=p_event_id and tenant_id=v_scope.tenant_id and workspace_id=p_workspace_id;
 if not found then raise exception 'ce_attendance_not_found' using errcode='P0002';end if;
 if app_private.ce_event_audience_eligible_v1(v_event.id,v_scope.membership_id) is not true then
  raise exception 'ce_attendance_access_denied' using errcode='42501';
 end if;
 select * into v_occurrence from community.event_occurrences
 where id=p_occurrence_id and event_id=p_event_id and tenant_id=v_scope.tenant_id and workspace_id=p_workspace_id;
 if not found or v_event.version<>p_expected_event_version or v_event.status not in('published','cancelled') then
  raise exception 'ce_attendance_stale' using errcode='40001';
 end if;
 -- An opaque identity cursor is only a keyset boundary, never authority. It must
 -- still name a visible row in this exact scope; removal/revoke forces restart.
 if p_after_attendance_id is not null and not exists(
  select 1 from community.event_attendance a
  join identity.memberships m on m.id=a.membership_id and m.tenant_id=a.tenant_id
  join identity.profiles p on p.user_id=m.user_id
  where a.id=p_after_attendance_id and a.tenant_id=v_scope.tenant_id and a.workspace_id=p_workspace_id
   and a.event_id=p_event_id and a.occurrence_id=p_occurrence_id and a.timezone=v_occurrence.timezone
   and length(btrim(p.display_name)) between 1 and 120
   and app_private.ce_event_audience_eligible_v1(p_event_id,m.id)
 ) then raise exception 'ce_attendance_stale_cursor' using errcode='40001';end if;

 with visible as materialized (
  select a.id,a.version,a.membership_id,btrim(p.display_name) display_name,a.attended,a.observed_local
  from community.event_attendance a
  join identity.memberships m on m.id=a.membership_id and m.tenant_id=a.tenant_id
  join identity.profiles p on p.user_id=m.user_id
  where a.tenant_id=v_scope.tenant_id and a.workspace_id=p_workspace_id
   and a.event_id=p_event_id and a.occurrence_id=p_occurrence_id and a.timezone=v_occurrence.timezone
   and (p_after_attendance_id is null or a.id>p_after_attendance_id)
   and length(btrim(p.display_name)) between 1 and 120
   and app_private.ce_event_audience_eligible_v1(p_event_id,m.id)
  order by a.id limit p_limit+1
 ), page as (select * from visible order by id limit p_limit)
 select coalesce((select jsonb_agg(jsonb_build_object(
   'attendance_id',id,'attendance_version',version,'membership_id',membership_id,
   'display_name',display_name,'attended',attended,'observed_local',to_char(observed_local,'YYYY-MM-DD"T"HH24:MI:SS')
  ) order by id) from page),'[]'::jsonb),
  case when (select count(*) from visible)>p_limit then (select id from page order by id desc limit 1) else null end
 into v_targets,v_next;

 return jsonb_build_object(
  'contract','ce011-attendance-projection.v1','version',1,'context_id',p_context_id,
  'workspace_id',p_workspace_id,'event_id',p_event_id,'occurrence_id',p_occurrence_id,
  'event_version',v_event.version,'event_status',v_event.status,'timezone',v_occurrence.timezone,
  'can_correct',true,'order','attendance_id.asc','limit',p_limit,'after_attendance_id',p_after_attendance_id,
  'next_cursor',v_next,'targets',v_targets
 );
end$$;

-- Remove default public execution in the same source transaction. Actual owner,
-- least-privilege caller/ACL and installation are separate Core/Platform gates.
revoke all on function customer_api.read_ce_event_attendance_v1(uuid,uuid,uuid,uuid,integer,integer,uuid)
 from public,anon,authenticated,service_role;

commit;
