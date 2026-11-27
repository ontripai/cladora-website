/** Bounded HTTP-byte transfer only. Not authority, persistent custody or a command. */
import 'server-only';
import {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
export const CORE_LISTING_ORIGINAL_WIRE_HANDOFF_V1='core-listing-original-wire-handoff.v1' as const;
export const CORE_LISTING_WIRE_LIMIT_V1=16384;
export const CORE_LISTING_WIRE_BUDGET_MS_V1=15000;
export type CoreListingOriginalWireV1=Readonly<{
 contract_version:typeof CORE_LISTING_ORIGINAL_WIRE_HANDOFF_V1;
 wire_utf8:string;byte_length:number;http_body_sha256:string;
 durability:'request_memory_only';action_authorization:'not_evaluated';
}>;
const originals=new WeakMap<Request,CoreListingOriginalWireV1>();
export class CoreListingWireHandoffErrorV1 extends Error {
 constructor(readonly code:'LISTING_WIRE_METHOD'|'LISTING_WIRE_CONTENT_TYPE'|'LISTING_WIRE_ALREADY_USED'|'LISTING_WIRE_EMPTY'|'LISTING_WIRE_TOO_LARGE'|'LISTING_WIRE_INVALID_UTF8'|'LISTING_WIRE_ABORTED'|'LISTING_WIRE_TIMEOUT') {super(code);this.name='CoreListingWireHandoffErrorV1';}
}
/** AIRPROP calls after origin/content-type guard, BEFORE its unchanged parser.
 * It must use this SAME returned Request for BOTH parser and runtime resolver.
 * No clone/tee, JSON stringify, normalization, new key or authority is involved. */
export async function captureCoreListingOriginalRequestV1(request:Request):Promise<NextRequest>{
 if(!(request instanceof Request)||request.method!=='POST')throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_METHOD');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_CONTENT_TYPE');
 if(request.bodyUsed||request.body?.locked)throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_ALREADY_USED');
 if(request.signal.aborted)throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_ABORTED');
 if(!request.body)throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_EMPTY');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0,finished=false;
 const timer=AbortSignal.timeout(CORE_LISTING_WIRE_BUDGET_MS_V1),signal=AbortSignal.any([request.signal,timer]);
 let onAbort:()=>void=()=>{};
 const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new CoreListingWireHandoffErrorV1(request.signal.aborted?'LISTING_WIRE_ABORTED':'LISTING_WIRE_TIMEOUT'));signal.addEventListener('abort',onAbort,{once:true});});
 try{
  for(;;){
   if(signal.aborted)throw new CoreListingWireHandoffErrorV1(request.signal.aborted?'LISTING_WIRE_ABORTED':'LISTING_WIRE_TIMEOUT');
   const next=await Promise.race([reader.read(),aborted]);if(next.done){finished=true;break;}
   if(!(next.value instanceof Uint8Array))throw new TypeError('LISTING_WIRE_STREAM_CHUNK');
   size+=next.value.byteLength;if(size>CORE_LISTING_WIRE_LIMIT_V1)throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_TOO_LARGE');
   chunks.push(new Uint8Array(next.value));
  }
  if(!size)throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_EMPTY');
  if(signal.aborted)throw new CoreListingWireHandoffErrorV1(request.signal.aborted?'LISTING_WIRE_ABORTED':'LISTING_WIRE_TIMEOUT');
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  let wire:string;try{wire=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new CoreListingWireHandoffErrorV1('LISTING_WIRE_INVALID_UTF8');}
  // Reject neither whitespace nor BOM here: exact HTTP bytes survive; domain JSON
  // validation decides validity. The plan/canonical-command mapping is separate.
  const replay=new NextRequest(request.url,{method:request.method,headers:new Headers(request.headers),signal:request.signal,body:bytes});
  originals.set(replay,Object.freeze({contract_version:CORE_LISTING_ORIGINAL_WIRE_HANDOFF_V1,wire_utf8:wire,byte_length:size,
   http_body_sha256:createHash('sha256').update(bytes).digest('hex'),durability:'request_memory_only',action_authorization:'not_evaluated'}));
  return replay;
 }finally{
  signal.removeEventListener('abort',onAbort);
  if(!finished){try{void reader.cancel().catch(()=>{});}catch{/* Preserve first stream/size/abort error; no settlement claim. */}}
  try{reader.releaseLock();}catch{/* Pending aborted read remains rejected, no replacement error. */}
 }
}
/** Data observation only. A clone/JSON/reconstructed Request never has this entry. */
export function inspectCoreListingOriginalRequestV1(request:Request):CoreListingOriginalWireV1|null{
 return request.signal.aborted?null:originals.get(request)??null;
}
