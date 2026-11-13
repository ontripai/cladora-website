/** CE discovery is an authorized read observation, never command authority. */
import 'server-only';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {resolveGuideRequestBindingV1,guideRuntimeUnavailableV1} from './experience-guide-route-runtime-v1';
import {createExperienceGuideLifecycleRequestPoolV1} from './experience-guide-lifecycle-http-v1';
import {CE012_FUNCTIONAL_AUTH_SQL} from './experience-guide-functional-http-v1';
import {guideSelectionV1Schema} from './experience-guide-discovery-contract';
const headers={'cache-control':'no-store, private','content-type':'application/json','vary':'Cookie'};
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
// Bound each label in the SQL result BEFORE transfer. Invalid labels yield NULL
// and an explicit failed marker; never truncate text or silently filter a row.
export const CE_GUIDE_DISCOVERY_CANDIDATES_SQL_V1=`select g.id::text as context_id,m.id::text as membership_id,
 m.tenant_id::text as tenant_id,w.id::text as workspace_id,
 case when pg_catalog.octet_length(t.legal_name) between 1 and 1024 and pg_catalog.char_length(t.legal_name)<=256
  then t.legal_name else null end as tenant_name,
 case when pg_catalog.octet_length(r.name) between 1 and 1024 and pg_catalog.char_length(r.name)<=256
  then r.name else null end as role_name,
 coalesce(pg_catalog.octet_length(t.legal_name) between 1 and 1024 and pg_catalog.char_length(t.legal_name)<=256
  and pg_catalog.octet_length(r.name) between 1 and 1024 and pg_catalog.char_length(r.name)<=256,false) as transfer_bounds_valid
 from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
 join platform.tenants t on t.id=m.tenant_id join identity.roles r on r.id=m.role_id
 join platform.customer_workspaces w on w.tenant_id=m.tenant_id
 where m.user_id=auth.uid() and m.status='active' and w.archived_at is null and w.lifecycle_status='ACTIVE'
 and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp())
 and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp())
 order by g.id,w.id limit 51 for share of g,m,w`;
const candidate=guideSelectionV1Schema.extend({tenant_id:z.string().uuid(),transfer_bounds_valid:z.literal(true)});
const auth=z.object({tenant_id:z.string().uuid(),membership_id:z.string().uuid(),can_read:z.boolean(),revision:z.coerce.number().int().positive().safe()});
const sessionSql='select app_private.require_request_session_current_at_v1(clock_timestamp())';
const scopeSql="select set_config('request.cladora.context_id',$1,true),set_config('request.cladora.workspace_id',$2,true)";
export async function readGuideDiscoveryV1(request:Request){
 if(new URL(request.url).search)return json(400,{error:{code:'INVALID_REQUEST'}});
 let client:PoolClient|undefined,settled=false;
 try{const binding=await resolveGuideRequestBindingV1(request);if(!binding)return guideRuntimeUnavailableV1();
  const s=await binding.dependencies.authenticate(request);if(!s)return json(401,{error:{code:'UNAUTHORIZED'}});
  client=await createExperienceGuideLifecycleRequestPoolV1(binding.dependencies.role_bound_pool,s).connect();
  await client.query('begin isolation level serializable');await client.query(sessionSql);
  const epoch=await client.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton for share');
  const revision=z.coerce.number().int().positive().safe().parse(epoch.rows[0]?.revision);
  const candidates=await client.query(CE_GUIDE_DISCOVERY_CANDIDATES_SQL_V1);
  const rows=z.array(candidate).max(51).parse(candidates.rows);if(rows.length>50)return guideRuntimeUnavailableV1();
  const selections:z.infer<typeof guideSelectionV1Schema>[]=[];
  const check=async(row:z.infer<typeof candidate>)=>{await client!.query(scopeSql,[row.context_id,row.workspace_id]);
   const result=await client!.query(CE012_FUNCTIONAL_AUTH_SQL,[row.context_id,row.workspace_id]);if(result.rowCount!==1)return false;
   const a=auth.parse(result.rows[0]);return a.can_read&&a.revision===revision&&a.tenant_id===row.tenant_id&&a.membership_id===row.membership_id;};
  for(const row of rows.slice(0,50))if(await check(row))selections.push(guideSelectionV1Schema.parse(row));
  // Issuer verification may wait; finish it before the final canonical read and
  // session gates while the admitted transaction/lease is still held.
  const fresh=await binding.dependencies.authenticate(request);if(!fresh||fresh.actor_id!==s.actor_id||fresh.session_id!==s.session_id)return json(401,{error:{code:'UNAUTHORIZED'}});
  // Recheck every disclosed tuple AFTER all candidate/authority waits. Discovery
  // never manufactures a dashboard, selects the first Workspace or uses SERVICE.
  for(const selection of selections){const row=rows.find(r=>r.context_id===selection.context_id&&r.workspace_id===selection.workspace_id)!;
   if(!await check(row))return json(403,{error:{code:'CE_GUIDE_ACCESS_DENIED'}});}
  await client.query(sessionSql);const ack=await client.query('rollback');if(ack.command!=='ROLLBACK')throw Error('GUIDE_DISCOVERY_ROLLBACK_UNKNOWN');settled=true;const closed=client;client=undefined;closed.release();
  return json(200,{contract:'ce-guide-discovery.v1',selections,limit:50,truncated:false,authority:'not_evaluated'});
 }catch(error){const code=(error as {code?:string})?.code;return code==='42501'?json(403,{error:{code:'CE_GUIDE_ACCESS_DENIED'}}):code==='40001'?json(409,{error:{code:'CE_GUIDE_CONFLICT'}}):guideRuntimeUnavailableV1();}
 finally{if(client){if(!settled)try{await client.query('rollback');}catch{/* No disclosure was returned as success. */}try{client.release(true);}catch{/* Failed paths disclose no selection data. */}}}
}
