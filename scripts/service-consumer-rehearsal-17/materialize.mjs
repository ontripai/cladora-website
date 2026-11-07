/** Copy only installed PG/Auth package closure. No install, registry or hooks. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,readdirSync,lstatSync,realpathSync,mkdirSync,existsSync,copyFileSync,chmodSync} from 'node:fs';
import {resolve,dirname,relative,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('../../',import.meta.url).pathname);
const cache='/workspace/cladora-website/node_modules',privateRoot='/workspace/private/platform-service-consumer-rehearsal-17';
const out=join(root,'node_modules'),receipt=join(privateRoot,'runtime-materials.private.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const roots=['pg','@supabase/supabase-js','@supabase/ssr'];
assert.equal(process.argv.length,3);assert.ok(['--prepare','--verify'].includes(process.argv[2]));
assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_PG_FORCE_NATIVE&&!process.env.LD_PRELOAD,'injected runtime denied');
function safe(path){assert.equal(realpathSync(path),path,'symlink/alias');const st=lstatSync(path);assert.ok(st.isFile()&&st.nlink===1);return readFileSync(path);}
function packageRoot(specifier,parent){
 const req=createRequire(parent);let p=dirname(req.resolve(specifier));
 while(p.startsWith(cache+sep)){
  const m=join(p,'package.json');if(existsSync(m)&&JSON.parse(safe(m)).name===specifier)return p;
  p=dirname(p);
 }
 throw Error('PACKAGE_OUTSIDE_CACHE');
}
const packages=new Map(),edges=[],files=[];
function visit(name,parent){
 const dir=packageRoot(name,parent),rel=relative(cache,dir);assert.ok(!rel.startsWith('..'));
 if(packages.has(rel))return rel;
 const metadata=JSON.parse(safe(join(dir,'package.json')));packages.set(rel,{name:metadata.name,version:metadata.version});
 const dependencies={...metadata.dependencies,...metadata.optionalDependencies};
 for(const dependency of Object.keys(dependencies).sort()){
  const child=visit(dependency,join(dir,'package.json'));edges.push({parent:rel,specifier:dependency,child});
 }
 function walk(p){
  assert.equal(realpathSync(p),p);for(const name of readdirSync(p).sort()){
   if(name==='node_modules')continue;
   const path=join(p,name),st=lstatSync(path);assert.ok(!st.isSymbolicLink());
   if(st.isDirectory())walk(path);
   else{assert.ok(st.isFile()&&st.nlink===1&&!path.endsWith('.node'),'native/non-file denied');
    const b=safe(path);files.push({path:relative(cache,path),bytes:b.length,sha256:sha(b)});}
  }
 }walk(dir);return rel;
}
for(const name of roots)visit(name,'/workspace/cladora-website/package.json');
files.sort((a,b)=>a.path.localeCompare(b.path));edges.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const value={format:'platform17-installed-pg-auth-runtime-closure.v1',roots,
 packages:[...packages].map(([path,v])=>({path,...v})).sort((a,b)=>a.path.localeCompare(b.path)),edges,files,
 denied:['pg-native/libpq','addons','unsealed dependencies','package lifecycle scripts'],install:false};
const encoded=JSON.stringify(value,null,2)+'\n';
if(process.argv[2]==='--prepare'){
 assert.equal(existsSync(out),false,'existing materialization STOP');assert.equal(existsSync(receipt),false);
 mkdirSync(out,{mode:0o700});
 for(const pin of files){const source=join(cache,pin.path),target=join(out,pin.path),b=safe(source);assert.equal(sha(b),pin.sha256);
  mkdirSync(dirname(target),{recursive:true,mode:0o700});copyFileSync(source,target);chmodSync(target,0o600);}
 writeFileSync(receipt,encoded,{flag:'wx',mode:0o600});
}
assert.equal(safe(receipt).toString(),encoded,'cache/version drift');
for(const pin of files){const b=safe(join(out,pin.path));assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);}
const actual=[];function scan(p){for(const name of readdirSync(p)){const f=join(p,name),s=lstatSync(f);assert.ok(!s.isSymbolicLink());if(s.isDirectory())scan(f);else actual.push(relative(out,f));}}scan(out);
assert.deepEqual(actual.sort(),files.map(x=>x.path).sort(),'extra/missing material');
for(const edge of edges){const entry=createRequire(join(out,edge.parent,'package.json')).resolve(edge.specifier);
 assert.ok(entry.startsWith(join(out,edge.child)+sep),'transitive lookup escaped exact materialization');}
for(const name of roots)assert.ok(createRequire(join(root,'package.json')).resolve(name).startsWith(out+sep));
console.log(JSON.stringify({state:'EXACT_CACHED_CLOSURE_MATCH',packages:packages.size,files:files.length,edges:edges.length,
 sha256:sha(encoded),versions:Object.fromEntries(value.packages.filter(x=>roots.includes(x.name)).map(x=>[x.name,x.version])),install:false}));
