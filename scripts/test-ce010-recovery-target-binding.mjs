/** QFW-CE284-01: three offline synthetic-catalog witnesses; no SQL/driver. */
import assert from 'node:assert/strict';
import {classifyCe010Recovery} from './lib/ce010-install-packet.mjs';
const pre={target:'synthetic-target-a',roles:[],role_edges:[],default_acl:[],objects:[]};
const expected={target:pre.target,reference:[{name:'synthetic-postimage'}],core_seal:'synthetic-only-not-authority'};
const cases=[
 ['incompatible expected target cannot become reviewable retry', {...expected,target:'synthetic-target-b'},
  {status:'UNKNOWN_NO_ACK_NO_MUTATION',reason:'TARGET_MISMATCH'}],
 ['empty preimage on correct target remains reviewable without automatic retry',expected,
  {status:'PREIMAGE_MATCH_REVIEWABLE_RETRY',automatic_retry:false}],
 ['missing seal remains blocked/UNKNOWN without ACK or mutation',{...expected,core_seal:null},
  {status:'UNKNOWN_NO_ACK_NO_MUTATION',reason:'BLOCKED_CORE_SEALS'}],
];
for(const[name,contract,want]of cases){
 assert.deepEqual(classifyCe010Recovery(pre,structuredClone(pre),contract),want);
 console.log('PASS '+name);
}
console.log(JSON.stringify({finding:'QFW-CE284-01',checks:3,status:'PASS_OFFLINE_ONLY',SQL_Auth_native:'NOT_RUN_NOT_PASS'}));
