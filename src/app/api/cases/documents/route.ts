import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime='nodejs';
const HEADERS={'Cache-Control':'no-store, private', Vary:'Cookie'};
const MAX_BYTES=10*1024*1024;
function actualMime(bytes:Uint8Array):string|null {
  if(bytes.length>=5&&Buffer.from(bytes.subarray(0,5)).toString('ascii')==='%PDF-')return 'application/pdf';
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  return null;
}
export async function POST(request:Request){
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'UNTRUSTED_ORIGIN'}},{status:403,headers:HEADERS});
  const sizeHeader=Number(request.headers.get('content-length'));
  if(sizeHeader>MAX_BYTES+65536)return NextResponse.json({error:{code:'FILE_TOO_LARGE'}},{status:413,headers:HEADERS});
  const form=await request.formData().catch(()=>null);
  if(!form)return NextResponse.json({error:{code:'INVALID_INPUT'}},{status:400,headers:HEADERS});
  const file=form.get('file');
  const parsed=z.object({case_id:z.uuid(),document_id:z.uuid().nullable(),title:z.string().trim().min(1).max(200),visibility:z.enum(['shared','internal'])}).safeParse({
    case_id:form.get('case_id'),document_id:form.get('document_id')||null,title:form.get('title'),visibility:form.get('visibility'),
  });
  if(!parsed.success||!(file instanceof File)||file.size<1||file.size>MAX_BYTES)
    return NextResponse.json({error:{code:'INVALID_DOCUMENT'}},{status:400,headers:HEADERS});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const mime=actualMime(bytes);
  if(!mime||mime!==file.type)return NextResponse.json({error:{code:'UNSUPPORTED_FILE_TYPE'}},{status:400,headers:HEADERS});
  const db=await createClient();
  const {data,error}=await db.schema('customer_api').rpc('begin_customer_case_document_v1',{
    p_case_id:parsed.data.case_id,p_document_id:parsed.data.document_id,p_title:parsed.data.title,
    p_visibility:parsed.data.visibility,p_mime_type:mime,p_byte_size:file.size,
    p_sha256:createHash('sha256').update(bytes).digest('hex'),
  });
  if(error)return NextResponse.json({error:{code:error.code==='42501'?'FORBIDDEN':'UPLOAD_INTENT_FAILED'}},{status:error.code==='42501'?403:400,headers:HEADERS});
  const version=data as {object_path:string;version_id:string;document_id:string};
  const {error:uploadError}=await createAdminClient().storage.from('case-vault').upload(version.object_path,bytes,{contentType:mime,upsert:false});
  if(uploadError)return NextResponse.json({error:{code:'UPLOAD_FAILED_PENDING_RETRY'}},{status:502,headers:HEADERS});
  return NextResponse.json({document:{id:version.document_id,version_id:version.version_id,scan_status:'pending'}},{status:201,headers:HEADERS});
}
