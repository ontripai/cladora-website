# Workspace role assignment completion

The roles dashboard now assigns an existing published workspace-ceiling role to an explicitly selected active membership. Candidate discovery returns only memberships with a current tenant context in the resolved workspace tenant. No workspace, member or role is selected automatically. The customer command validates every target through the canonical assignment table and its invariant trigger.

This completes the existing v1 administrative bootstrap interface. Its issuer still uses the established context-to-workspace resolver and existing base `workspace.role.assign` authority; this change does not convert tenant membership into workspace authority or introduce a second native grant store. The issued workspace assignment enables v2 native target discovery and the shared native permission engine. An independent workspace-native role-management bootstrap API remains outside this slice.

## Shared core behavior

- AAL2 and current issuer authority are required for candidate discovery, assignment and revocation. An explicit base-role deny overrides an allow.
- The tenant retry key is serialized before reading the existing command result. Retries check the current issuer again after the lock, and require the original actor, workspace, action and payload hash.
- Published role validity and active target membership/context are checked before a new workspace assignment.
- Future-expiring assignments can be revoked early. Revoked assignments cannot be reopened, extended or deleted; creator and scope fields remain immutable.
- Assignment and revocation record tenant-specific audit evidence and publish exactly one event through the existing shared outbox. Stored retries add no second row, audit or event.
- Requests are persisted in scoped session storage before submission. An uncertain response locks editing and retries the exact saved command. Storage failure prevents submission; unrecoverable saved state fails closed. Session storage does not survive closing the browser session.

## Verification

Compiled route tests cover query/payload injection, authentication, origin checking, MFA, exact RPC arguments and sanitized failures. Rendered UI tests cover explicit selection, published workspace ceiling, response loss, remount recovery, exact retry, MFA rejection after an uncertain outcome, success, foreign workspace responses, corrupt stored commands and RO/EN/FA labels.

The PostgreSQL fixture executes the canonical migration and invariant trigger with the shared native engine and AIRPROP functions. It covers active/expired issuer authority, actor/key conflicts, bounded assignment and early revocation, native discovery, authorized create/retry/read without a physical subject and cross-workspace denial. The real PostgreSQL variant checks an observed lock wait between independent connections. A separate pgTAP flow runs role creation, module/permission attachment, publication, assignment, AIRPROP create/retry/read and revocation against the complete migration chain.

## Event contract

| Event | Aggregate | Payload |
|---|---|---|
| `workspace.role.assigned.v1` | `workspace_member_role` | workspace, assignment, membership, role, scope |
| `workspace.role.assignment.revoked.v1` | `workspace_member_role` | workspace, assignment, membership, end timestamp |

Consumers must use the existing outbox delivery contract. An event is notification; every subsequent operation rechecks current canonical authority.
