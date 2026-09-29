type BillingResponse = {
  context?: { role_code?: string };
  invoices?: Array<Record<string, unknown>>;
  journal?: unknown;
  [key: string]: unknown;
};

/** Keep internal ledger identifiers and entries out of resident invoice responses. */
export function restrictResidentBilling<T extends BillingResponse>(data: T): T {
  const role = data.context?.role_code?.toLowerCase();
  if (role !== 'owner' && role !== 'tenant_resident') return data;

  return {
    ...data,
    journal: null,
    invoices: data.invoices?.map(({ journal_id, journal_no, ...invoice }) => invoice),
  } as T;
}
