# CE multi-country content policy 01

Status: **discovery complete; contract and provider deltas required before implementation**

Owner: Community & Experience, with canonical jurisdiction ownership retained by Core

Baseline: `main@f6ca01378f1f56f4c4233b69777f04704db053b9`
(`tree 061e5666b1be6b014494a36237757bdee6bfa515`)

This document fixes the boundary between presentation locale, Guide content and
the governing jurisdiction of a property. It contains no country-specific law,
tax rule, compliance instruction or professional advice. It does not activate a
Country Pack or Guide editor.

## Binding decisions

1. Locale and language are presentation inputs. They never select, infer or
   change a country, jurisdiction profile, currency, law or tax treatment.
2. Governing country is property-specific. It comes from the explicit property
   address and its current canonical property-jurisdiction assignment, selected
   through Core. It does not come from actor locale, Guide locale, Tenant,
   Workspace, IP address, timezone, currency or postal-code shape.
3. A Workspace and an actor may manage properties in several countries at the
   same time. There is no Workspace-wide governing country fallback.
4. A jurisdiction-specific Guide content revision must bind one exact property
   and the current versioned Country Pack evidence for that property. A Guide
   that spans unrelated properties cannot claim one inferred jurisdiction.
5. A Country Pack/profile and its domain artifact are evidence inputs only.
   They do not grant CE permission, create actor authority, approve Guide text,
   or provide legal signoff for a Guide. Existing Core decisions explicitly use
   `reusable_as_command_authority=false`.
6. A translation is a localized rendering of one content revision. Translating
   Romanian content into English or Persian does not move it to another country,
   make it valid under another country's law, or inherit a new legal meaning.
7. Jurisdiction scope, disclaimer, content review dates and source provenance
   are immutable parts of the Guide content revision. Changing any one creates
   a new positive content version; it cannot patch a published revision in
   place.
8. Jurisdiction-specific publication and read projection fail closed when the
   exact Country Pack/profile or required domain evidence is absent, inactive,
   stale, expired, ambiguous, cross-Workspace or no longer current.
9. Guide visibility never grants access to the property, Country Pack source,
   document, message, service or other destination referenced by the Guide.
10. Unpublish remains available to an authorized CE manager after Country Pack
    or source access is lost, because removing visibility must not depend on
    continued target disclosure.

## Repository inventory

The live repository contains 259 migration files. Repository presence is not
evidence of Remote installation or production acceptance.

| Area | Existing canonical artifact | Observed boundary | Owner |
| --- | --- | --- | --- |
| Property country | `portfolio.addresses.country_code` and canonical Workspace/property binding | Country is explicit ISO alpha-2 input; no locale/default inference. One Workspace can bind properties from several countries. | Portfolio/Core |
| Jurisdiction registry | `platform.jurisdiction_profiles`, `jurisdiction_profile_domains`, and `property_jurisdiction_assignments` from `20261015183000_core_jurisdiction_profile_v1.sql` | Immutable versioned profile/domain hashes, effective periods, property assignment and pack-level legal/accounting signoff. No country rows are seeded or activated. | Core / Country Pack governance |
| Jurisdiction contract | `core-jurisdiction-profile.v1` and `core-property-jurisdiction-evidence.v1` | Strict country/profile/version evidence; locale is absent; output is not command authority. | Core |
| Transaction selector | `selectCurrentPropertyJurisdictionProfileV1` and `core-jurisdiction-profile-selector-decision.v1` | Runs inside an existing Core serializable transaction after current-authority recheck; property must be source-locked; missing/stale/revoked/cross-Workspace/domain-incomplete state denies. | Core |
| Guide aggregate | `experience.guides`, `guide_steps`, `guide_references` | CE owns Guide identity, Workspace, content/lifecycle versions and immutable document references. The store has no property, locale, Country Pack, disclaimer, review date or provenance binding. | CE |
| Guide authority/lifecycle | `experience.guide.manage`, CE lifecycle provider and Core transaction host | Current CE authority governs publish/unpublish. It cannot be replaced by jurisdiction evidence. | CE consuming Core authority |
| Guide audience | Workspace, role or membership audience | Audience determines eligible readers inside the CE boundary. It is neither property scope nor jurisdiction. | CE |
| UI locale | RO/EN/FA component strings | Current locale support localizes application labels. Stored Guide title/body are not modeled as versioned translation variants. | CE |
| Documents references | Immutable Documents selector and Guide reference rows | Validates a destination independently. It cannot serve as Country Pack selection or legal approval. | Documents |
| Shared effects | Core idempotency, receipt, audit and outbox | Remain the only transaction and durable replay ledgers. No CE country-content ledger is required. | Core/shared infrastructure |

### Frozen artifact inventory

