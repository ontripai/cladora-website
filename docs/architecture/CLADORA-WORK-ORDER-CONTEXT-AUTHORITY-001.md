# Work-order context authority — 001

The execution UI added in PR 243 uses established work-order APIs. The legacy implementations checked the caller's active context, base role, AAL2 and tenant, but did not enforce the order's exact physical scope or the canonical installed-module permission engine. The checklist gateway already enforced both.

A private `maintenance.assert_work_order_authority_v1` now supplements the existing checks in approve, issue, start, hold, complete, verify and close. It rejects unknown or foreign-tenant orders; matches the current context to property/building/unit; and evaluates the operation's original permission against the order's most specific scope using the canonical authority engine. It is called after the order is locked and before changes or audit writes. No authenticated or anonymous caller can execute the helper directly.

All seven established function bodies otherwise remain unchanged. Their existing grants, MFA, role restrictions, legal transitions, required checklist gate and independent procurement approval requirement remain intact. No role assignment, invoice, payable, payment or production fixture is created by this change. Procurement/payable creation paths are outside this change and need their own evidence before wider operational acceptance.

Validation: test 147 has 77 assertions for other property/building/unit contexts, unknown/foreign orders, zero audit on denial, creator self-approval denial, the authorized lifecycle, private helper, owner role denial, AAL1, expired contexts and a deactivated module despite the legacy entitlement remaining true. Tests 057 and 059 install taxonomy, property binding and module prerequisites in their isolated rollback fixtures; their existing assertions are retained.

Pilot work order 74 is already verified with both required checklist results and zero actual cost. It must not be issued or executed again for this change.
