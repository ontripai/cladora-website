-- Read-only verification SOURCE. No synthetic row creation or role grants.
begin transaction read only;
set local lock_timeout='5s';
set local statement_timeout='30s';
with expected(signature) as(values
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
rollback;
