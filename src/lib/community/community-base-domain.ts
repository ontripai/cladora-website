import type { Ce010Authority, Ce010Command, CommunityAudience } from './community-base-schema.ts';

export interface CommunityRecord { id: string; workspace_id: string; name: string; audience: CommunityAudience; version: number }
export interface AnnouncementRecord { id: string; community_id: string; workspace_id: string; body: string; audience: CommunityAudience; status: 'draft' | 'published' | 'cancelled'; version: number }
export interface ContentReportRecord { id: string; community_id: string; workspace_id: string; reporter_membership_id: string; target_type: 'announcement'; target_id: string; report_reason: string; status: 'open' | 'dismissed' | 'action_required'; decision_reason: string | null; version: number }
export interface Ce010State {
  communities: Record<string, CommunityRecord>;
  announcements: Record<string, AnnouncementRecord>;
  reports: Record<string, ContentReportRecord>;
  audits: Array<{ command_id: string; action: Ce010Command['type']; subject_id: string; actor_id: string; reason: string; occurred_at: string; version: number }>;
  receipts: Record<string, { fingerprint: string; actor_id: string; membership_id: string; context_id: string; workspace_id: string; version: number }>;
}

export type Ce010Rejection = 'AUTHORITY_DENIED' | 'CAPABILITY_INACTIVE' | 'CONTEXT_MISMATCH' | 'WORKSPACE_MISMATCH' | 'AUDIENCE_DENIED' | 'NOT_FOUND' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'DUPLICATE_REPORT' | 'IDEMPOTENCY_CONFLICT';
export type Ce010Result = { ok: true; state: Ce010State; replayed: boolean; version: number } | { ok: false; state: Ce010State; code: Ce010Rejection };
export const emptyCe010State = (): Ce010State => ({ communities: {}, announcements: {}, reports: {}, audits: [], receipts: {} });

const fingerprint = (value: unknown): string => Array.isArray(value) ? `[${value.map(fingerprint).join(',')}]` : value && typeof value === 'object' ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${fingerprint(child)}`).join(',')}}` : JSON.stringify(value);
const receiptKey = (authority: Ce010Authority, command: Ce010Command) => `${authority.tenant_id}:ce.community.${command.type}.v1/${command.workspace_id}/${command.command_id}/${command.idempotency_key}`;
const permission: Record<Ce010Command['type'], Ce010Authority['permissions'][number]> = {
  create_community: 'community.community.manage', create_announcement: 'community.announcement.publish', publish_announcement: 'community.announcement.publish', cancel_announcement: 'community.announcement.publish', report_content: 'community.report.create', decide_content_report: 'community.report.decide',
};
const audienceAllows = (audience: CommunityAudience, authority: Ce010Authority) => authority.membership_active && (audience.kind === 'workspace' || (audience.kind === 'members' && audience.membership_ids.includes(authority.membership_id)) || (audience.kind === 'roles' && authority.role_codes.some((role) => audience.role_codes.includes(role))));
const reject = (state: Ce010State, code: Ce010Rejection): Ce010Result => ({ ok: false, state, code });

function currentlyAuthorized(state: Ce010State, command: Ce010Command, authority: Ce010Authority) {
  if (!authority.permissions.includes(permission[command.type])) return false;
  if (command.type === 'create_community') return true;
  const community = state.communities[command.community_id];
  if (!community) return false;
  if (command.type === 'report_content') return authority.audience_result === 'eligible' && audienceAllows(community.audience, authority);
  return true;
}

