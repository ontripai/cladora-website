/** Owned transport readiness only. A digest is integrity input, not authority. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {coreServiceAssemblyChildEnvironmentV1} from './core-service-assembly-environment-v1.mjs';

export const CORE17_RELAY_ABI_V2='platform17.relay-cors-preflight.v2';
export const CORE17_RELAY_SEAL_V2='c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02';
const files=['CONTRACT.md','activation-binding.template.json','cors_policy.py','profile.json',
  'relay_v2.py','sdk-source-pins.json','test_cors_v2.py','transition.py'];
const sha=raw=>createHash('sha256').update(raw).digest('hex');

export function core17RelaySelectionV2(environment){
  const profile=environment.CLADORA_CORE17_TRANSPORT_PROFILE;
  const binding=environment.CLADORA_CORE17_TRANSPORT_BINDING_SHA256;
  if(profile===undefined&&binding===undefined)return null;
  assert.equal(profile,CORE17_RELAY_ABI_V2,'CORE17_RELAY_PROFILE_REQUIRED');
  assert.match(binding??'',/^[a-f0-9]{64}$/,'CORE17_RELAY_BINDING_DIGEST_REQUIRED');
  assert.ok(!environment.VERCEL&&!environment.VERCEL_ENV&&!environment.NEXT_PUBLIC_VERCEL_ENV,
    'CORE17_RELAY_OWNED_DEVELOPMENT_ONLY');
  return {profile,binding};
}

function sourceBytes(path){
  const stat=lstatSync(path);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=2097152,
    'CORE17_RELAY_SOURCE_CUSTODY');
  assert.equal(realpathSync(path),path,'CORE17_RELAY_SOURCE_ALIAS');
  return readFileSync(path);
}

export function verifyCore17RelaySourcesV2(appRoot){
  const root=resolve(appRoot);
  assert.equal(realpathSync(root),root,'CORE17_RELAY_ROOT_ALIAS');
  const directory=join(root,'scripts/functional-dev-relay-cors-v2');
  assert.deepEqual(readdirSync(directory).sort(),[...files,'source-seal.json'].sort(),
    'CORE17_RELAY_UNREVIEWED_MODULE');
  const raw=sourceBytes(join(directory,'source-seal.json'));
  assert.equal(sha(raw),CORE17_RELAY_SEAL_V2,'CORE17_RELAY_SEAL_NOT_REVIEWED');
  const seal=JSON.parse(raw);
  assert.equal(seal.contract,'platform17.relay-cors-source-seal.v2');
  assert.deepEqual(Object.keys(seal.files).sort(),files);
  assert.equal(sha(JSON.stringify(Object.fromEntries(Object.entries(seal.files).sort()))),seal.sha256);
  for(const name of files)assert.equal(sha(sourceBytes(join(directory,name))),seal.files[name],name);
  const profile=JSON.parse(sourceBytes(join(directory,'profile.json')));
  for(const [name,pin]of Object.entries(profile.legacy_files)){
    assert.equal(sha(sourceBytes(join(root,'scripts/functional-dev-stack-v1',name))),pin,name);
  }
  for(const [name,pin]of Object.entries(profile.environment_filter_files)){
    assert.equal(sha(sourceBytes(join(root,name))),pin,name);
  }
  return {root,directory};
}

// -I isolates Python imports. The exact reviewed module is verified again in
// the child before import; binding then checks current backend/app/launcher/PID.
const program=String.raw`import hashlib,importlib.util,json,sys
from pathlib import Path
root=Path(sys.argv[1]);expected=sys.argv[2];seal_sha=sys.argv[3]
directory=root/'scripts/functional-dev-relay-cors-v2'
raw=(directory/'source-seal.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==seal_sha,'RELAY_SEAL_CHANGED'
seal=json.loads(raw)
for name,pin in seal['files'].items():
 assert hashlib.sha256((directory/name).read_bytes()).hexdigest()==pin,'RELAY_SOURCE_CHANGED'
spec=importlib.util.spec_from_file_location('core17_reviewed_relay_v2',directory/'relay_v2.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
legacy,binding=module.load_binding(expected)
legacy.state();legacy.cid('pg')
module.need(Path(binding['app']['root'])==root,'LAUNCHER_APP_ROOT_MISMATCH')
print(json.dumps(module.preflight(expected)))`;

export function core17RelayPreflightV2(appRoot,environment,execute=execFileSync){
  const selected=core17RelaySelectionV2(environment);
  if(selected===null)return false;
  const source=verifyCore17RelaySourcesV2(appRoot);
  const env=coreServiceAssemblyChildEnvironmentV1(environment,'start');
  if(environment.DOCKER_CONFIG!==undefined)env.DOCKER_CONFIG=environment.DOCKER_CONFIG;
  const raw=execute('python3',['-I','-B','-c',program,source.root,selected.binding,CORE17_RELAY_SEAL_V2],
    {env,stdio:'pipe',encoding:'utf8',timeout:60000,maxBuffer:65536});
  let result;
  try{result=JSON.parse(raw);}catch{throw Error('CORE17_RELAY_PREFLIGHT_RESULT_REQUIRED');}
  assert.deepEqual(result,{contract:CORE17_RELAY_ABI_V2,ready:true,binding_sha256:selected.binding},
    'CORE17_RELAY_PREFLIGHT_NOT_READY');
  return true;
}
