/** Closed source for the scoped operator; values are always bound parameters. */
export const SQL=Object.freeze({
 identity:`select pg_backend_pid() pid,current_user::text principal,current_database() database_name,
 (select oid::int from pg_database where datname=current_database()) database_oid,
 (select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') backend_id,
 current_setting('server_version_num')::int pg_version,r.rolsuper,r.rolbypassrls
 from pg_roles r where r.rolname=current_user`,
 observerPrivilege:`select c.oid::regclass::text relation,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege(current_user,c.oid,'SELECT') can_select from pg_class c
 where c.oid=any(ARRAY['service_catalog.requests'::regclass,'platform.idempotency_keys'::regclass,'audit.events'::regclass,'platform.outbox_events'::regclass])`,
 xidPrivilege:"select has_function_privilege(current_user,'pg_catalog.pg_xact_status(xid8)','EXECUTE') allowed",
 clock:`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') at`,
 waiters:`select pid,pg_blocking_pids(pid) blockers,wait_event_type from pg_stat_activity
 where pid=any($1::int[]) and cardinality(pg_blocking_pids(pid))>0`,
 rowBarrier:'select id from platform.provider_agreement_heads_v1 where id=$1::uuid for update',
 keyBarrier:'select pg_advisory_xact_lock(hashtextextended($1,0))',
 precommitFault:'select 1 / $1::integer as core17_precommit_fault',
 transactionStatus:'select pg_xact_status($1::xid8)::text state',
 receiptUpdate:'update platform.idempotency_keys set response_ref=$3::jsonb,status_code=200 where tenant_id=$1 and key=$2',
 scoped:`select
 (select count(*)::int from service_catalog.requests where tenant_id=$1 and workspace_id=$2) requests,
 (select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key=any($3::text[])) c03,
 (select count(*)::int from audit.events where tenant_id=$1 and after_snapshot->>'workspace_id'=$2::text and action like 'core.%') audit,
 (select count(*)::int from platform.outbox_events where tenant_id=$1 and payload->>'workspace_id'=$2::text and event_type like 'core.%') outbox`,
 receipt:'select actor_id,request_hash,response_ref,expires_at::text from platform.idempotency_keys where tenant_id=$1 and key=$2',
 request:'select id,tenant_id,workspace_id from service_catalog.requests where tenant_id=$1 and workspace_id=$2 and id=$3',
 audit:'select id from audit.events where tenant_id=$1 and id=$2 and request_id=$3 and entity_id=$4',
 outbox:'select id from platform.outbox_events where tenant_id=$1 and id=$2 and trace_id=$3 and aggregate_id=$4',
 context:'select id,membership_id,tenant_id,ends_at::text from identity.context_grants where id=$1 and membership_id=$2 and tenant_id=$3',
 member:'select id,status from identity.memberships where id=$1 and user_id=$2 and tenant_id=$3',
 epoch:'select revision::text from app_private.canonical_authority_revision_v1 where singleton',
 expire:`update identity.context_grants set ends_at=clock_timestamp()+interval '4 seconds'
 where id=$1 and membership_id=$2 and tenant_id=$3 and ends_at is null returning ends_at::text`,
 expired:'select clock_timestamp()>=ends_at expired from identity.context_grants where id=$1 and membership_id=$2 and tenant_id=$3',
 restoreExpiry:'update identity.context_grants set ends_at=null where id=$1 and membership_id=$2 and tenant_id=$3 and ends_at=$4::timestamptz returning id',
 revoke:"update identity.memberships set status='revoked' where id=$1 and user_id=$2 and tenant_id=$3 and status='active' returning id",
 restoreMember:"update identity.memberships set status='active' where id=$1 and user_id=$2 and tenant_id=$3 and status='revoked' returning id",
 append:`select app_private.write_core_provider_agreement_v1('append_version',$1,$2,$3,$4,1,
 (clock_timestamp() at time zone 'UTC')::date-1,null,ARRAY['service.request.create']) value`,
});
export const normalizeSQL=text=>text.trim().replace(/\s+/g,' ').toLowerCase();
