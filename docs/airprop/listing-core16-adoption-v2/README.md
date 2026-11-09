# AIRPROP native Listing — Core16 coupling and binding ABI v2

Same AIRPROP-LISTING-NATIVE-01. Direct base/parent
`8ecbf41c8887983e788c6417c6248df68e999d34`; checkpoint retained, no rebase/merge.
Assignment: Page `page_9e19234d21b88191b17ef6685d75f153`, section
«سه producer جدید Core و ادامه موازی مصرف کننده ها», AIRPROP block
`5c8b61a4-c288-4fd2-b5b2-25f82f95d1ba`, sequence40 actually read with Viewer.
No Page writes. Coordinator owns central registration. Source-only successor;
Platform adoption and real UI/API/DB acceptance remain OPEN.

## Official producer consumed, not copied authority

Core input `ae1f370049302bca2cd6c771739f03a967db91a2`,
parent `5eeaeecef756fb1827deeb198deac5ee4fe657dd`, tree
`716c2d26f6858fc9df4fd660b9b7b50c6304ac49`.
Four dependency files are imported **byte-identically** from the official input:
Core read-host plus listing-ownership companion, queries and adoption query.
No Documents/SERVICE/shared transaction host/evaluator/writer delta is copied.
Original Core Auth ae1fe671 postimage stays unchanged.

`createListingCoreOwnershipReadV2` delegates directly to
`createCoreListingOwnershipCompanionV1().readCanonical`; it only validates and
carries the returned stored versions. No timestamp, Party, relationship, revision1,
label or permission is manufactured. Actual scoped serializable Core host and its
read-compatible selector still own source identity/waits/revoke/expiry/currentness.

The existing real Listing request-local resolver consumes this factory when
owned dependencies are supplied and `canonical` is omitted. Explicit `null` still
disables the producer; the product's default dependency resolver stays null.
No runtime pool/target/binding is activated by the source. GET receives complete
own-party read metadata; absent adoption/revision fails closed. Read result never
supplies action projections; ownership/asset.read is not manage/publish. No GET
uses command receipt/idempotency reservation/audit/outbox or any business mutation.

## Versioned ABI and history

`listingSelectionSchema` adds ONE optional, atomic member:

```json
{
  "source_versions": {
    "version": 2,
    "specification_id": "<actual Core specification UUID>",
    "resource_version": 4,
    "party_version": 6,
    "relationship_version": 2
  }
}
```

The numeric example is illustrative, not a source fallback. Values must be exact
positive safe stored revisions from Core. Resource and relationship versions must
match the rest of the same selection. Missing/NULL revisions never become1.
The selected-binding record adds `binding_version:2` and requires this tuple;
existing `spec_id/spec_version` must agree with its specification fields.
The current read mapper preserves it in the bounded selection, not private source
provenance/contact data. The UI still shows only existing safe labels, not raw IDs.

Historical records remain parseable without writing or backfilling. A record with
no v2 binding tag is `legacy`, independently readable and action-unavailable.
A v2 record with changed Party/spec/relationship versions is stale/invalid, not
adopted from current GET. Same-selection equality is now **symmetric** and compares
all nested versions, so a legacy subset cannot match a v2 command/receipt or allow
an exact retry under changed Party revision. Current binding and independent
current per-action manage authority are both required; current read alone gives0
allowed actions even with a stored matching v2 binding.

The HTTP command envelope and original AP01 payload/native parameters stay v1.
The optional selection extension is versioned metadata for **new** v2 commands;
old wire is never upgraded/re-serialized. Mixed old client deployment is not
claimed accepted: App must use this exact consumer source and QA profile together.

The existing journal schema/version/endpoint/custody is not changed. Legacy
UNKNOWN wire/key/fingerprint survive GET/current source/version changes and reload;
no fresh key, auto-POST, reconstructed original, storage deletion or receipt is
created. A historical receipt for a different selection does not settle v2.
A legacy command cannot freshly mutate through the v2 selected-binding writer;
it needs the genuine original-command/replay producer's explicit reconciliation
contract. Until delivered, that seam remains NOT_READY and the pending command
remains UNKNOWN. Do not downgrade recovery to invent a successful command.

## Writer and storage source

