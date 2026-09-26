import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ownerOverview, type OwnerUnit, type OwnerLease, type OwnerCash } from '@/lib/owner-portfolio/overview';
const headers={'Cache-Control':'no-store, private',Vary:'Cookie'};
export async function GET(){
  const db=await createClient();
  const {data:claims,error}=await db.auth.getClaims();
  if(error||!claims?.claims?.sub)return NextResponse.json({error:'UNAUTHORIZED'},{status:401,headers});
  const access=await db.schema('customer_api').rpc('my_multi_unit_owner_access_v1' as never);
  if(access.error||access.data!==true)return NextResponse.json({error:'ACCESS_DENIED'},{status:403,headers});
  // Use the user's RLS session, never a service client. Refuse oversized results
  // instead of presenting a truncated financial total as a complete portfolio.
  async function readAll<T>(table:'owner_private_units'|'owner_private_leases'|'owner_private_cash_entries',columns:string):Promise<T[]>{
    const rows:T[]=[];
    for(let offset=0;offset<=10000;offset+=500){
      const {data,error}=await db.from(table).select(columns).order('id').range(offset,offset+499);
      if(error)throw new Error('READ_FAILED');
      const page=(data??[]) as unknown as T[];rows.push(...page);
      if(rows.length>10000)throw new Error('PORTFOLIO_TOO_LARGE');
      if(page.length<500)return rows;
    }
    throw new Error('PORTFOLIO_TOO_LARGE');
  }
  try{
    const [units,leases,cash]=await Promise.all([
      readAll<OwnerUnit>('owner_private_units','id,building_label,unit_label,address_text,status'),
      readAll<OwnerLease>('owner_private_leases','id,unit_id,tenant_label,starts_on,ends_on,monthly_rent,currency,status'),
      readAll<OwnerCash>('owner_private_cash_entries','id,unit_id,kind,direction,amount,currency,due_on,paid_on,memo'),
    ]);
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    return NextResponse.json(ownerOverview(units,leases,cash,today),{headers});
  }catch(error){const code=error instanceof Error&&error.message==='PORTFOLIO_TOO_LARGE'?'PORTFOLIO_TOO_LARGE':'OVERVIEW_FAILED';return NextResponse.json({error:code},{status:code==='PORTFOLIO_TOO_LARGE'?413:500,headers});}
}
