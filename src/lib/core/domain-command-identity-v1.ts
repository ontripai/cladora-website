/** Server-only identity input for domain command preparation, never an allow. */
import {z} from 'zod';
const uuid=z.string().uuid().transform(value=>value.toLowerCase());
export const CORE_DOMAIN_COMMAND_IDENTITY_V1='core-domain-command-identity.v1' as const;
export const coreDomainCommandIdentitySelectionV1Schema=z.strictObject({
  context_id:uuid,workspace_id:uuid,
  permission_code:z.enum(['services.catalog.manage','services.catalog.publish','airprop.opportunity.manage','services.quotes.manage']),
  module_code:z.enum(['services_catalog','airprop_commercial','services_orders']),
}).refine(value=>value.module_code===(value.permission_code==='airprop.opportunity.manage'?'airprop_commercial':value.permission_code==='services.quotes.manage'?'services_orders':'services_catalog'),'exact_domain_profile_required');
export const coreDomainCommandIdentityV1Schema=z.strictObject({
  contract_version:z.literal(CORE_DOMAIN_COMMAND_IDENTITY_V1),
  context_id:uuid,workspace_id:uuid,tenant_id:uuid,membership_id:uuid,actor_id:uuid,
  permission_code:z.enum(['services.catalog.manage','services.catalog.publish','airprop.opportunity.manage','services.quotes.manage']),
  module_code:z.enum(['services_catalog','airprop_commercial','services_orders']),authority_version:z.number().int().positive().safe(),
  evaluated_at:z.iso.datetime({offset:true}),completed_at:z.iso.datetime({offset:true}),
  action_authorization:z.literal('not_evaluated'),reusable_as_authority:z.literal(false),
}).refine(value=>value.module_code===(value.permission_code==='airprop.opportunity.manage'?'airprop_commercial':value.permission_code==='services.quotes.manage'?'services_orders':'services_catalog'),'exact_domain_profile_required');
export type CoreDomainCommandIdentitySelectionV1=z.infer<typeof coreDomainCommandIdentitySelectionV1Schema>;
export type CoreDomainCommandIdentityV1=z.infer<typeof coreDomainCommandIdentityV1Schema>;
