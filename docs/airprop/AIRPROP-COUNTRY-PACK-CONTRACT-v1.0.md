# AIRPROP Country Pack Contract v1.0

## Purpose

Country packs isolate jurisdiction-specific rules from AIRPROP Core. A pack supplies versioned configuration, validations, document requirements and reporting mappings; it cannot bypass shared security, accounting or approval controls.

## Required contract

Each pack declares:

| Section | Required content |
| --- | --- |
| Identity | country code, pack code, semantic version and status |
| Validity | effective-from/to and superseded version |
| Currency | base/display currencies, rounding and FX evidence rules |
| Property identity | official identifiers and validation shape |
| Party identity | permitted person/company identifiers and minimization rules |
| Activity capability | own asset, lease-operate, third-party management and licensing gates |
| Lease | mandatory fields, notices, indexation and registration evidence |
| Deposit | custody/accounting/return and deduction controls |
| Tax | rule identifiers and accounting/reporting mappings, not hard-coded rates |
| Documents | required evidence by lifecycle transition |
| Accounting | event-to-accounting-policy mapping |
| Reporting | statutory/owner output definitions and language requirements |
| Retention | document/event retention classes and legal-hold behavior |
| Review | accountant/legal reviewer, date and approval evidence |

## Capability response

For a requested command the pack returns one of:

- `ALLOWED`
- `ALLOWED_WITH_APPROVAL`
- `BLOCKED_MISSING_EVIDENCE`
- `BLOCKED_LICENSE_REQUIRED`
- `BLOCKED_RULE_EXPIRED`
- `NOT_SUPPORTED`

Unknown country, version, activity or rule returns a blocking result.

## Romania pack (`AIRPROP-RO`)

Initial scope is Bucharest and synthetic data only. The first version must cover:

- RON/EUR money and exchange-rate evidence;
- cadastral/land-book references as protected identifiers;
- legal-entity, individual owner and tenant distinctions;
- lease terms, handover and notices;
- rent, deposit and owner/tenant cost responsibility;
- company-paid rent to an individual and configurable withholding/reporting evidence;
- VAT/tax treatment as effective-dated accountant-approved policy;
- Romanian owner statements and accounting export mapping;
- privacy, retention and legal-hold rules.

No rate, filing deadline or legal conclusion becomes executable until qualified Romanian accounting/legal acceptance is recorded.

## Dubai pack (`AIRPROP-AE-DU`)

The architecture placeholder must support:

- AED and approved FX evidence;
- DLD/title-deed property references;
- Ejari or successor tenancy-registration evidence;
- RERA/Trakheesi license and practice-card capabilities;
- own-property management versus third-party property management;
- rent increase and notice rule versions;
- service-charge schedules;
- cheque/payment-plan evidence;
- freehold/leasehold interests;
- management-contract registration;
- VAT and owner-statement mappings.

This package authorizes no DLD, Ejari, RERA, Trakheesi, payment or identity integration.

## Extension and compatibility

- Core consumes capability results, never country-specific table names.
- Packs are append-only once used by accepted legal or financial evidence.
- New versions may supersede but not rewrite historical decisions.
- Cross-country portfolios preserve legal-entity and currency boundaries; consolidation is a read model.
- A country pack cannot downgrade DUAL-AAL2 or immutable-ledger requirements.
