-- Independent executable adoption UNIT20; not complete target-specific Guide installer.
-- Original review-only source is unchanged; no historical migration receipt.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-guide-no-document-install.v1',0));
DO $admission$
DECLARE marker text; p record; sig text;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
  OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
  OR current_setting('cladora.guide.target_oid',true) IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR current_setting('cladora.guide.plan_sha256',true) IS NULL
  OR current_setting('cladora.guide.plan_sha256',true)!~'^[a-f0-9]{64}$'
  OR current_user IS DISTINCT FROM current_setting('cladora.guide.installer',true)
  OR session_user<>current_user THEN RAISE EXCEPTION 'guide_install_private_target_plan_required' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT p FROM pg_roles WHERE rolname=current_user;
 IF p.rolsuper OR p.rolbypassrls OR current_user IN ('cladora_ce_guide_runtime','cladora_ce_guide_executor','anon','authenticated','service_role')
 THEN RAISE EXCEPTION 'guide_install_ordinary_installer_required' USING ERRCODE='55000'; END IF;
 FOR sig IN SELECT unnest(ARRAY['experience.guides','experience.guide_steps','experience.guide_references','platform.idempotency_keys','identity.context_grants','identity.memberships']) LOOP
  IF to_regclass(sig) IS NULL THEN RAISE EXCEPTION 'guide_install_preceding_unit_missing' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF to_regclass('experience.guide_save_receipts_v1') IS NOT NULL
  OR to_regprocedure('app_private.ce012_save_receipt_immutable_v1()') IS NOT NULL
  OR to_regprocedure('app_private.ce012_save_core_binding_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'guide_save_adoption_collision_stop' USING ERRCODE='55000'; END IF;
 FOR sig IN SELECT unnest(ARRAY['cladora_ce_guide_runtime','cladora_ce_guide_executor']) LOOP
  SELECT * INTO p FROM pg_roles WHERE rolname=sig;
  IF NOT FOUND OR p.rolsuper OR p.rolbypassrls OR p.rolcreatedb OR p.rolcreaterole OR p.rolreplication OR p.rolinherit
  THEN RAISE EXCEPTION 'guide_install_fixed_role_required' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_runtime' AND rolcanlogin)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_executor' AND NOT rolcanlogin)
  OR to_regprocedure('app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text)') IS NULL
 THEN RAISE EXCEPTION 'guide_install_role_scope_prerequisite' USING ERRCODE='55000'; END IF;
END $admission$;
-- BEGIN_CANONICAL_GUIDE_SAVE_BODY
create table experience.guide_save_receipts_v1 (
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  canonical_key text not null,
  command_hash text not null check (command_hash ~ '^[0-9a-f]{64}$'),
  command_json jsonb not null check (jsonb_typeof(command_json)='object'),
  guide_command jsonb not null check (jsonb_typeof(guide_command)='object'),
  ce_receipt jsonb not null check (jsonb_typeof(ce_receipt)='object'),
  mutation_id uuid not null unique,
  database_transaction_id text not null check (database_transaction_id ~ '^[1-9][0-9]*$'),
  primary key (tenant_id,canonical_key),
  foreign key (workspace_id,tenant_id) references platform.customer_workspaces(id,tenant_id) on delete restrict,
  check (canonical_key='core-tx.v1:'||workspace_id::text||':'||(command_json->>'idempotency_key')),
  check (command_json ?& array['contract_version','transaction_id','command_id','context_id','workspace_id','actor_id',
    'authority_version','permission_code','module_code','evaluation_purpose','aggregate_type','aggregate_id','aggregate_version',
    'provider_source_ids','idempotency_key','input_fingerprint','subject_reference']),
  check (guide_command ?& array['contract','version','command_id','action','context_id','workspace_id','guide_id',
    'expected_guide_version','payload','payload_fingerprint','idempotency_key']),
  check (ce_receipt ?& array['contract','version','receipt_id','command_id','action','context_id','workspace_id','guide_id',
    'previous_guide_version','resulting_guide_version','document_target','payload_fingerprint','idempotency_key',
    'idempotency_binding_id','core_decision_id','document_decision_id','authority','entitlement','evaluated_at']),
  check (command_json->>'contract_version'='core-transaction-command.v2'),
  check (guide_command->>'contract'='ce012-guide-command.v1'),
  check (ce_receipt->>'contract'='ce012-guide-command.v1'),
  check (guide_command->>'action'='save_draft' and ce_receipt->>'action'='save_draft')
);
-- Expression uniqueness is an index, not an SQL table-level expression constraint.
create unique index ce012_save_receipt_id_v1 on experience.guide_save_receipts_v1 ((ce_receipt->>'receipt_id'));

