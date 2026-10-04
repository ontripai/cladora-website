# AIRPROP internal acquisition decision 013

2026-10-04. Baseline main #250 includes SERVICE's published-offering request contract. Extends deployed #249 diligence without changing its immutable cases, submissions, Vault authorization, scanner, shared registry, SERVICE or Operations commands.

## Product behavior and execution ceiling

An explicit `airprop.acquisition.propose` action records a private internal proposal against the exact submitted diligence, immutable underwriting version and server policy 1. The rationale is bounded text; budget and results remain in the pinned existing evaluation, never in client-provided price/readiness flags. One proposal per submission; versions cannot be silently amended. The server sets a seven-day decision deadline.

Two distinct AAL2 actors with the separate nondelegable `airprop.acquisition.approve` action can record approve/reject decisions. Neither the proposer, diligence creator, any diligence revision author, submitter nor pinned evaluation author may review that proposal. One approval stays pending; any rejection is terminal; exactly two independent approvals produce `internally_approved`. Approvals are immutable historical decisions made under then-current authority, not evergreen grants or a closing authorization. Expired proposals cannot receive new votes. Changes require a new current evaluation/diligence baseline.

**This slice records an internal decision only.** Opportunity status remains `underwriting`; no signed contract, acquisition execution, right transfer, bank instruction, ledger posting, payment, external notice or country-pack activation is implemented or triggered. Internal decisions never authorize those later operations by themselves. No automated production approval is permitted by the existing automation matrix; only synthetic isolated fixtures invoke approvals during verification.

## Authoritative transaction and evidence

New append-only `airprop.acquisition_proposals` and `airprop.acquisition_decisions` use canonical foreign keys, RLS and no customer/anon/service-role direct table privileges. Private helpers are revoked; only three guarded authenticated RPCs are exposed. The module's exact permission manifest grows from seven to nine. The migration grants no membership, role, assignment, module or entitlement.

Mutations authenticate the current native workspace target and dedicated action, lock the opportunity then proposal, revalidate permissions after waiting, pin the actual submission/revision/policy/evaluation and check current verified clean Vault evidence with the requesting actor's explicit physical document context. They recheck the dedicated action after evidence lock waits as well. The same canonical scanner attestation, independent document verification, version/classification/scope, workspace property binding and Documents entitlement checks from #249 apply unchanged. Historical reads reauthorize evidence and display changed-baseline/expiry gates.

Each vote has an optimistic decision revision and unique actor/proposal identity. Competing votes serialize; a stale vote has zero partial effects. Audit, outbox and actor/content/resource-bound idempotency are atomic. Exact retries reauthorize current native and document access; completed votes return immutable original responses. Audit/outbox contain transition metadata, not rationale or document bodies. Rationale is shown only in the authorized private projection; identities/contact data are not included in vote history.

## Application surface

`/api/customer/v2/airprop/acquisition` GET/POST enforce strict envelopes, duplicate-free queries, authenticated claims, trusted mutation origin, JSON, a 16 KiB body ceiling, exact response scope/version and private/no-store responses. Clients cannot send actors, price, approval count, readiness, execution or ownership effects.

A standalone EN/RO/FA/RTL panel is mounted within the existing diligence review. Incomplete diligence, missing document access, stale sources, readonly access and expiry expose no decision form. Reviewers must explicitly choose approve or reject and supply a rationale. The exact pending command survives uncertain network results and remounts; corrupt/unavailable session storage blocks new writes. Definitive invalid input is editable; version conflicts refresh server state. Scope changes cancel/ignore late reads and writes; a parent baseline refresh hides old actionable controls. No approval is selected by default.

## Validation and release gates

Actual disposable native/Vault/AIRPROP migrations cover proposal/replay, authorship separation, one versus two approvals, terminal rejection, revoked permissions, expired proposal, changed document/evaluation, AAL1, cross-workspace denial, immutable history and closed ACLs. Real PostgreSQL uses two sessions for permission revocation after lock and competing votes against one expected revision. Full-chain transaction-wrapped pgTAP fixture 151 composes roles through canonical publish/assignment commands and independent Vault verification before dual decisions. Compiled actual-route and mounted actual React tests cover three locales, uncertain retries, strict payloads, wrong responses, stale scope/baseline, MFA and read-only completion.

Merge, exact-head CI, production migration identity, deployment SHA and live fail-closed UI must be verified separately. Pilot review/approval remains blocked without eligible independently verified evidence and separate authorized human reviewers; isolated success is not a production approval claim. The complete commercial lifecycle (agreements, rights, mandates, handover, finance and settlement) remains in later architecture slices.

Independent Operations #251 was incorporated before release validation; its payable migration and fixture 150 are preserved unchanged. AIRPROP uses a distinct fixture 151.
