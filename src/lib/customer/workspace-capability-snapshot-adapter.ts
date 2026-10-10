import { z } from 'zod';
import {
  workspaceCapabilitySnapshotV1RpcArgsSchema,
  workspaceCapabilitySnapshotV1Schema,
  type WorkspaceCapabilitySnapshotV1RpcArgs,
  type WorkspaceCapabilitySnapshotV1,
} from './workspace-capability-snapshot-schema';

// This is the bounded row contract expected from the future Core-owned RPC.
// No route may consume it until that RPC exists and its pgTAP contract is accepted.
export const workspaceCapabilityRpcPayloadV1Schema = workspaceCapabilitySnapshotV1Schema;

export function parseWorkspaceCapabilityRpcArgsV1(
  input: unknown,
): WorkspaceCapabilitySnapshotV1RpcArgs {
  return workspaceCapabilitySnapshotV1RpcArgsSchema.parse(input);
}

const forbiddenSoleDenialReasons = new Set([
  'taxonomy_not_configured',
  'property_profile_missing',
  'operating_model_missing',
  'contract_id_missing',
]);

export function adaptWorkspaceCapabilityRpcPayloadV1(
  input: unknown,
): WorkspaceCapabilitySnapshotV1 {
  const snapshot = workspaceCapabilityRpcPayloadV1Schema.parse(input);

  if (snapshot.reference_visibility === 'withheld') {
    if (
      snapshot.resources.visibility !== 'withheld'
      || snapshot.resources.visible_count !== null
      || snapshot.resources.total_count !== null
      || snapshot.resources.resource_ids.length !== 0
    ) {
      throwDisclosureError(['resources'], 'Withheld responses cannot expose resource IDs or counts');
    }
  }

  if (
    snapshot.reference_visibility === 'count_only'
    && snapshot.resources.visibility === 'full'
  ) {
    throwDisclosureError(['resources'], 'Count-only responses cannot expose resource IDs');
  }

  for (const capability of snapshot.capabilities) {
    const reasons = capability.state_reason_codes;
    const hasOnlyForbiddenDenialReasons =
      reasons.length > 0 && reasons.every((reason) => forbiddenSoleDenialReasons.has(reason));

    if (capability.workspace_state === 'unavailable' && hasOnlyForbiddenDenialReasons) {
      throwDisclosureError(
        ['capabilities', capability.capability_key, 'workspace_state'],
        'Descriptive taxonomy or a missing contract_id cannot be the sole denial reason',
      );
    }

    if (
      capability.entitlement?.provenance === 'legacy_unprovenanced'
      && capability.entitlement.contract.visibility !== 'not_applicable'
    ) {
      throwDisclosureError(
        ['capabilities', capability.capability_key, 'entitlement', 'contract'],
        'Legacy unprovenanced entitlements cannot expose or infer a contract',
      );
    }

    if (snapshot.reference_visibility === 'withheld') {
      const restrictionLeak = capability.restrictions.some(
        (restriction) => restriction.resource_id !== null
          || restriction.source_id !== null
          || restriction.source_version !== null,
      );
      if (
        capability.module?.definition_id !== null
        || capability.module?.activation_id !== null
        || capability.entitlement?.entitlement_id !== null
        || (capability.entitlement !== null
          && capability.entitlement.contract.visibility !== 'withheld'
          && capability.entitlement.contract.visibility !== 'not_applicable')
        || restrictionLeak
      ) {
        throwDisclosureError(
          ['capabilities', capability.capability_key],
          'Withheld responses cannot expose module, entitlement, contract, resource or source references',
        );
      }
    }

    if (snapshot.reference_visibility === 'count_only') {
      const restrictionIdLeak = capability.restrictions.some(
        (restriction) => restriction.resource_id !== null || restriction.source_id !== null,
      );
      if (restrictionIdLeak) {
        throwDisclosureError(
          ['capabilities', capability.capability_key, 'restrictions'],
          'Count-only responses cannot expose resource or source identifiers',
        );
      }
    }
  }

  return snapshot;
}

function throwDisclosureError(path: PropertyKey[], message: string): never {
  throw new z.ZodError([{
    code: 'custom',
    path,
    message,
  }]);
}
