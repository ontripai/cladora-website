type ClaimedUnit = { membership_id: string; unit_id: string };
type CustomerContext = { context_id: string; membership_id: string; unit_id: string | null; scope_type: string };

// Match both membership and unit; another role in the same workspace must not
// become the selected context after this invitation is accepted.
export function claimedUnitContextId(claim: ClaimedUnit, contexts: CustomerContext[]): string | null {
  return contexts.find(context => context.membership_id === claim.membership_id
    && context.unit_id === claim.unit_id && context.scope_type === 'unit')?.context_id ?? null;
}
