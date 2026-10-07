begin;
select plan(13);
insert into auth.users(id,email) values
 ('16400000-0000-4000-8000-000000000001','proposer164@cladora.test'),
 ('16400000-0000-4000-8000-000000000002','reviewer164@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('16400000-0000-4000-8000-000000000003','Relationship tenant A','LC164A','active'),
 ('16400000-0000-4000-8000-000000000004','Relationship tenant B','LC164B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('16400000-0000-4000-8000-000000000005','16400000-0000-4000-8000-000000000003','condominium','A','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('16400000-0000-4000-8000-000000000006','16400000-0000-4000-8000-000000000003',
  '16400000-0000-4000-8000-000000000005','B','B');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('16400000-0000-4000-8000-000000000007','16400000-0000-4000-8000-000000000003',
  '16400000-0000-4000-8000-000000000006','U');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('16400000-0000-4000-8000-000000000008','16400000-0000-4000-8000-000000000003','person','Seller'),
 ('16400000-0000-4000-8000-000000000009','16400000-0000-4000-8000-000000000003','person','Buyer'),
 ('16400000-0000-4000-8000-000000000010','16400000-0000-4000-8000-000000000004','person','Foreign');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('16400000-0000-4000-8000-000000000011','16400000-0000-4000-8000-000000000003','ASSOCIATION','A','ACTIVE'),
 ('16400000-0000-4000-8000-000000000012','16400000-0000-4000-8000-000000000004','ASSOCIATION','B','ACTIVE');

select lives_ok($$insert into portfolio.relationship_proposals
 (id,tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,target_party_id,
  effective_from,evidence_reference,reason,proposed_by)
 values('16400000-0000-4000-8000-000000000013','16400000-0000-4000-8000-000000000003',
 '16400000-0000-4000-8000-000000000005','16400000-0000-4000-8000-000000000007',
 '16400000-0000-4000-8000-000000000011','ownership_transfer',
 '16400000-0000-4000-8000-000000000008','16400000-0000-4000-8000-000000000009',
 current_date,'test://transfer-evidence','Test proposal','16400000-0000-4000-8000-000000000001')$$,
 'Private proposal recorded');
select is((select count(*) from portfolio.ownerships where unit_id='16400000-0000-4000-8000-000000000007'),0::bigint,
 'Proposal does not create title');
select throws_ok($$insert into portfolio.relationship_proposals
 (tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,target_party_id,
 effective_from,evidence_reference,reason,proposed_by)
 select tenant_id,property_id,unit_id,'16400000-0000-4000-8000-000000000012',kind,source_party_id,target_party_id,
 effective_from,evidence_reference,reason,proposed_by from portfolio.relationship_proposals
 where id='16400000-0000-4000-8000-000000000013'$$,
 '42501','relationship_proposal_subject_mismatch','Foreign workspace rejected');
select throws_ok($$insert into portfolio.relationship_proposals
 (tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,target_party_id,
 effective_from,evidence_reference,reason,proposed_by)
 select tenant_id,property_id,unit_id,customer_workspace_id,kind,source_party_id,
 '16400000-0000-4000-8000-000000000010',effective_from,evidence_reference,reason,proposed_by
 from portfolio.relationship_proposals where id='16400000-0000-4000-8000-000000000013'$$,
 '42501','relationship_proposal_subject_mismatch','Foreign party rejected');
select throws_ok($$update portfolio.relationship_proposals set reason='Rewritten' where id='16400000-0000-4000-8000-000000000013'$$,
 '42501','relationship_proposal_immutable','Proposal cannot be rewritten');
select throws_ok($$delete from portfolio.relationship_proposals where id='16400000-0000-4000-8000-000000000013'$$,
 '42501','relationship_proposal_immutable','Proposal cannot be deleted');
select throws_ok($$insert into portfolio.relationship_reviews
 (proposal_id,tenant_id,decision,evidence_reference,reason,reviewed_by) values
 ('16400000-0000-4000-8000-000000000013','16400000-0000-4000-8000-000000000003',
 'verified','test://review-evidence','Same actor','16400000-0000-4000-8000-000000000001')$$,
 '42501','relationship_review_independence_required','Proposer cannot review');
select throws_ok($$insert into portfolio.relationship_reviews
 (proposal_id,tenant_id,decision,evidence_reference,reason,reviewed_by) values
 ('16400000-0000-4000-8000-000000000013','16400000-0000-4000-8000-000000000004',
 'verified','test://review-evidence','Wrong tenant','16400000-0000-4000-8000-000000000002')$$,
 '42501','relationship_review_independence_required','Foreign review tenant rejected');
select lives_ok($$insert into portfolio.relationship_reviews
 (id,proposal_id,tenant_id,decision,evidence_reference,reason,reviewed_by) values
 ('16400000-0000-4000-8000-000000000014','16400000-0000-4000-8000-000000000013',
 '16400000-0000-4000-8000-000000000003','verified','test://review-evidence',
 'Independent review','16400000-0000-4000-8000-000000000002')$$,
 'Independent review recorded');
select is((select count(*) from portfolio.ownerships where unit_id='16400000-0000-4000-8000-000000000007'),0::bigint,
 'Review does not transfer title');
select throws_ok($$update portfolio.relationship_reviews set decision='rejected'
 where id='16400000-0000-4000-8000-000000000014'$$,
 '42501','relationship_review_immutable','Review cannot be rewritten');
select throws_ok($$delete from portfolio.relationship_reviews where id='16400000-0000-4000-8000-000000000014'$$,
 '42501','relationship_review_immutable','Review cannot be deleted');
select ok(not has_table_privilege('authenticated','portfolio.relationship_proposals','SELECT')
 and not has_table_privilege('authenticated','portfolio.relationship_reviews','INSERT')
 and not has_table_privilege('service_role','portfolio.relationship_proposals','INSERT'),
 'Ledger inaccessible to customer and service roles');
select * from finish();
rollback;
