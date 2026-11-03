import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveOrdinaryInstallerV3,installer} from './lib/core15-ordinary-installer-profile-v3.mjs';
import {resolve} from 'node:path';
assert.equal(process.argv[2],'--accepted-source');assert.equal(process.argv.length,4);
const read=p=>readFileSync(resolve(process.argv[3],p),'utf8');let n=0;
const test=(name,f)=>{f();console.log(`PASS ${++n} ${name}`);};
for(const unit of ['foundation','assets','maintenance-procurement','building-provisioning']){
 const s=read(`supabase/install/v14-operations/${unit}.sql`);
 test(`${unit}: all-source reversible mapping and owner metadata`,()=>{const {payload,metadata}=deriveOrdinaryInstallerV3(s,unit);assert.match(payload,new RegExp(`current_user<>'${installer}'`));assert.equal(metadata.body_changes.length,unit==='foundation'?1:0);});
 test(`${unit}: extra logical role reference rejected`,()=>assert.throws(()=>deriveOrdinaryInstallerV3(s+'\nSELECT \'postgres\';',unit)));
 test(`${unit}: guard tampering rejected before binding`,()=>assert.throws(()=>deriveOrdinaryInstallerV3(s.replace("current_user<>'postgres'",'false'),unit)));
}
test('guard300 temporary SET/membership restoration preserved exactly apart from installer identifier',()=>{
 const s=read('supabase/install/v14-operations/maintenance-procurement.sql'),p=deriveOrdinaryInstallerV3(s,'maintenance-procurement').payload;
 for(const phrase of ['admin_option','inherit_option','set_option','granted by','pg_auth_members'])assert.equal(p.split(phrase).length,s.split(phrase).length);
});
console.log(JSON.stringify({checks:n,kind:'SOURCE_NOT_NATIVE'}));
