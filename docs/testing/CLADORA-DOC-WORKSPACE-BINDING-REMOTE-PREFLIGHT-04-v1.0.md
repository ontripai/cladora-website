# DOC-WORKSPACE-BINDING-REMOTE-PREFLIGHT-04

Status: proposed read-only preflight package; documentation only.

Owner: Documents & Vault.

Repository baseline: `main@8a240999083d150861b6b45c9c8671768f4783d0`

Repository tree: `7f029cdcd8359479bfd90d1cfeb7974bea13ac72`

Repository migration inventory: `258` SQL files.

Remote status: **`NOT_RUN_NOT_PASS`**.

This package describes a future connected, read-only inspection for the merged
Documents chain from PRs #396, #401, #403 and #406. It does not connect to a
Remote database, run the Supabase CLI, apply or repair a migration, change a
grant, backfill a row, activate a route/runtime, or alter the accepted resolver,
selector, writer, replay hook or NULL-creation closure.

The exact machine-readable artifact inventory is
[CLADORA-DOC-WORKSPACE-BINDING-REMOTE-PREFLIGHT-04-MANIFEST-v1.0.json](./CLADORA-DOC-WORKSPACE-BINDING-REMOTE-PREFLIGHT-04-MANIFEST-v1.0.json).

## 1. Repository truth and installation order

The live-main repository order is:

1. `20261013063739_document_reference_exact_workspace_v1.sql`
2. `20261014083050_document_workspace_binding_writer_v1.sql`
3. `20261014200948_document_null_workspace_creation_closure_v1.sql`

The first migration creates the nullable exact Workspace binding used by the
resolver and selector. The second creates the nullable intent binding and the
immutable rebind guard. The third closes every repository-backed creation path
that could otherwise insert a new NULL-bound document. Therefore migration 1
must precede migration 2, migration 2 must precede migration 3, and all three
must precede any future writer/selector consumer activation.

Replay validation and the selector add no migration. They consume the existing
Core `CoreTransactionScopeV1`, current-authority provider, provider-evidence
contract and replay hook directly. The accepted implementation remains inactive
unless a separately reviewed runtime composition activates it.

### File-byte hashes

| Artifact | Owner | SHA-256 of repository file bytes |
| --- | --- | --- |
| `supabase/migrations/20261013063739_document_reference_exact_workspace_v1.sql` | Documents & Vault | `988a8ddea361421cf6d75700ac3b0332c59ef0e10862201d2c2da0db48f91c51` |
| `supabase/migrations/20261014083050_document_workspace_binding_writer_v1.sql` | Documents & Vault | `1e7b64b5e623b9ca9f3eee43e1b41ac61f9fe9be008d1c59fa90e68d9ed3804d` |
| `supabase/migrations/20261014200948_document_null_workspace_creation_closure_v1.sql` | Documents & Vault | `5d8b2b6d68868001e7fdc6085c87aabe5568917d271a84192734c9643e8496e8` |
| `src/lib/customer/documents-reference-authority-v1.ts` | Documents & Vault | `207508432524698b701f5808d4b74ee4c007950d262c238dc7164f734f47b5b5` |
| `src/lib/customer/documents-workspace-binding-writer-v1.ts` | Documents & Vault | `33946d944b49eea1495bddca1979aa19f227694e533106c91d4ceed234f83c94` |
| `src/lib/customer/documents-reference-tx-selector-v1.ts` | Documents & Vault | `51d80abfd0fda5d005d7c54b734b2bc8e2a168a6d3d87b0e05050146fa7089c7` |
| `src/lib/customer/documents-ce012-reference-contract.ts` | Documents & Vault | `1c6cae9052fb8bb1910f88af4ef264dbd973c52fe81e5394e1527db4aa2d4b93` |
| `src/lib/core/current-authority-postgres-provider-v1.ts` | Core | `0703bd3a6268a9f86c321e714eb1a28ee791c4bf3c7747865c7576106247334a` |
| `src/lib/core/transaction-provider-evidence-v1.ts` | Core | `515c173f1fa1aeed01ef1af465acf8cee6504cc09bbcf3d137549a8150f32d75` |
| `src/lib/core/transaction-replay-provider-hook-v1.ts` | Core | `eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4` |
| `src/lib/core/postgres-transaction-host-v1.ts` | Core | `eb89d03320549a721a54df10fa747f8977d9f42f6dfaa2e85ae89e1265c37d7c` |

## 2. Expected installed state

