import { z } from 'zod';
import type { Language } from '@/types';
import { timezoneSchema } from './event-interest-schema.ts';

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/** Canonical keys are for identity comparison/indexing only, never command serialization. */
export function eventUuidKey(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}
export function sameEventUuid(left: unknown, right: unknown): boolean {
  const key = eventUuidKey(left);
  return key !== null && key === eventUuidKey(right);
}

const eventStatus = z.enum(['draft', 'published', 'cancelled']);
const interestStatus = z.enum(['interested', 'withdrawn']).nullable();

export const eventReadItemSchema = z.strictObject({
  event_id: uuidSchema,
  occurrence_id: uuidSchema,
  workspace_id: uuidSchema,
  title: z.string().trim().min(2).max(160),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  timezone: timezoneSchema,
  status: eventStatus,
  version: z.number().int().positive(),
  audience_kind: z.enum(['workspace', 'roles', 'members']),
  interest_status: interestStatus,
  interest_version: z.number().int().nonnegative(),
  can_publish: z.boolean(),
  can_cancel: z.boolean(),
  can_register_interest: z.boolean(),
  can_withdraw_interest: z.boolean(),
  can_record_attendance: z.boolean(),
  eligible_attendance_members: z.array(z.strictObject({
    membership_id: uuidSchema,
    display_name: z.string().trim().min(1).max(120),
  })).max(500),
});

export const eventReadResponseSchema = z.strictObject({
  workspace_id: uuidSchema,
  events: z.array(eventReadItemSchema).max(100),
}).superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const item of value.events) {
    if (ids.has(eventUuidKey(item.event_id)!) || !sameEventUuid(item.workspace_id, value.workspace_id) || Date.parse(item.ends_at) <= Date.parse(item.starts_at)) ctx.addIssue({ code: 'custom', message: 'event_projection_mismatch' });
    ids.add(eventUuidKey(item.event_id)!);
    const members = new Set<string>();
    for (const member of item.eligible_attendance_members) {
      const key = eventUuidKey(member.membership_id)!;
      if (members.has(key)) ctx.addIssue({ code: 'custom', message: 'duplicate_member_identity' });
      members.add(key);
    }
  }
});

export type EventReadItem = z.infer<typeof eventReadItemSchema>;
export type EventReadResponse = z.infer<typeof eventReadResponseSchema>;
export type EventLoadFailure = 'session' | 'denied' | 'not_ready' | 'retry';

const audienceLabels = {
  ro: { workspace: 'Spațiul de lucru', roles: 'Roluri eligibile', members: 'Membri selectați' },
  en: { workspace: 'Workspace', roles: 'Eligible roles', members: 'Selected members' },
  fa: { workspace: 'فضای کاری', roles: 'نقش‌های مجاز', members: 'اعضای انتخاب‌شده' },
} as const;

export function toEventInterestView(item: EventReadItem, lang: Language) {
  return {
    event_id: item.event_id,
    workspace_id: item.workspace_id,
    title: item.title,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    timezone: item.timezone,
    status: item.status,
    audience_label: audienceLabels[lang][item.audience_kind],
    version: item.version,
    interest_status: item.interest_status,
    interest_version: item.interest_version,
    can_publish: item.can_publish,
    can_cancel: item.can_cancel,
    can_register_interest: item.can_register_interest,
    can_withdraw_interest: item.can_withdraw_interest,
    can_record_attendance: item.can_record_attendance,
  };
}

export function classifyEventResponse(status: number): EventLoadFailure {
  if (status === 401) return 'session';
  if (status === 403 || status === 404) return 'denied';
  if (status === 503) return 'not_ready';
  return 'retry';
}

export function newEventCommandIdentity(randomUUID: () => string = () => crypto.randomUUID()) {
  const commandId = randomUUID();
  return {
    command_id: commandId,
    idempotency_key: `ce011.ui.${commandId}`,
  };
}

// This is the existing proposal's five-field command result, NOT a current read.
// No receipt lookup RPC exists; recovery below is an explicit same-wire replay.
export const eventCommandResultSchema = z.strictObject({
  entity_type: z.enum(['event', 'event_interest', 'event_attendance']),
  entity_id: uuidSchema,
  version: z.number().int().positive(),
  command: z.enum(['create_event', 'publish_event', 'cancel_event', 'register_interest', 'withdraw_interest', 'record_attendance', 'correct_attendance']),
  replayed: z.boolean(),
});
export type EventCommandResult = z.infer<typeof eventCommandResultSchema>;
export type EventExecutionState = Readonly<{
  phase: 'ready' | 'sending' | 'unknown' | 'rejected' | 'blocked' | 'done';
  pending: Readonly<{ command: EventCommand; wire: string }> | null;
  receipt: EventCommandResult | null;
  uncertain: boolean;
  failure?: 'session' | 'denied' | 'conflict' | 'validation' | 'not_ready';
}>;

