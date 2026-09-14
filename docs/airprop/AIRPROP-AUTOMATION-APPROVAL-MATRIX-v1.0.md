# AIRPROP Automation Approval Matrix v1.0

## Authority classes

- `AUTO-READ`: automatic calculation, classification or monitoring with no state mutation.
- `AUTO-DRAFT`: may create a draft/proposal with provenance.
- `HUMAN-APPROVE`: authorized person must accept before effect.
- `DUAL-AAL2`: two independent AAL2 actors are required.
- `PROHIBITED`: automation cannot perform the act.

| Process | Automation ceiling | Required control | Failure behavior |
| --- | --- | --- | --- |
| Document extraction/OCR | AUTO-DRAFT | confidence and source hash | route uncertain fields to review |
| Opportunity enrichment | AUTO-DRAFT | source provenance and freshness | mark stale/unknown, never invent |
| Underwriting calculations | AUTO-READ | deterministic formulas/version | reject missing currency/rate |
| Purchase-price recommendation | AUTO-DRAFT | human review | no offer submission |
| Due-diligence classification | AUTO-DRAFT | qualified reviewer resolves blockers | acquisition remains blocked |
| Acquisition approval | PROHIBITED | DUAL-AAL2 human decision | no closing state/funds movement |
| Lease draft generation | AUTO-DRAFT | legal/template version and human approval | no signature or activation |
| Recurring rent schedule | AUTO-DRAFT | approved active lease | stop outside effective term |
| Routine rent invoice | AUTO-DRAFT | finance posting policy | remain draft on rule conflict |
| Bank matching | AUTO-DRAFT | canonical reconciliation confirmation | unresolved exception blocks close |
| Deposit receipt classification | AUTO-DRAFT | liability account validation | never classify as income |
| Deposit deduction/consumption | PROHIBITED | DUAL-AAL2 plus evidence | retain full liability |
| Maintenance triage | AUTO-DRAFT | scope/budget/SLA policy | escalate ambiguity/emergency |
| Work order below mandate limit | AUTO-DRAFT | one authorized approval | no supplier commitment before approval |
| Work order above mandate limit | AUTO-DRAFT | owner plus internal approval | block until both decisions exist |
| Management-fee calculation | AUTO-DRAFT | contract rule/version | no fee if rule missing/expired |
| Owner statement generation | AUTO-DRAFT | ledger reconciliation | publication blocked on difference |
| Owner payout | PROHIBITED | DUAL-AAL2 and confirmed bank details | zero partial writes |
| Rent/renewal recommendation | AUTO-DRAFT | country rule and human decision | no tenant notice automatically |
| Legal notice | AUTO-DRAFT | qualified human approval | never send autonomously |
| Valuation estimate | AUTO-DRAFT | method, data date and confidence | labelled estimate, not certified value |
| Listing publication | AUTO-DRAFT | authorized final approval | remain private draft |
| Disposal acceptance/closing | PROHIBITED | DUAL-AAL2 and closing evidence | no title/funds/journal finalization |

## AI evidence requirements

Every AI-generated proposal records model/service identifier, prompt-template version, input-data references, redaction policy version, generated timestamp, confidence where meaningful and accepting/rejecting actor. Prompt or response bodies containing unrestricted personal documents are not audit payloads.

## Kill switches

Automation can be disabled by tenant, country pack, module, property or workflow. Disabled or expired configuration fails closed; it does not fall back to broader authority.
