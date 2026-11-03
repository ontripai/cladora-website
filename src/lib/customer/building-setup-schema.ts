import { z } from "zod";

// Existing PostgreSQL synthetic IDs need canonical hex shape, not RFC version bits.
export const buildingSetupIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const isoDate = z.iso.date();
const unitSchema = z.object({
  code: z.string().trim().min(1).max(40),
  floor: z.number().int().min(-5).max(200).nullable(),
  area_m2: z.number().positive().max(100_000).nullable(),
}).strict();
const openingBalanceSchema = z.object({
  account_code: z.string().trim().min(1).max(40),
  side: z.enum(["debit", "credit"]),
  amount: z.number().positive().max(1_000_000_000),
});

export const buildingSetupPayloadSchema = z.object({
  association: z.object({ name: z.string().trim().min(2).max(160) }).strict(),
  building: z.object({
    name: z.string().trim().min(2).max(160),
    code: z.string().trim().min(1).max(40),
    floors: z.number().int().min(0).max(200),
  }).strict(),
  currency: z.literal("RON"),
  period_start: isoDate,
  period_end: isoDate,
  units: z.array(unitSchema).min(1).max(500),
  opening_balances: z.array(openingBalanceSchema).max(500),
}).strict().superRefine((value, ctx) => {
  if (value.period_start > value.period_end) ctx.addIssue({ code: "custom", path: ["period_end"], message: "invalid_period" });
  const codes = value.units.map((unit) => unit.code.toLocaleLowerCase());
  if (new Set(codes).size !== codes.length) ctx.addIssue({ code: "custom", path: ["units"], message: "duplicate_unit_code" });
});

export const createBuildingSetupSchema = z.object({
  context_id: buildingSetupIdSchema,
  workspace_id: buildingSetupIdSchema,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  payload: buildingSetupPayloadSchema,
}).strict();
export const buildingSetupActionSchema = z.object({
  context_id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema,
  expected_revision: z.number().int().positive(),
  command_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
}).strict();
export const buildingSetupApprovalSchema = buildingSetupActionSchema.extend({ expected_payload_hash: z.string().regex(/^[0-9a-f]{64}$/) });

export const buildingSetupUnitsSchema = buildingSetupPayloadSchema.shape.units.superRefine((units, ctx) => {
  const codes = units.map(unit => unit.code.toLowerCase());
  if (new Set(codes).size !== codes.length) ctx.addIssue({ code: 'custom', message: 'duplicate_unit_code' });
});
export const buildingSetupReadSchema = z.object({
  version: z.literal(2),
  workspace_id: buildingSetupIdSchema,
  revision: z.number().int().positive(),
  run_id: buildingSetupIdSchema,
  status: z.enum(['draft', 'rehearsed', 'submitted', 'approved', 'provisioned', 'cancelled']),
  payload: buildingSetupPayloadSchema,
  payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
  creation_request_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  creation_receipt: z.record(z.string(), z.unknown()).nullable(),
  submitted_revision: z.number().int().positive().nullable(),
  submitted_payload_hash: z.string().nullable(),
  last_command_key: z.string().nullable(),
  last_command_receipt: z.record(z.string(), z.unknown()).nullable(),
  property_id: buildingSetupIdSchema.nullable().optional(),
  effective_units: buildingSetupUnitsSchema.nullable().optional(),
});

