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
