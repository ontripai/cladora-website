# SERVICE quote draft contract 013

The catalogue and non-binding request pilot is deployed and verified. This next package implements the input contract for drafting a versioned commercial proposal. It adds no live route, table, consent, order, payment or work order.

The command pins an existing request and its historical published catalogue revision, canonical context/workspace, scope, currency, exact total in minor units, payer shares, expiry and retry key. Supported currencies come from the existing currency registry. Amounts use canonical unsigned integer strings (up to 18 digits); BigInt sums preserve values above JavaScript's safe-integer range. Shares must sum exactly to the total; case-insensitive duplicate parties are rejected. Zero-cost proposals are valid. Unknown fields, including server identity, provider identity, status, version, acceptance and financial/execution references, are rejected.

The pure planner compares the server-read request workspace, identifier and historical revision, requires submitted status and rejects expired proposals. Editing the current catalogue must not silently replace the request's historical terms. This planner is not an authorization boundary.

Persistence follow-up must use canonical current SERVICE authorization and explicit provider/coordinator authority; resolve the provider from authorized server data and verify each referenced payer through the existing party registry. A payer reference is neither consent nor authority to act for that person. Store immutable proposal versions; never mutate earlier acceptances when scope, price or shares change. Validate tax treatment and presentation before exposing acceptance; no tax assumption is introduced by this draft contract. The total is the exact proposed payable total, with no floating-point rounding.

Use a locked request and the existing idempotency/audit/outbox transaction protocol. Drafting does not create a financial commitment. Acceptance requires separately verified authority of every affected payer against the exact proposal version and terms; execution and financial posting use the existing Operations and finance gateways. Those runtime flows remain to be implemented.

Changes are limited to SERVICE contract, behavior tests and its dedicated workflow. No core authorization, AIRPROP, Operations or existing migration is altered.
