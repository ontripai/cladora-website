/**
 * CLADORA Direct Association Payment Orchestration & Unit Charge Breakdown
 * Authoritative slice: CLADORA-P2-PAY-003-R1
 * Strict Non-Custodial / Zero Card Data / Canonical Accounting
 */

export type PaymentIntentStatus =
  | "created"
  | "awaiting_provider"
  | "processing"
  | "authorized"
  | "succeeded"
  | "settlement_pending"
  | "settled"
  | "failed"
  | "expired"
  | "cancelled"
  | "requires_review"
  | "reversed";

export type PaymentAllocationStrategy =
  | "oldest_due_first"
  | "current_period_first"
  | "invoice_selected"
  | "proportional";

export type PenaltiesPriority = "penalties_first" | "principal_first";

export interface AllocationPolicy {
  version: number;
  strategy: PaymentAllocationStrategy;
  penalties_priority: PenaltiesPriority;
  allow_payer_selection: boolean;
  min_partial_amount: number;
}

export interface BeneficiaryAccountSnapshot {
  beneficiary_id: string;
  association_legal_name: string;
  bank_name: string;
  currency: string;
  masked_iban: string;
}

export interface SelectedInvoiceItem {
  invoice_id: string;
  amount: number;
}

export interface PaymentIntent {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  payer_user_id: string;
  payer_party_id: string | null;
  debtor_party_id: string;
  amount: number;
  currency: string;
  provider_code: string;
  payment_method: string;
  idempotency_key: string;
  client_reference: string;
  beneficiary_snapshot: BeneficiaryAccountSnapshot;
  allocation_policy_snapshot: AllocationPolicy;
  selected_invoices_snapshot: SelectedInvoiceItem[];
  status: PaymentIntentStatus;
  hosted_checkout_url?: string | null;
  failure_category?: string | null;
  created_at: string;
  settled_at?: string | null;
}

export interface UnitChargeLineItem {
  line_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
  allocation_basis?: string | null;
}

export interface UnitChargeInvoice {
  invoice_id: string;
  invoice_no: number;
  property_name: string;
  unit_code: string;
  debtor_name: string;
  period_start: string;
  period_end: string;
  issued_on: string;
  due_on: string;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  credited_amount: number;
  outstanding_amount: number;
  status: string;
  overdue_days: number;
  aging_bucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
  line_items: UnitChargeLineItem[];
}

export interface BankPaymentInstruction {
  association_legal_name: string;
  iban: string;
  bank_name: string;
  amount: number;
  currency: string;
  structured_reference: string;
  epc_qr_payload: string;
  unit_code: string;
  expires_at?: string;
}

export interface ProviderSessionResult {
  checkout_url?: string | null;
  provider_reference: string;
  status: "ready" | "deferred_unconfigured";
  message?: string;
}