| Surface | Expected state after the three migrations |
| --- | --- |
| `documents.documents.workspace_id` | `uuid`, nullable, no default; same-tenant composite FK and covering index |
| `documents.upload_intents.workspace_id` | `uuid`, nullable, no default; same-tenant composite FK and covering index |
| `documents.upload_intents.prospective_document_id` | `uuid`, nullable, no default; partial unique index when non-NULL |
| Intent checks | Workspace/prospective identity form a pair; a bound new-document intent cannot also name an existing document |
| Rebind function | `documents.reject_document_workspace_rebind_v1()`, owner `postgres`, SECURITY INVOKER, `search_path=pg_catalog` |
| Rebind trigger | `document_workspace_binding_immutable_v1`, enabled before UPDATE of `documents.documents.workspace_id` |
| Closure functions | `reject_unbound_new_document_intent_v1()` and `require_workspace_bound_document_insert_v1()`, owner `postgres`, SECURITY INVOKER, `search_path=pg_catalog` |
| Closure triggers | Two enabled intent guards and one enabled document INSERT guard |
| Guard function EXECUTE | No EXECUTE for `PUBLIC`, `anon`, `authenticated` or `service_role` |
| Table owner/RLS | Relevant canonical tables remain owner `postgres`; RLS remains enabled |
| Positive grants | None of the three Documents migrations adds a positive grant or policy |
| Resolver/selector output | Metadata/status only; no body, object path, hash, storage secret or unrelated permission row |

The live-main history also contains the separately owned Core role-bound pool.
Its narrow `cladora_ce_guide_executor` column grants and RLS policies are
canonical dependencies and must be inventoried as installed. They are not
created, widened or repaired by this package. Historical grants that predate the
Documents chain, including authenticated read policies and `service_role` or
`cladora_rpc_owner` access, must be reported exactly rather than silently treated
as new Documents grants.

Expected policy names relevant to the chain include the canonical
`documents_context_read`, `document_versions_context_read`,
`document_permissions_direct_deny`, `upload_intents_direct_deny`,
`phase3a_rpc_owner_documents`, `phase3a_rpc_owner_document_versions`,
`core_platform_owner_documents_read_v1`, and the
`core_platform_ce_document*` read/lock policies from live main. Name presence is
not sufficient: command, roles, `qual` and `with_check` must also match review.

## 3. Historical NULL invariants

- Existing `documents.documents.workspace_id IS NULL` rows remain present and
  unchanged. A nonzero NULL count is not itself drift.
- No migration supplies a default, derives Workspace from tenant/property,
  chooses a first Workspace, or infers membership.
- The exact resolver and selector deny historical NULL rows because their exact
  Workspace predicate cannot match NULL.
- The immutable trigger denies NULL-to-value, value-to-NULL and value-to-other-
  value updates.
- Existing unbound intents remain stored. An unbound historical new-document
  intent cannot be consumed after the closure migration.
- New document INSERT with NULL Workspace is denied before a row is written.
- Fresh writer validation requires an unconsumed exact intent. Exact replay uses
  `provider_current_state_required` and validates the consumed intent and exact
  committed result. A historical receipt without its replay marker fails closed
  as `PROVIDER_UNAVAILABLE`; there is no auto-upgrade.

## 4. Future connected preflight query pack

These statements are a reviewable package for a later, separately authorized
connected preflight. They were **not run** in this task. Run them only through an
approved read-only target identity and preserve the unedited result as evidence.

### 4.1 Establish and prove a read-only transaction

```sql
begin transaction isolation level repeatable read read only;

select current_database() as database_name,
       current_user as current_role,
       session_user as session_role,
       inet_server_addr() as server_address,
       inet_server_port() as server_port,
       current_setting('transaction_read_only') as transaction_read_only,
       current_setting('transaction_isolation') as transaction_isolation;
```

Stop unless `transaction_read_only = 'on'`, the identity and target match the
approved connected-dry-run ticket, and the transaction is still open.

### 4.2 Migration history presence and catalog digest

First prove the migration catalog shape:

```sql
select table_schema, table_name, column_name, data_type, udt_name, ordinal_position
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;
```

Then inspect the three required versions:

```sql
with expected(version, expected_name, dependency_order) as (
  values
    ('20261013063739', 'document_reference_exact_workspace_v1', 1),
    ('20261014083050', 'document_workspace_binding_writer_v1', 2),
    ('20261014200948', 'document_null_workspace_creation_closure_v1', 3)
)
select e.dependency_order,
       e.version,
       e.expected_name,
       (m.version is not null) as present,
       to_jsonb(m)->>'name' as installed_name,
       case when to_jsonb(m) ? 'statements' then
         encode(extensions.digest(
           convert_to(coalesce((to_jsonb(m)->'statements')::text, 'null'), 'UTF8'),
           'sha256'), 'hex')
       end as catalog_statement_digest
from expected e
left join supabase_migrations.schema_migrations m on m.version = e.version
order by e.dependency_order;
```

