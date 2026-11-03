-- UNAPPROVED / UNEXECUTED LOCAL-CI CANDIDATE ONLY.
-- Distinct deny-only demo capability. NOT S4; NOT STEP-SU-02.
-- Original S3/S4/G2 stay absent from this profile's applied history.
-- No role, credential, receipt, history entry or execution capability is created.
begin;
select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

do $$
declare
  v_direct_acl_count integer;
begin
  if exists(select 1 from pg_roles where rolname in (
    'cladora_service_subject_link_runtime',
    'cladora_service_subject_link_executor',
    'cladora_service_subject_link_owner'))
    or to_regclass('app_private.service_subject_link_step_su_02_receipt_v1') is not null
    or to_regprocedure('app_private.finalize_service_subject_link_role_membership_v1()') is not null
    or to_regprocedure('app_private.acquire_service_subject_link_role_safety_mutation_lock_v1()') is not null
    or to_regprocedure('app_private.assert_service_subject_link_role_safety_v1()') is not null
    or to_regprocedure('app_private.acquire_service_subject_link_role_safety_lease_v1()') is not null
    or to_regprocedure('app_private.core_platform_service_subject_link_role_safety_valid_v1()') is not null
  then
    raise exception 'demo_candidate_requires_s3_absent' using errcode='55000';
  end if;

  -- S1/S2 are installed private implementations only, never consumer capabilities.
  -- Deny unexpected metadata, direct grants (including PUBLIC), and inherited access.
  if exists(
    with targets(signature,volatility) as (values
      ('communications.resolve_private_message_currentness_v2(uuid,uuid,uuid,uuid,bigint)'::text,'s'::text),
      ('communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','v'),
      ('app_private.execute_service_request_message_link_v2(text,uuid,uuid,uuid,uuid,bigint,uuid,bigint)','v')
    )
    select 1 from targets
    left join pg_proc routine on routine.oid=to_regprocedure(signature)
    left join pg_roles owner_role on owner_role.oid=routine.proowner
    where routine.oid is null or owner_role.rolname is distinct from 'postgres'
      or routine.prosecdef is distinct from true
      or routine.provolatile::text is distinct from volatility
      or routine.proconfig is distinct from array['search_path=pg_catalog']::text[]
      or exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) privilege
        where privilege.grantee<>routine.proowner)
      or exists(select 1 from unnest(array[
          'anon','authenticated','service_role','cladora_rpc_owner',
          'cladora_ce_guide_runtime','cladora_ce_guide_executor'
        ]) denied_role
        where not exists(select 1 from pg_roles where rolname=denied_role)
          or has_function_privilege(denied_role,routine.oid,'EXECUTE'))
  ) then
    raise exception 'demo_candidate_s1_s2_private_boundary_invalid' using errcode='55000';
  end if;

  -- Verbatim original S4 table/RLS preconditions follow. S3/SU checks above
  -- are intentionally different: this candidate requires their ABSENCE.
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
