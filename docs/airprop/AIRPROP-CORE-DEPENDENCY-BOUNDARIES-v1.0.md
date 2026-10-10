# AIRPROP Core dependency integration boundaries v1.0

**Owner:** AIRPROP consumer preparation
**Runtime providers:** Core/Platform
**Decision owner:** CLADORA Control & PM
**Status:** Consumer interface and test plan only; no provider contract or fixture is claimed

This register defines the minimum non-conflicting handoff points for three already-named AIRPROP dependencies. It does not invent provider fields, create an Auth identity, grant authority, register a Resource, activate a Workspace or report acceptance.

## 1. `AP10-AUTH-E2E-FIXTURE`

**Dependency owner:** CLADORA Control/Core test infrastructure
**AIRPROP state:** deterministic rendered integration is available in Draft PR #346; authenticated browser E2E remains blocked
**Required provider output:** a private, non-Production, resettable synthetic fixture exposed through the canonical Auth and Core paths

### Fixture interface required by the consumer

The provider chooses physical identifiers, setup APIs and credential bindings. AIRPROP requires only these observable capabilities:

1. A synthetic browser principal can establish a canonical AAL2 session without placing credentials in Git, test output or PR metadata.
2. The session can select two authorized Workspaces and exercise at least two named properties with multiple canonical unit references.
3. One property has a currently effective accepted AIRPROP management mandate and current Core `property_operations` authority; a second scenario can have that authority revoked between reads.
4. Existing Operations references are synthetic and resettable. No SERVICE order, Finance record, payment, journal or real customer data is created.
5. Setup/reset returns only opaque test references and bounded readiness/expiry metadata. Secrets remain in a private binding owned by the provider.
6. Teardown or reset is idempotent and proves the fixture is reusable without deleting production or shared test records.

AIRPROP will consume the delivered interface as-is. It will not create a parallel user/session store, generate a substitute AAL2 token or weaken application authorization for automation.

### Browser test plan after delivery

| Case | Required observation |
| --- | --- |
| AP10-E2E-01 | Canonical sign-in reaches AAL2 and loads the intended Workspace only. |
| AP10-E2E-02 | Two named properties and multiple unit-backed facts render without exposing Resource, unit, mandate or action-link UUIDs as labels. |
| AP10-E2E-03 | Workspace/context change clears selection and prevents labels or rows leaking from the previous context. |
| AP10-E2E-04 | Revoking current authority removes the property on the next read without a client-side fallback. |
| AP10-E2E-05 | AAL1, expired session and wrong-Workspace access fail closed with no AIRPROP or foreign-domain write. |
| AP10-E2E-06 | EN, RO and FA complete the same flow; FA uses RTL and no untranslated internal status. |
| AP10-E2E-07 | Reset/replay leaves one reusable fixture state and no duplicate mandate, authority or Operations fact. |

## 2. `AP-PF02`

**Exact dependency name already recorded by AIRPROP:** Accepted Core Resource snapshot, relationship and authority contract
**Dependency owner:** Core/Platform for delivery; CLADORA Control & PM for acceptance
**AIRPROP state:** consumer boundary ready; runtime mapping must not begin until the exact accepted Core revision is named

### Semantic consumer interface

Core/Platform owns the physical schema, versioned contract name and authorization implementation. The accepted output must let AIRPROP consume, without inference:

- one stable canonical Resource reference and its exact snapshot/version;
- a safe user-facing Resource name separate from transport identifiers;
- the current natural-person or legal-entity party relationship, including representative validity and revocation semantics;
- the exact Workspace/context target to which the relationship applies;
- a current server-side authority result for the requested AIRPROP read or action, including denial after role/mandate revocation;
- effective/as-of and provenance metadata sufficient to reject stale or mismatched mappings;
- a compatibility reference for existing AIRPROP identifiers/APIs without silently rewriting history.

Field names, RPC names, tables, roles and permission codes are deliberately unspecified here. AIRPROP will bind only to the PM-accepted Core contract and will not persist a second Resource, Party, relationship, authority, role or grant registry.

### `AP-PF02` test plan after acceptance

1. Natural-person owner, legal-entity owner and currently valid representative resolve to the expected existing AIRPROP subject.
2. Expired/revoked representation and revoked software role are denied independently.
3. A Resource visible in one Workspace does not become visible or actionable in another without the accepted Core authority result.
4. A stale Resource or relationship version conflicts; it is not silently refreshed into a write.
5. Historical AIRPROP identifiers remain traceable through the accepted compatibility mapping.
6. UI and request contracts use names/selections and never require the user to type a UUID.
7. Denial, stale version and malformed provider response create zero AIRPROP, audit, outbox, Listing, reservation or Finance effects.
8. Exact retries preserve the accepted Core version and current-authority recheck defined by that contract.

## 3. Dynamic Resource read model

**Exact dependency name:** `AP-PF02`, completed against the PM-accepted Core contract
**Dependency owner:** AIRPROP for `AP-PF02`; Core/Platform for contract delivery; CLADORA Control & PM for contract acceptance
**AIRPROP state:** planned, not started

After the Accepted Core Resource snapshot, relationship and authority contract is accepted and `AP-PF02` passes its consumer tests, AIRPROP may implement the first read-only dynamic Resource projection. It must preserve the published commercial baseline and validate current Workspace authority server-side. It may aggregate only Resources allowed by the accepted contract and must not use a management document, valuation result or historical membership as software authority.

The read model must test current allow/deny, revoked relationship, stale snapshot, multi-Workspace isolation, named display, compatibility mapping and zero-write behavior. A later Listing action remains a separate command and is not implied by read visibility.

## Hard stops

- No guessed Core payload, RPC, table, role, permission or fixture credential.
- No Auth, Secret, Production configuration, real user or real customer data creation.
- No parallel Resource, Party, relationship, authority, audit, outbox or ledger implementation.
- No claim that CI, a receipt or this interface plan is provider delivery, PM acceptance or package completion.
- No Dynamic Resource implementation before accepted Core revision and successful `AP-PF02` consumer verification.
