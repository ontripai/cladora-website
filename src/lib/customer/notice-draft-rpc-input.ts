import { types } from "node:util";

/** Inactive Node-only preparation boundary, NOT a transport or schema/auth check.
 * Caller must supply the COMPLETE already-schema-valid RPC arguments. No codec,
 * hash, storage, key ownership, network client, mode selection or retry lives here.
 * Future durable wiring must use this entry before EVERY product dispatch, and
 * serialize this snapshot rather than rebuild arguments from mutable input.
 * Legacy route/UI do not import this module. BEFORE_TRANSPORT_IMPLEMENTATION
 * remains OPEN. Finite numbers do not prove PostgreSQL numeric-range support.
 */
export type NoticeDraftRpcJson = null | boolean | number | string
  | readonly NoticeDraftRpcJson[] | { readonly [key: string]: NoticeDraftRpcJson };
export type NoticeDraftRpcDispatchResult<T> =
  | Readonly<{ state: "rejected"; code: "INVALID_COMMAND"; dispatched: false }>
  | Readonly<{ state: "dispatched"; dispatched: true; value: T }>;

const invalid = Object.freeze({ state: "rejected", code: "INVALID_COMMAND", dispatched: false } as const);
function reject(): never { throw new Error("INVALID_COMMAND"); }
function checkText(text: string): void {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) reject();
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) reject();
    } else if (code >= 0xdc00 && code <= 0xdfff) reject();
  }
}

// Iterative capture avoids recursion-depth truncation. Only ordinary JSON data
// objects/dense arrays are admitted. Descriptors prevent getter/toJSON execution;
// proxies are rejected before introspection (including revoked proxies/traps).
// Non-enumerable/symbol/accessor/custom-prototype properties are never discarded.
// Shared acyclic references are copied; cycles are rejected. No input is frozen.
function capture(input: unknown): NoticeDraftRpcJson {
  type Job = { value: unknown; put: (value: NoticeDraftRpcJson) => void }
    | { leave: object; copy: object };
  let result: NoticeDraftRpcJson = null;
  const active = new WeakSet<object>();
  const copies = new WeakMap<object, NoticeDraftRpcJson>();
  const jobs: Job[] = [{ value: input, put: value => { result = value; } }];
  while (jobs.length) {
    const job = jobs.pop()!;
    if ("leave" in job) {
      Object.freeze(job.copy); active.delete(job.leave); continue;
    }
    const value = job.value;
    if (value === null || typeof value === "boolean") { job.put(value); continue; }
    if (typeof value === "string") { checkText(value); job.put(value); continue; }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) reject();
      job.put(value); continue;
    }
    if (typeof value !== "object" || types.isProxy(value)) reject();
    if (active.has(value)) reject();
    if (copies.has(value)) { job.put(copies.get(value)!); continue; }
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) reject();
    const keys = Reflect.ownKeys(value);
    const entries: [string, unknown][] = [];
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
      if (keys.length !== length + 1) reject(); // holes/custom/symbol members
      for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) reject();
        entries.push([String(i), descriptor.value]);
      }
    } else {
      for (const key of keys) {
        if (typeof key !== "string") reject();
        checkText(key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!("value" in descriptor) || !descriptor.enumerable) reject();
        entries.push([key, descriptor.value]);
      }
    }
    // Null prototype preserves JSON keys such as __proto__ without setters.
    const copy = array ? [] : Object.create(null);
    copies.set(value, copy); active.add(value); job.put(copy);
    jobs.push({ leave: value, copy });
    for (let i = entries.length - 1; i >= 0; i--) {
      const [key, child] = entries[i];
      jobs.push({ value: child, put: captured => {
        Object.defineProperty(copy, key, { value: captured, enumerable: true, configurable: true, writable: true });
      } });
    }
  }
  return result;
}

/** The sole runtime export/dispatch entry. Capture completes synchronously before
 * the first callback/await. Rejection describes THIS never-dispatched attempt
 * only; a future adapter may map it to bounded HTTP400, never to old absence or
 * cancellation. No HTTP mapping is implemented. Prior UNKNOWN stays UNKNOWN.
 * Callback errors propagate unchanged; returned unknown evidence is untouched.
 * `dispatched` means callback invoked, NOT commit, receipt, success or SQL proof.
 */
export async function dispatchNoticeDraftRpcInput<T>(
  input: unknown, dispatch: (snapshot: NoticeDraftRpcJson) => T,
): Promise<NoticeDraftRpcDispatchResult<Awaited<T>>> {
  let snapshot: NoticeDraftRpcJson;
  try { snapshot = capture(input); }
  catch { return invalid; }
  return Object.freeze({ state: "dispatched", dispatched: true, value: await dispatch(snapshot) });
}
