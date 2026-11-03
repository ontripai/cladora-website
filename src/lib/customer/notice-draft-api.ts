import { webcrypto } from "node:crypto";
import { z } from "zod";
import { dashboardRpcResponseSchema } from "./dashboard-schema";
import { NOTICE_DRAFT_COMMAND, parseNoticeDraftScope, prepareNoticeDraftIntent } from "./notice-draft-command";
import { dispatchNoticeDraftRpcInput, type NoticeDraftRpcJson } from "./notice-draft-rpc-input";
import { readNoticeDraftLookup, readNoticeDraftReceipt, type DraftBinding } from "./notice-draft-transport";
import { hasTrustedMutationOrigin } from "../security/same-origin";

export const NOTICE_DRAFT_HEADERS = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };
const MAX_BYTES = 256 * 1024;
const uuid = z.string().uuid().regex(/^[0-9a-f-]+$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const commandSchema = z.object({ p_context_id: uuid, p_idempotency_key: uuid,
  p_payload: z.object({ v: z.literal(1), purpose: z.literal(NOTICE_DRAFT_COMMAND), scope: z.unknown(), payload: z.unknown(), request_hash: hash }).strict(),
}).strict();
const contextSchema = z.object({ context_id: uuid, membership_id: uuid, tenant_id: uuid, tenant_name: z.string().min(1),
  role_code: z.string().min(1), role_name: z.string().min(1), scope_type: z.enum(["tenant", "property", "building", "unit"]),
  property_id: uuid.nullable(), building_id: uuid.nullable(), unit_id: uuid.nullable(), context_label: z.string(),
  starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }).nullable(),
}).strict();
export type NoticeDraftApiClient = {
  auth: { getClaims(): PromiseLike<{ data: { claims?: { sub?: string } } | null; error: unknown }> };
  schema(name: "customer_api"): { rpc(name: string, args: NoticeDraftRpcJson): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> };
};
class BoundedError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
function fail(status = 400, code = "INVALID_COMMAND"): never { throw new BoundedError(status, code); }
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const x = Object.keys(a), y = Object.keys(b);
  return x.length === y.length && x.every(key => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
function rpcFailure(error: { code?: string; message?: string }): never {
  if (error.code === "42501") fail(error.message === "authentication_required" ? 401 : 403,
    error.message === "authentication_required" ? "UNAUTHORIZED" : "FORBIDDEN");
  if (error.code === "22023" && error.message === "COMMAND_CONFLICT") fail(409, "COMMAND_CONFLICT");
  if (error.code === "55000" && error.message === "COMMAND_EXPIRED") fail(409, "COMMAND_EXPIRED");
  if (error.code === "22023" && ["INVALID_COMMAND", "INVALID_COMMAND_HASH"].includes(error.message ?? "")) fail();
  fail(503, "UNKNOWN"); // no SQLSTATE-class shortcuts, raw error or legacy fallback
}
async function rpc(client: NoticeDraftApiClient, name: string, args: unknown) {
  const result = await dispatchNoticeDraftRpcInput(args, snapshot => client.schema("customer_api").rpc(name, snapshot));
  if (result.state === "rejected") fail();
  if (result.value.error) rpcFailure(result.value.error);
  return result.value.data;
}
/** Complete byte count, fatal UTF8 BEFORE JSON.parse; never request.json/text.
 * Independent durable reader: shared legacy replacement decoder is untouched. */
async function body(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) fail(413, "INVALID_COMMAND");
  const reader = request.body?.getReader(); if (!reader) fail();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength; if (bytes > MAX_BYTES) fail(413, "INVALID_COMMAND"); chunks.push(part.value); }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); } catch { fail(); }
}
function query(request: Request) {
  const raw = new URL(request.url).search.slice(1);
  if (raw.length > 1024) fail();
  const fields: Record<string, string> = Object.create(null);
  for (const pair of raw ? raw.split("&") : []) {
    const at = pair.indexOf("="); if (at < 0) fail();
    let key: string, value: string;
    try { key = decodeURIComponent(pair.slice(0, at).replace(/\+/g, " ")); value = decodeURIComponent(pair.slice(at + 1).replace(/\+/g, " ")); } catch { fail(); }
    if (Object.hasOwn(fields, key)) fail(); fields[key] = value;
  }
  return z.discriminatedUnion("action", [
    z.object({ action: z.literal("scope"), context_id: uuid }).strict(),
    z.object({ action: z.literal("lookup"), context_id: uuid, key: uuid, request_hash: hash }).strict(),
  ]).parse(fields);
}
async function projection(client: NoticeDraftApiClient, context: string, principal: string) {
  const contexts = z.array(contextSchema).parse(await rpc(client, "list_contexts_v1", {}));
  const matches = contexts.filter(item => item.context_id === context);
  if (matches.length !== 1 || matches[0].role_code === "building_setup_reviewer") fail(403, "FORBIDDEN");
  const selected = matches[0];
  const dashboard = dashboardRpcResponseSchema.parse(await rpc(client, "get_dashboard_v1", { p_context_id: context }));
  const c = dashboard.context;
  if (dashboard.contextId !== context || c.id !== context || dashboard.persona !== c.role_code
    || c.role_code !== selected.role_code || c.tenant_id !== selected.tenant_id || c.scope_type !== selected.scope_type
    || (c.property_id ?? null) !== selected.property_id || (c.building_id ?? null) !== selected.building_id
    || (c.unit_id ?? null) !== selected.unit_id) fail(403, "FORBIDDEN");
  const target = c.scope_type === "tenant" ? c.tenant_id : c.scope_type === "property" ? c.property_id
    : c.scope_type === "building" ? c.building_id : c.unit_id;
  if (!target) fail(403, "FORBIDDEN");
  // This projection is correlation/canonical input, NEVER manage/session proof.
  // No permission/role token, metadata principal or browser-supplied target.
  return parseNoticeDraftScope({ tenant_id: c.tenant_id, principal_id: principal, context_id: context,
    membership_id: selected.membership_id, workspace_id: dashboard.workspace_id, target: { kind: c.scope_type, id: target } });
}
export async function handleNoticeDraftRequest(request: Request, createClient: () => Promise<NoticeDraftApiClient>): Promise<Response> {
  let acceptingInput = true;
  try {
    if (!["GET", "POST"].includes(request.method)) fail(405, "INVALID_COMMAND");
    if (request.method === "POST" && !hasTrustedMutationOrigin(request)) fail(403, "BAD_ORIGIN");
    if (request.method === "GET" && request.headers.has("origin") && !hasTrustedMutationOrigin(request)) fail(403, "BAD_ORIGIN");
    if (request.method === "POST" && !/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get("content-type") ?? "")) fail(415, "INVALID_COMMAND");
    let incoming: z.infer<typeof commandSchema> | null = null;
    let intent: Awaited<ReturnType<typeof prepareNoticeDraftIntent>> | null = null;
    let read: ReturnType<typeof query> | null = null;
    if (request.method === "POST") {
      if (new URL(request.url).search) fail();
      const checked = await dispatchNoticeDraftRpcInput(await body(request), snapshot => snapshot);
      if (checked.state === "rejected") fail();
      incoming = commandSchema.parse(checked.value);
      try { intent = await prepareNoticeDraftIntent(incoming.p_payload.scope, incoming.p_idempotency_key, incoming.p_payload.payload, webcrypto.subtle); } catch { fail(); }
      if (incoming.p_context_id !== intent.scope.context_id || intent.request_hash !== incoming.p_payload.request_hash
        || !equal(intent.scope, incoming.p_payload.scope) || !equal(intent.payload, incoming.p_payload.payload)) fail();
    } else {
      read = query(request);
      const checked = await dispatchNoticeDraftRpcInput(read, snapshot => snapshot);
      if (checked.state === "rejected") fail();
    }
    acceptingInput = false;
    const client = await createClient();
    const { data: claims, error } = await client.auth.getClaims();
    if (error || !claims?.claims?.sub || !uuid.safeParse(claims.claims.sub).success) fail(401, "UNAUTHORIZED");
    const context = intent?.scope.context_id ?? read!.context_id;
    const scope = await projection(client, context, claims.claims.sub);
    if (intent) {
      if (!equal(scope, intent.scope)) fail(403, "FORBIDDEN");
      const result = await rpc(client, "create_notice_draft_command_v1", {
        p_context_id: intent.scope.context_id, p_idempotency_key: intent.key,
        p_payload: { v: intent.v, purpose: intent.purpose, scope: intent.scope, payload: intent.payload, request_hash: intent.request_hash },
      });
      return Response.json(readNoticeDraftReceipt(result, intent), { status: 201, headers: NOTICE_DRAFT_HEADERS });
    }
    if (read!.action === "scope") return Response.json({ v: 1, scope }, { headers: NOTICE_DRAFT_HEADERS });
    const lookup = read as Extract<NonNullable<typeof read>, { action: "lookup" }>;
    const binding: DraftBinding = { scope, key: lookup.key, request_hash: lookup.request_hash };
    const result = await rpc(client, "get_notice_draft_command_v1", { p_context_id: context, p_idempotency_key: lookup.key });
    return Response.json(readNoticeDraftLookup(result, binding), { headers: NOTICE_DRAFT_HEADERS });
  } catch (error) {
    const bounded = error instanceof BoundedError ? error : acceptingInput && error instanceof z.ZodError ? new BoundedError(400, "INVALID_COMMAND") : new BoundedError(503, "UNKNOWN");
    return Response.json({ error: { code: bounded.code, message: "Draft request could not be confirmed." } }, { status: bounded.status, headers: NOTICE_DRAFT_HEADERS });
  }
}