| Artifact | SHA-256 on the baseline |
| --- | --- |
| `src/lib/core/jurisdiction-profile-v1.ts` | `70781991127452ce50f7b6974f6c68edd06508ab2ac13366001c162873438487` |
| `src/lib/core/jurisdiction-profile-selector-v1.ts` | `279c75fc6b0401836fbad5268fcc6ca5b51a16878b2d712f1502adda25b268ad` |
| `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql` | `924b577b18e6e70d149272e3f193c23d4c5d83db81b2f1f3b51950e0d1ce74c7` |
| `src/lib/community/experience-guide-schema.ts` | `bcf1b99312a1efac49e4868871ef662d882972f72dc167907da55cb26cb95984` |
| `supabase/migrations/20261014082947_experience_guide_storage_lifecycle_v1.sql` | `5d951a6938d8737041c6c7272f2dc40d1abe289d005afc85a7c871330116a0e5` |

## Proposed content contract mapping

The names below are discovery identifiers for owner review. They do not create
runtime or database contracts in this package.

### `ce-guide-content-policy.v1`

One immutable policy record belongs to exactly one `(guide_id,
content_version)` in the existing CE aggregate lineage.

| Field group | Required binding | Boundary |
| --- | --- | --- |
| Aggregate | Guide ID, Workspace ID, positive content version and policy version | Must match the existing CE Guide row and immutable content children. No second Guide identity or store. |
| Scope kind | `general_non_jurisdictional` or `property_jurisdiction` | General content carries no country/profile claim. Jurisdiction content requires one exact property. |
| Property scope | Property ID for `property_jurisdiction`; otherwise null | Server-derived or owner-selected under current authority. Locale cannot populate it. |
| Country Pack evidence | Assignment ID/version, profile ID/code/version, country code, profile manifest hash and the owner-approved content-domain contract/artifact hash | Copied only from an accepted Core selector decision. Pack legal/accounting signoff proves profile activation prerequisites, not approval of the Guide text. |
| Disclaimer | Stable disclaimer code, positive disclaimer version and immutable localized artifact hash | Required for every published variant. It describes informational limits and never replaces professional review. |
| Review window | Content reviewed-at and review-due/expiry timestamps plus an internal review record reference | Dates are part of the content version. Review status grants no actor permission and is not exposed as legal signoff. |
| Provenance | Positive provenance version and ordered immutable source descriptors/hashes | Sources are attributable and versioned. Raw private references, legal-review notes and credentials do not enter public Guide or receipt evidence. |
| Safety flags | `reusable_as_command_authority=false` and status-only public disclosure | A content decision cannot be replayed as authority, entitlement or target access. |

The exact Country Pack domain identifier for Guide content is not yet owned by
CE and must be approved by the Core/Country Pack governance owner. CE must not
invent a domain code or accept an arbitrary client-supplied one. Until that
contract exists and is active in the selected profile, jurisdiction-specific
Guide publication remains unavailable.

### `ce-guide-localized-variant.v1`

Each variant binds the same Guide/content version and policy record, a bounded
BCP 47 locale, a positive translation version, source-locale/content hashes,
translated-content hash, disclaimer code/version and review window.

- Locale has no `country_code` output and cannot select a Country Pack.
- A translation retains the source revision's jurisdiction scope and exact
  profile binding. A change of property/profile requires a new Guide content
  revision, not a translation update.
- Translation review confirms fidelity and readability only. It does not claim
  that another country's law applies and does not copy pack legal signoff into
  CE evidence.
- A missing, stale or expired localized disclaimer/review record makes that
  variant unavailable. It does not fall back to a different locale's country.
- A caller may receive an explicitly selected safe fallback language only when
  the same content-policy binding remains exact and the UI identifies the
  displayed language. Fallback never changes jurisdiction.

### Core selector consumption

For future property-jurisdiction publication, the Guide ID, exact property ID
and every immutable target ID must be in `provider_source_ids`. After current
CE authority is accepted, the provider calls the existing Core selector in the
same transaction for the exact property and the governance-approved content
domain. It must bind Context, Workspace, actor, authority revision,
transaction, command and attempt.

The CE provider may persist or emit only bounded profile identity/version and
artifact hashes needed for replay. It must not copy property address, postal
code, legal/accounting signoff references, source documents, private reviewer
notes or authority rows into a public receipt.

Exact publish replay must reselect current Country Pack state. A later profile
suspension, assignment change, expired domain, revoked authority or expired
content review blocks replay disclosure with zero additional writes. Fresh
unpublish and exact unpublish replay remain target-free.

## Required implementation packages

