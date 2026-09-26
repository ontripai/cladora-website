import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

const headers={'Cache-Control':'no-store, private',Vary:'Cookie'};

export async function GET(){
 const client=await createClient();
 const {data,error}=await client.auth.getClaims();
 if(error||!data?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers});
 return NextResponse.json({level:data.claims.aal==='aal2'?'aal2':'aal1'},{headers});
}
