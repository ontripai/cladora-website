import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
assert.equal(process.argv[2],'--accepted-source');assert.equal(process.argv.length,4);const accepted=resolve(process.argv[3]);
import {deriveOrdinaryInstallerV3} from './lib/core15-ordinary-installer-profile-v3.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const dir=new URL('../supabase/install/core-functional-runtime-v1/service-native-v3/',import.meta.url);mkdirSync(dir,{recursive:true});
const units=['foundation','assets','maintenance-procurement','building-provisioning'].map((unit,i)=>{
 const path=`supabase/install/v14-operations/${unit}.sql`,source=readFileSync(resolve(accepted,path),'utf8');
 const {metadata}=deriveOrdinaryInstallerV3(source,unit);return{order:i+1,path,...metadata};});
const module=readFileSync(new URL('./lib/core15-ordinary-installer-profile-v3.mjs',import.meta.url));
const prerequisitePath='supabase/install/core-functional-runtime-v1/service-native-v3/installer-prerequisites.sql';
const prerequisite=readFileSync(new URL('../'+prerequisitePath,import.meta.url));
const source_manifest={blob:'a13e382d31ea40b2ddd52306a34c56b648f3ed47',sha256:'94543e82513461f808037fdbfcb6c3d51531f4d826e82155a8844ace15929822',outputs:'Core300 all48_source_outputs; four exact native installers only; no old readiness/private artifact required'};
const manifest={source_manifest,contract:'core15-ordinary-installer-profile.v3',parent:'a0a37f3c573558d14be2e62ba27e6e5475b9c4fe',platform:'794f5a12c3928ae0a3585ab679a3cbe60aab49a3',
 profile:{lifecycle_custodian:'postgres; unchanged provider profile',installer:'cladora_core_installer; ordinary LOGIN NOINHERIT CREATEROLE; no privileged memberships',runtime:'cladora_core_runtime; no installer/owner membership or DDL rights'},
 adapter:{path:'scripts/lib/core15-ordinary-installer-profile-v3.mjs',bytes:module.length,sha256:sha(module)},
 prerequisite:{path:prerequisitePath,bytes:prerequisite.length,sha256:sha(prerequisite)},units,
 execution:'NOT_DISPATCHED; private actual target/PG principal/custody preflight required; GUC not identity proof',
 settlement:'one COMMIT per exact unit; mismatch/UNKNOWN stop, no global rollback or blind resend',
 install_closure:'accepted four native source units ONLY, not replay-all historical migrations',
 authority:'closed native ACL; no caller positive grant; Service runtime access separate',
 native_runtime:'NOT_READY'};
writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({units:units.length,payloads:units.map(x=>({unit:x.unit,bytes:x.bytes,sha256:x.payload_sha256})),native:'NOT_RUN'}));