| Future package | Minimal responsibility | Owner |
| --- | --- | --- |
| Country-content domain contract | Approve one canonical profile-domain identifier and artifact contract for Guide content; define pack provenance and effective-period evidence without embedding legal rules in CE. | Core / Country Pack governance with Documentation & PM review |
| CE content-policy contract | Strict schemas for immutable scope, disclaimer, review and provenance metadata; reject locale-country inference and client authority fields. | CE |
| CE persistence delta | Append-only policy and localized-variant children keyed to existing Guide/content version. Extend existing Guide guards and version transitions; do not create a second Guide store or receipt ledger. | CE |
| CE publish/replay provider integration | Consume the existing Core selector after CE authority, bind exact property/profile/domain and emit bounded independent CE evidence. | CE consuming Core |
| Read-time jurisdiction eligibility port | Recheck current property/profile/domain and content review state for a read projection without fabricating a command or reusing command evidence as authority. | Core owns current jurisdiction evaluation; CE owns Guide read policy |
| Translation workflow | Version translation input/output, disclaimer and review metadata while preserving the source jurisdiction binding. | CE / Documentation |
| UI presentation | Display locale, jurisdiction scope, disclaimer, last review/due date and safe source provenance without suggesting professional advice or target access. | CE after separate activation approval |

The current transaction selector requires a Core command and authority receipt;
it must not be called from a read route through a fabricated command. A
read-safe current-state port is therefore a real dependency before serving
jurisdiction-specific published Guides.

## Future test matrix

| Area | Required scenarios | Expected result |
| --- | --- | --- |
| Locale separation | RO, EN and FA variants for properties in different countries; actor locale differs from property; locale changes mid-session | Same property/profile binding; no country inference or mutation |
| Multi-country Workspace | Two properties in one Workspace with different explicit countries and active profile revisions; one actor manages both | Each command selects only its exact property profile; no Workspace-wide country cache or fallback |
| Cross-Workspace scope | Same actor has several Workspaces; property/source lock belongs to another Workspace | Bounded denial, no existence disclosure and zero writes |
| General content | General Guide in multiple locales with no property/profile fields | Publishable only as non-jurisdictional content with versioned disclaimer/review/provenance; no country claim |
| Missing Country Pack | Property unassigned, profile missing/inactive/suspended/retired, required domain absent or no approved content-domain contract | Fail closed before Guide/shared-ledger mutation |
| Stale/expired state | Assignment/profile/domain version changed; effective period or content review expired; stale disclaimer/provenance version | Publish/read/replay denied with zero additional writes |
| Translation fidelity boundary | Translation retains source property/profile; tries to replace country/profile or omit disclaimer; beneficiary changes UI locale | Valid translation keeps exact scope; altered/missing binding denied |
| Current authority | Manage permission/module current, revoked membership, stale authority revision and read-only role | Only current CE manage authority can publish; Country Pack evidence never grants permission |
| Concurrency | Publish races profile suspension/domain retirement, content revision or review expiry | Serializable/lock-safe single outcome; denial has zero additional domain, idempotency, audit or outbox effects |
| Exact replay | Same key/content after unchanged state; changed content/policy; profile or review later invalid | Exact unchanged replay returns original receipt; changed/current-invalid state blocks disclosure without new effects |
| Unpublish | Pack/domain/source access lost after publication | Authorized unpublish succeeds without Country Pack/target disclosure and without deleting history |
| Read projection | Current audience can read Guide but not property source or referenced destination; profile becomes invalid after publish | Guide response exposes bounded content metadata only; target stays denied; invalid jurisdiction content disappears fail-closed |
| Privacy | Receipt/evidence inspection across accepted and denied paths | No address, postal code, signoff reference, source body, reviewer note, membership ID, permission row or credential leakage |
| Version guards | Mutate disclaimer, review date, scope, provenance or translation without advancing content/translation version | Database/contract denial; immutable prior revision remains intact |
| Genuine failures | Real PostgreSQL `40001`, provider unavailable and acknowledgement loss | Core retries in a new transaction; unknown commit uses guarded readback; no blind second mutation |
| Presentation | Mounted RO/EN/FA views, fallback language and RTL | Language is explicit; disclaimer/review/scope visible; no legal/tax claim and no jurisdiction switch |

All denial cases must snapshot Guide policy/variant rows and the canonical Core
idempotency, audit and outbox ledgers to prove zero additional writes.

## Acceptance and activation boundary

This discovery establishes contract ownership and identifies the required
delta. It does not prove any country's legal requirements, tax treatment,
Country Pack correctness, professional review, Remote DB installation,
Production read eligibility, HTTP/AAL2 behavior or UI acceptance.

Until the owner-approved content domain, CE versioned metadata, Core read-time
eligibility port and host-level tests exist, a Guide without a current exact
Country Pack binding or with expired content references remains fail-closed.
The current production boundary remains `commands=null` and `can_edit=false`.
