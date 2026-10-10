import type { EventAudience } from './event-interest-schema.ts';
import type { Ce012Authority, Ce012Command, GuideStep } from './experience-guide-schema.ts';

export interface GuideRecord { id: string; workspace_id: string; title: string; audience: EventAudience; steps: GuideStep[]; status: 'draft' | 'published' | 'cancelled'; version: number }
export interface Ce012State { guides: Record<string, GuideRecord>; audits: Array<{ command_id: string; action: Ce012Command['type']; guide_id: string; actor_id: string; reason: string; occurred_at: string; version: number }>; receipts: Record<string, { fingerprint: string; actor_id: string; membership_id: string; context_id: string; workspace_id: string; version: number }> }
export type ReferenceAuthorization = (reference: GuideStep['references'][number]) => boolean;
export type Ce012Rejection = 'AUTHORITY_DENIED' | 'CAPABILITY_INACTIVE' | 'CONTEXT_MISMATCH' | 'WORKSPACE_MISMATCH' | 'AUDIENCE_DENIED' | 'NOT_FOUND' | 'INVALID_STATE' | 'VERSION_CONFLICT' | 'UNSAFE_REFERENCE' | 'IDEMPOTENCY_CONFLICT';
export type Ce012Result = { ok: true; state: Ce012State; replayed: boolean; version: number } | { ok: false; state: Ce012State; code: Ce012Rejection };
export const emptyCe012State = (): Ce012State => ({ guides: {}, audits: [], receipts: {} });
const fingerprint = (value: unknown): string => Array.isArray(value) ? `[${value.map(fingerprint).join(',')}]` : value && typeof value === 'object' ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${fingerprint(child)}`).join(',')}}` : JSON.stringify(value);
const receiptKey = (authority: Ce012Authority, command: Ce012Command) => `${authority.tenant_id}:ce.guide.${command.type}.v1/${command.workspace_id}/${command.command_id}/${command.idempotency_key}`;
const audienceAllows = (audience: EventAudience, authority: Ce012Authority) => authority.membership_active && authority.audience_result === 'eligible' && (audience.kind === 'workspace' || (audience.kind === 'members' && audience.membership_ids.includes(authority.membership_id)) || (audience.kind === 'roles' && authority.role_codes.some((role) => audience.role_codes.includes(role))));
const reject = (state: Ce012State, code: Ce012Rejection): Ce012Result => ({ ok: false, state, code });
const referencesAllowed = (steps: GuideStep[], authorizeReference: ReferenceAuthorization) => steps.every((step) => step.references.every(authorizeReference));

export function applyGuideCommand(state: Ce012State, command: Ce012Command, authority: Ce012Authority, occurredAt: string, authorizeReference: ReferenceAuthorization): Ce012Result {
  if (!authority.membership_active || !authority.permissions.includes('experience.guide.manage')) return reject(state, 'AUTHORITY_DENIED');
  if (!authority.capability_active) return reject(state, 'CAPABILITY_INACTIVE');
  if (authority.context_id !== command.context_id) return reject(state, 'CONTEXT_MISMATCH');
  if (authority.workspace_id !== command.workspace_id) return reject(state, 'WORKSPACE_MISMATCH');
  const key = receiptKey(authority, command); const hash = fingerprint({ schema_version: 1, actor_id: authority.actor_user_id, context_id: authority.context_id, command }); const prior = state.receipts[key];
  if (prior) {
    if (prior.actor_id !== authority.actor_user_id || prior.membership_id !== authority.membership_id || prior.context_id !== authority.context_id || prior.workspace_id !== command.workspace_id || prior.fingerprint !== hash) return reject(state, 'IDEMPOTENCY_CONFLICT');
    if (!authority.permissions.includes('experience.guide.manage')) return reject(state, 'AUTHORITY_DENIED');
    return { ok: true, state, replayed: true, version: prior.version };
  }
  const current = state.guides[command.guide_id]; let nextGuide: GuideRecord;
  if (command.type === 'create_guide') {
    if (command.expected_version !== 0 || current) return reject(state, 'VERSION_CONFLICT');
    if (!referencesAllowed(command.steps, authorizeReference)) return reject(state, 'UNSAFE_REFERENCE');
    nextGuide = { id: command.guide_id, workspace_id: command.workspace_id, title: command.title, audience: command.audience, steps: command.steps, status: 'draft', version: 1 };
  } else {
    if (!current) return reject(state, 'NOT_FOUND');
    if (current.workspace_id !== command.workspace_id) return reject(state, 'WORKSPACE_MISMATCH');
    if (current.version !== command.expected_version) return reject(state, 'VERSION_CONFLICT');
    if (command.type === 'revise_guide') {
      if (current.status !== 'draft') return reject(state, 'INVALID_STATE');
      if (!referencesAllowed(command.steps, authorizeReference)) return reject(state, 'UNSAFE_REFERENCE');
      nextGuide = { ...current, title: command.title, audience: command.audience, steps: command.steps, version: current.version + 1 };
    } else {
      if ((command.type === 'publish_guide' && current.status !== 'draft') || (command.type === 'cancel_guide' && current.status === 'cancelled')) return reject(state, 'INVALID_STATE');
      nextGuide = { ...current, status: command.type === 'publish_guide' ? 'published' : 'cancelled', version: current.version + 1 };
    }
  }
  const next: Ce012State = { guides: { ...state.guides, [nextGuide.id]: nextGuide }, audits: [...state.audits, { command_id: command.command_id, action: command.type, guide_id: nextGuide.id, actor_id: authority.actor_user_id, reason: command.reason, occurred_at: occurredAt, version: nextGuide.version }], receipts: { ...state.receipts, [key]: { fingerprint: hash, actor_id: authority.actor_user_id, membership_id: authority.membership_id, context_id: authority.context_id, workspace_id: command.workspace_id, version: nextGuide.version } } };
  return { ok: true, state: next, replayed: false, version: nextGuide.version };
}

export function readGuide(state: Ce012State, guideId: string, authority: Ce012Authority, authorizeReference: ReferenceAuthorization) {
  const guide = state.guides[guideId];
  if (!guide || guide.status !== 'published' || guide.workspace_id !== authority.workspace_id || !authority.capability_active || !authority.permissions.includes('experience.guide.read') || !audienceAllows(guide.audience, authority)) return null;
  return { ...guide, steps: guide.steps.map((step) => ({ ...step, references: step.references.filter(authorizeReference) })) };
}
