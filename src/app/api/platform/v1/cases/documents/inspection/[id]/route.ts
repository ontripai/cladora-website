import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime='nodejs';
const HEADERS={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',Vary:'Cookie'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!z.uuid().safeParse(id).success)return NextResponse.json({error:{code:'INVALID_ID'}},{status:400,headers:HEADERS});
  const db=await createClient();
  const {data,error}=await db.schema('customer_api').rpc('get_customer_case_inspection_v1',{p_version_id:id});
  if(error||!data)return NextResponse.json({error:{code:'INSPECTION_FORBIDDEN'}},{status:403,headers:HEADERS});
  const document=data as {bucket:string;object_path:string;mime_type:string};
  const {data:blob,error:storageError}=await createAdminClient().storage.from(document.bucket).download(document.object_path);
  if(storageError||!blob)return NextResponse.json({error:{code:'FILE_UNAVAILABLE'}},{status:404,headers:HEADERS});
  return new NextResponse(await blob.arrayBuffer(),{headers:{...HEADERS,'Content-Type':'application/octet-stream',
    'Content-Disposition':'attachment; filename="case-inspection.bin"'}});
}
