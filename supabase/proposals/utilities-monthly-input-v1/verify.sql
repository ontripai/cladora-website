-- Read-only verification SOURCE. No synthetic row creation or role grants.
begin transaction read only;
set local lock_timeout='5s';
set local statement_timeout='30s';
with expected(signature) as(values
 ('utilities.protect_invoice_review_provenance_v1()'),
 ('utilities.protect_invoice_approval_content_v2()'),
 ('utilities.invoice_content_image_v2(utilities.provider_invoices,utilities.supply_contracts,utilities.ingestion_documents,jsonb,uuid)'),
 ('utilities.monthly_input_actor_v1(uuid,uuid,bigint,text,uuid)'),
 ('utilities.produce_monthly_input_v1(uuid,uuid,bigint,jsonb)'),
 ('utilities.read_invoice_review_source_v1(uuid,uuid,bigint,uuid)'))
select e.signature,p.oid is not null as present,p.prosecdef=false as security_invoker,
 pg_get_userbyid(p.proowner) as observed_owner,p.proconfig,
 case when p.oid is null then null else not exists(
  select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>p.proowner
 ) end as owner_only_effective_direct_acl
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature);
-- Before activation Platform must also verify ownership, inherited/effective
-- privilege, RLS writer policy, sequence and trigger effects for the exact role.
-- This closed-ACL poststate grants no runtime consumption rights.
select t.tgname,t.tgenabled,t.tgrelid='utilities.review_decisions'::regclass as exact_relation,
 t.tgfoid='utilities.protect_invoice_review_provenance_v1()'::regprocedure as exact_function
 from pg_trigger t where t.tgrelid='utilities.review_decisions'::regclass and t.tgname='invoice_review_provenance_immutable_v1' and not t.tgisinternal;
select i.indisunique,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) as actual_definition,
 pg_get_expr(i.indpred,i.indrelid) as actual_predicate
 from pg_index i where i.indexrelid=to_regclass('utilities.invoice_review_origin_once_v1');
select t.tgname,t.tgenabled,t.tgrelid='utilities.provider_invoices'::regclass as exact_relation,
 t.tgfoid='utilities.protect_invoice_approval_content_v2()'::regprocedure as exact_function
 from pg_trigger t where t.tgrelid='utilities.provider_invoices'::regclass and t.tgname='invoice_input_approval_immutable_v2' and not t.tgisinternal;
rollback;
