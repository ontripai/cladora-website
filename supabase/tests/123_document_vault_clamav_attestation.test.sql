begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(15);

insert into platform.tenants(id,legal_name,registration_number,status) values
 ('12300000-0000-4000-8000-000000000001','Vault scanner test','VAULTSCAN123','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('12300000-0000-4000-8000-000000000002','12300000-0000-4000-8000-000000000001','condominium','Test','active');
insert into documents.documents(id,tenant_id,property_id,title,document_type,status) values
 ('12300000-0000-4000-8000-000000000003','12300000-0000-4000-8000-000000000001','12300000-0000-4000-8000-000000000002','Scanner fixture','test','active');
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,scanning_status) values
 ('12300000-0000-4000-8000-000000000004','12300000-0000-4000-8000-000000000001','12300000-0000-4000-8000-000000000003',1,'scan-test/clean',repeat('a',64),'application/pdf',5,'deferred'),
 ('12300000-0000-4000-8000-000000000005','12300000-0000-4000-8000-000000000001','12300000-0000-4000-8000-000000000003',2,'scan-test/malicious',repeat('b',64),'application/pdf',5,'deferred'),
 ('12300000-0000-4000-8000-000000000006','12300000-0000-4000-8000-000000000001','12300000-0000-4000-8000-000000000003',3,'scan-test/missing',repeat('c',64),'application/pdf',5,'deferred');
insert into storage.objects(bucket_id,name) values
 ('document-vault','scan-test/clean'),('document-vault','scan-test/malicious');

select ok(not has_function_privilege('anon','public.record_document_scan_v1(uuid,uuid,text,text,text,timestamptz)','EXECUTE'),'Anonymous cannot record verdict');
select ok(not has_function_privilege('authenticated','public.record_document_scan_v1(uuid,uuid,text,text,text,timestamptz)','EXECUTE'),'Member cannot record verdict');
select ok(not has_function_privilege('authenticated','public.get_document_scan_target_v1(uuid)','EXECUTE'),'Member cannot discover raw Storage path');
select throws_ok($$update documents.document_versions set scanning_status='clean' where id='12300000-0000-4000-8000-000000000004'$$,'55000','document_versions_are_immutable','No direct status transition');
select throws_ok($$select public.get_document_scan_target_v1('12300000-0000-4000-8000-000000000006')$$,'22000','document_scan_target_unavailable','Missing Storage object rejected');
select is(public.get_document_scan_target_v1('12300000-0000-4000-8000-000000000004')->>'sha256',repeat('a',64),'Worker sees expected immutable hash');
select throws_ok($$select public.record_document_scan_v1('12300000-0000-4000-8000-000000000004','12300000-0000-4000-8000-000000000007','clean',repeat('f',64),'ClamAV test',statement_timestamp())$$,'22023','document_scan_content_mismatch','Hash mismatch cannot mark clean');
select set_config('test.scan_time',(statement_timestamp()-interval '1 second')::text,true);
select is(public.record_document_scan_v1('12300000-0000-4000-8000-000000000004','12300000-0000-4000-8000-000000000007','clean',repeat('a',64),'ClamAV test',current_setting('test.scan_time')::timestamptz)->>'verdict','clean','Clean scan recorded');
select is((select scanning_status from documents.document_versions where id='12300000-0000-4000-8000-000000000004'),'clean','Verified status advanced without altering version content');
select ok((public.record_document_scan_v1('12300000-0000-4000-8000-000000000004','12300000-0000-4000-8000-000000000007','clean',repeat('a',64),'ClamAV test',current_setting('test.scan_time')::timestamptz)->>'replayed')::boolean,'Exact retry is idempotent');
select throws_ok($$select public.record_document_scan_v1('12300000-0000-4000-8000-000000000004','12300000-0000-4000-8000-000000000008','quarantined',repeat('a',64),'ClamAV test',current_setting('test.scan_time')::timestamptz)$$,'23505','document_scan_result_conflict','Cannot replace immutable clean attestation');
select is(public.record_document_scan_v1('12300000-0000-4000-8000-000000000005','12300000-0000-4000-8000-000000000009','quarantined',repeat('b',64),'ClamAV test',statement_timestamp())->>'verdict','quarantined','Malicious file quarantined');
select is((select scanning_status from documents.document_versions where id='12300000-0000-4000-8000-000000000005'),'quarantined','Malicious version cannot be attached as clean');
select throws_ok($$update documents.document_scan_attestations set verdict='clean' where version_id='12300000-0000-4000-8000-000000000005'$$,'55000','document_scan_attestation_is_immutable','Verdict evidence cannot be edited');
select throws_ok($$update documents.document_versions set sha256=repeat('d',64) where id='12300000-0000-4000-8000-000000000004'$$,'55000','document_versions_are_immutable','Hash remains immutable after scan');

select * from finish();
rollback;
