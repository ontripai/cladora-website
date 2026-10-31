import { z } from "zod";
import {
  NOTICE_DRAFT_COMMAND, createNoticeDraftPending, parseNoticeDraftScope, noticeDraftStorageKey,
  prepareNoticeDraftIntent, parseNoticeDraftReceipt,
  type DraftStorage, type NoticeDraftIntent, type NoticeDraftScope, type NoticeDraftPending,
} from "./notice-draft-command";

export const NOTICE_DRAFT_URL = "/api/customer/v1/communications/notice-draft-commands";
const uuid = z.string().uuid().regex(/^[0-9a-f-]+$/);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const receiptSchema = z.object({
  v: z.literal(1), purpose: z.literal(NOTICE_DRAFT_COMMAND), scope: z.unknown(), key: uuid,
  request_hash: digest, receipt_id: uuid, notice_id: uuid, success: z.literal(true),
  status: z.literal("draft"), created_at: z.string().datetime({ offset: true }),
}).strict();
export type DraftBinding = Pick<NoticeDraftIntent, "scope" | "key" | "request_hash">;
function sameScope(a: unknown, b: unknown): boolean {
  const x = parseNoticeDraftScope(a), y = parseNoticeDraftScope(b);
  return x.tenant_id === y.tenant_id && x.principal_id === y.principal_id && x.context_id === y.context_id
    && x.membership_id === y.membership_id && x.workspace_id === y.workspace_id
    && x.target.kind === y.target.kind && x.target.id === y.target.id;
}
/** Strict public response boundary, including metadata-only reload lookup.
 * Shape/binding evidence only, never an attester or replacement codec/engine. */
export function readNoticeDraftReceipt(value: unknown, binding: DraftBinding) {
  const result = receiptSchema.parse(value), scope = parseNoticeDraftScope(result.scope);
  if (!sameScope(scope, binding.scope) || result.key !== binding.key || result.request_hash !== binding.request_hash) throw new Error("INVALID_RECEIPT");
  return Object.freeze({ ...result, scope });
}
export function readNoticeDraftLookup(value: unknown, binding: DraftBinding) {
  const committed = z.object({ state: z.literal("committed"), receipt: z.unknown() }).strict().safeParse(value);
  if (committed.success) return Object.freeze({ state: "committed" as const, receipt: readNoticeDraftReceipt(committed.data.receipt, binding) });
  const absent = z.object({ v: z.literal(1), purpose: z.literal(NOTICE_DRAFT_COMMAND), scope: z.unknown(), key: uuid, state: z.literal("absent_at_check") }).strict().parse(value);
  if (absent.key !== binding.key || !sameScope(absent.scope, binding.scope)) throw new Error("INVALID_LOOKUP");
  return Object.freeze({ ...absent, scope: parseNoticeDraftScope(absent.scope) });
}
export type DraftPhase = "loading" | "ready" | "sending" | "unknown" | "checking" | "retry" | "blocked" | "conflict" | "expired" | "resolved";
export type DraftTransportState = Readonly<{
  phase: DraftPhase; scope: Readonly<NoticeDraftScope> | null; pending: DraftBinding | null;
  receipt: ReturnType<typeof readNoticeDraftReceipt> | null;
  inventory: "unknown" | "empty" | "pending" | "blocked";
  protocolInFlight: "none" | "legacy" | "durable"; durableStarted: boolean;
}>;
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();

/** No module-init browser storage/client access. Call from the mounted browser
 * lifecycle with explicit dependencies. Uses the accepted pending engine only.
 * Local storage is not CAS; erased storage/new devices cannot discover old work.
 * Metadata only, no text, purge, rotation, clock/retention or claim of preventing duplicates.
 */
