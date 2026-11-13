/** Trusted server composition. No registration/activation, caller provider or pool factory. */
import 'server-only';
import {z} from 'zod';
import type {Pool} from 'pg';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
const selection=z.strictObject({context_id:z.string().uuid(),workspace_id:z.string().uuid(),
  action:z.enum(['create_offering','submit','publish','suspend','archive'])});
export const CORE_SERVICE_AUTHORING_IDENTITY_PORT_V1='core-service-authoring-identity-port.v1' as const;
/** Exact permissions match SERVICE buildServiceV14CoreCommand/permissionFor.
 * SERVICE owns domain validation, command IDs/key/hash and provider composition.
 * This result is not a receipt or a current allow; C03 rebinds on execute/replay.
 */
export function createCoreServiceAuthoringIdentityPortV1(options:Readonly<{
  pool:Pool;target:CoreFunctionalDevelopmentTargetV1;request:Request;
}>){
  const runtime=createCoreFunctionalCommandRuntimeV1({...options,offering:null});
  return Object.freeze({contract_version:CORE_SERVICE_AUTHORING_IDENTITY_PORT_V1,
    async resolve(value:unknown){
      if(options.request.signal.aborted)throw new Error('service_authoring_request_aborted');
      const input=selection.parse(value);
      const identity=await runtime.resolveCommandIdentity({context_id:input.context_id,workspace_id:input.workspace_id,
        permission_code:input.action==='publish'?'services.catalog.publish':'services.catalog.manage',module_code:'services_catalog'});
      if(options.request.signal.aborted)throw new Error('service_authoring_request_aborted');
      return identity;
    },
  });
}
