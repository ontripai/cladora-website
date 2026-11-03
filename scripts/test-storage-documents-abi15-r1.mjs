// Offline validators/route boundaries ONLY. No SDK/provider mock and no network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descriptor, validateAck, validateInfo, validateDenied, failureEvidence } from './storage-documents-native-abi-r1/native.mjs';

const f={run:'a'.repeat(32),bucket:'platform15-'+'a'.repeat(32),path:'owned/fixture.png',
  actor_a:'11111111-1111-4111-8111-111111111111',actor_b:'22222222-2222-4222-8222-222222222222'};
const id='33333333-3333-4333-8333-333333333333';

test('exact native upload ACK ABI; missing/null/wrong ID and path rejected',()=>{
  const raw={Id:id,Key:`${f.bucket}/${f.path}`};
  const data={id,path:f.path,fullPath:raw.Key};
  assert.equal(validateAck(raw,data,f),id);
  for(const x of [null,undefined,'not-uuid']) assert.throws(()=>validateAck({...raw,Id:x},data,f));
  assert.throws(()=>validateAck({...raw,Key:'other'},data,f));
  assert.throws(()=>validateAck(raw,{...data,id:f.actor_a},f));
});

test('raw snake-case and real SDK camel-case mapping including optional absence',()=>{
  const raw={id,name:f.path,bucket_id:f.bucket,content_type:'image/png',size:3,version:null};
  const sdk={id,name:f.path,bucketId:f.bucket,contentType:'image/png',size:3,version:null};
  assert.deepEqual(validateInfo(raw,sdk,f,id,Buffer.alloc(3)),{version:{raw:'NULL',sdk:'NULL'},etag:{raw:'MISSING',sdk:'MISSING'}});
  assert.throws(()=>validateInfo({...raw,id:null},sdk,f,id,Buffer.alloc(3)));
  assert.throws(()=>validateInfo(raw,{...sdk,bucketId:'other'},f,id,Buffer.alloc(3)));
  assert.throws(()=>validateInfo({...raw,size:4},sdk,f,id,Buffer.alloc(3)));
  assert.throws(()=>validateInfo(raw,{...sdk,version:'invented'},f,id,Buffer.alloc(3)));
});

test('4xx alone is not denial proof; no401/timeout/rate-limit/malformed route',()=>{
  const r={error:{statusCode:'403'},data:null};
  const resp={status:403,raw:Buffer.from(JSON.stringify({error:'AccessDenied'}))};
  validateDenied(r,resp,'upsert');
  for(const status of [200,401,408,429,500]) assert.throws(()=>validateDenied(r,{...resp,status},'upsert'));
  assert.throws(()=>validateDenied(r,{status:400,raw:Buffer.from('{"error":"InvalidKey"}')},'upsert'));
  assert.throws(()=>validateDenied({...r,data:{id}},resp,'update'));
  validateDenied({error:{statusCode:'409'},data:null},{status:409,raw:Buffer.from('{"error":"Duplicate"}')},'duplicate');
  assert.throws(()=>validateDenied(r,{...resp,raw:Buffer.from('{"error":"Unauthorized","message":"JWT expired"}')},'foreign-info'));
});

test('fixed origin/bucket/actor/phase/method; routes cannot expand effect',()=>{
  const url=`http://127.0.0.1:55421/storage/v1/object/${f.bucket}/${f.path}`;
  assert.equal(descriptor('a','upload','POST',url,f).phase,'upload');
  assert.throws(()=>descriptor('a','upload','POST',url.replace('127.0.0.1','example.com'),f));
  assert.throws(()=>descriptor('a','upload','DELETE',url,f));
  assert.throws(()=>descriptor('b','upload','POST',url,f));
  assert.throws(()=>descriptor('custodian','upload','POST',url,f));
  assert.throws(()=>descriptor('a','upload','POST',url+'?upsert=true',f));
  assert.throws(()=>descriptor('a','upload','POST',url,{...f,path:'../shared'}));
  assert.throws(()=>descriptor('a','run','POST',url,f));
});

test('cleanup route is exact; anon/foreign reads do not become service reads',()=>{
  const object=`http://127.0.0.1:55421/storage/v1/object/${f.bucket}`;
  assert.equal(descriptor('custodian','cleanup-object','DELETE',object,f).actor,'custodian');
  assert.throws(()=>descriptor('a','cleanup-object','DELETE',object,f));
  assert.throws(()=>descriptor('custodian','cleanup-object','DELETE',object+'-foreign',f));
  const info=`http://127.0.0.1:55421/storage/v1/object/info/${f.bucket}/${f.path}`;
  assert.equal(descriptor('b','foreign-info','GET',info,f).actor,'b');
  assert.equal(descriptor('anon','anon-info','GET',info,f).actor,'anon');
  assert.throws(()=>descriptor('custodian','foreign-info','GET',info,f));
});

test('public route requires exact anonymous GET;404 bucket concealment is contextual',()=>{
  const url=`http://127.0.0.1:55421/storage/v1/object/public/${f.bucket}/${f.path}`;
  descriptor('anon','anon-public','GET',url,f);
  assert.throws(()=>descriptor('custodian','anon-public','GET',url,f));
  assert.throws(()=>descriptor('anon','anon-public','POST',url,f));
  const result={data:null,error:{statusCode:'404'}};
  const response={status:404,raw:Buffer.from('{"code":"NoSuchBucket"}')};
  validateDenied(result,response,'anon-public');
  assert.throws(()=>validateDenied(result,response,'foreign-info'));
});

test('capture and driver failures retain first original cause without a success marker',()=>{
  const disk=Object.assign(new Error('FIRST_ORIGINAL'),{code:'ENOSPC'});
  assert.deepEqual(failureEvidence(disk,'persistence','upload'),{phase:'upload',stage:'persistence',name:'Error',code:'ENOSPC',cause_code:null,original_message:'FIRST_ORIGINAL'});
  const driver=new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});
  assert.equal(failureEvidence(driver,'driver','upload').cause_code,'ECONNRESET');
  assert.equal(failureEvidence(driver,'driver','upload').stage,'driver');
});