The same AIRPROP mutator still runs entirely inside its supplied existing C03
scope. For a new binding it requires original selection source_versions and exact
same management canonical source_versions/spec both before and after waits.
Changed Party revision stops before native write. A read-only Core companion is
rejected as management evidence. Host creates its actual receipt after mutate;
the domain returns mutation_id only and stores no synthetic receipt. Full original
wire/key/hash/command/transaction identity, effect order and rollback ownership
stay with existing C03. Prepared mapping and replay are not manufactured here.

`supabase/proposals/airprop_listing_selected_bindings_v2.sql` is a **complete fresh
schema source successor**, replacing the v1 candidate rather than stacking on it.
The physical table name is unchanged: no parallel ledger/ownership registry.
It requires numeric v2 tags and exact source tuple, includes Party revision in the
existing invoker subject guard, and retains all old RLS/FK/immutability/deferred
C03 receipt checks/revocations and unconditional55000 before DDL. It is NOT an
installer. No grants, policies, owner changes, Core source revision DDL or data
backfill. An already installed v1 table/history would require a separately reviewed
non-destructive ALTER/adoption; never DROP/recreate or run either guarded proposal.
Party.native_revision_v1 requires the actual Core reviewed adoption first.

The checkpoint8ecb preflight packet and all its files remain byte-identical and
valid only against its pinned v1 inputs. Its checks must not be blindly applied or
resealed as the v2 storage profile. This successor documents changed CHECK/body/ABI
inputs for Platform's future independently compiled v2 catalog/adoption. We do not
rerun its27accepted controls or fabricate a v2 installed/compiled profile.

## New tests actually run

`node scripts/test-airprop-listing-core16-adoption-v2.mjs` has14new affected groups.
Execution was targeted: first10passed; the initial SQL safety check matched a word
inside a comment. It was corrected to check SQL statement starts (no SQL/product
guard relaxed) and run alone. New publication/writer groups were run via `--only`;
those writer groups were repeated only after their source validation changed.
Receipt/selection group was extended and rerun alone after adding actual
matchesListingReceipt positive/negative assertions. No Core13 or old packet27,
MFA/recovery/sizing/Request/browser suite repeated for status.

- Actual resolver/API/Core read producer/host use controlled SDK/PG; exact versions
  reach GET with no command authority/effect. Missing actual revision/adoption
  remains503; no revision fallback.
- Owner read mapper handles v2 bound, legacy, stale and invalid; read evidence
  cannot become manage/publish even when the binding matches.
- Old journal retains exact original bytes/endpoint/key/hash and UNKNOWN after
  receiving new source. Versioned selection/receipt equality rejects legacy and
  wrong Party versions; new contradictory tuple rejects before dispatch.
- Actual mutator with synthetic management evidence stores full v2 selection on
  the identical supplied scope, returns no receipt; post-wait Party drift and
  read-only canonical evidence stop before native mutation. This is model transport,
  not actual management permission, C03 COMMIT, native constraints or RLS proof.
- V1 proposal pin stays unchanged; v2 remains guarded, no grant or history write.

Actual local cache: Next16.3.8/Zod4.4.3/TS5.9.3. Typecheck/scoped lint/syntax/diff
outcomes are in manifest; exact lock16.4.1/4.6.6 is NOT_RUN_NOT_PASS, no install.
SQL parsing/compilation/execution, real Auth/DB/role/RLS/locks/restart/browser and
native acceptance are NOT_RUN_NOT_PASS. No shared target connection or activation.

## Precise remaining inputs

1. Core's independent **manage/publish** prepared original-command mapping/replay
   and fresh post-wait authority/source_versions in C03. This own-party read
   producer is not that port. Runtime `command.prepareControl` remains missing;
   new publication HTTP/C03 wiring remains dependent, not presented as finished.
2. Platform actual Core revision/writer-closure adoption, exact query admission,
   limited table/function/schema/column ACL/RLS, compiled v2 metadata and real
   target custody. Neither Core's catalog check nor a JSON allow is native proof.
3. One authorized actual same-ID create/edit/withdraw/republish/readback/restart,
   denial/conflict/retry/concurrency run by Platform and independent QA acceptance.

Automation: نیازمند بررسی. Pins/version equality can be mechanically checked;
current authority/replay, installed writer custody and release acceptance stay with
existing owners. Guide/valuation/Documents/SERVICE do not block independent source.