create function app_private.ce012_save_receipt_immutable_v1() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'ce012_save_receipt_immutable' using errcode='42501'; end $$;
create trigger ce012_save_receipt_immutable_v1 before update or delete on experience.guide_save_receipts_v1
for each row execute function app_private.ce012_save_receipt_immutable_v1();

-- Core produces its receipt ID AFTER provider.mutate. A deferred CHECK, not a
-- second commit/update/repair, verifies the two independently-issued receipts.
-- The immutable relation is read by tenant/key + exact command hash + mutation ID
-- against the canonical C03 response_ref. No equality of receipt IDs is required.
create function app_private.ce012_save_core_binding_v1() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
declare c jsonb:=new.command_json; g jsonb:=new.guide_command; r jsonb:=new.ce_receipt;
  p jsonb; ledger_actor uuid; ledger_hash text; s record; t jsonb;
begin
  if new.database_transaction_id is distinct from txid_current()::text
    or new.actor_id is distinct from auth.uid()
    or current_setting('transaction_isolation')<>'serializable' then
    raise exception 'ce012_save_transaction_binding' using errcode='23514';
  end if;
  select actor_id,request_hash,response_ref into ledger_actor,ledger_hash,p
    from platform.idempotency_keys where tenant_id=new.tenant_id and key=new.canonical_key for share;
  if not found or p is null
    or c->>'workspace_id' is distinct from new.workspace_id::text
    or c->>'actor_id' is distinct from new.actor_id::text
    or c->>'context_id' is distinct from g->>'context_id'
    or c->>'command_id' is distinct from g->>'command_id'
    or c->>'aggregate_id' is distinct from g->>'guide_id'
    or c->>'input_fingerprint' is distinct from g->>'payload_fingerprint'
    or c->>'idempotency_key' is distinct from g->>'idempotency_key'
    or c->>'aggregate_type' is distinct from 'experience_guide'
    or c->>'aggregate_version' is distinct from r->>'resulting_guide_version'
    or g->>'workspace_id' is distinct from new.workspace_id::text
    or p->'authority'->>'decision' is distinct from 'allowed'
    or p->'authority'->>'decision_id' is distinct from r->>'core_decision_id'
    or p->'authority'->>'authority_version' is distinct from c->>'authority_version'
    or r->>'authority' is distinct from 'verified' or r->>'entitlement' is distinct from 'verified' or ledger_actor is distinct from new.actor_id
    or ledger_hash is distinct from new.command_hash
    or p->>'contract_version' is distinct from 'core-transaction-receipt.v2'
    or p->>'receipt_version' is distinct from '2'
    or p->>'mutation_id' is distinct from new.mutation_id::text
    or p->>'workspace_id' is distinct from new.workspace_id::text
    or p->>'actor_id' is distinct from new.actor_id::text
    or p->>'transaction_id' is distinct from c->>'transaction_id'
    or p->>'command_id' is distinct from c->>'command_id'
    or p->>'aggregate_type' is distinct from 'experience_guide'
    or p->>'aggregate_id' is distinct from g->>'guide_id'
    or p->>'aggregate_version' is distinct from r->>'resulting_guide_version'
    or p->>'input_fingerprint' is distinct from g->>'payload_fingerprint'
    or p->>'idempotency_key' is distinct from g->>'idempotency_key'
    or p->'subject_reference' is distinct from c->'subject_reference'
    or p->'provider_evidence'->>'provider_code' is distinct from 'documents-ce012-reference-provider.v1'
    or p->'replay_validation'->>'provider_code' is distinct from 'documents-ce012-reference-provider.v1'
    or p->'authority'->>'context_id' is distinct from g->>'context_id'
    or p->'authority'->>'permission_code' is distinct from 'experience.guide.manage'
    or p->'authority'->>'module_code' is distinct from 'experience_guides'
    or p->'authority'->>'evaluation_purpose' is distinct from 'experience.guide.command'
    or r->>'command_id' is distinct from g->>'command_id'
    or r->>'workspace_id' is distinct from new.workspace_id::text
    or r->>'context_id' is distinct from g->>'context_id'
    or r->>'guide_id' is distinct from g->>'guide_id'
    or r->>'payload_fingerprint' is distinct from g->>'payload_fingerprint'
    or r->>'idempotency_key' is distinct from g->>'idempotency_key'
    or (r->>'previous_guide_version')::bigint is distinct from (g->>'expected_guide_version')::bigint
    or (r->>'resulting_guide_version')::bigint is distinct from (g->>'expected_guide_version')::bigint+1
    or (case when r->'document_target'='null'::jsonb then 'null'::jsonb else r->'document_target'-'label' end)
      is distinct from (case when g->'payload'->'document_target'='null'::jsonb then 'null'::jsonb else g->'payload'->'document_target'-'label' end) then
    raise exception 'ce012_save_core_receipt_binding' using errcode='23514';
  end if;
  if not exists (select 1 from identity.context_grants x join identity.memberships m
    on m.id=x.membership_id and m.tenant_id=x.tenant_id
    where x.id=(g->>'context_id')::uuid and x.membership_id=new.membership_id
      and x.tenant_id=new.tenant_id and m.user_id=new.actor_id) then
    raise exception 'ce012_save_membership_binding' using errcode='23514';
  end if;
  select * into s from experience.guide_steps where tenant_id=new.tenant_id
    and workspace_id=new.workspace_id and guide_id=(g->>'guide_id')::uuid
    and guide_version=(r->>'resulting_guide_version')::bigint and id=(g->'payload'->>'step_id')::uuid;
  if not found or s.title is distinct from g->'payload'->>'step_title'
    or s.body is distinct from g->'payload'->>'instructions'
    or not exists(select 1 from experience.guides d where d.tenant_id=new.tenant_id
      and d.workspace_id=new.workspace_id and d.id=(g->>'guide_id')::uuid
      and d.version=(r->>'resulting_guide_version')::bigint and d.content_version=d.version
      and d.status='draft' and d.title=g->'payload'->>'title') then
    raise exception 'ce012_save_content_binding' using errcode='23514';
  end if;
  t:=r->'document_target';
  if t<>'null'::jsonb and not exists(select 1 from experience.guide_references v
    where v.tenant_id=new.tenant_id and v.workspace_id=new.workspace_id and v.guide_id=(g->>'guide_id')::uuid
      and v.guide_version=(r->>'resulting_guide_version')::bigint and v.step_id=s.id
      and v.target_id=(t->>'document_id')::uuid and v.document_version_id=(t->>'document_version_id')::uuid
      and v.document_version=(t->>'document_version')::bigint and v.safe_label=t->>'label') then
    raise exception 'ce012_save_target_binding' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger ce012_save_core_binding_v1 after insert on experience.guide_save_receipts_v1
  deferrable initially deferred for each row execute function app_private.ce012_save_core_binding_v1();
