import { NextResponse } from 'next/server';
export const diligenceHeaders = { 'Cache-Control':'no-store, private', Pragma:'no-cache', Vary:'Cookie' };
export function diligenceFailure(code:string,status:number) {return NextResponse.json({error:{code}},{status,headers:diligenceHeaders});}
export function diligenceDatabaseFailure(e:{code?:string;message?:string}) {
 if(e.code==='42501')return diligenceFailure(['mfa_required','mfa_aal2_required'].includes(e.message??'')?'MFA_REQUIRED':'AIRPROP_ACCESS_DENIED',403);
 if(e.code==='P0002')return diligenceFailure('DILIGENCE_NOT_FOUND',404);
 const conflicts:Record<string,string>={airprop_idempotency_conflict:'IDEMPOTENCY_CONFLICT',airprop_diligence_revision_conflict:'REVISION_CONFLICT',airprop_diligence_baseline_conflict:'BASELINE_CONFLICT',airprop_diligence_not_ready:'REVIEW_NOT_READY'};
 if(e.code==='22023'&&conflicts[e.message??''])return diligenceFailure(conflicts[e.message??''],409);
 return diligenceFailure(['22023','22P02','22003'].includes(e.code??'')?'INVALID_REQUEST':'AIRPROP_REQUEST_FAILED',['22023','22P02','22003'].includes(e.code??'')?400:500);
}