**Digest boundary:** `catalog_statement_digest` hashes the catalog's serialized
`statements` value. Supabase may split, normalize or store statements differently
from the migration file. It is useful for comparing two catalog observations,
but it is **not the SHA-256 of repository file bytes and cannot replace the
manifest file hash**. Installation approval needs both an exact reviewed file
hash and compatible target catalog evidence. Never declare byte identity by
comparing these unlike digests.

### 4.3 Columns, defaults and historical NULL inventory

```sql
select table_schema, table_name, column_name, data_type, udt_name,
       is_nullable, column_default, is_generated, generation_expression
from information_schema.columns
where (table_schema, table_name, column_name) in (
  ('documents','documents','workspace_id'),
  ('documents','upload_intents','workspace_id'),
  ('documents','upload_intents','prospective_document_id')
)
order by table_schema, table_name, ordinal_position;

select count(*) as document_rows,
       count(*) filter (where workspace_id is null) as historical_null_documents,
       count(*) filter (where workspace_id is not null) as bound_documents
from documents.documents;

select count(*) as intent_rows,
       count(*) filter (where workspace_id is null) as null_workspace_intents,
       count(*) filter (where prospective_document_id is null) as null_prospective_intents,
       count(*) filter (
         where document_id is null and workspace_id is null
       ) as historical_unbound_new_document_intents,
       count(*) filter (
         where document_id is null and workspace_id is null
           and (status = 'consumed' or consumed_at is not null)
       ) as historical_consumed_unbound_intents,
       count(*) filter (
         where workspace_id is not null and prospective_document_id is not null
       ) as bound_new_document_intents
from documents.upload_intents;
```

The queries count rows only; they do not select document content, storage paths,
hashes, titles or unrelated permission data.

### 4.4 Constraints and indexes

```sql
select n.nspname as schema_name,
       c.relname as table_name,
       con.conname as constraint_name,
       con.contype as constraint_type,
       con.convalidated,
       pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'documents'
  and con.conname in (
    'document_reference_workspace_tenant_v1',
    'upload_intents_workspace_tenant_v1',
    'upload_intents_workspace_prospective_pair_v1',
    'upload_intents_bound_new_document_v1'
  )
order by c.relname, con.conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'documents'
  and indexname in (
    'document_reference_workspace_tenant_v1_idx',
    'upload_intents_workspace_tenant_v1_idx',
    'upload_intents_prospective_document_v1_idx'
  )
order by tablename, indexname;
```

### 4.5 Function and trigger ownership, security and ACL

```sql
select p.oid::regprocedure::text as function_identity,
       pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_config,
       p.proacl::text as explicit_acl,
       encode(extensions.digest(
         convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'sha256'), 'hex')
         as catalog_definition_digest
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'documents'
  and p.proname in (
    'reject_document_workspace_rebind_v1',
    'reject_unbound_new_document_intent_v1',
    'require_workspace_bound_document_insert_v1'
  )
order by p.proname;

select n.nspname as table_schema,
       c.relname as table_name,
       t.tgname as trigger_name,
       t.tgenabled,
       t.tgisinternal,
       t.tgfoid::regprocedure::text as trigger_function,
       pg_get_userbyid(c.relowner) as table_owner,
       pg_get_userbyid(p.proowner) as function_owner,
       pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'documents'
  and t.tgname in (
    'document_workspace_binding_immutable_v1',
    'upload_intent_new_document_binding_required_v1',
    'upload_intent_unbound_consumption_denied_v1',
    'document_workspace_creation_guard_v1'
  )
order by c.relname, t.tgname;

select p.oid::regprocedure::text as function_identity,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       a.privilege_type,
       a.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) a
left join pg_roles grantee on grantee.oid = a.grantee
where n.nspname = 'documents'
  and p.proname in (
    'reject_document_workspace_rebind_v1',
    'reject_unbound_new_document_intent_v1',
    'require_workspace_bound_document_insert_v1'
  )
order by function_identity, grantee, privilege_type;
```

`catalog_definition_digest` has the same limitation as the migration catalog
digest: it fingerprints catalog-rendered text and is not a repository file-byte
hash.

### 4.6 Table owner, ACL, RLS and policies

