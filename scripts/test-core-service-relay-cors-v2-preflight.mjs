/** Actual source pins with controlled preflight execution; no backend effects. */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,symlinkSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CORE17_RELAY_ABI_V2,CORE17_RELAY_SEAL_V2,core17RelaySelectionV2,
  verifyCore17RelaySourcesV2,core17RelayPreflightV2} from './lib/core-service-relay-cors-v2-preflight.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const selected={CLADORA_CORE17_TRANSPORT_PROFILE:CORE17_RELAY_ABI_V2,
  CLADORA_CORE17_TRANSPORT_BINDING_SHA256:'a'.repeat(64)};
const ready=JSON.stringify({contract:CORE17_RELAY_ABI_V2,ready:true,binding_sha256:'a'.repeat(64)});
let cases=0;
function check(name,fn){fn();cases++;console.log(`PASS ${name}`);}
check('absent selectors preserve explicit legacy route without invoking v2',()=>{
  assert.equal(core17RelaySelectionV2({}),null);
  assert.equal(core17RelayPreflightV2('/missing',{},()=>assert.fail('no v2 execution')),false);
});
for(const change of [
  {CLADORA_CORE17_TRANSPORT_PROFILE:undefined},
  {CLADORA_CORE17_TRANSPORT_BINDING_SHA256:undefined},
  {CLADORA_CORE17_TRANSPORT_PROFILE:''},
  {CLADORA_CORE17_TRANSPORT_PROFILE:'arbitrary'},
  {CLADORA_CORE17_TRANSPORT_BINDING_SHA256:''},
  {CLADORA_CORE17_TRANSPORT_BINDING_SHA256:'A'.repeat(64)},
  {CLADORA_CORE17_TRANSPORT_BINDING_SHA256:'b'.repeat(63)},
  {VERCEL:'1'},{VERCEL_ENV:'preview'},{NEXT_PUBLIC_VERCEL_ENV:'production'},
])check('partial/invalid/deployed selection fails before transport '+JSON.stringify(Object.keys(change)),()=>{
  let calls=0;
  assert.throws(()=>core17RelayPreflightV2(root,{...selected,...change},()=>{calls++;return ready;}));
  assert.equal(calls,0);
});
check('real reviewed sources verify before one exact ABI call; credentials and selectors are filtered',()=>{
  const inherited={...selected,PATH:'/synthetic/bin',NODE_OPTIONS:'--require=/synthetic/host-guard.cjs',
    HTTPS_PROXY:'http://synthetic-proxy',NODE_EXTRA_CA_CERTS:'/synthetic/ca',DOCKER_CONFIG:'/synthetic/docker',
    NODE_ENV:'development',GH_TOKEN:'synthetic-secret',PGPASSWORD:'synthetic-secret',
    CLADORA_STAGING_DATABASE_URL:'synthetic-secret',NEXT_PUBLIC_OTHER_SELECTOR:'synthetic-secret',
    CLADORA_CORE15_SERVICE_BINDING_FILE:'/synthetic/private',CLADORA_CORE15_SERVICE_BINDING_SHA256:'b'.repeat(64)};
  let calls=0;
  assert.equal(core17RelayPreflightV2(root,inherited,(command,args,options)=>{
    calls++;assert.equal(command,'python3');assert.deepEqual(args.slice(0,3),['-I','-B','-c']);
    assert.deepEqual(args.slice(4),[root,'a'.repeat(64),CORE17_RELAY_SEAL_V2]);
    assert.match(args[3],/legacy\.state\(\);legacy\.cid\('pg'\)/);
    assert.match(args[3],/module\.preflight\(expected\)/);
    assert.match(args[3],/LAUNCHER_APP_ROOT_MISMATCH/);
    for(const key of ['PATH','NODE_OPTIONS','HTTPS_PROXY','NODE_EXTRA_CA_CERTS','DOCKER_CONFIG']){
      assert.equal(options.env[key],inherited[key]);
    }
    for(const key of ['NODE_ENV','GH_TOKEN','PGPASSWORD','CLADORA_STAGING_DATABASE_URL','NEXT_PUBLIC_OTHER_SELECTOR',
      'CLADORA_CORE15_SERVICE_BINDING_FILE','CLADORA_CORE15_SERVICE_BINDING_SHA256',...Object.keys(selected)]){
      assert.equal(Object.hasOwn(options.env,key),false,key);
    }
    assert.equal(options.timeout,60000);assert.equal(options.stdio,'pipe');return ready;
  }),true);assert.equal(calls,1);assert.equal(inherited.GH_TOKEN,'synthetic-secret');
});
check('original preflight failure propagates once, with no legacy fallback',()=>{
  const failure=Object.assign(Error('controlled transport failure'),{code:'CONTROLLED'});let calls=0;
  assert.throws(()=>core17RelayPreflightV2(root,selected,()=>{calls++;throw failure;}),e=>e===failure);
  assert.equal(calls,1);
});
for(const response of ['not-json','null','{}',JSON.stringify({contract:CORE17_RELAY_ABI_V2,ready:false,binding_sha256:'a'.repeat(64)}),
  JSON.stringify({contract:'legacy',ready:true,binding_sha256:'a'.repeat(64)}),
  JSON.stringify({contract:CORE17_RELAY_ABI_V2,ready:true,binding_sha256:'b'.repeat(64)}),
  JSON.stringify({contract:CORE17_RELAY_ABI_V2,ready:true,binding_sha256:'a'.repeat(64),fallback:true})]){
  check('nonexact readiness proof is rejected '+response.slice(0,45),()=>{
    let calls=0;assert.throws(()=>core17RelayPreflightV2(root,selected,()=>{calls++;return response;}));assert.equal(calls,1);
  });
}
const temporary=mkdtempSync(join(tmpdir(),'core17-relay-source-'));
function fixture(){
  const target=join(temporary,String(cases));mkdirSync(target);
  const profile=JSON.parse(readFileSync(join(root,'scripts/functional-dev-relay-cors-v2/profile.json')));
  const seal=JSON.parse(readFileSync(join(root,'scripts/functional-dev-relay-cors-v2/source-seal.json')));
  const paths=[...Object.keys(seal.files),'source-seal.json'].map(n=>'scripts/functional-dev-relay-cors-v2/'+n)
    .concat(Object.keys(profile.legacy_files).map(n=>'scripts/functional-dev-stack-v1/'+n),Object.keys(profile.environment_filter_files));
  for(const name of paths){mkdirSync(dirname(join(target,name)),{recursive:true});copyFileSync(join(root,name),join(target,name));}
  return target;
}
try{
  for(const name of ['scripts/functional-dev-relay-cors-v2/source-seal.json',
    'scripts/functional-dev-relay-cors-v2/cors_policy.py','scripts/functional-dev-stack-v1/stack.py',
    'scripts/lib/core-service-assembly-environment-v1.mjs']){
    check('source drift fails before Python import '+name,()=>{
      const target=fixture();writeFileSync(join(target,name),'controlled wrong bytes');let calls=0;
      assert.throws(()=>core17RelayPreflightV2(target,selected,()=>{calls++;return ready;}));assert.equal(calls,0);
    });
  }
  check('unlisted Python module cannot shadow trusted imports',()=>{
    const target=fixture();writeFileSync(join(target,'scripts/functional-dev-relay-cors-v2/subprocess.py'),'raise RuntimeError()');
    assert.throws(()=>verifyCore17RelaySourcesV2(target),/CORE17_RELAY_UNREVIEWED_MODULE/);
  });
  for(const kind of ['symlink','hardlink'])check(kind+' source alias rejected before import',()=>{
    const target=fixture(),file=join(target,'scripts/functional-dev-relay-cors-v2/cors_policy.py');
    if(kind==='symlink'){rmSync(file);symlinkSync(join(root,'scripts/functional-dev-relay-cors-v2/cors_policy.py'),file);}
    else linkSync(file,join(target,'linked-policy'));
    assert.throws(()=>verifyCore17RelaySourcesV2(target),/CORE17_RELAY_SOURCE_CUSTODY/);
  });
}finally{rmSync(temporary,{recursive:true});}
console.log(JSON.stringify({task:'CORE17_RELAY_CORS_LAUNCHER_COMPATIBILITY',cases,status:'PASS_CONTROLLED_ONLY',native_Auth_DB_activation:'NOT_RUN'}));
