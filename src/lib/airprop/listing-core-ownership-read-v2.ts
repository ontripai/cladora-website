import 'server-only';
import { createCoreListingOwnershipCompanionV1 } from '../core/listing-ownership-companion-v1';
import { listingSourceVersionsV2Schema } from './listing-flow-contract-v1';
import type { ListingCanonicalProducerV1 } from './listing-native-read-v1';
/** Official own-party read only. Core owns scope, versions, currentness and family.
 * No management projection, command receipt, cached allow or source fallback. */
export function createListingCoreOwnershipReadV2(): ListingCanonicalProducerV1 {
  const producer = createCoreListingOwnershipCompanionV1();
  return { async readCanonical(scope, server, row, at) {
    const value = await producer.readCanonical(scope, server, row, at);
    const source_versions = listingSourceVersionsV2Schema.parse({ version: 2, ...value.source_versions });
    return { ...value, source_versions };
  } };
}
