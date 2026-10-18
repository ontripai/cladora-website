begin;

-- DOCUMENTS-CANONICAL-CUTOVER-08 (D8)
-- Contract only the legacy direct service_role table ACL on Documents
-- application relations. Scanner, Storage, Communications, function,
-- sequence, role, credential, and route boundaries remain unchanged.
do $$
declare
  v_direct_acl_count integer;
begin
  if not exists(
    select 1 from pg_roles
    where rolname='service_role' and rolbypassrls
  ) then
    raise exception 'documents_service_role_acl_cleanup_role_precondition_failed'
      using errcode='55000';
  end if;

  if (select count(*) from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='documents'
        and relation.relname in (
          'access_events','document_audit_links','document_links',
          'document_permissions','document_versions','documents','folders',
          'legal_holds','legal_records','lifecycle_events',
          'retention_policies','retention_records')
        and relation.relkind in ('r','p')
        and relation.relrowsecurity)<>12 then
    raise exception 'documents_service_role_acl_cleanup_rls_precondition_failed'
      using errcode='55000';
  end if;

  select count(*) into v_direct_acl_count
  from pg_class relation
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
    and privilege.privilege_type in (
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN');

  if v_direct_acl_count<>96 then
    raise exception 'documents_service_role_acl_cleanup_unexpected_prestate'
      using errcode='55000',detail=format(
        'expected 96 direct privileges across 12 application tables, found %s',
        v_direct_acl_count);
  end if;

  if exists(
    select 1 from pg_attribute attribute
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
  ) then
    raise exception 'documents_service_role_acl_cleanup_column_precondition_failed'
      using errcode='55000';
  end if;

  if (select count(*) from pg_proc function
      join pg_namespace namespace on namespace.oid=function.pronamespace
      where namespace.nspname='public'
        and function.proname in (
          'claim_document_scan_job_v1','complete_document_scan_job_v1',
          'fail_document_scan_job_v1','get_document_scan_queue_status_v1',
          'get_document_scan_target_v1','record_document_scan_v1')
        and function.prosecdef
        and has_function_privilege('service_role',function.oid,'EXECUTE'))<>6
    or (select count(*) from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      cross join lateral aclexplode(
        coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
      where namespace.nspname='documents'
        and relation.relname in ('document_scan_attestations','document_scan_jobs')
        and privilege.grantee=(select oid from pg_roles where rolname='service_role'))<>2
    or not has_table_privilege(
      'service_role','documents.document_scan_attestations','SELECT,INSERT')
    or has_table_privilege(
      'service_role','documents.document_scan_attestations','UPDATE,DELETE')
    or has_table_privilege(
      'service_role','documents.document_scan_jobs','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'documents_service_role_acl_cleanup_scanner_precondition_failed'
      using errcode='55000';
  end if;
end;
$$;

revoke all privileges on table
  documents.access_events,
  documents.document_audit_links,
  documents.document_links,
  documents.document_permissions,
  documents.document_versions,
  documents.documents,
  documents.folders,
  documents.legal_holds,
  documents.legal_records,
  documents.lifecycle_events,
  documents.retention_policies,
  documents.retention_records
from service_role;

do $$
begin
  if exists(
    select 1 from pg_class relation
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
  ) or exists(
    select 1 from pg_attribute attribute
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
  ) then
    raise exception 'documents_service_role_direct_acl_remains'
      using errcode='55000';
  end if;

  if exists(
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
    raise exception 'documents_service_role_effective_acl_remains'
      using errcode='55000';
  end if;

  if exists(
    select 1 from pg_policy policy
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
  ) then
    raise exception 'documents_service_role_policy_path_remains'
      using errcode='55000';
  end if;

  if (select count(*) from pg_proc function
      join pg_namespace namespace on namespace.oid=function.pronamespace
      where namespace.nspname='public'
        and function.proname in (
          'claim_document_scan_job_v1','complete_document_scan_job_v1',
          'fail_document_scan_job_v1','get_document_scan_queue_status_v1',
          'get_document_scan_target_v1','record_document_scan_v1')
        and function.prosecdef
        and has_function_privilege('service_role',function.oid,'EXECUTE'))<>6
    or (select count(*) from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      cross join lateral aclexplode(
        coalesce(relation.relacl,acldefault('r',relation.relowner))) privilege
      where namespace.nspname='documents'
        and relation.relname in ('document_scan_attestations','document_scan_jobs')
        and privilege.grantee=(select oid from pg_roles where rolname='service_role'))<>2 then
    raise exception 'documents_service_role_acl_cleanup_scanner_postcondition_failed'
      using errcode='55000';
  end if;
end;
$$;

commit;
