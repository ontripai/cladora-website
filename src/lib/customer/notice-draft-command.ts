import { z } from "zod";
import { createNoticeDraftSchema } from "./communications-schema";

/** INERT PROPOSAL, not an existing API contract or authorization provider.
 * No transport, environment, global storage, clock, key generation or retention policy.
 * Hashes are client correlation only; a future server MUST independently authorize
 * and recompute them. A parsed receipt is shape/binding evidence, not authenticity.
 *
 * Encoding v1: literal header below, then ordered (name,value) frames. Each frame
 * is N; for absent optional text, or S<decimal UTF8 byte length>:<text>; otherwise.
 * No JSON escaping/NFC normalization. Lone surrogates rejected. UUIDs lowercase.
 * Parsed HTTP composer payload, NOT raw textarea state: explicit optional empty
 * strings remain present (SQL '' differs from NULL); omission/undefined => N;.
 * The accepted UI already omits blank translations. Enum defaults/trim/UTF16
 * field limits come from the actual existing schema. Key excluded from hash.
 * This encoding is NOT asserted equivalent to PostgreSQL jsonb::text.
 */
export const NOTICE_DRAFT_COMMAND = "ce.notice-draft.command.v1" as const;
export const NOTICE_DRAFT_ENCODING = "CE_NOTICE_DRAFT_COMMAND_V1\n";
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const scopeSchema = z.object({
  tenant_id: uuid, principal_id: uuid, context_id: uuid, membership_id: uuid,
  workspace_id: uuid,
  target: z.object({ kind: z.enum(["tenant", "property", "building", "unit"]), id: uuid }).strict(),
}).strict().refine(s => s.target.kind !== "tenant" || s.target.id === s.tenant_id);
const payloadSchema = createNoticeDraftSchema.pick({
  context_id: true, title_ro: true, body_ro: true, title_en: true, body_en: true,
  title_fa: true, body_fa: true, communication_type: true,
  legal_classification: true, source_module: true,
}).strict();
export type NoticeDraftScope = z.output<typeof scopeSchema>;
export type NoticeDraftPayload = z.output<typeof payloadSchema>;
export type NoticeDraftIntent = Readonly<{
  v: 1; purpose: typeof NOTICE_DRAFT_COMMAND; key: string; request_hash: string;
  scope: Readonly<Omit<NoticeDraftScope, "target"> & { target: Readonly<NoticeDraftScope["target"]> }>;
  payload: Readonly<NoticeDraftPayload>;
}>;
export type DraftDigest = Pick<SubtleCrypto, "digest">;
export type DraftStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export type DraftAdmission = Readonly<{ sequence: number }>;
const metadataSchema = z.object({
  v: z.literal(1), purpose: z.literal(NOTICE_DRAFT_COMMAND), scope: scopeSchema,
  key: uuid, request_hash: digest, phase: z.enum(["unknown", "conflict", "expired"]),
}).strict();
export type NoticeDraftPending = z.output<typeof metadataSchema>;
const timestamp = z.string().datetime({ offset: true });
const receiptSchema = z.object({
  v: z.literal(1), purpose: z.literal(NOTICE_DRAFT_COMMAND), scope: scopeSchema,
  key: uuid, request_hash: digest, receipt_id: uuid, notice_id: uuid,
  success: z.literal(true), status: z.literal("draft"), created_at: timestamp,
}).strict();
const lookupSchema = z.discriminatedUnion("state", [
  z.object({ v: z.literal(1), purpose: z.literal(NOTICE_DRAFT_COMMAND), scope: scopeSchema,
    key: uuid, state: z.literal("absent_at_check") }).strict(),
  z.object({ state: z.literal("committed"), receipt: receiptSchema }).strict(),
]);
export type DraftLocalResult =
  | { state: "blocked"; reason: string }
  | { state: "empty" }
  | { state: "pending"; pending: NoticeDraftPending }
  | { state: "admitted"; key: string; request_hash: string; ticket: DraftAdmission }
  | { state: "same_intent_only" }
  | { state: "resolved" };
