begin;

-- A setup reviewer has no customer dashboard. Discover only explicit native
-- workspace assignments with the read permission and a live property mandate.
create function customer_api.list_core_relationship_contexts_v1()
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_rows jsonb;
begin
 if auth.uid() is null then raise exception 'core_relationship_access_denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'context_id',q.context_id,'workspace_id',q.workspace_id,
   'property_id',q.property_id,'property_name',q.property_name,
   'can_propose',q.can_propose,'can_review',q.can_review)
   order by q.property_name,q.context_id),'[]'::jsonb) into v_rows
 from (
  select distinct c.id context_id,w.id workspace_id,p.id property_id,p.name property_name,
   app_private.check_workspace_native_permission_v2(c.id,w.id,'core.relationships.propose','core_unit_identity') can_propose,
   app_private.check_workspace_native_permission_v2(c.id,w.id,'core.relationships.review','core_unit_identity') can_review
  from identity.context_grants c
  join identity.memberships m on m.id=c.membership_id and m.tenant_id=c.tenant_id
  join platform.workspace_member_roles mr on mr.membership_id=m.id and mr.tenant_id=m.tenant_id
  join platform.workspace_roles r on r.id=mr.workspace_role_id and r.customer_workspace_id=mr.customer_workspace_id
  join platform.customer_workspaces w on w.id=mr.customer_workspace_id and w.tenant_id=m.tenant_id
  join platform.workspace_property_authorities a on a.customer_workspace_id=w.id and a.tenant_id=w.tenant_id
  join portfolio.properties p on p.id=a.property_id and p.tenant_id=w.tenant_id
  where m.user_id=auth.uid() and m.status='active' and m.starts_at<=statement_timestamp()
   and (m.ends_at is null or m.ends_at>statement_timestamp())
   and c.scope_type='tenant' and c.starts_at<=statement_timestamp()
   and (c.ends_at is null or c.ends_at>statement_timestamp())
   and mr.scope_type='workspace' and mr.valid_from<=statement_timestamp()
   and (mr.valid_to is null or mr.valid_to>statement_timestamp())
   and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
   and (r.valid_to is null or r.valid_to>statement_timestamp())
   and a.purpose='property_operations' and a.status='active'
   and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
   and app_private.check_workspace_native_permission_v2(c.id,w.id,'core.relationships.read','core_unit_identity') is true
   and app_private.current_workspace_property_mandate_v1(c.id,w.id,p.id,'property_operations') is not null
 ) q;
 return jsonb_build_object('contexts',v_rows);
end;$$;
revoke all on function customer_api.list_core_relationship_contexts_v1() from public,anon,service_role;
grant execute on function customer_api.list_core_relationship_contexts_v1() to authenticated;
commit;
