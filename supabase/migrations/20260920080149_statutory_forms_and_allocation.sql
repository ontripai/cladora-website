begin;

-- R10 Phase 1B: versioned statutory form semantics and a deterministic,
-- cent-exact allocation evidence engine. This layer does not post journals or
-- expose a customer API. Exact pixel renderers remain legal-review gated.

create type finance.statutory_expense_category as enum (
  'persons',
  'individual_consumption',
  'undivided_share',
  'beneficiaries',
  'technical_consumers',
  'other'
);

create type finance.statutory_form_state as enum ('draft', 'finalized', 'superseded');
create type finance.statutory_allocation_status as enum ('draft', 'calculated', 'finalized', 'cancelled');

create table finance.statutory_form_definitions (
  id uuid primary key default gen_random_uuid(),
  form_code text not null,
  version integer not null default 1 check (version > 0),
  canonical_name_ro text not null check (btrim(canonical_name_ro) <> ''),
  legal_source text not null check (btrim(legal_source) <> ''),
  semantic_schema jsonb not null check (jsonb_typeof(semantic_schema) = 'object'),
  renderer_status text not null
    check (renderer_status in ('semantic_schema_verified', 'legal_review_required')),
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  unique (form_code, version),
  check (form_code in ('14-1-1/A', '14-1-2', '14-6-28', '14-6-30/d'))
);

