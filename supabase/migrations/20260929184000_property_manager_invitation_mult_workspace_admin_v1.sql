begin;

create or replace function customer_api.list_invitable_manager_properties_v1(p_context uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
    from platform.workspace_property_bindings b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id and w.tenant_id=b.tenant_id
      and w.lifecycle_status='ACTIVE'
    join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id and p.status='active'
    where b.status='active' and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())
      and communications.can_manage_property_manager_invites(auth.uid(),p_context,w.id,p.id)),'[]'::jsonb);
end $$;

create or replace function customer_api.create_property_manager_invitation_v1(p_context uuid,p_property uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid(); v_email text:=lower(trim(coalesce(p_email,''))); v_membership uuid;
  v_workspace uuid; v_tenant uuid; v_id uuid;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>320 then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  select m.id into v_membership from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where g.id=p_context and m.user_id=v_actor and m.status='active'
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  if v_membership is null then raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  select w.id,w.tenant_id into v_workspace,v_tenant from platform.workspace_property_bindings b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id and w.tenant_id=b.tenant_id
      and w.lifecycle_status='ACTIVE'
    join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id and p.status='active'
    where b.property_id=p_property and b.status='active' and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())
      and communications.can_manage_property_manager_invites(v_actor,p_context,w.id,p.id)
    limit 1;
  if v_workspace is null then raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  update communications.property_manager_invitations set status='expired'
    where workspace_id=v_workspace and property_id=p_property and normalized_email=v_email
      and status='pending' and expires_at<=statement_timestamp();
  perform pg_advisory_xact_lock(hashtextextended(
    'property_manager_invitation:'||v_workspace::text||':'||p_property::text||':'||v_email,0));
  select id into v_id from communications.property_manager_invitations
    where workspace_id=v_workspace and property_id=p_property and normalized_email=v_email and status='pending';
  if v_id is not null then return jsonb_build_object('id',v_id,'replayed',true,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null)); end if;
  insert into communications.property_manager_invitations(tenant_id,workspace_id,property_id,normalized_email,
    invited_by,inviter_membership_id,inviter_context_id)
    values(v_tenant,v_workspace,p_property,v_email,v_actor,v_membership,p_context) returning id into v_id;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
    select v_tenant,v_actor,r.code,'property_manager_invitation.create',
      'communications.property_manager_invitation',v_id,'Property-scoped manager invitation',
      jsonb_build_object('workspace_id',v_workspace,'property_id',p_property,'email',v_email)
    from identity.memberships m join identity.roles r on r.id=m.role_id where m.id=v_membership;
  return jsonb_build_object('id',v_id,'replayed',false,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null));
end $$;

create or replace function customer_api.list_managed_property_manager_invitations_v1(p_context uuid,p_property uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_workspace uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  select w.id into v_workspace from platform.workspace_property_bindings b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id and w.tenant_id=b.tenant_id
      and w.lifecycle_status='ACTIVE'
    join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id and p.status='active'
    where b.property_id=p_property and b.status='active' and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())
      and communications.can_manage_property_manager_invites(auth.uid(),p_context,w.id,p.id)
    limit 1;
  if v_workspace is null then raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.normalized_email,'expires_at',i.expires_at) order by i.created_at desc)
    from communications.property_manager_invitations i where i.workspace_id=v_workspace and i.property_id=p_property
      and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
end $$;

commit;
