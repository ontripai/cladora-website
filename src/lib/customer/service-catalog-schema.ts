import { z } from 'zod';
import { currencyConfig, type SupportedCurrency } from '../../config/currencies';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

// Input validation only. Gateways must resolve actor/tenant and authorize every reference.
// workspace_id is an explicit target, never authority: require it to match the
// canonical authorized workspace. Do not infer it from a physical grant or tenant.
const text = (max: number) => z.string().trim().min(1).max(max);
const labelsSchema = z.strictObject({ ro: text(200), en: text(200), fa: text(200) });
const timestampSchema = z.iso.datetime({ offset: true });
const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const amountSchema = z.string().regex(/^(0|[1-9][0-9]{0,14})(\.[0-9]{1,6})?$/);
const currencySchema = z.enum(Object.keys(currencyConfig) as [SupportedCurrency, ...SupportedCurrency[]]);

export const servicePriceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('quote_required') }),
  z.strictObject({
    kind: z.literal('fixed'), amount: amountSchema,
    currency: currencySchema,
    tax_display: z.enum(['included', 'excluded', 'not_applicable']),
  }),
  z.strictObject({
    kind: z.literal('unit'), amount: amountSchema,
    currency: currencySchema, unit_code: text(64),
    tax_display: z.enum(['included', 'excluded', 'not_applicable']),
  }),
]).superRefine((price, ctx) => {
  // Fixed totals must be representable in the shared currency's minor unit.
  // Unit rates may retain six decimals; final rounding belongs to shared finance.
  if (price.kind === 'fixed' && (price.amount.split('.')[1]?.length ?? 0) > currencyConfig[price.currency].fractionDigits) {
    ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Fixed amount exceeds currency precision' });
  }
});

export const serviceOfferingRevisionSchema = z.strictObject({
  labels: labelsSchema,
  description: z.strictObject({ ro: text(5000), en: text(5000), fa: text(5000) }),
  acquisition_mode: z.enum(['direct', 'pre_quote', 'on_site', 'project', 'reservation']),
  price: servicePriceSchema,
  valid_from: timestampSchema,
  valid_until: timestampSchema.nullable(),
  cancellation_terms: z.strictObject({ ro: text(3000), en: text(3000), fa: text(3000) }),
  acceptance_criteria: z.strictObject({ ro: text(3000), en: text(3000), fa: text(3000) }),
  document_version_ids: z.array(uuidSchema).max(50),
}).superRefine((value, ctx) => {
  if (value.valid_until !== null && Date.parse(value.valid_until) <= Date.parse(value.valid_from)) {
    ctx.addIssue({ code: 'custom', path: ['valid_until'], message: 'Validity must end after it starts' });
  }
  if (value.acquisition_mode === 'direct' && value.price.kind === 'quote_required') {
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'Direct acquisition requires a stated price' });
  }
  if (new Set(value.document_version_ids.map(id => id.toLowerCase())).size !== value.document_version_ids.length) {
    ctx.addIssue({ code: 'custom', path: ['document_version_ids'], message: 'Duplicate document version' });
  }
});

export const createServiceOfferingRequestSchema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  definition_id: uuidSchema,
  provider_party_id: uuidSchema,
  revision: serviceOfferingRevisionSchema,
  idempotency_key: idempotencyKeySchema,
});

export const reviseServiceOfferingRequestSchema = z.strictObject({
  context_id: uuidSchema, offering_id: uuidSchema,
  workspace_id: uuidSchema,
  expected_lock_version: versionSchema,
  revision: serviceOfferingRevisionSchema,
  idempotency_key: idempotencyKeySchema,
});

export const transitionServiceOfferingRequestSchema = z.strictObject({
  context_id: uuidSchema, offering_id: uuidSchema, revision_id: uuidSchema,
  workspace_id: uuidSchema,
  expected_lock_version: versionSchema,
  action: z.enum(['submit', 'publish', 'suspend', 'archive']),
  reason: z.string().trim().min(5).max(500),
  idempotency_key: idempotencyKeySchema,
});

export type CreateServiceOfferingRequest = z.infer<typeof createServiceOfferingRequestSchema>;
export type ReviseServiceOfferingRequest = z.infer<typeof reviseServiceOfferingRequestSchema>;
export type TransitionServiceOfferingRequest = z.infer<typeof transitionServiceOfferingRequestSchema>;
