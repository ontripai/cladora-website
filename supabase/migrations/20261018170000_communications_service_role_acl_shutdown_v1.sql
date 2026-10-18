begin;

-- SERVICE-SUBJECT-LINK-ROLE-BOUND-POOL-02 (S4)
-- Remove only the four legacy direct table capabilities held by service_role.
-- STEP-SU-02 remains a separately authorized operation and must have completed
-- before this migration is allowed to change the catalog.
select app_private.acquire_core_platform_role_safety_mutation_lock_v1();
select app_private.acquire_service_subject_link_role_safety_mutation_lock_v1();

do $$
declare
  v_direct_acl_count integer;
  v_protected_edge_count integer;
begin
  if to_regprocedure(
      'app_private.finalize_service_subject_link_role_membership_v1()') is null then
    raise exception 'service_subject_link_step_su_02_not_installed'
      using errcode='55000';
  end if;

  if to_regclass(
      'app_private.service_subject_link_step_su_02_receipt_v1') is null
    or not exists(
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      join pg_roles owner_role on owner_role.oid=relation.relowner
      where namespace.nspname='app_private'
        and relation.relname='service_subject_link_step_su_02_receipt_v1'
        and relation.relkind='r'
        and owner_role.rolname='supabase_admin')
    or exists(
      select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      cross join lateral aclexplode(relation.relacl) privilege
      where namespace.nspname='app_private'
        and relation.relname='service_subject_link_step_su_02_receipt_v1'
        and privilege.grantee<>relation.relowner)
    or not exists(
      select 1
      from app_private.service_subject_link_step_su_02_receipt_v1
      where receipt_key='STEP-SU-02'
        and finalized_by='supabase_admin'
        and finalized_at<=clock_timestamp()
        and role_graph_fingerprint=
          'executor>runtime|admin=false|inherit=false|set=true') then
    raise exception 'service_subject_link_step_su_02_receipt_missing_or_untrusted'
      using errcode='55000';
  end if;

  select count(*) into v_protected_edge_count
  from pg_auth_members membership
  join pg_roles granted on granted.oid=membership.roleid
  join pg_roles member on member.oid=membership.member
  where granted.rolname in (
      'cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor',
      'cladora_service_subject_link_owner')
    or member.rolname in (
      'cladora_service_subject_link_runtime',
      'cladora_service_subject_link_executor',
      'cladora_service_subject_link_owner');

  if v_protected_edge_count<>1 or not exists(
    select 1 from pg_auth_members membership
    join pg_roles granted on granted.oid=membership.roleid
    join pg_roles member on member.oid=membership.member
    where granted.rolname='cladora_service_subject_link_executor'
      and member.rolname='cladora_service_subject_link_runtime'
      and not membership.admin_option
      and not membership.inherit_option
      and membership.set_option
  ) then
    raise exception 'service_subject_link_step_su_02_not_finalized'
      using errcode='55000';
  end if;

  if (select count(*) from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='communications'
        and relation.relname in (
          'private_conversations','private_participants',
          'private_messages','private_message_documents')
        and relation.relkind in ('r','p')
        and relation.relrowsecurity)<>4 then
    raise exception 'communications_service_role_acl_shutdown_rls_precondition_failed'
      using errcode='55000';
  end if;

  select count(*) into v_direct_acl_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(
    coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
  where namespace.nspname='communications'
    and relation.relname in (
      'private_conversations','private_participants',
      'private_messages','private_message_documents')
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
    and privilege.privilege_type in (
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN');

  if v_direct_acl_count<>32 then
    raise exception 'communications_service_role_acl_shutdown_unexpected_prestate'
      using errcode='55000',detail=format(
        'expected 32 direct privileges across four tables, found %s',v_direct_acl_count);
  end if;
end;
$$;

revoke all privileges on table
  communications.private_conversations,
  communications.private_participants,
  communications.private_messages,
  communications.private_message_documents
from service_role;

do $$
begin
  if exists(
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    cross join lateral aclexplode(
      coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
    where namespace.nspname='communications'
      and relation.relname in (
        'private_conversations','private_participants',
        'private_messages','private_message_documents')
      and privilege.grantee=(select oid from pg_roles where rolname='service_role')
  ) or exists(
    select 1 from pg_attribute attribute
    join pg_class relation on relation.oid=attribute.attrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    cross join lateral aclexplode(attribute.attacl) privilege
    where namespace.nspname='communications'
      and relation.relname in (
        'private_conversations','private_participants',
        'private_messages','private_message_documents')
      and attribute.attnum>0 and not attribute.attisdropped
      and privilege.grantee=(select oid from pg_roles where rolname='service_role')
  ) then
    raise exception 'communications_service_role_direct_acl_remains'
      using errcode='55000';
  end if;

  if exists(
    with targets(relation_name) as (values
      ('communications.private_conversations'::text),
      ('communications.private_participants'),
      ('communications.private_messages'),
      ('communications.private_message_documents')
    )
    select 1 from targets
    cross join unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'
    ]) privilege_name
    where has_table_privilege('service_role',relation_name,privilege_name)
    union all
    select 1 from targets
    cross join unnest(array[
      'SELECT','INSERT','UPDATE','REFERENCES'
    ]) privilege_name
    where has_any_column_privilege('service_role',relation_name,privilege_name)
  ) then
    raise exception 'communications_service_role_effective_acl_remains'
      using errcode='55000';
  end if;

  if exists(
    select 1 from pg_policy policy
    join pg_class relation on relation.oid=policy.polrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='communications'
      and relation.relname in (
        'private_conversations','private_participants',
        'private_messages','private_message_documents')
      and (0=any(policy.polroles)
        or (select oid from pg_roles where rolname='service_role')=any(policy.polroles))
  ) then
    raise exception 'communications_service_role_policy_path_remains'
      using errcode='55000';
  end if;

  if (select count(*) from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='communications'
        and relation.relname in (
          'private_conversations','private_participants',
          'private_messages','private_message_documents')
        and relation.relrowsecurity)<>4 then
    raise exception 'communications_service_role_acl_shutdown_rls_postcondition_failed'
      using errcode='55000';
  end if;
end;
$$;

commit;
