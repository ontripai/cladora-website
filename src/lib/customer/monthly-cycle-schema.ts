import { z } from 'zod';
import { uuidSchema } from './dashboard-schema';

export const monthlyCycleListQuerySchema = z.object({
  context_id: uuidSchema,
  property_id: uuidSchema.optional(),
}).strict();

export const createMonthlyCycleSchema = z.object({
  context_id: uuidSchema,
  property_id: uuidSchema,
  period_id: uuidSchema,
  currency: z.string().regex(/^[A-Z]{3}$/).default('RON'),
}).strict();

export const monthlyCycleActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('capture-source'), context_id: uuidSchema, source_type: z.enum(['provider_invoice','meter_reading','allocation_run']), source_id: uuidSchema }).strict(),
  z.object({ action: z.literal('submit'), context_id: uuidSchema, allocation_run_id: uuidSchema }).strict(),
  z.object({ action: z.literal('review'), context_id: uuidSchema, decision: z.enum(['approved','rejected']), note: z.string().trim().max(1000).optional() }).strict(),
  z.object({ action: z.literal('publish'), context_id: uuidSchema }).strict(),
  z.object({ action: z.literal('close'), context_id: uuidSchema, reason: z.string().trim().min(1).max(1000) }).strict(),
]);

export const monthlyCycleParamsSchema = z.object({ id: uuidSchema }).strict();
