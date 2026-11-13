/** Fixed canonical own-membership ownership family; no Party discovery fallback. */
import {CORE_LISTING_OWNERSHIP_ADOPTION_SQL_V1} from './listing-ownership-adoption-query-v1';
import {z} from 'zod';
const uuid=z.string().uuid();
export const CORE_LISTING_OWNERSHIP_CANDIDATE_SQL_V1=`select o.id::text as ownership_id,o.native_revision_v1::text as ownership_version,
 o.tenant_id::text,o.unit_id::text,o.party_id::text,p.native_revision_v1::text as party_version,p.type::text as party_kind,
 s.unit_code::text as resource_label,current_setting('TimeZone') as date_zone,
 to_char(o.valid_from::timestamp at time zone current_setting('TimeZone') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as valid_from,
 case when o.valid_to is null then null else to_char(o.valid_to::timestamp at time zone current_setting('TimeZone') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as valid_until,
 to_char(mp.valid_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as party_link_from,
 case when mp.valid_until is null then null else to_char(mp.valid_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as party_link_until
 from portfolio.ownerships o join portfolio.parties p on p.id=o.party_id and p.tenant_id=o.tenant_id
 join identity.membership_parties mp on mp.party_id=p.id and mp.tenant_id=p.tenant_id and mp.membership_id=$4::uuid
 join identity.memberships m on m.id=mp.membership_id and m.tenant_id=mp.tenant_id and m.user_id=auth.uid()
 join portfolio.units u on u.id=o.unit_id and u.tenant_id=o.tenant_id
 join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 join portfolio.unit_specification_versions s on s.id=$7::uuid and s.tenant_id=u.tenant_id and s.unit_id=u.id and s.building_id=b.id
 join identity.context_grants g on g.id=$3::uuid and g.tenant_id=m.tenant_id and g.membership_id=m.id
 join platform.workspace_property_bindings w on w.tenant_id=o.tenant_id and w.customer_workspace_id=$2::uuid and w.property_id=b.property_id and w.status='active'
 where o.tenant_id=$1::uuid and o.unit_id=$5::uuid and b.property_id=$6::uuid and p.archived_at is null and o.finalized_at is not null
 and ((g.scope_type='tenant' and g.property_id is null and g.building_id is null and g.unit_id is null)
  or(g.scope_type='property' and g.property_id=b.property_id and g.building_id is null and g.unit_id is null)
  or(g.scope_type='building' and g.property_id=b.property_id and g.building_id=b.id and g.unit_id is null)
  or(g.scope_type='unit' and g.property_id=b.property_id and g.building_id=b.id and g.unit_id=u.id))
 order by o.id,mp.valid_from limit 101 for share of o,p,mp,u,m,g,w,s`;
export function admitCoreListingOwnershipQueryV1(text:string,values:unknown[],bound:{tenant_id:string;workspace_id:string;context_id:string;membership_id:string}){
 if(text===CORE_LISTING_OWNERSHIP_ADOPTION_SQL_V1){if(values.length)throw Error('LISTING_ADOPTION_QUERY_PARAMETERS');return [];}
 if(text!==CORE_LISTING_OWNERSHIP_CANDIDATE_SQL_V1)return null;
 const p=z.tuple([uuid,uuid,uuid,uuid,uuid,uuid,uuid]).parse(values);
 if(p[0]!==bound.tenant_id||p[1]!==bound.workspace_id||p[2]!==bound.context_id||p[3]!==bound.membership_id)throw Error('LISTING_OWNERSHIP_FOREIGN_SCOPE');
 return p;
}
