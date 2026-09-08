import { z } from "zod";

export const SERVICE_TYPES = [
  "water",
  "electricity",
  "gas",
  "heat",
  "sewer",
  "waste",
  "internet",
  "telephone",
  "other",
] as const;

export const METER_SCOPES = [
  "property",
  "building",
  "unit",
  "common_area",
  "submeter",
] as const;

export const READING_METHODS = [
  "manual",
  "photo_ocr",
  "bulk_import",
  "iot",
  "provider",
] as const;

export const createMeterSchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid(),
  building_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  service_type: z.enum(SERVICE_TYPES).default("water"),
  scope: z.enum(METER_SCOPES).default("unit"),
  serial_number: z.string().trim().min(2).max(100),
  unit_code: z.string().trim().max(20).default("m3"),
  multiplier: z.coerce.number().positive().default(1),
  initial_reading: z.coerce.number().min(0).default(0),
  installed_on: z.string().optional(),
  calibration_expires_on: z.string().optional().nullable(),
  parent_meter_id: z.string().uuid().optional().nullable(),
  decimal_precision: z.coerce.number().int().min(0).max(6).default(2),
});

export const updateMeterSchema = z.object({
  context_id: z.string().uuid(),
  calibration_expires_on: z.string().optional().nullable(),
  multiplier: z.coerce.number().positive().optional(),
  unit_code: z.string().trim().max(20).optional(),
  decimal_precision: z.coerce.number().int().min(0).max(6).optional(),
});

export const replaceMeterSchema = z.object({
  context_id: z.string().uuid(),
  final_reading: z.coerce.number().min(0),
  new_serial_number: z.string().trim().min(2).max(100),
  new_initial_reading: z.coerce.number().min(0).default(0),
  replaced_at: z.string().optional(),
  reason: z.string().trim().max(255).default("Regular replacement"),
});

export const decommissionMeterSchema = z.object({
  context_id: z.string().uuid(),
  final_reading: z.coerce.number().min(0).optional().nullable(),
  decommissioned_on: z.string().optional(),
  reason: z.string().trim().max(255).default("Meter decommissioned"),
});

export const captureReadingSchema = z.object({
  context_id: z.string().uuid(),
  meter_id: z.string().uuid(),
  reading_value: z.coerce.number().min(0),
  reading_at: z.string().optional(),
  method: z.enum(READING_METHODS).default("manual"),
  source_object_path: z.string().trim().optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const ocrCandidateSchema = z.object({
  context_id: z.string().uuid(),
  meter_id: z.string().uuid(),
  reading_value: z.coerce.number().min(0),
  reading_at: z.string().optional(),
  confidence: z.coerce.number().min(0).max(1).default(0.85),
  photo_object_path: z.string().trim().optional().nullable(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const approveReadingSchema = z.object({
  context_id: z.string().uuid(),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const rejectReadingSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(255),
});

export const correctReadingSchema = z.object({
  context_id: z.string().uuid(),
  corrected_value: z.coerce.number().min(0),
  correction_reason: z.string().trim().min(1).max(255),
});

export const calculateConsumptionSchema = z.object({
  context_id: z.string().uuid(),
  meter_id: z.string().uuid(),
  start_reading_id: z.string().uuid(),
  end_reading_id: z.string().uuid(),
});

export const approveConsumptionSchema = z.object({
  context_id: z.string().uuid(),
});

export const createTariffSchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid().optional().nullable(),
  service_type: z.enum(SERVICE_TYPES),
  tariff_code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  unit_rate: z.coerce.number({ message: "invalid_unit_rate" }).min(0, { message: "invalid_unit_rate" }),
  fixed_charge: z.coerce.number().min(0).default(0),
  tax_rate: z.preprocess(
    (val) => (val === undefined || val === null || val === "" ? undefined : Number(val)),
    z.number({ message: "tax_rate_required" })
      .refine((v) => !Number.isNaN(v), { message: "tax_rate_required" })
      .refine((v) => v >= 0 && v <= 1, { message: "tax_rate_out_of_range" })
  ),
  currency: z.string().trim().length(3).default("RON"),
  valid_from: z.string().optional(),
  valid_to: z.string().optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
});

export const billConsumptionSchema = z.object({
  context_id: z.string().uuid(),
  tariff_id: z.string().uuid().optional().nullable(),
  due_on: z.string().optional(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const importReadingsItemSchema = z.object({
  reading_value: z.coerce.number().min(0),
  reading_at: z.string().optional(),
  note: z.string().trim().max(255).optional().nullable(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const importReadingsSchema = z.object({
  context_id: z.string().uuid(),
  meter_id: z.string().uuid(),
  readings: z.array(importReadingsItemSchema).min(1),
});

export const varianceQuerySchema = z.object({
  context_id: z.string().uuid(),
  building_id: z.string().uuid(),
  service_type: z.enum(SERVICE_TYPES).default("water"),
  from: z.string().optional(),
  to: z.string().optional(),
});
