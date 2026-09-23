import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
const HEADERS={'Cache-Control':'no-store, private',Pragma:'no-cache',Vary:'Cookie'};
const READ_ROLES=['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_AUDITOR'] as const;
export async function GET(){const auth=await getPlatformAuthContext();if(!auth.isAuthorized||!auth.platformUser)return NextResponse.json({error:{code:'UNAUTHORIZED_PLATFORM_ACCESS'}},{status:401,headers:HEADERS});if(!hasPlatformAal2(auth))return NextResponse.json({error:{code:'MFA_REQUIRED'}},{status:403,headers:HEADERS});if(!hasPlatformRole(auth,[...READ_ROLES]))return NextResponse.json({error:{code:'INSUFFICIENT_ROLE_PRIVILEGES'}},{status:403,headers:HEADERS});const supabase=await createClient();const{data,error}=await supabase.schema('customer_api').rpc('get_control_plane_overview_v1');if(error)return NextResponse.json({error:{code:'OVERVIEW_QUERY_FAILED'}},{status:500,headers:HEADERS});return NextResponse.json(data,{headers:HEADERS})}
