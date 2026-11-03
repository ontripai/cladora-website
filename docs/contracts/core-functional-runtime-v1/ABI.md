Current status: Platform12 is delivered and independently reconstructed. The **session-only** real SDK/PG ABI is documented in NATIVE-SESSION-CHECKPOINT.md. The full Service/AIRPROP factory below remains unbound pending exact installer/principal adaptation; its cladora_dev_* selector does not match actual P12.

# Core15 source checkpoint ABI — task remains open

`createCoreServiceFunctionalBindingV1({pool,target})` in
`src/lib/core/service-functional-binding-v1.ts` implements the Service09 shape:

```
contract_version: service-functional-request-runtime.v1
core_contract: core15-service-request-runtime.v1
database_contract: platform12-service-request-database.v1
bind(request: Request): Promise<ServiceOfferingRequestFlowPortsV1 | null>
```

Request-local methods use actual SERVICE source ports, current Core S01 reader,
actual SERVICE Offering projector and the same C03 host/ledger. No SERVICE owner
file is copied/modified. The new source has NOT been configured into its literal
NULL activation seam and is NOT native acceptance. Platform12 target is absent.

- `loadOffering` selects a real authorized published snapshot in rollback-only
  scope. Its exact metadata constructs the S01 disclosure binding; there is no
  guessed first Offering or client-supplied provider/version as proof.
- `resolvePrincipal`, S01 and optional current DW02 reads each use the same
  authenticated scoped read mechanism. .now() is an exact DB timestamp after
  positive ROLLBACK, not Date.now or statement-start time.
- Transactional readers consume the actual C03 scope/canonical request capture.
  S01 date policy, final session/authority guard, disclosure and same40001 remain.
- `host.execute` authenticates actual server getUser/getClaims, rejects a mismatched
  command actor, injects minimal SET LOCAL claims only after BEGIN, binds actual
  tenant/member through resolver, and forces the canonical provider. One C03
  mutation/receipt/audit/outbox transaction, not another engine or ledger.
- Source preflight read scope is SERIALIZABLE/lock-capable, with actual Workspace
  and Offering locks, never SQL READ ONLY, C03 reservation or command receipt.
  Exact closed read-query census is generated from pinned Core/SERVICE TS source;
  unknown SQL (including SELECT-side-effect writer calls) poisons the scope. It
  returns detached values only after positive ROLLBACK and same-backend DB clock.
- Native head revision int8 text is exactly converted ONLY for S01 discover/head;
  overflow is a failure. No global node-pg parser or accepted source is changed.
- The sole C03 host delta is an OPTIONAL server-expiry mode used by this runtime.
  It checks receipt expiry via a separate DB clock AFTER ledger lock and AGAIN
  after replay provider waits. Existing default behavior and Core13 replay-only
  path retain their original contract. Historical Documents matching is not used.
- C01/expiry checkpoints before and after subsequent query waits, before effects
  and final pre-COMMIT do not establish validity through later server COMMIT waits
  or client delivery. Session row participation and all writer barriers need native
  proof; no successful controlled fixture weakens those open guarantees.

The minimum Service cut is workspace-wide, non-reservation, non-financial Request.
Named Unit/resource actions are NOT automatically ready: existing identity RPC
requires core.units.identity.read/core.unit_identity.history and correctly
withholds services.orders.request/AIRPROP purposes. The thin RPC adapter does not
rename permission/purpose to manufacture a positive result. AIRPROP read selector,
real canonical party/relationship/version/manage and publication/control remain
independent work IN PROGRESS within Core15, not delegated as completed.

`coreFunctionalDevelopmentTargetV1Schema` requires actual Platform backend ID,
owned persistent-development purpose, loopback PG endpoint, cladora_dev_* DB
name/OID, ordinary dedicated runtime role and loopback Auth origin. Constructor
configuration is PRIVATE SERVER input, never HTTP scope/authority. Its metadata
is not a custody proof by itself; official Platform handoff and native observation
are mandatory. Role credentials stay private and cannot target staging.

Source checks currently distinguish real Core/CE/Service algorithms executed over
controlled Auth/pg transports from actual PostgreSQL/Auth/native evidence. Full
ES5, limited lint, generated identity and coherent source negatives are necessary
source gates; native acceptance, actual table writes, session/currentness, row
locks, restart/COMMIT and the full product task are NOT_COMPLETE.
