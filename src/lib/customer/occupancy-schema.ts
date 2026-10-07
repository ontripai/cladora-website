import { z } from "zod";

// Database identifiers include deterministic UUIDs with non-RFC version bits.
export const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const occupancyViewEnum = z.enum([
  "parties",
  "residents",
  "ownerships",
  "leases",
  "occupancies",
  "mappings",
  "links",
  "history",
  "units",
  "unit_detail",
]);

export const occupancyKindEnum = z.enum([
  "owner",
  "tenant",
  "household_member",
  "short_stay",
  "company",
  "empty",
]);

export const occupancyStatusEnum = z.enum([
  "planned",
  "active",
  "ended",
  "cancelled",
]);

export const queryOccupancySchema = z.object({
  context_id: uuidSchema,
  view: occupancyViewEnum.default("occupancies"),
  query: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  kind: occupancyKindEnum.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  id: uuidSchema.optional(),
  unit_id: uuidSchema.optional(),
});

export const createOccupancyRequestSchema = z.object({
  context_id: uuidSchema,
  unit_id: uuidSchema,
  kind: occupancyKindEnum,
  starts_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  ends_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  occupant_party_ids: z.array(uuidSchema).max(20).optional(),
  role: z.string().trim().max(50).optional(),
  reason: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  const partyIds = value.occupant_party_ids ?? [];
  if (value.kind !== "empty" && partyIds.length === 0) {
    ctx.addIssue({code: "custom", path: ["occupant_party_ids"], message: "At least one authorized party is required"});
  }
  if (new Set(partyIds).size !== partyIds.length) {
    ctx.addIssue({code: "custom", path: ["occupant_party_ids"], message: "Party IDs must be unique"});
  }
});

export const updateOccupancyRequestSchema = z.object({
  context_id: uuidSchema,
  occupancy_id: uuidSchema,
  ends_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  status: occupancyStatusEnum.optional(),
  reason: z.string().trim().max(500).optional(),
});

export const endOccupancyRequestSchema = z.object({
  context_id: uuidSchema,
  occupancy_id: uuidSchema,
  ended_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  reason: z.string().trim().max(500).optional(),
});

export const renewOccupancyRequestSchema = z.object({
  context_id: uuidSchema,
  occupancy_id: uuidSchema,
  new_ends_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  reason: z.string().trim().max(500).optional(),
});

export const transferOccupancyRequestSchema = z.object({
  context_id: uuidSchema,
  occupancy_id: uuidSchema,
  to_unit_id: uuidSchema,
  effective_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  reason: z.string().trim().max(500).optional(),
});