function blocked(reason: string): DraftLocalResult { return { state: "blocked", reason }; }
function parse<T>(schema: z.ZodType<T>, input: unknown, code: string): T {
  const value = schema.safeParse(input);
  if (!value.success) throw new Error(code); // never expose Zod input/error text
  return value.data;
}
function textBytes(value: string): Uint8Array {
  for (let i = 0; i < value.length; i++) {
    const n = value.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("INVALID_TEXT");
    } else if (n >= 0xdc00 && n <= 0xdfff) throw new Error("INVALID_TEXT");
  }
  return new TextEncoder().encode(value);
}
function freezeScope(scope: NoticeDraftScope) { Object.freeze(scope.target); return Object.freeze(scope); }
function scopeKey(s: NoticeDraftScope): string {
  return [s.tenant_id, s.principal_id, s.context_id, s.membership_id, s.workspace_id, s.target.kind, s.target.id].join(":");
}
export function parseNoticeDraftScope(input: unknown) { return freezeScope(parse(scopeSchema, input, "INVALID_SCOPE")); }
export function noticeDraftStorageKey(input: unknown): string {
  return `${NOTICE_DRAFT_COMMAND}:${scopeKey(parseNoticeDraftScope(input))}`;
}
export function canonicalNoticeDraft(inputScope: unknown, inputPayload: unknown): string {
  const scope = parseNoticeDraftScope(inputScope);
  const payload = parse(payloadSchema, inputPayload, "INVALID_PAYLOAD");
  if (payload.context_id.toLowerCase() !== scope.context_id) throw new Error("FOREIGN_CONTEXT");
  const fields: [string, string | null][] = [
    ["purpose", NOTICE_DRAFT_COMMAND], ["tenant_id", scope.tenant_id],
    ["principal_id", scope.principal_id], ["context_id", scope.context_id],
    ["membership_id", scope.membership_id], ["workspace_id", scope.workspace_id],
    ["scope_kind", scope.target.kind], ["scope_id", scope.target.id],
    ["title_ro", payload.title_ro], ["body_ro", payload.body_ro],
    ["title_en", payload.title_en ?? null], ["body_en", payload.body_en ?? null],
    ["title_fa", payload.title_fa ?? null], ["body_fa", payload.body_fa ?? null],
    ["communication_type", payload.communication_type],
    ["legal_classification", payload.legal_classification], ["source_module", payload.source_module],
  ];
  const frame = (s: string | null) => s === null ? "N;" : `S${textBytes(s).length}:${s};`;
  return NOTICE_DRAFT_ENCODING + fields.map(([name, value]) => frame(name) + frame(value)).join("");
}
export async function prepareNoticeDraftIntent(inputScope: unknown, inputKey: unknown, inputPayload: unknown, crypto: DraftDigest): Promise<NoticeDraftIntent> {
  // Clone/validate before await: caller edits cannot change the hashed snapshot.
  const scope = parseNoticeDraftScope(inputScope);
  const key = parse(uuid, inputKey, "INVALID_KEY");
  const parsed = parse(payloadSchema, inputPayload, "INVALID_PAYLOAD");
  const payload = Object.freeze({ ...parsed, context_id: parsed.context_id.toLowerCase() });
  const canonical = canonicalNoticeDraft(scope, payload);
  let result: ArrayBuffer;
  try { result = await crypto.digest("SHA-256", new Uint8Array(textBytes(canonical))); }
  catch { throw new Error("DIGEST_UNAVAILABLE"); }
  if (result.byteLength !== 32) throw new Error("INVALID_DIGEST");
  const request_hash = Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, "0")).join("");
  return Object.freeze({ v: 1, purpose: NOTICE_DRAFT_COMMAND, scope, key, payload, request_hash });
}
export function parseNoticeDraftReceipt(input: unknown, expected: NoticeDraftIntent) {
  const receipt = parse(receiptSchema, input, "INVALID_RECEIPT");
  const binding = metadata(expected, "unknown");
  if (scopeKey(receipt.scope) !== scopeKey(binding.scope) || receipt.key !== binding.key || receipt.request_hash !== binding.request_hash) throw new Error("FOREIGN_RECEIPT");
  freezeScope(receipt.scope); return Object.freeze(receipt);
}
function metadata(intent: NoticeDraftIntent, phase: NoticeDraftPending["phase"]): NoticeDraftPending {
  if (!intent || intent.v !== 1 || intent.purpose !== NOTICE_DRAFT_COMMAND) throw new Error("INVALID_INTENT");
  return parse(metadataSchema, { v: 1, purpose: NOTICE_DRAFT_COMMAND, scope: intent.scope,
    key: intent.key, request_hash: intent.request_hash, phase }, "INVALID_INTENT");
}
function same(a: NoticeDraftPending, b: NoticeDraftPending) {
  return scopeKey(a.scope) === scopeKey(b.scope) && a.key === b.key && a.request_hash === b.request_hash;
}
/** Explicit local admission only. Injected storage is not CAS or cross-tab authority.
 * Readback proposals must come from a CURRENT authorized server call when wired.
 * No erase API: unknown/conflict/expiry never silently rotate. A resolved receipt
 * is held only in memory; remount requires a fresh current receipt again.
 * Erased origin storage/new devices and legal retention policy remain UNRESOLVED.
 */
