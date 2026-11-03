import 'server-only';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {z} from 'zod';
import {createCoreServiceFunctionalBindingV1} from './service-functional-binding-v1';
import {createCoreFunctionalCommandRuntimeV1,coreFunctionalDevelopmentTargetV1Schema} from './functional-command-runtime-v1';
const path='/workspace/private/cladora-functional-dev-v1/core15/service-runtime-binding.json';
const schema=z.strictObject({contract:z.literal('core15-owned-service-private-binding.v1'),platform:z.literal('794f5a12c3928ae0a3585ab679a3cbe60aab49a3'),
 target:coreFunctionalDevelopmentTargetV1Schema,password:z.string().regex(/^[a-f0-9]{64}$/)});
/** Server-only named development composition. No profile/secret discovery or
 * principal cache; each bind verifies real issuer/session and each lease checks
 * the actual database marker, OID, PID and ordinary role. No public activation.
 */
let readFactory:((request:Request)=>ReturnType<typeof createCoreFunctionalCommandRuntimeV1>)|null=null;
export function getCoreServiceAppRuntimeV1(request:Request){const binding=getCore15PrivateServiceDevelopmentBindingV1();return binding?readFactory?.(request)??null:null;}
let cachedIdentity:string|null=null;
let cached:ReturnType<typeof createCoreServiceFunctionalBindingV1>|null=null;
export function getCore15PrivateServiceDevelopmentBindingV1(){
 const selected=process.env.CLADORA_CORE15_SERVICE_BINDING_FILE;
 if(!selected)return null;
 const assembly=process.env.NODE_ENV==='production'&&process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE==='core-service-real-app-assembly.v1'&&process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY==='v1';
 if(selected!==path||(!['development','test'].includes(process.env.NODE_ENV??'')&&!assembly)
  ||process.env.VERCEL||process.env.VERCEL_ENV||process.env.NEXT_PUBLIC_VERCEL_ENV
  ||!/^[a-f0-9]{64}$/.test(process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256??''))throw new Error('CORE15_PRIVATE_DEVELOPMENT_BINDING_REQUIRED');
 const stat=lstatSync(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(stat.mode&0o077)!==0||stat.uid!==process.getuid?.()||stat.size>32768)throw new Error('CORE15_PRIVATE_BINDING_CUSTODY');
 const raw=readFileSync(path);
 if(createHash('sha256').update(raw).digest('hex')!==process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256)throw new Error('CORE15_PRIVATE_BINDING_IDENTITY');
 const parsed=schema.safeParse(JSON.parse(raw.toString('utf8')));
 if(!parsed.success)throw new Error('CORE15_PRIVATE_BINDING_SCHEMA');
 const config=parsed.data,t=config.target;
 if(t.database_name!=='postgres'||t.host!=='127.0.0.1'||t.port!==55422||t.auth_origin!=='http://127.0.0.1:55421'
  ||t.runtime_role!=='cladora_core_runtime'||!/^core15-dev:[a-f0-9]{32}$/.test(t.backend_id))throw new Error('CORE15_PRIVATE_BINDING_TARGET');
 // Revalidate custody/content on every use, including warm-cache reads. An
 // identity change never silently reuses the previous target or opens a new pool.
 const identity=JSON.stringify({path:selected,digest:process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256,
  mode:process.env.NODE_ENV,profile:process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE??null,
  publicProfile:process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY??null,platform:config.platform,target:t});
 if(cached){if(identity!==cachedIdentity)throw new Error('CORE15_PRIVATE_BINDING_RESTART_REQUIRED');return cached;}
 const pool=new Pool({host:t.host,port:t.port,database:t.database_name,user:t.runtime_role,password:config.password,
  max:4,connectionTimeoutMillis:5000,query_timeout:15000});
 // Idle socket loss has no pending result/settlement to acknowledge. Active
 // query failures still propagate unchanged through the lease/host boundary.
 pool.on('error',()=>{console.error('CORE15_SERVICE_IDLE_POOL_LEASE_LOST');});
 readFactory=request=>createCoreFunctionalCommandRuntimeV1({pool,target:t,offering:null,request});
 cached=createCoreServiceFunctionalBindingV1({pool,target:t});cachedIdentity=identity;return cached;
}
