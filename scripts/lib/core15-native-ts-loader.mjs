/** Actual modules only. No Auth/PG/authority/clock mocks. Git overlay is read-only. */
import Module,{createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,extname} from 'node:path';
import ts from 'typescript';
export function createCore15NativeLoader(root,gitOverlay={}){
 const cache=new Map();
 function load(name){
  let file=resolve(root,name);if(!extname(file))file+=existsSync(file+'.ts')?'.ts':'.json';
  if(!file.startsWith(resolve(root)+'/'))throw Error('NATIVE_SOURCE_OUTSIDE_ROOT');if(cache.has(file))return cache.get(file).exports;
  if(file.endsWith('.json'))return JSON.parse(readFileSync(file,'utf8'));
  const relative=file.slice(resolve(root).length+1),raw=gitOverlay[relative]?execFileSync('git',['show',gitOverlay[relative]+':'+relative],{cwd:root,encoding:'utf8'}):readFileSync(file,'utf8');
  const m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(dirname(file));cache.set(file,m);const actual=createRequire(file);
  m.require=id=>id==='server-only'?actual('next/dist/compiled/server-only/empty')
   :id.startsWith('@/')?load('src/'+id.slice(2))
    :id.startsWith('.')&&(!extname(id)||id.endsWith('.ts')||id.endsWith('.json'))?load(resolve(dirname(file),id)):actual(id);
  m._compile(ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);return m.exports;
 }
 return{load};
}
