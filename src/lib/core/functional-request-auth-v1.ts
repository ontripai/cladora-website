import 'server-only';
import {createServerClient,parseCookieHeader} from '@supabase/ssr';
import {cookies} from 'next/headers';

const clients=new WeakMap<Request,{url:string;publishableKey:string;pending:Promise<ReturnType<typeof createServerClient>>}>();
/** Request-local official SSR client. The same request shares refresh state;
 * no actor/scope cache crosses a request. Next's cookie API binds refresh to
 * the actual response. A non-Next transport cannot silently drop a refresh.
 */
export function createCoreFunctionalRequestAuthV1(request:Request,url:string,publishableKey:string){
 const existing=clients.get(request);if(existing){if(existing.url!==url||existing.publishableKey!==publishableKey)throw new Error('CORE_AUTH_REQUEST_CLIENT_BINDING_MISMATCH');return existing.pending;}
 const pending=(async()=>{
  const header=request.headers.get('cookie')??'';
  if(header.length>32768)throw new Error('CORE_AUTH_COOKIE_ENVELOPE_INVALID');
  let store:Awaited<ReturnType<typeof cookies>>|null=null;
  try{store=await cookies();}catch(error){
   if(!(error instanceof Error)||!error.message.startsWith('`cookies` was called outside a request scope.'))throw error;
   // Only the exact official no-request-context case supports a non-Next transport.
  }
  const jar=new Map(parseCookieHeader(header).filter((x):x is {name:string;value:string}=>typeof x.value==='string').map(x=>[x.name,x.value]));
  return createServerClient(url,publishableKey,{cookies:{
   getAll(){return Array.from(jar).map(([name,value])=>({name,value}));},
   setAll(rows){
    if(store===null)throw new Error('CORE_AUTH_REFRESH_RESPONSE_BINDING_REQUIRED');
    for(const {name,value,options} of rows){store.set(name,value,options);if(value)jar.set(name,value);else jar.delete(name);}
   },
  }});
 })();
 clients.set(request,{url,publishableKey,pending});return pending;
}
