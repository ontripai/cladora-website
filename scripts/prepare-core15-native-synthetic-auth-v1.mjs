/** Real GoTrue/SSR synthetic MFA login on the existing owned Platform12 only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHmac,createHash} from 'node:crypto';
import {createServerClient} from '@supabase/ssr';
const root='/workspace/private/cladora-functional-dev-v1';
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const read=p=>JSON.parse(readFileSync(root+'/'+p)),s=read('secrets.json'),users=read('users.json');assert.equal(users.state,'CREATED_BY_REAL_AUTH');
const path=root+'/core15/service-mfa-private.json';assert.equal(existsSync(path),false,'STOP prior MFA dispatch; no automatic enrollment/recovery');
const record={state:'DISPATCHED_NO_RETRY',users:[]};const save=()=>writeFileSync(path,JSON.stringify(record,null,2)+'\n',{mode:0o600});save();
function totp(secret){let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){const x='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);assert.ok(x>=0);bits+=x.toString(2).padStart(5,'0');}
 const key=Buffer.from((bits.match(/.{8}/g)??[]).map(x=>parseInt(x,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const mac=createHmac('sha1',key).update(counter).digest(),offset=mac[19]&15;return((mac.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
try{
 for(const [index,u] of users.users.entries()){
  const jar=new Map(),a=createServerClient('http://127.0.0.1:55421',s.anon_key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:rows=>{for(const x of rows){if(x.value)jar.set(x.name,x.value);else jar.delete(x.name);}}}});
  const login=await a.auth.signInWithPassword({email:u.email,password:s[u.password_key]});assert.equal(login.error,null);assert.equal(login.data.user.id,u.id);
  const factors=await a.auth.mfa.listFactors();assert.equal(factors.error,null);assert.equal(factors.data.all.length,0,'existing factor requires reviewed recovery, not duplicate enrollment');
  record.users.push({index,state:'ENROLLMENT_DISPATCHED'});save();
  const enrolled=await a.auth.mfa.enroll({factorType:'totp',friendlyName:'Core15 owned synthetic native proof'});assert.equal(enrolled.error,null);
  const item=record.users.at(-1);item.factor_id=enrolled.data.id;item.factor_secret=enrolled.data.totp.secret;item.state='ENROLLED_NOT_VERIFIED';save();
  const challenge=await a.auth.mfa.challenge({factorId:enrolled.data.id});assert.equal(challenge.error,null);
  item.state='VERIFICATION_DISPATCHED';save();const verified=await a.auth.mfa.verify({factorId:enrolled.data.id,challengeId:challenge.data.id,code:totp(enrolled.data.totp.secret)});assert.equal(verified.error,null);
  const claims=await a.auth.getClaims();assert.equal(claims.error,null);assert.equal(claims.data.claims.aal,'aal2');assert.equal(claims.data.claims.sub,u.id);
  const user=await a.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user.id,u.id);
  item.state='REAL_AUTH_AAL2_VERIFIED';item.cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');item.access_token=verified.data.access_token;item.session_id=claims.data.claims.session_id;item.actor_id=u.id;save();
 }
 record.state='TWO_REAL_SYNTHETIC_AAL2_SESSIONS';save();console.log(JSON.stringify({state:record.state,private_receipt_sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),native_auth:true,command_authority:'NOT_IMPLIED'}));
}catch(e){record.state='FAILED_OR_UNKNOWN_STOP';record.error_code=e.code??'LOCAL_OR_PROVIDER';save();console.error(JSON.stringify({state:record.state,error_code:record.error_code,private_receipt:true}));process.exitCode=1;}
