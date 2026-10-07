begin;

-- The only shipped primary administrator templates are association_admin and
-- property_manager. Owner portfolios and hybrid governance need their own
-- reviewed roles before commercial access or primary invitation is permitted.
create function app_private.guard_undefined_primary_role_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_type platform.workspace_type; v_role text;
begin
  select workspace_type into v_type from platform.customer_workspaces
  where id=new.customer_workspace_id;
  if not found then return new; end if;
  if v_type in ('OWNER_PORTFOLIO','HYBRID') then
    if tg_table_name='workspace_access_bases' then
      raise exception 'workspace_primary_admin_role_not_defined' using errcode='22023';
    end if;
    select code into v_role from identity.roles where id=new.role_id;
    if v_role in ('association_admin','property_manager') then
      raise exception 'workspace_primary_admin_role_not_defined' using errcode='22023';
    end if;
  end if;
  return new;
end $$;

create trigger guard_undefined_workspace_access_basis_role
before insert or update of role_id,customer_workspace_id on platform.workspace_access_bases
for each row execute function app_private.guard_undefined_primary_role_v1();
create trigger guard_undefined_workspace_invitation_role
before insert or update of role_id,customer_workspace_id on platform.workspace_invitations
for each row execute function app_private.guard_undefined_primary_role_v1();
revoke all on function app_private.guard_undefined_primary_role_v1() from public,anon,authenticated,service_role;
commit;
