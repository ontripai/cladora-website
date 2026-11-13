# Revise authoring source_current — owner policy22

Parent0b73eb0754f6f3e0025b452123e309c4bb2ca1d7. Deliveries20/21 remain immutable
in Git. The clock fix awaits independent QA and has not been regenerated/retested.

For the existing closed revise-only source method, source_current means the exact
canonical head and old revision/version currently bound to that Offering, in draft
or submitted status. An expired or future OLD commercial window does not by itself
prevent authoring a replacement revision. The source still validates actual row
content, old column/commercial-time consistency, exact tenant/Workspace/Offering/
head/revision/provider/agreement binding and all current authority/S01 checks.
Malformed or chronologically invalid terms remain rejected by the existing owner
schema. New command terms and next revision IDs/version are validated by the exact
SERVICE5ead schemas; no validator or historical terms are rewritten.

This change is confined to the method already requiring services.catalog.manage,
services_catalog and service.revise_offering. It does not change Request, catalog
read, publish, Quote, S01 date/scope policy, evaluator or C03. Published/suspended/
archived are outside this authoring source port. Permission to read an authoring
source is not permission to publish or invoke an unadmitted writer. Original
command/authority/key/body/fingerprint/IDs/TTL and UNKNOWN handling are unchanged.

Seven new policy groups use the real Core C01/C03/S01 source and SERVICE5ead
schemas through controlled PG/Auth transport: four expired/future×draft/submitted
positive sources, exclusion of other statuses, stale-head/S01 revoke/expiry/wrong
scope/current-denial controls, malformed old and invalid NEW terms/IDs/version.
Only the directly affected old postwait assertion was updated/executed; no closed
suite was rerun. Current ES5 typecheck, focused lint, syntax/diff and actual scratch
apply/reverse are recorded in the delivery. These are not SQL/native proofs.

The actual SERVICE writer/provider implementation is still a prerequisite to
operation admission; the published interface alone is insufficient. Core operation
admission and runtime remain NULL. The existing conservative sub-millisecond
commercial-schema limitation stays with SERVICE and is not weakened here. Target,
SQL/parser/PG/Auth/install/grant/activation are NOT_RUN_NOT_PASS. CE010 continues
from its preserved independent WIP after this source handoff.

Automation: نیازمند بررسی. Exact schema/binding tests can be automated; domain
writer review and Platform native execution require their owners. Value is removing
an unnecessary authoring availability restriction without granting publication.
