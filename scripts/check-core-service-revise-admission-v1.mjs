/** Pinned source admission review only; does not parse/execute SQL or grant authority. */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const document=new URL('../docs/core/domain-ports-01/service-revise-admission-24/admission.json',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
export function inspectCoreServiceReviseAdmissionV1(read=(ref,path)=>execFileSync('git',['show',ref+':'+path],{stdio:['ignore','pipe','pipe']})){
 const profile=JSON.parse(readFileSync(document,'utf8'));
 if(profile.permit!==null||profile.runtime!==null||profile.combined_SERVICE_ref!==null)throw Error('INACTIVE_REVIEW_PROFILE_DRIFT');
 const sources=new Map();for(const pin of profile.source_pins){let b;try{b=Buffer.from(read(pin.ref,pin.path));}catch{throw Error('SOURCE_PIN_UNAVAILABLE:'+pin.path);}if(b.length!==pin.bytes||sha(b)!==pin.sha256||createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex')!==pin.git_blob)throw Error('SOURCE_PIN_MISMATCH:'+pin.path);sources.set(pin.ref+':'+pin.path,b.toString('utf8'));}
 const sql=sources.get(profile.sql_ref+':'+profile.install_path),provider=sources.get(profile.sql_ref+':'+profile.provider_path),replay=sources.get(profile.replay_ref+':'+profile.provider_path);
 const routines=[];for(const r of profile.routines){const at=sql.indexOf(r.start);if(at<0||sql.indexOf(r.start,at+1)!==-1)throw Error('ROUTINE_SPAN_AMBIGUOUS');const end=sql.indexOf('\n$$;',at);if(end<0)throw Error('ROUTINE_SPAN_MISSING');const b=Buffer.from(sql.slice(at,end+4));if(b.length!==r.bytes||sha(b)!==r.sha256)throw Error('ROUTINE_BODY_DRIFT');routines.push({signature:r.signature,bytes:b.length,sha256:sha(b)});}
 for(const q of profile.queries){if(!provider.includes("'"+q.sql+"' as const")||q.parameters!==1||q.sql.includes(';'))throw Error('QUERY_SOURCE_DRIFT');}
 if(!replay.includes('stored.mutation_id === receipt.mutation_id')||provider.includes('stored.mutation_id === receipt.mutation_id'))throw Error('SIBLING_REPLAY_PRESERVATION_DRIFT');
 return Object.freeze({contract:'core-service-revise-source-review.v1',source_pins:'MATCH',routine_bodies:routines,query_count:profile.queries.length,source_status:'REVIEWED_BLOCKED',operation_admitted:false,permit:null,runtime:null,combined_SERVICE_ref:null,blockers:profile.blockers.map(x=>x.id),native:'NOT_RUN_NOT_PASS'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(inspectCoreServiceReviseAdmissionV1(),null,2));
