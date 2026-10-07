import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';
import { currencyConfig, type SupportedCurrency } from '../../config/currencies';
const currency = z.enum(Object.keys(currencyConfig) as [SupportedCurrency, ...SupportedCurrency[]]);
export const serviceQuoteResultSchema = z.strictObject({ quote_id: uuidSchema, version: z.number().int().positive(), status: z.literal('draft') });
export const serviceQuoteReadSchema = z.strictObject({ requests: z.array(z.strictObject({
  request_id: uuidSchema, published_revision_id: uuidSchema, beneficiary_party_id: uuidSchema,
  beneficiary_label: z.string(), provider_label: z.string(), description: z.string(),
  quotes: z.array(z.strictObject({ quote_id: uuidSchema, version: z.number().int().positive(), status: z.literal('draft'),
    scope: z.string(), total_minor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/), currency,
    valid_until: z.iso.datetime({ offset: true }), created_at: z.iso.datetime({ offset: true }),
  })),
})) });

export function serviceQuoteAmountToMinor(amount: string, code: SupportedCurrency): string | null {
  const digits = currencyConfig[code].fractionDigits;
  const match = new RegExp(`^(0|[1-9][0-9]{0,${17 - digits}})(?:\\.([0-9]{1,${digits}}))?$`).exec(amount.trim());
  if (!match) return null;
  return BigInt(match[1] + (match[2] ?? '').padEnd(digits, '0')).toString();
}
export function serviceQuoteMinorToAmount(amount: string, code: SupportedCurrency): string {
  const digits = currencyConfig[code].fractionDigits;
  const padded = amount.padStart(digits + 1, '0');
  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
}
