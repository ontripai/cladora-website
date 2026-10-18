begin;
select plan(28);

select is((select count(*)::integer from pg_roles where rolname in (
  'cladora_service_subject_link_runtime','cladora_service_subject_link_executor',
  'cladora_service_subject_link_owner')),3,'S3 installs exactly three fixed SERVICE roles');

select ok((select rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
  and not rolcreatedb and not rolcreaterole and not rolreplication
  from pg_roles where rolname='cladora_service_subject_link_runtime'),
  'runtime is the sole restricted LOGIN role');

select is((select count(*)::integer from pg_roles
  where rolname in ('cladora_service_subject_link_executor','cladora_service_subject_link_owner')
    and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
    and not rolcreatedb and not rolcreaterole and not rolreplication),2,
  'executor and package owner are restricted NOLOGIN roles');

select ok(exists(select 1 from pg_auth_members m
  join pg_roles granted on granted.oid=m.roleid
  join pg_roles member on member.oid=m.member
  where granted.rolname='cladora_service_subject_link_executor'
    and member.rolname='cladora_service_subject_link_runtime'
    and not m.admin_option and not m.inherit_option and m.set_option),
  'the intended runtime-to-executor edge is SET-only');

select is((select count(*)::integer from pg_database d join pg_roles r on r.oid=d.datdba
  where r.rolname in ('cladora_service_subject_link_runtime',
    'cladora_service_subject_link_executor','cladora_service_subject_link_owner')),0,
  'SERVICE roles own no database');

select is((select count(*)::integer from pg_namespace n join pg_roles r on r.oid=n.nspowner
  where r.rolname in ('cladora_service_subject_link_runtime',
    'cladora_service_subject_link_executor','cladora_service_subject_link_owner')),0,
  'SERVICE roles own no schema');

select is((select count(*)::integer from pg_class c join pg_roles r on r.oid=c.relowner
  where r.rolname in ('cladora_service_subject_link_runtime',
    'cladora_service_subject_link_executor','cladora_service_subject_link_owner')
    and c.relkind in ('r','p','S','v','m','f')),0,
  'SERVICE roles own no relation or sequence');

select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where pg_get_userbyid(p.proowner)='cladora_service_subject_link_owner'
    and ((n.nspname='communications' and p.proname in (
      'resolve_private_message_currentness_v2',
      'resolve_private_message_request_audience_current_v2'))
      or (n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'))
    and p.prosecdef and p.proconfig=array['search_path=pg_catalog']),3,
  'the three S1/S2 entrypoints have the fixed function-only owner');

select ok(has_function_privilege('cladora_service_subject_link_executor',
  'app_private.execute_service_request_message_link_v2(text,uuid,uuid,uuid,uuid,bigint,uuid,bigint)',
  'EXECUTE'),'executor can invoke only the canonical S2 domain entrypoint');

select ok(has_function_privilege('cladora_service_subject_link_executor','auth.uid()','EXECUTE'),
  'executor receives the minimal auth.uid boundary required by Core');

select ok(not has_function_privilege('cladora_service_subject_link_executor','auth.jwt()','EXECUTE'),
  'executor cannot invoke auth.jwt');

select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where ((n.nspname='communications' and p.proname in (
      'resolve_private_message_subject_v1','resolve_private_message_request_audience_v1'))
    or (n.nspname='app_private' and p.proname='insert_service_request_message_link_v1'))
    and has_function_privilege('cladora_service_subject_link_executor',p.oid,'EXECUTE')),0,
  'executor cannot invoke any forbidden V1 entrypoint');

select has_function('app_private','acquire_service_subject_link_role_safety_mutation_lock_v1',
  array[]::text[],'S3 installs the exclusive catalog mutation lock');
select has_function('app_private','core_platform_service_subject_link_role_safety_valid_v1',
  array[]::text[],'S3 installs the fixed catalog assertion');
select has_function('app_private','assert_service_subject_link_role_safety_v1',
  array[]::text[],'S3 installs the checkout assertion');
select has_function('app_private','acquire_service_subject_link_role_safety_lease_v1',
  array[]::text[],'S3 installs the transaction-scoped shared lease');

select ok((select not p.prosecdef and p.provolatile='v'
  and p.proconfig=array['search_path=pg_catalog']
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private'
    and p.proname='finalize_service_subject_link_role_membership_v1'),
  'STEP-SU-02 finalizer is volatile SECURITY INVOKER with fixed search_path');

select ok(has_function_privilege('supabase_admin',
  'app_private.finalize_service_subject_link_role_membership_v1()','EXECUTE'),
  'only the separately authorized Supabase administrator receives finalizer EXECUTE');

select is((select count(*)::integer from unnest(array[
  'public','anon','authenticated','service_role',
  'cladora_service_subject_link_runtime','cladora_service_subject_link_executor',
  'cladora_ce_guide_runtime','cladora_ce_guide_executor','cladora_rpc_owner'
]) denied(role_name) where has_function_privilege(denied.role_name,
  'app_private.finalize_service_subject_link_role_membership_v1()','EXECUTE')),0,
  'no runtime, executor, CE or public role can execute STEP-SU-02');

select is((select count(*)::integer from pg_policies
  where policyname like 'core_platform_service_subject_link_%'
    or policyname like 'service_subject_link_owner_%'),47,
  'S3 installs the complete owner and executor RLS package');

select ok((select strpos(pg_get_functiondef(p.oid),
    'core-platform-role-bound-pool.v1')>0
  and strpos(pg_get_functiondef(p.oid),'core-platform-role-bound-pool.v1')
    < strpos(pg_get_functiondef(p.oid),
      'core-platform-service-subject-link-role-bound-pool.v1')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private'
    and p.proname='acquire_service_subject_link_role_safety_lease_v1'),
  'SERVICE lease acquires the global shared lock before the package lock');

