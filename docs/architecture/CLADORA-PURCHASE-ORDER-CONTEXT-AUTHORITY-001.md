# Purchase order context authority

Legacy purchase-order commands verified active membership, base permission, AAL2 and tenant, but could act on another property/building/unit within that tenant. They also omitted canonical installed-module authorization.

The create, request, approve, issue and receive commands now call the existing private `maintenance.assert_work_order_authority_v1` guard against the linked work order. Existing-target commands lock the purchase order before checking authority and before mutations/audit; creation checks the target work order before insertion. This supplements the original permission checks without adding grants or changing gateway signatures.

Issuance retains the specific legacy `maintenance.purchase_orders.issue` permission and additionally requires canonical `maintenance.procurement.manage`. The issue permission has no canonical module binding; this patch uses the existing procurement management binding instead of creating new local-role or delegation capabilities. Approval uses canonical `maintenance.procurement.approve`; the other commands use canonical procurement management.

The forward lifecycle remains draft → requested → approved → ordered → received. Creator and requester cannot approve; independent approval, immutable approved records, timestamp and audit behavior remain intact. Purchase orders and vendor payables are not created in production to demonstrate this change.

The isolated PostgreSQL test covers all five commands across other-property, other-building, other-unit, unknown and foreign-tenant targets; audit-free denial; authorized lifecycle; independent approval; MFA; expired context; owner denial; deactivated module despite legacy entitlement; and the private helper. Existing 057/059 assertions remain unchanged. Payable creation and replay authority are a separate remaining review.

Synthetic work order 74 must remain verified at zero cost and must not be executed again.
