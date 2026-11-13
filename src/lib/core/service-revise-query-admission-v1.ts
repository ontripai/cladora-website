/** Exact provider-scope query gate. Authority stays in canonical C01/S01/C03. */
import 'server-only';
import {z} from 'zod';
import profile from './service-revise-query-profile-v1.json';
import {createCoreServiceReviseQueryCandidateV1,CORE_SERVICE_REVISE_QUERY_V1} from './service-revise-admission-candidate-v1';
import type{CoreTransactionScopeV1,CoreTransactionCommandV2}from'./postgres-transaction-host-v1';
const queries=new Map(profile.queries.map(q=>[q.sql,q]));
const ref=z.object({offering_id:z.string().uuid(),old_revision_id:z.string().uuid(),provider_party_id:z.string().uuid(),provider_agreement:z.object({agreement_id:z.string().uuid(),agreement_version:z.number().int().positive().safe()})});
export function assertCoreServiceReviseScopedQueryV1(scope:CoreTransactionScopeV1,command:CoreTransactionCommandV2,original:unknown,phase:'read'|'mutation',sql:unknown,args:unknown){
 if(typeof sql!=='string'||!Array.isArray(args))throw Error('service_scope_query_not_admitted');const q=queries.get(sql);
 if(!q||args.length!==q.parameters)throw Error('service_scope_query_not_admitted');
 const c=ref.parse(original),expected:Record<string,unknown>={context:command.context_id,workspace:scope.workspace_id,tenant:scope.tenant_id,permission:'services.catalog.manage',module:'services_catalog',offering:c.offering_id,old_revision:c.old_revision_id,party:c.provider_party_id,agreement:c.provider_agreement.agreement_id,agreement_version:c.provider_agreement.agreement_version};
 if(sql===CORE_SERVICE_REVISE_QUERY_V1.write||sql===CORE_SERVICE_REVISE_QUERY_V1.readback){
  if(sql===CORE_SERVICE_REVISE_QUERY_V1.write&&phase!=='mutation')throw Error('service_read_phase_mutation');
  const guard=createCoreServiceReviseQueryCandidateV1({scope,core_command:command,original_command:original,provider_code:'service_offering_revise',phase:sql===CORE_SERVICE_REVISE_QUERY_V1.write?'mutation':'replay'});guard.assertQuery(sql,args);return;
 }
 for(let i=0;i<q.arguments.length;i++){const name=q.arguments[i];if(name==='time'){if(!z.iso.datetime({offset:true}).safeParse(args[i]).success)throw Error('service_scope_time_shape');}else if(args[i]!==expected[name])throw Error('service_scope_argument_mismatch');}
}
