begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(34);

select has_function(
  'documents',
  'get_customer_documents',
  array['uuid','text','text','text','text','date','date','integer','integer','uuid'],
  'canonical customer Documents reader retains its existing signature'
);
select ok(
  exists(select 1 from information_schema.columns
    where table_schema='portfolio' and table_name='units' and column_name='code'),
  'portfolio.units exposes the canonical code column'
);
select ok(
  not exists(select 1 from information_schema.columns
    where table_schema='portfolio' and table_name='units' and column_name='unit_code'),
  'portfolio.units has no legacy unit_code column'
);
select ok((select p.prosecdef from pg_proc p
  where p.oid='documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure),
  'reader remains SECURITY DEFINER');
select ok((select p.provolatile='s' from pg_proc p
  where p.oid='documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure),
  'reader remains read-only STABLE');
select ok(position(
  'when''portfolio.unit''then(selectu.codefromportfolio.unitsuwhereu.id=l.entity_id)'
  in regexp_replace(lower(pg_get_functiondef(
    'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
  )), '\s+', '', 'g')) > 0,
  'portfolio.unit labels resolve through canonical portfolio.units.code');
select ok(position('u.unit_code' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) = 0, 'broken unit_code reference is absent');
select ok(position('all_links l join allowed d on d.id=l.document_id' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) > 0, 'link rows remain joined to the authorized document scope');
select ok(position('d.tenant_id=x.tenant_id' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) > 0, 'authorized document scope remains tenant-bound');
select ok(position('documents.customer_document_scope_matches' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) > 0, 'property/building/unit context scope remains enforced');
select ok(position('documents.vault.read' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) > 0, 'current Documents read permission remains required');
select ok(position('d.deleted_at is null' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) > 0, 'deleted documents remain excluded');
select ok(position('v.scanning_status' in lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
))) > 0, 'scanner verdict remains in the authorized document projection');
select ok(position($needle$'storage_access',false$needle$ in regexp_replace(lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
)), '\s+', '', 'g')) > 0 and position($needle$'signed_urls',false$needle$ in regexp_replace(lower(pg_get_functiondef(
  'documents.get_customer_documents(uuid,text,text,text,text,date,date,integer,integer,uuid)'::regprocedure
)), '\s+', '', 'g')) > 0, 'reader still grants no Storage access or signed URL');

insert into auth.users(id,email) values
  ('21300000-0000-4000-8000-000000000001','documents-unit-link-allowed@cladora.test'),
  ('21300000-0000-4000-8000-000000000002','documents-unit-link-other@cladora.test'),
  ('21300000-0000-4000-8000-000000000003','documents-unit-link-revoked@cladora.test');

insert into platform.tenants(id,legal_name,registration_number,status) values
  ('21300000-0000-4000-8000-000000000010','Documents Unit Link Tenant','DOC-UNIT-213-A','active'),
  ('21300000-0000-4000-8000-000000000011','Documents Unit Link Other Tenant','DOC-UNIT-213-B','active');

insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
  ('21300000-0000-4000-8000-000000000020','21300000-0000-4000-8000-000000000010',
    'ASSOCIATION','Documents Unit Link A','ACTIVE'),
  ('21300000-0000-4000-8000-000000000021','21300000-0000-4000-8000-000000000011',
    'ASSOCIATION','Documents Unit Link B','ACTIVE');
insert into platform.workspace_entitlements(
  customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
) values
  ('21300000-0000-4000-8000-000000000020','module.documents','boolean',true,
    statement_timestamp()-interval '1 day'),
  ('21300000-0000-4000-8000-000000000021','module.documents','boolean',true,
    statement_timestamp()-interval '1 day');

insert into identity.roles(id,tenant_id,code,name,is_system) values
  ('21300000-0000-4000-8000-000000000030','21300000-0000-4000-8000-000000000010',
    'property_manager','Documents Unit Link Property Manager',false);
