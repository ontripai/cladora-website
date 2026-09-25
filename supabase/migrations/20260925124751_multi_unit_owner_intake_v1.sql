begin;

-- Intake classification only: this never grants a customer role or access to
-- a canonical unit in a building workspace.
alter table public.marketing_leads
  drop constraint marketing_leads_applicant_type_check;

alter table public.marketing_leads
  add constraint marketing_leads_applicant_type_check
  check (applicant_type is null or applicant_type in
    ('association', 'management_company', 'owner', 'multi_unit_owner', 'company', 'other'));

commit;
