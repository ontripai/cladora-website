import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCoreServiceAppRuntimeV1} from './private-service-development-binding-v1';
import {serviceRequestReadSchema} from '../customer/service-request-read-schema';
import {serviceOfferingRevisionSchema} from '../customer/service-catalog-schema';
const uuid=z.string().uuid(),headers={'Cache-Control':'no-store, private',Pragma:'no-cache',Vary:'Cookie'};
export const CORE_SERVICE_APP_READ_V1='core-service-app-read.v1' as const;
const selection=z.strictObject({context_id:uuid,membership_id:uuid,tenant_id:uuid,workspace_id:uuid,tenant_name:z.string(),role_code:z.string(),role_name:z.string(),workspace_type:z.string(),environment:z.string()});
const fields=serviceOfferingRevisionSchema.shape;
const catalog=z.array(z.strictObject({offering_id:uuid,revision_id:uuid,labels:fields.labels,description:fields.description,acquisition_mode:fields.acquisition_mode,price:fields.price,valid_from:fields.valid_from,valid_until:fields.valid_until,cancellation_terms:fields.cancellation_terms,acceptance_criteria:fields.acceptance_criteria}));
/** Selection is discovery, not a reusable allow. Each read and command rebinds
 * canonical server scope. No arbitrary callback/query or caller actor accepted.
 */
export async function coreServiceAppReadV1(request:NextRequest,kind:'selections'|'catalog'|'requests'){
 if(process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE!=='core-service-real-app-assembly.v1')return null;
 const query=request.nextUrl.searchParams;
 const keys=kind==='selections'?[]:['context_id','workspace_id'];
 const fail=(code:string,status:number)=>NextResponse.json({error:{code}},{status,headers});
 if(Array.from(query.keys()).some(x=>!keys.includes(x))||keys.some(x=>query.getAll(x).length!==1))return fail('INVALID_REQUEST',400);
 const parsed=kind==='selections'?null:z.strictObject({context_id:uuid,workspace_id:uuid}).safeParse(Object.fromEntries(query));
 if(parsed&&!parsed.success)return fail('INVALID_REQUEST',400);
 try{
  const runtime=getCoreServiceAppRuntimeV1(request);if(!runtime)return fail('CORE_SERVICE_ASSEMBLY_NOT_READY',503);
  const result=await runtime.readServiceApp(kind,parsed?.success?parsed.data:undefined);
  const body=kind==='selections'?{contract_version:CORE_SERVICE_APP_READ_V1,selections:z.array(selection).parse(result.value)}
   :kind==='catalog'?{offerings:catalog.parse(result.value)}:serviceRequestReadSchema.parse(result.value);
  return NextResponse.json(body,{headers});
 }catch(error){
  const code=(error as {code?:string})?.code;
  if(code==='40001')return fail('SERVICE_CONFLICT',409);
  if(code==='42501'||code==='READ_SCOPE_DENIED'||code==='SCOPE_DENIED')return fail('SERVICE_ACCESS_DENIED',403);
  if(code==='AUTHENTICATION_REQUIRED'||code==='ACTOR_BINDING_MISMATCH')return fail('UNAUTHORIZED',401);
  return fail('CORE_SERVICE_ASSEMBLY_NOT_READY',503);
 }
}