insert into identity.role_permissions(role_id,permission_id,effect)
select '21300000-0000-4000-8000-000000000030',p.id,'allow'
from identity.permissions p where p.code='documents.vault.read';
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at) values
  ('21300000-0000-4000-8000-000000000031','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000001','21300000-0000-4000-8000-000000000030',
    'active',statement_timestamp()-interval '2 days'),
  ('21300000-0000-4000-8000-000000000032','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000002','21300000-0000-4000-8000-000000000030',
    'active',statement_timestamp()-interval '2 days'),
  ('21300000-0000-4000-8000-000000000033','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000003','21300000-0000-4000-8000-000000000030',
    'revoked',statement_timestamp()-interval '2 days');

insert into portfolio.properties(id,tenant_id,type,name,status) values
  ('21300000-0000-4000-8000-000000000040','21300000-0000-4000-8000-000000000010',
    'condominium','Authorized Property','active'),
  ('21300000-0000-4000-8000-000000000041','21300000-0000-4000-8000-000000000010',
    'condominium','Same Tenant Hidden Property','active'),
  ('21300000-0000-4000-8000-000000000042','21300000-0000-4000-8000-000000000011',
    'condominium','Other Tenant Property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
  ('21300000-0000-4000-8000-000000000050','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000040','A','Authorized Building'),
  ('21300000-0000-4000-8000-000000000051','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000041','B','Hidden Building'),
  ('21300000-0000-4000-8000-000000000052','21300000-0000-4000-8000-000000000011',
    '21300000-0000-4000-8000-000000000042','C','Other Tenant Building');
insert into portfolio.units(id,tenant_id,building_id,code) values
  ('21300000-0000-4000-8000-000000000060','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000050','CANON-UNIT-01'),
  ('21300000-0000-4000-8000-000000000061','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000051','HIDDEN-UNIT-01'),
  ('21300000-0000-4000-8000-000000000062','21300000-0000-4000-8000-000000000011',
    '21300000-0000-4000-8000-000000000052','CANON-UNIT-01');

insert into identity.context_grants(
  id,tenant_id,membership_id,scope_type,property_id,starts_at,ends_at
) values
  ('21300000-0000-4000-8000-000000000070','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000031','property',
    '21300000-0000-4000-8000-000000000040',statement_timestamp()-interval '1 day',null),
  ('21300000-0000-4000-8000-000000000071','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000031','property',
    '21300000-0000-4000-8000-000000000040',statement_timestamp()-interval '2 days',
    statement_timestamp()-interval '1 day'),
  ('21300000-0000-4000-8000-000000000072','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000032','property',
    '21300000-0000-4000-8000-000000000040',statement_timestamp()-interval '1 day',null),
  ('21300000-0000-4000-8000-000000000073','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000033','property',
    '21300000-0000-4000-8000-000000000040',statement_timestamp()-interval '1 day',null);

-- Reader fixtures bypass only the canonical creation trigger. All rows carry
-- explicit Workspace bindings and are rolled back with this test.
alter table documents.documents disable trigger document_workspace_creation_guard_v1;
insert into documents.documents(
  id,tenant_id,workspace_id,property_id,title,document_type,classification,current_version,created_by,deleted_at
) values
  ('21300000-0000-4000-8000-000000000080','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000020','21300000-0000-4000-8000-000000000040',
    'Authorized Unit Document','test','internal',1,'21300000-0000-4000-8000-000000000001',null),
  ('21300000-0000-4000-8000-000000000081','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000020','21300000-0000-4000-8000-000000000041',
    'Same Tenant Hidden Document','test','internal',1,'21300000-0000-4000-8000-000000000001',null),
  ('21300000-0000-4000-8000-000000000082','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000020','21300000-0000-4000-8000-000000000040',
    'Restricted Hidden Document','test','restricted',1,'21300000-0000-4000-8000-000000000001',null),
  ('21300000-0000-4000-8000-000000000083','21300000-0000-4000-8000-000000000011',
    '21300000-0000-4000-8000-000000000021','21300000-0000-4000-8000-000000000042',
    'Other Tenant Hidden Document','test','internal',1,'21300000-0000-4000-8000-000000000001',null),
  ('21300000-0000-4000-8000-000000000084','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000020','21300000-0000-4000-8000-000000000040',
    'Quarantined Authorized Document','test','internal',1,'21300000-0000-4000-8000-000000000001',null);
alter table documents.documents enable trigger document_workspace_creation_guard_v1;

insert into documents.document_versions(
  id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,scanning_status
) values
  ('21300000-0000-4000-8000-000000000090','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000080',1,'private/authorized.pdf',repeat('a',64),
    'application/pdf',101,'clean'),
  ('21300000-0000-4000-8000-000000000091','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000081',1,'private/hidden.pdf',repeat('b',64),
    'application/pdf',102,'clean'),
  ('21300000-0000-4000-8000-000000000092','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000082',1,'private/restricted.pdf',repeat('c',64),
    'application/pdf',103,'clean'),
  ('21300000-0000-4000-8000-000000000093','21300000-0000-4000-8000-000000000011',
    '21300000-0000-4000-8000-000000000083',1,'private/other-tenant.pdf',repeat('d',64),
    'application/pdf',104,'clean'),
  ('21300000-0000-4000-8000-000000000094','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000084',1,'private/quarantined.pdf',repeat('e',64),
    'application/pdf',105,'quarantined');

insert into documents.document_links(id,tenant_id,document_id,entity_type,entity_id,relation_type) values
  ('21300000-0000-4000-8000-000000000100','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000080','portfolio.unit',
    '21300000-0000-4000-8000-000000000060','attachment'),
  ('21300000-0000-4000-8000-000000000101','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000081','portfolio.unit',
    '21300000-0000-4000-8000-000000000061','attachment'),
  ('21300000-0000-4000-8000-000000000102','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000082','portfolio.unit',
    '21300000-0000-4000-8000-000000000060','attachment'),
  ('21300000-0000-4000-8000-000000000103','21300000-0000-4000-8000-000000000011',
    '21300000-0000-4000-8000-000000000083','portfolio.unit',
    '21300000-0000-4000-8000-000000000062','attachment');

select throws_ok($$insert into documents.document_links(
    id,tenant_id,document_id,entity_type,entity_id,relation_type
  ) values(
    '21300000-0000-4000-8000-000000000104','21300000-0000-4000-8000-000000000010',
    '21300000-0000-4000-8000-000000000080','portfolio.unit',
    '21300000-0000-4000-8000-000000000062','attachment'
  )$$, '22000', 'document_link_cross_tenant_or_missing',
  'cross-tenant Unit binding is rejected even when the code matches');

create temp table pg_temp.documents_unit_link_results(
  result_kind text primary key,
  payload jsonb
) on commit drop;
create temp table pg_temp.documents_unit_link_counts as
select
  (select count(*) from documents.documents) documents_count,
  (select count(*) from documents.document_versions) versions_count,
  (select count(*) from documents.document_links) links_count,
  (select count(*) from documents.access_events) access_events_count,
  (select count(*) from documents.document_scan_jobs) scan_jobs_count;

select set_config(
  'request.jwt.claims',
  '{"sub":"21300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
insert into pg_temp.documents_unit_link_results values
  ('links',documents.get_customer_documents(
    '21300000-0000-4000-8000-000000000070','links',null,null,null,null,null,25,0,null)),
  ('documents',documents.get_customer_documents(
    '21300000-0000-4000-8000-000000000070','documents',null,null,null,null,null,25,0,null));

select is((select (payload->>'total')::integer from pg_temp.documents_unit_link_results
  where result_kind='links'),1,'only one authorized link is returned');
select is((select payload#>>'{rows,0,id}' from pg_temp.documents_unit_link_results
  where result_kind='links'),'21300000-0000-4000-8000-000000000100',
  'the authorized document link is returned');
select is((select payload#>>'{rows,0,entity_label}' from pg_temp.documents_unit_link_results
  where result_kind='links'),'CANON-UNIT-01','Unit label uses canonical code');
select ok(not ((select payload->'rows' from pg_temp.documents_unit_link_results
  where result_kind='links') @> '[{"id":"21300000-0000-4000-8000-000000000101"}]'::jsonb),
  'same-tenant document outside the Context property is not returned');
select ok(not ((select payload->'rows' from pg_temp.documents_unit_link_results
  where result_kind='links') @> '[{"id":"21300000-0000-4000-8000-000000000102"}]'::jsonb),
  'restricted document link is not returned to property manager');
select ok(not ((select payload->'rows' from pg_temp.documents_unit_link_results
  where result_kind='links') @> '[{"id":"21300000-0000-4000-8000-000000000103"}]'::jsonb),
  'other-tenant document link with the same Unit code is not returned');
select ok((select payload::text not like '%HIDDEN-UNIT-01%'
    and payload::text not like '%Same Tenant Hidden Document%'
    and payload::text not like '%Restricted Hidden Document%'
    and payload::text not like '%Other Tenant Hidden Document%'
  from pg_temp.documents_unit_link_results where result_kind='links'),
  'unauthorized entity labels and document titles do not leak');
select ok((select (payload#>'{rows,0}') ?& array[
    'id','document_title','entity_type','entity_label','relation_type','created_at'
  ] and (select count(*) from jsonb_object_keys(payload#>'{rows,0}'))=6
  from pg_temp.documents_unit_link_results where result_kind='links'),
  'link projection contains exactly the bounded metadata fields');
select ok((select not ((payload#>'{rows,0}') ?| array[
    'object_path','sha256','hash','metadata_json','audit_event_id','raw_audit','tenant_id','workspace_id'
  ]) from pg_temp.documents_unit_link_results where result_kind='links'),
  'link projection exposes no Storage path, hash, raw audit, tenant, or Workspace metadata');
select is((select payload#>>'{context,id}' from pg_temp.documents_unit_link_results
  where result_kind='links'),'21300000-0000-4000-8000-000000000070',
  'response remains bound to the exact Context');
select ok((select (payload->>'read_only')::boolean
    and not (payload->>'storage_access')::boolean
    and not (payload->>'signed_urls')::boolean
  from pg_temp.documents_unit_link_results where result_kind='links'),
  'response remains read-only with Storage and signed URL access denied');
select is((select (payload->>'total')::integer from pg_temp.documents_unit_link_results
  where result_kind='documents'),2,
  'authorized document projection excludes out-of-scope and restricted documents');
select ok((select exists(select 1 from jsonb_array_elements(payload->'rows') row
    where row->>'id'='21300000-0000-4000-8000-000000000080'
      and row->>'scanning_status'='clean')
  from pg_temp.documents_unit_link_results where result_kind='documents'),
  'clean scanner verdict remains projected');
select ok((select exists(select 1 from jsonb_array_elements(payload->'rows') row
    where row->>'id'='21300000-0000-4000-8000-000000000084'
      and row->>'scanning_status'='quarantined')
  from pg_temp.documents_unit_link_results where result_kind='documents'),
  'quarantined scanner verdict remains projected for downstream denial');
select ok((select not exists(select 1 from jsonb_array_elements(payload->'rows') row
    where row ? 'object_path')
  from pg_temp.documents_unit_link_results where result_kind='documents'),
  'document list does not expose an object path');

select throws_ok($$select documents.get_customer_documents(
  '21300000-0000-4000-8000-000000000071','links',null,null,null,null,null,25,0,null)$$,
  '42501','customer_context_access_denied','expired Context is denied');
select set_config(
  'request.jwt.claims',
  '{"sub":"21300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok($$select documents.get_customer_documents(
  '21300000-0000-4000-8000-000000000070','links',null,null,null,null,null,25,0,null)$$,
  '42501','customer_context_access_denied','another actor cannot reuse the authorized Context');
select set_config(
  'request.jwt.claims',
  '{"sub":"21300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok($$select documents.get_customer_documents(
  '21300000-0000-4000-8000-000000000073','links',null,null,null,null,null,25,0,null)$$,
  '42501','customer_context_access_denied','revoked membership is denied');

select ok((select
    documents_count=(select count(*) from documents.documents)
    and versions_count=(select count(*) from documents.document_versions)
    and links_count=(select count(*) from documents.document_links)
    and access_events_count=(select count(*) from documents.access_events)
    and scan_jobs_count=(select count(*) from documents.document_scan_jobs)
  from pg_temp.documents_unit_link_counts),
  'authorized and denied reads produce zero durable writes');

select * from finish();
rollback;
