import { z } from 'zod';

const uuid = z.uuid();
const date = z.iso.date();
const money = z.number().finite().multipleOf(0.01).min(0).max(999999999999.99);
const currency = z.enum(['RON', 'EUR', 'USD']);

export const ownerPortfolioMutation = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('unit'),
    building_label: z.string().trim().min(2).max(160),
    unit_label: z.string().trim().min(1).max(100),
    address_text: z.string().trim().min(5).max(500),
    usage_kind: z.enum(['residential', 'commercial', 'office', 'industrial', 'other']),
  }).strict(),
  z.object({
    action: z.literal('lease'), unit_id: uuid,
    tenant_label: z.string().trim().min(2).max(160),
    starts_on: date, ends_on: date.nullable(),
    monthly_rent: money, currency,
  }).strict().refine(v => !v.ends_on || v.ends_on > v.starts_on, { path: ['ends_on'] }),
  z.object({
    action: z.literal('cash'), unit_id: uuid,
    kind: z.enum(['rent', 'building_charge', 'owner_expense', 'tax_reserve', 'other']),
    direction: z.enum(['income', 'expense']),
    amount: money.positive(), currency,
    due_on: date.nullable(), paid_on: date.nullable(),
    lease_id: uuid.nullable(),
    memo: z.string().trim().max(500).nullable(),
  }).strict().refine(v => v.kind !== 'rent' || v.direction === 'income', { path: ['direction'] })
    .refine(v => !v.lease_id || (v.kind === 'rent' && v.direction === 'income' && v.due_on && v.paid_on), { path: ['lease_id'] }),
]);
