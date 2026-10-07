import type { AuthoritySnapshot, EventAudience, EventCommand } from './event-interest-schema.ts';

export type EventStatus = 'draft' | 'published' | 'cancelled';
export type InterestStatus = 'interested' | 'withdrawn';

export interface Ce011Event {
  id: string;
  workspace_id: string;
  occurrence_id: string;
  community_ref: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  audience: EventAudience;
  status: EventStatus;
  version: number;
}

export interface InterestRecord {
  event_id: string;
  workspace_id: string;
  membership_id: string;
  status: InterestStatus;
  version: number;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  workspace_id: string;
  membership_id: string;
  attended: boolean;
  observed_local: string;
  timezone: string;
  version: number;
}

export interface AuditRecord {
  command_id: string;
  workspace_id: string;
  actor_id: string;
  action: EventCommand['type'];
  subject_id: string;
  reason: string;
  occurred_at: string;
  result_version: number;
  policy: 'standard' | 'post_cancellation_attendance_correction';
}

export interface AudienceSubject {
  membership_id: string;
  workspace_id: string;
  role_codes: string[];
  membership_active: boolean;
}

export interface Ce011State {
  events: Record<string, Ce011Event>;
  interests: Record<string, InterestRecord>;
  attendance: Record<string, AttendanceRecord>;
  audits: AuditRecord[];
  receipts: Record<string, { command_id: string; fingerprint: string; result_version: number; tenant_id: string; canonical_key: string; workspace_id: string; context_id: string; actor_user_id: string; membership_id: string }>;
}

export type RejectionCode =
  | 'AUTHORITY_DENIED'
  | 'CAPABILITY_INACTIVE'
  | 'WORKSPACE_MISMATCH'
  | 'AUDIENCE_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'VERSION_CONFLICT'
  | 'DUPLICATE_INTEREST'
  | 'INTEREST_NOT_ACTIVE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_CONTEXT_MISMATCH';

export type CommandResult =
  | { ok: true; state: Ce011State; replayed: boolean; version: number }
  | { ok: false; state: Ce011State; code: RejectionCode };

export const emptyCe011State = (): Ce011State => ({ events: {}, interests: {}, attendance: {}, audits: [], receipts: {} });

