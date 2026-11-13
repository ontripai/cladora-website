/** Closed read-only queries; no caller SQL or permission/purpose substitution. */
import {z} from 'zod';
const uuid=z.string().uuid().transform(x=>x.toLowerCase());
const coverage=`((g.scope_type='tenant' and g.property_id is null and g.building_id is null and g.unit_id is null)
 or (g.scope_type='property' and g.property_id=p.id and g.building_id is null and g.unit_id is null)
 or (g.scope_type='building' and g.property_id=p.id and g.building_id=b.id and g.unit_id is null)
 or (g.scope_type='unit' and g.property_id=p.id and g.building_id=b.id and g.unit_id=u.id))`;
export const CORE_AIRPROP_READ_SELECTOR_SQL_V1=Object.freeze({
 binding:`select b.id::text,b.status::text,
  to_char(b.valid_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as valid_from,
  case when b.valid_to is null then null else to_char(b.valid_to at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as valid_to
  from platform.workspace_property_bindings b where b.tenant_id=$1::uuid
  and b.customer_workspace_id=$2::uuid and b.property_id=$3::uuid and b.status='active'
  and exists(select 1 from identity.context_grants g where g.id=nullif(current_setting('request.cladora.context_id',true),'')::uuid
   and g.tenant_id=b.tenant_id and (g.scope_type='tenant' or g.property_id=b.property_id))
  order by b.id limit 101 for share`,
 ancestry:`select u.id::text as unit_id,b.id::text as building_id,p.id::text as property_id,
  u.tenant_id::text,u.status::text as unit_status,b.status::text as building_status,p.status::text as property_status,
  g.scope_type::text,g.property_id::text as scope_property_id,g.building_id::text as scope_building_id,g.unit_id::text as scope_unit_id
  from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id
  join identity.context_grants g on g.id=$3::uuid and g.tenant_id=u.tenant_id
  where u.id=$1::uuid and u.tenant_id=$2::uuid and ${coverage} for share of u,b,p,g`,
 spec:`select s.id::text,s.version,s.tenant_id::text,s.unit_id::text,s.building_id::text
  from portfolio.unit_specification_versions s where s.tenant_id=$1::uuid and s.unit_id=$2::uuid
  and exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id
   join identity.context_grants g on g.id=nullif(current_setting('request.cladora.context_id',true),'')::uuid and g.tenant_id=u.tenant_id
   where u.id=s.unit_id and u.tenant_id=s.tenant_id and ${coverage})
  order by s.version desc limit 1 for share`,
});
export function admitCoreAirpropReadSelectorQueryV1(text:string,values:unknown[],bound:{tenant_id:string;workspace_id:string;context_id:string}){
 const q=CORE_AIRPROP_READ_SELECTOR_SQL_V1;
 if(text===q.binding){const p=z.tuple([uuid,uuid,uuid]).parse(values);if(p[0]!==bound.tenant_id||p[1]!==bound.workspace_id)throw new Error('READ_SELECTOR_FOREIGN');return p;}
 if(text===q.ancestry){const p=z.tuple([uuid,uuid,uuid]).parse(values);if(p[1]!==bound.tenant_id||p[2]!==bound.context_id)throw new Error('READ_SELECTOR_FOREIGN');return p;}
 if(text===q.spec){const p=z.tuple([uuid,uuid]).parse(values);if(p[0]!==bound.tenant_id)throw new Error('READ_SELECTOR_FOREIGN');return p;}
 return null;
}
