/** Capability boundary for one fixed synchronous operation, never a product loader. */
import vm from 'node:vm';
import {types} from 'node:util';
import {sha,need,canonical} from './contract.mjs';
const TS_SHA='3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675';
const BOOTSTRAP=`var module={exports:{}};var exports=module.exports;
for(const key of ['process','require','fetch','console','setTimeout','setInterval','setImmediate','queueMicrotask','WebAssembly'])
 Object.defineProperty(globalThis,key,{value:undefined,writable:false,configurable:false});`;
const PROBE=`JSON.stringify({version:module.exports.version,sys_absent:module.exports.sys===undefined,
 ambient_absent:['process','require','fetch','console','setTimeout','setInterval','setImmediate','queueMicrotask','WebAssembly'].every(k=>globalThis[k]===undefined),
 exports_in_local_realm:Object.getPrototypeOf(module.exports)===Object.prototype,
 literal_options_in_local_realm:Object.getPrototypeOf({compilerOptions:{module:1,target:9}})===Object.prototype,
 code_generation_denied:(()=>{try{new Function('return 1');return false;}catch(e){return e.name==='EvalError';}})()})`;
const OPERATION=`(()=>{const result=module.exports.transpileModule(__input,{compilerOptions:{module:1,target:9}});
 if(typeof result.outputText!=='string'||!Array.isArray(result.diagnostics??[])||(result.diagnostics??[]).length>128)throw Error('output-shape');
 return JSON.stringify({outputText:result.outputText,diagnostics:(result.diagnostics??[]).map(d=>({code:d.code,category:d.category}))});})()`;
const plainData=(object,keys)=>{
  // Proxy detection precedes reflection. Never invoke a caller getter, toJSON,
  // iterator, valueOf or prototype callback during validation.
  if(!object||typeof object!=='object'||types.isProxy(object))return null;
  const proto=Object.getPrototypeOf(object);if(proto!==Object.prototype&&proto!==null)return null;
  if(Reflect.ownKeys(object).length!==keys.length)return null;
  const values=Object.create(null);
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(object,key);if(!d||!('value'in d)||d.get||d.set)return null;values[key]=d.value;}
  return values;
};
const freezeData=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freezeData);Object.freeze(v);}return v;};
export class PinnedTypeScriptOperation {
  #context;#pins;#limits;#deny;#count=0;#proof;#script;
  constructor(raw,pins,limits,deny){
    need(Buffer.isBuffer(raw)&&sha(raw)===TS_SHA,'EXACT_TYPESCRIPT_SOURCE');
    need(typeof deny==='function','TYPESCRIPT_DENIAL_HANDLER');this.#deny=deny;
    this.#pins=freezeData(JSON.parse(JSON.stringify(pins)));this.#limits=freezeData({...limits});
    const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
    // No host object/function is injected into this context. All initial library
    // state, compiler hosts, options and callbacks originate in this realm.
    new vm.Script(BOOTSTRAP).runInContext(context,{timeout:2000});
    new vm.Script(raw.toString('utf8'),{filename:'exact-typescript-5.9.3.js'}).runInContext(context,{timeout:2000});
    const proof=JSON.parse(new vm.Script(PROBE).runInContext(context,{timeout:2000}));
    need(proof.version==='5.9.3'&&proof.sys_absent&&proof.ambient_absent&&proof.exports_in_local_realm
      &&proof.literal_options_in_local_realm&&proof.code_generation_denied,'TYPESCRIPT_REALM_CAPABILITY_MISMATCH');
    this.#context=context;this.#script=new vm.Script(OPERATION,{filename:'fixed-pinned-transpile-operation.js'});
    this.#proof=freezeData({...proof,typescript_sha256:TS_SHA,bootstrap_sha256:sha(Buffer.from(BOOTSTRAP)),probe_sha256:sha(Buffer.from(PROBE)),operation_sha256:sha(Buffer.from(OPERATION)),
      input:'HASH_PINNED_PRIMITIVE_STRING',options:'FIXED_LITERAL_CREATED_IN_REALM',output:'PRIMITIVE_JSON_THEN_HOST_DATA_ONLY',
      caller_callbacks:'NO_CHANNEL',dynamic_import:'NO_IMPORT_CALLBACK',source_execution:'NONE',native_harness:'NOT_RUN'});
  }
  evidence(){return this.#proof;}
  transpile(input,options){
    need(typeof input==='string'&&Buffer.byteLength(input)<=this.#limits.transpile_source_bytes,'FIXED_TRANSPILE_INPUT_BOUND');
    need(this.#pins.some(p=>p.bytes===Buffer.byteLength(input)&&p.sha256===sha(Buffer.from(input))),'UNPINNED_TRANSPILE_SOURCE');
    const outer=plainData(options,['compilerOptions']),inner=outer&&plainData(outer.compilerOptions,['module','target']);
    need(inner&&inner.module===1&&inner.target===9,'FIXED_TRANSPILE_OPTIONS');
    need(++this.#count<=this.#limits.total_compilations,'TRANSPILE_COUNT');
    // Only the primitive string crosses inward; validated caller objects stay out.
    this.#context.__input=input;
    let serialized;
    try{serialized=this.#script.runInContext(this.#context,{timeout:this.#limits.transpile_timeout_ms});}
    catch{return this.#deny('TYPESCRIPT_OPERATION_UNKNOWN');}
    finally{delete this.#context.__input;}
    need(typeof serialized==='string'&&Buffer.byteLength(serialized)<=this.#limits.transpile_output_bytes,'TRANSPILE_OUTPUT_BOUND');
    const result=JSON.parse(serialized);need(typeof result.outputText==='string'&&Array.isArray(result.diagnostics)&&result.diagnostics.length<=128,'TRANSPILE_OUTPUT');
    const diagnostics=result.diagnostics.map(d=>{need(canonical(Object.keys(d).sort())===canonical(['category','code'])&&Number.isSafeInteger(d.code)&&Number.isSafeInteger(d.category),'TRANSPILE_DIAGNOSTIC_DATA');return Object.freeze(Object.assign(Object.create(null),d));});
    // No VM object/function/error/prototype or library reference crosses outward.
    return Object.freeze(Object.assign(Object.create(null),{outputText:result.outputText,diagnostics:Object.freeze(diagnostics)}));
  }
}
