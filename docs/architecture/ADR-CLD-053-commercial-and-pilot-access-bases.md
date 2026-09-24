# ADR CLD 053 Commercial and time limited pilot access

Status: implementation candidate, 2026-09-24

## Decision

Primary administrator access requires a recorded access basis. A PAID basis
references an active signed workspace contract and a manually verified CLADORA
subscription receipt: reference, amount, currency, paid date, paid through date,
and a human evidence note. Resident payments in payments.payments are not
subscription payments and are not eligible evidence.

A PILOT basis is available only for a PILOT workspace. The platform super
administrator records the prospective email, primary administrator role, reason
and 24, 48 or 72 hour duration. Recording does not create an Auth identity,
membership, invitation or email. The preparation expires after seven days if
unused, without consuming the pilot access period.

Only the verified holder of that email, with an AAL2 session, can activate the
prepared decision while the workspace is in PROVISIONING. Activation creates
the primary administrator membership and a tenant context grant. For PILOT,
both expire at the activation timestamp plus the approved hours. For PAID,
both expire at midnight in Europe/Bucharest after the paid-through date.
Early contract suspension or explicit revocation ends access sooner. No
automatic renewal occurs.

The controls on identity memberships and context grants cap subsequent
customer assignments in the same tenant to the active basis expiration. A
newly prepared basis is required before a workspace may enter PROVISIONING.
An existing membership must be reviewed before converting a tenant to a
time-limited pilot basis. Existing customer tenants are otherwise unchanged
until an access basis is prepared for them.

## Roles and boundaries

- PLATFORM_SUPER_ADMIN, with AAL2, records or revokes access decisions.
- The recipient has the canonical association_admin or property_manager
  role according to workspace type, not an internal platform operator role.
- The recipient must already have a verified Auth identity and MFA. This change
  does not create an account, confirm an email, send a verification message or
  send an invitation.
- The existing email invitation workflow is separate. An administrator should
  use the no-email access basis form when no invitation may be sent.
- A manual receipt attestation is not an automated bank reconciliation. The
  platform administrator must inspect external evidence before recording it.

## Endpoints

- Platform: GET/POST /api/platform/v1/workspaces/:id/access-bases,
  POST /api/platform/v1/workspaces/:id/access-bases/:basisId/revoke
- Customer: GET/POST /api/auth/workspace-access, /:lang/workspace-access
- The private table is not exposed through PostgREST. Caller checks run in
  both the application route and the database function. All mutations are
  recorded in audit.events.

## First pilot rollout

The initial ASSOCIATION pilot is currently in LEAD and its prospective
administrator does not yet have a verified Auth account. Preparing a decision
does not grant access. The account must be established and verified through a
separate authorized enrollment route before activation. Customer identifiers
and personal email addresses belong only in protected operational records.