const stableFingerprint = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableFingerprint).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${stableFingerprint(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const interestKey = (eventId: string, membershipId: string) => `${eventId}:${membershipId}`;

const commandPermission: Record<EventCommand['type'], AuthoritySnapshot['permissions'][number]> = {
  create_event: 'events.event.publish',
  publish_event: 'events.event.publish',
  cancel_event: 'events.event.cancel',
  register_interest: 'events.interest.manage_self',
  withdraw_interest: 'events.interest.manage_self',
  record_attendance: 'events.attendance.record',
  correct_attendance: 'events.attendance.correct',
};

export const canonicalIdempotencyKey = (command: EventCommand) =>
  `ce.event.${command.type}.v1/${command.workspace_id}/${command.command_id}/${command.idempotency_key}`;

const receiptKey = (authority: AuthoritySnapshot, command: EventCommand) =>
  `${authority.tenant_id}:${canonicalIdempotencyKey(command)}`;

function has(authority: AuthoritySnapshot, permission: AuthoritySnapshot['permissions'][number]) {
  return authority.permissions.includes(permission);
}

function audienceAllows(audience: EventAudience, subject: AudienceSubject) {
  if (!subject.membership_active) return false;
  if (audience.kind === 'workspace') return true;
  if (audience.kind === 'members') return audience.membership_ids.includes(subject.membership_id);
  return subject.role_codes.some((role) => audience.role_codes.includes(role));
}

function reject(state: Ce011State, code: RejectionCode): CommandResult {
  return { ok: false, state, code };
}

function currentOperationAuthorized(
  state: Ce011State,
  command: EventCommand,
  authority: AuthoritySnapshot,
  targetAudienceSubject?: AudienceSubject
) {
  if (!has(authority, commandPermission[command.type])) return false;
  if (command.type === 'create_event' || command.type === 'publish_event' || command.type === 'cancel_event') {
    return true;
  }
  const event = state.events[command.event_id];
  if (!event) return false;
  if (command.type === 'register_interest' || command.type === 'withdraw_interest') {
    return authority.audience_result === 'eligible' && audienceAllows(event.audience, {
      membership_id: authority.membership_id,
      workspace_id: authority.workspace_id,
      role_codes: authority.role_codes,
      membership_active: authority.membership_active,
    });
  }
  const targetMembershipId = command.type === 'record_attendance'
    ? command.target_membership_id
    : state.attendance[command.attendance_id]?.membership_id;
  return authority.audience_result === 'eligible'
    && Boolean(targetAudienceSubject)
    && targetAudienceSubject!.membership_id === targetMembershipId
    && targetAudienceSubject!.workspace_id === event.workspace_id
    && audienceAllows(event.audience, targetAudienceSubject!);
}

export function applyEventCommand(
  state: Ce011State,
  command: EventCommand,
  authority: AuthoritySnapshot,
  occurredAt: string,
  targetAudienceSubject?: AudienceSubject
): CommandResult {
  if (!authority.membership_active) return reject(state, 'AUTHORITY_DENIED');
  if (!authority.capability_active) return reject(state, 'CAPABILITY_INACTIVE');
  if (authority.workspace_id !== command.workspace_id) return reject(state, 'WORKSPACE_MISMATCH');

  const fingerprint = stableFingerprint({ schema_version: 1, actor_user_id: authority.actor_user_id, context_id: authority.context_id, workspace_id: command.workspace_id, command });
  const scopedReceiptKey = receiptKey(authority, command);
  const prior = state.receipts[scopedReceiptKey];
  if (prior) {
    if (prior.tenant_id !== authority.tenant_id || prior.workspace_id !== command.workspace_id || prior.context_id !== authority.context_id || prior.actor_user_id !== authority.actor_user_id || prior.membership_id !== authority.membership_id) return reject(state, 'IDEMPOTENCY_CONTEXT_MISMATCH');
    if (prior.command_id !== command.command_id || prior.fingerprint !== fingerprint) return reject(state, 'IDEMPOTENCY_CONFLICT');
    if (!currentOperationAuthorized(state, command, authority, targetAudienceSubject)) return reject(state, 'AUTHORITY_DENIED');
    return { ok: true, state, replayed: true, version: prior.result_version };
  }

  const event = 'event_id' in command ? state.events[command.event_id] : undefined;
  if (command.type !== 'create_event') {
    if (!event) return reject(state, 'NOT_FOUND');
    if (event.workspace_id !== command.workspace_id) return reject(state, 'WORKSPACE_MISMATCH');
    if (event.version !== command.expected_version) return reject(state, 'VERSION_CONFLICT');
  }

  let nextEvent: Ce011Event | undefined = event;
  let nextInterest: InterestRecord | undefined;
  let nextAttendance: AttendanceRecord | undefined;
  let subjectId = command.event_id;

  if (command.type === 'create_event') {
    if (!has(authority, 'events.event.publish')) return reject(state, 'AUTHORITY_DENIED');
    if (command.expected_version !== 0 || state.events[command.event_id]) return reject(state, 'VERSION_CONFLICT');
    if (Date.parse(command.ends_at) <= Date.parse(command.starts_at)) return reject(state, 'INVALID_STATE');
    nextEvent = {
      id: command.event_id,
      workspace_id: command.workspace_id,
      occurrence_id: command.occurrence_id,
      community_ref: command.community_ref ?? null,
      title: command.title,
      starts_at: command.starts_at,
      ends_at: command.ends_at,
      timezone: command.timezone,
      audience: command.audience,
      status: 'draft',
      version: 1,
    };
  } else if (command.type === 'publish_event' || command.type === 'cancel_event') {
    if (!has(authority, commandPermission[command.type])) return reject(state, 'AUTHORITY_DENIED');
    if (command.type === 'publish_event' && event!.status !== 'draft') return reject(state, 'INVALID_STATE');
    if (command.type === 'cancel_event' && event!.status === 'cancelled') return reject(state, 'INVALID_STATE');
    nextEvent = { ...event!, status: command.type === 'publish_event' ? 'published' : 'cancelled', version: event!.version + 1 };
  } else if (command.type === 'register_interest' || command.type === 'withdraw_interest') {
    if (!has(authority, 'events.interest.manage_self')) return reject(state, 'AUTHORITY_DENIED');
    if (authority.audience_result !== 'eligible') return reject(state, 'AUDIENCE_DENIED');
    if (event!.status !== 'published') return reject(state, 'INVALID_STATE');
    if (!audienceAllows(event!.audience, { membership_id: authority.membership_id, workspace_id: authority.workspace_id, role_codes: authority.role_codes, membership_active: authority.membership_active })) return reject(state, 'AUDIENCE_DENIED');
    const key = interestKey(event!.id, authority.membership_id);
    const current = state.interests[key];
    if (command.type === 'register_interest') {
      if ((current?.version ?? 0) !== command.expected_interest_version) return reject(state, 'VERSION_CONFLICT');
      if (current?.status === 'interested') return reject(state, 'DUPLICATE_INTEREST');
      nextInterest = { event_id: event!.id, workspace_id: event!.workspace_id, membership_id: authority.membership_id, status: 'interested', version: (current?.version ?? 0) + 1 };
    } else {
      if (!current || current.status !== 'interested') return reject(state, 'INTEREST_NOT_ACTIVE');
      if (current.version !== command.expected_interest_version) return reject(state, 'VERSION_CONFLICT');
      nextInterest = { ...current, status: 'withdrawn', version: current.version + 1 };
    }
    subjectId = key;
  } else {
    if (!has(authority, commandPermission[command.type])) return reject(state, 'AUTHORITY_DENIED');
    if (authority.audience_result !== 'eligible') return reject(state, 'AUDIENCE_DENIED');
    const targetMembershipId = command.type === 'record_attendance' ? command.target_membership_id : state.attendance[command.attendance_id]?.membership_id;
    if (!targetAudienceSubject || targetAudienceSubject.membership_id !== targetMembershipId || targetAudienceSubject.workspace_id !== event!.workspace_id || !audienceAllows(event!.audience, targetAudienceSubject)) return reject(state, 'AUDIENCE_DENIED');
    if (command.type === 'record_attendance') {
      if (event!.status !== 'published') return reject(state, 'INVALID_STATE');
      if (command.timezone !== event!.timezone) return reject(state, 'INVALID_STATE');
      if (Object.values(state.attendance).some((row) => row.event_id === event!.id && row.membership_id === command.target_membership_id)) return reject(state, 'INVALID_STATE');
      nextAttendance = { id: command.command_id, event_id: event!.id, workspace_id: event!.workspace_id, membership_id: command.target_membership_id, attended: true, observed_local: command.observed_local, timezone: command.timezone, version: 1 };
      subjectId = nextAttendance.id;
    } else {
      if (event!.status === 'draft') return reject(state, 'INVALID_STATE');
      if (command.timezone !== event!.timezone) return reject(state, 'INVALID_STATE');
      if (event!.status === 'cancelled' && command.reason.trim().length < 12) return reject(state, 'INVALID_STATE');
      const current = state.attendance[command.attendance_id];
      if (!current || current.event_id !== event!.id) return reject(state, 'NOT_FOUND');
      if (current.version !== command.expected_attendance_version) return reject(state, 'VERSION_CONFLICT');
      nextAttendance = { ...current, attended: command.attended, observed_local: command.observed_local, timezone: command.timezone, version: current.version + 1 };
      subjectId = current.id;
    }
  }

  const resultVersion = nextInterest?.version ?? nextAttendance?.version ?? nextEvent!.version;
  const next: Ce011State = {
    events: nextEvent ? { ...state.events, [nextEvent.id]: nextEvent } : state.events,
    interests: nextInterest ? { ...state.interests, [interestKey(nextInterest.event_id, nextInterest.membership_id)]: nextInterest } : state.interests,
    attendance: nextAttendance ? { ...state.attendance, [nextAttendance.id]: nextAttendance } : state.attendance,
    audits: [...state.audits, { command_id: command.command_id, workspace_id: command.workspace_id, actor_id: authority.actor_user_id, action: command.type, subject_id: subjectId, reason: command.reason, occurred_at: occurredAt, result_version: resultVersion, policy: command.type === 'correct_attendance' && event?.status === 'cancelled' ? 'post_cancellation_attendance_correction' : 'standard' }],
    receipts: { ...state.receipts, [scopedReceiptKey]: { command_id: command.command_id, fingerprint, result_version: resultVersion, tenant_id: authority.tenant_id, canonical_key: canonicalIdempotencyKey(command), workspace_id: command.workspace_id, context_id: authority.context_id, actor_user_id: authority.actor_user_id, membership_id: authority.membership_id } },
  };
  return { ok: true, state: next, replayed: false, version: resultVersion };
}