select ok((select pg_get_expr(p.polqual,p.polrelid) like '%is_active%'
    and pg_get_expr(p.polqual,p.polrelid) like '%lifecycle_status%'
    and pg_get_expr(p.polqual,p.polrelid) like '%valid_from%'
    and pg_get_expr(p.polqual,p.polrelid) like '%valid_to%'
  from pg_policy p where p.polname='core_platform_service_subject_link_module_read_v1'),
  'module metadata RLS requires active lifecycle and a current validity window');

select is((select md5(string_agg(concat_ws('|',n.nspname,c.relname,p.polname,
    p.polcmd,p.polpermissive::text,(select array_agg(r.rolname order by r.rolname)::text
      from unnest(p.polroles) role_oid join pg_roles r on r.oid=role_oid),
    coalesce(pg_get_expr(p.polqual,p.polrelid),''),
    coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')),chr(10)
    order by n.nspname,c.relname,p.polname))
  from pg_policy p join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where p.polname like 'core_platform_service_subject_link_%'
    or p.polname like 'service_subject_link_owner_%'),
  'd213e945cd67e42ac72dc9d4cbdda6e2',
  'the complete S3 RLS package has the exact approved catalog fingerprint');

select is((select count(*)::integer from pg_proc p
  where p.proowner=(select oid from pg_roles
    where rolname='cladora_service_subject_link_owner')),12,
  'package owner owns exactly the twelve approved S1/S2/S3 functions');

select is((select count(*)::integer from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
  where privilege.grantee=(select oid from pg_roles
      where rolname='cladora_service_subject_link_executor')
    and privilege.privilege_type='EXECUTE'),11,
  'executor has exactly eleven direct function capabilities including RLS predicates');

select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relrowsecurity and (n.nspname,c.relname) in (
    ('communications','private_conversations'),('communications','private_messages'),
    ('communications','private_participants'),('platform','customer_workspaces'),
    ('platform','workspace_entitlements'),('service_catalog','requests'),
    ('service_catalog','request_subject_links'),('identity','context_grants'),
    ('identity','memberships'),('platform','module_definitions'),
    ('identity','membership_parties'),('service_catalog','offerings'),
    ('portfolio','parties'),('portfolio','units'),('portfolio','buildings'),
    ('maintenance','vendor_portal_memberships'),('maintenance','vendors'),
    ('platform','workspace_property_bindings'),
    ('app_private','canonical_authority_revision_v1'),('platform','idempotency_keys'),
    ('audit','events'),('platform','outbox_events'))),22,
  'RLS remains enabled on every SERVICE-protected relation');

select is((select count(*)::integer from pg_policy p join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where (0=any(p.polroles)
      or (select oid from pg_roles where rolname='cladora_service_subject_link_executor')=any(p.polroles)
      or (select oid from pg_roles where rolname='cladora_service_subject_link_runtime')=any(p.polroles)
      or (select oid from pg_roles where rolname='cladora_service_subject_link_owner')=any(p.polroles))
    and (n.nspname,c.relname) in (
      ('communications','private_conversations'),('communications','private_messages'),
      ('communications','private_participants'),('platform','customer_workspaces'),
      ('platform','workspace_entitlements'),('service_catalog','requests'),
      ('service_catalog','request_subject_links'),('identity','context_grants'),
      ('identity','memberships'),('platform','module_definitions'),
      ('identity','membership_parties'),('service_catalog','offerings'),
      ('portfolio','parties'),('portfolio','units'),('portfolio','buildings'),
      ('maintenance','vendor_portal_memberships'),('maintenance','vendors'),
      ('platform','workspace_property_bindings'),
      ('app_private','canonical_authority_revision_v1'),('platform','idempotency_keys'),
      ('audit','events'),('platform','outbox_events'))
    and p.polname not like 'core_platform_service_subject_link_%'
    and p.polname not like 'service_subject_link_owner_%'),0,
  'no differently named policy can widen either SERVICE role');

select is((with roles as (select oid,rolname from pg_roles where rolname in
    ('cladora_service_subject_link_runtime','cladora_service_subject_link_executor',
      'cladora_service_subject_link_owner')),
  lines(value) as (
    select concat_ws('|',r.rolname,'schema',n.nspname,privilege.privilege_type)
    from pg_namespace n cross join roles r
    cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) privilege
    where privilege.grantee=r.oid
    union all
    select concat_ws('|',r.rolname,'relation',n.nspname||'.'||c.relname,privilege.privilege_type)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join roles r
    cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S'
      then 'S'::"char" else 'r'::"char" end,c.relowner))) privilege
    where privilege.grantee=r.oid
    union all
    select concat_ws('|',r.rolname,'column',n.nspname||'.'||c.relname||'.'||a.attname,
      privilege.privilege_type) from pg_attribute a join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace cross join roles r
    cross join lateral aclexplode(a.attacl) privilege
    where a.attnum>0 and not a.attisdropped and privilege.grantee=r.oid
    union all
    select concat_ws('|',r.rolname,'function',n.nspname||'.'||p.proname||'('||
      p.proargtypes::text||')',privilege.privilege_type)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join roles r
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
    where privilege.grantee=r.oid)
  select md5(string_agg(value,chr(10) order by value)) from lines),
  'f0f91a9eb48b953ee558032b34aa5c42',
  'runtime has zero direct ACL while owner and executor match the exact 160-entry fingerprint');

select * from finish();
rollback;
