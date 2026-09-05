begin;
select plan(40);

-- 1. Table & function existence
select has_table('public', 'marketing_leads', 'marketing_leads table exists');
select has_table('public', 'marketing_rate_limits', 'marketing_rate_limits table exists');
select has_function('public', 'consume_marketing_rate_limit', ARRAY['text', 'integer', 'integer'], 'consume_marketing_rate_limit function exists');

-- 2. Row Level Security enforcement
select ok((select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='marketing_leads'), 'marketing_leads has RLS enabled');
select ok((select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='marketing_rate_limits'), 'marketing_rate_limits has RLS enabled');

-- 3. Anonymous role access rejection (select, insert, update, delete)
select ok(not has_table_privilege('anon', 'public.marketing_leads', 'SELECT'), 'anon cannot select marketing_leads');
select ok(not has_table_privilege('anon', 'public.marketing_leads', 'INSERT'), 'anon cannot insert marketing_leads');
select ok(not has_table_privilege('anon', 'public.marketing_leads', 'UPDATE'), 'anon cannot update marketing_leads');
select ok(not has_table_privilege('anon', 'public.marketing_leads', 'DELETE'), 'anon cannot delete marketing_leads');

-- 4. Authenticated role access rejection (select, insert, update, delete)
select ok(not has_table_privilege('authenticated', 'public.marketing_leads', 'SELECT'), 'authenticated cannot select marketing_leads');
select ok(not has_table_privilege('authenticated', 'public.marketing_leads', 'INSERT'), 'authenticated cannot insert marketing_leads');
select ok(not has_table_privilege('authenticated', 'public.marketing_leads', 'UPDATE'), 'authenticated cannot update marketing_leads');
select ok(not has_table_privilege('authenticated', 'public.marketing_leads', 'DELETE'), 'authenticated cannot delete marketing_leads');

-- 5. Service role privileges
select ok(has_table_privilege('service_role', 'public.marketing_leads', 'SELECT'), 'service_role can select marketing_leads');
select ok(has_table_privilege('service_role', 'public.marketing_leads', 'INSERT'), 'service_role can insert marketing_leads');
select ok(has_table_privilege('service_role', 'public.marketing_leads', 'UPDATE'), 'service_role can update marketing_leads');
select ok(has_table_privilege('service_role', 'public.marketing_rate_limits', 'SELECT'), 'service_role can select marketing_rate_limits');
select ok(has_table_privilege('service_role', 'public.marketing_rate_limits', 'INSERT'), 'service_role can insert marketing_rate_limits');
select ok(has_table_privilege('service_role', 'public.marketing_rate_limits', 'UPDATE'), 'service_role can update marketing_rate_limits');
select ok(has_table_privilege('service_role', 'public.marketing_rate_limits', 'DELETE'), 'service_role can delete marketing_rate_limits');

-- 6. Function execution privileges
select ok(not has_function_privilege('anon', 'public.consume_marketing_rate_limit(text, integer, integer)', 'EXECUTE'), 'anon cannot execute consume_marketing_rate_limit');
select ok(not has_function_privilege('authenticated', 'public.consume_marketing_rate_limit(text, integer, integer)', 'EXECUTE'), 'authenticated cannot execute consume_marketing_rate_limit');
select ok(has_function_privilege('service_role', 'public.consume_marketing_rate_limit(text, integer, integer)', 'EXECUTE'), 'service_role can execute consume_marketing_rate_limit');

-- 7. Constraints verification
-- 7a. Consent must be true
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy)
     values ('TEST-REF-01', 'contact', 'Test User', 'test@cladora.ro', 'ro', false) $$,
  '23514',
  NULL,
  'consent_privacy = false throws check constraint violation'
);

-- 7b. Invalid locale rejection
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy)
     values ('TEST-REF-02', 'contact', 'Test User', 'test@cladora.ro', 'de', true) $$,
  '23514',
  NULL,
  'invalid locale throws check constraint violation'
);

-- 7c. Invalid lead_type rejection
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy)
     values ('TEST-REF-03', 'enterprise', 'Test User', 'test@cladora.ro', 'ro', true) $$,
  '23514',
  NULL,
  'invalid lead_type throws check constraint violation'
);

