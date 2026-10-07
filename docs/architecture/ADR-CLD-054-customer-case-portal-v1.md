# ADR-CLD-054: Customer case portal from first contact to active workspace (v1)

Status: Candidate for staged release. Supersedes no earlier ADR.

## Context

Public contact and pilot submissions create `marketing_leads`. The operational
start-request inbox is internal. Tenant communications (ADR-CLD-043) and the
document vault (ADR-CLD-044) need an active workspace; neither can safely grant
pre-contract prospects access. Email addresses in public forms are unverified.

## Decision

Create one durable customer case per lead, independent of any tenant or workspace.
Case IDs survive qualification, contract review, pilot, paid activation and
ongoing support. A case may later reference a workspace and contract; linking
does not copy messages, expand permissions or create workspace membership.

Case invitation is a non-bearer pointer. It only becomes usable after an
authenticated user with a verified, matching email explicitly accepts it with
MFA (AAL2). A forwarded link alone grants nothing. Existing accounts can accept
without creating a second identity. No public endpoint can list cases by email.

Staff access is case scoped: Super Admin and Operations may supervise; the
salesperson assigned to the originating lead can work on it while the sales role
is active. Specialists require a matching active specialist role and explicit
case assignment. One account may hold several platform roles. The customer sees
only shared entries and files for cases where they are an active participant.
Internal notes and unread external notification payloads cannot be projected
to customers. Every write is authenticated, audited and append only.

## Stage boundaries

| Stage | Deliverable | Release gate |
| --- | --- | --- |
| 1 | Case, verified invitation, scoped participants and customer portal | No email address lookup authorization; accept requires matching verified account and AAL2 |
| 2 | Two-way messages and internal notes, read markers | Cross-case isolation and immutable history |
| 3 | Private file bucket, versions, explicit shared/internal visibility | Content-type/size validation, quarantine and independently attested manual scanner verdict before either party downloads |
| 4 | In-app unread indicators and optional external nudges | In-app unread notices ship first; external delivery stays disabled until opt-in and provider credentials are configured |
| 5 | Explicit references to signed contract and workspace | Commercial checks stay in the existing contract and access-basis workflow; linking never provisions access |

Outbound email or WhatsApp remains optional notification delivery only. An
authentication invitation email is allowed to establish the account; business
messages and documents remain in the case portal. WhatsApp requires a separately
configured provider and customer opt-in before use.

Document review is currently manual and requires a different AAL2-authenticated
Super Admin or scoped Auditor from the uploader. Reviewers must enter evidence
from an independent malware scan. The database cannot attest that an external
scanner was run; all new files stay quarantined and un-downloadable until a
reviewer records that verdict. Automated malware scanning is a later integration.

Existing tenant communications and document vault remain independent after
linking: customer case access never grants access to tenant data. Archive and
retention policy must cover both internal and shared case history; deletion by
individual participants is disallowed. Service-side export and legal hold are
follow-up controls before treating the portal as an authoritative archive.
