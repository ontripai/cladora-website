# CLADORA SERVICE Money Normalization v1.0

Status: inactive contract evaluator

Owner: SERVICE

Implementation: `src/lib/customer/service-money-normalization-v1.ts`

## Boundary

`service-money-normalization-request.v1` converts an explicitly named currency amount between a
decimal string and integer minor-unit string. The evaluator is pure, deterministic, and has no
durable-write port. It consumes the accepted `core-jurisdiction-domain-artifact.v1` schema and its
artifact hash function directly. It does not import or depend on the jurisdiction artifact resolver.

This evaluator does not select a payment rail or provider, create a payment intent, read credentials,
perform I/O, or activate a route. Its decision always reports `durable_writes: 0`,
`rail_selected: false`, `provider_selected: false`, and `payment_intent_created: false`.

## Request and artifact

The strict request contains:

- `contract_version = service-money-normalization-request.v1`
- `operation = decimal_to_minor | minor_to_decimal`
- an explicit three-letter uppercase `currency_code`
- an amount encoded as a bounded ASCII string
- an offset-aware `effective_at` timestamp

The caller supplies a `core-jurisdiction-domain-artifact.v1` value whose domain is exactly
`payments.policy` at `payments-policy.v1`. The evaluator verifies the accepted schema, SHA-256,
active/effective interval, and completed legal and accounting reviews. It then selects exactly one
currency entry by the request currency. Missing currency, exponent, rounding mode, or increment is a
bounded denial. There is no RON, locale, country, reporting-currency, or global-currency fallback.

The evaluator reads only these currency-policy fields:

- `currency_code`
- `exponent`, an integer from 0 through 6
- `rounding_mode = half_even | half_up | down | up`
- `increment_minor_units`, a positive safe integer

Although the accepted payment artifact also contains rails, this evaluator neither reads nor returns
a rail. Artifact acceptance here is normalization evidence and is not command authority.

## Exact arithmetic

All amount conversion uses integer `BigInt` arithmetic. JavaScript `Number` floating-point parsing,
rounding, multiplication, and formatting are excluded.

For `decimal_to_minor`, the exact decimal rational is scaled by `10^exponent`, divided by the policy
increment, rounded once, and multiplied back by the increment. Modes have these meanings for both
signs:

- `half_even`: nearest increment; an exact tie chooses the even increment quotient.
- `half_up`: nearest increment; an exact tie goes away from zero.
- `down`: toward zero.
- `up`: away from zero when a remainder exists.

For `minor_to_decimal`, input is a strict integer string. It must already be a multiple of
`increment_minor_units`; the evaluator never silently changes stored minor units. Decimal output has
exactly `exponent` fractional digits, except exponent zero, and negative zero is canonicalized to zero.

The absolute accepted minor-unit magnitude is at most 38 decimal digits. A greater result is
`AMOUNT_OVERFLOW`. Decimal syntax rejects whitespace, separators, exponent notation, `NaN`,
`Infinity`, a leading plus, incomplete fractions, and noncanonical leading zeroes.

## Bounded decisions

An accepted `service-money-normalization-decision.v1` carries the operation, currency policy,
canonical decimal, minor-unit string, and verified artifact hash. A denial returns none of the
artifact or normalized amount. Denial reasons are limited to malformed input, invalid or unavailable
artifact/policy, hash/status/effective/review failure, invalid amount syntax, increment mismatch, and
overflow.

No decision chooses a rail/provider or authorizes settlement, refund, invoice, receipt, or any other
payment operation. Negative inputs exercise refund-shaped arithmetic only; they do not authorize a
refund.

## Conformance matrix

The independent harness covers:

- exponents 0, 2, 3, and 6;
- `half_even`, `half_up`, `down`, and `up` for positive and negative values;
- increments other than one and exact tie behavior;
- negative/refund-shaped values and canonical zero;
- both decimal-to-minor and minor-to-decimal directions;
- overflow and malformed decimal/integer inputs;
- missing, inconsistent, inactive, stale, unreviewed, and hash-tampered policy evidence;
- explicit currency selection with no fallback;
- zero durable writes, no input mutation, no resolver import, and no I/O surface.

RON, EUR, JPY, and BHD in the harness are synthetic test fixtures. They are not legal, regulatory,
rail, or provider evidence, and their sample policies must not be used as production Country Packs.

## Future activation gate

Any caller that later uses this evaluator must separately obtain a canonical, version-pinned Country
Pack artifact and command authority. Rail selection, provider configuration, credentials,
idempotency, transaction persistence, and payment-intent creation remain outside this contract and
require their own accepted runtime package.
