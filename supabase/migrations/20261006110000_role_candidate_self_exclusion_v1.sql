
begin;
create or replace function customer_api.list_workspace_role_assignment_candidates_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare a record; result jsonb;
begin
  select * into a from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  select coalesce(jsonb_agg(jsonb_build_object('membership_id',m.id,
    'member_name',nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'role_code',r.code)
    order by m.id),'[]'::jsonb) into result
  from identity.memberships m join identity.roles r on r.id=m.role_id
    and (r.tenant_id is null or r.tenant_id=m.tenant_id)
  join auth.users u on u.id=m.user_id
  where m.tenant_id=a.tenant_id and m.id<>a.membership_id
    and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and exists(select 1 from identity.context_grants g where g.membership_id=m.id and g.tenant_id=m.tenant_id
      and g.scope_type='tenant' and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp()));
  return jsonb_build_object('workspace_id',a.workspace_id,'members',result);
end;
$$;
comment on function customer_api.list_workspace_role_assignment_candidates_v1(uuid)
 is 'Lists eligible active tenant members except the current grantor, who is never a valid assignment target.';
commit;
