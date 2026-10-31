// Volatile UI coordination only. Server RPCs remain the sole payment authority.
export type DirectPaymentTupleV1 = Readonly<{
  actor_id: string; context_id: string; workspace_id: string | null;
  unit_id: string; invoice_id: string; currency: string; amount: number;
}>;
export type DirectPaymentInstructionV1 = {
  association_legal_name: string; bank_name: string; iban: string;
  amount: number; currency: string; structured_reference: string; epc_qr_payload: string | null;
};
export type DirectPaymentResultV1 = {
  state: 'instruction_ready' | 'instruction' | 'unknown' | 'unavailable' | 'settled' | 'closed';
  code?: string; payment_intent_id?: string; instruction?: DirectPaymentInstructionV1;
};
type Attempt = {
  tuple: DirectPaymentTupleV1; key: string; payload: string; intentId?: string;
  posted: boolean; unknown: boolean; inFlight?: Promise<DirectPaymentResultV1>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function directPaymentTupleKeyV1(tuple: DirectPaymentTupleV1): string {
  return JSON.stringify([tuple.actor_id, tuple.context_id, tuple.workspace_id, tuple.unit_id,
    tuple.invoice_id, tuple.currency, tuple.amount]);
}
export function validDirectPaymentTupleV1(t: DirectPaymentTupleV1): boolean {
  return [t.actor_id, t.context_id, t.unit_id, t.invoice_id].every(v => uuid.test(v))
    && (t.workspace_id === null || uuid.test(t.workspace_id)) && /^[A-Z]{3}$/.test(t.currency)
    && Number.isFinite(t.amount) && t.amount > 0;
}

export function parseDirectPaymentInstructionV1(i: unknown, tuple: DirectPaymentTupleV1): DirectPaymentInstructionV1 | null {
  if (!i || typeof i !== 'object') return null;
  const value = i as Record<string, unknown>;
  if (typeof value.iban !== 'string' || !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value.iban)
    || value.currency !== tuple.currency || Number(value.amount) !== tuple.amount
    || typeof value.structured_reference !== 'string' || typeof value.association_legal_name !== 'string'
    || typeof value.bank_name !== 'string' || !(value.epc_qr_payload === null || typeof value.epc_qr_payload === 'string')) return null;
  return { association_legal_name: value.association_legal_name, bank_name: value.bank_name, iban: value.iban,
    amount: Number(value.amount), currency: tuple.currency, structured_reference: value.structured_reference, epc_qr_payload: value.epc_qr_payload };
}

export function createDirectPaymentAttemptsV1() {
  const attempts = new Map<string, Attempt>();
  return {
    run(tuple: DirectPaymentTupleV1, transport: typeof fetch): Promise<DirectPaymentResultV1> {
      if (!validDirectPaymentTupleV1(tuple)) return Promise.resolve({ state: 'unavailable', code: 'PAYMENT_CONTEXT_UNAVAILABLE' });
      const identity = directPaymentTupleKeyV1(tuple);
      let attempt = attempts.get(identity);
      if (!attempt) {
        // A refreshed invoice/Workspace must not silently turn an unresolved
        // operation for that actor's invoice into a second independent intent.
        for (const previous of Array.from(attempts.values())) {
          if (previous.posted && previous.tuple.actor_id === tuple.actor_id
            && previous.tuple.unit_id === tuple.unit_id && previous.tuple.invoice_id === tuple.invoice_id) {
            return Promise.resolve({ state: 'unknown', code: 'PAYMENT_OUTCOME_UNKNOWN' });
          }
        }
        const immutable = Object.freeze({ ...tuple });
        const key = `direct-${crypto.randomUUID()}`;
        attempt = { tuple: immutable, key, posted: false, unknown: false,
          payload: JSON.stringify({ context_id: tuple.context_id, unit_id: tuple.unit_id,
            amount: tuple.amount, currency: tuple.currency, payment_method: 'bank_transfer',
            selected_invoices: [{ invoice_id: tuple.invoice_id, amount: tuple.amount }], idempotency_key: key }) };
        attempts.set(identity, attempt);
      }
      if (attempt.inFlight) return attempt.inFlight;
      if (attempt.unknown || (attempt.posted && !attempt.intentId)) {
        // No accepted recovery contract for unknown POST / missing ID. Never mint a retry key.
        return Promise.resolve({ state: 'unknown', code: 'PAYMENT_OUTCOME_UNKNOWN' });
      }
      const current = attempt;
      const execute = async (): Promise<DirectPaymentResultV1> => {
        const read = async (url: string, init?: RequestInit) => {
          const response = await transport(url, { cache: 'no-store', credentials: 'same-origin',
            signal: AbortSignal.timeout(15_000), ...init });
          const json = await response.json();
          return { response, json };
        };
        if (!current.intentId) {
          current.posted = true;
          try {
            const { response, json } = await read('/api/customer/v1/payments/intents', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: current.payload,
            });
            if (!response.ok || !uuid.test(json?.payment_intent_id)) {
              // Even an error response may follow a committed operation. Preserve the attempt.
              current.unknown = true;
              return { state: 'unknown', code: ['PAYMENT_SETUP_REQUIRED', 'PAYMENT_CONTEXT_UNAVAILABLE', 'FORBIDDEN'].includes(json?.error?.code)
                ? json.error.code : 'PAYMENT_OUTCOME_UNKNOWN' };
            }
            current.intentId = json.payment_intent_id;
          } catch {
            current.unknown = true;
            return { state: 'unknown', code: 'PAYMENT_OUTCOME_UNKNOWN' };
          }
        }
        try {
          // Read current canonical status on EVERY known-ID attempt, including instruction retry.
          const intentData = { payment_intent_id: current.intentId };
          const suffix = `?context_id=${encodeURIComponent(tuple.context_id)}`;
          const status = await read(`/api/customer/v1/payments/intents/${intentData.payment_intent_id}${suffix}`);
          const value = status.json;
          if (!status.response.ok || value?.payment_intent_id !== current.intentId
            || value.payment_method !== 'bank_transfer' || value.unit_id !== tuple.unit_id || value.currency !== tuple.currency || Number(value.amount) !== tuple.amount
            || !Array.isArray(value.selected_invoices)
            || !value.selected_invoices.some((item: { invoice_id?: string }) => item.invoice_id === tuple.invoice_id)) {
            return { state: 'unavailable', code: 'PAYMENT_CONTEXT_UNAVAILABLE' };
          }
          if (value.status === 'succeeded' || value.status === 'settled') return { state: 'settled' };
          if (!['created', 'awaiting_provider'].includes(value.status)) return { state: 'closed', code: 'PAYMENT_CONTEXT_UNAVAILABLE' };
          if (typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= Date.now()) {
            return { state: 'closed', code: 'PAYMENT_CONTEXT_UNAVAILABLE' };
          }
          return { state: 'instruction_ready', payment_intent_id: current.intentId };
        } catch {
          return { state: 'unavailable', code: 'PAYMENT_INSTRUCTION_UNAVAILABLE' };
        }
      };
      // Defer execution until inFlight is installed: synchronous double taps share one operation.
      const promise = Promise.resolve().then(execute).finally(() => { current.inFlight = undefined; });
      current.inFlight = promise;
      return promise;
    },
  };
}
