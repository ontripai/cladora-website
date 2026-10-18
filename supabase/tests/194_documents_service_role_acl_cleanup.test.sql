begin;
select plan(9);

select is((
  select count(*)::integer from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='documents'
    and relation.relname in (
      'access_events','document_audit_links','document_links',
      'document_permissions','document_versions','documents','folders',
      'legal_holds','legal_records','lifecycle_events',
      'retention_policies','retention_records')
    and relation.relkind in ('r','p')
    and relation.relrowsecurity
),12,'D8 keeps RLS enabled on all 12 Documents application tables');

select is((
  select count(*)::integer from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(
    coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
  where namespace.nspname='documents'
    and relation.relname in (
      'access_events','document_audit_links','document_links',
      'document_permissions','document_versions','documents','folders',
      'legal_holds','legal_records','lifecycle_events',
      'retention_policies','retention_records')
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
),0,'D8 removes every direct service_role relation ACL from its 12-table scope');

select is((
  select count(*)::integer from pg_attribute attribute
  join pg_class relation on relation.oid=attribute.attrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(attribute.attacl) privilege
  where namespace.nspname='documents'
    and relation.relname in (
      'access_events','document_audit_links','document_links',
      'document_permissions','document_versions','documents','folders',
      'legal_holds','legal_records','lifecycle_events',
      'retention_policies','retention_records')
    and attribute.attnum>0 and not attribute.attisdropped
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
),0,'D8 leaves no direct service_role column ACL in scope');

select is((
  with targets(relation_name) as (values
    ('documents.access_events'::text),
    ('documents.document_audit_links'),
    ('documents.document_links'),
    ('documents.document_permissions'),
    ('documents.document_versions'),
    ('documents.documents'),
    ('documents.folders'),
    ('documents.legal_holds'),
    ('documents.legal_records'),
    ('documents.lifecycle_events'),
    ('documents.retention_policies'),
    ('documents.retention_records')
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
),0,'service_role has no effective table or column capability in D8 scope');

select is((
  select count(*)::integer from pg_policy policy
  join pg_class relation on relation.oid=policy.polrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='documents'
    and relation.relname in (
      'access_events','document_audit_links','document_links',
      'document_permissions','document_versions','documents','folders',
      'legal_holds','legal_records','lifecycle_events',
      'retention_policies','retention_records')
    and (0=any(policy.polroles)
      or (select oid from pg_roles where rolname='service_role')=any(policy.polroles))
),0,'no PUBLIC or service_role RLS policy applies to the D8 tables');

select is((
  select count(*)::integer from pg_proc function
  join pg_namespace namespace on namespace.oid=function.pronamespace
  where namespace.nspname='public'
    and function.proname in (
      'claim_document_scan_job_v1','complete_document_scan_job_v1',
      'fail_document_scan_job_v1','get_document_scan_queue_status_v1',
      'get_document_scan_target_v1','record_document_scan_v1')
    and function.prosecdef
    and has_function_privilege('service_role',function.oid,'EXECUTE')
),6,'D8 preserves all six scanner SECURITY DEFINER RPC grants');

select ok((
  select count(*)=2 and bool_and(
    relation.relname='document_scan_attestations'
    and privilege.privilege_type in ('SELECT','INSERT'))
  from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(
    coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
  where namespace.nspname='documents'
    and relation.relname in ('document_scan_attestations','document_scan_jobs')
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
) and has_table_privilege(
  'service_role','documents.document_scan_attestations','SELECT,INSERT')
  and not has_table_privilege(
    'service_role','documents.document_scan_attestations','UPDATE,DELETE')
  and not has_table_privilege(
    'service_role','documents.document_scan_jobs','SELECT,INSERT,UPDATE,DELETE'),
'D8 preserves the exact scanner table boundary');

select is((
  select count(*)::integer from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  cross join lateral aclexplode(
    coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
  where namespace.nspname='documents'
    and relation.relname in (
      'disposition_requests','document_retention_assignments',
      'document_scan_jobs','upload_intents')
    and privilege.grantee=(select oid from pg_roles where rolname='service_role')
),0,'D8 leaves the existing closed non-target Documents tables closed');

select ok((select rolbypassrls from pg_roles where rolname='service_role'),
  'D8 does not alter the built-in service_role role topology');

select * from finish();
rollback;