export function createNoticeDraftTransport(options: {
  fetch: typeof fetch; storage: DraftStorage & Pick<Storage, "length" | "key">; crypto: Pick<Crypto, "subtle" | "randomUUID">;
  isCurrent: () => boolean; onState: (state: DraftTransportState) => void; timeoutMs?: number;
}) {
  let state: DraftTransportState = Object.freeze({ phase: "loading", scope: null, pending: null, receipt: null, inventory: "unknown", protocolInFlight: "none", durableStarted: false });
  let engine: ReturnType<typeof createNoticeDraftPending> | null = null;
  let intent: NoticeDraftIntent | null = null;
  let absence: ReturnType<typeof readNoticeDraftLookup> | null = null;
  let replaceResolved = false, busy = false, generation = 0, disposed = false;
  let contextSelector: string | null = null, observedPending = false;
  let legacyFlight = false, durableFlight = false, durableStarted = false;
  const requests = new Set<() => void>();
  const current = (version: number) => !disposed && version === generation && options.isCurrent();
  function publish(phase: DraftPhase, patch: Partial<DraftTransportState> = {}) {
    state = Object.freeze({ ...state, ...patch, phase, durableStarted,
      protocolInFlight: durableFlight ? "durable" : legacyFlight ? "legacy" : "none" }); options.onState(state);
  }
  async function http(url: string, init: RequestInit = {}) {
    const controller = new AbortController();
    let cancel = () => {}, timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      cancel = () => { controller.abort(); reject(new Error("UNKNOWN")); };
      timer = setTimeout(cancel, options.timeoutMs ?? 15000);
    });
    requests.add(cancel);
    try {
      return await Promise.race([(async () => {
        const response = await options.fetch(url, { ...init, signal: controller.signal, credentials: "same-origin", cache: "no-store" });
        // Bound response bytes too; no replacement UTF8 decoding or 2xx-only success.
        const reader = response.body?.getReader();
        if (!reader) throw new Error("UNKNOWN");
        const chunks: Uint8Array[] = []; let bytes = 0;
        try {
          while (true) { const part = await reader.read(); if (part.done) break;
            bytes += part.value.byteLength; if (bytes > 131072) throw new Error("UNKNOWN"); chunks.push(part.value); }
        } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
        const buffer = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
        const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
        return { response, data };
      })(), deadline]);
    } finally { clearTimeout(timer); requests.delete(cancel); }
  }
  function errorPhase(status: number, data: unknown): DraftPhase {
    const parsed = errorSchema.safeParse(data);
    if (parsed.success && status === 409 && parsed.data.error.code === "COMMAND_CONFLICT") return "conflict";
    if (parsed.success && status === 409 && parsed.data.error.code === "COMMAND_EXPIRED") return "expired";
    if (status === 401 || status === 403) return "blocked";
    return "unknown"; // even current INVALID_COMMAND cannot clear prior UNKNOWN
  }
  type Inventory = { inventory: "empty" } | { inventory: "pending"; scope: ReturnType<typeof parseNoticeDraftScope>;
    pending: NoticeDraftPending; engine: ReturnType<typeof createNoticeDraftPending> };
  function inspectLocal(context: string): Inventory {
    // Local, read-only and independent of projection/network/permission readiness.
    // This probe only checks read capability; it creates no storage key or state.
    if (options.storage.getItem(NOTICE_DRAFT_COMMAND) !== null) throw new Error("INVALID_PENDING_SLOT");
    const count = options.storage.length;
    if (!Number.isSafeInteger(count) || count < 0 || count > 4096) throw new Error("STORAGE_BLOCKED");
    const seen = new Set<string>(), retained: Extract<Inventory, { inventory: "pending" }>[] = [];
    for (let i = 0; i < count; i++) {
      const slot = options.storage.key(i);
      if (slot === null || seen.has(slot)) throw new Error("STORAGE_CHANGED");
      seen.add(slot);
      if (!slot.startsWith(`${NOTICE_DRAFT_COMMAND}:`)) continue;
      const parts = slot.split(":");
      if (parts.length !== 8) throw new Error("INVALID_PENDING_SLOT");
      const scope = parseNoticeDraftScope({ tenant_id: parts[1], principal_id: parts[2], context_id: parts[3],
        membership_id: parts[4], workspace_id: parts[5], target: { kind: parts[6], id: parts[7] } });
      if (noticeDraftStorageKey(scope) !== slot) throw new Error("INVALID_PENDING_SLOT");
      if (scope.context_id !== context) continue;
      observedPending = true;
      const local = createNoticeDraftPending(options.storage, scope, options.crypto.subtle), loaded = local.load();
      if (loaded.state !== "pending") throw new Error("PENDING_UNAVAILABLE");
      retained.push({ inventory: "pending", scope, pending: loaded.pending, engine: local });
    }
    if (options.storage.length !== count || retained.length > 1) throw new Error("INCOMPLETE_OR_AMBIGUOUS_INVENTORY");
    if (!retained.length && (observedPending || state.pending)) throw new Error("OBSERVED_PENDING_MISSING");
    return retained[0] ?? { inventory: "empty" };
  }
  function refreshInventory(): Inventory | null {
    if (!contextSelector || disposed || !options.isCurrent()) return null;
    try {
      const inspected = inspectLocal(contextSelector);
      if (inspected.inventory === "pending") {
        if (state.pending && (state.pending.key !== inspected.pending.key || state.pending.request_hash !== inspected.pending.request_hash
          || !sameScope(state.pending.scope, inspected.scope))) throw new Error("OBSERVED_PENDING_CHANGED");
        if (!state.pending) {
          engine = inspected.engine;
          publish(inspected.pending.phase, { inventory: "pending", scope: inspected.scope, pending: inspected.pending });
        } else publish(state.phase, { inventory: "pending" });
      } else publish(state.phase, { inventory: "empty" });
      return inspected;
    } catch { publish("blocked", { inventory: "blocked" }); return null; }
  }
  async function open(context: string, membership: string) {
    if (busy || disposed || contextSelector !== null) return;
    contextSelector = context;
    busy = true; const version = generation;
    try {
      if (!refreshInventory()) return; // inspect BEFORE the optional bootstrap
      const { response, data } = await http(`${NOTICE_DRAFT_URL}?${new URLSearchParams({ action: "scope", context_id: context })}`);
      if (!current(version)) return;
      if (!response.ok) throw new Error("SCOPE_UNAVAILABLE");
      const envelope = z.object({ v: z.literal(1), scope: z.unknown() }).strict().parse(data);
      const scope = parseNoticeDraftScope(envelope.scope);
      if (scope.context_id !== context || scope.membership_id !== membership) throw new Error("SCOPE_CHANGED");
      const inspected = refreshInventory(); // no stale pre-await empty decision
      if (!inspected) return;
      if (inspected.inventory === "pending") {
        const drift = !sameScope(inspected.scope, scope);
        publish(inspected.pending.phase === "unknown" ? drift ? "blocked" : "unknown" : inspected.pending.phase,
          { scope: inspected.scope, pending: inspected.pending });
      } else {
        engine = createNoticeDraftPending(options.storage, scope, options.crypto.subtle);
        publish("ready", { scope });
      }
    } catch { if (current(version)) publish("blocked"); } // keep local inventory intact
    finally { busy = false; }
  }
  function beginLegacy(): (() => void) | null {
    if (disposed || !options.isCurrent() || durableStarted || durableFlight || legacyFlight) return null;
    const inspected = refreshInventory();
    if (!inspected || inspected.inventory !== "empty") return null;
    // No await between a fresh local inspection and the shared protocol fence.
    // Bootstrap busy/readiness is deliberately irrelevant. Not a cross-tab CAS.
    legacyFlight = true; const version = generation; publish(state.phase);
    let released = false;
    return () => { if (released) return; released = true; legacyFlight = false;
      if (current(version)) publish(state.phase); };
  }
  async function captureAgain(payload: unknown): Promise<NoticeDraftIntent> {
    if (!state.scope || !state.pending) throw new Error("NO_PENDING");
    const candidate = intent ?? await prepareNoticeDraftIntent(state.scope, state.pending.key, payload, options.crypto.subtle);
    if (candidate.request_hash !== state.pending.request_hash) throw new Error("EXACT_REENTRY_REQUIRED");
    return candidate;
  }
  async function send(payload: unknown, retry = false) {
    if (busy || legacyFlight || disposed || !state.scope || !engine || !options.isCurrent()
      || (retry ? state.phase !== "retry" || !absence : state.phase !== "ready")) return;
    const inspected = refreshInventory();
    if (!inspected || (retry ? state.phase !== "retry" : state.phase !== "ready")
      || (!retry && !replaceResolved && inspected.inventory !== "empty")) return;
    busy = true; durableFlight = true; durableStarted = true; publish(state.phase);
    const version = generation; const local = engine;
    let ticket: Parameters<typeof local.mark>[2] | null = null;
    try {
      const candidate = retry ? await captureAgain(payload)
        : await prepareNoticeDraftIntent(state.scope, options.crypto.randomUUID(), payload, options.crypto.subtle);
      if (!current(version)) return;
      if (retry && local.observeLookup(absence, candidate).state !== "same_intent_only") throw new Error("NO_AUTHORIZED_ABSENCE");
      intent = candidate;
      const admission = await local.admit(candidate, retry ? { explicit: true, retryLookup: absence }
        : replaceResolved ? { explicit: true, replaceResolved: true } : undefined);
      if (!current(version)) return;
      if (admission.state !== "admitted") { publish("blocked"); return; }
      ticket = admission.ticket; replaceResolved = false; absence = null;
      const loaded = local.load();
      if (loaded.state !== "pending") throw new Error("PENDING_UNAVAILABLE");
      publish("sending", { pending: loaded.pending, receipt: null });
      const body = JSON.stringify({ p_context_id: candidate.scope.context_id, p_idempotency_key: candidate.key,
        p_payload: { v: candidate.v, purpose: candidate.purpose, scope: candidate.scope,
          payload: candidate.payload, request_hash: candidate.request_hash } });
      const { response, data } = await http(NOTICE_DRAFT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!current(version)) return;
      if (!response.ok) {
        const phase = errorPhase(response.status, data);
        local.mark(candidate, phase === "conflict" ? "conflict" : phase === "expired" ? "expired" : "unknown", ticket); ticket = null;
        publish(phase); return;
      }
      const receipt = parseNoticeDraftReceipt(data, candidate);
      local.mark(candidate, "unknown", ticket); ticket = null;
      if (local.observeLookup({ state: "committed", receipt }, candidate).state !== "resolved") throw new Error("UNRESOLVED");
      publish("resolved", { receipt });
      return receipt;
    } catch {
      if (current(version)) {
        if (ticket && intent) local.mark(intent, "unknown", ticket);
        publish(state.pending ? "unknown" : "ready");
      }
    } finally { busy = false; durableFlight = false; if (current(version)) publish(state.phase); }
  }
  async function check() {
    if (busy || disposed || !engine || !state.pending || !options.isCurrent()
      || !["unknown", "retry", "blocked"].includes(state.phase)) return;
    busy = true; const version = generation; const binding = state.pending; absence = null;
    publish("checking");
    try {
      const { response, data } = await http(`${NOTICE_DRAFT_URL}?${new URLSearchParams({ action: "lookup", context_id: binding.scope.context_id,
        key: binding.key, request_hash: binding.request_hash })}`);
      if (!current(version)) return;
      if (!response.ok) { publish(errorPhase(response.status, data)); return; }
      const result = readNoticeDraftLookup(data, binding);
      if (result.state === "committed") {
        if (intent && engine.observeLookup(result, intent).state !== "resolved") throw new Error("UNRESOLVED");
        publish("resolved", { receipt: result.receipt });
      } else { absence = result; publish("retry"); }
    } catch { if (current(version)) publish("unknown"); }
    finally { busy = false; }
  }
  async function newDraft(payload: unknown) {
    if (busy || disposed || state.phase !== "resolved" || !state.receipt || !engine) return;
    busy = true; const version = generation;
    try {
      const candidate = await captureAgain(payload);
      if (!current(version)) return;
      if (engine.observeLookup({ state: "committed", receipt: state.receipt }, candidate).state !== "resolved") return;
      replaceResolved = true; intent = null; absence = null; publish("ready", { receipt: null });
    } catch { /* retain matched receipt and pending; identical text re-entry needed */ }
    finally { busy = false; }
  }
  return Object.freeze({ open, beginLegacy, send: (payload: unknown) => send(payload), retry: (payload: unknown) => send(payload, true), check, newDraft,
    getState: () => state,
    dispose() { disposed = true; generation++; requests.forEach(cancel => cancel()); requests.clear(); },
  });
}