-- 7d. Invalid status rejection
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, status)
     values ('TEST-REF-04', 'contact', 'Test User', 'test@cladora.ro', 'ro', true, 'archived') $$,
  '23514',
  NULL,
  'invalid status throws check constraint violation'
);

-- 7e. Units count boundary check (<= 0 or > 10000)
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, units_count)
     values ('TEST-REF-05', 'pilot', 'Test User', 'test@cladora.ro', 'ro', true, 0) $$,
  '23514',
  NULL,
  'units_count = 0 throws check constraint violation'
);

select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, units_count)
     values ('TEST-REF-06', 'pilot', 'Test User', 'test@cladora.ro', 'ro', true, 10001) $$,
  '23514',
  NULL,
  'units_count > 10000 throws check constraint violation'
);

-- 7f. Invalid role rejection
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, role)
     values ('TEST-REF-07', 'pilot', 'Test User', 'test@cladora.ro', 'ro', true, 'superadmin') $$,
  '23514',
  NULL,
  'invalid role throws check constraint violation'
);

-- 7g. Invalid building_type rejection
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, building_type)
     values ('TEST-REF-08', 'pilot', 'Test User', 'test@cladora.ro', 'ro', true, 'B1') $$,
  '23514',
  NULL,
  'invalid building_type throws check constraint violation'
);

-- 7h. Unique reference_id constraint
insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, submission_fingerprint, fingerprint_bucket)
values ('CLD-CUNIQUE01', 'contact', 'Test User 1', 'u1@cladora.ro', 'ro', true, 'fp-unique-01', 500);

select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy)
     values ('CLD-CUNIQUE01', 'contact', 'Test User 2', 'u2@cladora.ro', 'ro', true) $$,
  '23505',
  NULL,
  'duplicate reference_id throws unique constraint violation'
);

-- 7i. Atomic duplicate fingerprint bucket rejection (409 trigger)
select throws_ok(
  $$ insert into public.marketing_leads (reference_id, lead_type, full_name, email, locale, consent_privacy, submission_fingerprint, fingerprint_bucket)
     values ('CLD-CDUP02', 'contact', 'Test User 2', 'u1@cladora.ro', 'ro', true, 'fp-unique-01', 500) $$,
  '23505',
  NULL,
  'duplicate submission_fingerprint within same bucket throws unique constraint violation'
);

-- 8. Rate limit function parameter validation
select throws_like(
  $$ select * from public.consume_marketing_rate_limit('', 5, 900) $$,
  '%INVALID_ACTION_KEY%',
  'empty action key raises exception'
);

select throws_like(
  $$ select * from public.consume_marketing_rate_limit('test-key', 0, 900) $$,
  '%INVALID_MAX_REQUESTS%',
  'max_requests = 0 raises exception'
);

select throws_like(
  $$ select * from public.consume_marketing_rate_limit('test-key', 5, 0) $$,
  '%INVALID_WINDOW_SECONDS%',
  'window_seconds = 0 raises exception'
);

-- 9. Atomic rate limit window incrementation & boundary tests
create temp table rl_res1 as select * from public.consume_marketing_rate_limit('test-rate-key-01', 2, 900);
select ok((select allowed from rl_res1) = true and (select current_count from rl_res1) = 1, '1st request allowed, count=1');

create temp table rl_res2 as select * from public.consume_marketing_rate_limit('test-rate-key-01', 2, 900);
select ok((select allowed from rl_res2) = true and (select current_count from rl_res2) = 2, '2nd request allowed, count=2');

create temp table rl_res3 as select * from public.consume_marketing_rate_limit('test-rate-key-01', 2, 900);
select ok((select allowed from rl_res3) = false and (select current_count from rl_res3) = 3 and (select retry_after_seconds from rl_res3) > 0, '3rd request exceeding max=2 rejected with retry_after > 0');

-- 10. Timestamp maintenance trigger
update public.marketing_leads
set metadata = '{"updated": true}'::jsonb
where reference_id = 'CLD-CUNIQUE01';

select ok((select updated_at from public.marketing_leads where reference_id = 'CLD-CUNIQUE01') >= (select created_at from public.marketing_leads where reference_id = 'CLD-CUNIQUE01'), 'updated_at trigger fired and maintained timestamp');

select * from finish();
rollback;
