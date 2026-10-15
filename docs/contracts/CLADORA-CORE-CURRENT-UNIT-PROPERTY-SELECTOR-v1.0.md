# CLADORA Core current unit/property selector v1.0

Status: inactive Core dependency candidate. No route, grant, Remote installation or
AIRPROP composition is included.

## Purpose

`selectCurrentUnitPropertyV1` closes the current-state dependency recorded by the
AIRPROP portfolio read gateway for unit-linked references. The selector verifies
that one unit still belongs to the requested property when the read occurs. A
write-time action-link receipt, earlier projection or historical authority receipt
cannot satisfy this check.

The selector accepts the existing `CoreTransactionScopeV1`, the canonical
post-lock authority receipt from that same transaction, and a strict request:

- exact Context, Workspace, actor and canonical authority revision;
- exact authority tuple `airprop.asset.read` / `airprop_commercial` /
  `airprop.current-unit-property.select`;
- exact transaction ID, command ID, attempt, and `portfolio.unit` aggregate lock
  whose aggregate ID is the requested unit;
- exact property and unit identifiers;
- contract version `core-current-unit-property-selector-request.v1`.

It returns `core-current-unit-property-selector-decision.v1`. Accepted decisions
contain only the requested identities, active lifecycle markers and
`current_unit_to_property=true`. Denials return no binding. Both outcomes are
`status_only`, have no source reference and set
`reusable_as_command_authority=false`.

## Canonical read and lock order

The receipt must exactly match every request field above. Its entitlement binding
is mandatory and must match the Workspace, module, and canonical authority
revision. A receipt for a different permission, module, purpose, command, attempt,
transaction, or aggregate lock is rejected before SQL. After the Core host locks
and current-authority recheck, the selector reads only through the supplied
transaction scope:

1. PostgreSQL transaction identity, serializable isolation and `auth.uid()`;
2. the canonical authority revision singleton with `FOR SHARE`;
3. the selected active Workspace, Context and Membership with `FOR SHARE`;
4. the current Workspace permission/module evaluator;
5. the effective Workspace-to-property binding with `FOR SHARE`;
6. the property with `FOR SHARE`;
7. the unit, its current building and current property with `FOR SHARE`.

The Context scope must cover the resulting tenant/property/building/unit chain.
Workspace suspension, Membership/Context revocation, revision drift, absent or
ambiguous bindings, wrong property, cross-Workspace data and any non-active
property/building/unit state fail closed. `40001` is not converted to an allow or
bounded denial; it reaches the Core host so the whole transaction can retry with a
fresh snapshot and authority recheck.

The shared row locks keep a successful result stable until transaction completion.
A concurrent unit move or lifecycle change therefore blocks, aborts serialization,
or is observed by a fresh retry. No convention-only advisory lock is treated as the
source of truth.

## Effects and ownership

The implementation issues only `SELECT` statements. It creates no idempotency,
audit, outbox, domain, snapshot, authority or receipt row and opens no transaction.
Core continues to own Workspace/Context/authority truth; Portfolio tables own the
physical ancestry. AIRPROP owns its mandate/action-link semantics and must compose
this selector without copying its contract or treating an accepted decision as
future command authority.

The package adds no migration. Future AIRPROP wiring still needs a reviewed
transaction host composition, execution role ACL/RLS, real HTTP/Auth/AAL2 evidence
and separate activation acceptance. The existing AIRPROP guard, read handler,
routes and production state remain unchanged.

## Targeted evidence

The static contract covers strict binding, denial redaction, historical receipt
rejection, read-only SQL and `40001` propagation. The disposable PostgreSQL harness
covers current allow, pre-read move, concurrent move, revoked Workspace binding,
revoked authority, cross-Workspace/wrong property, inactive/deleted unit, a real
serialization failure with a fresh attempt, and zero durable writes.
