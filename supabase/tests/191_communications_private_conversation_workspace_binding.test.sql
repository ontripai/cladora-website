begin;
select plan(12);

select ok(exists(
  select 1 from information_schema.columns
  where table_schema='communications' and table_name='private_conversations'
    and column_name='workspace_id' and data_type='uuid' and is_nullable='YES'
    and column_default is null
), 'D5 adds a nullable Workspace column without a default');

select ok(exists(
  select 1 from pg_constraint
  where conrelid='communications.private_conversations'::regclass
    and conname='private_conversations_workspace_tenant_v1'
    and contype='f'
    and confrelid='platform.customer_workspaces'::regclass
    and confdeltype='r'
), 'D5 installs the composite Workspace/tenant RESTRICT foreign key');

select ok(exists(
  select 1 from pg_index i
  join pg_class c on c.oid=i.indexrelid
  where i.indrelid='communications.private_conversations'::regclass
    and c.relname='private_conversations_workspace_tenant_v1_idx'
    and pg_get_expr(i.indpred,i.indrelid)='(workspace_id IS NOT NULL)'
), 'D5 installs the partial Workspace/tenant lookup index');

select ok(exists(
  select 1 from pg_trigger
  where tgrelid='communications.private_conversations'::regclass
    and tgname='private_conversation_workspace_binding_v1'
    and tgenabled='O' and not tgisinternal
), 'D5 creation and immutability guard is enabled');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname='guard_private_conversation_workspace_binding_v1'
    and pg_get_userbyid(p.proowner)='postgres'
    and not p.prosecdef
    and p.proconfig=array['search_path=pg_catalog']
), 'D5 guard is postgres-owned SECURITY INVOKER with fixed search_path');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array[
    'anon','authenticated','service_role','cladora_rpc_owner',
    'cladora_ce_guide_runtime','cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname='communications'
    and p.proname='guard_private_conversation_workspace_binding_v1'
    and has_function_privilege(denied.role_name,p.oid,'EXECUTE')
), 0, 'runtime roles have no direct D5 guard EXECUTE');

select ok((
  select pg_get_functiondef(p.oid) like '%private_conversation_workspace_binding_required%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname='guard_private_conversation_workspace_binding_v1'
), 'fresh NULL Workspace inserts fail closed');

select ok((
  select pg_get_functiondef(p.oid) like '%trusted_private_conversation_writer_required%'
    and pg_get_functiondef(p.oid) like '%communications.private_conversation_workspace_writer_v1%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname='guard_private_conversation_workspace_binding_v1'
), 'fresh inserts require the exact transaction-local writer marker');

select ok((
  select lower(pg_get_functiondef(p.oid)) like '%private_conversation_workspace_not_current%'
    and lower(pg_get_functiondef(p.oid)) like '%w.archived_at is null%'
    and lower(pg_get_functiondef(p.oid)) like '%w.lifecycle_status = ''active''%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname='guard_private_conversation_workspace_binding_v1'
), 'fresh inserts require the exact current Workspace and tenant');

select ok((
  select lower(pg_get_functiondef(p.oid)) like '%private_conversation_workspace_binding_is_immutable%'
    and lower(pg_get_functiondef(p.oid)) like '%new.workspace_id is distinct from old.workspace_id%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname='guard_private_conversation_workspace_binding_v1'
), 'historical NULL and canonical Workspace bindings are immutable');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname in ('resolve_private_message_subject_v1',
      'resolve_private_message_request_audience_v1')
), 2, 'D5 preserves the two existing V1 resolvers');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname in ('resolve_private_message_currentness_v2',
      'resolve_private_message_request_audience_current_v2')
), 2, 'full migration replay leaves both V2 resolvers owned by the later S1 package');

select * from finish();
rollback;