export function applyCommunityCommand(state: Ce010State, command: Ce010Command, authority: Ce010Authority, occurredAt: string): Ce010Result {
  if (!authority.membership_active || !authority.permissions.includes(permission[command.type])) return reject(state, 'AUTHORITY_DENIED');
  if (!authority.capability_active) return reject(state, 'CAPABILITY_INACTIVE');
  if (authority.context_id !== command.context_id) return reject(state, 'CONTEXT_MISMATCH');
  if (authority.workspace_id !== command.workspace_id) return reject(state, 'WORKSPACE_MISMATCH');
  const key = receiptKey(authority, command); const hash = fingerprint({ schema_version: 1, actor_id: authority.actor_user_id, context_id: authority.context_id, command }); const prior = state.receipts[key];
  if (prior) {
    if (prior.actor_id !== authority.actor_user_id || prior.membership_id !== authority.membership_id || prior.context_id !== authority.context_id || prior.workspace_id !== command.workspace_id || prior.fingerprint !== hash) return reject(state, 'IDEMPOTENCY_CONFLICT');
    if (!currentlyAuthorized(state, command, authority)) return reject(state, 'AUTHORITY_DENIED');
    return { ok: true, state, replayed: true, version: prior.version };
  }
  const community = 'community_id' in command ? state.communities[command.community_id] : undefined;
  if (command.type !== 'create_community' && (!community || community.workspace_id !== command.workspace_id)) return reject(state, community ? 'WORKSPACE_MISMATCH' : 'NOT_FOUND');
  let nextCommunity: CommunityRecord | undefined; let nextAnnouncement: AnnouncementRecord | undefined; let nextReport: ContentReportRecord | undefined; let subjectId = command.community_id;
  if (command.type === 'create_community') {
    if (command.expected_version !== 0 || state.communities[command.community_id]) return reject(state, 'VERSION_CONFLICT');
    nextCommunity = { id: command.community_id, workspace_id: command.workspace_id, name: command.name, audience: command.audience, version: 1 };
  } else if (command.type === 'create_announcement') {
    if (community!.version !== command.expected_version || state.announcements[command.announcement_id]) return reject(state, 'VERSION_CONFLICT');
    nextAnnouncement = { id: command.announcement_id, community_id: community!.id, workspace_id: command.workspace_id, body: command.body, audience: command.audience, status: 'draft', version: 1 }; subjectId = command.announcement_id;
  } else if (command.type === 'publish_announcement' || command.type === 'cancel_announcement') {
    const current = state.announcements[command.announcement_id];
    if (!current || current.community_id !== community!.id) return reject(state, 'NOT_FOUND');
    if (current.version !== command.expected_version) return reject(state, 'VERSION_CONFLICT');
    if ((command.type === 'publish_announcement' && current.status !== 'draft') || (command.type === 'cancel_announcement' && current.status === 'cancelled')) return reject(state, 'INVALID_STATE');
    nextAnnouncement = { ...current, status: command.type === 'publish_announcement' ? 'published' : 'cancelled', version: current.version + 1 }; subjectId = current.id;
  } else if (command.type === 'report_content') {
    if (authority.audience_result !== 'eligible' || !audienceAllows(community!.audience, authority)) return reject(state, 'AUDIENCE_DENIED');
    const target = state.announcements[command.target_id];
    if (!target || target.community_id !== community!.id || target.status !== 'published' || !audienceAllows(target.audience, authority)) return reject(state, 'AUDIENCE_DENIED');
    if (command.expected_version !== 0 || Object.values(state.reports).some((row) => row.target_id === command.target_id && row.reporter_membership_id === authority.membership_id && row.status === 'open')) return reject(state, 'DUPLICATE_REPORT');
    nextReport = { id: command.report_id, community_id: community!.id, workspace_id: command.workspace_id, reporter_membership_id: authority.membership_id, target_type: command.target_type, target_id: command.target_id, report_reason: command.report_reason, status: 'open', decision_reason: null, version: 1 }; subjectId = command.report_id;
  } else {
    const current = state.reports[command.report_id];
    if (!current || current.community_id !== community!.id) return reject(state, 'NOT_FOUND');
    if (current.version !== command.expected_version) return reject(state, 'VERSION_CONFLICT');
    if (current.status !== 'open') return reject(state, 'INVALID_STATE');
    nextReport = { ...current, status: command.decision, decision_reason: command.decision_reason, version: current.version + 1 }; subjectId = current.id;
  }
  const version = nextCommunity?.version ?? nextAnnouncement?.version ?? nextReport!.version;
  const next: Ce010State = { communities: nextCommunity ? { ...state.communities, [nextCommunity.id]: nextCommunity } : state.communities, announcements: nextAnnouncement ? { ...state.announcements, [nextAnnouncement.id]: nextAnnouncement } : state.announcements, reports: nextReport ? { ...state.reports, [nextReport.id]: nextReport } : state.reports, audits: [...state.audits, { command_id: command.command_id, action: command.type, subject_id: subjectId, actor_id: authority.actor_user_id, reason: command.reason, occurred_at: occurredAt, version }], receipts: { ...state.receipts, [key]: { fingerprint: hash, actor_id: authority.actor_user_id, membership_id: authority.membership_id, context_id: authority.context_id, workspace_id: command.workspace_id, version } } };
  return { ok: true, state: next, replayed: false, version };
}
