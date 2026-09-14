import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const unitSchema = z.object({
  code: z.string().trim().min(1).max(40),
  floor: z.number().int().min(-5).max(200).nullable(),
  area_m2: z.number().positive().max(100_000).nullable(),
});
const openingBalanceSchema = z.object({
  account_code: z.string().trim().min(1).max(40),
  side: z.enum(["debit", "credit"]),
  amount: z.number().positive().max(1_000_000_000),
});

export const buildingSetupPayloadSchema = z.object({
  association: z.object({ name: z.string().trim().min(2).max(160) }),
  building: z.object({
    name: z.string().trim().min(2).max(160),
    code: z.string().trim().min(1).max(40),
    floors: z.number().int().min(0).max(200),
  }),
  currency: z.literal("RON"),
  period_start: isoDate,
  period_end: isoDate,
  units: z.array(unitSchema).min(1).max(500),
  opening_balances: z.array(openingBalanceSchema).max(500),
}).superRefine((value, ctx) => {
  if (value.period_start > value.period_end) ctx.addIssue({ code: "custom", path: ["period_end"], message: "invalid_period" });
  const codes = value.units.map((unit) => unit.code.toLocaleLowerCase());
  if (new Set(codes).size !== codes.length) ctx.addIssue({ code: "custom", path: ["units"], message: "duplicate_unit_code" });
});

export const createBuildingSetupSchema = z.object({
  context_id: z.string().uuid(),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  payload: buildingSetupPayloadSchema,
});
export const buildingSetupActionSchema = z.object({ context_id: z.string().uuid() });
