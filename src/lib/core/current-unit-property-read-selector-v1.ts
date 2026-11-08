/** Additive read selector; accepted command selector/receipt contract is unchanged. */
import 'server-only';
import {z} from 'zod';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {checkpointCoreAirpropReadScopeV1,inspectCoreAirpropReadObservationV1,CoreReadHostUnavailableV1} from './airprop-read-host-v1';
import {CORE_AIRPROP_READ_SELECTOR_SQL_V1 as SQL} from './airprop-read-selector-queries-v1';
const uuid=z.string().uuid(),instant=z.iso.datetime({offset:true}).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const input=z.strictObject({property_id:uuid,unit_id:uuid,expected_resource_version:z.number().int().positive().safe().optional()});
const bindingRow=z.strictObject({id:uuid,status:z.string(),valid_from:instant,valid_to:instant.nullable()});
const ancestryRow=z.strictObject({unit_id:uuid,building_id:uuid,property_id:uuid,tenant_id:uuid,unit_status:z.string(),building_status:z.string(),property_status:z.string(),
 scope_type:z.enum(['tenant','property','building','unit']),scope_property_id:uuid.nullable(),scope_building_id:uuid.nullable(),scope_unit_id:uuid.nullable()});
const specRow=z.strictObject({id:uuid,version:z.number().int().positive().safe(),tenant_id:uuid,unit_id:uuid,building_id:uuid});
export const CORE_UNIT_PROPERTY_READ_SELECTOR_V1='core-unit-property-read-selector.v1' as const;
const closed=(status:'withheld'|'stale'|'not_ready')=>Object.freeze({contract_version:CORE_UNIT_PROPERTY_READ_SELECTOR_V1,status,binding:null,
 canonical_companion:null,action_authorization:'not_evaluated' as const,reusable_as_command_authority:false as const});
/** Uses a genuine live host scope and its fresh canonical read checkpoint. The
 * result is bounded Unit ancestry/spec identity ONLY. No Party, relationship,
 * label, complete current_until or command-authority evidence is fabricated. */
export async function selectCurrentUnitPropertyForReadV1(scope:CoreTransactionScopeV1,value:unknown){
 const target=input.parse(value);
 const first=await checkpointCoreAirpropReadScopeV1(scope),before=inspectCoreAirpropReadObservationV1(scope,first);
 if(!before)throw new CoreReadHostUnavailableV1('READ_CHECKPOINT_UNAVAILABLE');
 const bindings=await scope.query(SQL.binding,[before.tenant_id,before.workspace_id,target.property_id]);
 if(bindings.rowCount!==bindings.rows.length)throw new CoreReadHostUnavailableV1('READ_SELECTOR_SOURCE_INVALID');
 if(bindings.rows.length===0)return closed('withheld');
 const candidates=z.array(bindingRow).max(100).parse(bindings.rows);
 const ancestry=await scope.query(SQL.ancestry,[target.unit_id,before.tenant_id,before.context_id]);
 if(ancestry.rowCount!==ancestry.rows.length)throw new CoreReadHostUnavailableV1('READ_SELECTOR_SOURCE_INVALID');
 if(ancestry.rows.length!==1)return closed('withheld');
 const unit=ancestryRow.parse(ancestry.rows[0]);
 if(unit.tenant_id!==before.tenant_id||unit.property_id!==target.property_id||unit.unit_id!==target.unit_id
  ||[unit.unit_status,unit.building_status,unit.property_status].some(x=>x!=='active'))return closed('withheld');
 const covers=unit.scope_type==='tenant'?unit.scope_property_id===null&&unit.scope_building_id===null&&unit.scope_unit_id===null
  :unit.scope_type==='property'?unit.scope_property_id===target.property_id&&unit.scope_building_id===null&&unit.scope_unit_id===null
   :unit.scope_type==='building'?unit.scope_property_id===target.property_id&&unit.scope_building_id===unit.building_id&&unit.scope_unit_id===null
    :unit.scope_property_id===target.property_id&&unit.scope_building_id===unit.building_id&&unit.scope_unit_id===target.unit_id;
 if(!covers)return closed('withheld');
 const specs=await scope.query(SQL.spec,[before.tenant_id,target.unit_id]);
 if(specs.rowCount!==specs.rows.length||specs.rows.length>1)throw new CoreReadHostUnavailableV1('READ_SELECTOR_SOURCE_INVALID');
 if(specs.rows.length===0)return closed('not_ready');
 const spec=specRow.parse(specs.rows[0]);
 if(spec.tenant_id!==before.tenant_id||spec.unit_id!==target.unit_id||spec.building_id!==unit.building_id)return closed('withheld');
 const last=await checkpointCoreAirpropReadScopeV1(scope),after=inspectCoreAirpropReadObservationV1(scope,last);
 if(!after||after.database_transaction_id!==before.database_transaction_id||after.backend_pid!==before.backend_pid
  ||after.authority_revision!==before.authority_revision)throw new CoreReadHostUnavailableV1('READ_CHECKPOINT_UNAVAILABLE');
 // All operands are server-rendered UTC instants with six fractional digits.
 // No Date.parse truncation, JS wall clock, transaction-start time or minted TTL.
 const applicable=candidates.filter(row=>row.status==='active'&&row.valid_from<=after.checked_at&&(row.valid_to===null||row.valid_to>after.checked_at));
 if(applicable.length!==1)return closed('withheld');const binding=applicable[0];
 if(target.expected_resource_version!==undefined&&target.expected_resource_version!==spec.version)return closed('stale');
 return Object.freeze({contract_version:CORE_UNIT_PROPERTY_READ_SELECTOR_V1,status:'selected' as const,
  binding:Object.freeze({context_id:after.context_id,workspace_id:after.workspace_id,tenant_id:after.tenant_id,membership_id:after.membership_id,
   actor_id:after.actor_id,property_id:unit.property_id,building_id:unit.building_id,unit_id:unit.unit_id,
   specification_id:spec.id,resource_version:spec.version,evaluated_at:after.checked_at,
   scope_and_binding_until:binding.valid_to!==null&&binding.valid_to<after.scope_expires_at?binding.valid_to:after.scope_expires_at}),
  canonical_companion:null,canonical_producer_status:'PARTY_RELATIONSHIP_SOURCE_REQUIRED' as const,
  action_authorization:'not_evaluated' as const,reusable_as_command_authority:false as const});
}