create table finance.statutory_form_instances (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references finance.statutory_form_definitions(id) on delete restrict,
  cycle_id uuid not null references finance.statutory_monthly_cycles(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  instance_version integer not null default 1 check (instance_version > 0),
  state finance.statutory_form_state not null default 'draft',
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$'),
  supersedes_id uuid references finance.statutory_form_instances(id) on delete restrict,
  generated_by uuid not null references auth.users(id) on delete restrict,
  finalized_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  finalized_at timestamptz,
  unique (cycle_id, definition_id, instance_version),
  check ((state in ('finalized', 'superseded')) = (finalized_at is not null)),
  check ((finalized_at is null) = (finalized_by is null)),
  check (state = 'draft' or payload_hash is not null),
  check (supersedes_id is null or supersedes_id <> id)
);

create table finance.statutory_allocation_batches (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references finance.statutory_monthly_cycles(id) on delete restrict,
  allocation_run_id uuid not null references finance.allocation_runs(id) on delete restrict,
  allocation_input_id uuid not null references finance.allocation_inputs(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  category finance.statutory_expense_category not null,
  legal_basis text not null check (btrim(legal_basis) <> ''),
  source_document_type text not null check (btrim(source_document_type) <> ''),
  source_document_number text not null check (btrim(source_document_number) <> ''),
  source_amount numeric(20,2) not null check (source_amount > 0),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  source_snapshot_hash text not null check (source_snapshot_hash ~ '^[0-9a-f]{64}$'),
  currency char(3) not null default 'RON' check (currency = 'RON'),
  basis_policy_code text not null check (btrim(basis_policy_code) <> ''),
  policy_decision_reference text,
  methodology_reference text,
  status finance.statutory_allocation_status not null default 'draft',
  input_hash text check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  results_hash text check (results_hash is null or results_hash ~ '^[0-9a-f]{64}$'),
  lock_version integer not null default 1 check (lock_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  calculated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  calculated_at timestamptz,
  finalized_at timestamptz,
  unique (allocation_input_id),
  unique (cycle_id, source_document_type, source_document_number, category),
  check ((status in ('calculated', 'finalized')) = (calculated_at is not null)),
  check ((calculated_at is null) = (calculated_by is null)),
  check (status <> 'finalized' or finalized_at is not null),
  check (basis_policy_code <> 'generic_equal_split'),
  check (category <> 'technical_consumers' or nullif(btrim(methodology_reference), '') is not null)
);

create table finance.statutory_allocation_bases (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references finance.statutory_allocation_batches(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict,
  basis_value numeric(24,8) not null check (basis_value >= 0),
  basis_unit text not null check (basis_unit in (
    'persons', 'person_days', 'meter_units', 'share_fraction',
    'beneficiary_units', 'technical_units', 'contractual_units'
  )),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (batch_id, unit_id)
);

create table finance.statutory_allocation_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references finance.statutory_allocation_batches(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict,
  basis_value numeric(24,8) not null check (basis_value >= 0),
  floor_cents bigint not null check (floor_cents >= 0),
  remainder_rank integer not null check (remainder_rank > 0),
  allocated_cents bigint not null check (allocated_cents >= 0),
  allocated_amount numeric(20,2) generated always as (allocated_cents::numeric / 100) stored,
  created_at timestamptz not null default statement_timestamp(),
  unique (batch_id, unit_id)
);

-- Every FK receives a covering index; the repository enforces this globally.
create index statutory_form_instances_definition_idx on finance.statutory_form_instances(definition_id);
create index statutory_form_instances_cycle_idx on finance.statutory_form_instances(cycle_id);
create index statutory_form_instances_tenant_idx on finance.statutory_form_instances(tenant_id);
create index statutory_form_instances_property_idx on finance.statutory_form_instances(property_id);
create index statutory_form_instances_supersedes_idx on finance.statutory_form_instances(supersedes_id);
create index statutory_form_instances_generated_by_idx on finance.statutory_form_instances(generated_by);
create index statutory_form_instances_finalized_by_idx on finance.statutory_form_instances(finalized_by);
create index statutory_allocation_batches_cycle_idx on finance.statutory_allocation_batches(cycle_id);
create index statutory_allocation_batches_run_idx on finance.statutory_allocation_batches(allocation_run_id);
create index statutory_allocation_batches_tenant_idx on finance.statutory_allocation_batches(tenant_id);
create index statutory_allocation_batches_property_idx on finance.statutory_allocation_batches(property_id);
create index statutory_allocation_batches_created_by_idx on finance.statutory_allocation_batches(created_by);
create index statutory_allocation_batches_calculated_by_idx on finance.statutory_allocation_batches(calculated_by);
create index statutory_allocation_bases_tenant_idx on finance.statutory_allocation_bases(tenant_id);
create index statutory_allocation_bases_unit_idx on finance.statutory_allocation_bases(unit_id);
create index statutory_allocation_bases_created_by_idx on finance.statutory_allocation_bases(created_by);
create index statutory_allocation_results_tenant_idx on finance.statutory_allocation_results(tenant_id);
create index statutory_allocation_results_unit_idx on finance.statutory_allocation_results(unit_id);

insert into finance.statutory_form_definitions (
  id, form_code, canonical_name_ro, legal_source, semantic_schema, renderer_status
) values
  (
    '10600000-0000-0000-0000-000000000001', '14-1-1/A',
    'Registrul-jurnal', 'OMFP 3103/2017, Anexa 2',
    '{"required":["sequence","operation_date","supporting_document","operation_description","amount"],"accounting_basis":"accrual","currency":"RON"}',
    'semantic_schema_verified'
  ),
  (
    '10600000-0000-0000-0000-000000000002', '14-1-2',
    'Registrul-inventar', 'OMFP 3103/2017, Anexa 2',
    '{"required":["sequence","item_nature","book_value","inventory_value","difference","difference_cause"],"currency":"RON"}',
    'semantic_schema_verified'
  ),
  (
    '10600000-0000-0000-0000-000000000003', '14-6-28',
    'Lista de plată a cotelor de contribuție', 'OMFP 3103/2017, Anexa 2',
    '{"required":["period","owners","expense_categories","contribution_quotas","fund_replenishment"],"layout":"official_image_transcription_pending"}',
    'legal_review_required'
  ),
  (
    '10600000-0000-0000-0000-000000000004', '14-6-30/d',
    'Situația soldurilor elementelor de activ și de pasiv', 'OMFP 3103/2017, Anexa 2',
    '{"required":["period","asset_balances","liability_balances","control_totals"],"layout":"official_image_transcription_pending"}',
    'legal_review_required'
  )
on conflict (form_code, version) do nothing;

create or replace function finance.calculate_largest_remainder_v1(
  p_total_amount numeric,
  p_bases jsonb
)
returns table (
  subject_id uuid,
  basis_value numeric(24,8),
  floor_cents bigint,
  remainder_rank integer,
  allocated_cents bigint,
  allocated_amount numeric(20,2)
)
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  v_total_cents bigint;
  v_count integer;
  v_distinct integer;
  v_basis_total numeric;
begin
  if p_total_amount is null or p_total_amount <= 0
     or p_total_amount <> round(p_total_amount, 2) then
    raise exception 'statutory_allocation_amount_invalid' using errcode = '22003';
  end if;
  if p_bases is null or jsonb_typeof(p_bases) <> 'array'
     or jsonb_array_length(p_bases) < 1 or jsonb_array_length(p_bases) > 10000 then
    raise exception 'statutory_allocation_bases_invalid' using errcode = '22023';
  end if;

  select count(*), count(distinct x.subject_id), sum(x.basis_value)
  into v_count, v_distinct, v_basis_total
  from jsonb_to_recordset(p_bases) as x(subject_id uuid, basis_value numeric);

  if v_count <> jsonb_array_length(p_bases) or v_distinct <> v_count
     or v_basis_total is null or v_basis_total <= 0
     or exists (
       select 1 from jsonb_to_recordset(p_bases) as x(subject_id uuid, basis_value numeric)
       where x.subject_id is null or x.basis_value is null or x.basis_value < 0
     ) then
    raise exception 'statutory_allocation_bases_invalid' using errcode = '22023';
  end if;

  v_total_cents := (p_total_amount * 100)::bigint;

  return query
  with parsed as (
    select x.subject_id, x.basis_value::numeric(24,8) basis_value
    from jsonb_to_recordset(p_bases) as x(subject_id uuid, basis_value numeric)
  ), raw as (
    select p.subject_id, p.basis_value,
      (v_total_cents::numeric * p.basis_value / v_basis_total) raw_cents
    from parsed p
  ), ranked as (
    select r.*,
      trunc(r.raw_cents)::bigint base_cents,
      row_number() over (
        order by (r.raw_cents - trunc(r.raw_cents)) desc, r.subject_id::text asc
      )::integer rank_no
    from raw r
  ), totals as (
    select (v_total_cents - sum(base_cents))::integer cents_to_distribute from ranked
  )
  select r.subject_id, r.basis_value, r.base_cents, r.rank_no,
    r.base_cents + case when r.rank_no <= t.cents_to_distribute then 1 else 0 end,
    ((r.base_cents + case when r.rank_no <= t.cents_to_distribute then 1 else 0 end)::numeric / 100)::numeric(20,2)
  from ranked r cross join totals t
  order by r.subject_id;
end
$$;

create or replace function finance.validate_statutory_forms_allocation_scope_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent record;
begin
  if tg_table_name = 'statutory_form_instances' then
    select tenant_id, property_id, status into v_parent
      from finance.statutory_monthly_cycles where id = new.cycle_id;
    if v_parent.tenant_id is distinct from new.tenant_id
       or v_parent.property_id is distinct from new.property_id then
      raise exception 'statutory_form_scope_mismatch' using errcode = '23514';
    end if;
  elsif tg_table_name = 'statutory_allocation_batches' then
    select sc.tenant_id, sc.property_id, sc.status,
           mc.allocation_run_id operational_run_id,
           ar.tenant_id run_tenant, ar.property_id run_property, ar.currency run_currency,
           ai.run_id input_run_id, ai.tenant_id input_tenant, ai.amount input_amount,
           ai.snapshot_json input_snapshot
      into v_parent
      from finance.statutory_monthly_cycles sc
      left join finance.monthly_cycles mc on mc.id = sc.operational_monthly_cycle_id
      join finance.allocation_runs ar on ar.id = new.allocation_run_id
      join finance.allocation_inputs ai on ai.id = new.allocation_input_id
      where sc.id = new.cycle_id;
    if v_parent.tenant_id is distinct from new.tenant_id
       or v_parent.property_id is distinct from new.property_id then
      raise exception 'statutory_allocation_scope_mismatch' using errcode = '23514';
    end if;
    if v_parent.operational_run_id is distinct from new.allocation_run_id
       or v_parent.input_run_id is distinct from new.allocation_run_id
       or v_parent.run_tenant is distinct from new.tenant_id
       or v_parent.input_tenant is distinct from new.tenant_id
       or v_parent.run_property is distinct from new.property_id
       or v_parent.run_currency is distinct from 'RON'
       or v_parent.input_amount is distinct from new.source_amount then
      raise exception 'statutory_allocation_legacy_source_mismatch' using errcode = '23514';
    end if;
    if v_parent.status not in ('draft', 'collecting') then
      raise exception 'statutory_cycle_not_open_for_allocation' using errcode = '55000';
    end if;
    if tg_op = 'INSERT' then
      new.source_snapshot := v_parent.input_snapshot;
      new.source_snapshot_hash := encode(extensions.digest(convert_to(jsonb_build_object(
        'allocation_input_id', new.allocation_input_id,
        'amount', new.source_amount,
        'snapshot', v_parent.input_snapshot
      )::text, 'UTF8'), 'sha256'), 'hex');
    elsif new.source_snapshot is distinct from old.source_snapshot
       or new.source_snapshot_hash is distinct from old.source_snapshot_hash then
      raise exception 'statutory_allocation_source_snapshot_is_immutable' using errcode = '55000';
    end if;
  elsif tg_table_name in ('statutory_allocation_bases', 'statutory_allocation_results') then
    select b.tenant_id, b.property_id, b.status, u.tenant_id unit_tenant,
           pb.property_id unit_property
      into v_parent
      from finance.statutory_allocation_batches b
      join portfolio.units u on u.id = new.unit_id
      join portfolio.buildings pb on pb.id = u.building_id
      where b.id = new.batch_id;
    if v_parent.tenant_id is distinct from new.tenant_id
       or v_parent.unit_tenant is distinct from new.tenant_id
       or v_parent.unit_property is distinct from v_parent.property_id then
      raise exception 'statutory_allocation_basis_scope_mismatch' using errcode = '23514';
    end if;
    if tg_table_name = 'statutory_allocation_bases' and v_parent.status <> 'draft' then
      raise exception 'statutory_allocation_basis_locked' using errcode = '55000';
    end if;
  end if;
  return new;
end
$$;

create or replace function finance.protect_final_statutory_record_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_table_name = 'statutory_form_instances' then
    if old.state in ('finalized', 'superseded') then
      raise exception 'final_statutory_form_is_immutable' using errcode = '55000';
    end if;
  elsif tg_table_name = 'statutory_allocation_batches' then
    if old.status <> 'draft' then
      raise exception 'calculated_statutory_allocation_is_immutable' using errcode = '55000';
    end if;
  elsif tg_table_name in ('statutory_allocation_bases', 'statutory_allocation_results') then
    raise exception 'statutory_allocation_evidence_is_append_only' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger statutory_form_instances_scope_guard
before insert or update on finance.statutory_form_instances
for each row execute function finance.validate_statutory_forms_allocation_scope_v1();
create trigger statutory_allocation_batches_scope_guard
before insert or update on finance.statutory_allocation_batches
for each row execute function finance.validate_statutory_forms_allocation_scope_v1();
create trigger statutory_allocation_bases_scope_guard
before insert or update on finance.statutory_allocation_bases
for each row execute function finance.validate_statutory_forms_allocation_scope_v1();
create trigger statutory_allocation_results_scope_guard
before insert on finance.statutory_allocation_results
for each row execute function finance.validate_statutory_forms_allocation_scope_v1();
create trigger statutory_form_instances_immutable
before update or delete on finance.statutory_form_instances
for each row execute function finance.protect_final_statutory_record_v1();
create trigger statutory_allocation_batches_immutable
before update or delete on finance.statutory_allocation_batches
for each row execute function finance.protect_final_statutory_record_v1();
create trigger statutory_allocation_results_append_only
before update or delete on finance.statutory_allocation_results
for each row execute function finance.protect_final_statutory_record_v1();
create trigger statutory_allocation_bases_append_only
before update or delete on finance.statutory_allocation_bases
for each row execute function finance.protect_final_statutory_record_v1();

create or replace function app_private.seal_statutory_form_instance_v1(
  p_instance_id uuid,
  p_expected_instance_version integer,
  p_actor_id uuid
)
returns finance.statutory_form_instances
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_instance finance.statutory_form_instances;
  v_cycle_id uuid;
  v_form_code text;
  v_receipts numeric(20,2);
  v_payments numeric(20,2);
begin
  if p_instance_id is null or p_expected_instance_version is null or p_actor_id is null then
    raise exception 'statutory_form_invalid_arguments' using errcode = '22023';
  end if;
  select cycle_id into v_cycle_id from finance.statutory_form_instances
  where id = p_instance_id;
  if not found then
    raise exception 'statutory_form_instance_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cycle:' || v_cycle_id::text, 0));
  select * into v_instance from finance.statutory_form_instances
  where id = p_instance_id for update;
  perform 1 from finance.statutory_monthly_cycles where id = v_instance.cycle_id for update;

  if v_instance.instance_version <> p_expected_instance_version then
    raise exception 'statutory_form_instance_version_conflict' using errcode = '40001';
  end if;
  if v_instance.state <> 'draft' then
    raise exception 'statutory_form_instance_not_draft' using errcode = '55000';
  end if;
  select form_code into v_form_code from finance.statutory_form_definitions
  where id = v_instance.definition_id and active is true;
  if not found then
    raise exception 'statutory_form_definition_not_active' using errcode = '55000';
  end if;

  if v_form_code in ('14-6-28', '14-6-30/d') then
    raise exception 'statutory_form_phase2_dependencies_not_ready: %', v_form_code
      using errcode = '55000';
  elsif v_form_code = '14-1-1/A' then
    if jsonb_typeof(v_instance.payload -> 'rows') <> 'array'
       or jsonb_array_length(v_instance.payload -> 'rows') = 0
       or jsonb_typeof(v_instance.payload -> 'control_totals') <> 'object' then
      raise exception 'statutory_journal_payload_incomplete' using errcode = '23514';
    end if;
    select coalesce(sum(amount) filter (where direction = 'receipt'), 0),
           coalesce(sum(amount) filter (where direction = 'payment'), 0)
      into v_receipts, v_payments
      from finance.statutory_simple_entries where cycle_id = v_instance.cycle_id;
    if (v_instance.payload #>> '{control_totals,total_receipts}')::numeric is distinct from v_receipts
       or (v_instance.payload #>> '{control_totals,total_payments}')::numeric is distinct from v_payments then
      raise exception 'statutory_journal_control_totals_mismatch' using errcode = '23514';
    end if;
  elsif v_form_code = '14-1-2' then
    if jsonb_typeof(v_instance.payload -> 'inventory_rows') <> 'array'
       or jsonb_array_length(v_instance.payload -> 'inventory_rows') = 0
       or nullif(btrim(v_instance.payload ->> 'inventory_signoff_reference'), '') is null then
      raise exception 'statutory_inventory_payload_incomplete' using errcode = '23514';
    end if;
  end if;

  update finance.statutory_form_instances
  set state = 'finalized',
      payload_hash = encode(extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex'),
      finalized_by = p_actor_id,
      finalized_at = statement_timestamp()
  where id = p_instance_id returning * into v_instance;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason
  ) values (
    v_instance.tenant_id, p_actor_id, 'service_role', 'statutory.form.finalized',
    'statutory_form_instance', v_instance.id,
    jsonb_build_object('form_code', v_form_code, 'payload_hash', v_instance.payload_hash),
    'OMFP 3103/2017 semantic form sealing'
  );
  return v_instance;
end
$$;

create or replace function app_private.calculate_statutory_allocation_batch_v1(
  p_batch_id uuid,
  p_expected_lock_version integer,
  p_actor_id uuid
)
returns finance.statutory_allocation_batches
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_batch finance.statutory_allocation_batches;
  v_bases jsonb;
  v_basis_total numeric;
  v_allowed_units text[];
  v_cycle_id uuid;
  v_input_hash text;
  v_results_hash text;
begin
  if p_batch_id is null or p_expected_lock_version is null or p_actor_id is null then
    raise exception 'statutory_allocation_invalid_arguments' using errcode = '22023';
  end if;
  select cycle_id into v_cycle_id from finance.statutory_allocation_batches
  where id = p_batch_id;
  if not found then
    raise exception 'statutory_allocation_batch_not_found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_cycle:' || v_cycle_id::text, 0));
  select * into v_batch from finance.statutory_allocation_batches
  where id = p_batch_id for update;
  if not found then
    raise exception 'statutory_allocation_batch_not_found' using errcode = 'P0002';
  end if;
  if v_batch.lock_version <> p_expected_lock_version then
    raise exception 'statutory_allocation_lock_version_conflict' using errcode = '40001';
  end if;
  if v_batch.status <> 'draft' then
    raise exception 'statutory_allocation_batch_not_draft' using errcode = '55000';
  end if;
  perform 1 from finance.statutory_monthly_cycles where id = v_batch.cycle_id for update;
  perform 1 from finance.allocation_runs where id = v_batch.allocation_run_id for update;
  perform 1 from finance.allocation_inputs where id = v_batch.allocation_input_id for update;

  select coalesce(jsonb_agg(jsonb_build_object(
      'subject_id', unit_id, 'basis_value', basis_value
    ) order by unit_id), '[]'::jsonb), coalesce(sum(basis_value), 0)
  into v_bases, v_basis_total
  from finance.statutory_allocation_bases where batch_id = p_batch_id;
  if jsonb_array_length(v_bases) = 0 or v_basis_total <= 0 then
    raise exception 'statutory_allocation_bases_required' using errcode = '22023';
  end if;

  v_allowed_units := case v_batch.category
    when 'persons' then array['persons', 'person_days']
    when 'individual_consumption' then array['meter_units']
    when 'undivided_share' then array['share_fraction']
    when 'beneficiaries' then array['beneficiary_units']
    when 'technical_consumers' then array['technical_units']
    when 'other' then array['contractual_units']
  end;
  if exists (
    select 1 from finance.statutory_allocation_bases
    where batch_id = p_batch_id and not (basis_unit = any(v_allowed_units))
  ) then
    raise exception 'statutory_allocation_basis_unit_invalid' using errcode = '23514';
  end if;
  if v_batch.category = 'undivided_share' and v_basis_total <> 1.00000000 then
    raise exception 'statutory_undivided_shares_must_total_one' using errcode = '23514';
  end if;
  if v_batch.category = 'individual_consumption' and exists (
    select 1 from finance.statutory_allocation_bases
    where batch_id = p_batch_id
      and not (provenance ? 'reading_reference' and provenance ? 'methodology_reference')
  ) then
    raise exception 'statutory_consumption_provenance_required' using errcode = '23514';
  end if;
  if v_batch.category in ('persons', 'beneficiaries', 'other')
     and nullif(btrim(v_batch.policy_decision_reference), '') is null then
    raise exception 'statutory_policy_decision_reference_required' using errcode = '23514';
  end if;

  v_input_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'batch_id', v_batch.id, 'allocation_input_id', v_batch.allocation_input_id,
    'category', v_batch.category, 'amount', v_batch.source_amount,
    'basis_policy_code', v_batch.basis_policy_code,
    'policy_decision_reference', v_batch.policy_decision_reference,
    'methodology_reference', v_batch.methodology_reference,
    'source_snapshot_hash', v_batch.source_snapshot_hash, 'bases', v_bases
  )::text, 'UTF8'), 'sha256'), 'hex');

  insert into finance.statutory_allocation_results (
    batch_id, tenant_id, unit_id, basis_value, floor_cents, remainder_rank, allocated_cents
  )
  select v_batch.id, v_batch.tenant_id, a.subject_id, a.basis_value,
         a.floor_cents, a.remainder_rank, a.allocated_cents
  from finance.calculate_largest_remainder_v1(v_batch.source_amount, v_bases) a;

  select encode(extensions.digest(convert_to(coalesce(string_agg(
    concat_ws(':', unit_id::text, basis_value::text, allocated_cents::text),
    '|' order by unit_id
  ), ''), 'UTF8'), 'sha256'), 'hex')
  into v_results_hash
  from finance.statutory_allocation_results where batch_id = p_batch_id;

  update finance.statutory_allocation_batches
  set status = 'calculated', calculated_by = p_actor_id,
      calculated_at = statement_timestamp(), lock_version = lock_version + 1,
      input_hash = v_input_hash, results_hash = v_results_hash
  where id = p_batch_id returning * into v_batch;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason
  ) values (
    v_batch.tenant_id, p_actor_id, 'service_role',
    'statutory.allocation.calculated', 'statutory_allocation_batch', v_batch.id,
    jsonb_build_object('category', v_batch.category, 'amount', v_batch.source_amount,
      'lock_version', v_batch.lock_version),
    'deterministic largest-remainder statutory allocation'
  );
  return v_batch;