alter table experience.guide_save_receipts_v1 enable row level security;
alter table experience.guide_save_receipts_v1 force row level security;
revoke all on experience.guide_save_receipts_v1 from public,anon,authenticated,service_role;
revoke all on function app_private.ce012_save_receipt_immutable_v1(),app_private.ce012_save_core_binding_v1()
  from public,anon,authenticated,service_role;

-- END_CANONICAL_GUIDE_SAVE_BODY (exact proposal body retained above)
-- Explicit document-free adoption; this unit never enables document references.
ALTER TABLE experience.guide_save_receipts_v1 ADD CONSTRAINT ce012_save_document_free_v1
 CHECK ((guide_command->'payload'->'document_target') IS NOT DISTINCT FROM 'null'::jsonb
  AND (ce_receipt->'document_target') IS NOT DISTINCT FROM 'null'::jsonb);
CREATE POLICY core_guide_save_read_v1 ON experience.guide_save_receipts_v1
 FOR SELECT TO cladora_ce_guide_executor USING (
 actor_id=auth.uid() AND command_json->>'context_id'=current_setting('request.cladora.context_id',true)
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_save_insert_v1 ON experience.guide_save_receipts_v1
 FOR INSERT TO cladora_ce_guide_executor WITH CHECK (
 actor_id=auth.uid() AND command_json->>'context_id'=current_setting('request.cladora.context_id',true)
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')
 AND EXISTS(SELECT 1 FROM identity.context_grants g JOIN identity.memberships m ON m.id=g.membership_id AND m.tenant_id=g.tenant_id
  WHERE g.id=(command_json->>'context_id')::uuid AND g.tenant_id=guide_save_receipts_v1.tenant_id
   AND g.membership_id=guide_save_receipts_v1.membership_id AND m.user_id=guide_save_receipts_v1.actor_id));
-- SELECT FOR SHARE needs UPDATE privilege; immutable trigger and WITH CHECK(false)
-- forbid changing the historical relation. No UPDATE of receipt/payload granted.
CREATE POLICY core_guide_save_lock_v1 ON experience.guide_save_receipts_v1
 FOR UPDATE TO cladora_ce_guide_executor USING (
 actor_id=auth.uid() AND command_json->>'context_id'=current_setting('request.cladora.context_id',true)
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')) WITH CHECK(false);
REVOKE ALL ON experience.guide_save_receipts_v1 FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;
GRANT SELECT,INSERT ON experience.guide_save_receipts_v1 TO cladora_ce_guide_executor;
GRANT UPDATE(canonical_key) ON experience.guide_save_receipts_v1 TO cladora_ce_guide_executor;
COMMENT ON TABLE experience.guide_save_receipts_v1 IS 'core-guide-save-adoption.v1; source-sha256:b5edb0d313d28d9cea3e6e188ad98f97002f93de914bf18f8ba9dcb2e0d12909; document-free; not a C03 receipt';
DO $post$
DECLARE obj record;
BEGIN
 SELECT * INTO STRICT obj FROM pg_class WHERE oid='experience.guide_save_receipts_v1'::regclass;
 IF NOT obj.relrowsecurity OR NOT obj.relforcerowsecurity OR obj.relowner IN
   (SELECT oid FROM pg_roles WHERE rolname IN ('cladora_ce_guide_runtime','cladora_ce_guide_executor'))
 THEN RAISE EXCEPTION 'guide_save_adoption_rls_owner_invalid' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=obj.oid AND tgname='ce012_save_core_binding_v1' AND tgdeferrable AND tginitdeferred AND tgenabled='O')
 THEN RAISE EXCEPTION 'guide_save_adoption_deferred_binding_missing' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(obj.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
  WHERE a.grantee<>obj.relowner AND (r.rolname IS DISTINCT FROM 'cladora_ce_guide_executor' OR a.privilege_type NOT IN ('SELECT','INSERT') OR a.is_grantable))
 THEN RAISE EXCEPTION 'guide_save_adoption_unexpected_acl' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
  WHERE c.attrelid=obj.oid AND a.grantee<>obj.relowner AND
   (r.rolname IS DISTINCT FROM 'cladora_ce_guide_executor' OR c.attname<>'canonical_key' OR a.privilege_type<>'UPDATE' OR a.is_grantable))
 THEN RAISE EXCEPTION 'guide_save_adoption_unexpected_column_acl' USING ERRCODE='55000'; END IF;
END $post$;
COMMIT;