```sql
select n.nspname as schema_name,
       c.relname as table_name,
       pg_get_userbyid(c.relowner) as table_owner,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       c.relacl::text as explicit_acl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'documents'
  and c.relkind in ('r','p')
  and c.relname in (
    'documents','document_versions','document_permissions','upload_intents',
    'document_links','document_audit_links','document_scan_attestations'
  )
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'documents'
  and tablename in (
    'documents','document_versions','document_permissions','upload_intents',
    'document_links','document_audit_links','document_scan_attestations'
  )
order by tablename, policyname;

select n.nspname as schema_name,
       c.relname as table_name,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       a.privilege_type,
       a.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(
  coalesce(c.relacl, acldefault('r', c.relowner))
) a
left join pg_roles grantee on grantee.oid = a.grantee
where n.nspname = 'documents'
  and c.relkind in ('r','p')
  and c.relname in (
    'documents','document_versions','document_permissions','upload_intents',
    'document_links','document_audit_links','document_scan_attestations'
  )
order by c.relname, grantee, privilege_type;

select table_schema, table_name, column_name, grantee, privilege_type,
       is_grantable
from information_schema.column_privileges
where table_schema = 'documents'
  and table_name in (
    'documents','document_versions','document_permissions','upload_intents',
    'document_links','document_audit_links','document_scan_attestations'
  )
order by table_name, column_name, grantee, privilege_type;
```

### 4.7 Default privileges

```sql
select pg_get_userbyid(d.defaclrole) as grantor_role,
       coalesce(n.nspname, '<all schemas>') as schema_name,
       d.defaclobjtype as object_type,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       a.privilege_type,
       a.is_grantable
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) a
left join pg_roles grantee on grantee.oid = a.grantee
where n.nspname in ('documents','customer_api')
   or n.oid is null
order by grantor_role, schema_name, object_type, grantee, privilege_type;
```

Any default privilege that would silently grant future Documents tables or
functions to `PUBLIC`, `anon`, `authenticated`, `service_role` or an unreviewed
role is a stop condition. Existing explicit grants are reported separately and
must not be confused with default privileges.

### 4.8 Legacy RPC and grant inventory

The retained legacy wrappers are expected to remain installed. New-document
creation through them is closed by the new intent/document triggers; removal is
not part of this package. Replacement-version behavior remains outside the NULL
creation closure.

```sql
with target(schema_name, function_name) as (
  values
    ('documents','create_upload_intent_internal'),
    ('documents','finalize_upload_internal'),
    ('customer_api','create_upload_intent_v1'),
    ('customer_api','finalize_upload_v1')
)
select n.nspname as schema_name,
       p.oid::regprocedure::text as function_identity,
       pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef as security_definer,
       p.proconfig as function_config,
       p.proacl::text as explicit_acl
from target t
join pg_namespace n on n.nspname = t.schema_name
join pg_proc p on p.pronamespace = n.oid and p.proname = t.function_name
order by n.nspname, function_identity;

with target(schema_name, function_name) as (
  values
    ('documents','create_upload_intent_internal'),
    ('documents','finalize_upload_internal'),
    ('customer_api','create_upload_intent_v1'),
    ('customer_api','finalize_upload_v1')
)
select p.oid::regprocedure::text as function_identity,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       a.privilege_type,
       a.is_grantable
from target t
join pg_namespace n on n.nspname = t.schema_name
join pg_proc p on p.pronamespace = n.oid and p.proname = t.function_name
cross join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) a
left join pg_roles grantee on grantee.oid = a.grantee
order by function_identity, grantee, privilege_type;
```

Expected boundary: the two `customer_api` wrappers are SECURITY DEFINER and
callable by `authenticated`; direct EXECUTE on the two privileged `documents`
internal functions remains withheld from `PUBLIC`, `anon` and `authenticated`.
The closure triggers, rather than a duplicate RPC or new authority interface,
deny new unbound creation.

### 4.9 Canonical execution roles and memberships

```sql
select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolcanlogin, rolreplication, rolbypassrls
from pg_roles
where rolname in (
  'postgres','anon','authenticated','service_role','cladora_rpc_owner',
  'cladora_ce_guide_executor','cladora_ce_guide_runtime'
)
order by rolname;

select member.rolname as member_role,
       parent.rolname as granted_role,
       grantor.rolname as grantor_role,
       m.admin_option
from pg_auth_members m
join pg_roles member on member.oid = m.member
join pg_roles parent on parent.oid = m.roleid
left join pg_roles grantor on grantor.oid = m.grantor
where member.rolname in ('cladora_ce_guide_executor','cladora_ce_guide_runtime')
   or parent.rolname in ('postgres','service_role','cladora_rpc_owner')
order by member_role, granted_role;
```

Stop on a login, superuser, `BYPASSRLS`, owner-membership or unexpected
`SET ROLE` path inconsistent with the reviewed Core role-bound pool.

