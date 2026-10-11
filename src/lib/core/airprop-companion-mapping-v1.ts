import {
  coreResourceAuthorityRequestV1Schema,
  evaluateCoreResourceAuthorityV1,
} from './resource-authority-contract-v1.ts';
import { ownerPortfolioCanonicalResourceV1Schema } from './owner-portfolio-projection-v1.ts';
import { workspaceNativeAuthorityDecisionV2Schema } from './workspace-authority-decision-v2.ts';

export const AP_PF02_CORE_COMPANION_VERSION = 'ap-pf02-core-companion.v1';

// Only official, same-Context canonical evidence crosses this read boundary.
// Provenance strings and party names need separate authorized resolvers.
export function mapAirpropCoreCompanionV1(input: {
  request: unknown;
  companion: unknown;
  authority: unknown;
}) {
  const withheld = {
    mapping_version: AP_PF02_CORE_COMPANION_VERSION,
    disclosure: 'withheld' as const,
    context_id: null, resource: null, party: null, representation: null, provenance: null,
    current_authority_recheck_required: true as const,
    reusable_as_command_authority: false as const,
  };
  const request = coreResourceAuthorityRequestV1Schema.safeParse(input.request);
  const companion = ownerPortfolioCanonicalResourceV1Schema.safeParse(input.companion);
  const authority = workspaceNativeAuthorityDecisionV2Schema.safeParse(input.authority);
  if (!request.success || !companion.success || !authority.success) return withheld;
  const item = companion.data;
  if (item.source.source_context_id !== request.data.resource.context_id) return withheld;
  const decision = evaluateCoreResourceAuthorityV1(request.data, {
    resource: item.canonical_reference, relationship: item.relationship, authority: authority.data,
  });
  if (decision.decision !== 'allowed') return withheld;
  const relationship = item.relationship;
  return {
    mapping_version: AP_PF02_CORE_COMPANION_VERSION,
    disclosure: 'verified' as const,
    context_id: request.data.resource.context_id,
    resource: { ...decision.resource_identity, display_name: item.canonical_reference.display_name },
    party: { party_id: relationship.party_id, party_kind: relationship.party_kind, display_name: null },
    representation: relationship.relationship_kind === 'representation' ? {
      relationship_id: relationship.relationship_id,
      relationship_version: relationship.relationship_version,
      representative_party_id: relationship.party_id,
      represented_resource_type: relationship.resource_type,
      represented_resource_id: relationship.resource_id,
    } : null,
    provenance: {
      source_class: item.source.source_class,
      source_context_id: item.source.source_context_id,
      source_workspace_id: item.source.source_workspace_id,
      source_reference: null,
      relationship_evidence_reference: null,
      relationship_evidence_status: relationship.evidence_reference === null ? 'absent' : 'present',
    },
    current_authority_recheck_required: true as const,
    reusable_as_command_authority: false as const,
  };
}
