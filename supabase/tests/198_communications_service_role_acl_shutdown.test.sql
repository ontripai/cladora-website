begin;
select plan(7);

select is((
  select count(*)::integer from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='communications'
    and relation.relname in (
      'private_conversations','private_participants',
      'private_messages','private_message_documents')
    and relation.relrowsecurity
),4,'S4 keeps RLS enabled on all four private Communications tables');

select is((
  select count(*)::integer from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(
    coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
  where namespace.nspname='communications'
    and relation.relname in (
      'private_conversations','private_participants',
      'private_messages','private_message_documents')
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
),0,'S4 removes every direct service_role relation ACL');

select is((
  select count(*)::integer from pg_attribute attribute
  join pg_class relation on relation.oid=attribute.attrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(attribute.attacl) privilege
  where namespace.nspname='communications'
    and relation.relname in (
      'private_conversations','private_participants',
      'private_messages','private_message_documents')
    and attribute.attnum>0 and not attribute.attisdropped
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
),0,'S4 leaves no direct service_role column ACL');

select is((
  with targets(relation_name) as (values
    ('communications.private_conversations'::text),
    ('communications.private_participants'),
    ('communications.private_messages'),
    ('communications.private_message_documents')
  ), leaks as (
    select relation_name,privilege_name from targets
    cross join unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'
    ]) privilege_name
    where has_table_privilege('service_role',relation_name,privilege_name)
    union all
    select relation_name,privilege_name from targets
    cross join unnest(array[
      'SELECT','INSERT','UPDATE','REFERENCES'
    ]) privilege_name
    where has_any_column_privilege('service_role',relation_name,privilege_name)
  )
  select count(*)::integer from leaks
),0,'service_role has no effective table or column capability');

select is((
  select count(*)::integer from pg_policy policy
  join pg_class relation on relation.oid=policy.polrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='communications'
    and relation.relname in (
      'private_conversations','private_participants',
      'private_messages','private_message_documents')
    and (0=any(policy.polroles)
      or (select oid from pg_roles where rolname='service_role')=any(policy.polroles))
),0,'no PUBLIC or service_role policy applies to the four S4 tables');

select ok((
  select count(*)=3 and bool_and(
    relation.relname in (
      'private_conversations','private_participants','private_messages')
    and privilege.privilege_type='SELECT')
  from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(
    coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
  where namespace.nspname='communications'
    and relation.relname in (
      'private_conversations','private_participants',
      'private_messages','private_message_documents')
    and privilege.grantee=(select oid from pg_roles
      where rolname='cladora_service_subject_link_owner')
) and not has_table_privilege(
  'cladora_service_subject_link_owner',
  'communications.private_message_documents','SELECT'),
'S4 preserves exactly the three direct S3 package-owner reads and no Documents read');

select ok((
  select count(*)=1 and bool_and(
    granted.rolname='cladora_service_subject_link_executor'
    and member.rolname='cladora_service_subject_link_runtime'
    and not membership.admin_option
    and not membership.inherit_option
    and membership.set_option)
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
      'cladora_service_subject_link_owner')
) and exists(
  select 1 from app_private.service_subject_link_step_su_02_receipt_v1
  where receipt_key='STEP-SU-02'
    and finalized_by='supabase_admin'
    and finalized_at<=clock_timestamp()
    and role_graph_fingerprint=
      'executor>runtime|admin=false|inherit=false|set=true'
) and exists(
  select 1 from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  join pg_roles owner_role on owner_role.oid=relation.relowner
  where namespace.nspname='app_private'
    and relation.relname='service_subject_link_step_su_02_receipt_v1'
    and owner_role.rolname='supabase_admin'
    and not exists(select 1 from aclexplode(relation.relacl) privilege
      where privilege.grantee<>relation.relowner)
),'STEP-SU-02 has a trusted supabase_admin-only receipt and the exact SET-only edge');

select * from finish();
rollback;
