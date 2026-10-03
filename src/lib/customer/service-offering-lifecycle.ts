export type OfferingRevisionStatus = 'draft' | 'submitted' | 'published' | 'suspended' | 'archived';
export type OfferingAction = 'submit' | 'publish' | 'suspend' | 'archive';

export type OfferingTransitionResult =
  | { ok: true; status: OfferingRevisionStatus; lock_version: number }
  | { ok: false; code: 'VERSION_CONFLICT' | 'INVALID_TRANSITION' | 'INVALID_VALIDITY' | 'REVISION_EXPIRED' };

/** Pure domain planning; never an authorization or persistence boundary.
 * Call only after current actor/context/reference checks. Persist with a database
 * compare-and-swap, revision lock, audit and outbox in the same transaction.
 * Server publication checks (approval, provider, module, currency, documents)
 * remain mandatory even when this function returns ok.
 */
export function planOfferingTransition(
  revision: {
    status: OfferingRevisionStatus;
    lock_version: number;
    valid_from: string;
    valid_until: string | null;
  },
  action: OfferingAction,
  expectedLockVersion: number,
  now: number,
): OfferingTransitionResult {
  if (!Number.isSafeInteger(revision.lock_version) || revision.lock_version < 1
    || revision.lock_version >= Number.MAX_SAFE_INTEGER
    || expectedLockVersion !== revision.lock_version) {
    return { ok: false, code: 'VERSION_CONFLICT' };
  }
  let status: OfferingRevisionStatus;
  if (action === 'submit' && revision.status === 'draft') status = 'submitted';
  else if (action === 'publish' && revision.status === 'submitted') status = 'published';
  else if (action === 'suspend' && revision.status === 'published') status = 'suspended';
  else if (action === 'archive' && ['draft', 'submitted', 'suspended'].includes(revision.status)) status = 'archived';
  else return { ok: false, code: 'INVALID_TRANSITION' };

  if (action === 'submit' || action === 'publish') {
    const start = Date.parse(revision.valid_from);
    const end = revision.valid_until === null ? null : Date.parse(revision.valid_until);
    if (!Number.isFinite(now) || !Number.isFinite(start)
      || (end !== null && (!Number.isFinite(end) || end <= start))) {
      return { ok: false, code: 'INVALID_VALIDITY' };
    }
    if (end !== null && now >= end) return { ok: false, code: 'REVISION_EXPIRED' };
  }
  return { ok: true, status, lock_version: revision.lock_version + 1 };
}
