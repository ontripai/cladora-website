# CE012-OPS-01 — Experience Guide operational proposal

Owner: Community & Experience. Branch: `feat/ce-011-event-interest`. Draft PR: #318.
Status: technically complete and in_review; PostgreSQL/pgTAP and concurrency verification passed in disposable CI. No acceptance or release is claimed.

## Scope

This package adds a review-only persistence proposal, a bounded authenticated API and isolated tests for the existing CE012 Guide domain. A manager can create and revise a draft, then publish or cancel an exact Guide version. Eligible Workspace members can read published Guides. Guide activation is independent from Community, Events, Booking, SERVICE, delivery, payments and loyalty.

The package does not add a migration, install schema remotely, mount a customer page, create a document, or change central control documents. It reuses Core C01/C02 for current actor, membership, Workspace, module and permission decisions; `platform.idempotency_keys`, `audit.events` and `platform.outbox_events` remain the shared C03 infrastructure.

## Proposed mapping gate

`CORE-CE012-MAP-01` must confirm the proposed `experience_guides` v1 module, `module.experience_guides` entitlement and exact permissions `experience.guide.read` and `experience.guide.manage`. The proposal seeds none of these records. A missing live mapping raises SQLSTATE `55000`; the HTTP adapter returns `503 CE_GUIDE_CONNECTION_NOT_READY` and does not fall back to a Community, Event, Documents or SERVICE permission.

## Safe reference boundary

Operational v1 accepts only `document` references. The existing domain types for Event, Community, SERVICE and external URL remain future contracts and are rejected by this SQL boundary until their owners provide accepted resolvers.

- `DOCS-CE012-REF-01` asks Documents to review the use of its existing read-only `customer_api.get_documents_v1` gateway for exact reference authorization. CE does not copy document metadata, permissions or resource ownership.
- Create, revise and publish validate the referenced document through that gateway using the live session and Context.
- Guide lists return only a CE-owned opaque reference ID, type and author-supplied label. They do not expose a document ID, title, path, hash or signed URL.
- `resolve_ce_guide_reference_v1` releases the document ID only after current Guide visibility and Documents authority both pass. Revoked Documents authority, deleted/inactive records and broken IDs share a closed access result.
- A Guide with no reference works without Documents. External delivery and SERVICE are never prerequisites for the base Guide lifecycle.

## Persistence and concurrency

`experience.guides`, ordered steps, document references and immutable response receipts are tenant/Workspace bound. All tables have RLS enabled and direct `anon`, `authenticated` and `service_role` access revoked. Only the three bounded customer RPCs are granted to `authenticated`; private helpers remain closed.

Commands validate exact JSON keys, canonical UUID values, bounded content, strict audiences and JavaScript-safe expected versions. Every mutation locks the shared idempotency key before the Guide aggregate, rechecks live authority after waiting, and commits domain state, receipt, audit, outbox and shared-key result atomically. Revisions replace their ordered step/reference set in the same transaction. Outbox payloads contain only entity, command and version metadata.

## Verification

Executed locally on the changed code:

- existing CE012 domain acceptance: passed;
- compiled HTTP boundary: 55 checks passed with a mocked RPC boundary;
- TypeScript and targeted ESLint: passed;
- static database contract: 237 migrations / 165 test files / 5280 assertions;
- proposal/fixture byte comparison and `git diff --check`: passed.

Runtime evidence for the unchanged CE012 code at rebased code head `4b37fa99e9255c194fcc2f3edcc56e82ae082568`:

- [Database tests run 37924008670](https://github.com/ontripai/cladora-website/actions/runs/37924008670): CE012 plan 60 passed; the complete 165-file / 5280-assertion suite passed.
- [CE Community run 37924008676](https://github.com/ontripai/cladora-website/actions/runs/37924008676): domain and 55 HTTP checks passed; exact-key replay, competing revision, document becoming unavailable while publish waited, and membership suspension while replay waited all passed on real PostgreSQL connections.
- [Application Foundation run 37924008671](https://github.com/ontripai/cladora-website/actions/runs/37924008671): successful.
- Vercel Preview `dpl_Eygkbs8DwZ4SqvBN4bzRscFyENDq`, same code head, READY; target is Preview, not Production.

After parent PR #313 merged, Draft PR #318 was retargeted to `main` and the CE branch was rebased without content changes. Exact delivery head `a6f487b5dbf30f57218b39561fd790f56ac8d60a` is 18 commits ahead and 0 behind its `main` base. [Database tests run 37929468827](https://github.com/ontripai/cladora-website/actions/runs/37929468827), [CE Community run 37929468789](https://github.com/ontripai/cladora-website/actions/runs/37929468789) and [Application Foundation run 37929468777](https://github.com/ontripai/cladora-website/actions/runs/37929468777) all passed at that exact head. Vercel Preview `dpl_GNFCD873CP1ntj8wL7A78okiRxsz` is READY at the same SHA. The PR diff contains only CE-owned files and no central-control document or migration.

## Independent remaining gates

1. `CORE-CE012-MAP-01`: confirm the proposed Core module/permission mapping.
2. `DOCS-CE012-REF-01`: review the exact Documents resolver consumption contract.
3. `CE012-MIG-01`: separately authorize proposal conversion and installation. No migration file or installed remote version exists.
4. `CE012-UI-01B`: after `DOCS-CE012-REF-01`, connect a named Documents selector and reference navigation without exposing identifiers.

## CE012-UI-01A — safe read connection

The independent read slice mounts `/app/experience/guides` behind the existing `experience_guides` module, `module.experience_guides` entitlement and `experience.guide.read` permission. It derives the Workspace from the active server-returned dashboard context, validates the exact bounded RPC projection, and shows named Guide and reference labels in RO/EN/FA without displaying a Guide, Workspace, reference or document UUID.

The list deliberately consumes only the opaque reference ID, type and author-supplied label. It does not call the resolver automatically, construct a document URL, or expose `target_id`. A manager may read a draft but sees a view-only notice. Reference editing remains in `CE012-UI-01B` until `DOCS-CE012-REF-01` supplies an accepted named target selector and navigation contract; the base Guide read flow does not wait for that dependency.

An absent Remote RPC remains fail-closed as `503 CE_GUIDE_CONNECTION_NOT_READY`, while an inactive module or missing permission hides the menu and blocks the route. This branch contains no migration, Remote database action, module activation or Production configuration change.

Merge, Supabase Remote migration and Production deployment remain independent approvals. CI, Preview and a coordination receipt do not accept or close this package.