### 4.10 End the preflight transaction

```sql
rollback;
```

Do not replace `rollback` with `commit`; the preflight must have no persistent
effect even if a future query is accidentally added incorrectly.

## 5. Preflight checklist

| Gate | Pass condition | Stop condition | Current status |
| --- | --- | --- | --- |
| Target identity | Approved target, database and read-only role match the ticket | Wrong/ambiguous target or identity | `NOT_RUN_NOT_PASS` |
| Transaction | Repeatable-read, read-only transaction proven before catalog access | `transaction_read_only` is not `on` | `NOT_RUN_NOT_PASS` |
| Repository candidate | Exact manifest commit/tree and file-byte hashes independently verified | Any file-byte hash mismatch | `NOT_RUN_NOT_PASS` |
| Migration catalog | All three versions present once and in order; names compatible | Missing, duplicate, reordered or unexpected identity | `NOT_RUN_NOT_PASS` |
| Digest interpretation | Catalog digest retained only as catalog evidence | Catalog digest treated as file-byte proof | `NOT_RUN_NOT_PASS` |
| Columns/defaults | Three nullable UUID columns exist with no default/generation | NOT NULL, default, generated value or inferred binding | `NOT_RUN_NOT_PASS` |
| Historical NULL rows | Counts recorded; rows remain untouched | Any plan to bind, update or hide the inventory | `NOT_RUN_NOT_PASS` |
| Constraints/indexes | Exact validated FK/check/index definitions present | Missing, invalid, unvalidated or semantically different object | `NOT_RUN_NOT_PASS` |
| Functions/triggers | Exact signatures, owner, invoker mode, search path and enabled triggers | Missing/disabled trigger, wrong owner, SECURITY DEFINER or unsafe search path | `NOT_RUN_NOT_PASS` |
| Function ACL | Guard functions have no unapproved EXECUTE | Positive EXECUTE for public/client/service roles | `NOT_RUN_NOT_PASS` |
| Table RLS/policies | RLS enabled; complete policy roles/commands/expressions match review | RLS disabled or policy drift/ambiguity | `NOT_RUN_NOT_PASS` |
| Table/column ACL | Explicit grants match live-main canonical role boundary | Unknown role, broader columns or grant option | `NOT_RUN_NOT_PASS` |
| Default privileges | No future implicit widening of Documents/customer API | Unreviewed default grant | `NOT_RUN_NOT_PASS` |
| Legacy RPC | Exact four routines and reviewed wrapper/internal boundary | Direct internal EXECUTE, signature/owner/search-path drift | `NOT_RUN_NOT_PASS` |
| Core roles | Canonical NOLOGIN/role membership graph, no owner escalation | Login, superuser, BYPASSRLS or unsafe membership edge | `NOT_RUN_NOT_PASS` |
| Metadata safety | Evidence contains catalog metadata and counts only | Content/path/hash/secret or unrelated permission disclosure | `NOT_RUN_NOT_PASS` |
| End state | Evidence saved, transaction rolled back, session closed | Any persistent action or uncertain transaction state | `NOT_RUN_NOT_PASS` |

## 6. Stop and rollback rules

1. Stop before catalog inspection if the target, identity or read-only setting is
   not exact. Do not request a broader grant from this runbook.
2. Stop on the first missing migration, hash mismatch, unknown later migration,
   schema drift, disabled trigger, unexpected owner, ACL/policy widening,
   ambiguous function overload, or incomplete catalog visibility.
3. Treat insufficient catalog permission as `evidence_unavailable`; do not infer
   a pass and do not elevate the connection.
4. Historical NULL counts are evidence, not a repair queue. Do not update,
   backfill, default, infer, rebind or delete those rows.
5. Execute `ROLLBACK`, close the connection and retain the raw read-only output.
   This is the complete rollback for a preflight because it performs no apply.
6. If a future installation has started or partially failed, this preflight is
   no longer a rollback mechanism. Stop the installer and require a new owner-
   reviewed forward recovery plan. Do not drop columns, constraints or guards;
   doing so could reopen NULL creation or rebind paths.
7. No output from this package authorizes `supabase db push`, Remote apply,
   migration repair, grants, backfill, runtime activation or Production action.

## 7. Evidence and limits

Repository paths, bytes and dependency order were read from the pinned live-main
tree. The package itself changes documentation only. No target schema, migration
history, owner, ACL, RLS policy, default privilege, row count, RPC, HTTP/AAL2 or
runtime state was observed. All connected and Remote rows therefore remain
**`NOT_RUN_NOT_PASS`** until a separate authorization permits the read-only
preflight and its exact results are reviewed.
