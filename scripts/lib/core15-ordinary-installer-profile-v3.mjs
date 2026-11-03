/** Exact logical-installer rebinding, NOT a SQL compiler or privileged fallback. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const installer='cladora_core_installer';
const sha=s=>createHash('sha256').update(s).digest('hex');
const pins={
 foundation:['f0e13f0c8b50f2dd43c80aaab1d3bc9a3b76b627f5118f9dfb4219b1f30c5d27',131,1],
 assets:['d51db3a078ed259120ad3801f77cd852742969e2f141dc70dcdc0611450087ba',77,1],
 'maintenance-procurement':['6ce3f721329f6cbdd7c945769b022a1afa6b65cf2e898abc19b8c11447c8bcad',100,2],
 'building-provisioning':['91195b0e0eef75444386795beda113daf417d4cf464bed2da91ec36adab539cb',49,1],
};
export const sourceTarget="current_setting('cladora.install.target',true) is distinct from 'ryygcqiunqqtfkpkflzf'";
export const ownedTarget=`(current_database()<>'postgres'
   or current_setting('cladora.install.target',true) is null
   or current_setting('cladora.install.target',true)!~'^core15-dev:[a-f0-9]{32}$'
   or current_setting('cladora.install.target_oid',true) is distinct from
    (select oid::text from pg_database where datname=current_database()))`;
const functions=/(\bcreate\s+(?:or\s+replace\s+)?function\s+([a-z_][\w]*\.[a-z_][\w]*)\s*\([\s\S]*?\bas\s+)(\$[a-z_\d]*\$)([\s\S]*?)\3\s*;/gi;
export function deriveOrdinaryInstallerV3(source,unit){
 const pin=pins[unit];assert.ok(pin,'closed native unit set');assert.equal(sha(source),pin[0],'accepted source identity');
 assert.equal([...source.matchAll(/\bpostgres\b/gi)].length,pin[1],'complete role census');
 assert.equal(source.split(sourceTarget).length-1,pin[2],'complete target census');
 assert.equal(source.includes(installer),false,'no collision with logical role name');
 const affected=[...source.matchAll(functions)].filter(m=>/\bpostgres\b/i.test(m[4]));
 assert.equal(affected.length,unit==='foundation'?1:0,'no unmapped business function');
 const bodyChanges=affected.map(m=>{assert.equal(m[2],'app_private.guard_workspace_member_role_authority_v2');
  const before=sha(m[4]),after=sha(m[4].replace(/\bpostgres\b/g,installer));
  assert.equal(before,'ba55df5a5c2fd97032195db0ab78c7fdd7fa4f72786619547768c7dad8b6311c');
  assert.equal(source.split(before).length-1,1,'exact expected body hash');return{name:m[2],before,after};});
 let payload=source.replace(/\bpostgres\b/g,installer).split(sourceTarget).join(ownedTarget);
 for(const b of bodyChanges)payload=payload.replace(b.before,()=>b.after);
 let roundtrip=payload.split(ownedTarget).join(sourceTarget).replaceAll(installer,'postgres');
 for(const b of bodyChanges)roundtrip=roundtrip.replace(b.after,()=>b.before);
 assert.equal(roundtrip,source,'ALL owner/security/ACL/SET option/guard bytes roundtrip');
 assert.match(payload,/exists\(select 1 from pg_roles where rolname=current_user and rolsuper\)/);
 assert.doesNotMatch(payload,/ALTER\s+ROLE\s+(?:postgres|supabase_\w+)/i);
 return{payload,metadata:{unit,source_sha256:pin[0],payload_sha256:sha(payload),bytes:Buffer.byteLength(payload),role_references:pin[1],target_references:pin[2],body_changes:bodyChanges,
  role_mapping:{postgres:installer},protected:'whole-source reverse transform equality; guard300 option/restoration logic retained'}};
}