export function createNoticeDraftPending(storage: DraftStorage, inputScope: unknown, crypto: DraftDigest) {
  const scope = parseNoticeDraftScope(inputScope), slot = noticeDraftStorageKey(scope);
  let failure: string | null = null, inFlight = false;
  let generation = 0;
  let currentTicket: DraftAdmission | null = null;
  let resolved: NoticeDraftPending | null = null;
  function load(): DraftLocalResult {
    if (failure) return blocked(failure);
    try {
      const raw = storage.getItem(slot);
      if (raw === null) return { state: "empty" };
      if (raw.length > 4096 || textBytes(raw).length > 4096) throw new Error("INVALID_PENDING");
      const pending = parse(metadataSchema, JSON.parse(raw), "INVALID_PENDING");
      if (scopeKey(pending.scope) !== scopeKey(scope)) throw new Error("FOREIGN_PENDING");
      freezeScope(pending.scope); Object.freeze(pending);
      return { state: "pending", pending };
    } catch { failure = "STORAGE_OR_PENDING_BLOCKED"; return blocked(failure); }
  }
  function save(value: NoticeDraftPending): boolean {
    try {
      const raw = JSON.stringify(value);
      storage.setItem(slot, raw);
      if (storage.getItem(slot) !== raw) throw new Error("READBACK_MISMATCH");
      return true;
    } catch { failure = "STORAGE_WRITE_BLOCKED"; return false; }
  }
  function lookup(value: unknown, intent: NoticeDraftIntent): "committed" | "absent_at_check" {
    const parsed = parse(lookupSchema, value, "INVALID_LOOKUP");
    if (parsed.state === "committed") { parseNoticeDraftReceipt(parsed.receipt, intent); return "committed"; }
    if (scopeKey(parsed.scope) !== scopeKey(scope) || parsed.key !== intent.key) throw new Error("FOREIGN_LOOKUP");
    return "absent_at_check";
  }
  async function admit(intent: NoticeDraftIntent, options?: { explicit: true; retryLookup?: unknown; replaceResolved?: true }): Promise<DraftLocalResult> {
    if (inFlight) return blocked("IN_FLIGHT");
    if (failure) return blocked(failure);
    inFlight = true; // before any async digest: synchronous double admission guard
    let admitted = false;
    try {
      const checked = await prepareNoticeDraftIntent(intent.scope, intent.key, intent.payload, crypto);
      if (intent.v !== 1 || intent.purpose !== NOTICE_DRAFT_COMMAND || checked.request_hash !== intent.request_hash
        || scopeKey(checked.scope) !== scopeKey(scope)) return blocked("INVALID_INTENT");
      const loaded = load();
      if (loaded.state === "blocked") return loaded;
      if (loaded.state === "pending") {
        if (loaded.pending.phase !== "unknown") return blocked("CONFLICT_OR_EXPIRY_BLOCKED");
        if (options?.explicit !== true) return blocked("PENDING_REQUIRES_RECONCILIATION");
        if (options.replaceResolved) {
          if (!resolved || !same(resolved, loaded.pending) || checked.key === loaded.pending.key) return blocked("UNRESOLVED_OR_REUSED_KEY");
        } else {
          if (!same(metadata(checked, "unknown"), loaded.pending) || lookup(options.retryLookup, checked) !== "absent_at_check") return blocked("EXACT_RETRY_ONLY");
        }
      } else if (options) return blocked("NO_PENDING_TO_RECONCILE");
      const pending = metadata(checked, "unknown");
      if (!save(pending)) return blocked(failure!);
      resolved = null; admitted = true;
      currentTicket = Object.freeze({ sequence: ++generation });
      return { state: "admitted", key: checked.key, request_hash: checked.request_hash, ticket: currentTicket };
    } catch { return blocked("INVALID_INTENT_OR_LOOKUP"); }
    finally { if (!admitted) inFlight = false; }
  }
  function mark(intent: NoticeDraftIntent, phase: NoticeDraftPending["phase"], ticket: DraftAdmission): DraftLocalResult {
    if (!currentTicket || ticket !== currentTicket) return blocked("STALE_ADMISSION");
    const loaded = load();
    if (loaded.state !== "pending") return blocked("NO_CURRENT_PENDING");
    try {
      if (!same(metadata(intent, "unknown"), loaded.pending)) return blocked("STALE_INTENT");
      if (!["unknown", "conflict", "expired"].includes(phase)) return blocked("INVALID_PHASE");
      // Terminal blocked evidence cannot be downgraded by late unknown/finally.
      if (loaded.pending.phase !== "unknown") return blocked("CONFLICT_OR_EXPIRY_BLOCKED");
      if (!save(metadata(intent, phase))) return blocked(failure!);
      resolved = null; inFlight = false; currentTicket = null;
      return load();
    } catch { return blocked("INVALID_INTENT"); }
  }
  function observeLookup(value: unknown, intent: NoticeDraftIntent): DraftLocalResult {
    if (inFlight) return blocked("IN_FLIGHT");
    const loaded = load();
    if (loaded.state !== "pending") return blocked("NO_CURRENT_PENDING");
    try {
      if (!same(metadata(intent, "unknown"), loaded.pending)) return blocked("STALE_INTENT");
      if (loaded.pending.phase !== "unknown") return blocked("CONFLICT_OR_EXPIRY_BLOCKED");
      if (lookup(value, intent) === "absent_at_check") { resolved = null; return { state: "same_intent_only" }; }
      resolved = loaded.pending;
      return { state: "resolved" };
    } catch { resolved = null; return blocked("INVALID_RECEIPT_OR_LOOKUP"); }
  }
  return Object.freeze({ load, admit, mark, observeLookup });
}