end
$$;

alter table finance.statutory_form_definitions enable row level security;
alter table finance.statutory_form_instances enable row level security;
alter table finance.statutory_allocation_batches enable row level security;
alter table finance.statutory_allocation_bases enable row level security;
alter table finance.statutory_allocation_results enable row level security;

create policy statutory_form_definitions_rpc_owner_all on finance.statutory_form_definitions
for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_form_instances_rpc_owner_all on finance.statutory_form_instances
for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_allocation_batches_rpc_owner_all on finance.statutory_allocation_batches
for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_allocation_bases_rpc_owner_all on finance.statutory_allocation_bases
for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_allocation_results_rpc_owner_all on finance.statutory_allocation_results
for all to cladora_rpc_owner using (true) with check (true);

grant select on finance.statutory_form_definitions to cladora_rpc_owner;
grant select, insert, update on finance.statutory_form_instances to cladora_rpc_owner;
grant select, insert, update on finance.statutory_allocation_batches to cladora_rpc_owner;
grant select, insert, update on finance.statutory_allocation_bases to cladora_rpc_owner;
grant select, insert on finance.statutory_allocation_results to cladora_rpc_owner;

revoke all on finance.statutory_form_definitions from public, anon, authenticated;
revoke all on finance.statutory_form_instances from public, anon, authenticated;
revoke all on finance.statutory_allocation_batches from public, anon, authenticated;
revoke all on finance.statutory_allocation_bases from public, anon, authenticated;
revoke all on finance.statutory_allocation_results from public, anon, authenticated;
grant all on finance.statutory_form_definitions to service_role;
grant all on finance.statutory_form_instances to service_role;
grant all on finance.statutory_allocation_batches to service_role;
grant all on finance.statutory_allocation_bases to service_role;
grant all on finance.statutory_allocation_results to service_role;

revoke all on function finance.calculate_largest_remainder_v1(numeric, jsonb) from public, anon, authenticated;
revoke all on function finance.validate_statutory_forms_allocation_scope_v1() from public, anon, authenticated;
revoke all on function finance.protect_final_statutory_record_v1() from public, anon, authenticated;
revoke all on function app_private.seal_statutory_form_instance_v1(uuid, integer, uuid)
  from public, anon, authenticated;
revoke all on function app_private.calculate_statutory_allocation_batch_v1(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function finance.calculate_largest_remainder_v1(numeric, jsonb) to service_role;
grant execute on function app_private.seal_statutory_form_instance_v1(uuid, integer, uuid) to service_role;
grant execute on function app_private.calculate_statutory_allocation_batch_v1(uuid, integer, uuid) to service_role;

comment on function finance.calculate_largest_remainder_v1(numeric, jsonb) is
  'Deterministic cent allocation. Fractional ties are resolved by ascending subject UUID.';
comment on table finance.statutory_form_definitions is
  'Versioned OMFP 3103/2017 semantic schemas; image-level renderers remain separately review-gated.';

commit;