export const buildingSetupReceiptSchema = z.object({
  version: z.literal(2),
  workspace_id: buildingSetupIdSchema,
  revision: z.number().int().positive(),
  run_id: buildingSetupIdSchema,
  status: z.enum(['draft', 'rehearsed', 'submitted', 'approved', 'provisioned', 'cancelled']),
  creation_request_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).passthrough();

export const reviewerSetupStateSchema = z.object({
  status: z.enum(['prepared','active']).optional(), workspace_id: buildingSetupIdSchema.optional(),
  context_id: buildingSetupIdSchema.nullable().optional(), expires_at: z.string().optional(),
  runs: z.array(z.object({ id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema, status: z.literal('submitted'), building: z.string(), revision: z.number().int().positive(), payload_hash: z.string().regex(/^[0-9a-f]{64}$/), submitted_revision: z.number().int().positive(), submitted_payload_hash: z.string().regex(/^[0-9a-f]{64}$/) })).optional(),
}).superRefine((state,ctx)=>{if(state.runs?.some(r=>r.workspace_id!==state.workspace_id||r.revision!==r.submitted_revision||r.payload_hash!==r.submitted_payload_hash))ctx.addIssue({code:'custom',message:'review_snapshot_mismatch'});});

// G2 is additive. Existing v2 payload/read/receipt schemas and storage stay intact.
const setupCommandOperationSchema = z.enum(['update', 'rehearse', 'submit', 'approve', 'provision']);
const setupHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const setupStatusSchema = z.enum(['draft', 'rehearsed', 'submitted', 'approved', 'provisioned', 'cancelled']);
export const buildingSetupCommandLookupSchema = z.object({
  context_id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema, run_id: buildingSetupIdSchema,
  command_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  operation: setupCommandOperationSchema, expected_revision: z.number().int().positive().max(2147483646),
}).strict().superRefine((v, ctx) => {
  if (!v.command_key.startsWith(`setup-${v.run_id}-r${v.expected_revision}-`)) ctx.addIssue({ code: 'custom', message: 'command_key_binding' });
});
export const buildingSetupExactCommandReceiptSchema = z.object({
  version: z.literal(2), run_id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema,
  revision: z.number().int().positive(), status: setupStatusSchema, payload_hash: setupHashSchema,
  expected_revision: z.number().int().positive(), operation: setupCommandOperationSchema,
  command_key: z.string(), property_id: buildingSetupIdSchema.nullable(),
}).strict().superRefine((v, ctx) => {
  const status = { update: 'draft', rehearse: 'rehearsed', submit: 'submitted', approve: 'approved', provision: 'provisioned' }[v.operation];
  if (v.revision !== v.expected_revision + 1 || v.status !== status
    || !v.command_key.startsWith(`setup-${v.run_id}-r${v.expected_revision}-`)
    || (v.operation === 'provision' ? v.property_id === null : v.property_id !== null)) {
    ctx.addIssue({ code: 'custom', message: 'command_receipt_binding' });
  }
});
const setupCommandScopeSchema = z.object({
  tenant_id: buildingSetupIdSchema, workspace_id: buildingSetupIdSchema, run_id: buildingSetupIdSchema,
  context_id: buildingSetupIdSchema, membership_id: buildingSetupIdSchema, actor_id: buildingSetupIdSchema,
}).strict();
const setupCommandIdentitySchema = z.object({
  command_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/), operation: setupCommandOperationSchema,
  expected_revision: z.number().int().positive().max(2147483646),
}).strict();
const setupCommandCoverageSchema = z.object({
  status: z.enum(['covered', 'uncovered']), epoch_id: z.string().nullable(),
  from_expected_revision: z.number().int().positive().nullable(), checked_at: z.iso.datetime({ offset: true }),
}).strict().superRefine((v, ctx) => {
  if (v.status === 'covered' ? v.epoch_id !== 'building-g2-pm169-v1' || v.from_expected_revision !== 1
    : v.epoch_id !== null || v.from_expected_revision !== null) ctx.addIssue({ code: 'custom', message: 'coverage_binding' });
});
const setupCommandEnvelope = {
  version: z.literal(1), scope: setupCommandScopeSchema, command: setupCommandIdentitySchema,
  coverage: setupCommandCoverageSchema,
  // No retention duration/legal basis/purge policy has been activated by this source.
  retention: z.object({ status: z.literal('activation_hold'), policy_id: z.null() }).strict(),
};
const setupCommandEvidenceSchema = z.object({
  request_hash: setupHashSchema,
  input_descriptor: z.object({ units: buildingSetupUnitsSchema.nullable(), expected_payload_hash: setupHashSchema.nullable() }).strict(),
  before_record: z.object({ revision: z.number().int().positive(), status: setupStatusSchema, payload_hash: setupHashSchema }).strict(),
  receipt: buildingSetupExactCommandReceiptSchema,
  epoch_id: z.literal('building-g2-pm169-v1'), recorded_at: z.iso.datetime({ offset: true }),
}).strict();
export const buildingSetupCommandLookupResponseSchema = z.discriminatedUnion('outcome', [
  z.object({ ...setupCommandEnvelope, outcome: z.literal('complete'), evidence: setupCommandEvidenceSchema }).strict(),
  z.object({ ...setupCommandEnvelope, outcome: z.literal('absent') }).strict(),
  z.object({ ...setupCommandEnvelope, outcome: z.literal('unknown'), reason: z.enum(['legacy_uncovered', 'coverage_gap']) }).strict(),
  z.object({ ...setupCommandEnvelope, outcome: z.literal('conflict'), reason: z.literal('own_command_descriptor_mismatch') }).strict(),
]).superRefine((v, ctx) => {
  if (!v.command.command_key.startsWith(`setup-${v.scope.run_id}-r${v.command.expected_revision}-`)
    || (v.outcome === 'absent' && (v.command.operation === 'approve' || v.coverage.status !== 'covered'
      || v.command.expected_revision < (v.coverage.from_expected_revision ?? Infinity)))) {
    ctx.addIssue({ code: 'custom', message: 'lookup_scope_coverage_binding' });
  }
  if (v.outcome === 'unknown' && v.coverage.status !== (v.reason === 'legacy_uncovered' ? 'uncovered' : 'covered')) {
    ctx.addIssue({ code: 'custom', message: 'lookup_outcome_coverage_reason_binding' });
  }
  if (v.outcome !== 'complete') return;
  const e = v.evidence, r = e.receipt, c = v.command;
  if (r.run_id !== v.scope.run_id || r.workspace_id !== v.scope.workspace_id || r.command_key !== c.command_key
    || r.operation !== c.operation || r.expected_revision !== c.expected_revision || e.before_record.revision !== c.expected_revision
    || (c.operation === 'update' ? e.input_descriptor.units === null : e.input_descriptor.units !== null)
    || (c.operation === 'approve' ? e.input_descriptor.expected_payload_hash !== e.before_record.payload_hash : e.input_descriptor.expected_payload_hash !== null)
    || (c.operation !== 'update' && e.before_record.payload_hash !== r.payload_hash)) {
    ctx.addIssue({ code: 'custom', message: 'lookup_exact_evidence_binding' });
  }
  const before = e.before_record.status;
  if ((c.operation === 'update' && before !== 'draft') || (c.operation === 'rehearse' && !['draft', 'rehearsed'].includes(before))
    || (c.operation === 'submit' && before !== 'rehearsed') || (c.operation === 'approve' && before !== 'submitted')
    || (c.operation === 'provision' && before !== 'approved')) ctx.addIssue({ code: 'custom', message: 'lookup_before_state_binding' });
});
export type BuildingSetupCommandLookup = z.infer<typeof buildingSetupCommandLookupSchema>;
export type BuildingSetupCommandLookupResponse = z.infer<typeof buildingSetupCommandLookupResponseSchema>;
