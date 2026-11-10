-- Read-only request SOURCE. Not executed. Run only in a separately admitted lane.
begin transaction read only;
set local lock_timeout='5s';
set local statement_timeout='30s';
select current_user as observed_principal,session_user as observed_login,current_database() as database_name,
 current_setting('server_version_num')::integer between 170000 and 179999 as pg17;
select signature,to_regprocedure(signature) is not null as present from unnest(array[
 'app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)',
 'app_private.require_request_session_current_at_v1(timestamp with time zone)',
 'app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)',
 'app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamp with time zone)',
 'app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamp with time zone)',
 'utilities.approve_reading(uuid,uuid,text)',
 'utilities.protect_approved_invoice()',
 'utilities.enforce_utility_invoice_scope()'
]) signature;
select name,to_regclass(name) is not null as present from unnest(array[
 'utilities.provider_invoices','utilities.provider_invoice_lines','utilities.supply_contracts',
 'utilities.ingestion_sources','utilities.ingestion_documents','utilities.review_tasks','utilities.review_decisions',
 'utilities.meters','utilities.meter_readings','platform.idempotency_keys','audit.events','platform.outbox_events'
]) name;
-- Presence is not a positive policy/role/module binding or an installation permit.
select code from identity.permissions where code in('utilities.invoices.ingest','utilities.invoices.review','utilities.readings.approve') order by code;
select n.nspname,c.relname,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='utilities'
 and c.relname in('provider_invoices','provider_invoice_lines','ingestion_documents','review_tasks','review_decisions','meter_readings') order by c.relname;
rollback;
