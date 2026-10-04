# Maintenance payable context authority

Legacy payable creation checked the active caller, tenant, AAL2 and the dedicated financial permission, but omitted physical work-order scope and canonical installed-module authorization. Its tenant-level idempotency lookup could return a saved payable for another work order before checking the requested target.

Creation now supplements the original `finance.payables.create` check with the existing private work-order guard using canonical `maintenance.procurement.manage`, before the idempotency lookup and again after locking the work order. The financial permission has no canonical module binding; this change uses existing procurement authority without adding grants, local-role capabilities or delegation bindings.

Replay checks authority against the saved payable's actual work order before returning financial identifiers/amounts, and rejects a key associated with a different requested work order using `payable_idempotency_work_order_mismatch` (22023). Matching authorized replays retain their existing response and create no journal, cost or audit. This binds the key to the work order; it does not introduce a full payload-fingerprint contract.

Verification, closed-period protection, linked purchase-order validation, account scope/type checks, balanced journal posting, invoice/work-order uniqueness, and audit remain unchanged. The current live source hash was matched to repository source before replacing the function; its grants/signature are preserved.

The isolated pgTAP test covers scope/tenant denial, unverified work orders, no financial side effects on denial, real balanced posting, same-order replay, authorized-target key mismatch, saved-target scope enforcement, MFA, expired context, owner denial, the dedicated financial permission and deactivated modules. Existing 057/059 remain regression gates. No financial operation is executed against production to demonstrate this patch; work order 74 remains verified with zero cost.
