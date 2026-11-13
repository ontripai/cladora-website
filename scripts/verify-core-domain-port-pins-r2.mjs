/** Offline bytes/source identity check; never SQL/native/activation proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function identity(bytes){return{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),git_blob:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')};}
let count=0;
for(const name of ['offering-read-r2','listing-read-r2','successor-coupling-r2']){
 const file=`docs/core/domain-ports-01/${name}/manifest.json`,m=JSON.parse(readFileSync(resolve(root,file),'utf8'));
 assert.equal(m.Parent,'62f3c4ea3280821d3df69cd5d0cfbd10fbf6cb6d');assert.equal(m.activation,null);assert.equal(m.target_calls,0);
 for(const item of m.inventory){assert.deepEqual(identity(readFileSync(resolve(root,item.path))),item.after,`${file}:${item.path}`);
  if(item.before)assert.deepEqual(identity(execFileSync('git',['show',`${m.Parent}:${item.path}`],{cwd:root})),item.before);count++;}
 for(const item of m.protected??[]){const {path,source: _source,...expected}=item;assert.deepEqual(identity(readFileSync(resolve(root,path))),expected,`protected:${path}`);count++;}
 for(const item of [...(m.consumer??[]),...(m.canonical_RPC??[]),...(m.protected??[])]){
  const {path,source,...expected}=item;assert.deepEqual(identity(execFileSync('git',['show',`${source}:${path}`],{cwd:root})),expected,`${source}:${path}`);count++;
 }
}
console.log(JSON.stringify({contract:'core-domain-port-pins-r2.v1',identity_checks:count,result:'PASS_OFFLINE_IDENTITIES_ONLY',native:'NOT_RUN_NOT_PASS',activation:null}));
