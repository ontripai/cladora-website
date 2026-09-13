import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {downloadExportSchema} from '@/lib/customer/export-pack-schema';
import {hasTrustedMutationOrigin} from '@/lib/security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '@/lib/security/request-body';
import {exportArtifactErrorMessage,type ExportArtifactErrorCode} from '@/lib/customer/export-artifact-errors';

const H={'Cache-Control':'no-store, private',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:H});
  if(!isApplicationJson(req.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:H});
  const {data:raw,errorResponse}=await parseJsonWithLimit<unknown>(req,8*1024);if(errorResponse)return errorResponse;
  const p=downloadExportSchema.safeParse(raw);if(!p.success||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:H});
  const s=await createClient();const {data:c,error:a}=await s.auth.getClaims();if(a||!c?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:H});
  const {data,error}=await s.schema('customer_api').rpc('authorize_export_artifact_download_v1' as never,{p_context_id:p.data.context_id,p_export_pack_id:id,p_report_code:p.data.report_code,p_format:p.data.format} as never);
  if(error||!data){const message=error?.message??'';const gateCode:ExportArtifactErrorCode|null=message.includes('scan_pending')?'EXPORT_SCAN_PENDING':message.includes('quarantined')?'EXPORT_QUARANTINED':message.includes('scan_failed')?'EXPORT_SCAN_FAILED':message.includes('not_materialized')?'EXPORT_NOT_MATERIALIZED':null;const code=gateCode??(error?.code==='42501'?'EXPORT_ACCESS_DENIED':'EXPORT_NOT_FOUND');return NextResponse.json({error:{code,message:gateCode?exportArtifactErrorMessage(gateCode,req.headers.get('accept-language')):undefined}},{status:error?.code==='42501'?423:404,headers:H})}
  const artifact=data as {bucket_id:string;object_path:string;filename:string;media_type:string;sha256:string;byte_size:number;expires_in_seconds:number};
  const {data:signed,error:signError}=await s.storage.from(artifact.bucket_id).createSignedUrl(artifact.object_path,artifact.expires_in_seconds,{download:artifact.filename});
  if(signError||!signed?.signedUrl)return NextResponse.json({error:{code:'EXPORT_SIGNING_FAILED'}},{status:500,headers:H});
  return NextResponse.json({download_url:signed.signedUrl,expires_in_seconds:artifact.expires_in_seconds,filename:artifact.filename,media_type:artifact.media_type,sha256:artifact.sha256,byte_size:artifact.byte_size},{headers:H});
}
