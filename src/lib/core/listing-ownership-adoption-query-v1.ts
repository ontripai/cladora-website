/** Closed metadata-only adoption query, not a runtime/native writer-census proof. */
export const CORE_LISTING_OWNERSHIP_ADOPTION_SQL_V1=`select (
 not exists(select 1 from (values
('customer_api.claim_unit_invitation_v1(uuid,text)','bffb832c8923e42276f12152dc623dc0f6dbcb291ca99199aac92d742bfa58cb'),
('customer_api.execute_verified_ownership_transfer_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,numeric,text)','5437a455c8cfa211ac27d51013ac84627b1e74dcd3df711ad606a2822a792235'),
('customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date)','2548431b9d3c32b824866f94710ae9ec8965403fd4963737a427870ef1826ea4'),
('app_private.onboarding_commit_residential_internal_v1(uuid,uuid)','c44286bde2a7c3a1e2166e7915ddfe1a945fa013e3f2a245451db09cd3b55e48'),
('app_private.onboarding_approve_import_commit_internal_v1(uuid,uuid)','bd38dc429d45aa7a8f8e63c28c06669433856587bed629aac714fb64fee16d34'),
('maintenance.register_contractor_v1(uuid,uuid,text,text)','797ee8c505e91c21f0c56c57eb7e4fa0388e435a8f278c9899538f7480ace0b6'),
('customer_api.register_service_self_person_v1(jsonb)','21714085b2d584d20258131555a9c66a255cfa921691b155bc53c8585e97966a'),
('customer_api.claim_unit_invitation_core_v1(uuid,text)','9a4449033c20761ab5c2db4e115218e5c6754afc9949ab1deaf4ffcc198209c0'),
('customer_api.record_core_unit_specification_v1(uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text)','6b66d8fe76c7dc6fa81e860de623a43e3fb79eb57a4efebd02f95ddcba1e87d2'),
('customer_api.record_core_unit_lineage_v1(uuid,uuid,uuid,text,uuid[],uuid[],text)','603f9f1f6215e8fcebb199c9f1d8ccbf5bf23165473e8649c6b164add6756e2f')
 ) e(signature,body_hash) join pg_proc p on p.oid=to_regprocedure(e.signature)
 where encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>e.body_hash or not p.prosecdef)
 and exists(select 1 from pg_attribute where attrelid='portfolio.ownerships'::regclass and attname='native_revision_v1' and atttypid='bigint'::regtype and not attisdropped)
 and exists(select 1 from pg_attribute where attrelid='portfolio.parties'::regclass and attname='native_revision_v1' and atttypid='bigint'::regtype and not attisdropped)
 and exists(select 1 from pg_proc where oid=to_regprocedure('app_private.core_listing_ownership_revision_v1()') and not prosecdef
  and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='9e8ca78101b96a01eb3f6eb1417533e40cf3ff8f45491896df78da60b1ed7394')
 and exists(select 1 from pg_proc where oid=to_regprocedure('app_private.bump_canonical_authority_revision_v1()') and prosecdef and encode(sha256(convert_to(prosrc,'UTF8')),'hex')='e81a9e847ba3ab6768a027b7f33689d8f136b3f81fc17e83f1a531ee4f6ad60f')
 and not exists(select 1 from(values
 ('portfolio.ownerships','aa_core_listing_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.parties','aa_core_listing_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('identity.membership_parties','aa_core_listing_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.properties','aa_core_listing_source_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.buildings','aa_core_listing_source_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.units','aa_core_listing_source_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.unit_specification_versions','aa_core_listing_source_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.unit_lineage_events','aa_core_listing_source_epoch_v1','app_private.bump_canonical_authority_revision_v1()'),
 ('portfolio.ownerships','zz_core_listing_ownership_revision_v1','app_private.core_listing_ownership_revision_v1()'),
 ('portfolio.parties','zz_core_listing_party_revision_v1','app_private.core_listing_ownership_revision_v1()')
 ) e(path,name,routine) where not exists(select 1 from pg_trigger t where t.tgrelid=to_regclass(e.path) and t.tgname=e.name
 and t.tgfoid=to_regprocedure(e.routine) and t.tgenabled='A' and not t.tgisinternal and t.tgqual is null and t.tgnargs=0 and t.tgtype=case when left(e.name,3)='aa_' then 62 else 23 end))
 ) as adopted`;
