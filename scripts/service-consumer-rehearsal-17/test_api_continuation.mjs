import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {retryGate,persistedRepresentation} from './api-continuation.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=JSON.stringify({idempotency_key:'platform17_controlled_ack_loss_v1'});
const plan={contract:'platform17.fixed-withheld-ack.v1',origin:'http://localhost:3008',key:'platform17_controlled_ack_loss_v1',raw_body:raw,raw_sha256:sha(raw)};
const evidence={state:'PASS_WITHHELD_CLIENT_ACK_CANONICAL_RECEIPT_OBSERVED',client_outcome:'UNKNOWN_CONTROLLED_ACK_WITHHELD',plan_sha256:sha(JSON.stringify(plan)),post:{snapshot:{receipts:[{response_ref:{aggregate_id:'synthetic-test-only'}}]}},response:{value:{request_id:'synthetic-test-only'}}};
if(process.argv[2]!=='--observer-format-only'){
assert.equal(retryGate(plan,evidence),raw);
let negatives=0;
for(const change of [
 p=>{p.origin='https://example.invalid';},p=>{p.key+='new';},p=>{p.raw_body+=' ';},p=>{p.contract='other';}
]){const p=structuredClone(plan);change(p);assert.throws(()=>retryGate(p,evidence));negatives++;}
for(const change of [
 e=>{e.state='UNKNOWN_NETWORK_NO_RECEIPT';},e=>{e.post.snapshot.receipts=[];},e=>{e.response.value.request_id='other';},e=>{e.plan_sha256='other';}
]){const e=structuredClone(evidence);change(e);assert.throws(()=>retryGate(plan,e));negatives++;}
console.log(JSON.stringify({control:'explicit-retry-admission-only',positive:1,negative:negatives,DB_Auth_HTTP:'NOT_RUN'}));
}
const source={created_at:new Date('2026-11-03T21:57:06.976Z'),id:'synthetic-only'};
const persisted=JSON.parse(JSON.stringify(source));
assert.throws(()=>assert.deepEqual(source,persisted)); // exact before counterexample
assert.deepEqual(persistedRepresentation(source),persisted);
assert.notDeepEqual(persistedRepresentation({...source,created_at:new Date(source.created_at.getTime()+1)}),persisted);
console.log(JSON.stringify({control:'observer-date-persistence',before:'Date/string mismatch reproduced',after:'same instant MATCH; changed instant rejected',external_effect:'NONE'}));
