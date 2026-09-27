begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(17);

insert into platform.tenants(id,legal_name,registration_number,status) values
 ('12400000-0000-4000-8000-000000000001','Vault queue test','VAULTQUEUE124','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('12400000-0000-4000-8000-000000000002','12400000-0000-4000-8000-000000000001','condominium','Test','active');
insert into documents.documents(id,tenant_id,property_id,title,document_type,status) values
 ('12400000-0000-4000-8000-000000000003','12400000-0000-4000-8000-000000000001','12400000-0000-4000-8000-000000000002','Scanner queue fixture','test','active');
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,scanning_status) values
 ('12400000-0000-4000-8000-000000000004','12400000-0000-4000-8000-000000000001','12400000-0000-4000-8000-000000000003',1,'scan-queue/clean',repeat('a',64),'application/pdf',5,'deferred');
select is((select state from documents.document_scan_jobs where version_id='12400000-0000-4000-8000-000000000004'),'pending','New deferred version auto-enqueued');
select ok(not has_table_privilege('authenticated','documents.document_scan_jobs','SELECT'),'Members cannot see queue rows');
select ok(not has_function_privilege('authenticated','public.claim_document_scan_job_v1(text,integer)','EXECUTE'),'Members cannot claim jobs');
select ok(has_function_privilege('service_role','public.claim_document_scan_job_v1(text,integer)','EXECUTE'),'Service role may claim');
select is(public.claim_document_scan_job_v1('worker-124',900),null::jsonb,'Cannot claim before Storage object exists');
insert into storage.objects(bucket_id,name) values('document-vault','scan-queue/clean');
select set_config('test.queue_lease',public.claim_document_scan_job_v1('worker-124',900)::text,true);
select is((current_setting('test.queue_lease')::jsonb->>'version_id')::uuid,'12400000-0000-4000-8000-000000000004'::uuid,'Worker claims correct version');
select is((select attempt_count from documents.document_scan_jobs where version_id='12400000-0000-4000-8000-000000000004'),1,'First lease counts an attempt');
select is(public.claim_document_scan_job_v1('another-worker',900),null::jsonb,'Concurrent worker cannot claim unexpired lease');
select throws_ok($$select public.fail_document_scan_job_v1((current_setting('test.queue_lease')::jsonb->>'job_id')::uuid,gen_random_uuid(),'SCAN_FAILED',60)$$,'42501','document_scan_job_lease_invalid','Wrong token cannot fail lease');
select is(public.fail_document_scan_job_v1((current_setting('test.queue_lease')::jsonb->>'job_id')::uuid,(current_setting('test.queue_lease')::jsonb->>'lease_token')::uuid,'SIGNATURE_UPDATE_FAILED',60)->>'state','retry','Scanner error schedules retry');
select is((select scanning_status from documents.document_versions where id='12400000-0000-4000-8000-000000000004'),'deferred','Scanner error does not mark clean');
update documents.document_scan_jobs set next_attempt_at=statement_timestamp()-interval '1 second'
 where version_id='12400000-0000-4000-8000-000000000004';
select set_config('test.queue_lease',public.claim_document_scan_job_v1('worker-124',900)::text,true);
select is((current_setting('test.queue_lease')::jsonb->>'attempt_count')::int,2,'Retry can be reclaimed');
select is(public.complete_document_scan_job_v1((current_setting('test.queue_lease')::jsonb->>'job_id')::uuid,
 (current_setting('test.queue_lease')::jsonb->>'lease_token')::uuid,'12400000-0000-4000-8000-000000000005',
 'clean',repeat('a',64),'ClamAV test',statement_timestamp())->>'verdict','clean','Lease-bound clean result recorded');
select is((select state from documents.document_scan_jobs where version_id='12400000-0000-4000-8000-000000000004'),'completed','Verified version transition atomically completes job');
select is((select scanning_status from documents.document_versions where id='12400000-0000-4000-8000-000000000004'),'clean','Only attested version becomes clean');
select is(public.get_document_scan_queue_status_v1()->>'dead_letter','0','Queue status includes dead-letter count');
select throws_ok($$select public.complete_document_scan_job_v1((current_setting('test.queue_lease')::jsonb->>'job_id')::uuid,(current_setting('test.queue_lease')::jsonb->>'lease_token')::uuid,'12400000-0000-4000-8000-000000000006','clean',repeat('a',64),'ClamAV test',statement_timestamp())$$,'42501','document_scan_job_lease_invalid','Completed job cannot be re-used');

select * from finish();
rollback;