export function parseEventCommandResult(value: unknown, command: EventCommand): EventCommandResult {
  const result = eventCommandResultSchema.parse(value);
  const entity = ['create_event', 'publish_event', 'cancel_event'].includes(command.type) ? 'event'
    : ['register_interest', 'withdraw_interest'].includes(command.type) ? 'event_interest' : 'event_attendance';
  const version = command.type === 'create_event' || command.type === 'record_attendance' ? 1
    : command.type === 'register_interest' || command.type === 'withdraw_interest' ? command.expected_interest_version + 1
    : command.type === 'correct_attendance' ? command.expected_attendance_version + 1 : command.expected_version + 1;
  if (result.command !== command.type || result.entity_type !== entity || result.version !== version
    || (entity === 'event' && !sameEventUuid(result.entity_id, command.event_id))
    || (command.type === 'correct_attendance' && !sameEventUuid(result.entity_id, command.attendance_id))) throw new Error('event_result_mismatch');
  return result;
}

import { eventCommandSchema, type EventCommand } from './event-interest-schema.ts';
export type { EventCommand } from './event-interest-schema.ts';

/** One page lifetime, one exact actor/context/Workspace binding. No browser persistence.
 * A retained UNKNOWN is never cleared by GET, a locale change or a new command key.
 */
export function createEventCommandSession(options: {
  fetch: typeof fetch; owner: () => object | null; contextId: string; workspaceId: string;
  onState: (state: EventExecutionState) => void;
  accepted: (command: EventCommand, result: EventCommandResult) => void;
  denied: () => void; timeoutMs?: number;
}) {
  let state: EventExecutionState = { phase: 'ready', pending: null, receipt: null, uncertain: false };
  let flight: { cancel: () => void } | null = null;
  const notify = () => { if (options.owner()) options.onState(state); };
  async function dispatch() {
    if (flight || !state.pending) return false;
    const owner = options.owner(); if (!owner) return false;
    const pending = state.pending;
    const current = () => options.owner() === owner;
    const controller = new AbortController();
    let cancel!: () => void;
    const cancelled = new Promise<never>((_, reject) => { cancel = () => { controller.abort(); reject(new Error('cancelled')); }; });
    const operation = { cancel }; flight = operation;
    const timer = setTimeout(cancel, options.timeoutMs ?? 15000);
    state = { ...state, phase: 'sending', receipt: null }; notify();
    try {
      const response = await Promise.race([options.fetch('/api/customer/v1/community/events', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: pending.wire, signal: controller.signal,
      }), cancelled]);
      if (!current()) throw new Error('stale_owner');
      if (!response.ok) {
        const failure = response.status === 401 ? 'session' : [403, 404].includes(response.status) ? 'denied'
          : response.status === 409 ? 'conflict' : response.status === 503 ? 'not_ready' : 'validation';
        const unknown = state.uncertain || response.status >= 500 || [408, 429].includes(response.status);
        state = { ...state, phase: unknown ? 'unknown' : 'rejected', uncertain: unknown, failure };
        notify();
        if (failure === 'denied' || failure === 'session') options.denied();
        return false;
      }
      const value = await Promise.race([response.json(), cancelled]);
      if (!current() || controller.signal.aborted) throw new Error('stale_owner');
      const receipt = parseEventCommandResult(value, pending.command);
      state = { phase: 'done', pending: null, receipt, uncertain: false }; notify();
      options.accepted(pending.command, receipt);
      return true;
    } catch {
      state = { ...state, phase: 'unknown', pending, receipt: null, uncertain: true };
      if (current()) notify();
      return false;
    } finally {
      clearTimeout(timer);
      if (flight === operation) flight = null;
    }
  }
  return {
    getState: () => state,
    send(input: unknown) {
      if (flight || state.pending || !options.owner()) return Promise.resolve(false);
      const command = eventCommandSchema.parse(input);
      if (!sameEventUuid(command.context_id, options.contextId) || !sameEventUuid(command.workspace_id, options.workspaceId)) return Promise.resolve(false);
      // Schema owns canonicalization once. This frozen wire is reused on replay, never rebuilt from mutable form/read state.
      const snapshot = JSON.parse(JSON.stringify(command)) as EventCommand;
      if (snapshot.type === 'create_event') {
        if (snapshot.audience.kind === 'roles') Object.freeze(snapshot.audience.role_codes);
        if (snapshot.audience.kind === 'members') Object.freeze(snapshot.audience.membership_ids);
        Object.freeze(snapshot.audience);
      }
      Object.freeze(snapshot);
      state = { phase: 'ready', pending: Object.freeze({ command: snapshot, wire: JSON.stringify(snapshot) }), receipt: null, uncertain: false };
      return dispatch();
    },
    replay() { return state.pending && ['unknown', 'blocked'].includes(state.phase) ? dispatch() : Promise.resolve(false); },
    resetRejected() {
      if (flight || !options.owner() || state.phase !== 'rejected' || state.uncertain) return false;
      state = { phase: 'ready', pending: null, receipt: null, uncertain: false }; notify(); return true;
    },
    invalidate() { flight?.cancel(); },
  };
}
